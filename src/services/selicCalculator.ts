// Tabela SELIC mensal acumulada (últimos meses - valores aproximados)
// Fonte: Banco Central do Brasil
const SELIC_MENSAL_HISTORICO: Record<string, number> = {
  '2024-01': 0.0097, '2024-02': 0.0080, '2024-03': 0.0083,
  '2024-04': 0.0089, '2024-05': 0.0083, '2024-06': 0.0079,
  '2024-07': 0.0091, '2024-08': 0.0087, '2024-09': 0.0084,
  '2024-10': 0.0093, '2024-11': 0.0079, '2024-12': 0.0087,
  '2025-01': 0.0108, '2025-02': 0.0100, '2025-03': 0.0108,
  '2025-04': 0.0108, '2025-05': 0.0108, '2025-06': 0.0108,
  '2025-07': 0.0108, '2025-08': 0.0108, '2025-09': 0.0108,
  '2025-10': 0.0108, '2025-11': 0.0108, '2025-12': 0.0108,
  '2026-01': 0.0115, '2026-02': 0.0115, '2026-03': 0.0115,
};

const SELIC_PADRAO = 0.0115; // Taxa padrão quando não há dado histórico

export interface SelicResult {
  valorOriginal: number;
  valorAtualizado: number;
  jurosAcumulados: number;
  multaMora: number;
  multaAtraso: number;
  totalEncargos: number;
  mesesAtraso: number;
  diasAtraso: number;
  dataVencimento: Date;
  dataCalculo: Date;
  selicAcumulada: number;
  detalhamentoMensal: Array<{
    mes: string;
    taxa: number;
    jurosNoMes: number;
    saldoAcumulado: number;
  }>;
}

export function getSelicMensal(ano: number, mes: number): number {
  const key = `${ano}-${String(mes).padStart(2, '0')}`;
  return SELIC_MENSAL_HISTORICO[key] || SELIC_PADRAO;
}

export function calcularSelicAcumulada(
  valorOriginal: number,
  dataVencimento: Date,
  dataCalculo?: Date
): SelicResult {
  const hoje = dataCalculo || new Date();
  const diffMs = hoje.getTime() - dataVencimento.getTime();
  const diasAtraso = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  if (diasAtraso <= 0 || valorOriginal <= 0) {
    return {
      valorOriginal,
      valorAtualizado: valorOriginal,
      jurosAcumulados: 0,
      multaMora: 0,
      multaAtraso: 0,
      totalEncargos: 0,
      mesesAtraso: 0,
      diasAtraso: 0,
      dataVencimento,
      dataCalculo: hoje,
      selicAcumulada: 0,
      detalhamentoMensal: [],
    };
  }

  const detalhamentoMensal: SelicResult['detalhamentoMensal'] = [];
  let selicAcumulada = 0;
  let saldoAcumulado = valorOriginal;

  // Iterar mês a mês do vencimento até hoje
  const mesInicio = new Date(dataVencimento.getFullYear(), dataVencimento.getMonth() + 1, 1);
  const mesFim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const current = new Date(mesInicio);
  while (current <= mesFim) {
    const taxa = getSelicMensal(current.getFullYear(), current.getMonth() + 1);
    const jurosNoMes = saldoAcumulado * taxa;
    saldoAcumulado += jurosNoMes;
    selicAcumulada += taxa;

    detalhamentoMensal.push({
      mes: `${String(current.getMonth() + 1).padStart(2, '0')}/${current.getFullYear()}`,
      taxa,
      jurosNoMes,
      saldoAcumulado,
    });

    current.setMonth(current.getMonth() + 1);
  }

  const jurosAcumulados = saldoAcumulado - valorOriginal;
  const mesesAtraso = detalhamentoMensal.length;

  // Multa de mora: 0,33% por dia de atraso, limitada a 20%
  const multaMoraPct = Math.min(diasAtraso * 0.0033, 0.20);
  const multaMora = valorOriginal * multaMoraPct;

  // Multa por atraso de declaração/obrigação acessória
  // MAED - Multa por Atraso na Entrega da Declaração
  // R$ 500,00 por mês-calendário (Lucro Presumido/Real) ou R$ 200,00 (Simples Nacional)
  const multaAtraso = 0; // Calculado separadamente por tipo de obrigação

  const totalEncargos = jurosAcumulados + multaMora + multaAtraso;
  const valorAtualizado = valorOriginal + totalEncargos;

  return {
    valorOriginal,
    valorAtualizado,
    jurosAcumulados,
    multaMora,
    multaAtraso,
    totalEncargos,
    mesesAtraso,
    diasAtraso,
    dataVencimento,
    dataCalculo: hoje,
    selicAcumulada,
    detalhamentoMensal,
  };
}

