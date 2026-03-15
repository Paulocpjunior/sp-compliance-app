import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export class CNDService {
    private static TRUSTED_DOMAINS = [
        'cav.receita.fazenda.gov.br',
        'www3.cav.receita.fazenda.gov.br',
        'solucoes.receita.fazenda.gov.br',
        'certidao.receita.fazenda.gov.br'
    ];

    private static isTrustedSite(url: string): boolean {
        try {
            const hostname = new URL(url).hostname;
            return this.TRUSTED_DOMAINS.includes(hostname) || hostname.endsWith('.gov.br');
        } catch {
            return false;
        }
    }

    static async emitFederal(pfxBase64: string, password: string): Promise<string | null> {
        const sessionId = uuidv4();
        const certPath = path.join(os.tmpdir(), `cert-cnd-${sessionId}.pfx`);
        fs.writeFileSync(certPath, Buffer.from(pfxBase64, 'base64'));

        let finalPfxPath = certPath;
        try {
            const pemPath = certPath + '.pem';
            const modernPfxPath = certPath + '.modern.pfx';
            const { execSync } = require('child_process');
            try {
                execSync(`openssl pkcs12 -legacy -in "${certPath}" -passin pass:"${password}" -nodes -out "${pemPath}"`, { timeout: 10000 });
            } catch {
                execSync(`openssl pkcs12 -in "${certPath}" -passin pass:"${password}" -nodes -out "${pemPath}"`, { timeout: 10000 });
            }
            execSync(`openssl pkcs12 -export -in "${pemPath}" -out "${modernPfxPath}" -passout pass:"${password}"`, { timeout: 10000 });
            if (fs.existsSync(modernPfxPath) && fs.statSync(modernPfxPath).size > 0) {
                finalPfxPath = modernPfxPath;
            }
            if (fs.existsSync(pemPath)) fs.unlinkSync(pemPath);
        } catch {
            console.warn('[CNDService] Aviso: Conversao do certificado falhou, usando original.');
        }

        let browser: any = null;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--ignore-certificate-errors',
                ]
            });

            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                clientCertificates: [
                    {
                        origin: 'https://solucoes.receita.fazenda.gov.br',
                        pfxPath: finalPfxPath,
                        passphrase: password,
                    },
                    {
                        origin: 'https://certidao.receita.fazenda.gov.br',
                        pfxPath: finalPfxPath,
                        passphrase: password,
                    },
                ]
            });

            const page = await context.newPage();
            page.setDefaultTimeout(30000);
            page.setDefaultNavigationTimeout(30000);

            // Block untrusted domains
            await page.route('**/*', (route: any) => {
                const url = route.request().url();
                if (!this.isTrustedSite(url)) {
                    console.warn(`[CNDService] Bloqueando navegacao para site nao confiavel: ${url}`);
                    route.abort();
                } else {
                    route.continue();
                }
            });

            console.log('[CNDService] Acessando emissor oficial de CNDs da Receita Federal...');
            const emissorUrl = 'https://solucoes.receita.fazenda.gov.br/Servicos/certidao/CndConjuntaInter/InformaNICertidao.asp?Tipo=1';
            await page.goto(emissorUrl, { waitUntil: 'domcontentloaded' });

            const botaoEmitir = await page.$('input[name="Emitir"]');
            if (!botaoEmitir) {
                throw new Error('Botao de emissao nao encontrado no site oficial.');
            }

            const [response] = await Promise.all([
                page.waitForResponse((res: any) => res.url().includes('EmiteCertidao') && res.status() === 200),
                botaoEmitir.click()
            ]);

            const buffer = await response.body();
            if (buffer.toString('utf8', 0, 4) !== '%PDF') {
                console.warn('[CNDService] O portal retornou uma pagina de erro em vez do PDF da certidao.');
                return null;
            }

            const base64Pdf = buffer.toString('base64');
            console.log('[CNDService] CND emitida e capturada com sucesso.');
            return base64Pdf;

        } catch (error: any) {
            console.error('[CNDService] Falha na emissao da CND:', error.message);
            return null;
        } finally {
            if (browser) await browser.close().catch(() => { });
            try { if (fs.existsSync(certPath)) fs.unlinkSync(certPath); } catch { }
            try { if (fs.existsSync(certPath + '.pem')) fs.unlinkSync(certPath + '.pem'); } catch { }
            try { if (fs.existsSync(certPath + '.modern.pfx')) fs.unlinkSync(certPath + '.modern.pfx'); } catch { }
        }
    }
}
