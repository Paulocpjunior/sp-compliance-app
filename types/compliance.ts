
export type RegimeTributario = 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional';
export type StatusObrigacao = 'Entregue' | 'Pendente';
export type NivelRisco = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Representa uma obrigação fiscal simplificada para análise de risco.
 */
export interface Obrigacao {
  tipo: string;
  status: StatusObrigacao;
  diasAtraso: number;
}

/**
 * Nova Interface: Obrigação Mensal Detalhada (e-CAC style)
 */
export interface MonthlyObligation {
    competence: string; // ex: "07/2024"
    description: string; // ex: "PGDAS-D", "DCTFWeb", "EFD-Reinf"
    status: 'Em Aberto' | 'Pendente' | 'Não Entregue' | 'Retificada' | 'Entregue' | 'Em Processamento';
    dueDate: string;
    filingDate?: string; // Data da entrega, se houver
    amount?: number; // Valor declarado
}

/**
 * Nova Interface: Obrigações Acessórias Anuais (ECD, ECF, DEFIS)
 */
export interface AnnualObligation {
    name: 'ECD' | 'ECF' | 'DEFIS' | 'DIRF' | 'Outra';
    exerciseYear: string; // Ano exercício (ex: 2023)
    status: 'Entregue' | 'Pendente' | 'Não Obrigatório' | 'Desconhecido';
    receiptNumber?: string; // Número do recibo se houver
}

/**
 * Representa um processo jurídico manual ou importado.
 */
export interface LegalProcess {
  id: string;
  processNumber: string;
  sphere: 'Federal' | 'Estadual' | 'Municipal' | 'Trabalhista' | 'Cível';
  status: 'Ativo' | 'Suspenso' | 'Arquivado' | 'Em Execução';
  description?: string;
}

/**
 * Detalhes do FGTS.
 */
export interface FgtsStatus {
    status: 'Regular' | 'Irregular';
    competenciasEmAberto: string[]; // ex: ['04/2024', '05/2024']
    ultimoDeposito?: string;
}

/**
 * Detalhes do e-Social.
 */
export interface EsocialStatus {
    status: 'Regular' | 'Pendente';
    eventosPendentes: number;
    eventosRejeitados: number;
    ultimaTransmissao?: string;
}

/**
 * Detalhes de Parcelamentos.
 */
export interface Installment {
    modalidade: string; // ex: "PERT - Lei 13.496", "Simples Nacional - Ordinário"
    status: 'Em dia' | 'Em Atraso' | 'Rescindido';
    valorParcela: number;
    parcelasPagas: number;
    totalParcelas: number;
    proximoVencimento: string;
}

/**
 * Detalhes Municipais Específicos.
 */
export interface MunicipalDetail {
    inscricaoMunicipal: string;
    tfeStatus: 'Em dia' | 'Pendente';
    issStatus: 'Em dia' | 'Pendente';
    dividaAtivaMunicipal: boolean;
}

/**
 * Representa uma pendência detalhada para exibição no dashboard.
 */
export interface Pendency {
  description: string;
  amount: number;
  correctedAmount?: number; // Valor corrigido (Selic + Multa)
  riskLevel: NivelRisco;
  type: 'Federal' | 'State' | 'Municipal' | 'Trabalhista';
  dueDate?: string;
  
  // Campos auxiliares para mapeamento na RiskEngine
  tipoObrigacao?: string;
  status?: StatusObrigacao;
  diasDeAtraso?: number;
}

/**
 * Estrutura do email gerado.
 */
export interface EmailDraft {
  subject: string;
  body: string;
}

/**
 * Estrutura completa dos dados de compliance da empresa.
 */
export interface ComplianceData {
  cnpj: string;
  razaoSocial: string;
  cnae?: string;
  endereco?: string;
  
  taxRegime?: RegimeTributario;
  impostoPago?: string; // Ex: "PGDAS 07/2024 - R$ 1.200,00"
  
  // Status Cards Principais
  cndFederalStatus: 'Emitida' | 'Com Pendências' | 'Não Emitida';
  cndStateStatus: 'Emitida' | 'Com Pendências' | 'Não Emitida';
  cndMunicipalStatus: 'Emitida' | 'Com Pendências' | 'Não Emitida';
  ecacStatus?: 'Regular' | 'Irregular' | 'Pendente';
  
  // Novos Detalhamentos
  monthlyObligations: MonthlyObligation[]; // LISTA MENSAL DETALHADA
  annualObligations: AnnualObligation[];   // LISTA ANUAL (ECD, ECF, DEFIS)
  
  fgts?: FgtsStatus;
  esocial?: EsocialStatus;
  municipalDetail?: MunicipalDetail;
  installments?: Installment[];

  pendencies: Pendency[];
  legalProcesses?: LegalProcess[];

  score: number;
  globalRiskLevel: NivelRisco;
  actionPlan: string[];
  clientCommunicationMessage: string;
  emailDraft?: EmailDraft;
}

/**
 * Retorno da análise de risco da RiskEngine.
 */
export interface ResultadoAnalise {
  nivelRisco: NivelRisco;
  sugestaoAcao: string;
  score: number;
}