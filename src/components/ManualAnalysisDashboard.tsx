import '../styles/print.css';
import React, { useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign,
  TrendingUp, TrendingDown, FileText, Scale, ChevronDown, ChevronUp,
  Star, Info, Printer, Download, BarChart3, BookOpen, Gavel,
  ArrowRight, Calculator, Layers
} from 'lucide-react';
import { AnaliseCompleta, AnaliseItem, ParcelamentoSugestao } from '../services/aiAnalysisService';

interface ManualAnalysisDashboardProps {
  analise: AnaliseCompleta;
  nomeEmpresa: string;
  cnpj: string;
  onVoltar: () => void;
}

const riskConfig = {
  Low: { color: 'text-green-500', bg: 'bg-green-500', bgLight: 'bg-green-50', border: 'border-green-200', label: 'BAIXO' },
  Medium: { color: 'text-yellow-500', bg: 'bg-yellow-500', bgLight: 'bg-yellow-50', border: 'border-yellow-200', label: 'MEDIO' },
  High: { color: 'text-orange-500', bg: 'bg-orange-500', bgLight: 'bg-orange-50', border: 'border-orange-200', label: 'ALTO' },
  Critical: { color: 'text-red-500', bg: 'bg-red-500', bgLight: 'bg-red-50', border: 'border-red-200', label: 'CRITICO' },
};

const urgenciaConfig = {
  Critica: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  Alta: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  Media: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  Baixa: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
};

type DashTab = 'resumo' | 'debitos' | 'obrigacoes' | 'penalidades' | 'parcelamentos' | 'plano';

