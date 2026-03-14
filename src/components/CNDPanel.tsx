import React from 'react';
import { CheckCircle, XCircle, Download, FileText, Shield, AlertTriangle, ExternalLink } from 'lucide-react';

interface CND {
  orgao: string;
  nome: string;
  status: string;
  arquivoBase64?: string;
  validade?: string;
  codigoVerificacao?: string;
}

interface CNDScanResult {
  orgao: string;
  tipo: 'Federal' | 'Estadual' | 'Municipal' | 'Trabalhista';
  status: 'Emitida' | 'Com Pendencias' | 'Nao Emitida';
  motivo?: string;
}

interface CNDPanelProps {
  certidoes: CND[];
  cnpj: string;
  scanResults?: CNDScanResult[];
}

const tipoConfig = {
  Federal: { icon: '🏛️', color: 'border-blue-200 bg-blue-50' },
  Estadual: { icon: '🏢', color: 'border-purple-200 bg-purple-50' },
  Municipal: { icon: '🏘️', color: 'border-green-200 bg-green-50' },
  Trabalhista: { icon: '👷', color: 'border-orange-200 bg-orange-50' },
};

const defaultScanResults: CNDScanResult[] = [
  { orgao: 'Receita Federal / PGFN', tipo: 'Federal', status: 'Nao Emitida', motivo: 'Aguardando varredura' },
  { orgao: 'SEFAZ / Fazenda Estadual', tipo: 'Estadual', status: 'Nao Emitida', motivo: 'Aguardando varredura' },
  { orgao: 'Prefeitura Municipal', tipo: 'Municipal', status: 'Nao Emitida', motivo: 'Aguardando varredura' },
  { orgao: 'TST / Justica do Trabalho', tipo: 'Trabalhista', status: 'Nao Emitida', motivo: 'Aguardando varredura' },
];

export function CNDPanel({ certidoes, cnpj, scanResults }: CNDPanelProps) {
  const results = scanResults || defaultScanResults;

  // Merge certidoes emitidas with scan results
  const mergedResults = results.map(scan => {
    const emitida = certidoes.find(c =>
      c.orgao.toLowerCase().includes(scan.orgao.split('/')[0].trim().toLowerCase()) ||
      scan.orgao.toLowerCase().includes(c.orgao.split('/')[0].trim().toLowerCase())
    );
    if (emitida) {
      return { ...scan, status: 'Emitida' as const, certidao: emitida };
    }
    return { ...scan, certidao: undefined };
  });

  // Also add certidoes that don't match any scan result
  certidoes.forEach(c => {
    const exists = mergedResults.some(r => r.certidao === c);
    if (!exists) {
      mergedResults.push({
        orgao: c.orgao,
        tipo: 'Federal' as const,
        status: 'Emitida' as const,
        certidao: c,
      });
    }
  });

  const emitidas = mergedResults.filter(r => r.status === 'Emitida').length;
  const total = mergedResults.length;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className={`p-6 rounded-2xl border ${emitidas === total && total > 0 ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'} shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={28} className={emitidas === total && total > 0 ? 'text-green-500' : 'text-slate-400'} />
            <div>
              <h3 className="text-lg font-black text-slate-800">Certidoes Negativas de Debitos</h3>
              <p className="text-sm text-slate-500">Varredura automatica nos orgaos governamentais</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-black ${emitidas === total && total > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {emitidas}/{total}
            </span>
            <p className="text-xs text-slate-400 font-bold">CNDs Emitidas</p>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex gap-1 mt-4 h-2 rounded-full overflow-hidden bg-slate-100">
          {mergedResults.map((r, i) => (
            <div key={i} className={`flex-1 rounded-full transition-all duration-700 ${
              r.status === 'Emitida' ? 'bg-green-500' :
              r.status === 'Com Pendencias' ? 'bg-red-500' : 'bg-slate-300'
            }`} />
          ))}
        </div>
      </div>

      {/* CND Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mergedResults.map((result, idx) => {
          const config = tipoConfig[result.tipo];
          const isEmitida = result.status === 'Emitida';
          const hasPendencia = result.status === 'Com Pendencias';

          return (
            <div key={idx} className={`rounded-2xl border overflow-hidden transition-all hover:shadow-md ${
              isEmitida ? 'border-green-200' : hasPendencia ? 'border-red-200' : 'border-slate-200'
            }`}>
              {/* Card header */}
              <div className={`p-4 flex items-center justify-between ${
                isEmitida ? 'bg-green-50' : hasPendencia ? 'bg-red-50' : 'bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config.icon}</span>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{result.tipo}</p>
                    <p className="font-bold text-slate-800 text-sm">{result.orgao}</p>
                  </div>
                </div>
                {isEmitida ? (
                  <CheckCircle size={24} className="text-green-500" />
                ) : hasPendencia ? (
                  <AlertTriangle size={24} className="text-red-500" />
                ) : (
                  <XCircle size={24} className="text-slate-300" />
                )}
              </div>

              {/* Card body */}
              <div className="p-4 bg-white">
                {isEmitida && result.certidao ? (
                  <div>
                    <p className="text-sm text-slate-600 mb-3">{result.certidao.nome}</p>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-green-100 text-green-700 uppercase">
                        {result.certidao.status}
                      </span>
                      {result.certidao.arquivoBase64 && (
                        <a
                          href={`data:application/pdf;base64,${result.certidao.arquivoBase64}`}
                          download={`CND_${result.tipo}_${cnpj.replace(/[^\d]/g, '')}.pdf`}
                          className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Download size={14} /> Baixar PDF
                        </a>
                      )}
                    </div>
                    {result.certidao.validade && (
                      <p className="text-xs text-slate-400 mt-2">Validade: {result.certidao.validade}</p>
                    )}
                  </div>
                ) : hasPendencia ? (
                  <div>
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-700">
                        {result.motivo || 'Existem pendencias que impedem a emissao da certidao.'}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 uppercase">
                      CND Bloqueada
                    </span>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <FileText size={24} className="text-slate-200 mx-auto mb-1" />
                    <p className="text-xs text-slate-400">{result.motivo || 'Certidao nao emitida'}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
