/**
 * Serviço de Captura de XML de NF-e/NFC-e
 * Integra com SEFAZ para download de XMLs via certificado digital
 */

import {
  ConfiguracaoCaptura,
  ResultadoCaptura,
  XmlCapturado,
  RegistroEFiscal,
  ResumoCaptura,
  StatusCaptura,
} from '../types/xmlCapture';

const API_URL = import.meta.env.VITE_API_URL || 'https://api-sp-compliance-68935026677.southamerica-east1.run.app';

export class XmlCaptureService {
  /**
   * Inicia a captura de XMLs para uma configuração específica
   */
  static async iniciarCaptura(
    config: ConfiguracaoCaptura,
    onProgress?: (step: number, message: string) => void
  ): Promise<ResultadoCaptura> {
    const formData = new FormData();

    formData.append('cnpj', config.cliente.cnpj);
    formData.append('inscricaoEstadual', config.cliente.inscricaoEstadual);
    formData.append('uf', config.cliente.uf);
    formData.append('tipoCertificado', config.cliente.tipoCertificado);
    formData.append('origemCertificado', config.cliente.origemCertificado);
    formData.append('dataInicio', config.periodo.dataInicio);
    formData.append('dataFim', config.periodo.dataFim);
    formData.append('tipoNota', config.tipoNota);

    if (config.cliente.certificadoArquivo) {
      formData.append('certificate', config.cliente.certificadoArquivo);
    }
    if (config.cliente.certificadoSenha) {
      formData.append('password', config.cliente.certificadoSenha);
    }

    // Enviar configurações de armazenamento
    formData.append('armazenamento', JSON.stringify(config.armazenamento));
    formData.append('alertas', JSON.stringify(config.alertas));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch(`${API_URL}/api/v1/xml-capture`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new Error('Erro na comunicação com o servidor de captura de XML.');
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resultado: ResultadoCaptura | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const payload = JSON.parse(line.slice(6));
            if (currentEvent === 'progress' && onProgress) {
              onProgress(payload.step, payload.message);
            } else if (currentEvent === 'result') {
              resultado = payload;
            } else if (currentEvent === 'error') {
              throw new Error(payload.details || payload.error || 'Erro na captura de XML.');
            }
          }
        }
      }

      if (!resultado) {
        throw new Error('Servidor encerrou sem retornar resultado.');
      }

      return resultado;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('A captura excedeu o tempo limite. Tente novamente.');
      }
      throw err;
    }
  }

  /**
   * Gera arquivo de exportação no formato IOB SAGE Folhamatic E-fiscal
   */
  static gerarExportacaoEFiscal(
    xmls: XmlCapturado[],
    cnpjEstabelecimento: string,
    inscricaoEstadual: string,
    encoding: 'UTF-8' | 'ISO-8859-1' | 'Windows-1252' = 'Windows-1252'
  ): string {
    const registros: string[] = [];

    // Registro tipo 10 - Mestre do Estabelecimento
    const reg10 = [
      '10',
      cnpjEstabelecimento.replace(/\D/g, '').padStart(14, '0'),
      inscricaoEstadual.replace(/\D/g, '').padStart(14, ' '),
      '', // Razão social preenchida pelo sistema
      'SP', // UF
      '3550308', // Código município (São Paulo padrão)
      '', // Fax
      this.formatDateEFiscal(xmls[0]?.dataEmissao || new Date().toISOString()),
      this.formatDateEFiscal(xmls[xmls.length - 1]?.dataEmissao || new Date().toISOString()),
      '3', // Código finalidade (3 = Retificação)
    ].join('|');
    registros.push(reg10);

    // Registro tipo 50 - Nota Fiscal (um por NF-e)
    for (const xml of xmls) {
      if (xml.status === 'cancelada' || xml.status === 'denegada') continue;

      const reg50 = [
        '50',
        (xml.tipoNota === 'entrada' ? xml.cnpjEmitente : xml.cnpjDestinatario).replace(/\D/g, '').padStart(14, '0'),
        inscricaoEstadual.replace(/\D/g, '').padStart(14, ' '),
        this.formatDateEFiscal(xml.dataEmissao),
        'SP', // UF
        '55', // Modelo (NF-e)
        xml.serie.padStart(3, '0'),
        xml.numero.padStart(9, '0'),
        xml.cfop || (xml.tipoNota === 'entrada' ? '1102' : '5102'),
        'T', // Tipo do emitente
        xml.valorTotal.toFixed(2).replace('.', ','),
        '0,00', // Base cálculo ICMS
        '0,00', // Valor ICMS
        '0,00', // Isenta ou não tributada
        xml.valorTotal.toFixed(2).replace('.', ','), // Outras
        '0,00', // Alíquota ICMS
        (xml.status as string) === 'cancelada' ? 'S' : 'N', // Situação
      ].join('|');
      registros.push(reg50);

      // Registro tipo 54 - Produto da Nota Fiscal (registro simplificado)
      const reg54 = [
        '54',
        (xml.tipoNota === 'entrada' ? xml.cnpjEmitente : xml.cnpjDestinatario).replace(/\D/g, '').padStart(14, '0'),
        '55',
        xml.serie.padStart(3, '0'),
        xml.numero.padStart(9, '0'),
        xml.cfop || (xml.tipoNota === 'entrada' ? '1102' : '5102'),
        '000', // CST
        '001', // Item
        '', // Código do produto
        xml.valorTotal.toFixed(2).replace('.', ','),
        '0', // Desconto
        '0,00', // Base cálculo ICMS
        '0,00', // Base cálculo ICMS ST
        '0,00', // Valor IPI
        '0,00', // Alíquota ICMS
      ].join('|');
      registros.push(reg54);
    }

    // Registro tipo 75 - Código do Produto ou Serviço
    const reg75 = [
      '75',
      this.formatDateEFiscal(xmls[0]?.dataEmissao || new Date().toISOString()),
      this.formatDateEFiscal(xmls[xmls.length - 1]?.dataEmissao || new Date().toISOString()),
      '001', // Código produto
      '', // NCM
      'DIVERSOS', // Descrição
      'UN', // Unidade
      '0,00', // Alíquota IPI
      '0,00', // Alíquota ICMS
      '0,00', // Redução base cálculo
      '0,00', // Base cálculo ST
    ].join('|');
    registros.push(reg75);

    // Registro tipo 90 - Totalização
    const reg90 = [
      '90',
      cnpjEstabelecimento.replace(/\D/g, '').padStart(14, '0'),
      inscricaoEstadual.replace(/\D/g, '').padStart(14, ' '),
      registros.length.toString(),
    ].join('|');
    registros.push(reg90);

    return registros.join('\r\n');
  }

  /**
   * Gera relatório CSV dos XMLs capturados
   */
  static gerarRelatorioCSV(
    xmls: XmlCapturado[],
    separador: string = ';'
  ): string {
    const headers = [
      'Chave de Acesso',
      'Numero',
      'Serie',
      'Data Emissao',
      'CNPJ Emitente',
      'Nome Emitente',
      'CNPJ Destinatario',
      'Nome Destinatario',
      'Valor Total',
      'Tipo',
      'Status',
      'CFOP',
      'Natureza Operacao',
    ];

    const rows = xmls.map(xml => [
      xml.chaveAcesso,
      xml.numero,
      xml.serie,
      xml.dataEmissao,
      xml.cnpjEmitente,
      xml.nomeEmitente,
      xml.cnpjDestinatario,
      xml.nomeDestinatario,
      xml.valorTotal.toFixed(2).replace('.', ','),
      xml.tipoNota === 'entrada' ? 'Entrada' : 'Saida',
      xml.status,
      xml.cfop || '',
      xml.naturezaOperacao || '',
    ]);

    return [headers.join(separador), ...rows.map(r => r.join(separador))].join('\r\n');
  }

  /**
   * Calcula resumo dos XMLs capturados
   */
  static calcularResumo(xmls: XmlCapturado[], periodo: { dataInicio: string; dataFim: string }): ResumoCaptura {
    const entradas = xmls.filter(x => x.tipoNota === 'entrada');
    const saidas = xmls.filter(x => x.tipoNota === 'saida');
    const canceladas = xmls.filter(x => x.status === 'cancelada');
    const cnpjs = new Set<string>();
    xmls.forEach(x => {
      cnpjs.add(x.cnpjEmitente);
      cnpjs.add(x.cnpjDestinatario);
    });

    return {
      totalNotas: xmls.length,
      totalEntrada: entradas.length,
      totalSaida: saidas.length,
      valorTotalEntrada: entradas.reduce((acc, x) => acc + x.valorTotal, 0),
      valorTotalSaida: saidas.reduce((acc, x) => acc + x.valorTotal, 0),
      notasCanceladas: canceladas.length,
      periodoInicio: periodo.dataInicio,
      periodoFim: periodo.dataFim,
      cnpjsProcessados: Array.from(cnpjs),
    };
  }

  /**
   * Agenda uma captura programada
   */
  static async agendarCaptura(config: ConfiguracaoCaptura): Promise<{ id: string; proximaExecucao: string }> {
    const response = await fetch(`${API_URL}/api/v1/xml-capture/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cnpj: config.cliente.cnpj,
        inscricaoEstadual: config.cliente.inscricaoEstadual,
        uf: config.cliente.uf,
        tipoNota: config.tipoNota,
        trigger: config.trigger,
        armazenamento: config.armazenamento,
        alertas: config.alertas,
      }),
    });

    if (!response.ok) {
      throw new Error('Erro ao agendar captura de XML.');
    }

    return response.json();
  }

  /**
   * Envia alerta por email
   */
  static async enviarAlertaEmail(
    destinatarios: string[],
    assunto: string,
    corpo: string
  ): Promise<void> {
    await fetch(`${API_URL}/api/v1/xml-capture/alert/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatarios, assunto, corpo }),
    });
  }

  /**
   * Envia alerta por Microsoft Teams via webhook
   */
  static async enviarAlertaTeams(
    webhookUrl: string,
    titulo: string,
    mensagem: string,
    resumo?: ResumoCaptura
  ): Promise<void> {
    await fetch(`${API_URL}/api/v1/xml-capture/alert/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, titulo, mensagem, resumo }),
    });
  }

  /**
   * Faz download de um arquivo
   */
  static downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
    const blob = new Blob([content], { type: `${mimeType};charset=windows-1252` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Helpers
  private static formatDateEFiscal(dateStr: string): string {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}${mm}${yyyy}`;
  }
}
