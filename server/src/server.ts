import express from 'express';
import cors from 'cors';
import { TaxParser } from './TaxParser';
import { CNDService } from './services/CNDService'; // O serviço de CNDs que criamos
import { scanRFB } from './services/rfbScanner'; // A lógica do Puppeteer extraída para uma função

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.post('/api/v1/auditoria-completa', async (req, res) => {
    const { pfxBase64, password, cnpj } = req.body;

    try {
        // 1. Acessa os órgãos e obtém o HTML (via Puppeteer/mTLS)
        const rawHtml = await scanRFB(pfxBase64, password);

        // 2. Transforma o HTML em dados (Pendências, Valores, etc)
        const pendencias = TaxParser.parseEcacDashboard(rawHtml);

        let certidoes = [];

        // 3. A Lógica de Negócio de Ouro: Se não há pendências, emite CND
        if (pendencias.length === 0) {
            console.log(`CNPJ ${cnpj} limpo. Iniciando emissão automática de CNDs...`);

            // Chama o emissor (exemplo simplificado retornando URLs ou Base64)
            const cndFederal = await CNDService.emitFederal(pfxBase64, password);
            if (cndFederal) {
                certidoes.push({
                    orgao: 'Receita Federal / PGFN',
                    nome: 'Certidão Negativa de Débitos Relativos aos Tributos Federais',
                    status: 'EMITIDA',
                    arquivoBase64: cndFederal // O PDF gerado
                });
            }
        }

        // 4. Devolve tudo para o Frontend renderizar
        res.json({
            status: 'success',
            clienteRegular: pendencias.length === 0,
            pendencias: pendencias,
            certidoes: certidoes
        });

    } catch (error: any) {
        console.error("Erro na auditoria:", error.message);
        res.status(500).json({ error: 'Falha na comunicação com os órgãos.' });
    }
});

app.listen(8080, () => console.log("Motor de Auditoria SP Assessoria rodando na porta 8080"));