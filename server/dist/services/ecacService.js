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
exports.EcacService = void 0;
const playwright_1 = require("playwright");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
class EcacService {
    static async fetchSituacaoFiscal(pfxBuffer, passphrase) {
        console.log("Iniciando Robô e-CAC (Playwright)...");
        const sessionId = (0, uuid_1.v4)();
        const pfxPath = path.join(os.tmpdir(), `cert-${sessionId}.pfx`);
        try {
            // Write original cert to disk
            fs.writeFileSync(pfxPath, pfxBuffer);
            // MAGIC FIX: Chromium's BoringSSL cannot read legacy RC2 e-CNPJ files.
            // We use the OS's OpenSSL to convert the legacy .pfx into a modern .pfx (AES-256)
            let finalPfxPath = pfxPath;
            if (process.platform === 'darwin') {
                try {
                    console.log("[EcacService] Convertendo formato legado do Certificado para AES-256 (BoringSSL)...");
                    const pemPath = pfxPath + '.pem';
                    const modernPfxPath = pfxPath + '.modern.pfx';
                    // Extract to PEM using -legacy
                    const { execSync } = require('child_process');
                    execSync(`openssl pkcs12 -legacy -in "${pfxPath}" -passin pass:"${passphrase}" -nodes -out "${pemPath}"`);
                    // Repackage to AES-256 PFX
                    execSync(`openssl pkcs12 -export -in "${pemPath}" -out "${modernPfxPath}" -passout pass:"${passphrase}"`);
                    finalPfxPath = modernPfxPath; // Tell Playwright to use the modern one
                }
                catch (sslErr) {
                    console.error("[EcacService] Erro ao converter certificado:", sslErr.message);
                    // Fallback to original and pray
                }
            }
            const browser = await playwright_1.chromium.launch({
                headless: false, // For visual debugging
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
                    }
                ]
            });
            const page = await context.newPage();
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
                        govImg.closest('a').click();
                        return true;
                    }
                    const links = Array.from(document.querySelectorAll('a'));
                    const authLink = links.find(a => a.innerText.toLowerCase().includes('entrar com gov.br') || a.href.includes('govbrsso'));
                    if (authLink) {
                        authLink.click();
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
                await page.waitForURL('**/cav.receita.fazenda.gov.br/**', { timeout: 35000, waitUntil: 'networkidle' }).catch(() => { });
                await new Promise(r => setTimeout(r, 4000));
                console.log("[EcacService] Login concluído. Navegando para Consultar de Situação...");
                // HUMAN CLICK SIMULATION 
                try {
                    await page.waitForSelector('#menuLocal', { timeout: 20000 });
                    await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const certBtn = links.find(el => el.innerText.includes('Certidões e Situação Fiscal'));
                        if (certBtn)
                            certBtn.click();
                    });
                    await new Promise(r => setTimeout(r, 2000));
                    await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const sitBtn = links.find(el => el.innerText.includes('Consulta Pendências - Situação Fiscal') || el.innerText.includes('Situação Fiscal'));
                        if (sitBtn)
                            sitBtn.click();
                    });
                }
                catch (e) {
                    console.log("[EcacService] Falha na navegação via cliques, tentando link interno.");
                    await page.goto('https://cav.receita.fazenda.gov.br/Servicos/ATSPO/SitFis.app/default.aspx', { waitUntil: 'load', timeout: 35000 }).catch(() => { });
                }
                await new Promise(r => setTimeout(r, 8000)); // wait for full load of iframes
                const debugDir = path.join(__dirname, '..', '..', 'debug');
                if (!fs.existsSync(debugDir))
                    fs.mkdirSync(debugDir);
                const screenshotPath = path.join(debugDir, `ecac-debug-${(0, uuid_1.v4)()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true }).catch(console.error);
                console.log("[EcacService] Screenshot de debug salvo em:", screenshotPath);
                const realPendencies = [];
                const frm = page.frames().find(f => f.name() === 'frmPrincipal' || f.url().includes('SitFis'));
                const targetFrame = frm || page.mainFrame();
                const framePendencies = await targetFrame.evaluate(() => {
                    const arr = [];
                    const rows = Array.from(document.querySelectorAll('table tr, .linha-tabela'));
                    rows.forEach(row => {
                        const text = row.innerText.trim().toUpperCase();
                        if (text.includes('PIS') || text.includes('COFINS') || text.includes('IPI') || text.includes('IRPJ') || text.includes('MULTA') || text.includes('DÉBITO') || text.includes('SIMPLES NACIONAL')) {
                            const cells = row.querySelectorAll('td');
                            if (cells.length > 1) {
                                const desc = cells[0]?.innerText.trim() || text;
                                const valStr = cells[cells.length - 1]?.innerText.replace(/[^0-9,]/g, '').replace(',', '.') || '0';
                                if (parseFloat(valStr) > 0) {
                                    arr.push({
                                        descricao: `Situação RFB: ${desc.substring(0, 50)}...`,
                                        risco: "Alto",
                                        valor: parseFloat(valStr)
                                    });
                                }
                            }
                            else {
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
            }
            finally {
                await browser.close().catch(() => { });
            }
        }
        catch (error) {
            console.error("\n[EcacService] 🔥 SCRAPING ERROR CAUGHT 🔥", error.stack || error);
            return { status: 'error', message: `Erro interno no e-CAC: ${error.message}`, pendencies: [] }; // Return the actual thrown error properly
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
}
exports.EcacService = EcacService;
