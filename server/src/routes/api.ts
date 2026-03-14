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
    try {
        if (!req.file || !req.body.password) {
            return res.status(400).json({ error: 'Certificado e senha são obrigatórios.' });
        }

        const pfxBase64 = req.file.buffer.toString('base64');
        const password = req.body.password;
        const cnpj = req.body.cnpj || 'Não Informado';

        // 1. Acesso aos órgãos federais e municipal em paralelo
        let ecacResult: any = null;
        let pendenciasFederais: any[] = [];
        let federalError = false;
        let pendenciasMunicipais: any[] = [];
        let certidaoMunicipal = null;

        const [federalResult, municipalResult] = await Promise.allSettled([
            scanRFB(pfxBase64, password),
            MunicipalService.scanMunicipal(pfxBase64, password, cnpj)
        ]);

        // Process federal result
        if (federalResult.status === 'fulfilled') {
            ecacResult = federalResult.value;
            pendenciasFederais = TaxParser.parseEcacDashboard(ecacResult);
        } else {
            console.error("Erro na varredura federal:", federalResult.reason?.message);
            federalError = true;
            pendenciasFederais = [{
                orgao: 'Receita Federal / e-CAC',
                tipo: 'VERIFICACAO_MANUAL',
                descricao: `Comunicação com órgãos federais indisponível: ${federalResult.reason?.message || 'Erro desconhecido'}. Verificar manualmente.`,
                riskLevel: 'High',
            }];
        }

        // Process municipal result
        if (municipalResult.status === 'fulfilled') {
            pendenciasMunicipais = municipalResult.value.pendencias || [];
            if (municipalResult.value.certidao) {
                certidaoMunicipal = municipalResult.value.certidao;
            }
        } else {
            console.error("Erro na varredura municipal:", municipalResult.reason?.message);
            pendenciasMunicipais = [{
                orgao: 'Prefeitura Municipal',
                tipo: 'VERIFICACAO_MANUAL',
                descricao: 'Varredura municipal indisponivel no momento. Verificar manualmente.',
                riskLevel: 'Medium',
            }];
        }

        // 3. Consolida todas as pendencias
        const pendencias = [...pendenciasFederais, ...pendenciasMunicipais];

        let certidoes: any[] = [];

        // 4. Emissao Inteligente de CNDs
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

        // Adiciona certidao municipal se emitida
        if (certidaoMunicipal) {
            certidoes.push(certidaoMunicipal);
        }

        // Adiciona certidoes nao emitidas para visibilidade
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

        const statusCliente = pendencias.length === 0 ? 'REGULAR' : 'IRREGULAR';
        const orgaos = [...new Set(pendencias.map((p: any) => p.orgao))].join(', ');
        const razaoSocial = ecacResult?.razaoSocial || `Empresa ${cnpj}`;

        // 5. Integracoes Assincronas (Planilhas + E-mail)
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

        // 6. Retorna para o Frontend
        return res.json({
            status: 'success',
            clienteRegular: pendencias.length === 0,
            pendencias: pendencias,
            certidoes: certidoes
        });

    } catch (error: any) {
        console.error("Erro na auditoria-completa:", error);
        return res.status(500).json({ error: 'Falha na comunicação com os órgãos governamentais.', details: error.message });
    }
});

export default router;