// Penalidades por tipo de obrigação não entregue
export interface PenalidadeInfo {
  obrigacao: string;
  fundamentoLegal: string;
  multaPorMes: number;
  multraMinima: number;
  multraMaxima: number;
  descricao: string;
}

export const PENALIDADES_OBRIGACOES: Record<string, PenalidadeInfo> = {
  DCTF: {
    obrigacao: 'DCTF - Declaração de Débitos e Créditos Tributários Federais',
    fundamentoLegal: 'Art. 7º, Lei 10.426/2002',
    multaPorMes: 500,
    multraMinima: 500,
    multraMaxima: 1500,
    descricao: 'Multa de R$ 500,00 por mês-calendário ou fração (Lucro Presumido/Real). R$ 200,00 para Simples Nacional/MEI.',
  },
  EFD_CONTRIBUICOES: {
    obrigacao: 'EFD-Contribuições (PIS/COFINS)',
    fundamentoLegal: 'Art. 11, Lei 8.218/91; IN RFB 1.252/2012',
    multaPorMes: 500,
    multraMinima: 500,
    multraMaxima: 1500,
    descricao: 'Multa de R$ 500,00 por mês-calendário para PJ do Lucro Real/Presumido. Redução de 50% se entregue antes de procedimento de ofício.',
  },
  ECD: {
    obrigacao: 'ECD - Escrituração Contábil Digital (SPED Contábil)',
    fundamentoLegal: 'Art. 12, Lei 8.218/91',
    multaPorMes: 500,
    multraMinima: 500,
    multraMaxima: 5000,
    descricao: 'Multa de 0,5% do valor da receita bruta no período a que se refere a escrituração, limitada a R$ 5.000.000,00.',
  },
  ECF: {
    obrigacao: 'ECF - Escrituração Contábil Fiscal',
    fundamentoLegal: 'Art. 6º, IN RFB 1.422/2013',
    multaPorMes: 500,
    multraMinima: 500,
    multraMaxima: 1500,
    descricao: 'Multa de R$ 500,00 por mês-calendário ou fração. Redução de 50% se entregue antes de intimação.',
  },
  DEFIS: {
    obrigacao: 'DEFIS - Declaração de Informações Socioeconômicas e Fiscais',
    fundamentoLegal: 'Art. 38-A, LC 123/2006; Resolução CGSN 140/2018',
    multaPorMes: 200,
    multraMinima: 200,
    multraMaxima: 600,
    descricao: 'Multa de R$ 200,00 por mês-calendário. Não impede emissão de CND, mas bloqueia DAS para meses seguintes.',
  },
  PGDAS: {
    obrigacao: 'PGDAS-D - Programa Gerador do DAS (Simples Nacional)',
    fundamentoLegal: 'Art. 38, LC 123/2006',
    multaPorMes: 50,
    multraMinima: 50,
    multraMaxima: 300,
    descricao: 'Multa de 2% ao mês-calendário sobre o valor dos tributos informados, mínimo R$ 50,00 e máximo R$ 300,00.',
  },
  DIRF: {
    obrigacao: 'DIRF - Declaração do Imposto sobre a Renda Retido na Fonte',
    fundamentoLegal: 'Art. 1º, IN SRF 197/2002',
    multaPorMes: 500,
    multraMinima: 200,
    multraMaxima: 1500,
    descricao: 'Multa de 2% ao mês-calendário sobre o valor do IR informado, mínimo R$ 200,00.',
  },
  SPED_FISCAL: {
    obrigacao: 'EFD ICMS/IPI (SPED Fiscal)',
    fundamentoLegal: 'Art. 57, MP 2.158-35/2001',
    multaPorMes: 500,
    multraMinima: 500,
    multraMaxima: 5000,
    descricao: 'Multa de R$ 500,00 por mês-calendário (PJ Lucro Real/Presumido). Apurada estadualmente conforme RICMS.',
  },
  GFIP: {
    obrigacao: 'GFIP/SEFIP - Guia de Recolhimento do FGTS',
    fundamentoLegal: 'Art. 32-A, Lei 8.212/91',
    multaPorMes: 200,
    multraMinima: 200,
    multraMaxima: 6000,
    descricao: 'Multa de R$ 20,00 por grupo de 10 informações incorretas ou omitidas, acrescida de 2% ao mês-calendário sobre contribuições informadas.',
  },
  DCTFWEB: {
    obrigacao: 'DCTFWeb - Declaração de Débitos e Créditos Tributários Federais Previdenciários',
    fundamentoLegal: 'Art. 32-A, Lei 8.212/91',
    multaPorMes: 500,
    multraMinima: 200,
    multraMaxima: 1500,
    descricao: 'Multa de 2% sobre o montante dos tributos declarados, mínimo R$ 200,00 (Simples) ou R$ 500,00.',
  },
  RAIS: {
    obrigacao: 'RAIS - Relação Anual de Informações Sociais',
    fundamentoLegal: 'Art. 25, Lei 7.998/90; Portaria MTE 14/2006',
    multaPorMes: 425.64,
    multraMinima: 425.64,
    multraMaxima: 42564,
    descricao: 'Multa a partir de R$ 425,64 acrescida de R$ 106,40 por bimestre de atraso. Multiplicada pelo nº de empregados.',
  },
};

