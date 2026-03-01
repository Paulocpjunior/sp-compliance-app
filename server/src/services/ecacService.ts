import { chromium } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileLog } from '../logger';

export class EcacService {

    static async fetchSituacaoFiscal(pfxBuffer: Buffer, passphrase: string): Promise<any> {
        console.log("Iniciando Robô e-CAC (Playwright)...");

        const sessionId = uuidv4();
        const pfxPath = path.join(os.tmpdir(), `cert-${sessionId}.pfx`);

        try {
            // Write original cert to disk
            fs.writeFileSync(pfxPath, pfxBuffer);

            // MAGIC FIX: Chromium's BoringSSL cannot read legacy RC2 e-CNPJ files.
            // We use the OS's OpenSSL to convert the legacy .pfx into a modern .pfx (AES-256)
            let finalPfxPath = pfxPath;
            try {
                console.log("[EcacService] Convertendo formato do Certificado para AES-256 (BoringSSL)...");
                const pemPath = pfxPath + '.pem';
                const modernPfxPath = pfxPath + '.modern.pfx';
                const { execSync } = require('child_process');

                try {
                    // Tenta usar a flag -legacy (OpenSSL 3.x)
                    execSync(`openssl pkcs12 -legacy -in "${pfxPath}" -passin pass:"${passphrase}" -nodes -out "${pemPath}"`);
                } catch (e) {
                    // Fallback para OpenSSL 1.x
                    execSync(`openssl pkcs12 -in "${pfxPath}" -passin pass:"${passphrase}" -nodes -out "${pemPath}"`);
                }

                // Repackage to AES-256 PFX
                execSync(`openssl pkcs12 -export -in "${pemPath}" -out "${modernPfxPath}" -passout pass:"${passphrase}"`);

                finalPfxPath = modernPfxPath; // Tell Playwright to use the modern one
            } catch (sslErr: any) {
                console.error("[EcacService] Erro ao converter certificado:", sslErr.message);
                // Fallback to original and pray
            }

            const browser = await chromium.launch({
                headless: true,
                args: ['--window-size=1280,800', '--ignore-certificate-errors', '--disable-web-security']
            });

            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                clientCertificates: [
                    {
                        origin: 'https://cav.receita.fazenda.gov.br',
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
            page.on('console', msg => fileLog('\n[e-CAC DOM LOG]: ' + msg.text()));
            page.setDefaultNavigationTimeout(45000);
            page.setDefaultTimeout(30000);

            try {
                // 1. Acesso pela porta da frente
                console.log("[EcacService] Navegando para e-CAC Home...");
                await page.goto('https://cav.receita.fazenda.gov.br/autenticacao/login', { waitUntil: 'networkidle' });

                // 2. Clicar no botão 'Entrar com gov.br'
                console.log("[EcacService] Procurando botão Entrar com gov.br...");
                await page.waitForFunction(() => {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    const govImg = imgs.find(img => img.src.includes('govbr.png') || (img.alt && img.alt.toLowerCase().includes('gov.br')));
                    if (govImg && govImg.closest('a')) {
                        (govImg.closest('a') as HTMLElement).click();
                        return true;
                    }

                    const links = Array.from(document.querySelectorAll('a'));
                    const authLink = links.find(a => a.innerText.toLowerCase().includes('entrar com gov.br') || a.href.includes('govbrsso'));
                    if (authLink) {
                        (authLink as HTMLElement).click();
                        return true;
                    }
                    return false;
                }, { timeout: 15000 });

                console.log("[EcacService] Aguardando tela do Gov.br...");

                // Wait for Gov.br page to load and display the certificate option
                await page.waitForSelector('#login-certificate', { timeout: 15000 });
                await page.click('#login-certificate');
                console.log("[EcacService] Certificado submetido no e-CAC.");

                // Wait until e-CAC home finishes loading after redirect
                console.log("[EcacService] Processando login, aguardando retorno ao portal...");
                await page.waitForURL('**/cav.receita.fazenda.gov.br/**', { timeout: 35000, waitUntil: 'domcontentloaded' }).catch(() => { });
                await new Promise(r => setTimeout(r, 4000));

                if (!page.url().includes('cav.receita.fazenda.gov.br')) {
                    const debugPath = path.join(__dirname, '..', '..', 'debug', `ecac-auth-fail-${uuidv4()}.png`);
                    await page.screenshot({ path: debugPath, fullPage: true }).catch(console.error);
                    throw new Error(`O Portal e-CAC rejeitou este Certificado Digital. Redirecionamento forçado para: ${page.url()}`);
                }

                // 🚨 CRITICAL FIX: Check if e-CAC rejected the handshake
                const bodyText = await page.evaluate(() => document.body.innerText.toUpperCase());
                if (bodyText.includes('401') || bodyText.includes('UNAUTHORIZED') || bodyText.includes('NÃO AUTORIZADO') || bodyText.includes('ACESSO NEGADO')) {
                    throw new Error("O Portal e-CAC rejeitou este Certificado Digital (401 Não Autorizado / Acesso Negado).");
                }

                console.log("[EcacService] Login concluído. Navegando para Consultar de Situação...");

                // HUMAN CLICK SIMULATION 
                try {
                    await page.waitForSelector('#menuLocal', { timeout: 20000 });

                    await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const certBtn = links.find(el => el.innerText.includes('Certidões e Situação Fiscal'));
                        if (certBtn) (certBtn as HTMLElement).click();
                    });

                    await new Promise(r => setTimeout(r, 2000));

                    await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const sitBtn = links.find(el => el.innerText.includes('Consulta Pendências - Situação Fiscal') || el.innerText.includes('Situação Fiscal'));
                        if (sitBtn) (sitBtn as HTMLElement).click();
                    });
                } catch (e) {
                    console.log("[EcacService] Falha na navegação via cliques, tentando link interno.");
                    await page.goto('https://cav.receita.fazenda.gov.br/Servicos/ATSPO/SitFis.app/default.aspx', { waitUntil: 'load', timeout: 35000 }).catch(() => { });
                }

                await new Promise(r => setTimeout(r, 8000)); // wait for full load of iframes

                const debugDir = path.join(__dirname, '..', '..', 'debug');
                if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
                const screenshotPath = path.join(debugDir, `ecac-debug-${uuidv4()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true }).catch(console.error);
                console.log("[EcacService] Screenshot de debug salvo em:", screenshotPath);

                const realPendencies: any[] = [];

                const frm = page.frames().find(f => f.name() === 'frmPrincipal' || f.url().includes('SitFis'));
                const targetFrame = frm || page.mainFrame();

                const framePendencies = await targetFrame.evaluate(() => {
                    console.log("Iniciando varredura de tabelas na página do e-CAC...");
                    const arr: any[] = [];
                    const rows = Array.from(document.querySelectorAll('table tr, .linha-tabela'));
                    console.log("Encontradas " + rows.length + " linhas potenciais de tabela.");

                    rows.forEach((row, index) => {
                        const text = (row as HTMLElement).innerText.trim().toUpperCase();
                        console.log("Linha " + index + " preview: " + text.substring(0, 50));
                        if (text.includes('PIS') || text.includes('COFINS') || text.includes('IPI') || text.includes('IRPJ') || text.includes('MULTA') || text.includes('DÉBITO') || text.includes('SIMPLES NACIONAL')) {
                            const cells = row.querySelectorAll('td');
                            if (cells.length > 1) {
                                const desc = (cells[0] as HTMLElement)?.innerText.trim() || text;
                                const valStr = (cells[cells.length - 1] as HTMLElement)?.innerText.replace(/[^0-9,]/g, '').replace(',', '.') || '0';

                                if (parseFloat(valStr) > 0) {
                                    arr.push({
                                        descricao: `Situação RFB: ${desc.substring(0, 50)}...`,
                                        risco: "Alto",
                                        valor: parseFloat(valStr)
                                    });
                                }
                            } else {
                                arr.push({
                                    descricao: `Aviso RFB: ${text.substring(0, 50)}...`,
                                    risco: "Alto",
                                    valor: 0
                                });
                            }
                        }
                    });
                    return arr;
                });
                realPendencies.push(...framePendencies);

                return {
                    status: 'success',
                    message: realPendencies.length > 0 ? 'Pendências Federais encontradas no e-CAC!' : 'Nenhuma pendência financeira visível no painel principal do e-CAC.',
                    screenshot: screenshotPath,
                    pendencies: realPendencies
                };

            } finally {
                await browser.close().catch(() => { });
            }
        } catch (error: any) {
            console.error("\n[EcacService] 🔥 SCRAPING ERROR CAUGHT 🔥", error.stack || error);
            return { status: 'error', message: `Erro interno no e-CAC: ${error.message}`, pendencies: [] }; // Return the actual thrown error properly
        } finally {
            if (fs.existsSync(pfxPath)) fs.unlinkSync(pfxPath);
            if (fs.existsSync(pfxPath + '.pem')) fs.unlinkSync(pfxPath + '.pem');
            if (fs.existsSync(pfxPath + '.modern.pfx')) fs.unlinkSync(pfxPath + '.modern.pfx');
        }
    }
}
