import React, { useState } from 'react';
import { Upload, FileKey, Loader2 } from 'lucide-react';
import { AuditResults } from './components/AuditResults';

export default function App() {
    const [certificate, setCertificate] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [auditoria, setAuditoria] = useState<any>(null);
    const [empresaAuditada, setEmpresaAuditada] = useState({ nome: '', cnpj: '' });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCertificate(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!certificate || !password) {
            setError('Por favor, selecione um certificado e insira a senha.');
            return;
        }

        const formData = new FormData();
        formData.append('certificate', certificate);
        formData.append('password', password);

        setLoading(true);
        setError(null);
        setAuditoria(null);

        try {
            const response = await fetch('https://api-sp-compliance-631239634290.southamerica-east1.run.app/api/v1/auditoria-completa', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Erro na comunicação com os órgãos fiscais.');
            }

            const data = await response.json();

            setEmpresaAuditada({
                nome: "Empresa Auditada", // Poderia vir do certificado ou do backend
                cnpj: "12.345.678/0001-99" // Poderia vir do certificado ou do backend
            });

            setAuditoria(data);
        } catch (err: any) {
            setError(err.message || 'Erro inesperado durante a auditoria.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12 text-center">
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">SP Assessoria Contábil</h1>
                    <p className="text-slate-500 mt-2 font-medium">Motor de Diagnóstico Fiscal Automatizado</p>
                </header>

                {!auditoria && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 max-w-md mx-auto">
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-700 mb-2">1. Selecione o Certificado (PFX/P12)</label>
                            <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                                <input
                                    type="file"
                                    accept=".pfx,.p12"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Upload className="text-blue-500 mb-2" size={32} />
                                <span className="text-sm font-bold text-slate-600">
                                    {certificate ? certificate.name : 'Clique para importar o arquivo'}
                                </span>
                            </div>
                        </div>

                        <div className="mb-8">
                            <label className="block text-sm font-bold text-slate-700 mb-2">2. Senha do Certificado</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                                    placeholder="Digite a senha..."
                                />
                                <FileKey className="absolute left-3 top-3.5 text-slate-400" size={20} />
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold border border-red-100">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={loading || !certificate || !password}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={20} /> Processando nos Órgãos...
                                </>
                            ) : 'Iniciar Auditoria Tributária'}
                        </button>

                        <p className="text-center text-xs text-slate-400 font-medium mt-4">
                            Conexão M2M segura. Os dados são processados diretamente na Receita Federal e PGFN.
                        </p>
                    </div>
                )}

                {/* Renderização Elegante dos Resultados usando o novo componente */}
                {auditoria && !loading && (
                    <AuditResults
                        razaoSocial={empresaAuditada.nome}
                        cnpj={empresaAuditada.cnpj}
                        clienteRegular={auditoria.clienteRegular}
                        pendencias={auditoria.pendencias || []}
                        certidoes={auditoria.certidoes || []}
                    />
                )}
            </div>
        </div>
    );
}
