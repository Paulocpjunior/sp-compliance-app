import React, { useState, useCallback } from 'react';
import { Upload, FileKey, Loader2, Shield, Building2, ChevronRight, BarChart3, FileText, AlertTriangle, Target, DollarSign, RotateCcw } from 'lucide-react';
import { CertificateParser } from './services/certificateParser';
import { ComplianceDashboard } from './components/ComplianceDashboard';
import { PendencyDetails } from './components/PendencyDetails';
import { CNDPanel } from './components/CNDPanel';
import { OutstandingAmounts } from './components/OutstandingAmounts';
import { ActionPlan } from './components/ActionPlan';
import { RiskEngine } from './services/RiskEngine';
import { ParsedCertificate } from './types';
import { FiscalIssue } from './types/TaxParser';

interface CND {
  orgao: string;
  nome: string;
  status: string;
  arquivoBase64?: string;
}

interface AuditData {
  status: string;
  clienteRegular: boolean;
  pendencias: FiscalIssue[];
  certidoes: CND[];
  score: number;
  nivelRisco: 'Low' | 'Medium' | 'High' | 'Critical';
  declaracoesAusentes: number;
  entregasAtraso: number;
  valorTotalAberto: number;
}

type TabKey = 'dashboard' | 'pendencias' | 'cnds' | 'valores' | 'plano';

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Visao Geral', icon: BarChart3 },
  { key: 'pendencias', label: 'Pendencias', icon: AlertTriangle },
  { key: 'cnds', label: 'Certidoes', icon: FileText },
  { key: 'valores', label: 'Valores', icon: DollarSign },
  { key: 'plano', label: 'Plano de Acao', icon: Target },
];

const API_URL = import.meta.env.VITE_API_URL || 'https://api-sp-compliance-68935026677.southamerica-east1.run.app';

const steps = [
  { label: 'Validando certificado A1...' },
  { label: 'Varrendo e-CAC e PGFN (Receita Federal)...' },
  { label: 'e-CAC concluido.' },
  { label: 'PGFN concluido.' },
  { label: 'Varrendo e-Social e Prefeitura Municipal...' },
  { label: 'e-Social concluido.' },
  { label: 'Municipal concluido.' },
  { label: 'Verificando certidoes (CNDs)...' },
  { label: 'Calculando nivel de risco...' },
];

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function classifyPendency(p: FiscalIssue): 'ausente' | 'atraso' | 'debito' {
  const tipo = (p.tipo || '').toUpperCase();
  const desc = (p.descricao || '').toUpperCase();
  if (tipo.includes('DECLARACAO') || tipo.includes('DCTF') || tipo.includes('EFD') ||
    tipo.includes('SPED') || tipo.includes('DEFIS') || tipo.includes('ECD') || tipo.includes('ECF') ||
    tipo.includes('DIRF') || tipo.includes('PGDAS') || desc.includes('NAO ENTREGUE') ||
    desc.includes('AUSENCIA') || desc.includes('PENDENTE DE ENTREGA') || desc.includes('TRANSMISSAO PENDENTE')) {
    return 'ausente';
  }
  if (p.vencimento) {
    const parts = p.vencimento.split('/');
    if (parts.length === 3) {
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      if (d < new Date()) return 'atraso';
    }
  }
  return 'debito';
}

