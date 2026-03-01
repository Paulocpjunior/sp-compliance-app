import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

export class CNDService {
    // 1. LISTA BRANCA DE SITES CONFIÁVEIS (Anti-Phishing / Anti-Redirecionamento)
    private static TRUSTED_DOMAINS = [
        'cav.receita.fazenda.gov.br',
        'www3.cav.receita.fazenda.gov.br',
        'solucoes.receita.fazenda.gov.br',
        'certidao.receita.fazenda.gov.br'
    ];

    /**
     * Valida se a URL pertence aos órgãos oficiais do governo
     */
    private static isTrustedSite(url: string): boolean {
        try {
            const hostname = new URL(url).hostname;
            return this.TRUSTED_DOMAINS.includes(hostname) || hostname.endsWith('.gov.br');
        } catch {
            return false;
        }
    }

    /**
     * Navega até o portal oficial, emite a CND e retorna o PDF em Base64
     */
    static async emitFederal(pfxBase64: string, password: string): Promise<string | null> {
        const certPath = path.join(process.cwd(), `temp_cert_${Date.now()}.pfx`);
        fs.writeFileSync(certPath, Buffer.from(pfxBase64, 'base64'));

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--ignore-certificate-errors',
                    `--client-certificate-file=${certPath}` // Injeta o certificado mTLS
                ]
            });

            const page = await browser.newPage();

            // 2. INTERCEPTADOR DE SEGURANÇA (Garante navegação apenas em sites confiáveis)
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (!this.isTrustedSite(request.url())) {
                    console.warn(`[ALERTA DE SEGURANÇA] Bloqueando navegação para site não confiável: ${request.url()}`);
                    request.abort();
                } else {
                    request.continue();
                }
            });

            // 3. Navegação Oficial (Bypass do Captcha)
            console.log('Acessando emissor oficial de CNDs da Receita Federal...');
            const emissorUrl = 'https://solucoes.receita.fazenda.gov.br/Servicos/certidao/CndConjuntaInter/InformaNICertidao.asp?Tipo=1';

            await page.goto(emissorUrl, { waitUntil: 'networkidle2' });

            // Clica no botão "Emitir" (O seletor exato depende do HTML da RFB, aqui usamos o padrão)
            const botaoEmitir = await page.$('input[name="Emitir"]');
            if (!botaoEmitir) {
                throw new Error('Botão de emissão não encontrado no site oficial.');
            }

            // 4. Captura do PDF
            // Em vez de baixar para o disco do Cloud Run, lemos a resposta diretamente para a memória
            const [response] = await Promise.all([
                page.waitForResponse(res => res.url().includes('EmiteCertidao') && res.status() === 200),
                botaoEmitir.click()
            ]);

            const buffer = await response.buffer();

            // Verifica se o retorno é realmente um PDF (assinatura '%PDF')
            if (buffer.toString('utf8', 0, 4) !== '%PDF') {
                console.warn('O portal retornou uma página de erro em vez do PDF da certidão.');
                return null;
            }

            // Converte o PDF para Base64 para ser enviado ao Frontend
            const base64Pdf = buffer.toString('base64');
            console.log('CND emitida e capturada com sucesso.');

            return base64Pdf;

        } catch (error: any) {
            console.error('Falha na emissão da CND:', error.message);
            return null;
        } finally {
            if (browser) await browser.close();
            if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
        }
    }
}