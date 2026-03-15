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
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Heartbeat every 15s to prevent proxy/LB idle timeout
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

        const pfxBase64 = req.file.buffer.toString('base64');
        const password = req.body.password;
        const cnpj = req.body.cnpj || 'Não Informado';

        sendEvent('progress', { step: 0, label: 'Validando certificado...' });

        let ecacResult: any = null;
        let pendenciasFederais: any[] = [];
        let federalError = false;
        let pendenciasMunicipais: any[] = [];
        let certidaoMunicipal = null;

        const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
            Promise.race([
                promise,
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label}: tempo limite excedido (${ms/1000}s)`)), ms))
            ]);

        // Federal scan
        sendEvent('progress', { step: 1, label: 'Conectando ao e-CAC (Receita Federal)...' });
        try {
            ecacResult = await withTimeout(scanRFB(pfxBase64, password), 180000, 'Varredura Federal');
            pendenciasFederais = TaxParser.parseEcacDashboard(ecacResult);
            sendEvent('progress', { step: 2, label: 'Varredura federal concluída.' });
        } catch (err: any) {
            console.error("Erro na varredura federal:", err.message);
            federalError = true;
            pendenciasFederais = [{
                orgao: 'Receita Federal / e-CAC',
                tipo: 'VERIFICACAO_MANUAL',
                descricao: `Comunicação com órgãos federais indisponível: ${err.message || 'Erro desconhecido'}. Verificar manualmente.`,
                riskLevel: 'High',
            }];
            sendEvent('progress', { step: 2, label: 'Varredura federal com falha parcial.' });
        }

        // Municipal scan
        sendEvent('progress', { step: 3, label: 'Varrendo Prefeitura Municipal...' });
        try {
            const municipalResult = await withTimeout(MunicipalService.scanMunicipal(pfxBase64, password, cnpj), 60000, 'Varredura Municipal');
            pendenciasMunicipais = municipalResult.pendencias || [];
            if (municipalResult.certidao) {
                certidaoMunicipal = municipalResult.certidao;
            }
            sendEvent('progress', { step: 4, label: 'Varredura municipal concluída.' });
        } catch (err: any) {
            console.error("Erro na varredura municipal:", err.message);
            pendenciasMunicipais = [{
                orgao: 'Prefeitura Municipal',
                tipo: 'VERIFICACAO_MANUAL',
                descricao: 'Varredura municipal indisponivel no momento. Verificar manualmente.',
                riskLevel: 'Medium',
            }];
            sendEvent('progress', { step: 4, label: 'Varredura municipal com falha parcial.' });
        }

        const pendencias = [...pendenciasFederais, ...pendenciasMunicipais];
        let certidoes: any[] = [];

        // CND emission
        sendEvent('progress', { step: 5, label: 'Emitindo certidões (CNDs)...' });
        if (!federalError && pendenciasFederais.length === 0) {
            console.log(`CNPJ ${cnpj} limpo no federal. Tentando emitir CND Federal...`);
            try {
                const cndFederal = await CNDService.emitFederal(pfxBase64, password);
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

        if (pendenciasFederais.length > 0) {
            certidoes.push({
                orgao: 'Receita Federal / PGFN',
                nome: 'Certidão Negativa de Débitos Federais',
                status: 'NAO EMITIDA - Pendencias detectadas',
            });
        }
        if (pendenciasMunicipais.length > 0 && !certidaoMunicipal) {
            certidoes.push({
                orgao: 'Prefeitura Municipal',
                nome: 'Certidão Negativa de Débitos Municipais',
                status: 'NAO EMITIDA - Pendencias detectadas',
            });
        }

        sendEvent('progress', { step: 6, label: 'Calculando nível de risco...' });

        const statusCliente = pendencias.length === 0 ? 'REGULAR' : 'IRREGULAR';
        const orgaos = [...new Set(pendencias.map((p: any) => p.orgao))].join(', ');
        const razaoSocial = ecacResult?.razaoSocial || `Empresa ${cnpj}`;

        // Async integrations (Sheets + Email)
        GoogleSheetsService.logAuditResult({
            cnpj: cnpj,
            razaoSocial: razaoSocial,
            status: statusCliente,
            totalPendencias: pendencias.length,
            orgaosComProblema: orgaos,
            linkCndGerada: ''
        }).catch(err => console.error("Sheets Async Error: ", err));

        if (pendencias.length > 0) {
            EmailService.sendCriticalAlert(cnpj, razaoSocial, pendencias)
               .catch(err => console.error("Email Async Error: ", err));
        }

        // Final result
        sendEvent('result', {
            status: 'success',
            clienteRegular: pendencias.length === 0,
            pendencias: pendencias,
            certidoes: certidoes
        });

    } catch (error: any) {
        console.error("Erro na auditoria-completa:", error);
        sendEvent('error', { error: 'Falha na comunicação com os órgãos governamentais.', details: error.message });
    } finally {
        clearInterval(heartbeat);
        res.end();
    }
});

export default router;
