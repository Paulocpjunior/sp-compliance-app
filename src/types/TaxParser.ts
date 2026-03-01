export interface FiscalIssue {
    orgao: string;
    tipo: string;
    descricao: string;
    valor?: number;
    vencimento?: string;
    riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
}
