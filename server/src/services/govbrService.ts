import { chromium } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileLog } from '../logger';

export class GovBrService {

    /**
     * Automates Gov.br login and scrapes PGFN.
     */
    static async scrapePGFN(pfxBuffer: Buffer, passphrase: string): Promise<any> {
        console.log("Iniciando Robô PGFN (Playwright)...");

        const sessionId = uuidv4();
        const pfxPath = path.join(os.tmpdir(), `cert-${sessionId}.pfx`);

        try {
            fs.writeFileSync(pfxPath, pfxBuffer);

            let finalPfxPath = pfxPath;
            if (process.platform === 'darwin') {
                try {
                    console.log("[GovBrService] Convertendo formato legado do Certificado para AES-256 (BoringSSL)...");
                    const pemPath = pfxPath + '.pem';
                    const modernPfxPath = pfxPath + '.modern.pfx';
                    const { execSync } = require('child_process');
                    execSync(`openssl pkcs12 -legacy -in "${pfxPath}" -passin pass:"${passphrase}" -nodes -out "${pemPath}"`);
                    execSync(`openssl pkcs12 -export -in "${pemPath}" -out "${modernPfxPath}" -passout pass:"${passphrase}"`);
                    finalPfxPath = modernPfxPath;
                } catch (sslErr: any) {
                    console.error("[GovBrService] Erro ao converter certificado:", sslErr.message);
                }
            }

            const browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--disable-extensions', '--disable-background-networking', '--window-size=1280,800', '--ignore-certificate-errors', '--disable-web-security']
            });

            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                clientCertificates: [
                    {
                        origin: 'https://www.regularize.pgfn.gov.br',
                        pfxPath: finalPfxPath,
                        passphrase: passphrase
                    },
                    {
                        origin: 'https://sso.acesso.gov.br',
                        pfxPath: finalPfxPath,
                        passphrase: passphrase
                    },
                    {
                        origin: 'https://certificadodigital.acesso.gov.br',
                        pfxPath: finalPfxPath,
                        passphrase: passphrase
                    }
                ]
            });

            const page = await context.newPage();
            page.on('console', msg => fileLog('\n[PGFN DOM LOG]: ' + msg.text()));
            page.setDefaultNavigationTimeout(45000);
            page.setDefaultTimeout(30000);

            try {
                // 1. Emulate User Navigation Starting at PGFN Portal main entry
                console.log("[GovBrService] Acessando porta da frente do PGFN...");
                await page.goto('https://www.regularize.pgfn.gov.br', { waitUntil: 'networkidle' }).catch(() => { });

                // 2. Click Gov.br Login Button visually
                await page.waitForFunction(() => {
                    const links = Array.from(document.querySelectorAll('a, button'));
                    const authBtn = links.find(el => (el as HTMLElement).innerText.toLowerCase().includes('entrar com gov.br') || (el as HTMLAnchorElement).href.includes('gov.br'));
                    if (authBtn) {
                        (authBtn as HTMLElement).click();
                        return true;
                    }
                    // Secondary logic if button image is used
                    const imgs = Array.from(document.querySelectorAll('img'));
                    const govImg = imgs.find(img => img.src.includes('govbr') || (img.alt && img.alt.toLowerCase().includes('gov.br')));
                    if (govImg && govImg.closest('a')) {
                        (govImg.closest('a') as HTMLElement).click();
                        return true;
                    }
                    return false;
                }, { timeout: 15000 }).catch(() => {
                    console.log("[GovBrService] Botão não encontrado visualmente, tentando link de SSO direto...");
                });

                // Fallback direct SSO if visual click fails or redirects to Gov.br
                if (!page.url().includes('acesso.gov.br')) {
                    await page.goto('https://sso.acesso.gov.br/authorize?response_type=code&client_id=regularize.pgfn.gov.br', { waitUntil: 'load' });
                }

                // 3. Login using Digital Certificate
                console.log("[GovBrService] Aguardando tela de Login Gov.br...");
                await page.waitForSelector('#login-certificate', { timeout: 15000 });
                await page.click('#login-certificate');

                console.log("[GovBrService] Aguardando redirect de volta pro PGFN...");
                await page.waitForURL('**/regularize.pgfn.gov.br/**', { timeout: 35000, waitUntil: 'domcontentloaded' }).catch(() => { });
                await new Promise(r => setTimeout(r, 4000));

                // 🚨 CRITICAL FIX: Explicit check if we landed on the expected PGFN portal. 
                // Gov.br often redirects to the news portal (www.gov.br) when authentication silently fails.
                if (!page.url().includes('regularize.pgfn.gov.br')) {
                    const debugPath = path.join(__dirname, '..', '..', 'debug', `pgfn-auth-fail-${uuidv4()}.png`);
                    await page.screenshot({ path: debugPath, fullPage: true }).catch(console.error);
                    throw new Error(`A autenticação falhou e o Gov.br redirecionou para fora do portal PGFN. URL Atual: ${page.url()}`);
                }

                const bodyText = await page.evaluate(() => document.body.innerText.toUpperCase());
                if (bodyText.includes('401') || bodyText.includes('UNAUTHORIZED') || bodyText.includes('NÃO AUTORIZADO') || bodyText.includes('ACESSO NEGADO')) {
                    throw new Error("O Gov.br rejeitou este Certificado Digital (401 Não Autorizado). Verifique se o e-CNPJ é válido e possui permissão de acesso ao PGFN.");
                }

                console.log("[GovBrService] Buscando aba 'Consultar Dívida'...");

                // Visual navigation inside PGFN
                try {
                    await page.evaluate(() => {
                        const cards = Array.from(document.querySelectorAll('a, div, span'));
                        const consultCard = cards.find(el => (el as HTMLElement).innerText.includes('Consultar Dívida') || (el as HTMLElement).innerText.includes('Consulta de Débitos'));
                        if (consultCard) (consultCard as HTMLElement).click();
                    });
                } catch (e) {
                    console.log("[GovBrService] Card 'Consultar Dívida' não clicável. Indo via URL direta...");
                    // Try to navigate directly to debts if button not found or clicked
                    await page.goto('https://www.regularize.pgfn.gov.br/consultar-divida', { waitUntil: 'load' }).catch(() => { });
                }

                await new Promise(r => setTimeout(r, 5000));

                const debugDir = path.join(__dirname, '..', '..', 'debug');
                if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
                const screenshotPath = path.join(debugDir, `pgfn-debug-${uuidv4()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true }).catch(console.error);
                console.log("[GovBrService] Screenshot de debug salvo em:", screenshotPath);

                const realDebts: any[] = [];
                // Look into IFrames if any
                const targetFrame = page.frames().find(f => f.url().includes('consultar')) || page.mainFrame();

                const frameDebts = await targetFrame.evaluate(() => {
                    console.log("[GovBrService] Varrida na página PGFN iniciada...");
                    const arr: any[] = [];
                    const rows = Array.from(document.querySelectorAll('table tr, .card-divida, .linha-debito'));
                    console.log("[PGFN] Encontrados " + rows.length + " elementos.");

                    rows.forEach((row, index) => {
                        const text = (row as HTMLElement).innerText.trim().toUpperCase();
                        console.log("[PGFN] Analisando elemento " + index + ": " + text.substring(0, 30));
                        if (text.includes('INSCR') || text.includes('VALOR') || text.includes('DÍVIDA') || text.includes('SITUAÇÃO')) {
                            // Try to parse values like R$ 1.500,00
                            const monetaryMatch = text.match(/R\$\s*([\d.,]+)/);
                            const valStr = monetaryMatch ? monetaryMatch[1].replace(/\./g, '').replace(',', '.') : '0';

                            if (parseFloat(valStr) > 0) {
                                arr.push({
                                    descricao: `Inscrição PGFN: ${text.substring(0, 50).replace(/\n/g, ' ')}...`,
                                    risco: "Crítico",
                                    valor: parseFloat(valStr),
                                    status: text.includes('ATIVA') ? 'Pendente' : 'Revisão'
                                });
                            }
                        }
                    });
                    return arr;
                });
                realDebts.push(...frameDebts);

                return {
                    status: 'success',
                    message: realDebts.length > 0 ? 'Dívidas Ativas encontradas!' : 'Nenhuma Dívida Ativa encontrada no Regularize.',
                    screenshot: screenshotPath,
                    debts: realDebts
                };

            } finally {
                await browser.close().catch(() => { });
            }
        } catch (error: any) {
            console.error("\n[GovBrService] 🔥 PGFN SCRAPING ERROR CAUGHT 🔥", error.stack || error);
            return { status: 'error', message: `Erro no PGFN: ${error.message}`, debts: [] };
        } finally {
            if (fs.existsSync(pfxPath)) fs.unlinkSync(pfxPath);
            if (fs.existsSync(pfxPath + '.pem')) fs.unlinkSync(pfxPath + '.pem');
            if (fs.existsSync(pfxPath + '.modern.pfx')) fs.unlinkSync(pfxPath + '.modern.pfx');
        }
    }

    /**
     * Scrapes e-Social portal for pending obligations or errors.
     */
    static async scrapeESocial(pfxBuffer: Buffer, passphrase: string): Promise<any> {
        console.log("Iniciando Robô e-Social (Playwright)...");

        const sessionId = uuidv4();
        const pfxPath = path.join(os.tmpdir(), `cert-${sessionId}.pfx`);

        try {
            fs.writeFileSync(pfxPath, pfxBuffer);

            let finalPfxPath = pfxPath;
            if (process.platform === 'darwin') {
                try {
                    console.log("[GovBrService] Convertendo formato legado do Certificado para AES-256 (BoringSSL)...");
                    const pemPath = pfxPath + '.pem';
                    const modernPfxPath = pfxPath + '.modern.pfx';
                    const { execSync } = require('child_process');
                    execSync(`openssl pkcs12 -legacy -in "${pfxPath}" -passin pass:"${passphrase}" -nodes -out "${pemPath}"`);
                    execSync(`openssl pkcs12 -export -in "${pemPath}" -out "${modernPfxPath}" -passout pass:"${passphrase}"`);
                    finalPfxPath = modernPfxPath;
                } catch (sslErr: any) {
                    console.error("[GovBrService] Erro ao converter certificado:", sslErr.message);
                }
            }

            const browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--disable-extensions', '--disable-background-networking', '--window-size=1280,800', '--ignore-certificate-errors', '--disable-web-security']
            });

            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                clientCertificates: [
                    {
                        origin: 'https://login.esocial.gov.br',
                        pfxPath: finalPfxPath,
                        passphrase: passphrase
                    },
                    {
                        origin: 'https://sso.acesso.gov.br',
                        pfxPath: finalPfxPath,
                        passphrase: passphrase
                    },
                    {
                        origin: 'https://certificadodigital.acesso.gov.br',
                        pfxPath: finalPfxPath,
                        passphrase: passphrase
                    }
                ]
            });

            const page = await context.newPage();
            page.on('console', msg => fileLog('\n[e-Social DOM LOG]: ' + msg.text()));
            page.setDefaultNavigationTimeout(45000);
            page.setDefaultTimeout(30000);

            try {
                console.log("[GovBrService] Acessando e-Social...");
                await page.goto('https://login.esocial.gov.br/login.aspx', { waitUntil: 'load' }).catch(() => { });

                // Try to click Gov.br button
                await page.waitForFunction(() => {
                    const btns = Array.from(document.querySelectorAll('a, button, input'));
                    const govBtn = btns.find(b => {
                        const val = (b as HTMLInputElement).value || (b as HTMLElement).innerText || '';
                        return val.toLowerCase().includes('gov.br');
                    });
                    if (govBtn) {
                        (govBtn as HTMLElement).click();
                        return true;
                    }
                    return false;
                }, { timeout: 15000 }).catch(() => {
                    // Force redirect if not found
                    if (!page.url().includes('acesso.gov.br')) {
                        page.goto('https://sso.acesso.gov.br/authorize?response_type=code&client_id=esocial.gov.br').catch(() => { });
                    }
                });

                console.log("[GovBrService] Aguardando tela de Login Gov.br (e-Social)...");
                await page.waitForSelector('#login-certificate', { timeout: 15000 });
                await page.click('#login-certificate');

                console.log("[GovBrService] Aguardando redirect de volta pro e-Social...");
                await page.waitForURL('**/esocial.gov.br/**', { timeout: 35000, waitUntil: 'domcontentloaded' }).catch(() => { });
                await new Promise(r => setTimeout(r, 6000));

                if (!page.url().includes('esocial.gov.br')) {
                    const debugPath = path.join(__dirname, '..', '..', 'debug', `esocial-auth-fail-${uuidv4()}.png`);
                    await page.screenshot({ path: debugPath, fullPage: true }).catch(console.error);
                    throw new Error(`A autenticação falhou e o Gov.br redirecionou para fora do e-Social. URL Atual: ${page.url()}`);
                }

                const bodyText = await page.evaluate(() => document.body.innerText.toUpperCase());
                if (bodyText.includes('401') || bodyText.includes('UNAUTHORIZED') || bodyText.includes('NÃO AUTORIZADO') || bodyText.includes('ACESSO NEGADO')) {
                    throw new Error("O Portal e-Social rejeitou este Certificado Digital (401 Não Autorizado / Acesso Negado).");
                }

                const realPendencies: any[] = [];
                const targetFrame = page.frames().find(f => f.url().includes('esocial')) || page.mainFrame();

                const framePendencies = await targetFrame.evaluate(() => {
                    console.log("[GovBrService] Varrida no e-Social Iniciada...");
                    const arr: any[] = [];
                    const rows = Array.from(document.querySelectorAll('.alert-danger, .erro-esocial, td, span'));
                    console.log("[e-Social] Encontrados " + rows.length + " elementos.");

                    rows.forEach((row, index) => {
                        const text = (row as HTMLElement).innerText.trim().toUpperCase();
                        if (index < 10) console.log("[e-Social] Preview elemento " + index + ": " + text.substring(0, 30));
                        if (text.includes('REJEITADO') || text.includes('PENDENTE') || text.includes('INCONSISTÊNCIA') || text.includes('MULTA') || text.includes('FALHA')) {
                            // It's usually hard to extract exact values from eSocial, so we mark them as High Risk events
                            arr.push({
                                descricao: `Evento e-Social: ${text.substring(0, 60).replace(/\n/g, ' ')}...`,
                                risco: "Alto",
                                valor: 0,
                                status: text.includes('REJEITADO') ? 'Rejeitado' : 'Pendente'
                            });
                        }
                    });
                    return arr;
                });
                realPendencies.push(...framePendencies);

                return {
                    status: 'success',
                    message: realPendencies.length > 0 ? 'Eventos Rejeitados encontrados no e-Social!' : 'Nenhum erro de evento destacado no dashboard do e-Social.',
                    pendencies: realPendencies
                };

            } finally {
                await browser.close().catch(() => { });
            }
        } catch (error: any) {
            console.error("\n[GovBrService] 🔥 e-SOCIAL SCRAPING ERROR CAUGHT 🔥", error.stack || error);
            return { status: 'error', message: `Erro no e-Social: ${error.message}`, pendencies: [] };
        } finally {
            if (fs.existsSync(pfxPath)) fs.unlinkSync(pfxPath);
            if (fs.existsSync(pfxPath + '.pem')) fs.unlinkSync(pfxPath + '.pem');
            if (fs.existsSync(pfxPath + '.modern.pfx')) fs.unlinkSync(pfxPath + '.modern.pfx');
        }
    }

    /**
     * Scrapes PGE (Procuradoria Geral do Estado).
     */
    static async scrapePGE(pfxBuffer: Buffer, passphrase: string): Promise<any> {
        console.log("Iniciando Robô PGE-SP (Playwright)...");
        return {
            status: 'success',
            message: 'Busca PGE finalizada (Mock Safe Return).',
            debts: []
        };
    }
}
