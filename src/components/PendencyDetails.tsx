import React, { useState } from 'react';
import { AlertTriangle, Calendar, ChevronDown, ChevronUp, FileX, Clock, Filter, Search } from 'lucide-react';
import { FiscalIssue } from '../types/TaxParser';

interface PendencyDetailsProps {
  pendencias: FiscalIssue[];
}

type FilterType = 'Todos' | 'Declaracoes Ausentes' | 'Entregas em Atraso' | 'Debitos';

function classifyPendency(p: FiscalIssue): FilterType {
  const tipo = (p.tipo || '').toUpperCase();
  const desc = (p.descricao || '').toUpperCase();

  if (tipo.includes('DECLARACAO') || tipo.includes('DECLARAÇÃO') || desc.includes('NAO ENTREGUE') ||
    desc.includes('NÃO ENTREGUE') || desc.includes('AUSENCIA') || desc.includes('AUSÊNCIA') ||
    tipo.includes('DCTF') || tipo.includes('EFD') || tipo.includes('SPED') || tipo.includes('DEFIS') ||
    tipo.includes('ECD') || tipo.includes('ECF') || tipo.includes('DIRF') || tipo.includes('PGDAS') ||
    desc.includes('PENDENTE DE ENTREGA') || desc.includes('TRANSMISSAO PENDENTE') || desc.includes('TRANSMISSÃO PENDENTE')) {
    return 'Declaracoes Ausentes';
  }

  if (p.vencimento) {
    const venc = parseDate(p.vencimento);
    if (venc && venc < new Date()) {
      return 'Entregas em Atraso';
    }
  }

  if ((p.valor && p.valor > 0) || tipo.includes('DEBITO') || tipo.includes('DÉBITO') ||
    desc.includes('VALOR EM ABERTO') || desc.includes('SALDO DEVEDOR')) {
    return 'Debitos';
  }

  return 'Entregas em Atraso';
}

function parseDate(dateStr: string): Date | null {
  // Handles dd/mm/yyyy or yyyy-mm-dd
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function getDaysOverdue(vencimento?: string): number {
  if (!vencimento) return 0;
  const venc = parseDate(vencimento);
  if (!venc) return 0;
  const diff = Date.now() - venc.getTime();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
}

const riskBadge = (risk?: string) => {
  switch (risk) {
    case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    default: return 'bg-green-100 text-green-700 border-green-200';
  }
};

const riskLabel = (risk?: string) => {
  switch (risk) {
    case 'Critical': return 'Critico';
    case 'High': return 'Alto';
    case 'Medium': return 'Medio';
    default: return 'Baixo';
  }
};

export function PendencyDetails({ pendencias }: PendencyDetailsProps) {
  const [filter, setFilter] = useState<FilterType>('Todos');
  const [search, setSearch] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [sortByRisk, setSortByRisk] = useState(true);

  const classified = pendencias.map(p => ({ ...p, category: classifyPendency(p) }));

  const counts = {
    'Todos': classified.length,
    'Declaracoes Ausentes': classified.filter(p => p.category === 'Declaracoes Ausentes').length,
    'Entregas em Atraso': classified.filter(p => p.category === 'Entregas em Atraso').length,
    'Debitos': classified.filter(p => p.category === 'Debitos').length,
  };

  let filtered = filter === 'Todos' ? classified : classified.filter(p => p.category === filter);

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.orgao.toLowerCase().includes(s) ||
      p.tipo.toLowerCase().includes(s) ||
      p.descricao.toLowerCase().includes(s)
    );
  }

  if (sortByRisk) {
    const riskOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, undefined: 4 };
    filtered.sort((a, b) => (riskOrder[a.riskLevel || 'undefined'] || 4) - (riskOrder[b.riskLevel || 'undefined'] || 4));
  }

  const filterTabs: { key: FilterType; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'Todos', label: 'Todos', icon: Filter, color: 'text-slate-600 bg-slate-100' },
    { key: 'Declaracoes Ausentes', label: 'Declaracoes Ausentes', icon: FileX, color: 'text-orange-600 bg-orange-100' },
    { key: 'Entregas em Atraso', label: 'Entregas em Atraso', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    { key: 'Debitos', label: 'Debitos em Aberto', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-lg font-black text-slate-800 mb-4">Detalhamento de Pendencias</h3>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {filterTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? `${tab.color} shadow-sm`
                    : 'text-slate-400 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Icon size={12} />
                {tab.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/50' : 'bg-slate-200/50'}`}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-300" />
          <input
            type="text"
            placeholder="Filtrar por orgao, tipo ou descricao..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase w-8">#</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Orgao</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Tipo</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Categoria</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase cursor-pointer hover:text-slate-600"
                onClick={() => setSortByRisk(!sortByRisk)}>
                Risco {sortByRisk ? '▼' : '▲'}
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">Valor</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center">Atraso</th>
              <th className="p-4 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((p, idx) => {
              const daysOverdue = getDaysOverdue(p.vencimento);
              const isExpanded = expandedIdx === idx;

              return (
                <React.Fragment key={idx}>
                  <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                    <td className="p-4 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                        {p.orgao}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-800">{p.tipo.replace(/_/g, ' ')}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.category === 'Declaracoes Ausentes' ? 'bg-orange-100 text-orange-700' :
                        p.category === 'Entregas em Atraso' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${riskBadge(p.riskLevel)}`}>
                        {riskLabel(p.riskLevel)}
                      </span>
                    </td>
                    <td className="p-4 text-right text-sm font-black text-slate-800">
                      {p.valor && p.valor > 0 ? `R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="p-4 text-center">
                      {daysOverdue > 0 ? (
                        <span className={`text-xs font-black ${daysOverdue > 30 ? 'text-red-600' : daysOverdue > 15 ? 'text-orange-500' : 'text-yellow-500'}`}>
                          {daysOverdue}d
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Descricao</p>
                            <p className="text-slate-700">{p.descricao}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Vencimento</p>
                            <p className="text-slate-700 flex items-center gap-1">
                              <Calendar size={12} />
                              {p.vencimento || 'Nao informado'}
                              {daysOverdue > 0 && (
                                <span className="text-red-500 font-bold ml-2">({daysOverdue} dias em atraso)</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Recomendacao</p>
                            <p className="text-slate-700">
                              {p.category === 'Declaracoes Ausentes' && 'Providenciar entrega imediata da declaracao para evitar multa e bloqueio de CND.'}
                              {p.category === 'Entregas em Atraso' && 'Regularizar a entrega com urgencia. Juros e multa podem estar sendo aplicados.'}
                              {p.category === 'Debitos' && 'Avaliar possibilidade de parcelamento ou pagamento a vista com desconto.'}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center">
          <Filter size={32} className="text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm font-medium">Nenhuma pendencia encontrada com os filtros atuais.</p>
        </div>
      )}

      {/* Summary footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
        <span className="text-xs text-slate-400">
          Exibindo {filtered.length} de {pendencias.length} pendencias
        </span>
        <span className="text-xs font-bold text-slate-600">
          Total: R$ {filtered.reduce((acc, p) => acc + (p.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
