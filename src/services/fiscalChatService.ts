import { GoogleGenAI } from "@google/genai";
import { AnaliseCompleta } from './aiAnalysisService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function buildSystemContext(analise: AnaliseCompleta | null, nomeEmpresa: string): string {
  if (!analise) {
    return `Você é um consultor tributário sênior brasileiro especializado em compliance fiscal.
Responda sempre em Português do Brasil, de forma técnica e objetiva.
Cite legislação quando aplicável (CTN, IN RFB, Leis específicas).
Se não souber a resposta com certeza, informe que recomenda consultar um especialista.`;
  }

  const debitos = analise.itens.filter(i => i.categoria === 'debito');
  const obrigacoes = analise.itens.filter(i => i.categoria === 'obrigacao_ausente');

  return `Você é um consultor tributário sênior brasileiro especializado em compliance fiscal.
Você está assessorando a empresa "${nomeEmpresa}".

CONTEXTO FISCAL ATUAL DA EMPRESA:
- Score de Compliance: ${analise.score}/100 (Risco: ${analise.nivelRisco})
- Total Original em Débitos: R$ ${analise.totalOriginal.toFixed(2)}
- Total Atualizado (SELIC): R$ ${analise.totalAtualizado.toFixed(2)}
- Total Juros SELIC: R$ ${analise.totalJuros.toFixed(2)}
- Total Multas Estimadas: R$ ${analise.totalMultas.toFixed(2)}
- Débitos em aberto: ${debitos.length}
- Obrigações acessórias ausentes: ${obrigacoes.length}
- Parcelamentos ativos: ${analise.parcelamentosAtuais.length}

DÉBITOS:
${debitos.map(d => `- ${d.pendencia.tipo} (${d.pendencia.orgao}): R$ ${(d.selicCalculo?.valorAtualizado || d.pendencia.valor || 0).toFixed(2)} | Urgência: ${d.urgencia}`).join('\n') || 'Nenhum'}

OBRIGAÇÕES AUSENTES:
${obrigacoes.map(o => `- ${o.pendencia.tipo} (${o.pendencia.orgao}): Multa estimada R$ ${(o.multaObrigacao?.multa || 0).toFixed(2)}`).join('\n') || 'Nenhuma'}

PARCELAMENTOS DISPONÍVEIS:
${analise.sugestoesParcelamento.filter(s => s.economiaTotal > 0).map(s => `- ${s.nome}: ${s.parcelas}x R$ ${s.valorParcela.toFixed(2)} (economia: R$ ${s.economiaTotal.toFixed(2)})${s.maisVantajoso ? ' [MAIS VANTAJOSO]' : ''}`).join('\n') || 'N/A'}

INSTRUÇÕES:
- Responda sempre em Português do Brasil
- Seja técnico e objetivo
- Cite legislação quando aplicável (CTN, IN RFB, Leis específicas)
- Use os dados acima para personalizar suas respostas
- Se a pergunta estiver fora do escopo tributário/fiscal, redirecione educadamente
- Formate em Markdown quando apropriado`;
}

export async function enviarMensagemChat(
  mensagem: string,
  historico: ChatMessage[],
  analise: AnaliseCompleta | null,
  nomeEmpresa: string
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return gerarRespostaLocal(mensagem, analise);
  }

  const systemContext = buildSystemContext(analise, nomeEmpresa);

  const contents = [
    { role: 'user' as const, parts: [{ text: `CONTEXTO DO SISTEMA:\n${systemContext}` }] },
    { role: 'model' as const, parts: [{ text: 'Entendido. Sou um consultor tributário sênior e estou pronto para assessorar sobre a situação fiscal. Como posso ajudar?' }] },
  ];

  // Add conversation history (last 10 messages for context window)
  const recentHistory = historico.slice(-10);
  for (const msg of recentHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    });
  }

  // Add current message
  contents.push({
    role: 'user' as const,
    parts: [{ text: mensagem }],
  });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
    });
    return response.text || 'Não foi possível gerar uma resposta.';
  } catch (err) {
    console.error('Erro no chat fiscal:', err);
    return gerarRespostaLocal(mensagem, analise);
  }
}

