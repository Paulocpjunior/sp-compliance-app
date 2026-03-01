import React from 'react';

export const ProductivityDashboard: React.FC = () => {
  // Dados simulados para o dashboard
  const weeklyStats = [
    { day: 'Seg', count: 12 },
    { day: 'Ter', count: 19 },
    { day: 'Qua', count: 15 },
    { day: 'Qui', count: 22 },
    { day: 'Sex', count: 18 },
  ];
  const maxVal = Math.max(...weeklyStats.map(s => s.count));

  const recentActivities = [
    { time: '10:45', action: 'Cobrança Enviada', company: 'TechSolutions Ltda', type: 'Simples Nacional' },
    { time: '09:30', action: 'Risco Crítico Detectado', company: 'Indústria Beta S.A.', type: 'Lucro Real' },
    { time: 'Ontem', action: 'Certificado Renovado', company: 'Comércio Silva', type: 'Simples Nacional' },
    { time: 'Ontem', action: 'Cobrança Automática', company: 'Grupo Alpha', type: 'Lucro Presumido' },
  ];

  const certificateHistory = [
      { date: '12/08/2024', status: 'VALID', entity: 'TechSolutions Ltda', notes: 'Renovado com sucesso' },
      { date: '15/07/2024', status: 'EXPIRING_SOON', entity: 'TechSolutions Ltda', notes: 'Alerta enviado (15 dias)' },
      { date: '10/07/2023', status: 'VALID', entity: 'TechSolutions Ltda', notes: 'Emissão Inicial' },
  ];

  const cndHistory = [
      { date: '20/08/2024', type: 'Federal', oldStatus: 'Emitida', newStatus: 'Com Pendências', company: 'TechSolutions Ltda' },
      { date: '18/08/2024', type: 'Municipal', oldStatus: 'Não Emitida', newStatus: 'Emitida', company: 'Indústria Beta S.A.' },
      { date: '10/08/2024', type: 'Estadual', oldStatus: 'Emitida', newStatus: 'Emitida', company: 'Grupo Alpha' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
       {/* KPIs */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
             <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Cobranças na Semana</div>
             <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">86</div>
             <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1 flex items-center">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"/></svg>
                +12% vs semana anterior
             </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
             <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Pendências Resolvidas</div>
             <div className="text-3xl font-bold text-slate-800 dark:text-white">34</div>
             <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Últimos 7 dias</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
             <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tempo Economizado</div>
             <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">~14h</div>
             <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Automação de e-mails</div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Volume de Cobranças (Diário)</h3>
            <div className="flex items-end space-x-4 h-64">
              {weeklyStats.map((stat, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center group">
                   <div className="w-full relative flex items-end justify-center bg-slate-100 dark:bg-slate-700 rounded-t-lg overflow-hidden h-full">
                      <div 
                        style={{ height: `${(stat.count / maxVal) * 100}%` }} 
                        className="w-full bg-brand-500 group-hover:bg-brand-600 dark:bg-brand-600 dark:group-hover:bg-brand-500 transition-all duration-500 relative"
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          {stat.count}
                        </div>
                      </div>
                   </div>
                   <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">{stat.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
             <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Atividade Recente</h3>
             <div className="space-y-4">
                {recentActivities.map((act, idx) => (
                   <div key={idx} className="flex items-start pb-4 border-b border-slate-100 dark:border-slate-700 last:border-0 last:pb-0">
                      <div className={`w-2 h-2 mt-2 rounded-full mr-3 ${act.type.includes('Real') ? 'bg-indigo-500' : 'bg-green-500'}`}></div>
                      <div>
                         <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{act.action}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400">{act.company}</p>
                         <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wide">{act.time} • {act.type}</p>
                      </div>
                   </div>
                ))}
             </div>
          </div>
       </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Certificate History Widget */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Histórico de Status do Certificado
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                    <th className="pb-3 font-medium">Data</th>
                                    <th className="pb-3 font-medium">Entidade</th>
                                    <th className="pb-3 font-medium">Status Anterior</th>
                                    <th className="pb-3 font-medium">Observações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {certificateHistory.map((hist, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="py-3 text-slate-800 dark:text-slate-200 font-mono text-xs">{hist.date}</td>
                                        <td className="py-3 text-slate-800 dark:text-slate-200">{hist.entity}</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                hist.status === 'VALID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            }`}>
                                                {hist.status}
                                            </span>
                                        </td>
                                        <td className="py-3 text-slate-500 dark:text-slate-400 text-xs italic">{hist.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
            </div>

             {/* CND Status History Widget */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Histórico de Monitoramento de CNDs
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                    <th className="pb-3 font-medium">Data</th>
                                    <th className="pb-3 font-medium">Tipo CND</th>
                                    <th className="pb-3 font-medium">De</th>
                                    <th className="pb-3 font-medium">Para</th>
                                    <th className="pb-3 font-medium">Empresa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {cndHistory.map((cnd, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="py-3 text-slate-800 dark:text-slate-200 font-mono text-xs">{cnd.date}</td>
                                        <td className="py-3 text-slate-800 dark:text-slate-200 font-medium">{cnd.type}</td>
                                        <td className="py-3 text-xs text-slate-500">{cnd.oldStatus}</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                cnd.newStatus.includes('Pendência') 
                                                    ? 'bg-red-100 text-red-700' 
                                                    : 'bg-green-100 text-green-700'
                                            }`}>
                                                {cnd.newStatus}
                                            </span>
                                        </td>
                                         <td className="py-3 text-xs text-slate-500 truncate max-w-[100px]">{cnd.company}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
            </div>
       </div>
    </div>
  );
};