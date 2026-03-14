import React from 'react';
import { AlertTriangle, CheckCircle, Clock, XCircle, ChevronRight, Zap, Target, TrendingUp } from 'lucide-react';

interface ActionItem {
  id: number;
  prioridade: 'Critica' | 'Alta' | 'Media' | 'Baixa';
  orgao: string;
  acao: string;
  descricao: string;
  prazo: string;
  impacto: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluido';
}

interface ActionPlanProps {
  pendencias: Array<{
    orgao: string;
    tipo: string;
    descricao: string;
    valor?: number;
    vencimento?: string;
    riskLevel?: string;
  }>;
  nivelRisco: 'Low' | 'Medium' | 'High' | 'Critical';
  score: number;
}

const prioridadeConfig = {
  Critica: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: XCircle, dot: 'bg-red-500' },
  Alta: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', icon: AlertTriangle, dot: 'bg-orange-500' },
  Media: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700', icon: Clock, dot: 'bg-yellow-500' },
  Baixa: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700', icon: CheckCircle, dot: 'bg-green-500' },
};

function generateActionPlan(pendencias: ActionPlanProps['pendencias']): ActionItem[] {
  const actions: ActionItem[] = [];
  let id = 1;

  const riskToPriority = (risk?: string): ActionItem['prioridade'] => {
    switch (risk) {
      case 'Critical': return 'Critica';
      case 'High': return 'Alta';
      case 'Medium': return 'Media';
      default: return 'Baixa';
    }
  };

  pendencias.forEach(p => {
    const tipo = (p.tipo || '').toUpperCase();
    const prioridade = riskToPriority(p.riskLevel);

    if (tipo.includes('DECLARACAO') || tipo.includes('DECLARAÇÃO') || tipo.includes('DCTF') || tipo.includes('EFD') || tipo.includes('SPED') || tipo.includes('DEFIS') || tipo.includes('ECD') || tipo.includes('ECF')) {
      actions.push({
        id: id++,
        prioridade,
        orgao: p.orgao,
        acao: `Entregar ${p.tipo}`,
        descricao: `${p.descricao}. Regularizar a entrega para evitar multas e bloqueio de CND.`,
        prazo: p.vencimento || 'Imediato',
        impacto: 'Desbloqueio de CND e evita multa por atraso',
        status: 'Pendente',
      });
    } else if (tipo.includes('DEBITO') || tipo.includes('DÉBITO') || (p.valor && p.valor > 0)) {
      actions.push({
        id: id++,
        prioridade,
        orgao: p.orgao,
        acao: `Regularizar debito - ${p.tipo}`,
        descricao: `Valor: R$ ${(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ${p.descricao}`,
        prazo: p.vencimento || '30 dias',
        impacto: 'Evita inscricao em Divida Ativa e protesto',
        status: 'Pendente',
      });
    } else if (tipo.includes('FGTS')) {
      actions.push({
        id: id++,
        prioridade: 'Critica',
        orgao: p.orgao,
        acao: 'Regularizar FGTS',
        descricao: `${p.descricao}. CRF bloqueado impede participacao em licitacoes.`,
        prazo: 'Imediato',
        impacto: 'Liberacao do CRF e regularizacao trabalhista',
        status: 'Pendente',
      });
    } else {
      actions.push({
        id: id++,
        prioridade,
        orgao: p.orgao,
        acao: `Resolver: ${p.tipo}`,
        descricao: p.descricao,
        prazo: p.vencimento || '30 dias',
        impacto: 'Regularizacao fiscal',
        status: 'Pendente',
      });
    }
  });

  // Sort by priority
  const priorityOrder = { Critica: 0, Alta: 1, Media: 2, Baixa: 3 };
  actions.sort((a, b) => priorityOrder[a.prioridade] - priorityOrder[b.prioridade]);

  return actions;
}

export function ActionPlan({ pendencias, nivelRisco, score }: ActionPlanProps) {
  const actions = generateActionPlan(pendencias);
  const criticas = actions.filter(a => a.prioridade === 'Critica').length;
  const altas = actions.filter(a => a.prioridade === 'Alta').length;

  if (actions.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 p-8 rounded-2xl text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-black text-green-800">Empresa Regular</h3>
        <p className="text-green-600 text-sm mt-1">Nenhuma acao corretiva necessaria. Continue monitorando.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do Plano */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50">
              <Target size={24} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">Plano de Acao Corretivo</h3>
              <p className="text-sm text-slate-500">{actions.length} acoes identificadas para regularizacao</p>
            </div>
          </div>
          <div className="flex gap-2">
            {criticas > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 flex items-center gap-1">
                <Zap size={12} /> {criticas} Critica{criticas > 1 ? 's' : ''}
              </span>
            )}
            {altas > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-700">
                {altas} Alta{altas > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Progress summary */}
        <div className="grid grid-cols-4 gap-3">
          {(['Critica', 'Alta', 'Media', 'Baixa'] as const).map(prio => {
            const count = actions.filter(a => a.prioridade === prio).length;
            const config = prioridadeConfig[prio];
            return (
              <div key={prio} className={`${config.bg} ${config.border} border rounded-xl p-3 text-center`}>
                <span className={`text-2xl font-black ${config.text}`}>{count}</span>
                <p className={`text-xs font-bold ${config.text} mt-0.5`}>{prio}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline de Acoes */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
            <TrendingUp size={16} /> Acoes Ordenadas por Prioridade
          </h4>
        </div>

        <div className="divide-y divide-slate-50">
          {actions.map((action, idx) => {
            const config = prioridadeConfig[action.prioridade];
            const Icon = config.icon;

            return (
              <div key={action.id} className={`p-5 hover:bg-slate-50/50 transition-colors`}>
                <div className="flex items-start gap-4">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-8 h-8 rounded-full ${config.bg} ${config.border} border flex items-center justify-center`}>
                      <Icon size={14} className={config.text} />
                    </div>
                    {idx < actions.length - 1 && (
                      <div className="w-0.5 h-full min-h-[20px] bg-slate-100 mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${config.badge}`}>
                        {action.prioridade}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {action.orgao}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">#{action.id}</span>
                    </div>

                    <h5 className="font-bold text-slate-800 text-sm">{action.acao}</h5>
                    <p className="text-slate-500 text-xs mt-1">{action.descricao}</p>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={12} />
                        <span className="font-medium">Prazo: {action.prazo}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <ChevronRight size={12} />
                        <span className="font-medium">{action.impacto}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
