import { google } from 'googleapis';

export interface AuditLog {
    cnpj: string;
    razaoSocial: string;
    status: 'REGULAR' | 'IRREGULAR' | 'ERRO_LEITURA';
    totalPendencias: number;
    orgaosComProblema: string;
    linkCndGerada?: string;
}

export class GoogleSheetsService {
    // ID da folha de cálculo (encontra-se na URL do Google Sheets)
    private static SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || 'COLE_O_ID_DA_SUA_PLANILHA_AQUI';

    /**
     * Inicializa o cliente de autenticação do Google usando as credenciais do Service Account
     */
    private static async getAuthClient() {
        // As credenciais devem vir do Google Secret Manager no Cloud Run
        // Em ambiente local, pode usar um ficheiro credentials.json
        const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;

        if (!credentialsBase64) {
            throw new Error('Credenciais do Google não configuradas no ambiente.');
        }

        const credentials = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString('utf8'));

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        return auth.getClient();
    }

    /**
     * Escreve uma nova linha de registo no final da folha de cálculo
     */
    static async logAuditResult(log: AuditLog): Promise<void> {
        try {
            const authClient = await this.getAuthClient();
            const sheets = google.sheets({ version: 'v4', auth: authClient as any });

            // Prepara a linha com a data/hora atual de Brasília/São Paulo
            const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            const values = [
                [
                    dataHora,
                    log.cnpj,
                    log.razaoSocial,
                    log.status,
                    log.totalPendencias,
                    log.orgaosComProblema,
                    log.linkCndGerada || 'N/A'
                ]
            ];

            // Insere os dados na primeira página (Sheet1)
            await sheets.spreadsheets.values.append({
                spreadsheetId: this.SPREADSHEET_ID,
                range: 'Sheet1!A:G',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values },
            });

            console.log(`[Google Sheets] Registo gravado com sucesso para o CNPJ: ${log.cnpj}`);

        } catch (error: any) {
            console.error(`[Google Sheets] Falha ao gravar histórico do CNPJ ${log.cnpj}:`, error.message);
            // Não lançamos o erro (throw) para não interromper a devolução dos dados ao cliente no frontend
        }
    }
}