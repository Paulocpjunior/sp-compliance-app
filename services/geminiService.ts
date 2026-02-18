import { GoogleGenAI } from "@google/genai";
import { ParsedCertificate } from '../types';

export const analyzeCompliance = async (cert: ParsedCertificate): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("API Key not found, skipping AI analysis.");
    return "Análise de IA indisponível: Chave de API ausente.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      Você é um Auditor Sênior de Compliance para Certificados Digitais Brasileiros (ICP-Brasil).
      Analise os dados extraídos do certificado a seguir e forneça um resumo de compliance breve e profissional.
      
      Dados do Certificado:
      - Nome Comum (CN): ${cert.subject.CN}
      - Organização (O): ${cert.subject.O}
      - CNPJ Detectado: ${cert.cnpj || 'Nenhum'}
      - Emissor: ${cert.issuer.O} (ICP-Brasil: ${cert.isICPBrasil})
      - Válido De: ${cert.validity.notBefore.toISOString()}
      - Válido Até: ${cert.validity.notAfter.toISOString()}
      - Status: ${cert.validity.isValid ? 'Ativo' : 'Expirado'}
      - Dias Restantes: ${cert.validity.daysRemaining}

      Por favor, forneça:
      1. Uma verificação se o certificado parece ser um certificado A1 ICP-Brasil válido.
      2. Um nível de alerta (Baixo, Médio, Crítico) em relação à sua expiração.
      3. Uma verificação se o Emissor é uma autoridade reconhecida (como Soluti, Certisign, Serasa, etc., com base na string da Organização Emissora).
      4. Quaisquer irregularidades potenciais no nome do Titular vs formatação do CNPJ.

      Mantenha a resposta concisa, formatada em Markdown, adequada para um widget de dashboard, e ESTRITAMENTE em Português do Brasil.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Nenhuma análise gerada.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Falha ao gerar relatório de compliance com IA. Por favor, verifique sua conexão.";
  }
};