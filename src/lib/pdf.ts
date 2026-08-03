import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';

let fontBytesPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null;

function loadFontBytes() {
  if (!fontBytesPromise) {
    const fontsDir = path.join(process.cwd(), 'src/lib/fonts');
    fontBytesPromise = Promise.all([
      readFile(path.join(fontsDir, 'NotoSansSC-Regular.ttf')),
      readFile(path.join(fontsDir, 'NotoSansSC-Bold.ttf'))
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  return fontBytesPromise;
}

export interface PdfLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface PdfPayload {
  type: string;
  number: string;
  issueDate: string;
  dueDate?: string | null;
  currency?: string | null;
  clientName: string;
  companyName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  workspaceName?: string | null;
  workspaceLogoUrl?: string | null;
  workspaceCompanyName?: string | null;
  workspaceEmail?: string | null;
  workspaceAddress?: string | null;
  taxPercentage: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  items: PdfLineItem[];
}

function wrapText(text: string, maxCharsPerLine: number) {
  const source = text.replace(/\r\n/g, '\n').replace(/[\u2010-\u2015\u2212]/g, '-').trim();
  if (!source) return [];

  const paragraphs = source.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

function money(value: number, currency?: string | null) {
  const symbol = currency?.trim() || '';
  return symbol ? `${symbol} ${value.toFixed(2)}` : value.toFixed(2);
}

async function tryEmbedLogo(pdf: PDFDocument, logoUrl: string) {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;

    const bytes = await response.arrayBuffer();

    try {
      return await pdf.embedPng(bytes);
    } catch {
      return await pdf.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}

export async function renderDocumentPdf(payload: PdfPayload) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([595, 842]);
  const fontBytes = await loadFontBytes();
  const fontOptions = { features: { locl: false } };
  const font = await pdf.embedFont(fontBytes.regular, fontOptions);
  const bold = await pdf.embedFont(fontBytes.bold, fontOptions);

  const left = 50;
  const right = 545;
  const subtle = rgb(0.45, 0.47, 0.5);
  const ink = rgb(0.1, 0.11, 0.13);
  const line = rgb(0.85, 0.86, 0.88);

  let y = 800;

  page.drawText(payload.type.toUpperCase(), { x: left, y, size: 22, font: bold, color: ink });
  y -= 26;
  page.drawText(`#${payload.number}`, { x: left, y, size: 11, font, color: subtle });

  const logoUrl = payload.workspaceLogoUrl?.trim();
  if (logoUrl) {
    const logo = await tryEmbedLogo(pdf, logoUrl);
    if (logo) {
      const maxWidth = 120;
      const maxHeight = 56;
      const ratio = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
      const width = logo.width * ratio;
      const height = logo.height * ratio;
      page.drawImage(logo, {
        x: right - width,
        y: 804 - height,
        width,
        height
      });
    }
  }

  y -= 18;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });

  y -= 20;
  page.drawText('From', { x: left, y, size: 10, font: bold, color: subtle });
  page.drawText('Bill To', { x: 320, y, size: 10, font: bold, color: subtle });

  y -= 16;
  page.drawText(payload.workspaceCompanyName?.trim() || payload.workspaceName?.trim() || '-', {
    x: left,
    y,
    size: 11,
    font: bold,
    color: ink
  });
  page.drawText(payload.clientName || '-', { x: 320, y, size: 11, font: bold, color: ink });

  y -= 15;
  page.drawText(payload.workspaceEmail?.trim() || '-', { x: left, y, size: 10, font, color: ink });
  page.drawText(payload.companyName || '-', { x: 320, y, size: 10, font, color: ink });

  y -= 15;
  page.drawText(payload.workspaceAddress?.trim()?.slice(0, 42) || '-', { x: left, y, size: 10, font, color: ink });
  page.drawText(payload.clientEmail?.trim() || '-', { x: 320, y, size: 10, font, color: ink });

  y -= 15;
  page.drawText('', { x: left, y, size: 10, font, color: ink });
  page.drawText(payload.clientPhone?.trim() || '-', { x: 320, y, size: 10, font, color: ink });

  y -= 18;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });

  y -= 18;
  page.drawText(`Issue: ${payload.issueDate}`, { x: left, y, size: 10, font, color: ink });
  page.drawText(`Due: ${payload.dueDate ?? '-'}`, { x: 215, y, size: 10, font, color: ink });

  y -= 24;

  const tableX = left;
  const tableW = right - left;
  const rowH = 20;
  const colDesc = tableX + 8;
  const colQty = tableX + 235;
  const colPrice = tableX + 320;
  const colTotal = tableX + 425;

  page.drawRectangle({ x: tableX, y: y - rowH + 4, width: tableW, height: rowH, color: rgb(0.96, 0.96, 0.97) });
  page.drawText('Description', { x: colDesc, y: y - 10, size: 10, font: bold, color: subtle });
  page.drawText('Qty', { x: colQty, y: y - 10, size: 10, font: bold, color: subtle });
  page.drawText('Price', { x: colPrice, y: y - 10, size: 10, font: bold, color: subtle });
  page.drawText('Total', { x: colTotal, y: y - 10, size: 10, font: bold, color: subtle });

  y -= rowH;
  page.drawLine({ start: { x: tableX, y: y + 4 }, end: { x: right, y: y + 4 }, thickness: 1, color: line });

  for (const item of payload.items.slice(0, 16)) {
    const descLines = wrapText(item.description || '-', 32).slice(0, 5);
    const rowHeight = Math.max(22, descLines.length * 12 + 8);

    if (y - rowHeight < 220) break;

    const rowTop = y;
    const valueY = rowTop - rowHeight / 2 - 3;

    for (let i = 0; i < descLines.length; i += 1) {
      page.drawText(descLines[i], { x: colDesc, y: rowTop - 12 - i * 12, size: 10, font, color: ink });
    }

    page.drawText(Number(item.quantity).toFixed(2), { x: colQty, y: valueY, size: 10, font, color: ink });
    page.drawText(money(Number(item.unit_price), payload.currency), {
      x: colPrice,
      y: valueY,
      size: 10,
      font,
      color: ink
    });
    page.drawText(money(Number(item.line_total), payload.currency), {
      x: colTotal,
      y: valueY,
      size: 10,
      font,
      color: ink
    });

    y -= rowHeight;
    page.drawLine({ start: { x: tableX, y }, end: { x: right, y }, thickness: 1, color: line });
  }

  y -= 20;

  const totalLabelX = 360;
  const totalValueX = 470;
  page.drawText('Subtotal', { x: totalLabelX, y, size: 10, font, color: subtle });
  page.drawText(money(payload.subtotal, payload.currency), { x: totalValueX, y, size: 10, font: bold, color: ink });

  y -= 15;
  page.drawText(`Tax (${payload.taxPercentage}%)`, { x: totalLabelX, y, size: 10, font, color: subtle });
  page.drawText(money(payload.taxAmount, payload.currency), { x: totalValueX, y, size: 10, font: bold, color: ink });

  y -= 15;
  page.drawLine({ start: { x: totalLabelX, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 14;
  page.drawText('Total', { x: totalLabelX, y, size: 11, font: bold, color: ink });
  page.drawText(money(payload.totalAmount, payload.currency), { x: totalValueX, y, size: 11, font: bold, color: ink });

  if (payload.notes?.trim()) {
    y -= 30;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
    y -= 16;
    page.drawText('Notes', { x: left, y, size: 10, font: bold, color: subtle });
    y -= 14;
    for (const noteLine of wrapText(payload.notes, 95).slice(0, 10)) {
      if (y < 45) break;
      page.drawText(noteLine, { x: left, y, size: 10, font, color: ink });
      y -= 12;
    }
  }

  return Buffer.from(await pdf.save());
}
