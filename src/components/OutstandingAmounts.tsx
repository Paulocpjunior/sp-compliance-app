import React, { useState } from 'react';
import { DollarSign, TrendingUp, Calculator, RefreshCw, Calendar, ArrowRight, Info } from 'lucide-react';

interface DebitoAberto {
  orgao: string;
  tipo: string;
  descricao: string;
  valorOriginal: number;
  valorAtualizado?: number;
  vencimento?: string;
  taxaJuros?: number;
  multa?: number;
}

interface OutstandingAmountsProps {
  pendencias: Array<{
    orgao: string;
    tipo: string;
    descricao: string;
    valor?: number;
    vencimento?: string;
  }>;
}

// Selic monthly rates (approximate recent months)
const SELIC_MENSAL = 0.0108; // ~13% ao ano / 12
const MULTA_MORA_PERCENTUAL = 0.20; // 20% multa de mora padrao RFB

function calcularAtualizacao(valorOriginal: number, vencimento?: string): {
  valorAtualizado: number;
  juros: number;
  multa: number;
  mesesAtraso: number;
} {
  if (!vencimento || valorOriginal <= 0) {
    return { valorAtualizado: valorOriginal, juros: 0, multa: 0, mesesAtraso: 0 };
  }

  const parts = vencimento.split('/');
  let vencDate: Date;
  if (parts.length === 3) {
    vencDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  } else {
    vencDate = new Date(vencimento);
  }

  if (isNaN(vencDate.getTime()) || vencDate >= new Date()) {
    return { valorAtualizado: valorOriginal, juros: 0, multa: 0, mesesAtraso: 0 };
  }

  const diffMs = Date.now() - vencDate.getTime();
  const mesesAtraso = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30));

  // Juros Selic acumulado
  const juros = valorOriginal * SELIC_MENSAL * mesesAtraso;

  // Multa de mora (max 20%)
  const multaPct = Math.min(mesesAtraso * 0.0033, MULTA_MORA_PERCENTUAL); // 0.33% por dia ate 20%
  const multa = valorOriginal * multaPct;

  const valorAtualizado = valorOriginal + juros + multa;

  return { valorAtualizado, juros, multa, mesesAtraso };
}

function BarChart({ debitos }: { debitos: DebitoAberto[] }) {
  if (debitos.length === 0) return null;

  const maxVal = Math.max(...debitos.map(d => d.valorAtualizado || d.valorOriginal));

  return (
    <div className="space-y-3">
      {debitos.slice(0, 8).map((d, i) => {
        const val = d.valorAtualizado || d.valorOriginal;
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const diff = (d.valorAtualizado || 0) - d.valorOriginal;

        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600 truncate max-w-[200px]">
                {d.tipo.replace(/_/g, ' ')}
              </span>
              <div className="text-right">
                <span className="text-xs font-black text-slate-800">
                  R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                {diff > 0 && (
                  <span className="text-[10px] text-red-500 font-bold ml-1">
                    (+{diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                  </span>
                )}
              </div>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 group-hover:from-blue-600 group-hover:to-indigo-600"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OutstandingAmounts({ pendencias }: OutstandingAmountsProps) {
  const [showAtualizado, setShowAtualizado] = useState(true);

  const debitos: DebitoAberto[] = pendencias
    .filter(p => p.valor && p.valor > 0)
    .map(p => {
      const calc = calcularAtualizacao(p.valor!, p.vencimento);
      return {
        orgao: p.orgao,
        tipo: p.tipo,
        descricao: p.descricao,
        valorOriginal: p.valor!,
        valorAtualizado: calc.valorAtualizado,
        vencimento: p.vencimento,
        taxaJuros: calc.juros,
        multa: calc.multa,
      };
    })
    .sort((a, b) => (b.valorAtualizado || 0) - (a.valorAtualizado || 0));

  const totalOriginal = debitos.reduce((acc, d) => acc + d.valorOriginal, 0);
  const totalAtualizado = debitos.reduce((acc, d) => acc + (d.valorAtualizado || d.valorOriginal), 0);
  const totalJuros = debitos.reduce((acc, d) => acc + (d.taxaJuros || 0), 0);
  const totalMulta = debitos.reduce((acc, d) => acc + (d.multa || 0), 0);
  const diffTotal = totalAtualizado - totalOriginal;

  if (debitos.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 p-8 rounded-2xl text-center">
        <DollarSign size={48} className="text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-black text-green-800">Sem Debitos em Aberto</h3>
        <p className="text-green-600 text-sm mt-1">Nenhum valor pendente foi identificado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com totais */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10">
              <DollarSign size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg">Valores em Aberto</h3>
              <p className="text-slate-300 text-sm">{debitos.length} debito{debitos.length > 1 ? 's' : ''} identificado{debitos.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAtualizado(!showAtualizado)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            {showAtualizado ? 'Ver Original' : 'Ver Atualizado'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Valor Original</p>
            <p className="text-xl font-black mt-1">
              R$ {totalOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Juros (Selic)</p>
            <p className="text-xl font-black mt-1 text-yellow-400">
              + R$ {totalJuros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Multa Mora</p>
            <p className="text-xl font-black mt-1 text-orange-400">
              + R$ {totalMulta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Total Atualizado</p>
            <p className="text-xl font-black mt-1 text-red-400">
              R$ {totalAtualizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            {diffTotal > 0 && (
              <p className="text-xs text-red-300 flex items-center gap-1 mt-1">
                <TrendingUp size={10} />
                +{((diffTotal / totalOriginal) * 100).toFixed(1)}% de acrescimo
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Maiores Debitos</h4>
          <BarChart debitos={debitos} />
        </div>

        {/* Detail table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-600">Detalhamento</h4>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Info size={10} />
              Valores corrigidos pela taxa Selic
            </div>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100">
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Orgao</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Tipo</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-right">Original</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-right">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {debitos.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {d.orgao}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-medium text-slate-700">{d.tipo.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right text-xs text-slate-500">
                      R$ {d.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-xs font-black text-slate-800">
                        R$ {(d.valorAtualizado || d.valorOriginal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <Calculator size={18} className="text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-800">Metodologia de Atualizacao</p>
          <p className="text-xs text-blue-600 mt-1">
            Valores atualizados pela taxa Selic acumulada ({(SELIC_MENSAL * 100).toFixed(2)}% a.m.) + multa de mora
            proporcional (0,33% ao dia, limitada a 20%). Valores indicativos - consultar DARF atualizado para valor exato.
          </p>
        </div>
      </div>
    </div>
  );
}
