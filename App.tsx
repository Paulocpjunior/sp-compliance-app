import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { FileUpload } from './components/FileUpload';
import { CertificateParser } from './services/certificateParser';
import { ParsedCertificate, ComplianceData, Pendency, LegalProcess } from './types';
import { analyzeCompliance } from './services/geminiService';
import { ComplianceService } from './services/ComplianceService';
import { PdfService } from './services/pdfService';
import { ProductivityDashboard } from './components/ProductivityDashboard';
import { AuthScreen } from './components/AuthScreen';
import { AuthService } from './services/authService';
import { User } from './types/auth';
import { RiskEngineDisplay } from './components/RiskEngineDisplay';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Tab = 'analysis' | 'dashboard';
type InputMode = 'certificate' | 'manual';

const App: React.FC = () => {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // App State
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [inputMode, setInputMode] = useState<InputMode>('certificate');
  
  // Certificate State
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [certData, setCertData] = useState<ParsedCertificate | null>(null);
  
  // Manual Input State
  const [manualCnpj, setManualCnpj] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPdfs, setManualPdfs] = useState<File[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [analyzingReport, setAnalyzingReport] = useState(false);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [manualCnds, setManualCnds] = useState<File[]>([]);
  
  // State for Manual Legal Processes
  const [legalProcesses, setLegalProcesses] = useState<LegalProcess[]>([]);
  const [newProcess, setNewProcess] = useState<Partial<LegalProcess>>({
      sphere: 'Federal',
      status: 'Ativo'
  });

  // Check auth on mount
  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setInitializing(false);
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    AuthService.logout();
    setUser(null);
    handleReset();
  };

  const formatCnpj = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCnpj(e.target.value);
      setManualCnpj(formatted);
      
      // Clear error if valid length is reached while typing
      if (formatted.replace(/\D/g, '').length === 14 && error === "CNPJ inválido.") {
          setError(null);
      }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files) as File[];
          
          // Validação robusta
          const validPdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
          
          if (validPdfs.length !== files.length) {
             setError("Alguns arquivos foram ignorados. Apenas arquivos PDF são permitidos.");
          }
          
          if (validPdfs.length > 0) {
              setManualPdfs(prev => [...prev, ...validPdfs]);
          }
      }
  };

  // --- ANALYSIS HANDLERS ---

  const handleManualAnalysis = async () => {
      // Validação estrita de 14 dígitos numéricos
      const cleanCnpj = manualCnpj.replace(/\D/g, '');
      
      if (cleanCnpj.length !== 14) {
          setError("O CNPJ deve conter exatamente 14 dígitos.");
          return;
      }
      
      if (manualPdfs.length === 0) {
          setError("Por favor, anexe pelo menos um documento (PDF) para análise.");
          return;
      }

      setIsLoading(true);
      setError(null);
      setComplianceData(null);
      setCertData(null);
      setAiReport(null);

      try {
          // 1. Extract Text from PDFs with detailed error handling
          const pdfTextContent = await PdfService.processMultipleFiles(manualPdfs);
          
          // 2. Call Service with detailed error handling
          const data = await ComplianceService.analyzeManualCompliance(manualCnpj, manualName || 'Empresa em Análise', pdfTextContent);
          setComplianceData(data);
          
      } catch (err: any) {
          console.error("Manual Analysis Failed:", err);
          setError(err.message || "Ocorreu um erro durante a análise. Verifique os documentos e tente novamente.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setCertData(null);
    setAiReport(null);
    setComplianceData(null);
    setManualCnds([]);
    setLegalProcesses([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Delay for UI smoothness
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const parsed = CertificateParser.parse(arrayBuffer, password);
      setCertData(parsed);
      
      let subjectName = parsed.subject.O;
      if (!subjectName || subjectName.toLowerCase().includes('icp-brasil') || subjectName.toLowerCase().includes('secretaria')) {
          subjectName = parsed.subject.CN.split(':')[0].trim();
      }

      setAnalyzingReport(true);
      analyzeCompliance(parsed)
        .then(report => setAiReport(report))
        .catch(err => console.error("AI Report Error:", err))
        .finally(() => setAnalyzingReport(false));

      setLoadingCompliance(true);
      ComplianceService.fetchComplianceData(parsed.cnpj || '', subjectName)
        .then(data => setComplianceData(data))
        .catch(err => {
            console.error("Compliance Data Error", err);
            // Non-blocking error for compliance data fetch in Cert mode
            // We just don't show the advanced panel, but Cert info is shown.
        })
        .finally(() => setLoadingCompliance(false));

    } catch (err: any) {
      setError(err.message || "Erro inesperado ao processar o certificado.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPassword('');
    setCertData(null);
    setError(null);
    setAiReport(null);
    setComplianceData(null);
    setManualCnds([]);
    setLegalProcesses([]);
    setManualCnpj('');
    setManualName('');
    setManualPdfs([]);
  };

  const handleCndUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files) as File[];
          
           // Validação robusta
          const validFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
          
          if (validFiles.length !== files.length) {
              setError("Apenas arquivos PDF podem ser anexados como CND.");
          }

          if (validFiles.length > 0) {
            setManualCnds(prev => [...prev, ...validFiles]);
          }
      }
  };

  const handleSendEmail = (data: ComplianceData) => {
      if (!data.emailDraft) {
          alert("Nenhum rascunho de e-mail disponível para envio.");
          return;
      }
      
      // Simulação de envio
      const confirmSend = window.confirm(`Deseja enviar o e-mail de boas-vindas para a empresa ${data.razaoSocial}?`);
      
      if (confirmSend) {
          alert(`E-mail enviado com sucesso!\n\nDestinatário: Contato Principal da ${data.razaoSocial}\nAssunto: ${data.emailDraft.subject}`);
          // Aqui entraria a chamada real para uma API de envio de e-mails (ex: SendGrid, AWS SES)
      }
  };

  const handleAddProcess = () => {
      if (!newProcess.processNumber || !newProcess.sphere || !newProcess.status) return;
      
      const process: LegalProcess = {
          id: crypto.randomUUID(),
          processNumber: newProcess.processNumber,
          sphere: newProcess.sphere as any,
          status: newProcess.status as any,
          description: newProcess.description
      };
      
      setLegalProcesses([...legalProcesses, process]);
      setNewProcess({ sphere: 'Federal', status: 'Ativo', processNumber: '', description: '' });
  };
  
  const handleRemoveProcess = (id: string) => {
      setLegalProcesses(legalProcesses.filter(p => p.id !== id));
  };

  const generatePDF = () => {
    if (!complianceData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header Color Bar
    doc.setFillColor(2, 132, 199); 
    doc.rect(0, 0, pageWidth, 20, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("ConsultaSP - Relatório de Situação Fiscal", 10, 13);

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString(), pageWidth - 30, 13);

    let yPos = 35;
    
    // 1. Company Verified Data
    doc.setTextColor(30, 41, 59); 
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("1. Dados da Empresa Verificada", 10, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Razão Social: ${complianceData.razaoSocial}`, 15, yPos); yPos += 6;
    doc.text(`CNPJ: ${complianceData.cnpj}`, 15, yPos); yPos += 6;
    doc.text(`Endereço: ${complianceData.endereco || 'N/A'}`, 15, yPos); yPos += 6;
    doc.text(`CNAE: ${complianceData.cnae || 'N/A'}`, 15, yPos); yPos += 6;
    doc.text(`Regime Tributário: ${complianceData.taxRegime}`, 15, yPos); yPos += 6;
    
    if (complianceData.impostoPago) {
        doc.text(`Último Pagamento: ${complianceData.impostoPago}`, 15, yPos); yPos += 6;
    }
    
    yPos += 4;

    // 2. Certificate Details OR Manual Source
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    if (certData) {
        doc.text("2. Detalhes do Certificado Digital", 10, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Titular: ${certData.subject.CN}`, 15, yPos); yPos += 6;
        doc.text(`Emissor: ${certData.issuer.O}`, 15, yPos); yPos += 6;
        doc.text(`Validade: ${certData.validity.notBefore.toLocaleDateString()} até ${certData.validity.notAfter.toLocaleDateString()}`, 15, yPos); yPos += 6;
        doc.text(`Status: ${certData.validity.isValid ? 'VÁLIDO' : 'EXPIRADO'}`, 15, yPos); yPos += 10;
    } else {
        doc.text("2. Fonte dos Dados", 10, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Análise baseada em documentos fiscais (PDF) fornecidos manualmente.", 15, yPos); yPos += 6;
        doc.text(`Arquivos processados: ${manualPdfs.length}`, 15, yPos); yPos += 10;
    }

    // 3. Compliance Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("3. Diagnóstico de Risco", 10, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const riskText = `Nível de Risco Global: ${complianceData.globalRiskLevel.toUpperCase()}`;
    doc.text(riskText, 15, yPos);
    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, yPos - 4, 180, 7); 
    doc.text(riskText, 16, yPos); 
    yPos += 6;
    doc.text(`Score de Compliance: ${complianceData.score}/100`, 15, yPos); yPos += 10;

    // 4. Pendencies Table
    if (complianceData.pendencies.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("4. Pendências Identificadas (e-CAC / Dívida Ativa)", 10, yPos);
        yPos += 4;

        const tableData = complianceData.pendencies.map(p => [
            p.riskLevel,
            p.description,
            p.diasDeAtraso ? `${p.diasDeAtraso} dias` : '-',
            `R$ ${p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            p.correctedAmount ? `R$ ${p.correctedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Risco', 'Descrição', 'Atraso', 'Valor Original', 'Valor Corrigido']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [2, 132, 199] },
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 25, halign: 'right' },
                4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
            }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 10;
    } else {
        doc.text("Nenhuma pendência crítica identificada.", 15, yPos + 5);
        yPos += 15;
    }
    
    // 5. Legal Processes (Processos Jurídicos)
    if (legalProcesses.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("5. Processos Jurídicos / Judiciais", 10, yPos);
        yPos += 4;
        
        const procTable = legalProcesses.map(p => [
            p.sphere,
            p.processNumber,
            p.status,
            p.description || '-'
        ]);
        
        autoTable(doc, {
            startY: yPos,
            head: [['Esfera', 'Nº Processo', 'Status', 'Detalhes']],
            body: procTable,
            theme: 'grid',
            headStyles: { fillColor: [100, 116, 139] },
            styles: { fontSize: 8 },
        });
        
        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 10;
    }

    // 6. Action Plan
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("6. Plano de Ação para Regularização", 10, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    complianceData.actionPlan.forEach((action, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${action}`, pageWidth - 25);
        doc.text(lines, 15, yPos);
        yPos += (lines.length * 5) + 2;
    });

    yPos += 5;

    // 7. Attached Documents
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("7. Anexos e CNDs", 10, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (complianceData.cndFederalStatus === 'Emitida') {
        doc.text("[ AUTO ] CND Federal - Emitida Automaticamente/Verificada", 15, yPos);
        yPos += 6;
    }
    
    if (manualCnds.length > 0) {
        manualCnds.forEach(file => {
             doc.text(`[ ANEXO MANUAL ] ${file.name}`, 15, yPos);
             yPos += 6;
        });
    }
    
    if (manualPdfs.length > 0) {
        manualPdfs.forEach(file => {
             doc.text(`[ FONTE DE DADOS ] ${file.name} (Analisado via OCR)`, 15, yPos);
             yPos += 6;
        });
    }

    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Gerado por ConsultaSP | SP Assessoria Contábil - Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`Relatorio_Compliance_${complianceData.cnpj.replace(/\D/g, '')}.pdf`);
  };

  // Helper to check if CNPJ is valid (mask filled)
  const isCnpjValid = manualCnpj.replace(/\D/g, '').length === 14;

  // AUTH LOGIC: Loading state
  if (initializing) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
    </div>;
  }

  // AUTH LOGIC: Show Login Screen if not authenticated
  if (!user) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // MAIN APP (Protected)
  return (
    <Layout user={user} onLogout={handleLogout}>
      {/* Navigation Tabs */}
      <div className="flex space-x-1 mb-8 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 inline-flex transition-colors">
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'analysis' 
              ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-md' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          Análise Técnica
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'dashboard' 
              ? 'bg-brand-600 text-white shadow-md' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          Dashboard Gerencial
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <ProductivityDashboard />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          {/* Left Column: Input */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                <span className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg mr-3 text-slate-500 dark:text-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                </span>
                1. Selecionar Origem
              </h2>
              
              {/* Input Mode Switcher */}
              <div className="flex space-x-2 mb-6 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                  <button 
                    onClick={() => { setInputMode('certificate'); handleReset(); }}
                    className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all ${inputMode === 'certificate' ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                      Certificado Digital
                  </button>
                  <button 
                    onClick={() => { setInputMode('manual'); handleReset(); }}
                    className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all ${inputMode === 'manual' ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                      Upload Manual
                  </button>
              </div>
              
              {!complianceData && (
                <div className="space-y-4">
                  
                  {inputMode === 'certificate' ? (
                      // CERTIFICATE MODE
                      <>
                        <FileUpload onFileSelected={setFile} isLoading={isLoading} />
                        
                        <div className="relative">
                            <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Senha do Certificado"
                            disabled={!file || isLoading}
                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400"
                            />
                        </div>

                        <button
                            onClick={handleUnlock}
                            disabled={!file || !password || isLoading}
                            className="w-full bg-brand-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center"
                        >
                            {isLoading ? 'Processando...' : 'Ler Certificado'}
                        </button>
                      </>
                  ) : (
                      // MANUAL MODE
                      <>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNPJ da Empresa</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={manualCnpj}
                                    onChange={handleCnpjChange}
                                    maxLength={18}
                                    placeholder="00.000.000/0000-00"
                                    className={`w-full px-4 py-3 border bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 outline-none pr-10 transition-colors
                                        ${isCnpjValid 
                                            ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20' 
                                            : 'border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:ring-brand-500'}
                                    `}
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                    {isCnpjValid ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 pl-1">Formatação automática. O sistema validará se existem 14 dígitos.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Razão Social (Opcional)</label>
                            <input
                                type="text"
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                                placeholder="Nome da Empresa"
                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Upload de Documentos (PDF)</label>
                             <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Anexe CNDs, Relatórios do e-CAC e Comprovantes para análise da IA.</p>
                             <input 
                                type="file" 
                                accept="application/pdf"
                                multiple
                                onChange={handlePdfUpload}
                                className="block w-full text-sm text-slate-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-brand-50 file:text-brand-700
                                  hover:file:bg-brand-100
                                  dark:file:bg-slate-700 dark:file:text-slate-300
                                "
                            />
                            {manualPdfs.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                    {manualPdfs.map((f, i) => (
                                        <li key={i} className="text-xs bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded text-slate-600 dark:text-slate-400 flex justify-between">
                                            <span className="truncate max-w-[180px]">{f.name}</span>
                                            <button onClick={() => setManualPdfs(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500">x</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        
                        <button
                            onClick={handleManualAnalysis}
                            disabled={!manualCnpj || manualPdfs.length === 0 || isLoading}
                            className="w-full bg-brand-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center"
                        >
                            {isLoading ? 'Analisando Documentos...' : 'Analisar Documentos'}
                        </button>
                      </>
                  )}

                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-200 dark:border-red-800 flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  )}
                </div>
              )}
              
              {complianceData && (
                 <div className="text-center py-4">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
                      <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Análise Finalizada</h3>
                    <button onClick={handleReset} className="mt-2 text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium text-xs underline">
                      Nova Consulta
                    </button>
                </div>
              )}
            </div>
            
            {/* CND Attachments & Legal Processes Section */}
            {complianceData && (
                <>
                {/* Legal Processes Input */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors mb-6">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                        <span className="bg-orange-100 dark:bg-orange-900/50 p-2 rounded-lg mr-3 text-orange-600 dark:text-orange-300">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" />
                          </svg>
                        </span>
                        Processos Jurídicos
                     </h2>
                     <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Número do Processo</label>
                            <input 
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                placeholder="Ex: 0000000-00.2024.5.00.0000"
                                value={newProcess.processNumber}
                                onChange={(e) => setNewProcess({...newProcess, processNumber: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Esfera</label>
                                <select 
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                    value={newProcess.sphere}
                                    onChange={(e) => setNewProcess({...newProcess, sphere: e.target.value as any})}
                                >
                                    <option value="Federal">Federal</option>
                                    <option value="Estadual">Estadual</option>
                                    <option value="Municipal">Municipal</option>
                                    <option value="Trabalhista">Trabalhista</option>
                                    <option value="Cível">Cível</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Status</label>
                                <select 
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                    value={newProcess.status}
                                    onChange={(e) => setNewProcess({...newProcess, status: e.target.value as any})}
                                >
                                    <option value="Ativo">Ativo</option>
                                    <option value="Suspenso">Suspenso</option>
                                    <option value="Em Execução">Em Execução</option>
                                    <option value="Arquivado">Arquivado</option>
                                </select>
                            </div>
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Observações (Opcional)</label>
                             <input 
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                placeholder="Breve descrição..."
                                value={newProcess.description || ''}
                                onChange={(e) => setNewProcess({...newProcess, description: e.target.value})}
                            />
                        </div>
                        <button 
                            onClick={handleAddProcess}
                            className="w-full mt-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-sm font-semibold py-2 rounded transition-colors"
                        >
                            Adicionar Processo
                        </button>
                        
                        {legalProcesses.length > 0 && (
                            <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-3">
                                <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Processos Incluídos ({legalProcesses.length})</h4>
                                <ul className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    {legalProcesses.map(p => (
                                        <li key={p.id} className="text-xs bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-700 relative group">
                                            <div className="font-semibold text-slate-700 dark:text-slate-300">{p.processNumber}</div>
                                            <div className="flex justify-between mt-1 text-slate-500 dark:text-slate-400">
                                                <span>{p.sphere}</span>
                                                <span className={`${p.status === 'Ativo' ? 'text-orange-500' : 'text-slate-500'}`}>{p.status}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveProcess(p.id)}
                                                className="absolute top-1 right-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                     </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
                     <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                        <span className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg mr-3 text-indigo-600 dark:text-indigo-300">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                          </svg>
                        </span>
                        Anexos de CNDs
                     </h2>
                     
                     <div className="space-y-4">
                        {/* Auto-detected Status */}
                        {complianceData.cndFederalStatus === 'Emitida' && (
                             <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                 </svg>
                                 <div>
                                     <p className="text-sm font-semibold text-green-800 dark:text-green-200">CND Federal Emitida (Verificado)</p>
                                     <p className="text-xs text-green-600 dark:text-green-400">Regularidade confirmada.</p>
                                 </div>
                             </div>
                        )}
                        
                        {/* Manual Upload */}
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Anexar CND Manualmente (.pdf)</label>
                            <input 
                                type="file" 
                                accept="application/pdf"
                                multiple
                                onChange={handleCndUpload}
                                className="block w-full text-sm text-slate-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-brand-50 file:text-brand-700
                                  hover:file:bg-brand-100
                                  dark:file:bg-slate-700 dark:file:text-slate-300
                                "
                            />
                        </div>
                        
                        {/* List Manual Files */}
                        {manualCnds.length > 0 && (
                            <ul className="space-y-2">
                                {manualCnds.map((f, i) => (
                                    <li key={i} className="flex items-center justify-between text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                                        <span className="flex items-center truncate max-w-[80%] text-slate-600 dark:text-slate-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                            </svg>
                                            {f.name}
                                        </span>
                                        <button onClick={() => setManualCnds(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                     </div>
                </div>
                </>
            )}
            
          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-8 space-y-6">
            {(certData || complianceData) ? (
              <>
                {complianceData && (
                    <>
                        <div className="flex justify-end mb-2">
                             <button 
                                onClick={generatePDF}
                                className="flex items-center text-sm font-semibold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 rounded-lg shadow-sm transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                Exportar Relatório PDF
                            </button>
                        </div>
                        {/* Pass combined data including manual legal processes AND send email handler */}
                        <RiskEngineDisplay 
                            data={{...complianceData, legalProcesses: [...(complianceData.legalProcesses || []), ...legalProcesses]}} 
                            onSendEmail={handleSendEmail}
                        />
                    </>
                )}

                {(!complianceData && certData) && (
                    <>
                    {/* Compliance Status Card (Only shown if Cert Data exists and no Compliance Data yet or while loading) */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
                    <div className={`p-1 w-full ${certData.validity.isValid ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status do Certificado</p>
                            <h3 className={`text-3xl font-bold ${certData.validity.isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {certData.validity.isValid ? 'VÁLIDO' : 'EXPIRADO'}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">
                            {certData.validity.daysRemaining > 0 
                                ? `${certData.validity.daysRemaining} dias restantes` 
                                : `Expirou há ${Math.abs(certData.validity.daysRemaining)} dias`}
                            </p>
                        </div>
                        {certData.isICPBrasil && (
                            <div className="flex flex-col items-end">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/23/Icp_brasil_logo.png" alt="ICP Brasil" className="h-10 opacity-80" />
                                <span className="text-xs text-slate-400 mt-1">Padrão Detectado</span>
                            </div>
                        )}
                        </div>
                    </div>
                    </div>

                    {/* Gemini Text Analysis */}
                    <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-800 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900 p-6 relative">
                    <div className="flex items-center mb-4">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg mr-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200">Resumo do Auditor (IA)</h3>
                    </div>
                    
                    {analyzingReport ? (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-indigo-200 dark:bg-indigo-900/50 rounded w-3/4"></div>
                            <div className="h-4 bg-indigo-200 dark:bg-indigo-900/50 rounded w-1/2"></div>
                            <div className="h-4 bg-indigo-200 dark:bg-indigo-900/50 rounded w-5/6"></div>
                        </div>
                    ) : (
                        <div className="prose prose-sm text-indigo-900 dark:text-indigo-200 max-w-none">
                        {aiReport ? (
                            <div dangerouslySetInnerHTML={{ __html: aiReport.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        ) : (
                            <p>Análise de IA indisponível.</p>
                        )}
                        </div>
                    )}
                    </div>
                    </>
                )}
              </>
            ) : (
              /* Empty State */
              <div className="h-full flex items-center justify-center min-h-[400px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex-col transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-medium">Nenhum certificado carregado</p>
                <p className="text-sm text-center px-4">Faça upload de um arquivo .pfx ou utilize a entrada manual para ver a análise.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;