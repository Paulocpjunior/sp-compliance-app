import React from 'react';
import { Shield, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { TaxReformNews } from './TaxReformNews';

interface DashboardProps {
  score: number;
  nivelRisco: 'Low' | 'Medium' | 'High' | 'Critical';
  pendencias: Array<{
    orgao: string;
    tipo: string;
    descricao: string;
    valor?: number;
    vencimento?: string;
    riskLevel?: string;
  }>;
  certidoes: Array<{
    orgao: string;
    nome: string;
    status: string;
  }>;
  declaracoesAusentes: number;
  entregasAtraso: number;
  valorTotalAberto: number;
}

const riskConfig = {
  Low: { color: 'text-green-500', bg: 'bg-green-500', bgLight: 'bg-green-50', border: 'border-green-200', label: 'BAIXO', icon: CheckCircle },
  Medium: { color: 'text-yellow-500', bg: 'bg-yellow-500', bgLight: 'bg-yellow-50', border: 'border-yellow-200', label: 'MEDIO', icon: Clock },
  High: { color: 'text-orange-500', bg: 'bg-orange-500', bgLight: 'bg-orange-50', border: 'border-orange-200', label: 'ALTO', icon: AlertTriangle },
  Critical: { color: 'text-red-500', bg: 'bg-red-500', bgLight: 'bg-red-50', border: 'border-red-200', label: 'CRITICO', icon: XCircle },
};

function RiskGauge({ score, nivelRisco }: { score: number; nivelRisco: 'Low' | 'Medium' | 'High' | 'Critical' }) {
  const config = riskConfig[nivelRisco];
  const rotation = ((100 - score) / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Gauge background */}
        <div className="absolute w-48 h-48 rounded-full border-[16px] border-slate-100" style={{ top: 0 }} />
        {/* Gauge colored sections */}
        <svg className="absolute top-0 left-0 w-48 h-48" viewBox="0 0 192 192">
          <circle cx="96" cy="96" r="80" fill="none" stroke="#22c55e" strokeWidth="16"
            strokeDasharray="125.6 376.8" strokeDashoffset="0"
            transform="rotate(180 96 96)" opacity="0.3" />
          <circle cx="96" cy="96" r="80" fill="none" stroke="#eab308" strokeWidth="16"
            strokeDasharray="125.6 376.8" strokeDashoffset="-125.6"
            transform="rotate(180 96 96)" opacity="0.3" />
          <circle cx="96" cy="96" r="80" fill="none" stroke="#f97316" strokeWidth="16"
            strokeDasharray="62.8 439.6" strokeDashoffset="-251.2"
            transform="rotate(180 96 96)" opacity="0.3" />
          <circle cx="96" cy="96" r="80" fill="none" stroke="#ef4444" strokeWidth="16"
            strokeDasharray="62.8 439.6" strokeDashoffset="-314"
            transform="rotate(180 96 96)" opacity="0.3" />
        </svg>
        {/* Needle */}
        <div className="absolute bottom-0 left-1/2 w-1 h-20 origin-bottom rounded-full bg-slate-800 transition-transform duration-1000"
          style={{ transform: `translateX(-50%) rotate(${rotation - 90}deg)` }} />
        <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-slate-800" />
      </div>
      <div className="mt-4 text-center">
        <span className={`text-4xl font-black ${config.color}`}>{score}</span>
        <span className="text-slate-400 text-lg font-medium">/100</span>
      </div>
      <span className={`mt-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${config.bgLight} ${config.color} ${config.border} border`}>
        Risco {config.label}
      </span>
    </div>
  );
}

