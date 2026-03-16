export interface TaxNewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  relativeTime: string;
}

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=reforma+tributaria+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419';

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHrs < 24) return `${diffHrs}h atrás`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return date.toLocaleDateString('pt-BR');
}

function extractSource(title: string): { cleanTitle: string; source: string } {
  const match = title.match(/^(.*)\s-\s([^-]+)$/);
  if (match) {
    return { cleanTitle: match[1].trim(), source: match[2].trim() };
  }
  return { cleanTitle: title, source: 'Google News' };
}

async function fetchWithProxy(proxyFn: (url: string) => string): Promise<TaxNewsItem[]> {
  const response = await fetch(proxyFn(GOOGLE_NEWS_RSS), {
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) throw new Error('Proxy failed');

  const xml = await response.text();
  if (!xml.includes('<item>')) throw new Error('Invalid RSS');

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = doc.querySelectorAll('item');

  const news: TaxNewsItem[] = [];
  items.forEach((item, idx) => {
    if (idx >= 6) return;
    const rawTitle = item.querySelector('title')?.textContent || '';
    const { cleanTitle, source } = extractSource(rawTitle);
    const link = item.querySelector('link')?.textContent || '#';
    const pubDate = item.querySelector('pubDate')?.textContent || '';

    news.push({
      title: cleanTitle,
      link,
      source,
      pubDate,
      relativeTime: getRelativeTime(pubDate),
    });
  });

  if (news.length === 0) throw new Error('No news items');
  return news;
}

export async function fetchTaxReformNews(limit = 6): Promise<TaxNewsItem[]> {
  for (const proxyFn of CORS_PROXIES) {
    try {
      const news = await fetchWithProxy(proxyFn);
      return news.slice(0, limit);
    } catch {
      continue;
    }
  }
  return getFallbackNews();
}

function getFallbackNews(): TaxNewsItem[] {
  return [
    {
      title: 'IBS e CBS entram em vigor: periodo de teste comeca em 2026 com aliquotas reduzidas',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Gov.br',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Split payment obrigatorio: como funciona o novo sistema de recolhimento automatico',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Ministério da Fazenda',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Cashback tributario: familias de baixa renda terao devolucao de CBS e IBS',
      link: 'https://www.camara.leg.br',
      source: 'Câmara dos Deputados',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Comite Gestor do IBS: regulamentacao define estrutura e competencias',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Gov.br',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Imposto Seletivo: lista de produtos com tributacao extra e definida',
      link: 'https://www.planalto.gov.br',
      source: 'Planalto',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Transicao tributaria 2026-2033: cronograma completo para empresas se adaptarem',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Receita Federal',
      pubDate: new Date().toISOString(),
      relativeTime: 'Cronograma',
    },
  ];
}
