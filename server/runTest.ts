import * as fs from 'fs';
import * as path from 'path';
import { EcacService } from './src/services/ecacService';

async function testEcac() {
    const certPath = process.argv[2];
    const password = process.argv[3];

    if (!certPath || !password) {
        console.error("Uso: npx ts-node runTest.ts <caminho_pfx> <senha>");
        process.exit(1);
    }

    const certBuffer = fs.readFileSync(path.resolve(certPath));
    console.log("Iniciando teste manual do e-CAC...");

    try {
        const result = await EcacService.fetchSituacaoFiscal(certBuffer, password);
        console.log("RESULTADO FINI:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("ERRO:", e);
    }
}

testEcac();
