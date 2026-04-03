/**
 * @fileoverview OCR and invoice text extraction service.
 * Extracts text from PDFs (via pdfjs-dist) and images (via Tesseract.js),
 * then parses invoice data using regex patterns for French/English invoices.
 * Runs entirely client-side with no external paid APIs.
 */

import { Platform } from 'react-native';

export interface ParsedInvoiceData {
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_ht: number | null;
  total_tva: number | null;
  total_ttc: number | null;
  tva_rate: number | null;
  lines: Array<{ description: string; quantity: number; unit_price: number }> | null;
  raw_text: string;
  confidence: 'high' | 'medium' | 'low';
}

function parseAmount(str: string): number | null {
  if (!str) return null;
  let cleaned = str.replace(/[€$£\s ]/g, '').trim();
  if (!cleaned) return null;
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = parts[0].replace(/\./g, '').replace(/\s/g, '') + '.' + parts[1];
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

function parseDateStr(str: string): string | null {
  if (!str) return null;
  const trimmed = str.trim();
  let match = trimmed.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  match = trimmed.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const months: Record<string, string> = {
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
    'jan': '01', 'fév': '02', 'mar': '03', 'avr': '04',
    'jun': '06', 'jul': '07', 'aoû': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'déc': '12',
  };
  for (const [name, num] of Object.entries(months)) {
    const re = new RegExp(`(\\d{1,2})\\s*${name}\\w*\\s*(\\d{4})`, 'i');
    const m2 = trimmed.match(re);
    if (m2) {
      return `${m2[2]}-${num}-${m2[1].padStart(2, '0')}`;
    }
  }
  return null;
}

export function parseInvoiceText(text: string): ParsedInvoiceData {
  const result: ParsedInvoiceData = {
    supplier_name: null,
    invoice_number: null,
    invoice_date: null,
    due_date: null,
    total_ht: null,
    total_tva: null,
    total_ttc: null,
    tva_rate: null,
    lines: null,
    raw_text: text,
    confidence: 'low',
  };

  if (!text || text.length < 10) return result;

  const allLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const invoicePatterns = [
    /(?:facture|invoice)\s*(?:n[°o]?|#|:)\s*[:\s]*([A-Z0-9][A-Z0-9\-/_.]+)/i,
    /(?:FA|FAC|INV|FACT)[_-]?\s*([A-Z0-9\-/_.]+)/i,
    /N[°o]\s*:?\s*([A-Z0-9][A-Z0-9\-/_.]+)/i,
    /(?:référence|ref|réf)\s*(?:facture)?\s*:?\s*([A-Z0-9][A-Z0-9\-/_.]+)/i,
  ];
  for (const pattern of invoicePatterns) {
    const m = text.match(pattern);
    if (m && m[1].trim().length >= 2) {
      result.invoice_number = m[1].trim();
      break;
    }
  }

  const datePatterns = [
    /(?:date\s*(?:de\s*)?(?:la\s*)?facture|invoice\s*date|date\s*d[''’]émission|date\s*:)\s*[:\s]*(.{8,30})/i,
    /(?:émis(?:e)?\s*le|du)\s*[:\s]*(.{8,30})/i,
    /(?:date\s*facture)\s*[:\s]*(.{8,30})/i,
  ];
  for (const pattern of datePatterns) {
    const m = text.match(pattern);
    if (m) {
      const parsed = parseDateStr(m[1]);
      if (parsed) { result.invoice_date = parsed; break; }
    }
  }
  if (!result.invoice_date) {
    const globalDateMatch = text.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/);
    if (globalDateMatch) {
      result.invoice_date = parseDateStr(globalDateMatch[1]);
    }
  }

  const dueDatePatterns = [
    /(?:échéance|date\s*d[''’]échéance|due\s*date|payable\s*(?:avant|le)|à\s*régler\s*(?:avant|le))\s*[:\s]*(.{8,30})/i,
    /(?:date\s*limite\s*(?:de\s*)?paiement)\s*[:\s]*(.{8,30})/i,
  ];
  for (const pattern of dueDatePatterns) {
    const m = text.match(pattern);
    if (m) {
      const parsed = parseDateStr(m[1]);
      if (parsed) { result.due_date = parsed; break; }
    }
  }

  const supplierPatterns = [
    /(?:de\s*:|from\s*:|émetteur\s*:|fournisseur\s*:|raison\s*sociale\s*:)\s*(.+)/i,
  ];
  for (const pattern of supplierPatterns) {
    const m = text.match(pattern);
    if (m && m[1].trim().length > 2) {
      result.supplier_name = m[1].trim().split('\n')[0].trim();
      break;
    }
  }
  if (!result.supplier_name && allLines.length > 0) {
    for (const line of allLines.slice(0, 8)) {
      if (
        line.length > 3 &&
        line.length < 80 &&
        /[a-zA-ZÀ-ÿ]/.test(line) &&
        !/^\d+$/.test(line) &&
        !/^(facture|invoice|date|total|tva|tax|n[°o]|page|siret|siren|tél|email|adresse|code|iban|bic)/i.test(line) &&
        !/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(line)
      ) {
        result.supplier_name = line;
        break;
      }
    }
  }

  const htPatterns = [
    /(?:total\s*(?:hors\s*taxes?|H\.?T\.?)|sous[_\-\s]*total\s*(?:H\.?T\.?)?|subtotal|total\s*net\s*(?:H\.?T\.?)?)\s*[:\s]*([\d\s ]+[,.]\d{2})/i,
    /(?:montant\s*H\.?T\.?)\s*[:\s]*([\d\s ]+[,.]\d{2})/i,
  ];
  for (const pattern of htPatterns) {
    const m = text.match(pattern);
    if (m) { result.total_ht = parseAmount(m[1]); break; }
  }

  const tvaAmountPatterns = [
    /(?:total\s*TVA|montant\s*(?:de\s*la\s*)?TVA|TVA\s*(?:\d+[,.]\d*\s*%\s*)?(?:sur|:))\s*[:\s]*([\d\s ]+[,.]\d{2})/i,
    /(?:TVA)\s*[:\s]*([\d\s ]+[,.]\d{2})/i,
  ];
  for (const pattern of tvaAmountPatterns) {
    const m = text.match(pattern);
    if (m) { result.total_tva = parseAmount(m[1]); break; }
  }

  const ttcPatterns = [
    /(?:total\s*T\.?T\.?C\.?|montant\s*T\.?T\.?C\.?|net\s*à\s*payer|amount\s*due|total\s*à\s*payer|montant\s*à\s*régler)\s*[:\s]*([\d\s ]+[,.]\d{2})/i,
    /(?:total\s*général)\s*[:\s]*([\d\s ]+[,.]\d{2})/i,
  ];
  for (const pattern of ttcPatterns) {
    const m = text.match(pattern);
    if (m) { result.total_ttc = parseAmount(m[1]); break; }
  }

  if (!result.total_ttc) {
    const amountRegex = /([\d\s ]+[,.]\d{2})/g;
    const allAmounts = text.match(amountRegex);
    if (allAmounts) {
      let max = 0;
      for (const a of allAmounts) {
        const parsed = parseAmount(a);
        if (parsed && parsed > max) max = parsed;
      }
      if (max > 0) result.total_ttc = max;
    }
  }

  if (result.total_ht && result.total_ttc && !result.total_tva) {
    result.total_tva = Math.round((result.total_ttc - result.total_ht) * 100) / 100;
  }
  if (result.total_tva && result.total_ttc && !result.total_ht) {
    result.total_ht = Math.round((result.total_ttc - result.total_tva) * 100) / 100;
  }

  const tvaRatePatterns = [
    /TVA\s*(?:à\s*)?(\d+(?:[,.]\d+)?)\s*%/i,
    /(\d+(?:[,.]\d+)?)\s*%\s*(?:TVA|tax)/i,
    /taux\s*(?:de\s*)?TVA\s*[:\s]*(\d+(?:[,.]\d+)?)\s*%/i,
  ];
  for (const pattern of tvaRatePatterns) {
    const m = text.match(pattern);
    if (m) {
      const rate = parseFloat(m[1].replace(',', '.'));
      if (rate > 0 && rate <= 100) { result.tva_rate = rate; break; }
    }
  }
  if (!result.tva_rate && result.total_ht && result.total_tva && result.total_ht > 0) {
    const computed = Math.round((result.total_tva / result.total_ht) * 1000) / 10;
    const standardRates = [20, 10, 5.5, 2.1, 0];
    const closest = standardRates.reduce((prev, curr) =>
      Math.abs(curr - computed) < Math.abs(prev - computed) ? curr : prev
    );
    if (Math.abs(closest - computed) < 2) {
      result.tva_rate = closest;
    } else {
      result.tva_rate = computed;
    }
  }

  const productLines: Array<{ description: string; quantity: number; unit_price: number }> = [];
  for (const line of allLines) {
    const numbers = line.match(/([\d\s ]+[,.]\d{2})/g);
    if (numbers && numbers.length >= 2) {
      const firstNumIdx = line.indexOf(numbers[0]);
      const desc = line.substring(0, firstNumIdx).trim();
      if (desc.length > 2 && !/total|sous|tva|tax|ht|ttc|net|montant|base/i.test(desc)) {
        const qtyMatch = desc.match(/^(\d+)\s+/) || line.match(/\b(\d+)\s*(?:x|×)/i);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        const unitPrice = parseAmount(numbers[0]);
        if (unitPrice && unitPrice > 0) {
          const cleanDesc = desc.replace(/^\d+\s+/, '').trim();
          productLines.push({
            description: cleanDesc || desc,
            quantity: qty,
            unit_price: unitPrice,
          });
        }
      }
    }
  }
  if (productLines.length > 0) result.lines = productLines;

  let fieldsFound = 0;
  if (result.supplier_name) fieldsFound++;
  if (result.invoice_number) fieldsFound++;
  if (result.invoice_date) fieldsFound++;
  if (result.due_date) fieldsFound++;
  if (result.total_ht) fieldsFound++;
  if (result.total_tva) fieldsFound++;
  if (result.total_ttc) fieldsFound++;
  if (result.tva_rate) fieldsFound++;
  if (result.lines && result.lines.length > 0) fieldsFound++;

  if (fieldsFound >= 5) result.confidence = 'high';
  else if (fieldsFound >= 3) result.confidence = 'medium';
  else result.confidence = 'low';

  return result;
}

export async function extractTextFromPDF(
  fileUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (Platform.OS !== 'web') {
    throw new Error("L'extraction PDF n'est disponible que sur navigateur web");
  }

  onProgress?.(0.1);

  try {
    const PDFJS_VERSION = '3.11.174';
    const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

    const globalAny = globalThis as any;
    if (!globalAny.pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${PDFJS_CDN}/pdf.min.js`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load pdfjs'));
        document.head.appendChild(script);
      });
    }

    const pdfjsLib = globalAny.pdfjsLib;
    if (!pdfjsLib) throw new Error('pdfjs-dist not loaded');

    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;

    const response = await fetch(fileUri);
    const arrayBuffer = await response.arrayBuffer();
    onProgress?.(0.2);

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    let fullText = '';
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: { str?: string }) => item.str || '')
        .join(' ');
      fullText += pageText + '\n';
      onProgress?.(0.2 + (i / numPages) * 0.7);
    }

    onProgress?.(1);
    return fullText;
  } catch (err) {
    throw new Error("Erreur lors de l'extraction du texte PDF");
  }
}

export async function extractTextFromImage(
  imageUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (Platform.OS !== 'web') {
    throw new Error("L'OCR n'est disponible que sur navigateur web");
  }

  onProgress?.(0.05);

  try {
    const Tesseract = require('tesseract.js');

    const result = await Tesseract.recognize(imageUri, 'fra+eng', {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          onProgress?.(0.1 + m.progress * 0.85);
        }
      },
    });

    onProgress?.(1);
    const text = result.data.text || '';
    return text;
  } catch (err) {
    throw new Error("Erreur lors de la reconnaissance de texte (OCR)");
  }
}

export async function processInvoiceFile(
  fileUri: string,
  fileType: 'pdf' | 'image',
  onProgress?: (progress: number, step: string) => void,
): Promise<ParsedInvoiceData> {
  let text = '';

  if (fileType === 'pdf') {
    onProgress?.(0.05, 'Extraction du texte du PDF...');
    try {
      text = await extractTextFromPDF(fileUri, (p) => {
        onProgress?.(0.05 + p * 0.5, 'Extraction du texte du PDF...');
      });
    } catch {
      text = '';
    }

    if (text.trim().length < 20) {
      onProgress?.(0.55, 'PDF scanné détecté — Lancement OCR (peut prendre 10-20s)...');
      try {
        text = await extractTextFromImage(fileUri, (p) => {
          onProgress?.(0.55 + p * 0.35, 'Reconnaissance de texte (OCR)...');
        });
      } catch {
      }
    }
  } else {
    onProgress?.(0.05, 'Reconnaissance de texte (OCR)...');
    try {
      text = await extractTextFromImage(fileUri, (p) => {
        onProgress?.(0.05 + p * 0.85, 'Reconnaissance de texte (OCR)...');
      });
    } catch (err) {
    }
  }

  onProgress?.(0.92, 'Analyse des données...');
  const result = parseInvoiceText(text);
  onProgress?.(1, 'Terminé');

  return result;
}