export default function App() {
  const [certificate, setCertificate] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [certInfo, setCertInfo] = useState<ParsedCertificate | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [currentStep, setCurrentStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCertificate(e.target.files[0]);
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.pfx') || file.name.endsWith('.p12'))) {
      setCertificate(file);
      setError(null);
    } else {
      setError('Arquivo invalido. Selecione um certificado .pfx ou .p12');
    }
  }, []);

  const handleUpload = async () => {
    if (!certificate || !password) {
      setError('Selecione um certificado e insira a senha.');
      return;
    }

    setLoading(true);
    setError(null);
    setAuditData(null);
    setCertInfo(null);
    setCurrentStep(0);

    try {
      // Step 1: Parse certificate locally
      const buffer = await certificate.arrayBuffer();
      let parsed: ParsedCertificate;
      try {
        parsed = CertificateParser.parse(buffer, password);
        setCertInfo(parsed);
      } catch (parseErr: any) {
        setError(`Erro ao validar certificado: ${parseErr.message}`);
        setLoading(false);
        return;
      }

      if (!parsed.validity.isValid) {
        setError(`Certificado expirado em ${parsed.validity.notAfter.toLocaleDateString('pt-BR')}. Renove o certificado A1.`);
        setLoading(false);
        return;
      }

      if (!parsed.isICPBrasil) {
        setError('Este certificado nao e ICP-Brasil. Utilize um certificado digital A1 valido.');
        setLoading(false);
        return;
      }

      // Step 2: Send to backend for government scanning (progress via SSE)
      const formData = new FormData();
      formData.append('certificate', certificate);
      formData.append('password', password);
      if (parsed.cnpj) {
        formData.append('cnpj', parsed.cnpj);
      }

      // SSE streaming fetch with retry logic
      const MAX_RETRIES = 2;
      let lastError: Error | null = null;
      let data: any = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 280000);

        try {
          const response = await fetch(`${API_URL}/api/v1/auditoria-completa`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok || !response.body) {
            throw new Error('Erro na comunicacao com os orgaos fiscais. Verifique sua conexao e tente novamente.');
          }

          // Read SSE stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                const payload = JSON.parse(line.slice(6));
                if (currentEvent === 'progress' && typeof payload.step === 'number') {
                  setCurrentStep(payload.step);
                } else if (currentEvent === 'result') {
                  data = payload;
                } else if (currentEvent === 'error') {
                  throw new Error(payload.details || payload.error || 'Erro no servidor.');
                }
              }
            }
          }

          if (!data) {
            throw new Error('Servidor encerrou sem retornar resultado.');
          }
          break; // Success
        } catch (err: any) {
          lastError = err;
          const isNetworkError = err.name === 'TypeError' ||
            err.message?.includes('Failed to fetch') ||
            err.message?.includes('NetworkError') ||
            err.message?.includes('network') ||
            err.message?.includes('conexão') ||
            err.message?.includes('perdida') ||
            err.message?.includes('Load failed');
          if (!isNetworkError || attempt === MAX_RETRIES) {
            throw err;
          }
        }
      }

      if (!data) {
        throw lastError || new Error('Falha na conexao com o servidor.');
      }
      const pendencias: FiscalIssue[] = data.pendencias || [];

      // Calculate risk score
      const obligations = pendencias.map(p => ({
        tipo: p.tipo,
        status: 'Pendente' as const,
        diasAtraso: p.vencimento ? Math.max(0, Math.ceil((Date.now() - new Date(p.vencimento.split('/').reverse().join('-')).getTime()) / (1000 * 60 * 60 * 24))) : 0,
      }));

      const riskResult = RiskEngine.analyzeObligations(obligations, 'Lucro Presumido');

      const declaracoesAusentes = pendencias.filter(p => classifyPendency(p) === 'ausente').length;
      const entregasAtraso = pendencias.filter(p => classifyPendency(p) === 'atraso').length;
      const valorTotalAberto = pendencias.reduce((acc, p) => acc + (p.valor || 0), 0);

      setAuditData({
        status: data.status,
        clienteRegular: data.clienteRegular,
        pendencias,
        certidoes: data.certidoes || [],
        score: riskResult.score,
        nivelRisco: riskResult.nivelRisco,
        declaracoesAusentes,
        entregasAtraso,
        valorTotalAberto,
      });

      setActiveTab('dashboard');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('A auditoria excedeu o tempo limite. O servidor pode estar sobrecarregado. Tente novamente em alguns minutos.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('network') || err.message?.includes('conexão') || err.message?.includes('perdida') || err.message?.includes('Load failed')) {
        setError('Falha na conexao com o servidor. A conexao foi perdida durante a auditoria. Isso pode ocorrer quando o servidor esta processando muitas requisicoes. Tente novamente em alguns minutos.');
      } else {
        setError(err.message || 'Erro inesperado durante a auditoria.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCertificate(null);
    setPassword('');
    setAuditData(null);
    setCertInfo(null);
    setError(null);
    setCurrentStep(0);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">SP Assessoria Contabil</h1>
              <p className="text-xs text-slate-400 font-medium">Motor de Diagnostico Fiscal Automatizado</p>
            </div>
          </div>
          {auditData && (
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              <RotateCcw size={14} /> Nova Auditoria
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Upload Screen */}
        {!auditData && !loading && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Auditoria Tributaria</h2>
              <p className="text-slate-500 mt-2">Importe o certificado digital A1 para iniciar a varredura nos orgaos governamentais.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">1. Certificado Digital A1 (PFX/P12)</label>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center cursor-pointer ${
                    dragOver ? 'border-blue-500 bg-blue-50' : certificate ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:bg-slate-50'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {certificate ? (
                    <>
                      <FileKey className="text-green-500 mb-2" size={36} />
                      <span className="text-sm font-bold text-green-700">{certificate.name}</span>
                      <span className="text-xs text-green-500 mt-1">Certificado carregado</span>
                    </>
                  ) : (
                    <>
                      <Upload className="text-blue-500 mb-2" size={36} />
                      <span className="text-sm font-bold text-slate-600">Arraste o arquivo ou clique para selecionar</span>
                      <span className="text-xs text-slate-400 mt-1">Formatos aceitos: .pfx, .p12</span>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-bold text-slate-700 mb-2">2. Senha do Certificado</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUpload()}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                    placeholder="Digite a senha..."
                  />
                  <FileKey className="absolute left-3 top-3.5 text-slate-400" size={20} />
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold border border-red-100 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!certificate || !password}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Shield size={18} className="mr-2" /> Iniciar Auditoria Tributaria
              </button>

              <div className="mt-6 space-y-2">
                <p className="text-center text-xs text-slate-400 font-medium">
                  Varredura automatica em: e-CAC, PGFN, SEFAZ, Prefeituras, eSocial
                </p>
                <div className="flex justify-center gap-4 text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                  <span>Receita Federal</span>
                  <span>-</span>
                  <span>PGFN</span>
                  <span>-</span>
                  <span>Prefeitura</span>
                  <span>-</span>
                  <span>SEFAZ</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading / Progress Screen */}
        {loading && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="text-center mb-8">
                <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
                <h3 className="text-lg font-black text-slate-800">Auditoria em Andamento</h3>
                <p className="text-sm text-slate-500 mt-1">Conectando aos orgaos governamentais via certificado digital...</p>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                    idx < currentStep ? 'bg-green-50' :
                    idx === currentStep ? 'bg-blue-50 border border-blue-200' :
                    'bg-slate-50 opacity-50'
                  }`}>
                    {idx < currentStep ? (
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : idx === currentStep ? (
                      <Loader2 size={18} className="animate-spin text-blue-600 shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${
                      idx < currentStep ? 'text-green-700' :
                      idx === currentStep ? 'text-blue-700 font-bold' :
                      'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 text-center mt-2 font-medium">
                  {currentStep + 1} de {steps.length} etapas
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Screen */}
        {auditData && !loading && (
          <div className="space-y-6">
            {/* Company Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 p-3 rounded-xl">
                  <Building2 className="text-slate-600" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                    {certInfo?.subject.CN?.split(':')[0] || certInfo?.subject.O || 'Empresa Auditada'}
                  </h2>
                  <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                    <span className="font-bold">CNPJ: {certInfo?.cnpj ? formatCNPJ(certInfo.cnpj) : 'Nao identificado'}</span>
                    <span className="text-slate-300">|</span>
                    <span className={`font-bold ${certInfo?.validity.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      Certificado A1 {certInfo?.validity.isValid ? 'Valido' : 'Expirado'}
                    </span>
                    {certInfo?.validity.daysRemaining !== undefined && certInfo.validity.daysRemaining > 0 && certInfo.validity.daysRemaining <= 30 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="text-orange-500 font-bold">Expira em {certInfo.validity.daysRemaining} dias</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className={`px-4 py-2 rounded-full font-black text-sm flex items-center gap-2 ${
                auditData.clienteRegular ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {auditData.clienteRegular ? (
                  <><Shield size={16} /> REGULAR</>
                ) : (
                  <><AlertTriangle size={16} /> IRREGULARIDADES DETECTADAS</>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 flex gap-1 overflow-x-auto">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                let badge = 0;
                if (tab.key === 'pendencias') badge = auditData.pendencias.length;
                if (tab.key === 'cnds') badge = auditData.certidoes.length;
                if (tab.key === 'valores') badge = auditData.pendencias.filter(p => p.valor && p.valor > 0).length;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                    {badge > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'dashboard' && (
                <ComplianceDashboard
                  score={auditData.score}
                  nivelRisco={auditData.nivelRisco}
                  pendencias={auditData.pendencias}
                  certidoes={auditData.certidoes}
                  declaracoesAusentes={auditData.declaracoesAusentes}
                  entregasAtraso={auditData.entregasAtraso}
                  valorTotalAberto={auditData.valorTotalAberto}
                />
              )}

              {activeTab === 'pendencias' && (
                <PendencyDetails pendencias={auditData.pendencias} />
              )}

              {activeTab === 'cnds' && (
                <CNDPanel
                  certidoes={auditData.certidoes}
                  cnpj={certInfo?.cnpj || ''}
                />
              )}

              {activeTab === 'valores' && (
                <OutstandingAmounts pendencias={auditData.pendencias} />
              )}

              {activeTab === 'plano' && (
                <ActionPlan
                  pendencias={auditData.pendencias}
                  nivelRisco={auditData.nivelRisco}
                  score={auditData.score}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12 py-6 text-center">
        <p className="text-xs text-slate-400 font-medium">
          SP Assessoria Contabil - Conexao M2M segura via certificado digital A1 ICP-Brasil
        </p>
      </footer>
    </div>
  );
}
