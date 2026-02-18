import React from 'react';
import { ComplianceData, NivelRisco, Installment } from '../types';

interface RiskEngineDisplayProps {
  data: ComplianceData;
  onSendEmail?: (data: ComplianceData) => void;
}

export const RiskEngineDisplay: React.FC<RiskEngineDisplayProps> = ({ data, onSendEmail }) => {
  // Helpers for styles
  const getRiskColor = (level: NivelRisco) => {
    switch (level) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'High': return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('emitida') || s.includes('regular') || s.includes('em dia') || s.includes('ativo')) return 'bg-green-50 border-green-200 text-green-700';
    if (s.includes('pendência') || s.includes('irregular') || s.includes('não emitida') || s.includes('atraso') || s.includes('pendente')) return 'bg-red-50 border-red-200 text-red-700';
    return 'bg-slate-50 border-slate-200 text-slate-700';
  };
  
  const getStatusTextColor = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s.includes('emitida') || s.includes('regular') || s.includes('em dia') || s.includes('ativo')) return 'text-green-700';
      if (s.includes('desconhecido')) return 'text-slate-500';
      return 'text-red-700';
  }

  // Helpers for Monthly Obligations Status
  const getObligationStatusBadge = (status: string) => {
    switch(status) {
        case 'Entregue':
            return <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">Entregue</span>;
        case 'Retificada':
            return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">Retificada</span>;
        case 'Em Aberto':
            return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">Em Aberto</span>;
        case 'Pendente':
        case 'Não Entregue':
            return <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">{status}</span>;
        case 'Em Processamento':
            return <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Processando</span>;
        default:
            return <span className="px-2 py-1 rounded text-xs text-slate-500">{status}</span>;
    }
  };

  // Circular Score Calculation (Dash Array)
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (data.score / 100) * circumference;
  
  const scoreColor = data.score > 70 ? 'text-green-500' : data.score > 40 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden font-sans animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center space-x-2 mb-2 sm:mb-0">
          <svg className="w-5 h-5 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.217-2.44.18-1.8 1.158-3.006 1.706-3.66a1 1 0 00-1.388-1.32C6.186 2.99 4.887 4.7 4.545 6.94c-.334 2.176.47 4.627 2.22 6.545 1.766 1.936 4.316 2.51 6.368 2.51 2.5 0 4.604-.848 5.76-2.42.454-.617.842-1.382 1.01-2.224.085-.42.14-.863.14-1.327 0-3.328-2.585-6.34-6.65-7.47z" clipRule="evenodd" />
          </svg>
          <span className="font-bold text-slate-800 dark:text-white text-lg">Risk Engine</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Regime: {data.taxRegime}</span>
          <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${getRiskColor(data.globalRiskLevel)}`}>
            {data.globalRiskLevel} RISK
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          {/* Circular Score */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-slate-100 dark:text-slate-700"
                />
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={`${scoreColor} transition-all duration-1000 ease-out`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`text-3xl font-bold ${scoreColor}`}>{data.score}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">SCORE</span>
              </div>
            </div>
          </div>

          {/* Company Info & Status Cards */}
          <div className="flex-grow">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{data.razaoSocial}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 font-mono">CNPJ: {data.cnpj}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{data.cnae} • {data.endereco}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'CND FEDERAL', status: data.cndFederalStatus },
                { label: 'CND ESTADUAL', status: data.cndStateStatus },
                { label: 'CND MUNICIPAL', status: data.cndMunicipalStatus },
                { label: 'STATUS E-CAC', status: data.ecacStatus || 'Desconhecido' },
              ].map((item, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${getStatusColor(item.status)}`}>
                  <p className="text-[10px] uppercase tracking-wide font-semibold opacity-70 mb-1">{item.label}</p>
                  <p className={`text-sm font-bold ${getStatusTextColor(item.status)}`}>{item.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tax Situation (Imposto Pago & Obligations) - NEW SECTION */}
        <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Situação Tributária Mensal
            </h3>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Last Payment Highlight */}
                {data.impostoPago && (
                    <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/10 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                             <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Último Pagamento Identificado</p>
                             <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">{data.impostoPago}</p>
                        </div>
                        <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-600 dark:text-blue-300">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                             </svg>
                        </div>
                    </div>
                )}

                {/* Monthly Obligations Table */}
                {data.monthlyObligations && data.monthlyObligations.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Competência</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Obrigação</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vencimento</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor Declarado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                                {data.monthlyObligations.map((obl, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                            {obl.competence}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                            {obl.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {getObligationStatusBadge(obl.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500 dark:text-slate-400">
                                            {obl.dueDate}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-slate-700 dark:text-slate-300">
                                            {obl.amount ? `R$ ${obl.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
        
        {/* NEW SECTION: Annual Obligations (ECD, ECF, DEFIS) */}
        {data.annualObligations && data.annualObligations.length > 0 && (
             <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Obrigações Acessórias Anuais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.annualObligations.map((ann, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg shadow-sm flex items-center justify-between">
                             <div>
                                 <h5 className="font-bold text-slate-800 dark:text-white text-sm">{ann.name} <span className="text-xs text-slate-500 font-normal">({ann.exerciseYear})</span></h5>
                                 <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                     {ann.receiptNumber ? `Recibo: ${ann.receiptNumber}` : 'Recibo não localizado'}
                                 </p>
                             </div>
                             <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                 ann.status === 'Entregue' 
                                    ? 'bg-green-100 text-green-700' 
                                    : ann.status === 'Pendente' 
                                        ? 'bg-red-100 text-red-700 animate-pulse' 
                                        : 'bg-slate-100 text-slate-600'
                             }`}>
                                 {ann.status}
                             </span>
                        </div>
                    ))}
                </div>
            </div>
        )}
        
        {/* Detailed Fiscal Health Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* e-Social Widget */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        e-Social
                    </h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${data.esocial?.status === 'Regular' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {data.esocial?.status || 'N/A'}
                    </span>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Eventos Pendentes:</span>
                        <span className="font-mono font-medium dark:text-white">{data.esocial?.eventosPendentes ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Rejeitados:</span>
                        <span className="font-mono font-medium text-red-600 dark:text-red-400">{data.esocial?.eventosRejeitados ?? '-'}</span>
                    </div>
                </div>
            </div>

            {/* FGTS Widget */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        FGTS
                    </h4>
                     <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${data.fgts?.status === 'Regular' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {data.fgts?.status || 'N/A'}
                    </span>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Último Depósito:</span>
                        <span className="font-medium dark:text-white">{data.fgts?.ultimoDeposito || '-'}</span>
                    </div>
                    {data.fgts?.competenciasEmAberto && data.fgts.competenciasEmAberto.length > 0 && (
                        <div className="mt-2">
                             <p className="text-xs text-red-500 mb-1">Competências em Aberto:</p>
                             <div className="flex flex-wrap gap-1">
                                {data.fgts.competenciasEmAberto.map(c => (
                                    <span key={c} className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 rounded">{c}</span>
                                ))}
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Municipal Detail Widget */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Municipal
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono bg-white dark:bg-slate-700 px-2 rounded border dark:border-slate-600">
                        IM: {data.municipalDetail?.inscricaoMunicipal || '...'}
                    </span>
                </div>
                <div className="space-y-2 text-sm">
                     <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">TFE / Taxas:</span>
                        <span className={`text-xs font-bold ${data.municipalDetail?.tfeStatus === 'Em dia' ? 'text-green-600' : 'text-red-600'}`}>
                            {data.municipalDetail?.tfeStatus}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">ISSQN:</span>
                         <span className={`text-xs font-bold ${data.municipalDetail?.issStatus === 'Em dia' ? 'text-green-600' : 'text-red-600'}`}>
                            {data.municipalDetail?.issStatus}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* Parcelamentos Vigentes (Installments) */}
        {data.installments && data.installments.length > 0 && (
             <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Parcelamentos Vigentes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.installments.map((inst, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg shadow-sm relative overflow-hidden">
                             <div className={`absolute top-0 left-0 w-1 h-full ${inst.status === 'Em dia' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                             <div className="flex justify-between items-start mb-3 pl-3">
                                 <div>
                                     <h5 className="font-bold text-slate-800 dark:text-white text-sm">{inst.modalidade}</h5>
                                     <span className={`text-[10px] uppercase font-bold ${inst.status === 'Em dia' ? 'text-green-600' : 'text-red-600'}`}>
                                         {inst.status}
                                     </span>
                                 </div>
                                 <div className="text-right">
                                     <div className="text-xs text-slate-500">Valor Parcela</div>
                                     <div className="font-mono font-bold text-slate-800 dark:text-white">R$ {inst.valorParcela.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                                 </div>
                             </div>
                             
                             {/* Progress Bar */}
                             <div className="pl-3">
                                 <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                     <span>Progresso</span>
                                     <span>{inst.parcelasPagas}/{inst.totalParcelas}</span>
                                 </div>
                                 <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                     <div 
                                        className="bg-brand-600 h-2 rounded-full transition-all" 
                                        style={{ width: `${(inst.parcelasPagas / inst.totalParcelas) * 100}%` }}
                                     ></div>
                                 </div>
                             </div>
                        </div>
                    ))}
                </div>
             </div>
        )}

        {/* Pendencies & Debts Table UPDATED */}
        <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">PENDENCIES & DEBTS</h3>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Risk</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/3">Description</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dias Pendentes</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor Original</th>
                             <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-yellow-50 dark:bg-yellow-900/10 border-l border-slate-200 dark:border-slate-700">Valor Corrigido (Selic)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {data.pendencies.length > 0 ? data.pendencies.map((pendency, idx) => (
                            <tr key={idx}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getRiskColor(pendency.riskLevel)}`}>
                                        {pendency.riskLevel}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                    <div>{pendency.description}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{pendency.type} • Venc: {pendency.dueDate || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                                    {pendency.diasDeAtraso && pendency.diasDeAtraso > 0 ? (
                                        <span className="text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full text-xs">
                                            {pendency.diasDeAtraso} dias
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-500 dark:text-slate-400">
                                    R$ {pendency.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono font-bold text-slate-900 dark:text-white bg-yellow-50 dark:bg-yellow-900/10 border-l border-slate-100 dark:border-slate-700">
                                    {pendency.correctedAmount ? (
                                        `R$ ${pendency.correctedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    ) : (
                                        <span className="text-slate-400 text-xs font-sans font-normal">Não calculado</span>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                    Nenhuma pendência encontrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Legal Processes Table */}
        {data.legalProcesses && data.legalProcesses.length > 0 && (
          <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" />
                </svg>
                Processos Jurídicos / Judiciais
              </h3>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                      <thead className="bg-slate-50 dark:bg-slate-700/50">
                          <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Esfera</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nº Processo</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Detalhes</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                          {data.legalProcesses.map((proc) => (
                              <tr key={proc.id}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">
                                      {proc.sphere}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-slate-600 dark:text-slate-400">
                                      {proc.processNumber}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                          proc.status === 'Ativo' || proc.status === 'Em Execução' 
                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
                                            : proc.status === 'Suspenso'
                                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400'
                                      }`}>
                                          {proc.status}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                      {proc.description || '-'}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
        )}

        {/* Action Plan */}
        <div className="mb-8 bg-blue-50 dark:bg-blue-900/10 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-4">PLANO DE AÇÃO PARA REGULARIZAÇÃO</h3>
            <ul className="space-y-4">
                {data.actionPlan.map((action, idx) => (
                    <li key={idx} className="flex items-start">
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full text-xs font-bold mr-3 mt-0.5">
                            {idx + 1}
                        </span>
                        <span className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">{action}</span>
                    </li>
                ))}
            </ul>
        </div>

        {/* Email Draft Generator */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Email Draft Generator</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Gere um e-mail de notificação para o cliente</p>
                </div>
            </div>
            <div className="flex space-x-3">
                 <button 
                    onClick={() => {
                        const text = `Assunto: ${data.emailDraft?.subject}\n\n${data.emailDraft?.body}`;
                        navigator.clipboard.writeText(text);
                        alert("Email copiado para a área de transferência!");
                    }}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm whitespace-nowrap"
                >
                    Copiar Texto
                </button>
                <button 
                    onClick={() => onSendEmail && onSendEmail(data)}
                    className="px-4 py-2 bg-brand-600 border border-transparent text-white font-semibold text-sm rounded-lg hover:bg-brand-700 transition-colors shadow-sm whitespace-nowrap flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar E-mail
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};