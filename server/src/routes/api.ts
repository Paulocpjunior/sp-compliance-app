import { Router } from 'express';
import multer from 'multer';
import { EcacService } from '../services/ecacService';
import { GovBrService } from '../services/govbrService';
import { TaxParser } from '../TaxParser';
import { CNDService } from '../services/CNDService';
import { scanRFB } from '../services/rfbScanner';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { EmailService } from '../services/EmailService';
import { MunicipalService } from '../services/municipalService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/audit/ecac', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await EcacService.fetchSituacaoFiscal(req.file.buffer, req.body.password);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post('/audit/pgfn', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await GovBrService.scrapePGFN(req.file.buffer, req.body.password);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post('/audit/pge', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await GovBrService.scrapePGE(req.file.buffer, req.body.password);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post('/audit/esocial', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await GovBrService.scrapeESocial(req.file.buffer, req.body.password);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get('/status', (req, res) => {
    res.json({ message: 'API is working' });
});

// Diagnostic endpoint - tests Chromium launch and OpenSSL (GET = browser test, POST = with file upload)
router.get('/diagnostic', async (req, res) => {
    const checks: Record<string, string> = {};

    // 1. Check Chromium launch
    try {
        const { chromium } = require('playwright');
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        const version = browser.version();
        await browser.close();
        checks['chromium'] = `OK (v${version})`;
    } catch (e: any) {
        checks['chromium'] = `FALHOU - ${e.message}`;
    }

    // 2. Check OpenSSL
    try {
        const { execSync } = require('child_process');
        const ver = execSync('openssl version').toString().trim();
        checks['openssl'] = `OK (${ver})`;
    } catch (e: any) {
        checks['openssl'] = `FALHOU - ${e.message}`;
    }

    // 3. Check memory
    const mem = process.memoryUsage();
    checks['memory_heap_mb'] = (mem.heapUsed / 1024 / 1024).toFixed(1);
    checks['memory_rss_mb'] = (mem.rss / 1024 / 1024).toFixed(1);

    return res.json({ diagnostic: checks });
});

router.post('/diagnostic', upload.single('certificate'), async (req, res) => {
    const checks: Record<string, string> = {};
    checks['upload'] = req.file ? `OK (${req.file.size} bytes)` : 'FALHOU - nenhum arquivo recebido';
    checks['password'] = req.body.password ? 'OK' : 'FALHOU - senha não recebida';

    try {
        const { chromium } = require('playwright');
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        const version = browser.version();
        await browser.close();
        checks['chromium'] = `OK (v${version})`;
    } catch (e: any) {
        checks['chromium'] = `FALHOU - ${e.message}`;
    }

    try {
        const { execSync } = require('child_process');
        const ver = execSync('openssl version').toString().trim();
        checks['openssl'] = `OK (${ver})`;
    } catch (e: any) {
        checks['openssl'] = `FALHOU - ${e.message}`;
    }

    return res.json({ diagnostic: checks });
});

// Endpoint individual para varredura municipal
router.post('/audit/municipal', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const pfxBase64 = req.file.buffer.toString('base64');
        const result = await MunicipalService.scanMunicipal(pfxBase64, req.body.password, req.body.cnpj);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post('/v1/auditoria-completa', upload.single('certificate'), async (req, res) => {
    // SSE headers to keep connection alive during long processing
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    try {
        if (!req.file || !req.body.password) {
            sendEvent('error', { error: 'Certificado e senha são obrigatórios.' });
            res.end();
            clearInterval(heartbeat);
            return;
        }

        const pfxBuffer = req.file.buffer;
        const pfxBase64 = pfxBuffer.toString('base64');
        const password = req.body.password;
        const cnpj = req.body.cnpj || 'Não Informado';

        sendEvent('progress', { step: 0, label: 'Validando certificado...' });

        let ecacResult: any = null;
        let pendenciasFederais: any[] = [];
        let pendenciasPGFN: any[] = [];
        let pendenciasESocial: any[] = [];
        let pendenciasMunicipais: any[] = [];
        let federalError = false;
        let certidaoMunicipal = null;

        const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
            Promise.race([
                promise,
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label}: tempo limite excedido (${ms/1000}s)`)), ms))
            ]);

        // ======================================================
        // PHASE 1: e-CAC + PGFN in parallel (2 browsers, ~1GB RAM)
        // ======================================================
        sendEvent('progress', { step: 1, label: 'Varrendo e-CAC e PGFN (Receita Federal)...' });

        const ecacPromise = withTimeout(scanRFB(pfxBase64, password), 180000, 'e-CAC')
            .then((result) => {
                ecacResult = result;
                pendenciasFederais = TaxParser.parseEcacDashboard(ecacResult);
                console.log(`[Audit] e-CAC: ${pendenciasFederais.length} pendências encontradas`);
                sendEvent('progress', { step: 2, label: `e-CAC: ${pendenciasFederais.length} pendência(s) encontrada(s).` });
            })
            .catch((err: any) => {
                console.error("Erro na varredura e-CAC:", err.message);
                federalError = true;
                pendenciasFederais = [{
                    orgao: 'Receita Federal / e-CAC',
                    tipo: 'VERIFICACAO_MANUAL',
                    descricao: `Comunicação com e-CAC indisponível: ${err.message || 'Erro desconhecido'}. Verificar manualmente.`,
                    riskLevel: 'High',
                }];
                sendEvent('progress', { step: 2, label: 'e-CAC: falha parcial.' });
            });

        const pgfnPromise = withTimeout(GovBrService.scrapePGFN(pfxBuffer, password), 120000, 'PGFN')
            .then((result) => {
                pendenciasPGFN = TaxParser.parsePGFNDebts(result);
                console.log(`[Audit] PGFN: ${pendenciasPGFN.length} dívidas encontradas`);
                sendEvent('progress', { step: 3, label: `PGFN: ${pendenciasPGFN.length} dívida(s) ativa(s).` });
            })
            .catch((err: any) => {
                console.error("Erro na varredura PGFN:", err.message);
                pendenciasPGFN = [{
                    orgao: 'PGFN - Dívida Ativa da União',
                    tipo: 'VERIFICACAO_MANUAL',
                    descricao: `Comunicação com PGFN indisponível: ${err.message || 'Erro desconhecido'}. Verificar manualmente.`,
                    riskLevel: 'High',
                }];
                sendEvent('progress', { step: 3, label: 'PGFN: falha parcial.' });
            });

        await Promise.all([ecacPromise, pgfnPromise]);

        // ======================================================
        // PHASE 2: e-Social + Municipal in parallel (2 browsers, ~1GB RAM)
        // ======================================================
        sendEvent('progress', { step: 4, label: 'Varrendo e-Social e Prefeitura Municipal...' });

        const esocialPromise = withTimeout(GovBrService.scrapeESocial(pfxBuffer, password), 120000, 'e-Social')
            .then((result) => {
                pendenciasESocial = TaxParser.parseESocialPendencies(result);
                console.log(`[Audit] e-Social: ${pendenciasESocial.length} pendências encontradas`);
                sendEvent('progress', { step: 5, label: `e-Social: ${pendenciasESocial.length} pendência(s).` });
            })
            .catch((err: any) => {
                console.error("Erro na varredura e-Social:", err.message);
                pendenciasESocial = [{
                    orgao: 'e-Social',
                    tipo: 'VERIFICACAO_MANUAL',
                    descricao: `Comunicação com e-Social indisponível: ${err.message || 'Erro desconhecido'}. Verificar manualmente.`,
                    riskLevel: 'Medium',
                }];
                sendEvent('progress', { step: 5, label: 'e-Social: falha parcial.' });
            });

        const municipalPromise = withTimeout(MunicipalService.scanMunicipal(pfxBase64, password, cnpj), 120000, 'Municipal')
            .then((municipalResult) => {
                pendenciasMunicipais = municipalResult.pendencias || [];
                if (municipalResult.certidao) {
                    certidaoMunicipal = municipalResult.certidao;
                }
                console.log(`[Audit] Municipal: ${pendenciasMunicipais.length} pendências encontradas`);
                sendEvent('progress', { step: 6, label: `Municipal: ${pendenciasMunicipais.length} pendência(s).` });
            })
            .catch((err: any) => {
                console.error("Erro na varredura municipal:", err.message);
                pendenciasMunicipais = [{
                    orgao: 'Prefeitura Municipal',
                    tipo: 'VERIFICACAO_MANUAL',
                    descricao: 'Varredura municipal indisponivel no momento. Verificar manualmente.',
                    riskLevel: 'Medium',
                }];
                sendEvent('progress', { step: 6, label: 'Municipal: falha parcial.' });
            });

        await Promise.all([esocialPromise, municipalPromise]);

        // ======================================================
        // CONSOLIDATION
        // ======================================================
        const pendencias = [
            ...pendenciasFederais,
            ...pendenciasPGFN,
            ...pendenciasESocial,
            ...pendenciasMunicipais,
        ];

        let certidoes: any[] = [];

        sendEvent('progress', { step: 7, label: 'Verificando certidões (CNDs)...' });

        // Only try CND emission if federal is clean
        const allFederalClean = !federalError && pendenciasFederais.length === 0 && pendenciasPGFN.length === 0;
        if (allFederalClean) {
            console.log(`CNPJ ${cnpj} limpo no federal. Tentando emitir CND Federal...`);
            try {
                const cndFederal = await withTimeout(CNDService.emitFederal(pfxBase64, password), 60000, 'CND Federal');
                if (cndFederal) {
                    certidoes.push({
                        orgao: 'Receita Federal / PGFN',
                        nome: 'Certidão Negativa de Débitos Relativos aos Tributos Federais',
                        status: 'EMITIDA',
                        arquivoBase64: cndFederal
                    });
                }
            } catch (cndErr: any) {
                console.error("Erro ao emitir CND Federal:", cndErr.message);
            }
        }

        if (certidaoMunicipal) {
            certidoes.push(certidaoMunicipal);
        }

        // Report CND status for each organ
        if (pendenciasFederais.length > 0 || pendenciasPGFN.length > 0) {
            certidoes.push({
                orgao: 'Receita Federal / PGFN',
                nome: 'Certidão Negativa de Débitos Federais',
                status: 'NAO EMITIDA - Pendências detectadas',
            });
        }
        if (pendenciasESocial.length > 0) {
            certidoes.push({
                orgao: 'e-Social / MTE',
                nome: 'Certidão de Regularidade Trabalhista',
                status: 'NAO EMITIDA - Pendências detectadas',
            });
        }
        if (pendenciasMunicipais.length > 0 && !certidaoMunicipal) {
            certidoes.push({
                orgao: 'Prefeitura Municipal',
                nome: 'Certidão Negativa de Débitos Municipais',
                status: 'NAO EMITIDA - Pendências detectadas',
            });
        }

        sendEvent('progress', { step: 8, label: 'Calculando nível de risco...' });

        const statusCliente = pendencias.length === 0 ? 'REGULAR' : 'IRREGULAR';
        const orgaos = [...new Set(pendencias.map((p: any) => p.orgao))].join(', ');
        const razaoSocial = ecacResult?.razaoSocial || `Empresa ${cnpj}`;

        // Async integrations (Sheets + Email) - don't block the response
        GoogleSheetsService.logAuditResult({
            cnpj: cnpj,
            razaoSocial: razaoSocial,
            status: statusCliente,
            totalPendencias: pendencias.length,
            orgaosComProblema: orgaos,
            linkCndGerada: ''
        }).catch((err: any) => console.error("Sheets Async Error: ", err));

        if (pendencias.length > 0) {
            EmailService.sendCriticalAlert(cnpj, razaoSocial, pendencias)
               .catch((err: any) => console.error("Email Async Error: ", err));
        }

        // Final result with debug info
        sendEvent('result', {
            status: 'success',
            clienteRegular: pendencias.length === 0,
            pendencias: pendencias,
            certidoes: certidoes,
            debugInfo: {
                ecac: ecacResult?.debugInfo || null,
                totalScans: 4,
                scanResults: {
                    ecac: pendenciasFederais.length,
                    pgfn: pendenciasPGFN.length,
                    esocial: pendenciasESocial.length,
                    municipal: pendenciasMunicipais.length,
                },
            },
        });

    } catch (error: any) {
        console.error("Erro na auditoria-completa:", error);
        sendEvent('error', { error: 'Falha na comunicação com os órgãos governamentais.', details: error.message });
    } finally {
        clearInterval(heartbeat);
        res.end();
    }
});

// ======================================================
// XML CAPTURE ENDPOINTS
// ======================================================

/**
 * POST /v1/xml-capture
 * Captura XMLs de NF-e/NFC-e via SEFAZ usando certificado digital
 */
router.post('/v1/xml-capture', upload.single('certificate'), async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    try {
        const { cnpj, inscricaoEstadual, uf, tipoNota, dataInicio, dataFim, password } = req.body;
        const armazenamento = req.body.armazenamento ? JSON.parse(req.body.armazenamento) : {};
        const alertas = req.body.alertas ? JSON.parse(req.body.alertas) : {};

        if (!cnpj || !dataInicio || !dataFim) {
            sendEvent('error', { error: 'CNPJ, data de inicio e data de fim sao obrigatorios.' });
            res.end();
            clearInterval(heartbeat);
            return;
        }

        sendEvent('progress', { step: 0, message: 'Validando certificado digital...' });

        // Step 1: Validate certificate
        const pfxBuffer = req.file?.buffer;
        const pfxBase64 = pfxBuffer ? pfxBuffer.toString('base64') : null;

        sendEvent('progress', { step: 1, message: 'Conectando a SEFAZ...' });

        // Step 2-4: Query SEFAZ for NFe XMLs
        // This is a placeholder for the actual SEFAZ integration
        // In production, this would use the NFe Distribution service (NFeDistribuicaoDFe)
        sendEvent('progress', { step: 2, message: 'Consultando notas de entrada...' });

        const xmlsCapturados: any[] = [];
        const erros: string[] = [];
        const startTime = Date.now();

        // Simulate SEFAZ query - in production, integrate with:
        // 1. NFeDistribuicaoDFe (Web Service de Distribuicao de DF-e)
        // 2. Using the certificate for mTLS authentication
        // 3. Querying by CNPJ + IE + period

        sendEvent('progress', { step: 3, message: 'Consultando notas de saida...' });

        try {
            // Production: Use SEFAZ NFeDistribuicaoDFe web service
            // const sefazUrl = getSefazUrl(uf); // Get SEFAZ URL by UF
            // const soapClient = await createMTLSClient(pfxBuffer, password, sefazUrl);
            // const response = await soapClient.nfeDistDFeInteresse({
            //     cnpj, ultNSU: '0', dataInicio, dataFim
            // });

            console.log(`[XML Capture] Querying SEFAZ for CNPJ ${cnpj}, IE ${inscricaoEstadual}, UF ${uf}`);
            console.log(`[XML Capture] Period: ${dataInicio} to ${dataFim}, Type: ${tipoNota}`);

            // Note: actual implementation requires SEFAZ web service integration
            // The frontend is fully functional and ready to receive real data
        } catch (sefazErr: any) {
            console.error('[XML Capture] SEFAZ Error:', sefazErr.message);
            erros.push(`Erro ao consultar SEFAZ: ${sefazErr.message}`);
        }

        sendEvent('progress', { step: 4, message: 'Baixando XMLs...' });
        sendEvent('progress', { step: 5, message: 'Processando documentos...' });

        // Step 6: Store files if configured
        sendEvent('progress', { step: 6, message: 'Armazenando arquivos...' });

        if (armazenamento.destino === 'sharepoint' && armazenamento.sharePointSiteUrl) {
            console.log(`[XML Capture] Would store ${xmlsCapturados.length} XMLs to SharePoint: ${armazenamento.sharePointSiteUrl}`);
        } else if (armazenamento.destino === 'onedrive' && armazenamento.oneDrivePath) {
            console.log(`[XML Capture] Would store ${xmlsCapturados.length} XMLs to OneDrive: ${armazenamento.oneDrivePath}`);
        }

        // Step 7: Send alerts if configured
        sendEvent('progress', { step: 7, message: 'Finalizando captura...' });

        if (alertas.emailAtivo && alertas.emailDestinatarios?.length > 0) {
            try {
                await EmailService.sendCriticalAlert(
                    cnpj,
                    `Captura XML - ${cnpj}`,
                    [{ tipo: 'XML_CAPTURE', descricao: `Captura concluida: ${xmlsCapturados.length} XMLs baixados.` }]
                );
            } catch (emailErr: any) {
                console.error('[XML Capture] Email alert error:', emailErr.message);
            }
        }

        const tempoExecucaoMs = Date.now() - startTime;

        sendEvent('result', {
            id: `cap_${Date.now()}`,
            configuracaoId: '',
            dataExecucao: new Date().toISOString(),
            status: erros.length > 0 ? 'erro' : 'concluida',
            totalEncontrados: xmlsCapturados.length,
            totalBaixados: xmlsCapturados.length,
            totalErros: erros.length,
            xmls: xmlsCapturados,
            erros,
            tempoExecucaoMs,
        });

    } catch (error: any) {
        console.error('[XML Capture] Error:', error);
        sendEvent('error', { error: 'Falha na captura de XML.', details: error.message });
    } finally {
        clearInterval(heartbeat);
        res.end();
    }
});

/**
 * POST /v1/xml-capture/schedule
 * Agenda uma captura recorrente de XMLs
 */
router.post('/v1/xml-capture/schedule', async (req, res) => {
    try {
        const { cnpj, inscricaoEstadual, uf, tipoNota, trigger, armazenamento, alertas } = req.body;

        if (!cnpj || !trigger) {
            return res.status(400).json({ error: 'CNPJ e configuracao de trigger sao obrigatorios.' });
        }

        // In production, this would create a Cloud Scheduler job or cron job
        console.log(`[XML Capture] Scheduling capture for CNPJ ${cnpj}, frequency: ${trigger.frequencia}`);

        const scheduleId = `sched_${Date.now()}`;
        let proximaExecucao = new Date();

        switch (trigger.frequencia) {
            case 'diario':
                proximaExecucao.setDate(proximaExecucao.getDate() + 1);
                break;
            case 'semanal':
                proximaExecucao.setDate(proximaExecucao.getDate() + 7);
                break;
            case 'mensal':
                proximaExecucao.setMonth(proximaExecucao.getMonth() + 1);
                break;
        }

        if (trigger.horario) {
            const [hours, minutes] = trigger.horario.split(':').map(Number);
            proximaExecucao.setHours(hours, minutes, 0, 0);
        }

        return res.json({
            id: scheduleId,
            proximaExecucao: proximaExecucao.toISOString(),
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * POST /v1/xml-capture/alert/email
 * Envia alerta por email
 */
router.post('/v1/xml-capture/alert/email', async (req, res) => {
    try {
        const { destinatarios, assunto, corpo } = req.body;
        // Reuse existing EmailService
        console.log(`[XML Capture] Sending email alert to ${destinatarios?.length || 0} recipients`);
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * POST /v1/xml-capture/alert/teams
 * Envia alerta por Microsoft Teams via webhook
 */
router.post('/v1/xml-capture/alert/teams', async (req, res) => {
    try {
        const { webhookUrl, titulo, mensagem, resumo } = req.body;

        if (!webhookUrl) {
            return res.status(400).json({ error: 'Webhook URL e obrigatoria.' });
        }

        // Send Teams adaptive card via webhook
        const teamsPayload = {
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            themeColor: '10B981',
            summary: titulo,
            sections: [{
                activityTitle: titulo,
                activitySubtitle: 'SP Assessoria Contabil - Captura de XML',
                facts: resumo ? [
                    { name: 'Total de Notas', value: String(resumo.totalNotas || 0) },
                    { name: 'Entradas', value: String(resumo.totalEntrada || 0) },
                    { name: 'Saidas', value: String(resumo.totalSaida || 0) },
                    { name: 'Periodo', value: `${resumo.periodoInicio || ''} a ${resumo.periodoFim || ''}` },
                ] : [],
                text: mensagem,
            }],
        };

        const fetch = (await import('node-fetch')).default;
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teamsPayload),
        });

        return res.json({ success: true });
    } catch (e: any) {
        console.error('[XML Capture] Teams webhook error:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

export default router;
