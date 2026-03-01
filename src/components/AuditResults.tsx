import React from 'react';
import { AlertTriangle, CheckCircle, Download, Building2, Calendar, FileText } from 'lucide-react';
import { FiscalIssue } from '../TaxParser';

interface CND {
    orgao: string;
    nome: string;
    status: string;
    arquivoBase64: string;
}

interface AuditResultsProps {
    razaoSocial: string;
    cnpj: string;
    clienteRegular: boolean;
    pendencias: FiscalIssue[];
    certidoes: CND[];
}

export function AuditResults({ razaoSocial, cnpj, clienteRegular, pendencias, certidoes }: AuditResultsProps) {
    // Calcula o risco financeiro total
    const valorTotal = pendencias.reduce((acc, curr) => acc + (curr.valor || 0), 0);

    return (
        <div className="w-full max-w-6xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Cabeçalho do Relatório */}
            <div className="bg-white p-6 rounded-t-2xl border-x border-t shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-3 rounded-xl">
                        <Building2 className="text-slate-600" size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{razaoSocial}</h2>
                        <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                            CNPJ: {cnpj} • <span className="text-blue-600">Auditoria Automatizada</span>
                        </p>
                    </div>
                </div>

                {/* Badge de Status Geral */}
                <div className={`px-4 py-2 rounded-full font-black text-sm flex items-center gap-2 ${clienteRegular ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {clienteRegular ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {clienteRegular ? 'COMPLIANCE: 100%' : 'IRREGULARIDADES DETECTADAS'}
                </div>
            </div>

            {/* CENÁRIO 1: Cliente com Problemas (Vermelho) */}
            {!clienteRegular && (
                <div className="bg-white border shadow-sm rounded-b-2xl overflow-hidden">
                    <div className="bg-red-50 p-6 border-b border-red-100 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-red-900">Detalhamento de Pendências</h3>
                            <p className="text-red-700 text-sm">Ações imediatas são necessárias para regularizar o CNPJ.</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Risco Financeiro</p>
                            <p className="text-2xl font-black text-red-700">
                                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b">
                                    <th className="p-4 text-xs font-black text-slate-400 uppercase">Órgão Oficial</th>
                                    <th className="p-4 text-xs font-black text-slate-400 uppercase">Tipo / Descrição</th>
                                    <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Valor Estimado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pendencias.map((pend, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-md font-bold text-xs bg-slate-100 text-slate-700">
                                                {pend.orgao}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-800 text-sm">{pend.tipo.replace(/_/g, ' ')}</p>
                                            <p className="text-slate-500 text-sm">{pend.descricao}</p>
                                            {pend.vencimento && (
                                                <p className="text-xs font-bold text-orange-500 mt-1 flex items-center gap-1">
                                                    <Calendar size={12} /> Venceu em: {pend.vencimento}
                                                </p>
                                            )}
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-800">
                                            {pend.valor && pend.valor > 0 ? `R$ ${pend.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CENÁRIO 2: Cliente Regular (Verde - Área de CNDs) */}
            {clienteRegular && (
                <div className="bg-white border border-green-200 shadow-sm rounded-b-2xl p-8">
                    <p className="text-slate-600 mb-6 font-medium">O sistema não detectou débitos em aberto. As certidões abaixo foram emitidas automaticamente nos portais do governo e já estão disponíveis para download.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {certidoes.map((cnd, idx) => (
                            <div key={idx} className="border border-slate-200 p-5 rounded-xl hover:border-blue-300 hover:shadow-md transition-all bg-white group flex flex-col justify-between h-full">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="bg-blue-50 p-3 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">{cnd.orgao}</h4>
                                        <p className="font-bold text-slate-800 text-sm mt-1 leading-snug">{cnd.nome}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                                    <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-md font-black uppercase tracking-wider">
                                        {cnd.status}
                                    </span>
                                    <a
                                        href={`data:application/pdf;base64,${cnd.arquivoBase64}`}
                                        download={`CND_${cnd.orgao.replace(/\s/g, '_')}_${cnpj}.pdf`}
                                        className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        <Download size={16} /> Salvar PDF
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}