import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnaliseCompleta } from './aiAnalysisService';

const COLORS = {
  primary: [55, 48, 163] as [number, number, number],    // indigo-800
  secondary: [100, 116, 139] as [number, number, number], // slate-500
  danger: [220, 38, 38] as [number, number, number],      // red-600
  warning: [234, 179, 8] as [number, number, number],     // yellow-500
  success: [22, 163, 74] as [number, number, number],     // green-600
  dark: [30, 41, 59] as [number, number, number],         // slate-800
  light: [248, 250, 252] as [number, number, number],     // slate-50
};

function riskColor(nivel: string): [number, number, number] {
  switch (nivel) {
    case 'Critical': return COLORS.danger;
    case 'High': return [249, 115, 22]; // orange
    case 'Medium': return COLORS.warning;
    default: return COLORS.success;
  }
}

function riskLabel(nivel: string): string {
  switch (nivel) {
    case 'Critical': return 'CRITICO';
    case 'High': return 'ALTO';
    case 'Medium': return 'MEDIO';
    default: return 'BAIXO';
  }
}

function fmtBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function gerarRelatorioPDF(
  analise: AnaliseCompleta,
  nomeEmpresa: string,
  cnpj: string
): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ---- HEADER ----
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DIAGNOSTICO FISCAL', margin, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SP Assessoria Contabil - Relatorio de Compliance Tributario', margin, 24);

  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin, 32);

  y = 50;

  // ---- DADOS DA EMPRESA ----
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA EMPRESA', margin, y);
  y += 6;

  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.text(`Razao Social: ${nomeEmpresa}`, margin, y);
  y += 5;
  if (cnpj) {
    doc.text(`CNPJ: ${cnpj}`, margin, y);
    y += 5;
  }
  y += 4;

  // ---- SCORE BOX ----
  const boxWidth = contentWidth / 2 - 4;
  const rColor = riskColor(analise.nivelRisco);

  // Score box
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(margin, y, boxWidth, 24, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.secondary);
  doc.text('SCORE DE COMPLIANCE', margin + 4, y + 6);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(`${analise.score}/100`, margin + 4, y + 18);

  // Risk box
  doc.setFillColor(...rColor);
  doc.roundedRect(margin + boxWidth + 8, y, boxWidth, 24, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('NIVEL DE RISCO', margin + boxWidth + 12, y + 6);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(riskLabel(analise.nivelRisco), margin + boxWidth + 12, y + 18);

  y += 32;

  // ---- KPIs ----
  const kpiData = [
    ['Pendencias', `${analise.itens.length}`],
    ['Valor Original', fmtBRL(analise.totalOriginal)],
    ['Total Atualizado', fmtBRL(analise.totalAtualizado)],
    ['Juros SELIC', fmtBRL(analise.totalJuros)],
    ['Multas', fmtBRL(analise.totalMultas)],
  ];

  autoTable(doc, {
    startY: y,
    head: [kpiData.map(k => k[0])],
    body: [kpiData.map(k => k[1])],
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      textColor: COLORS.dark,
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ---- DEBITOS ----
  const debitos = analise.itens.filter(i => i.categoria === 'debito');
  if (debitos.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('DEBITOS EM ABERTO', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Orgao', 'Original', 'Atualizado', 'Juros', 'Multa Mora', 'Urgencia']],
      body: debitos.map(d => [
        d.pendencia.tipo,
        d.pendencia.orgao,
        fmtBRL(d.pendencia.valor || 0),
        fmtBRL(d.selicCalculo?.valorAtualizado || d.pendencia.valor || 0),
        fmtBRL(d.selicCalculo?.jurosAcumulados || 0),
        fmtBRL(d.selicCalculo?.multaMora || 0),
        d.urgencia,
      ]),
      margin: { left: margin, right: margin },
      theme: 'striped',
      headStyles: { fillColor: COLORS.danger, fontSize: 7, fontStyle: 'bold', textColor: [255, 255, 255] },
      bodyStyles: { fontSize: 7, textColor: COLORS.dark },
      columnStyles: {
        0: { cellWidth: 30 },
        6: { fontStyle: 'bold' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ---- OBRIGACOES AUSENTES ----
  const obrigacoes = analise.itens.filter(i => i.categoria === 'obrigacao_ausente');
  if (obrigacoes.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('OBRIGACOES ACESSORIAS AUSENTES', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Obrigacao', 'Orgao', 'Multa Estimada', 'Fundamentacao Legal', 'Urgencia']],
      body: obrigacoes.map(o => [
        o.pendencia.tipo,
        o.pendencia.orgao,
        fmtBRL(o.multaObrigacao?.multa || 0),
        o.multaObrigacao?.fundamentoLegal || 'N/A',
        o.urgencia,
      ]),
      margin: { left: margin, right: margin },
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22], fontSize: 7, fontStyle: 'bold', textColor: [255, 255, 255] },
      bodyStyles: { fontSize: 7, textColor: COLORS.dark },
      columnStyles: { 4: { fontStyle: 'bold' } },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ---- PARCELAMENTOS ----
  const sugestoes = analise.sugestoesParcelamento.filter(s => s.economiaTotal > 0);
  if (sugestoes.length > 0) {
    if (y > 220) { doc.addPage(); y = margin; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('OPCOES DE PARCELAMENTO', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Programa', 'Lei', 'Parcelas', 'Valor Parcela', 'Economia', 'Desc. Multa', 'Desc. Juros', '']],
      body: sugestoes.map(s => [
        s.nome,
        s.lei,
        `${s.parcelas}x`,
        fmtBRL(s.valorParcela),
        fmtBRL(s.economiaTotal),
        `${s.descontoMulta}%`,
        `${s.descontoJuros}%`,
        s.maisVantajoso ? 'RECOMENDADO' : '',
      ]),
      margin: { left: margin, right: margin },
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, fontSize: 7, fontStyle: 'bold', textColor: [255, 255, 255] },
      bodyStyles: { fontSize: 7, textColor: COLORS.dark },
      columnStyles: {
        7: { fontStyle: 'bold', textColor: COLORS.success },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ---- PLANO DE ACAO (text) ----
  if (analise.planoAcao) {
    if (y > 200) { doc.addPage(); y = margin; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('PLANO DE ACAO', margin, y);
    y += 6;

    // Clean markdown for PDF
    const cleanText = analise.planoAcao
      .replace(/#{1,3} /g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/⭐/g, '[RECOMENDADO]');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);

    const lines = doc.splitTextToSize(cleanText, contentWidth);
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 4;
    }
  }

  // ---- FOOTER on each page ----
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.secondary);
    doc.text(
      `SP Assessoria Contabil - Diagnostico Fiscal | Pagina ${i}/${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
    doc.text(
      'Este relatorio tem carater informativo. Consulte seu contador para decisoes fiscais.',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 4,
      { align: 'center' }
    );
  }

  // Save
  const fileName = `diagnostico-fiscal-${nomeEmpresa.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
