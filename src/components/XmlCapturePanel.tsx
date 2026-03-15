import React, { useState, useRef } from 'react';
import {
  FileCode2, Building2, Calendar, FileKey, Shield, ChevronDown, ChevronUp,
  Plus, Trash2, Play, Clock, Download, Mail, MessageSquare, FolderOpen,
  AlertTriangle, Loader2, Settings, ArrowUpDown, Search, Check, X, Eye,
  RefreshCw, Bell, HardDrive, Cloud, FileSpreadsheet, Timer
} from 'lucide-react';
import {
  ClienteCaptura,
  ConfiguracaoCaptura,
  ConfiguracaoTrigger,
  ConfiguracaoArmazenamento,
  ConfiguracaoAlertas,
  ConfiguracaoExportacao,
  TipoCertificado,
  OrigemCertificado,
  TipoNota,
  FrequenciaTrigger,
  DestinoArmazenamento,
  ResultadoCaptura,
  XmlCapturado,
} from '../types/xmlCapture';
import { XmlCaptureService } from '../services/xmlCaptureService';

interface XmlCapturePanelProps {
  onVoltar: () => void;
}

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type ActiveSection = 'cliente' | 'periodo' | 'certificado' | 'trigger' | 'armazenamento' | 'alertas' | 'exportacao';