function PendencyPieChart({ pendencias }: { pendencias: DashboardProps['pendencias'] }) {
  const categorias: Record<string, { count: number; color: string }> = {};

  pendencias.forEach(p => {
    const orgao = p.orgao || 'Outros';
    if (!categorias[orgao]) {
      categorias[orgao] = { count: 0, color: '' };
    }
    categorias[orgao].count++;
  });

  const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
  const entries = Object.entries(categorias);
  entries.forEach(([, val], i) => {
    val.color = colors[i % colors.length];
  });

  const total = pendencias.length || 1;
  let currentOffset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 36 36" className="w-32 h-32">
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
        {entries.map(([, val], i) => {
          const pct = (val.count / total) * 100;
          const dasharray = `${pct} ${100 - pct}`;
          const el = (
            <circle key={i} cx="18" cy="18" r="15.915" fill="none" stroke={val.color} strokeWidth="3"
              strokeDasharray={dasharray} strokeDashoffset={-currentOffset}
              transform="rotate(-90 18 18)" className="transition-all duration-700" />
          );
          currentOffset += pct;
          return el;
        })}
        <text x="18" y="18" textAnchor="middle" dy=".1em" className="fill-slate-800 text-[5px] font-bold">
          {total}
        </text>
        <text x="18" y="22" textAnchor="middle" className="fill-slate-400 text-[2.5px]">
          itens
        </text>
      </svg>
      <div className="space-y-2">
        {entries.map(([key, val], i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.color }} />
            <span className="text-slate-600 font-medium">{key}</span>
            <span className="text-slate-400 font-bold">({val.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className={`p-2 rounded-xl bg-slate-50`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

function RiskDistributionBar({ pendencias }: { pendencias: DashboardProps['pendencias'] }) {
  const levels = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  pendencias.forEach(p => {
    const level = (p.riskLevel as keyof typeof levels) || 'Medium';
    if (levels[level] !== undefined) levels[level]++;
  });

  const total = pendencias.length || 1;
  const barColors = { Critical: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-yellow-400', Low: 'bg-green-400' };
  const labels = { Critical: 'Critico', High: 'Alto', Medium: 'Medio', Low: 'Baixo' };

  return (
    <div>
      <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
        {(Object.keys(levels) as Array<keyof typeof levels>).map(level => {
          const pct = (levels[level] / total) * 100;
          if (pct === 0) return null;
          return (
            <div key={level} className={`${barColors[level]} transition-all duration-700`}
              style={{ width: `${pct}%` }} title={`${labels[level]}: ${levels[level]}`} />
          );
        })}
      </div>
      <div className="flex justify-between mt-3">
        {(Object.keys(levels) as Array<keyof typeof levels>).map(level => (
          <div key={level} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${barColors[level]}`} />
            <span className="text-slate-500 font-medium">{labels[level]}: <span className="font-bold text-slate-700">{levels[level]}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComplianceDashboard({
  score, nivelRisco, pendencias, certidoes,
  declaracoesAusentes, entregasAtraso, valorTotalAberto
}: DashboardProps) {
  const cndEmitidas = certidoes.filter(c => c.status === 'EMITIDA' || c.status === 'Emitida').length;
  const cndTotal = certidoes.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Pendencias"
          value={pendencias.length}
          subtitle="Irregularidades detectadas"
          icon={AlertTriangle}
          color="text-red-600"
        />
        <StatCard
          title="Declaracoes Ausentes"
          value={declaracoesAusentes}
          subtitle="Nao entregues aos orgaos"
          icon={XCircle}
          color="text-orange-600"
        />
        <StatCard
          title="Entregas em Atraso"
          value={entregasAtraso}
          subtitle="Prazo expirado"
          icon={Clock}
          color="text-yellow-600"
        />
        <StatCard
          title="Valores em Aberto"
          value={`R$ ${valorTotalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Total de debitos"
          icon={TrendingDown}
          color="text-red-600"
        />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Gauge */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Score de Compliance</h3>
          <RiskGauge score={score} nivelRisco={nivelRisco} />
        </div>

        {/* Pendency Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Pendencias por Orgao</h3>
          {pendencias.length > 0 ? (
            <PendencyPieChart pendencias={pendencias} />
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-green-500">
              <CheckCircle size={40} />
              <p className="mt-2 font-bold text-sm">Nenhuma pendencia</p>
            </div>
          )}
        </div>

        {/* CND Status Overview */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Status das CNDs</h3>
          <div className="space-y-3">
            {certidoes.length > 0 ? (
              certidoes.map((cnd, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2">
                    {cnd.status === 'EMITIDA' || cnd.status === 'Emitida' ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <XCircle size={16} className="text-red-500" />
                    )}
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]">{cnd.orgao}</span>
                  </div>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                    cnd.status === 'EMITIDA' || cnd.status === 'Emitida'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {cnd.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Shield size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Aguardando varredura</p>
              </div>
            )}
          </div>
          {certidoes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
              <span className="text-xs font-bold text-slate-400">
                {cndEmitidas}/{cndTotal} emitidas com sucesso
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Risk Distribution Bar */}
      {pendencias.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Distribuicao de Risco</h3>
          <RiskDistributionBar pendencias={pendencias} />
        </div>
      )}

      {/* Tax Reform News */}
      <TaxReformNews refreshKey={0} />
    </div>
  );
}
