import { chromium } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileLog } from '../logger';

export interface MunicipalScanResult {
  prefeitura: string;
  cndMunicipalStatus: 'Emitida' | 'Com Pendencias' | 'Nao Emitida';
  pendencias: Array<{
    orgao: string;
    tipo: string;
    descricao: string;
    valor?: number;
    vencimento?: string;
    riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  }>;
  certidao?: {
    orgao: string;
    nome: string;
    status: string;
    arquivoBase64?: string;
  };
}

export class MunicipalService {

  /**
   * Tenta acessar o portal da prefeitura municipal para verificar:
   * - ISS pendente
   * - TFE/TFA (Taxa de Fiscalizacao)
   * - Alvara de Funcionamento
   * - CND Municipal
   * - Divida Ativa Municipal
   */
  static async scanMunicipal(pfxBase64: string, password: string, cnpj?: string): Promise<MunicipalScanResult> {
    const sessionId = uuidv4();
    const pfxPath = path.join(os.tmpdir(), `cert-municipal-${sessionId}.pfx`);
    const pfxBuffer = Buffer.from(pfxBase64, 'base64');

    fileLog(`[MunicipalService] Iniciando varredura municipal para CNPJ: ${cnpj || 'N/A'}`);

    try {
      fs.writeFileSync(pfxPath, pfxBuffer);

      // Attempt to convert legacy PFX format for Chromium compatibility
      let finalPfxPath = pfxPath;
      try {
        const pemPath = pfxPath + '.pem';
        const modernPfxPath = pfxPath + '.modern.pfx';
        const { execSync } = require('child_process');

        try {
          execSync(`openssl pkcs12 -in "${pfxPath}" -out "${pemPath}" -nodes -passin pass:"${password}" -legacy 2>/dev/null`, { timeout: 10000 });
        } catch {
          execSync(`openssl pkcs12 -in "${pfxPath}" -out "${pemPath}" -nodes -passin pass:"${password}" 2>/dev/null`, { timeout: 10000 });
        }

        execSync(`openssl pkcs12 -export -in "${pemPath}" -out "${modernPfxPath}" -passout pass:"${password}" 2>/dev/null`, { timeout: 10000 });

        if (fs.existsSync(modernPfxPath) && fs.statSync(modernPfxPath).size > 0) {
          finalPfxPath = modernPfxPath;
        }

        if (fs.existsSync(pemPath)) fs.unlinkSync(pemPath);
      } catch (convErr) {
        fileLog(`[MunicipalService] Aviso: Conversao do certificado falhou, usando original.`);
      }

      // Attempt to access Prefeitura de Sao Paulo (most common for SP region)
      const result = await this.scanPrefeituraSP(finalPfxPath, password, cnpj);
      return result;

    } catch (error: any) {
      fileLog(`[MunicipalService] Erro na varredura municipal: ${error.message}`);

      // Return a result indicating scan failure with recommendation
      return {
        prefeitura: 'Prefeitura Municipal',
        cndMunicipalStatus: 'Nao Emitida',
        pendencias: [{
          orgao: 'Prefeitura Municipal',
          tipo: 'VERIFICACAO_MANUAL',
          descricao: 'Nao foi possivel acessar automaticamente o portal da prefeitura. Recomenda-se verificacao manual.',
          riskLevel: 'Medium',
        }],
      };
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(pfxPath)) fs.unlinkSync(pfxPath);
        if (fs.existsSync(pfxPath + '.modern.pfx')) fs.unlinkSync(pfxPath + '.modern.pfx');
      } catch { /* ignore cleanup errors */ }
    }
  }

  /**
   * Varredura especifica para Prefeitura de Sao Paulo
   * Portal: https://nfe.prefeitura.sp.gov.br
   */
  private static async scanPrefeituraSP(pfxPath: string, password: string, cnpj?: string): Promise<MunicipalScanResult> {
    let browser;

    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext({
        clientCertificates: [{
          origin: 'https://nfe.prefeitura.sp.gov.br',
          pfxPath: pfxPath,
          passphrase: password,
        }],
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      const page = await context.newPage();
      page.setDefaultTimeout(30000);

      const pendencias: MunicipalScanResult['pendencias'] = [];

      try {
        // Navigate to the Sao Paulo municipal portal
        await page.goto('https://nfe.prefeitura.sp.gov.br/contribuinte/default.aspx', {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        // Check for ISS/TFE/TFA debts by inspecting the page content
        const pageContent = await page.content();

        // Parse ISS pendencies
        if (pageContent.includes('ISS') && (pageContent.includes('pendente') || pageContent.includes('aberto'))) {
          pendencias.push({
            orgao: 'Prefeitura SP',
            tipo: 'ISS_PENDENTE',
            descricao: 'Imposto sobre Servicos (ISS) com parcelas em aberto detectadas no portal municipal.',
            riskLevel: 'High',
          });
        }

        // Parse TFE
        if (pageContent.includes('TFE') && pageContent.includes('pendente')) {
          pendencias.push({
            orgao: 'Prefeitura SP',
            tipo: 'TFE_PENDENTE',
            descricao: 'Taxa de Fiscalizacao de Estabelecimentos (TFE) pendente de pagamento.',
            riskLevel: 'Medium',
          });
        }

        // Check for CND Municipal availability
        const cndAvailable = pageContent.includes('Certidão Negativa') || pageContent.includes('certidao negativa');

        if (pendencias.length === 0 && cndAvailable) {
          return {
            prefeitura: 'Prefeitura de Sao Paulo',
            cndMunicipalStatus: 'Emitida',
            pendencias: [],
            certidao: {
              orgao: 'Prefeitura Municipal SP',
              nome: 'Certidao Negativa de Debitos de Tributos Mobiliarios',
              status: 'EMITIDA',
            },
          };
        }

      } catch (navError: any) {
        fileLog(`[MunicipalService] Erro de navegacao na Prefeitura SP: ${navError.message}`);

        // Take screenshot for debugging
        try {
          const debugDir = path.join(__dirname, '../../debug');
          if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
          await page.screenshot({ path: path.join(debugDir, `municipal-${Date.now()}.png`) });
        } catch { /* ignore */ }
      }

      return {
        prefeitura: 'Prefeitura de Sao Paulo',
        cndMunicipalStatus: pendencias.length > 0 ? 'Com Pendencias' : 'Nao Emitida',
        pendencias,
      };

    } finally {
      if (browser) await browser.close();
    }
  }
}
