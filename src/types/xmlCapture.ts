/**
 * Tipos e interfaces para o módulo de Captura de XML de NF-e/NFC-e
 */

export type TipoCertificado = 'A1' | 'A3';
export type OrigemCertificado = 'contabilidade' | 'cliente';
export type TipoNota = 'entrada' | 'saida' | 'ambas';
export type StatusCaptura = 'pendente' | 'em_andamento' | 'concluida' | 'erro' | 'agendada';
export type DestinoArmazenamento = 'local' | 'sharepoint' | 'onedrive';
export type FrequenciaTrigger = 'manual' | 'diario' | 'semanal' | 'mensal' | 'personalizado';

export interface ClienteCaptura {
  id: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  uf: string;
  tipoCertificado: TipoCertificado;
  origemCertificado: OrigemCertificado;
  certificadoArquivo?: File;
  certificadoSenha?: string;
  ativo: boolean;
}

export interface PeriodoCaptura {
  dataInicio: string; // yyyy-mm-dd
  dataFim: string;    // yyyy-mm-dd
}

export interface ConfiguracaoCaptura {
  id: string;
  cliente: ClienteCaptura;
  periodo: PeriodoCaptura;
  tipoNota: TipoNota;
  trigger: ConfiguracaoTrigger;
  armazenamento: ConfiguracaoArmazenamento;
  alertas: ConfiguracaoAlertas;
  exportacao: ConfiguracaoExportacao;
  status: StatusCaptura;
  ultimaExecucao?: string;
  proximaExecucao?: string;
  totalXmlCapturados?: number;
}

export interface ConfiguracaoTrigger {
  frequencia: FrequenciaTrigger;
  horario?: string; // HH:mm
  diasSemana?: number[]; // 0-6 (dom-sab)
  diaDoMes?: number; // 1-31
  cronExpression?: string; // Para modo personalizado
}

export interface ConfiguracaoArmazenamento {
  destino: DestinoArmazenamento;
  pastaBase?: string;
  organizarPorCnpj: boolean;
  organizarPorPeriodo: boolean;
  sharePointSiteUrl?: string;
  sharePointLibrary?: string;
  oneDrivePath?: string;
}

export interface ConfiguracaoAlertas {
  emailAtivo: boolean;
  emailDestinatarios: string[];
  teamsAtivo: boolean;
  teamsWebhookUrl?: string;
  alertarSucesso: boolean;
  alertarErro: boolean;
  alertarSemNotas: boolean;
  resumoDiario: boolean;
}

export interface ConfiguracaoExportacao {
  formatoEFiscal: boolean; // IOB SAGE Folhamatic E-fiscal
  gerarRelatorio: boolean;
  incluirResumo: boolean;
  separadorCSV: string; // ; ou ,
  encodingArquivo: 'UTF-8' | 'ISO-8859-1' | 'Windows-1252';
}

export interface XmlCapturado {
  id: string;
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  cnpjDestinatario: string;
  nomeDestinatario: string;
  valorTotal: number;
  tipoNota: 'entrada' | 'saida';
  status: 'autorizada' | 'cancelada' | 'denegada' | 'inutilizada';
  xmlBase64?: string;
  cfop?: string;
  naturezaOperacao?: string;
}

export interface ResultadoCaptura {
  id: string;
  configuracaoId: string;
  dataExecucao: string;
  status: StatusCaptura;
  totalEncontrados: number;
  totalBaixados: number;
  totalErros: number;
  xmls: XmlCapturado[];
  erros: string[];
  tempoExecucaoMs: number;
}

/**
 * Formato de exportação compatível com IOB SAGE Folhamatic - Módulo E-fiscal
 * Layout de registro para importação de NF-e
 */
export interface RegistroEFiscal {
  tipoRegistro: string;         // Tipo do registro (10, 11, 50, 51, 54, 75, 90)
  cnpjEstabelecimento: string;
  inscricaoEstadual: string;
  dataEmissao: string;          // ddMMyyyy
  uf: string;
  modeloDocumento: string;      // 55 = NF-e, 65 = NFC-e
  serie: string;
  numero: string;
  cfop: string;
  valorTotal: number;
  baseCalculoIcms: number;
  valorIcms: number;
  isenta: number;
  outras: number;
  aliquotaIcms: number;
  situacao: string;             // N=Normal, S=Cancelada
  chaveNfe: string;
}

export interface ResumoCaptura {
  totalNotas: number;
  totalEntrada: number;
  totalSaida: number;
  valorTotalEntrada: number;
  valorTotalSaida: number;
  notasCanceladas: number;
  periodoInicio: string;
  periodoFim: string;
  cnpjsProcessados: string[];
}
