export interface TaxNewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  relativeTime: string;
}

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=reforma+tributaria+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419';

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 60) return `${diffMin}min atras`;
  if (diffHrs < 24) return `${diffHrs}h atras`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atras`;
  return date.toLocaleDateString('pt-BR');
}

function extractSource(title: string): { cleanTitle: string; source: string } {
  const match = title.match(/^(.*)\s-\s([^-]+)$/);
  if (match) {
    return { cleanTitle: match[1].trim(), source: match[2].trim() };
  }
  return { cleanTitle: title, source: 'Google News' };
}

export async function fetchTaxReformNews(limit = 6): Promise<TaxNewsItem[]> {
  try {
    const corsProxy = 'https://api.allorigins.win/raw?url=';
    const response = await fetch(corsProxy + encodeURIComponent(GOOGLE_NEWS_RSS), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error('Falha ao buscar noticias');

    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = doc.querySelectorAll('item');

    const news: TaxNewsItem[] = [];
    items.forEach((item, idx) => {
      if (idx >= limit) return;
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

    return news;
  } catch {
    return getFallbackNews();
  }
}

function getFallbackNews(): TaxNewsItem[] {
  return [
    {
      title: 'Reforma Tributaria: CBS e IBS substituirao PIS, Cofins, ICMS, ISS e IPI',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Gov.br',
      pubDate: new Date().toISOString(),
      relativeTime: 'Hoje',
    },
    {
      title: 'Regulamentacao da Reforma Tributaria avanca no Congresso Nacional',
      link: 'https://www.camara.leg.br',
      source: 'Camara dos Deputados',
      pubDate: new Date().toISOString(),
      relativeTime: 'Hoje',
    },
    {
      title: 'Split payment e cashback: entenda as mudancas para empresas',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Ministerio da Fazenda',
      pubDate: new Date().toISOString(),
      relativeTime: 'Recente',
    },
    {
      title: 'Periodo de transicao da Reforma Tributaria: cronograma ate 2033',
      link: 'https://www.planalto.gov.br',
      source: 'Planalto',
      pubDate: new Date().toISOString(),
      relativeTime: 'Recente',
    },
  ];
}
