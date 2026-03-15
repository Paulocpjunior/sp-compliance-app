import React, { useEffect, useState, useCallback } from 'react';
import { Newspaper, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
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

  // Refresh when tab becomes visible (user returns to app)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadNews();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadNews]);

  const sourceColor = (source: string): string => {
    const s = source.toLowerCase();
    if (s.includes('folha') || s.includes('uol')) return 'bg-blue-100 text-blue-700';
    if (s.includes('globo') || s.includes('g1')) return 'bg-red-100 text-red-700';
    if (s.includes('estadao') || s.includes('estado')) return 'bg-slate-100 text-slate-700';
    if (s.includes('gov') || s.includes('camara') || s.includes('senado') || s.includes('planalto')) return 'bg-green-100 text-green-700';
    if (s.includes('valor') || s.includes('infomoney') || s.includes('exame')) return 'bg-amber-100 text-amber-700';
    if (s.includes('cnn') || s.includes('band')) return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-orange-50 p-2 rounded-lg">
            <Newspaper size={18} className="text-orange-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">Reforma Tributaria</h3>
            <p className="text-[11px] text-slate-400 font-medium">Noticias atualizadas automaticamente</p>
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

      {loading && news.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-16 mb-3" />
              <div className="h-4 bg-slate-200 rounded w-full mb-2" />
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-20" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {news.map((item, idx) => (
            <a
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl border border-slate-100 p-4 hover:border-blue-200 hover:shadow-md hover:shadow-blue-50 transition-all group block"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sourceColor(item.source)}`}>
                  {item.source}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">{item.relativeTime}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-700 leading-snug mb-3 group-hover:text-blue-700 transition-colors line-clamp-3">
                {item.title}
              </h4>
              <div className="flex items-center gap-1 text-[11px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                Ler mais <ExternalLink size={11} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
