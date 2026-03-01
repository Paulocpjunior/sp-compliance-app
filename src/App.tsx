import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, FileCheck, Download } from 'lucide-react';
import { parsePFX } from './services/certificateParser';

export default function App() {
    const [loading, setLoading] = useState(false);
    const [auditoria, setAuditoria] = useState<{ pendencias: any[], certidoes: any[], clienteRegular: boolean } | null>(null);

    const handleProcess = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (Lógica de leitura do arquivo e senha mantida) ...
        setLoading(true);
        try {
            const pfxBase64 = await toBase64(file);
            const certData = await parsePFX(file, password);

            // Chama a nova rota orquestrada
            const response = await fetch('https://SUA-URL-CLOUD-RUN/api/v1/auditoria-completa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pfxBase64, password, cnpj: certData.cnpj })
            });

            const data = await response.json();
            setAuditoria(data);

        } catch (err) {
            alert("Erro na auditoria oficial.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            {/* ... (Seu Header e Input de Arquivo aqui) ... */}

            {loading && <p className="text-center font-bold text-blue-600 animate-pulse mt-10">Conectando aos servidores da Receita Federal e e-Social...</p>}

            {auditoria && !loading && (
                <div className="max-w-6xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom duration-500">

                    {/* CENÁRIO 1: Cliente com Problemas (Exibe Pendências) */}
                    {!auditoria.clienteRegular ? (
                        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                            <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-3">
                                <AlertTriangle className="text-red-600" size={32} />
                                <div>
                                    <h3 className="text-xl font-bold text-red-800">Irregularidades Fiscais Detectadas</h3>
                                    <p className="text-red-600 text-sm">Foram encontradas {auditoria.pendencias.length} pendências nos órgãos governamentais.</p>
                                </div>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="p-4 font-bold text-slate-500">Órgão</th>
                                        <th className="p-4 font-bold text-slate-500">Descrição / Obrigação</th>
                                        <th className="p-4 font-bold text-slate-500">Valor (R$)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {auditoria.pendencias.map((pend, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-4 font-bold">{pend.orgao}</td>
                                            <td className="p-4 text-slate-700">{pend.descricao}</td>
                                            <td className="p-4 font-black text-red-600">{pend.valor > 0 ? `R$ ${pend.valor.toLocaleString('pt-BR')}` : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (

                        /* CENÁRIO 2: Cliente Regular (Exibe Certidões) */
                        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="bg-green-100 p-4 rounded-full">
                                    <FileCheck className="text-green-600" size={40} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-green-800">Empresa 100% Regular</h3>
                                    <p className="text-slate-600">Nenhuma pendência encontrada. As certidões foram emitidas automaticamente.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {auditoria.certidoes.map((cnd, idx) => (
                                    <div key={idx} className="border border-slate-200 p-6 rounded-xl flex items-center justify-between bg-slate-50">
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase">{cnd.orgao}</p>
                                            <p className="font-bold text-slate-800 mt-1">{cnd.nome}</p>
                                            <span className="inline-block mt-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold uppercase">{cnd.status}</span>
                                        </div>
                                        {/* Botão para o cliente baixar o PDF da Certidão */}
                                        <a
                                            href={`data:application/pdf;base64,${cnd.arquivoBase64}`}
                                            download={`CND_${cnd.orgao.replace(/\s/g, '')}.pdf`}
                                            className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-bold text-sm"
                                        >
                                            <Download size={18} /> Baixar PDF
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
// ... seus imports ...
import { AuditResults } from './components/AuditResults';

export default function App() {
    const [auditoria, setAuditoria] = useState<any>(null);
    const [empresaAuditada, setEmpresaAuditada] = useState({ nome: '', cnpj: '' });

    // ... função handleProcess ...

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            {/* Seu Header Navbar aqui */}
            {/* O Formulário de Input do Certificado aqui */}

            {/* Renderização Elegante dos Resultados */}
            {auditoria && !loading && (
                <AuditResults
                    razaoSocial={empresaAuditada.nome}
                    cnpj={empresaAuditada.cnpj}
                    clienteRegular={auditoria.clienteRegular}
                    pendencias={auditoria.pendencias}
                    certidoes={auditoria.certidoes}
                />
            )}
        </div>
    );
}