export function ManualAnalysisDashboard({ analise, nomeEmpresa, cnpj, onVoltar }: ManualAnalysisDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashTab>('resumo');
  const [expandedParc, setExpandedParc] = useState<number | null>(null);

  const config = riskConfig[analise.nivelRisco];
  const debitos = analise.itens.filter(i => i.categoria === 'debito');
  const obrigacoes = analise.itens.filter(i => i.categoria === 'obrigacao_ausente');
  const certidoes = analise.itens.filter(i => i.categoria === 'certidao_vencida');
  const parcelamentosAtivos = analise.itens.filter(i => i.categoria === 'parcelamento_ativo');

  const tabs: { key: DashTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'resumo', label: 'Resumo', icon: BarChart3 },
    { key: 'debitos', label: 'Debitos', icon: DollarSign, badge: debitos.length },
    { key: 'obrigacoes', label: 'Obrigacoes', icon: FileText, badge: obrigacoes.length },
    { key: 'penalidades', label: 'Penalidades', icon: Gavel, badge: obrigacoes.length },
    { key: 'parcelamentos', label: 'Parcelamentos', icon: Scale, badge: analise.sugestoesParcelamento.length },
    { key: 'plano', label: 'Plano IA', icon: BookOpen },
  ];

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 print:space-y-4">
      {/* Client Header - presentable */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl text-white print:bg-white print:text-slate-800 print:border print:border-slate-300">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-xl print:bg-slate-100">
              <Shield size={28} className="text-white print:text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold print:text-slate-500">Diagnostico Fiscal</p>
              <h2 className="text-2xl font-black tracking-tight">{nomeEmpresa}</h2>
              {cnpj && <p className="text-sm text-slate-300 print:text-slate-500">CNPJ: {cnpj}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-400 font-bold uppercase">Score</p>
              <p className={`text-3xl font-black ${config.color}`}>{analise.score}<span className="text-lg text-slate-400">/100</span></p>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${config.bgLight} ${config.color} ${config.border} border`}>
                Risco {config.label}
              </span>
            </div>

            <div className="flex flex-col gap-1 print:hidden">
              <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                <Printer size={12} /> Imprimir
              </button>
              <button onClick={onVoltar} className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                <ArrowRight size={12} className="rotate-180" /> Voltar
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <KPICard label="Pendencias" value={analise.itens.length} color="text-white" />
          <KPICard label="Valor Original" value={`R$ ${analise.totalOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-white" />
          <KPICard label="Total Atualizado" value={`R$ ${analise.totalAtualizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-red-400" />
          <KPICard label="Juros SELIC" value={`R$ ${analise.totalJuros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-yellow-400" />
          <KPICard label="Multas" value={`R$ ${analise.totalMultas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-orange-400" />
        </div>
      </div>

      {/* Date stamp */}
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-400 font-medium">
          Analise gerada em {new Date().toLocaleDateString('pt-BR')} as {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-xs text-slate-400 font-medium">
          Taxa SELIC vigente: ~13,75% a.a.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 flex gap-1 overflow-x-auto print:hidden">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'resumo' && (
          <ResumoTab analise={analise} debitos={debitos} obrigacoes={obrigacoes} certidoes={certidoes} />
        )}
        {activeTab === 'debitos' && (
          <DebitosTab debitos={debitos} />
        )}
        {activeTab === 'obrigacoes' && (
          <ObrigacoesTab obrigacoes={obrigacoes} certidoes={certidoes} />
        )}
        {activeTab === 'penalidades' && (
          <PenalidadesTab obrigacoes={obrigacoes} />
        )}
        {activeTab === 'parcelamentos' && (
          <ParcelamentosTab
            sugestoes={analise.sugestoesParcelamento}
            ativos={parcelamentosAtivos}
            totalAtualizado={analise.totalAtualizado}
            expandedParc={expandedParc}
            setExpandedParc={setExpandedParc}
          />
        )}
        {activeTab === 'plano' && (
          <PlanoIATab planoAcao={analise.planoAcao} resumoIA={analise.resumoIA} />
        )}
      </div>
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 print:bg-slate-50 print:border print:border-slate-200">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{label}</p>
      <p className={`text-lg font-black mt-0.5 ${color} print:text-slate-800`}>{value}</p>
    </div>
  );
}

// ---- RESUMO TAB ----
function ResumoTab({ analise, debitos, obrigacoes, certidoes }: {
  analise: AnaliseCompleta; debitos: AnaliseItem[]; obrigacoes: AnaliseItem[]; certidoes: AnaliseItem[];
}) {
  const urgenciaCounts = { Critica: 0, Alta: 0, Media: 0, Baixa: 0 };
  analise.itens.forEach(i => urgenciaCounts[i.urgencia]++);

  return (
    <div className="space-y-6">
      {/* Resumo IA */}
      {analise.resumoIA && (
        <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-indigo-600" />
            <h4 className="text-sm font-black text-indigo-800">Resumo da Analise</h4>
          </div>
          <p className="text-sm text-indigo-700 whitespace-pre-line">{analise.resumoIA}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição por urgência */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Distribuicao por Urgencia</h4>
          <div className="space-y-3">
            {(Object.entries(urgenciaCounts) as [keyof typeof urgenciaConfig, number][]).map(([key, count]) => {
              const cfg = urgenciaConfig[key];
              const pct = analise.itens.length > 0 ? (count / analise.itens.length) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-bold ${cfg.text}`}>{key}</span>
                    <span className="text-xs font-black text-slate-600">{count}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${cfg.bg.replace('bg-', 'bg-').replace('-50', '-500')} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%`, backgroundColor: key === 'Critica' ? '#ef4444' : key === 'Alta' ? '#f97316' : key === 'Media' ? '#eab308' : '#22c55e' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Composição dos valores */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Composicao dos Valores</h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Principal</span>
              <span className="text-sm font-black text-slate-800">R$ {analise.totalOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">+ Juros SELIC</span>
              <span className="text-sm font-black text-yellow-600">R$ {analise.totalJuros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">+ Multas</span>
              <span className="text-sm font-black text-orange-600">R$ {analise.totalMultas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-700">Total Atualizado</span>
              <span className="text-lg font-black text-red-600">R$ {analise.totalAtualizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            {analise.totalOriginal > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-500 justify-end">
                <TrendingUp size={12} />
                <span className="font-bold">
                  +{(((analise.totalAtualizado - analise.totalOriginal) / analise.totalOriginal) * 100).toFixed(1)}% de acrescimo
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Categorias */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Por Categoria</h4>
          <div className="space-y-3">
            <CategoryRow label="Debitos em Aberto" count={debitos.length} color="bg-red-500" />
            <CategoryRow label="Obrigacoes Ausentes" count={obrigacoes.length} color="bg-orange-500" />
            <CategoryRow label="Certidoes Irregulares" count={certidoes.length} color="bg-yellow-500" />
            <CategoryRow label="Parcelamentos Ativos" count={analise.parcelamentosAtuais.length} color="bg-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-sm font-black text-slate-800">{count}</span>
    </div>
  );
}

// ---- DEBITOS TAB ----
function DebitosTab({ debitos }: { debitos: AnaliseItem[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (debitos.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 p-8 rounded-2xl text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-black text-green-800">Sem Debitos Identificados</h3>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <DollarSign size={16} /> Debitos Atualizados pela SELIC
        </h4>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Calculator size={10} /> Calculo ate {new Date().toLocaleDateString('pt-BR')}
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {debitos.map((item, idx) => {
          const isExp = expanded === idx;
          const p = item.pendencia;
          const sel = item.selicCalculo;
          const cfg = urgenciaConfig[item.urgencia];

          return (
            <div key={idx}>
              <div className="p-4 hover:bg-slate-50/50 transition-colors cursor-pointer flex items-center gap-4"
                onClick={() => setExpanded(isExp ? null : idx)}>
                <div className={`w-2 h-12 rounded-full ${cfg.bg.replace('bg-', 'bg-').replace('-50', '-500')}`}
                  style={{ backgroundColor: item.urgencia === 'Critica' ? '#ef4444' : item.urgencia === 'Alta' ? '#f97316' : item.urgencia === 'Media' ? '#eab308' : '#22c55e' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${cfg.badge}`}>{item.urgencia}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{p.orgao}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{p.tipo}</p>
                  <p className="text-xs text-slate-500 truncate">{p.descricao}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">Original</p>
                  <p className="text-sm text-slate-500">R$ {(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  {sel && sel.valorAtualizado > (p.valor || 0) && (
                    <>
                      <p className="text-xs text-red-400 mt-1">Atualizado</p>
                      <p className="text-sm font-black text-red-600">R$ {sel.valorAtualizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </>
                  )}
                </div>
                {isExp ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </div>

              {isExp && sel && (
                <div className="px-4 pb-4">
                  <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Dias em Atraso</p>
                      <p className="text-lg font-black text-slate-800">{sel.diasAtraso}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Juros SELIC</p>
                      <p className="text-lg font-black text-yellow-600">R$ {sel.jurosAcumulados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Multa Mora</p>
                      <p className="text-lg font-black text-orange-600">R$ {sel.multaMora.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">SELIC Acumulada</p>
                      <p className="text-lg font-black text-blue-600">{(sel.selicAcumulada * 100).toFixed(2)}%</p>
                    </div>
                  </div>

                  {sel.detalhamentoMensal.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-700">
                        Ver detalhamento mensal ({sel.detalhamentoMensal.length} meses)
                      </summary>
                      <div className="mt-2 overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-slate-100">
                              <th className="p-2 font-bold text-slate-400">Mes</th>
                              <th className="p-2 font-bold text-slate-400 text-right">Taxa</th>
                              <th className="p-2 font-bold text-slate-400 text-right">Juros</th>
                              <th className="p-2 font-bold text-slate-400 text-right">Saldo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {sel.detalhamentoMensal.map((m, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{m.mes}</td>
                                <td className="p-2 text-right text-slate-500">{(m.taxa * 100).toFixed(2)}%</td>
                                <td className="p-2 text-right text-yellow-600">R$ {m.jurosNoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 text-right font-bold text-slate-800">R$ {m.saldoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- OBRIGACOES TAB ----
function ObrigacoesTab({ obrigacoes, certidoes }: { obrigacoes: AnaliseItem[]; certidoes: AnaliseItem[] }) {
  if (obrigacoes.length === 0 && certidoes.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 p-8 rounded-2xl text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-black text-green-800">Todas as Obrigacoes em Dia</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {obrigacoes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-orange-50">
            <h4 className="text-sm font-bold text-orange-700 flex items-center gap-2">
              <FileText size={16} /> Obrigacoes Acessorias Nao Entregues ({obrigacoes.length})
            </h4>
          </div>
          <div className="divide-y divide-slate-50">
            {obrigacoes.map((item, idx) => (
              <div key={idx} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle size={14} className="text-red-500" />
                      <span className="text-sm font-bold text-slate-800">{item.pendencia.tipo}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{item.pendencia.orgao}</span>
                    </div>
                    <p className="text-xs text-slate-500 ml-6">{item.pendencia.descricao}</p>
                    {item.pendencia.vencimento && (
                      <p className="text-xs text-red-500 font-bold ml-6 mt-1 flex items-center gap-1">
                        <Clock size={10} /> Prazo: {new Date(item.pendencia.vencimento).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${urgenciaConfig[item.urgencia].badge}`}>
                    {item.urgencia}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {certidoes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-yellow-50">
            <h4 className="text-sm font-bold text-yellow-700 flex items-center gap-2">
              <Shield size={16} /> Certidoes Irregulares ({certidoes.length})
            </h4>
          </div>
          <div className="divide-y divide-slate-50">
            {certidoes.map((item, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-yellow-500" />
                  <span className="text-sm font-bold text-slate-800">{item.pendencia.tipo}</span>
                  <span className="text-xs text-slate-400">({item.pendencia.orgao})</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700">{item.pendencia.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- PENALIDADES TAB ----
function PenalidadesTab({ obrigacoes }: { obrigacoes: AnaliseItem[] }) {
  if (obrigacoes.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 p-8 rounded-2xl text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-black text-green-800">Sem Penalidades Aplicaveis</h3>
      </div>
    );
  }

  const totalMultas = obrigacoes.reduce((acc, i) => acc + (i.multaObrigacao?.multa || 0), 0);

  return (
    <div className="space-y-6">
      {/* Total */}
      <div className="bg-red-50 border border-red-200 p-5 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gavel size={24} className="text-red-600" />
          <div>
            <h4 className="text-sm font-black text-red-800">Total Estimado em Multas por Atraso</h4>
            <p className="text-xs text-red-600">Multas por nao entrega de obrigacoes acessorias</p>
          </div>
        </div>
        <span className="text-2xl font-black text-red-700">
          R$ {totalMultas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Detalhamento */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h4 className="text-sm font-bold text-slate-600">Detalhamento de Penalidades por Obrigacao</h4>
        </div>
        <div className="divide-y divide-slate-50">
          {obrigacoes.map((item, idx) => (
            <div key={idx} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Gavel size={14} className="text-red-500" />
                    {item.pendencia.tipo}
                    <span className="text-xs text-slate-400 font-normal">({item.pendencia.orgao})</span>
                  </h5>
                </div>
                <span className="text-sm font-black text-red-600">
                  R$ {(item.multaObrigacao?.multa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Scale size={12} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-600">Fundamentacao Legal</p>
                    <p className="text-xs text-slate-500">{item.multaObrigacao?.fundamentoLegal || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Info size={12} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-600">Descricao da Penalidade</p>
                    <p className="text-xs text-slate-500">{item.multaObrigacao?.descricao || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Valores estimados com base na legislacao vigente. Multas podem variar conforme regime tributario (Simples Nacional, Lucro Presumido ou Lucro Real) e
          eventuais reducoes por entrega espontanea antes de procedimento fiscal. Consultar DARF atualizado para valor exato.
        </p>
      </div>
    </div>
  );
}

// ---- PARCELAMENTOS TAB ----
function ParcelamentosTab({ sugestoes, ativos, totalAtualizado, expandedParc, setExpandedParc }: {
  sugestoes: ParcelamentoSugestao[]; ativos: AnaliseItem[]; totalAtualizado: number;
  expandedParc: number | null; setExpandedParc: (v: number | null) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Parcelamentos ativos */}
      {ativos.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-blue-50">
            <h4 className="text-sm font-bold text-blue-700 flex items-center gap-2">
              <Layers size={16} /> Parcelamentos Ativos Informados ({ativos.length})
            </h4>
          </div>
          <div className="divide-y divide-slate-50">
            {ativos.map((item, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.pendencia.tipo}</p>
                  <p className="text-xs text-slate-500">{item.pendencia.descricao}</p>
                  {item.pendencia.parcelamentoLei && (
                    <p className="text-xs text-blue-600 font-medium mt-1">{item.pendencia.parcelamentoLei}</p>
                  )}
                </div>
                <div className="text-right">
                  {item.pendencia.parcelamentoParcelas && item.pendencia.parcelamentoValorParcela && (
                    <p className="text-sm font-black text-slate-800">
                      {item.pendencia.parcelamentoParcelas}x R$ {item.pendencia.parcelamentoValorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    Total: R$ {(item.pendencia.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sugestões */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-indigo-50">
          <h4 className="text-sm font-bold text-indigo-700 flex items-center gap-2">
            <Scale size={16} /> Opcoes de Parcelamento Disponiveis
          </h4>
          <p className="text-xs text-indigo-500 mt-1">
            Simulacao com base no total atualizado de R$ {totalAtualizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="divide-y divide-slate-50">
          {sugestoes.map((s, idx) => {
            const isExp = expandedParc === idx;
            return (
              <div key={idx} className={`${s.maisVantajoso ? 'bg-green-50/50' : ''}`}>
                <div className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedParc(isExp ? null : idx)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {s.maisVantajoso && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-full flex items-center gap-1">
                          <Star size={10} /> MAIS VANTAJOSO
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-800">{s.nome}</p>
                        <p className="text-[10px] text-slate-400">{s.lei}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-800">{s.parcelas}x R$ {s.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        {s.economiaTotal > 0 && (
                          <p className="text-[10px] font-bold text-green-600">
                            Economia: R$ {s.economiaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      {isExp ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </div>
                </div>

                {isExp && (
                  <div className="px-4 pb-4">
                    <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Entrada</p>
                        <p className="text-sm font-black text-slate-800">R$ {s.valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Desc. Multa</p>
                        <p className="text-sm font-black text-green-600">{s.descontoMulta}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Desc. Juros</p>
                        <p className="text-sm font-black text-green-600">{s.descontoJuros}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Valor c/ Desconto</p>
                        <p className="text-sm font-black text-blue-600">R$ {s.valorComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">{s.observacao}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Simulacoes baseadas na legislacao vigente. Valores e condicoes podem variar conforme enquadramento tributario, capacidade de pagamento e editais vigentes.
          Recomenda-se consultar o portal REGULARIZE (PGFN) e e-CAC (RFB) para condicoes atualizadas.
        </p>
      </div>
    </div>
  );
}

// ---- PLANO IA TAB ----
function PlanoIATab({ planoAcao, resumoIA }: { planoAcao: string; resumoIA: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-indigo-50">
          <h4 className="text-sm font-bold text-indigo-700 flex items-center gap-2">
            <BookOpen size={16} /> Plano de Acao Gerado pela IA
          </h4>
        </div>
        <div className="p-6 prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-800">
          <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(planoAcao) }} />
        </div>
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/### (.*)/g, '<h3 class="text-lg font-black text-slate-800 mt-6 mb-2">$1</h3>')
    .replace(/## (.*)/g, '<h2 class="text-xl font-black text-slate-800 mt-8 mb-3">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.*)/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
