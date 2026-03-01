import nodemailer from 'nodemailer';
import { FiscalIssue } from '../TaxParser';

export class EmailService {
    // Configuração do Transporter (idealmente usando variáveis de ambiente)
    private static transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: true, // true para a porta 465, false para outras portas
        auth: {
            user: process.env.SMTP_USER || 'alertas@spassessoriacontabil.com.br',
            pass: process.env.SMTP_PASS || 'SUA_SENHA_DE_APP_AQUI',
        },
    });

    // E-mail da equipa que vai receber os alertas
    private static EQUIPA_EMAIL = process.env.TECHNICAL_TEAM_EMAIL || 'suporte@spassessoriacontabil.com.br';

    /**
     * Envia um alerta crítico se as pendências ultrapassarem os critérios de risco
     */
    static async sendCriticalAlert(cnpj: string, razaoSocial: string, pendencias: FiscalIssue[]): Promise<void> {
        // 1. Filtra apenas pendências graves (Multas MAED ou débitos acima de um valor de risco, ex: R$ 5.000)
        const pendenciasCriticas = pendencias.filter(p =>
            p.tipo === 'MULTA_ATRASO' || (p.valor && p.valor > 5000)
        );

        // Se não houver nada crítico, não envia e-mail para não gerar "ruído"
        if (pendenciasCriticas.length === 0) return;

        const valorTotalCritico = pendenciasCriticas.reduce((acc, curr) => acc + (curr.valor || 0), 0);

        // 2. Constrói o corpo do e-mail em HTML profissional
        const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #dc2626; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">⚠️ ALERTA DE COMPLIANCE CRÍTICO</h2>
        </div>
        <div style="padding: 30px; background-color: #f8fafc;">
          <p style="font-size: 16px; color: #334155;">O sistema <strong>ConsultaSP</strong> detetou irregularidades graves numa auditoria automática.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background-color: white;">
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; width: 30%;">Empresa</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${razaoSocial}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">CNPJ</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${cnpj}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #dc2626;">Risco Total Estimado</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #dc2626;">R$ ${valorTotalCritico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>

          <h3 style="margin-top: 30px; color: #0f172a;">Detalhamento das Pendências Críticas:</h3>
          <ul style="color: #475569; padding-left: 20px;">
            ${pendenciasCriticas.map(p => `
              <li style="margin-bottom: 10px;">
                <strong>${p.orgao}</strong>: ${p.descricao} 
                <br><span style="color: #dc2626;">(Valor: R$ ${p.valor ? p.valor.toLocaleString('pt-BR') : 'Não especificado'})</span>
              </li>
            `).join('')}
          </ul>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 12px; color: #94a3b8;">
            <p>Este é um e-mail automático gerado pelo motor de varredura fiscal. Por favor, analise o caso no portal e-CAC.</p>
          </div>
        </div>
      </div>
    `;

        try {
            // 3. Dispara o e-mail
            await this.transporter.sendMail({
                from: '"Auditoria Automatizada" <alertas@spassessoriacontabil.com.br>',
                to: this.EQUIPA_EMAIL,
                subject: `[ALERTA FISCAL] Pendências Críticas - ${razaoSocial}`,
                html: htmlBody,
            });

            console.log(`[EmailService] Alerta enviado à equipa para o CNPJ: ${cnpj}`);
        } catch (error: any) {
            console.error(`[EmailService] Falha ao enviar alerta para ${cnpj}:`, error.message);
        }
    }
}