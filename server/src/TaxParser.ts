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

        return rawData.pendencies.map((p: any) => {
            const tipo = p.tipo || 'Pendência';
            let riskLevel: FiscalIssue['riskLevel'] = 'Medium';

            if (tipo === 'DEBITO_FISCAL' || tipo === 'MULTA' || tipo === 'AUTO_INFRACAO') {
                riskLevel = (p.valor && p.valor > 10000) ? 'Critical' : 'High';
            } else if (tipo === 'PARCELAMENTO') {
                riskLevel = 'High';
            } else if (tipo === 'DECLARACAO_AUSENTE') {
                riskLevel = 'High';
            } else if (tipo === 'VERIFICACAO_MANUAL') {
                riskLevel = 'Medium';
            }

            return {
                orgao: 'Receita Federal / e-CAC',
                tipo,
                descricao: p.descricao || 'Irregularidade detectada',
                valor: p.valor || 0,
                vencimento: p.vencimento,
                riskLevel,
            };
        });
    }

    static parsePGFNDebts(rawData: any): FiscalIssue[] {
        if (!rawData || !rawData.debts) return [];

        return rawData.debts.map((d: any) => ({
            orgao: 'PGFN - Dívida Ativa da União',
            tipo: 'DIVIDA_ATIVA',
            descricao: d.descricao || 'Inscrição em Dívida Ativa',
            valor: d.valor || 0,
            riskLevel: 'Critical' as const,
        }));
    }

    static parseESocialPendencies(rawData: any): FiscalIssue[] {
        if (!rawData || !rawData.pendencies) return [];

        return rawData.pendencies.map((p: any) => ({
            orgao: 'e-Social',
            tipo: 'ESOCIAL_PENDENTE',
            descricao: p.descricao || 'Evento e-Social pendente ou rejeitado',
            valor: p.valor || 0,
            riskLevel: (p.status === 'Rejeitado' ? 'High' : 'Medium') as FiscalIssue['riskLevel'],
        }));
    }
}
