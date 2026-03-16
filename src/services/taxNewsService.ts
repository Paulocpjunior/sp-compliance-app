export interface TaxNewsItem {
  title: string;
  description: string;
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

function cleanHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
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
    const rawDesc = item.querySelector('description')?.textContent || '';
    const description = cleanHtml(rawDesc).slice(0, 200);

    news.push({
      title: cleanTitle,
      description: description || cleanTitle,
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
      title: 'IBS e CBS entram em vigor com aliquotas de teste em 2026',
      description: 'A partir de 2026 comeca o periodo de teste: CBS (federal) e IBS (estados/municipios) passam a coexistir com os tributos atuais. Aliquota-teste de 0,1% para CBS e 0,05% para IBS.',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Gov.br',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Split payment obrigatorio: recolhimento automatico na liquidacao financeira',
      description: 'O novo mecanismo de split payment divide automaticamente o valor do tributo no momento do pagamento, reduzindo a sonegacao e simplificando o recolhimento para empresas.',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Ministério da Fazenda',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Cashback tributario beneficia familias de baixa renda com devolucao de CBS e IBS',
      description: 'Programa de cashback prevê a devolução de parte dos tributos pagos por familias inscritas no CadUnico, especialmente em itens essenciais como alimentos, energia e gas.',
      link: 'https://www.camara.leg.br',
      source: 'Câmara dos Deputados',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Comite Gestor do IBS: regulamentacao define estrutura e competencias',
      description: 'O Comite Gestor sera responsavel pela arrecadacao, fiscalizacao e distribuicao do IBS entre estados e municipios, substituindo ICMS e ISS de forma unificada.',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Gov.br',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Imposto Seletivo: lista de produtos com tributacao extra e definida',
      description: 'O Imposto Seletivo incidira sobre produtos prejudiciais a saude e ao meio ambiente, como bebidas alcoolicas, cigarros, bebidas acucaradas e veiculos poluentes.',
      link: 'https://www.planalto.gov.br',
      source: 'Planalto',
      pubDate: new Date().toISOString(),
      relativeTime: 'Vigência 2026',
    },
    {
      title: 'Transicao tributaria 2026-2033: cronograma completo para empresas',
      description: 'A transicao sera gradual: 2026 fase de teste, 2027-2028 coexistencia com aliquotas crescentes, 2029-2032 extincao progressiva dos tributos antigos, 2033 novo sistema pleno.',
      link: 'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria',
      source: 'Receita Federal',
      pubDate: new Date().toISOString(),
      relativeTime: 'Cronograma',
    },
  ];
}
