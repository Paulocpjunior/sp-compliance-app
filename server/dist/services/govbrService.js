"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GovBrService = void 0;
const playwright_1 = require("playwright");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
class GovBrService {
    /**
     * Automates Gov.br login and scrapes PGFN.
     */
    static async scrapePGFN(pfxBuffer, passphrase) {
        console.log("Iniciando Robô PGFN (Playwright)...");
        const sessionId = (0, uuid_1.v4)();
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
                }
                catch (sslErr) {
                    console.error("[GovBrService] Erro ao converter certificado:", sslErr.message);
                }
            }
            const browser = await playwright_1.chromium.launch({
                headless: false, // For testing visually
                args: ['--window-size=1280,800', '--ignore-certificate-errors', '--disable-web-security']
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
                    }
                ]
            });
            const page = await context.newPage();
            page.setDefaultNavigationTimeout(45000);
            page.setDefaultTimeout(30000);
            try {
                // 1. Emulate User Navigation Starting at PGFN Portal main entry
                console.log("[GovBrService] Acessando porta da frente do PGFN...");
                await page.goto('https://www.regularize.pgfn.gov.br', { waitUntil: 'networkidle' }).catch(() => { });
                // 2. Click Gov.br Login Button visually
                await page.waitForFunction(() => {
                    const links = Array.from(document.querySelectorAll('a, button'));
                    const authBtn = links.find(el => el.innerText.toLowerCase().includes('entrar com gov.br') || el.href.includes('gov.br'));
                    if (authBtn) {
                        authBtn.click();
                        return true;
                    }
                    // Secondary logic if button image is used
                    const imgs = Array.from(document.querySelectorAll('img'));
                    const govImg = imgs.find(img => img.src.includes('govbr') || (img.alt && img.alt.toLowerCase().includes('gov.br')));
                    if (govImg && govImg.closest('a')) {
                        govImg.closest('a').click();
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
                // Note: networkidle might time out if page keeps polling, using 'load' as fallback
                await page.waitForURL('**/regularize.pgfn.gov.br/**', { timeout: 35000, waitUntil: 'load' }).catch(() => { });
                await new Promise(r => setTimeout(r, 4000)); // wait for full load and animations
                console.log("[GovBrService] Buscando aba 'Consultar Dívida'...");
                // Visual navigation inside PGFN
                try {
                    await page.evaluate(() => {
                        const cards = Array.from(document.querySelectorAll('a, div, span'));
                        const consultCard = cards.find(el => el.innerText.includes('Consultar Dívida') || el.innerText.includes('Consulta de Débitos'));
                        if (consultCard)
                            consultCard.click();
                    });
                }
                catch (e) {
                    console.log("[GovBrService] Card 'Consultar Dívida' não clicável. Indo via URL direta...");
                    // Try to navigate directly to debts if button not found or clicked
                    await page.goto('https://www.regularize.pgfn.gov.br/consultar-divida', { waitUntil: 'load' }).catch(() => { });
                }
                await new Promise(r => setTimeout(r, 5000));
                const debugDir = path.join(__dirname, '..', '..', 'debug');
                if (!fs.existsSync(debugDir))
                    fs.mkdirSync(debugDir);
                const screenshotPath = path.join(debugDir, `pgfn-debug-${(0, uuid_1.v4)()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true }).catch(console.error);
                console.log("[GovBrService] Screenshot de debug salvo em:", screenshotPath);
                const realDebts = [];
                // Look into IFrames if any
                const targetFrame = page.frames().find(f => f.url().includes('consultar')) || page.mainFrame();
                const frameDebts = await targetFrame.evaluate(() => {
                    const arr = [];
                    // Very generic selector to catch standard data tables in gov portals
                    const rows = Array.from(document.querySelectorAll('table tr, .card-divida, .linha-debito'));
                    rows.forEach(row => {
                        const text = row.innerText.trim().toUpperCase();
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
            }
            finally {
                await browser.close().catch(() => { });
            }
        }
        catch (error) {
            console.error("\n[GovBrService] 🔥 PGFN SCRAPING ERROR CAUGHT 🔥", error.stack || error);
            return { status: 'error', message: `Erro no PGFN: ${error.message}`, debts: [] };
        }
        finally {
            if (fs.existsSync(pfxPath))
                fs.unlinkSync(pfxPath);
            if (fs.existsSync(pfxPath + '.pem'))
                fs.unlinkSync(pfxPath + '.pem');
            if (fs.existsSync(pfxPath + '.modern.pfx'))
                fs.unlinkSync(pfxPath + '.modern.pfx');
        }
    }
    /**
     * Scrapes e-Social portal for pending obligations or errors.
     */
    static async scrapeESocial(pfxBuffer, passphrase) {
        console.log("Iniciando Robô e-Social (Playwright)...");
        const sessionId = (0, uuid_1.v4)();
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
                }
                catch (sslErr) {
                    console.error("[GovBrService] Erro ao converter certificado:", sslErr.message);
                }
            }
            const browser = await playwright_1.chromium.launch({
                headless: false,
                args: ['--window-size=1280,800', '--ignore-certificate-errors', '--disable-web-security']
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
                    }
                ]
            });
            const page = await context.newPage();
            page.setDefaultNavigationTimeout(45000);
            page.setDefaultTimeout(30000);
            try {
                console.log("[GovBrService] Acessando e-Social...");
                await page.goto('https://login.esocial.gov.br/login.aspx', { waitUntil: 'load' }).catch(() => { });
                // Try to click Gov.br button
                await page.waitForFunction(() => {
                    const btns = Array.from(document.querySelectorAll('a, button, input'));
                    const govBtn = btns.find(b => {
                        const val = b.value || b.innerText || '';
                        return val.toLowerCase().includes('gov.br');
                    });
                    if (govBtn) {
                        govBtn.click();
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
                console.log("[GovBrService] Extraindo inconsistências no e-Social...");
                await page.waitForURL('**/esocial.gov.br/**', { timeout: 35000, waitUntil: 'load' }).catch(() => { });
                await new Promise(r => setTimeout(r, 6000));
                const realPendencies = [];
                const targetFrame = page.frames().find(f => f.url().includes('esocial')) || page.mainFrame();
                const framePendencies = await targetFrame.evaluate(() => {
                    const arr = [];
                    // Look for common error patterns on the dashboard
                    const rows = Array.from(document.querySelectorAll('.alert-danger, .erro-esocial, td, span'));
                    rows.forEach(row => {
                        const text = row.innerText.trim().toUpperCase();
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
            }
            finally {
                await browser.close().catch(() => { });
            }
        }
        catch (error) {
            console.error("\n[GovBrService] 🔥 e-SOCIAL SCRAPING ERROR CAUGHT 🔥", error.stack || error);
            return { status: 'error', message: `Erro no e-Social: ${error.message}`, pendencies: [] };
        }
        finally {
            if (fs.existsSync(pfxPath))
                fs.unlinkSync(pfxPath);
            if (fs.existsSync(pfxPath + '.pem'))
                fs.unlinkSync(pfxPath + '.pem');
            if (fs.existsSync(pfxPath + '.modern.pfx'))
                fs.unlinkSync(pfxPath + '.modern.pfx');
        }
    }
    /**
     * Scrapes PGE (Procuradoria Geral do Estado).
     */
    static async scrapePGE(pfxBuffer, passphrase) {
        console.log("Iniciando Robô PGE-SP (Playwright)...");
        return {
            status: 'success',
            message: 'Busca PGE finalizada (Mock Safe Return).',
            debts: []
        };
    }
}
exports.GovBrService = GovBrService;