function gerarRespostaLocal(mensagem: string, analise: AnaliseCompleta | null): string {
  const msg = mensagem.toLowerCase();

  if (msg.includes('parcelamento') || msg.includes('parcelar')) {
    if (analise && analise.sugestoesParcelamento.length > 0) {
      const melhor = analise.sugestoesParcelamento.find(s => s.maisVantajoso);
      return `**Opções de Parcelamento Disponíveis:**\n\n${analise.sugestoesParcelamento.map(s =>
        `- **${s.nome}** (${s.lei}): ${s.parcelas}x de R$ ${s.valorParcela.toFixed(2)}${s.maisVantajoso ? ' ⭐ MAIS VANTAJOSO' : ''}\n  Economia: R$ ${s.economiaTotal.toFixed(2)} | Desc. multa: ${s.descontoMulta}% | Desc. juros: ${s.descontoJuros}%`
      ).join('\n\n')}${melhor ? `\n\n**Recomendação:** O **${melhor.nome}** oferece a maior economia total.` : ''}\n\n_Para análise mais detalhada, configure a chave da API de IA._`;
    }
    return `Os principais programas de parcelamento disponíveis são:\n\n1. **Parcelamento Ordinário** (Art. 10-12, Lei 10.522/2002): até 60x\n2. **Parcelamento Simplificado** (IN RFB 1.891/2019): até 60x, online\n3. **Transação Tributária** (Lei 13.988/2020): até 120x com descontos\n4. **RELP** (Lei 14.375/2022): condições especiais\n\n_Para análise personalizada, configure a chave da API de IA._`;
  }

  if (msg.includes('selic') || msg.includes('juros') || msg.includes('atualiza')) {
    if (analise) {
      return `**Atualização pela SELIC:**\n\n- Valor Original: R$ ${analise.totalOriginal.toFixed(2)}\n- Juros SELIC acumulados: R$ ${analise.totalJuros.toFixed(2)}\n- Multa de mora: parte dos R$ ${analise.totalMultas.toFixed(2)}\n- **Total Atualizado: R$ ${analise.totalAtualizado.toFixed(2)}**\n\nA correção é feita com base no Art. 61, Lei 9.430/96, aplicando-se a taxa SELIC acumulada mês a mês desde o vencimento.\n\n_Para análise mais detalhada, configure a chave da API de IA._`;
    }
    return `A atualização de débitos federais é regida pelo Art. 61 da Lei 9.430/96:\n\n- **Juros**: Taxa SELIC acumulada desde o vencimento + 1% no mês de pagamento\n- **Multa de mora**: 0,33% por dia de atraso, limitada a 20%\n\n_Para cálculo personalizado, insira as pendências na entrada manual._`;
  }

  if (msg.includes('multa') || msg.includes('penalidade')) {
    if (analise && analise.totalMultas > 0) {
      const obrigacoes = analise.itens.filter(i => i.multaObrigacao);
      return `**Multas Identificadas: R$ ${analise.totalMultas.toFixed(2)}**\n\n${obrigacoes.map(o =>
        `- **${o.pendencia.tipo}**: R$ ${(o.multaObrigacao?.multa || 0).toFixed(2)}\n  Base legal: ${o.multaObrigacao?.fundamentoLegal || 'N/A'}`
      ).join('\n\n')}\n\n_Para orientação sobre redução de multas, configure a chave da API de IA._`;
    }
    return `As principais multas tributárias federais são:\n\n- **Multa de mora**: 0,33%/dia, max 20% (Art. 61, Lei 9.430/96)\n- **DCTF não entregue**: R$ 500/mês (Art. 7º, Lei 10.426/2002)\n- **ECD/ECF não entregue**: 0,25% do lucro líquido (Art. 12, DL 1.598/77)\n- **EFD não entregue**: R$ 500/mês Lucro Real, R$ 250/mês demais\n\n_Para análise personalizada, configure a chave da API de IA._`;
  }

  if (msg.includes('score') || msg.includes('risco') || msg.includes('compliance')) {
    if (analise) {
      return `**Diagnóstico de Compliance:**\n\n- Score: **${analise.score}/100**\n- Nível de Risco: **${analise.nivelRisco}**\n- Pendências críticas: ${analise.itens.filter(i => i.urgencia === 'Critica').length}\n- Pendências altas: ${analise.itens.filter(i => i.urgencia === 'Alta').length}\n\n${analise.score <= 50 ? '⚠️ **Atenção**: Score abaixo de 50 indica situação fiscal crítica. Recomenda-se regularização imediata.' : analise.score <= 75 ? '⚡ Score moderado. Há pendências que devem ser tratadas para evitar agravamento.' : '✅ Score saudável, mas mantenha o monitoramento contínuo.'}\n\n_Para recomendações detalhadas, configure a chave da API de IA._`;
    }
  }

  if (msg.includes('cnd') || msg.includes('certidão') || msg.includes('certidao') || msg.includes('negativa')) {
    return `**Certidões Negativas de Débitos (CND):**\n\n- **CND Federal/PGFN**: Emitida conjuntamente (Portaria MF 358/2014)\n- **CND Estadual (SEFAZ)**: Relativa ao ICMS\n- **CND Municipal**: ISS e tributos municipais\n- **CRF (FGTS)**: Emitida pela CEF\n- **CNDT (Trabalhista)**: Emitida pelo TST\n\nPara emissão, todos os débitos devem estar quitados ou com exigibilidade suspensa (Art. 206, CTN).\n\n_Para verificação automatizada, utilize o modo Certificado Digital A1._`;
  }

  return `Sou o consultor fiscal IA. Posso ajudar com:\n\n- **Parcelamentos**: opções, simulações, comparações\n- **SELIC/Juros**: cálculo de atualização de débitos\n- **Multas**: penalidades por obrigações acessórias\n- **CNDs**: certidões negativas e regularização\n- **Compliance**: score, riscos, plano de ação\n\nFaça sua pergunta sobre qualquer tema tributário!\n\n_Para respostas mais completas e personalizadas, configure VITE_GEMINI_API_KEY._`;
}
