export interface FiscalIssue {
    orgao: string;
    tipo: string;
    descricao: string;
    valor?: number;
    vencimento?: string;
    riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
}

export class TaxParser {
    static parseEcacDashboard(rawData: any): FiscalIssue[] {
        if (!rawData || !rawData.pendencies) return [];

        return rawData.pendencies.map((p: any) => ({
            orgao: 'Receita Federal / PGFN',
            tipo: p.tipo || 'Pendência',
            descricao: p.descricao || 'Irregularidade detectada',
            valor: p.valor || 0,
            vencimento: p.vencimento
        }));
    }
}
