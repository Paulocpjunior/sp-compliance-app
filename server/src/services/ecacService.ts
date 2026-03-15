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
        let browser: any = null;

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
                    '--window-size=1280,800',
                    '--ignore-certificate-errors',
                    '--disable-web-security'
                ]
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
            page.on('console', (msg: any) => fileLog('\n[e-CAC DOM LOG]: ' + msg.text()));
            page.setDefaultNavigationTimeout(90000);
            page.setDefaultTimeout(60000);

            try {
                // 1. Acesso pela porta da frente
                // 1. Acesso direto (Bypass) ao Gateway SSO do Gov.Br
                console.log("[EcacService] Iniciando fluxo direto de Autenticação OAuth2 Gov.Br...");
                await page.goto('https://sso.acesso.gov.br/authorize?response_type=code&client_id=cav.receita.fazenda.gov.br&scope=openid+govbr_confiabilidades&redirect_uri=https://cav.receita.fazenda.gov.br/autenticacao/login/LogarGovBr&state=Y2F2', { waitUntil: 'domcontentloaded' });

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

                // Search ALL frames for data (e-CAC uses nested iframes heavily)
                const allFrames = page.frames();
                console.log(`[EcacService] Total de frames encontrados: ${allFrames.length}`);

                for (const frame of allFrames) {
                    try {
                        const frameUrl = frame.url();
                        console.log(`[EcacService] Analisando frame: ${frameUrl.substring(0, 80)}`);

                        const framePendencies = await frame.evaluate(() => {
                            const arr: any[] = [];
                            const fullText = document.body?.innerText?.toUpperCase() || '';

                            // =============================================
                            // 1. DEBITOS E PARCELAMENTOS (tabelas)
                            // =============================================
                            const debtKeywords = [
                                'PIS', 'COFINS', 'IPI', 'IRPJ', 'IRPF', 'CSLL', 'MULTA',
                                'INSS', 'DÉBITO', 'DEBITO', 'SIMPLES NACIONAL', 'PARCELAMENTO',
                                'CONTRIBUIÇÃO', 'CONTRIBUICAO', 'AUTO DE INFRAÇÃO', 'AUTO DE INFRACAO',
                                'LANÇAMENTO', 'LANCAMENTO', 'DARF', 'GPS', 'CPSS', 'FUNRURAL',
                                'IOF', 'ITR', 'CIDE', 'RAT', 'GILRAT', 'FGTS', 'SALDO DEVEDOR',
                                'INSCRIÇÃO', 'INSCRICAO', 'COBRANÇA', 'COBRANCA'
                            ];
                            const headerKeywords = ['SITUAÇÃO FISCAL', 'SITUACAO FISCAL', 'TRIBUTO', 'DESCRIÇÃO', 'DESCRICAO'];

                            const rows = Array.from(document.querySelectorAll('table tr, .linha-tabela, tr[class*="linha"]'));

                            rows.forEach((row) => {
                                const text = (row as HTMLElement).innerText.trim().toUpperCase();
                                const isHeader = headerKeywords.some(h => text.startsWith(h));
                                if (isHeader || text.length < 5) return;

                                const hasDebt = debtKeywords.some(kw => text.includes(kw));
                                if (!hasDebt) return;

                                const cells = row.querySelectorAll('td');
                                const desc = cells.length > 1
                                    ? (cells[0] as HTMLElement)?.innerText.trim()
                                    : text;

                                // Extract monetary value (R$ X.XXX,XX or just numbers with comma)
                                const monetaryMatch = text.match(/R\$\s*([\d.,]+)/);
                                let valor = 0;
                                if (monetaryMatch) {
                                    valor = parseFloat(monetaryMatch[1].replace(/\./g, '').replace(',', '.'));
                                } else if (cells.length > 1) {
                                    const lastCell = (cells[cells.length - 1] as HTMLElement)?.innerText || '';
                                    const numMatch = lastCell.match(/([\d.,]+)/);
                                    if (numMatch) {
                                        valor = parseFloat(numMatch[1].replace(/\./g, '').replace(',', '.'));
                                    }
                                }

                                const tipo = text.includes('PARCELAMENTO') ? 'PARCELAMENTO'
                                    : text.includes('AUTO DE INFRA') ? 'AUTO_INFRACAO'
                                    : text.includes('MULTA') ? 'MULTA'
                                    : 'DEBITO_FISCAL';

                                arr.push({
                                    tipo,
                                    descricao: `Débito RFB: ${desc.substring(0, 100)}`,
                                    risco: "Alto",
                                    valor: isNaN(valor) ? 0 : valor
                                });
                            });

                            // =============================================
                            // 2. DECLARACOES / OBRIGACOES ACESSORIAS AUSENTES
                            // =============================================
                            const obligationPatterns = [
                                { name: 'DCTF', keywords: ['DCTF', 'DCTFWEB', 'DCTF WEB'] },
                                { name: 'ECD', keywords: ['ECD', 'ESCRITURAÇÃO CONTÁBIL DIGITAL', 'ESCRITURACAO CONTABIL DIGITAL'] },
                                { name: 'ECF', keywords: ['ECF', 'ESCRITURAÇÃO CONTÁBIL FISCAL', 'ESCRITURACAO CONTABIL FISCAL'] },
                                { name: 'EFD_CONTRIBUICOES', keywords: ['EFD-CONTRIBUIÇÕES', 'EFD-CONTRIBUICOES', 'EFD CONTRIBUIÇÕES', 'EFD CONTRIBUICOES'] },
                                { name: 'EFD_ICMS_IPI', keywords: ['EFD-ICMS', 'EFD ICMS/IPI', 'SPED FISCAL', 'EFD-ICMS/IPI'] },
                                { name: 'EFD_REINF', keywords: ['EFD-REINF', 'EFD REINF', 'REINF'] },
                                { name: 'DIRF', keywords: ['DIRF'] },
                                { name: 'PGDAS', keywords: ['PGDAS', 'PGDAS-D'] },
                                { name: 'DEFIS', keywords: ['DEFIS'] },
                                { name: 'RAIS', keywords: ['RAIS'] },
                                { name: 'GFIP', keywords: ['GFIP', 'SEFIP'] },
                            ];

                            const missingIndicators = [
                                'NÃO ENTREGUE', 'NAO ENTREGUE', 'PENDENTE', 'AUSÊNCIA', 'AUSENCIA',
                                'OMISSA', 'OMISSÃO', 'OMISSAO', 'NÃO TRANSMITIDA', 'NAO TRANSMITIDA',
                                'EM ATRASO', 'FALTA ENTREGA', 'NÃO APRESENTADA', 'NAO APRESENTADA',
                                'INADIMPLENTE', 'SEM ENTREGA', 'FALTA DE ENTREGA'
                            ];

                            // Search in table rows for declarations
                            const allElements = Array.from(document.querySelectorAll('table tr, td, span, div, li, p'));
                            const seen = new Set<string>();

                            allElements.forEach((el) => {
                                const text = (el as HTMLElement).innerText?.trim().toUpperCase() || '';
                                if (text.length < 3 || text.length > 500) return;

                                for (const pattern of obligationPatterns) {
                                    if (seen.has(pattern.name)) continue;
                                    const hasObligation = pattern.keywords.some(kw => text.includes(kw));
                                    if (!hasObligation) continue;

                                    const isMissing = missingIndicators.some(ind => text.includes(ind));
                                    if (isMissing) {
                                        seen.add(pattern.name);
                                        arr.push({
                                            tipo: 'DECLARACAO_AUSENTE',
                                            descricao: `Obrigação ${pattern.name} não entregue ou pendente: ${text.substring(0, 120)}`,
                                            risco: "Alto",
                                            valor: 0
                                        });
                                    }
                                }
                            });

                            // =============================================
                            // 3. FULL TEXT ANALYSIS (fallback for non-tabular data)
                            // =============================================
                            // Check for broad indicators of irregular status
                            const irregularIndicators = [
                                'IRREGULAR', 'POSSUI PENDÊNCIAS', 'POSSUI PENDENCIAS',
                                'TEM PENDÊNCIAS', 'TEM PENDENCIAS', 'NÃO REGULAR',
                                'NAO REGULAR', 'SITUAÇÃO IRREGULAR', 'SITUACAO IRREGULAR',
                                'PENDÊNCIA FISCAL', 'PENDENCIA FISCAL'
                            ];

                            if (arr.length === 0 && irregularIndicators.some(ind => fullText.includes(ind))) {
                                // Try to extract what type of irregularity
                                for (const pattern of obligationPatterns) {
                                    if (seen.has(pattern.name)) continue;
                                    if (pattern.keywords.some(kw => fullText.includes(kw))) {
                                        seen.add(pattern.name);
                                        arr.push({
                                            tipo: 'VERIFICACAO_MANUAL',
                                            descricao: `Possível pendência em ${pattern.name} - verifique manualmente no portal e-CAC.`,
                                            risco: "Médio",
                                            valor: 0
                                        });
                                    }
                                }

                                // Generic fallback if nothing specific found
                                if (arr.length === 0) {
                                    arr.push({
                                        tipo: 'VERIFICACAO_MANUAL',
                                        descricao: 'Contribuinte possui pendências na Receita Federal, mas os detalhes não puderam ser extraídos automaticamente. Acesse o e-CAC.',
                                        risco: "Alto",
                                        valor: 0
                                    });
                                }
                            }

                            return arr;
                        }).catch(() => [] as any[]);

                        realPendencies.push(...framePendencies);
                    } catch (frameErr) {
                        // Some frames may be cross-origin or detached, skip them
                        continue;
                    }
                }

                // Deduplicate by description
                const uniquePendencies = realPendencies.filter((p, i, self) =>
                    i === self.findIndex(q => q.descricao === p.descricao)
                );

                console.log(`[EcacService] Total de pendências encontradas: ${uniquePendencies.length}`);

                // Log full page text for debugging when 0 results found
                if (uniquePendencies.length === 0) {
                    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
                    console.log("[EcacService] AVISO: Nenhuma pendência encontrada. Texto da página:", pageText);
                }

                return {
                    status: 'success',
                    message: uniquePendencies.length > 0 ? 'Pendências Federais encontradas no e-CAC!' : 'Nenhuma pendência financeira visível no painel principal do e-CAC.',
                    screenshot: screenshotPath,
                    pendencies: uniquePendencies
                };

            } finally {
                if (browser) await browser.close().catch(() => { });
                browser = null;
            }
        } catch (error: any) {
            console.error("\n[EcacService] SCRAPING ERROR CAUGHT", error.stack || error);
            throw new Error(`Erro na extração do e-CAC: ${error.message}`);
        } finally {
            // Safety net: close browser if inner finally didn't run
            if (browser) await browser.close().catch(() => { });
            try { if (fs.existsSync(pfxPath)) fs.unlinkSync(pfxPath); } catch { /* ignore */ }
            try { if (fs.existsSync(pfxPath + '.pem')) fs.unlinkSync(pfxPath + '.pem'); } catch { /* ignore */ }
            try { if (fs.existsSync(pfxPath + '.modern.pfx')) fs.unlinkSync(pfxPath + '.modern.pfx'); } catch { /* ignore */ }
        }
    }
}