// Parcelamentos vigentes no Brasil
export interface ParcelamentoVigente {
  nome: string;
  lei: string;
  parcelas: number;
  descontoMulta: number;
  descontoJuros: number;
  descontoEncargos: number;
  entradaPct: number;
  observacao: string;
  tiposDebito: string[];
  vigente: boolean;
}

export const PARCELAMENTOS_VIGENTES: ParcelamentoVigente[] = [
  {
    nome: 'Parcelamento Ordinário (RFB)',
    lei: 'Art. 10-A, Lei 10.522/2002',
    parcelas: 60,
    descontoMulta: 0,
    descontoJuros: 0,
    descontoEncargos: 0,
    entradaPct: 0,
    observacao: 'Parcelamento padrão sem descontos. Parcela mínima R$ 200,00 (PJ). Juros SELIC sobre saldo devedor.',
    tiposDebito: ['Federal'],
    vigente: true,
  },
  {
    nome: 'Parcelamento Simplificado (RFB)',
    lei: 'IN RFB 1.891/2019',
    parcelas: 60,
    descontoMulta: 0,
    descontoJuros: 0,
    descontoEncargos: 0,
    entradaPct: 0,
    observacao: 'Até R$ 5.000.000,00 sem necessidade de garantia. Adesão pelo e-CAC. Parcela mínima R$ 200,00.',
    tiposDebito: ['Federal'],
    vigente: true,
  },
  {
    nome: 'Parcelamento Simples Nacional (RELP)',
    lei: 'LC 193/2022',
    parcelas: 180,
    descontoMulta: 0.65,
    descontoJuros: 0.65,
    descontoEncargos: 1.0,
    entradaPct: 0.01,
    observacao: 'Exclusivo Simples Nacional. Entrada de 1% a 12,5% conforme faixa de receita bruta. Descontos progressivos.',
    tiposDebito: ['Simples Nacional'],
    vigente: true,
  },
  {
    nome: 'Transação Tributária (RFB)',
    lei: 'Lei 13.988/2020; Portaria PGFN 6.757/2022',
    parcelas: 120,
    descontoMulta: 0.65,
    descontoJuros: 0.65,
    descontoEncargos: 1.0,
    entradaPct: 0.05,
    observacao: 'Entrada mínima de 5%. Descontos de até 65% sobre juros e multa para créditos irrecuperáveis. Adesão pelo REGULARIZE (PGFN).',
    tiposDebito: ['Federal', 'PGFN'],
    vigente: true,
  },
  {
    nome: 'Transação por Adesão (Editais PGFN)',
    lei: 'Lei 13.988/2020',
    parcelas: 145,
    descontoMulta: 0.50,
    descontoJuros: 0.50,
    descontoEncargos: 1.0,
    entradaPct: 0.05,
    observacao: 'Editais periódicos da PGFN. Desconto proporcional à capacidade de pagamento. Adesão pelo REGULARIZE.',
    tiposDebito: ['PGFN', 'Dívida Ativa'],
    vigente: true,
  },
  {
    nome: 'Parcelamento FGTS (CEF)',
    lei: 'Lei 8.036/90; Resolução CCFGTS',
    parcelas: 36,
    descontoMulta: 0,
    descontoJuros: 0,
    descontoEncargos: 0,
    entradaPct: 0.10,
    observacao: 'Parcelamento junto à CEF. Entrada mínima 10%. Até 36 parcelas para débitos de FGTS.',
    tiposDebito: ['FGTS'],
    vigente: true,
  },
  {
    nome: 'PPI Municipal (São Paulo)',
    lei: 'Lei Municipal 18.095/2024',
    parcelas: 120,
    descontoMulta: 0.75,
    descontoJuros: 0.75,
    descontoEncargos: 0.75,
    entradaPct: 0,
    observacao: 'Programa de Parcelamento Incentivado da Prefeitura de SP. Desconto de até 75% em juros e multa para pagamento à vista.',
    tiposDebito: ['Municipal', 'ISS'],
    vigente: true,
  },
];

