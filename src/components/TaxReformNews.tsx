import React, { useEffect, useState, useCallback } from 'react';
import { Newspaper, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { fetchTaxReformNews, TaxNewsItem } from '../services/taxNewsService';

interface TaxReformNewsProps {
  refreshKey?: number;
}

export function TaxReformNews({ refreshKey }: TaxReformNewsProps) {
  const [news, setNews] = useState<TaxNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const items = await fetchTaxReformNews(6);
      setNews(items);
      if (items.length === 0) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews, refreshKey]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadNews();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadNews]);

  return (
    <div className="mt-12 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl">
            <Newspaper size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800">Fique por Dentro: Ultimas Atualizacoes Fiscais</h3>
            <p className="text-sm text-slate-400 font-medium">Noticias e atualizacoes importantes do mundo fiscal, selecionadas por IA.</p>
          </div>
        </div>
        <button
          onClick={loadNews}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading && news.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-full mb-3" />
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-4" />
                <div className="h-3 bg-slate-100 rounded w-full mb-2" />
                <div className="h-3 bg-slate-100 rounded w-5/6 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-2/3 mb-6" />
                <div className="h-4 bg-blue-100 rounded w-24" />
              </div>
            ))}
          </div>
        ) : error && news.length === 0 ? (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center">
            <AlertCircle size={24} className="text-orange-400 mx-auto mb-2" />
            <p className="text-sm text-orange-600 font-medium">Nao foi possivel carregar as noticias.</p>
            <button
              onClick={loadNews}
              className="mt-2 text-xs font-bold text-orange-500 hover:text-orange-700 underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {news.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-lg hover:border-blue-200 transition-all"
              >
                <div>
                  <h4 className="text-base font-black text-slate-800 leading-snug mb-3">
                    {item.title}
                  </h4>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">
                    {item.description}
                  </p>
                </div>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors mt-auto"
                >
                  Ler mais <ArrowRight size={14} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400 font-medium">
          Direitos Reservados - Uso Exclusivo by SP Assessoria Contabil
        </p>
      </div>
    </div>
  );
}