export function XmlCapturePanel({ onVoltar }: XmlCapturePanelProps) {
  // Estado do cliente
  const [clientes, setClientes] = useState<ClienteCaptura[]>([{
    id: crypto.randomUUID(),
    razaoSocial: '',
    cnpj: '',
    inscricaoEstadual: '',
    uf: 'SP',
    tipoCertificado: 'A1',
    origemCertificado: 'contabilidade',
    ativo: true,
  }]);
  const [clienteAtivo, setClienteAtivo] = useState(0);

  // Estado do período
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoNota, setTipoNota] = useState<TipoNota>('ambas');

  // Estado do certificado
  const [certificadoArquivo, setCertificadoArquivo] = useState<File | null>(null);
  const [certificadoSenha, setCertificadoSenha] = useState('');
  const certInputRef = useRef<HTMLInputElement>(null);

  // Estado do trigger
  const [trigger, setTrigger] = useState<ConfiguracaoTrigger>({
    frequencia: 'manual',
    horario: '08:00',
    diasSemana: [1, 2, 3, 4, 5],
    diaDoMes: 1,
  });

  // Estado do armazenamento
  const [armazenamento, setArmazenamento] = useState<ConfiguracaoArmazenamento>({
    destino: 'local',
    organizarPorCnpj: true,
    organizarPorPeriodo: true,
    pastaBase: '/xmls-capturados',
  });

  // Estado dos alertas
  const [alertas, setAlertas] = useState<ConfiguracaoAlertas>({
    emailAtivo: false,
    emailDestinatarios: [],
    teamsAtivo: false,
    teamsWebhookUrl: '',
    alertarSucesso: true,
    alertarErro: true,
    alertarSemNotas: false,
    resumoDiario: false,
  });
  const [novoEmail, setNovoEmail] = useState('');

  // Estado da exportação
  const [exportacao, setExportacao] = useState<ConfiguracaoExportacao>({
    formatoEFiscal: true,
    gerarRelatorio: true,
    incluirResumo: true,
    separadorCSV: ';',
    encodingArquivo: 'Windows-1252',
  });

  // Estado da UI
  const [activeSection, setActiveSection] = useState<ActiveSection>('cliente');
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCaptura | null>(null);
  const [viewTab, setViewTab] = useState<'config' | 'resultados'>('config');

  const cliente = clientes[clienteAtivo];

  // Handlers de cliente
  const updateCliente = (field: keyof ClienteCaptura, value: any) => {
    const next = [...clientes];
    (next[clienteAtivo] as any)[field] = value;
    setClientes(next);
  };

  const addCliente = () => {
    const novo: ClienteCaptura = {
      id: crypto.randomUUID(),
      razaoSocial: '',
      cnpj: '',
      inscricaoEstadual: '',
      uf: 'SP',
      tipoCertificado: 'A1',
      origemCertificado: 'contabilidade',
      ativo: true,
    };
    setClientes([...clientes, novo]);
    setClienteAtivo(clientes.length);
  };

  const removeCliente = (idx: number) => {
    if (clientes.length <= 1) return;
    const next = clientes.filter((_, i) => i !== idx);
    setClientes(next);
    if (clienteAtivo >= next.length) setClienteAtivo(next.length - 1);
  };

  // Handler de email
  const addEmail = () => {
    if (novoEmail && novoEmail.includes('@')) {
      setAlertas({ ...alertas, emailDestinatarios: [...alertas.emailDestinatarios, novoEmail] });
      setNovoEmail('');
    }
  };

  const removeEmail = (idx: number) => {
    setAlertas({
      ...alertas,
      emailDestinatarios: alertas.emailDestinatarios.filter((_, i) => i !== idx),
    });
  };

  // Iniciar captura
  const handleIniciarCaptura = async () => {
    if (!cliente.cnpj || !dataInicio || !dataFim) {
      setError('Preencha CNPJ, data de inicio e data de fim para iniciar a captura.');
      return;
    }

    if (cliente.origemCertificado === 'cliente' && !certificadoArquivo) {
      setError('Selecione o arquivo do certificado digital do cliente.');
      return;
    }

    setLoading(true);
    setError(null);
    setProgressStep(0);
    setProgressMessage('Iniciando captura...');

    const config: ConfiguracaoCaptura = {
      id: crypto.randomUUID(),
      cliente: {
        ...cliente,
        certificadoArquivo: certificadoArquivo || undefined,
        certificadoSenha: certificadoSenha || undefined,
      },
      periodo: { dataInicio, dataFim },
      tipoNota,
      trigger,
      armazenamento,
      alertas,
      exportacao,
      status: 'em_andamento',
    };

    try {
      const result = await XmlCaptureService.iniciarCaptura(config, (step, msg) => {
        setProgressStep(step);
        setProgressMessage(msg);
      });
      setResultado(result);
      setViewTab('resultados');
    } catch (err: any) {
      setError(err.message || 'Erro ao capturar XMLs.');
    } finally {
      setLoading(false);
    }
  };

  // Agendar captura
  const handleAgendar = async () => {
    if (!cliente.cnpj || trigger.frequencia === 'manual') {
      setError('Configure o CNPJ e uma frequencia de agendamento.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const config: ConfiguracaoCaptura = {
        id: crypto.randomUUID(),
        cliente,
        periodo: { dataInicio, dataFim },
        tipoNota,
        trigger,
        armazenamento,
        alertas,
        exportacao,
        status: 'agendada',
      };
      await XmlCaptureService.agendarCaptura(config);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao agendar captura.');
    } finally {
      setLoading(false);
    }
  };

  // Export handlers
  const handleExportEFiscal = () => {
    if (!resultado || resultado.xmls.length === 0) return;
    const content = XmlCaptureService.gerarExportacaoEFiscal(
      resultado.xmls,
      cliente.cnpj,
      cliente.inscricaoEstadual,
      exportacao.encodingArquivo
    );
    const cnpjClean = cliente.cnpj.replace(/\D/g, '');
    XmlCaptureService.downloadFile(content, `EFISCAL_${cnpjClean}_${dataInicio}_${dataFim}.txt`, 'text/plain');
  };

  const handleExportCSV = () => {
    if (!resultado || resultado.xmls.length === 0) return;
    const content = XmlCaptureService.gerarRelatorioCSV(resultado.xmls, exportacao.separadorCSV);
    const cnpjClean = cliente.cnpj.replace(/\D/g, '');
    XmlCaptureService.downloadFile(content, `XMLs_${cnpjClean}_${dataInicio}_${dataFim}.csv`, 'text/csv');
  };

  const toggleSection = (section: ActiveSection) => {
    setActiveSection(activeSection === section ? section : section);
  };

  const captureSteps = [
    'Validando certificado digital...',
    'Conectando a SEFAZ...',
    'Consultando notas de entrada...',
    'Consultando notas de saida...',
    'Baixando XMLs...',
    'Processando documentos...',
    'Armazenando arquivos...',
    'Finalizando captura...',
  ];

  // === RENDER ===
  if (loading) {
    return (
      <div className="max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="text-center mb-8">
            <Loader2 className="animate-spin text-emerald-600 mx-auto mb-4" size={48} />
            <h3 className="text-lg font-black text-slate-800">Captura de XML em Andamento</h3>
            <p className="text-sm text-slate-500 mt-1">
              Conectando a SEFAZ via certificado digital para {cliente.razaoSocial || 'o cliente'}...
            </p>
          </div>

          <div className="space-y-3">
            {captureSteps.map((step, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                idx < progressStep ? 'bg-green-50' :
                idx === progressStep ? 'bg-emerald-50 border border-emerald-200' :
                'bg-slate-50 opacity-50'
              }`}>
                {idx < progressStep ? (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                ) : idx === progressStep ? (
                  <Loader2 size={18} className="animate-spin text-emerald-600 shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                )}
                <span className={`text-sm font-medium ${
                  idx < progressStep ? 'text-green-700' :
                  idx === progressStep ? 'text-emerald-700 font-bold' :
                  'text-slate-400'
                }`}>{step}</span>
              </div>
            ))}
          </div>

          {progressMessage && (
            <p className="text-xs text-slate-500 text-center mt-4 font-medium">{progressMessage}</p>
          )}

          <div className="mt-6">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${((progressStep + 1) / captureSteps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de resultados
  if (resultado && viewTab === 'resultados') {
    const resumo = XmlCaptureService.calcularResumo(resultado.xmls, { dataInicio, dataFim });

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header de Resultados */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10">
                <FileCode2 size={24} />
              </div>
              <div>
                <h3 className="font-black text-lg">Resultado da Captura</h3>
                <p className="text-emerald-200 text-sm">
                  {cliente.razaoSocial || 'Cliente'} - CNPJ: {cliente.cnpj}
                </p>
              </div>
            </div>
            <button
              onClick={() => setViewTab('config')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors"
            >
              Nova Captura
            </button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
            <p className="text-2xl font-black text-slate-800">{resumo.totalNotas}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">Total de Notas</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
            <p className="text-2xl font-black text-blue-600">{resumo.totalEntrada}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">Notas de Entrada</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
            <p className="text-2xl font-black text-orange-600">{resumo.totalSaida}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">Notas de Saida</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(resumo.valorTotalEntrada + resumo.valorTotalSaida)}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">Valor Total</p>
          </div>
        </div>

        {/* Detalhes de Valor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-blue-700">Valor Total Entradas</span>
              <span className="text-lg font-black text-blue-800">{formatCurrency(resumo.valorTotalEntrada)}</span>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-orange-700">Valor Total Saidas</span>
              <span className="text-lg font-black text-orange-800">{formatCurrency(resumo.valorTotalSaida)}</span>
            </div>
          </div>
        </div>

        {/* Erros */}
        {resultado.erros.length > 0 && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
            <h4 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
              <AlertTriangle size={14} /> Erros durante a captura ({resultado.erros.length})
            </h4>
            <ul className="space-y-1">
              {resultado.erros.map((err, i) => (
                <li key={i} className="text-xs text-red-600">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabela de XMLs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-800">XMLs Capturados ({resultado.xmls.length})</h4>
            <div className="flex gap-2">
              <button
                onClick={handleExportEFiscal}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
              >
                <FileSpreadsheet size={12} /> Exportar E-fiscal
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
              >
                <Download size={12} /> Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Numero</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Emitente</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Destinatario</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {resultado.xmls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nenhum XML capturado no periodo selecionado.
                    </td>
                  </tr>
                ) : (
                  resultado.xmls.map((xml) => (
                    <tr key={xml.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-800">NF {xml.numero}/{xml.serie}</td>
                      <td className="px-4 py-3 text-slate-600">{xml.dataEmissao}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800 font-medium text-xs">{xml.nomeEmitente}</p>
                        <p className="text-slate-400 text-[10px]">{xml.cnpjEmitente}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800 font-medium text-xs">{xml.nomeDestinatario}</p>
                        <p className="text-slate-400 text-[10px]">{xml.cnpjDestinatario}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          xml.tipoNota === 'entrada'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-orange-50 text-orange-600'
                        }`}>
                          {xml.tipoNota === 'entrada' ? 'ENTRADA' : 'SAIDA'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(xml.valorTotal)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          xml.status === 'autorizada' ? 'bg-green-50 text-green-600' :
                          xml.status === 'cancelada' ? 'bg-red-50 text-red-600' :
                          'bg-yellow-50 text-yellow-600'
                        }`}>
                          {xml.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // === TELA DE CONFIGURAÇÃO ===
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-white/10">
            <FileCode2 size={24} />
          </div>
          <div>
            <h3 className="font-black text-lg">Captura de XML - NF-e / NFC-e</h3>
            <p className="text-emerald-200 text-sm">
              Capture XMLs dos seus clientes via SEFAZ usando certificado digital A1 ou A3.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">SEFAZ</span>
          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">NF-e</span>
          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">NFC-e</span>
          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">CT-e</span>
          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">E-fiscal</span>
        </div>
      </div>

      {/* Tabs de navegação entre clientes */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Building2 size={14} /> Clientes para Captura
          </h4>
          <button
            onClick={addCliente}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
          >
            <Plus size={12} /> Adicionar Cliente
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {clientes.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => setClienteAtivo(idx)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                clienteAtivo === idx
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Building2 size={14} />
              {c.razaoSocial || `Cliente ${idx + 1}`}
              {clientes.length > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); removeCliente(idx); }}
                  className={`ml-1 p-0.5 rounded-full hover:bg-red-500/20 ${clienteAtivo === idx ? 'text-white/60 hover:text-white' : 'text-slate-300 hover:text-red-500'}`}
                >
                  <X size={10} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* === SEÇÃO 1: DADOS DO CLIENTE === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => toggleSection('cliente')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Building2 size={14} className="text-emerald-600" /> 1. Dados do Cliente
          </h4>
          {activeSection === 'cliente' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {activeSection === 'cliente' && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Razao Social *</label>
                <input
                  type="text"
                  value={cliente.razaoSocial}
                  onChange={e => updateCliente('razaoSocial', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Nome da empresa..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">CNPJ *</label>
                <input
                  type="text"
                  value={cliente.cnpj}
                  onChange={e => updateCliente('cnpj', formatCNPJ(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Inscricao Estadual *</label>
                <input
                  type="text"
                  value={cliente.inscricaoEstadual}
                  onChange={e => updateCliente('inscricaoEstadual', e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Inscricao Estadual..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">UF *</label>
                <select
                  value={cliente.uf}
                  onChange={e => updateCliente('uf', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Origem do Certificado</label>
                <select
                  value={cliente.origemCertificado}
                  onChange={e => updateCliente('origemCertificado', e.target.value as OrigemCertificado)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="contabilidade">Certificado da Contabilidade</option>
                  <option value="cliente">Certificado do Cliente</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === SEÇÃO 2: CERTIFICADO DIGITAL === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => toggleSection('certificado')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <FileKey size={14} className="text-emerald-600" /> 2. Certificado Digital
          </h4>
          {activeSection === 'certificado' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {activeSection === 'certificado' && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Certificado</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => updateCliente('tipoCertificado', 'A1')}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                      cliente.tipoCertificado === 'A1'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Shield size={24} className={`mx-auto mb-2 ${cliente.tipoCertificado === 'A1' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <p className={`text-sm font-black ${cliente.tipoCertificado === 'A1' ? 'text-emerald-700' : 'text-slate-600'}`}>A1</p>
                    <p className="text-[10px] text-slate-400 mt-1">Arquivo digital (.pfx/.p12)</p>
                  </button>
                  <button
                    onClick={() => updateCliente('tipoCertificado', 'A3')}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                      cliente.tipoCertificado === 'A3'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <HardDrive size={24} className={`mx-auto mb-2 ${cliente.tipoCertificado === 'A3' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <p className={`text-sm font-black ${cliente.tipoCertificado === 'A3' ? 'text-emerald-700' : 'text-slate-600'}`}>A3</p>
                    <p className="text-[10px] text-slate-400 mt-1">Cartao / Token USB</p>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {cliente.tipoCertificado === 'A1' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        {cliente.origemCertificado === 'contabilidade' ? 'Certificado da Contabilidade (PFX/P12)' : 'Certificado do Cliente (PFX/P12) *'}
                      </label>
                      <div
                        className={`relative border-2 border-dashed rounded-xl p-4 transition-all flex items-center gap-3 cursor-pointer ${
                          certificadoArquivo ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:bg-slate-50'
                        }`}
                        onClick={() => certInputRef.current?.click()}
                      >
                        <input
                          ref={certInputRef}
                          type="file"
                          accept=".pfx,.p12"
                          onChange={e => setCertificadoArquivo(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        {certificadoArquivo ? (
                          <>
                            <FileKey className="text-green-500 shrink-0" size={20} />
                            <div>
                              <p className="text-sm font-bold text-green-700">{certificadoArquivo.name}</p>
                              <p className="text-[10px] text-green-500">Certificado carregado</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <FileKey className="text-slate-400 shrink-0" size={20} />
                            <div>
                              <p className="text-sm font-medium text-slate-600">Clique para selecionar</p>
                              <p className="text-[10px] text-slate-400">.pfx ou .p12</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Senha do Certificado</label>
                      <input
                        type="password"
                        value={certificadoSenha}
                        onChange={e => setCertificadoSenha(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Senha do certificado..."
                      />
                    </div>
                  </>
                )}

                {cliente.tipoCertificado === 'A3' && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-700">Certificado A3 (Cartao/Token)</p>
                        <p className="text-xs text-amber-600 mt-1">
                          Para certificados A3, o cartao ou token USB deve estar conectado ao computador que executa a captura.
                          Configure o PIN/senha nas configuracoes do driver do certificado.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === SEÇÃO 3: PERÍODO E TIPO DE NOTA === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => toggleSection('periodo')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Calendar size={14} className="text-emerald-600" /> 3. Periodo e Tipo de Nota
          </h4>
          {activeSection === 'periodo' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {activeSection === 'periodo' && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Data Inicio *</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Data Fim *</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Nota</label>
                <div className="flex gap-2">
                  {([['entrada', 'Entrada'], ['saida', 'Saida'], ['ambas', 'Ambas']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setTipoNota(value)}
                      className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        tipoNota === value
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === SEÇÃO 4: TRIGGER DE AGENDAMENTO === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => toggleSection('trigger')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Timer size={14} className="text-emerald-600" /> 4. Agendamento / Trigger
          </h4>
          {activeSection === 'trigger' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {activeSection === 'trigger' && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Frequencia de Captura</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {([
                  ['manual', 'Manual'],
                  ['diario', 'Diario'],
                  ['semanal', 'Semanal'],
                  ['mensal', 'Mensal'],
                  ['personalizado', 'Personalizado'],
                ] as [FrequenciaTrigger, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTrigger({ ...trigger, frequencia: value })}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      trigger.frequencia === value
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {trigger.frequencia !== 'manual' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Horario de Execucao</label>
                  <input
                    type="time"
                    value={trigger.horario}
                    onChange={e => setTrigger({ ...trigger, horario: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {trigger.frequencia === 'semanal' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Dias da Semana</label>
                    <div className="flex gap-1">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const dias = trigger.diasSemana || [];
                            const next = dias.includes(idx) ? dias.filter(d => d !== idx) : [...dias, idx];
                            setTrigger({ ...trigger, diasSemana: next });
                          }}
                          className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                            (trigger.diasSemana || []).includes(idx)
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-50 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {dia}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {trigger.frequencia === 'mensal' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Dia do Mes</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={trigger.diaDoMes || 1}
                      onChange={e => setTrigger({ ...trigger, diaDoMes: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                )}

                {trigger.frequencia === 'personalizado' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Expressao Cron</label>
                    <input
                      type="text"
                      value={trigger.cronExpression || ''}
                      onChange={e => setTrigger({ ...trigger, cronExpression: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="0 8 * * 1-5 (seg-sex as 8h)"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Formato: minuto hora dia mes dia_semana</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === SEÇÃO 5: ARMAZENAMENTO === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => toggleSection('armazenamento')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <FolderOpen size={14} className="text-emerald-600" /> 5. Armazenamento
          </h4>
          {activeSection === 'armazenamento' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {activeSection === 'armazenamento' && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Destino dos Arquivos</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {([
                  ['local', 'Storage Local', HardDrive, 'Armazena no servidor da aplicacao'],
                  ['sharepoint', 'SharePoint', Cloud, 'Microsoft SharePoint Online'],
                  ['onedrive', 'OneDrive', Cloud, 'Microsoft OneDrive for Business'],
                ] as [DestinoArmazenamento, string, React.ElementType, string][]).map(([value, label, Icon, desc]) => (
                  <button
                    key={value}
                    onClick={() => setArmazenamento({ ...armazenamento, destino: value })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      armazenamento.destino === value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={20} className={armazenamento.destino === value ? 'text-emerald-600' : 'text-slate-400'} />
                    <p className={`text-sm font-bold mt-2 ${armazenamento.destino === value ? 'text-emerald-700' : 'text-slate-600'}`}>{label}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {armazenamento.destino === 'sharepoint' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">URL do Site SharePoint</label>
                  <input
                    type="url"
                    value={armazenamento.sharePointSiteUrl || ''}
                    onChange={e => setArmazenamento({ ...armazenamento, sharePointSiteUrl: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="https://empresa.sharepoint.com/sites/fiscal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Biblioteca de Documentos</label>
                  <input
                    type="text"
                    value={armazenamento.sharePointLibrary || ''}
                    onChange={e => setArmazenamento({ ...armazenamento, sharePointLibrary: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Documentos Compartilhados"
                  />
                </div>
              </div>
            )}

            {armazenamento.destino === 'onedrive' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Caminho no OneDrive</label>
                <input
                  type="text"
                  value={armazenamento.oneDrivePath || ''}
                  onChange={e => setArmazenamento({ ...armazenamento, oneDrivePath: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="/XMLs Fiscais/Captura"
                />
              </div>
            )}

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={armazenamento.organizarPorCnpj}
                  onChange={e => setArmazenamento({ ...armazenamento, organizarPorCnpj: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Organizar por CNPJ
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={armazenamento.organizarPorPeriodo}
                  onChange={e => setArmazenamento({ ...armazenamento, organizarPorPeriodo: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Organizar por Periodo
              </label>
            </div>
          </div>
        )}
      </div>

      {/* === SEÇÃO 6: ALERTAS === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => toggleSection('alertas')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Bell size={14} className="text-emerald-600" /> 6. Alertas e Notificacoes
          </h4>
          {activeSection === 'alertas' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {activeSection === 'alertas' && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4">
            {/* Email */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alertas.emailAtivo}
                  onChange={e => setAlertas({ ...alertas, emailAtivo: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <Mail size={14} /> Alertas por Email
              </label>

              {alertas.emailAtivo && (
                <div className="ml-6 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={novoEmail}
                      onChange={e => setNovoEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addEmail()}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="email@empresa.com"
                    />
                    <button
                      onClick={addEmail}
                      className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {alertas.emailDestinatarios.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {alertas.emailDestinatarios.map((email, idx) => (
                        <span key={idx} className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200">
                          {email}
                          <button onClick={() => removeEmail(idx)}>
                            <X size={10} className="text-emerald-400 hover:text-red-500" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Teams */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alertas.teamsAtivo}
                  onChange={e => setAlertas({ ...alertas, teamsAtivo: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <MessageSquare size={14} /> Alertas por Microsoft Teams
              </label>

              {alertas.teamsAtivo && (
                <div className="ml-6">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Webhook URL do Teams</label>
                  <input
                    type="url"
                    value={alertas.teamsWebhookUrl || ''}
                    onChange={e => setAlertas({ ...alertas, teamsWebhookUrl: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="https://outlook.office.com/webhook/..."
                  />
                </div>
              )}
            </div>

            {/* Opções de alerta */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">Quando notificar</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['alertarSucesso', 'Captura concluida com sucesso'],
                  ['alertarErro', 'Erros durante a captura'],
                  ['alertarSemNotas', 'Nenhuma nota encontrada'],
                  ['resumoDiario', 'Resumo diario consolidado'],
                ] as [keyof ConfiguracaoAlertas, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertas[key] as boolean}
                      onChange={e => setAlertas({ ...alertas, [key]: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === SEÇÃO 7: EXPORTAÇÃO === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => toggleSection('exportacao')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-emerald-600" /> 7. Exportacao - IOB SAGE Folhamatic E-fiscal
          </h4>
          {activeSection === 'exportacao' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {activeSection === 'exportacao' && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <p className="text-sm font-bold text-emerald-700">Formato Compativel: IOB SAGE Folhamatic - Modulo E-fiscal</p>
              <p className="text-xs text-emerald-600 mt-1">
                Os dados capturados serao exportados no layout SINTEGRA/SPED para importacao direta no modulo E-fiscal,
                incluindo registros tipo 10, 50, 54, 75 e 90.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Encoding do Arquivo</label>
                <select
                  value={exportacao.encodingArquivo}
                  onChange={e => setExportacao({ ...exportacao, encodingArquivo: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Windows-1252">Windows-1252 (Recomendado)</option>
                  <option value="UTF-8">UTF-8</option>
                  <option value="ISO-8859-1">ISO-8859-1</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Separador CSV</label>
                <select
                  value={exportacao.separadorCSV}
                  onChange={e => setExportacao({ ...exportacao, separadorCSV: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value=";">Ponto e virgula (;)</option>
                  <option value=",">Virgula (,)</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportacao.formatoEFiscal}
                    onChange={e => setExportacao({ ...exportacao, formatoEFiscal: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Gerar arquivo E-fiscal automaticamente
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportacao.gerarRelatorio}
                    onChange={e => setExportacao({ ...exportacao, gerarRelatorio: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Gerar relatorio CSV
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportacao.incluirResumo}
                    onChange={e => setExportacao({ ...exportacao, incluirResumo: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Incluir resumo no relatorio
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold border border-red-100 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={onVoltar}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          Voltar
        </button>

        <div className="flex-1" />

        {trigger.frequencia !== 'manual' && (
          <button
            onClick={handleAgendar}
            disabled={loading || !cliente.cnpj}
            className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Clock size={16} /> Agendar Captura
          </button>
        )}

        <button
          onClick={handleIniciarCaptura}
          disabled={loading || !cliente.cnpj || !dataInicio || !dataFim}
          className="flex items-center gap-2 px-6 py-3 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={16} /> Iniciar Captura Agora
        </button>
      </div>
    </div>
  );
}