export function calcularMultaObrigacaoAcessoria(
  tipoObrigacao: string,
  mesesAtraso: number
): { multa: number; fundamentoLegal: string; descricao: string } {
  const tipo = tipoObrigacao.toUpperCase().replace(/[-_\s]/g, '_');

  let penalidade: PenalidadeInfo | undefined;
  for (const [key, val] of Object.entries(PENALIDADES_OBRIGACOES)) {
    if (tipo.includes(key)) {
      penalidade = val;
      break;
    }
  }

  if (!penalidade) {
    return {
      multa: 500 * Math.min(mesesAtraso, 12),
      fundamentoLegal: 'Legislação Federal aplicável',
      descricao: `Multa estimada de R$ 500,00 por mês de atraso (${mesesAtraso} meses). Consultar legislação específica.`,
    };
  }

  const multa = Math.min(
    Math.max(penalidade.multaPorMes * mesesAtraso, penalidade.multraMinima),
    penalidade.multraMaxima
  );

  return {
    multa,
    fundamentoLegal: penalidade.fundamentoLegal,
    descricao: penalidade.descricao,
  };
}

export function simularParcelamento(
  valorTotal: number,
  parcelamento: ParcelamentoVigente
): {
  valorEntrada: number;
  valorComDesconto: number;
  valorParcela: number;
  economiaTotal: number;
  totalParcelas: number;
} {
  const entrada = valorTotal * parcelamento.entradaPct;
  const saldo = valorTotal - entrada;

  // Estimar composição: ~60% principal, ~25% juros, ~15% multa
  const estMulta = valorTotal * 0.15;
  const estJuros = valorTotal * 0.25;
  const estPrincipal = valorTotal * 0.60;

  const descontoMulta = estMulta * parcelamento.descontoMulta;
  const descontoJuros = estJuros * parcelamento.descontoJuros;
  const descontoEncargos = (valorTotal * 0.05) * parcelamento.descontoEncargos; // honorários

  const economiaTotal = descontoMulta + descontoJuros + descontoEncargos;
  const valorComDesconto = Math.max(valorTotal - economiaTotal, estPrincipal);
  const saldoParcelar = valorComDesconto - entrada;
  const valorParcela = saldoParcelar / parcelamento.parcelas;

  return {
    valorEntrada: entrada,
    valorComDesconto,
    valorParcela: Math.max(valorParcela, 200),
    economiaTotal,
    totalParcelas: parcelamento.parcelas,
  };
}
