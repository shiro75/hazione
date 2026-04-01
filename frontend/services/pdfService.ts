/**
 * @fileoverview PDF generation and sharing service.
 * Generates HTML templates for invoices, quotes, credit notes, and sales receipts,
 * then uses the browser print API (web) or expo-print/sharing (native) to export.
 */

import { Platform } from 'react-native';
import type { Invoice, Quote, Company, Client, OrderItem, QuoteItem, Sale, Product } from '@/types';

function formatCurrencyPdf(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildItemsTableRows(items: (OrderItem | QuoteItem)[], currency: string = 'EUR'): string {
  return items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#1E293B;">${item.productName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;text-align:right;">${formatCurrencyPdf(item.unitPrice, currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;text-align:center;">${item.vatRate}%</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#1E293B;text-align:right;font-weight:600;">${formatCurrencyPdf(item.totalHT, currency)}</td>
    </tr>
  `).join('');
}

function buildBaseHTML(params: {
  title: string;
  documentNumber: string;
  company: Company;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  issueDate: string;
  dueDate?: string;
  expirationDate?: string;
  items: (OrderItem | QuoteItem)[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  legalMentions?: string;
  paymentTerms?: string;
  notes?: string;
  isQuote?: boolean;
  currency?: string;
}): string {
  const {
    title, documentNumber, company, clientName, clientAddress, clientEmail,
    issueDate, dueDate, expirationDate, items, totalHT, totalTVA, totalTTC,
    legalMentions, paymentTerms, notes, isQuote,
  } = params;
  const cur = params.currency || company.currency || 'EUR';

  const logoSection = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="Logo" style="max-height:60px;max-width:200px;" />`
    : `<div style="font-size:24px;font-weight:700;color:#0F172A;">${company.name}</div>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1E293B; background: #fff; }
    @page { margin: 40px; }
  </style>
</head>
<body style="padding:40px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
    <div>
      ${logoSection}
      <div style="margin-top:8px;font-size:12px;color:#64748B;">
        ${company.legalStructure ? company.legalStructure + ' · ' : ''}SIRET: ${company.siret || 'N/A'}<br/>
        TVA: ${company.vatNumber || 'N/A'}<br/>
        ${company.address || ''}, ${company.postalCode || ''} ${company.city || ''}<br/>
        ${company.phone ? 'Tél: ' + company.phone : ''} ${company.email ? '· ' + company.email : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:28px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:1px;">${title}</div>
      <div style="font-size:16px;font-weight:600;color:#3B82F6;margin-top:4px;">${documentNumber}</div>
      <div style="font-size:12px;color:#64748B;margin-top:8px;">
        Date d'émission : ${formatDate(issueDate)}<br/>
        ${dueDate ? 'Date d\'échéance : ' + formatDate(dueDate) : ''}
        ${expirationDate ? 'Valide jusqu\'au : ' + formatDate(expirationDate) : ''}
      </div>
    </div>
  </div>

  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:20px;margin-bottom:30px;">
    <div style="font-size:11px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Client</div>
    <div style="font-size:15px;font-weight:600;color:#0F172A;">${clientName}</div>
    ${clientAddress ? `<div style="font-size:13px;color:#64748B;margin-top:4px;">${clientAddress}</div>` : ''}
    ${clientEmail ? `<div style="font-size:13px;color:#64748B;margin-top:2px;">${clientEmail}</div>` : ''}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:#F1F5F9;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Désignation</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Qté</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Prix unit. HT</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">TVA</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${buildItemsTableRows(items, cur)}
    </tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:30px;">
    <div style="width:280px;">
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;">
        <span style="color:#64748B;">Sous-total HT</span>
        <span style="color:#1E293B;font-weight:500;">${formatCurrencyPdf(totalHT, cur)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;">
        <span style="color:#64748B;">TVA</span>
        <span style="color:#1E293B;font-weight:500;">${formatCurrencyPdf(totalTVA, cur)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:16px;border-top:2px solid #0F172A;margin-top:4px;">
        <span style="font-weight:700;color:#0F172A;">Total TTC</span>
        <span style="font-weight:700;color:#0F172A;">${formatCurrencyPdf(totalTTC, cur)}</span>
      </div>
    </div>
  </div>

  ${paymentTerms ? `
  <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px;margin-bottom:16px;">
    <div style="font-size:12px;font-weight:600;color:#166534;">${paymentTerms}</div>
    ${company.iban ? `<div style="font-size:12px;color:#166534;margin-top:4px;">IBAN: ${company.iban} ${company.bic ? '· BIC: ' + company.bic : ''}</div>` : ''}
  </div>
  ` : ''}

  ${isQuote ? `
  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:14px;margin-bottom:16px;">
    <div style="font-size:12px;font-weight:600;color:#92400E;">Bon pour accord</div>
    <div style="font-size:11px;color:#92400E;margin-top:4px;">
      Ce devis est valable jusqu'au ${formatDate(expirationDate || '')}. 
      Signature du client :
    </div>
    <div style="height:60px;border-bottom:1px dashed #D97706;margin-top:20px;"></div>
  </div>
  ` : ''}

  ${notes ? `
  <div style="margin-bottom:16px;">
    <div style="font-size:11px;font-weight:600;color:#94A3B8;text-transform:uppercase;margin-bottom:6px;">Notes</div>
    <div style="font-size:12px;color:#64748B;">${notes}</div>
  </div>
  ` : ''}

  ${legalMentions ? `
  <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:20px;">
    <div style="font-size:10px;color:#94A3B8;line-height:1.5;">${legalMentions}</div>
  </div>
  ` : ''}
</body>
</html>`;
}

export function generateInvoiceHTML(invoice: Invoice, company: Company, client?: Client): string {
  return buildBaseHTML({
    title: 'Facture',
    documentNumber: invoice.invoiceNumber || 'Brouillon',
    company,
    clientName: invoice.clientName,
    clientAddress: client ? `${client.address || ''}, ${client.postalCode || ''} ${client.city || ''}` : undefined,
    clientEmail: client?.email,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    items: invoice.items,
    totalHT: invoice.totalHT,
    totalTVA: invoice.totalTVA,
    totalTTC: invoice.totalTTC,
    legalMentions: invoice.legalMentions,
    paymentTerms: invoice.paymentTerms,
  });
}

export function generateQuoteHTML(quote: Quote, company: Company, client?: Client): string {
  return buildBaseHTML({
    title: 'Devis',
    documentNumber: quote.quoteNumber,
    company,
    clientName: quote.clientName,
    clientAddress: client ? `${client.address || ''}, ${client.postalCode || ''} ${client.city || ''}` : undefined,
    clientEmail: client?.email,
    issueDate: quote.issueDate,
    expirationDate: quote.expirationDate,
    items: quote.items,
    totalHT: quote.totalHT,
    totalTVA: quote.totalTVA,
    totalTTC: quote.totalTTC,
    notes: quote.notes,
    isQuote: true,
  });
}

export async function generateAndSharePDF(html: string, fileName: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        return true;
      }
      return false;
    }

    const Print: any = await import('expo-print');
    const Sharing: any = await import('expo-sharing');

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: fileName,
        UTI: 'com.adobe.pdf',
      });
      return true;
    } else {
      await Print.printAsync({ html });
      return true;
    }
  } catch {
    return false;
  }
}

export function generateReceiptHTML(sale: Sale, company: Company): string {
  const cur = company.currency || 'EUR';
  const fmtCur = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(amount);
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };
  const paymentLabels: Record<string, string> = { cash: 'Espèces', card: 'Carte bancaire', transfer: 'Virement', twint: 'TWINT', check: 'Chèque', mobile: 'Mobile Money', mobile_wave: 'Wave', mobile_om: 'Orange Money', mixed: 'Paiement mixte' };

  const vatGroups: Record<number, { ht: number; tva: number }> = {};
  sale.items.forEach(item => {
    if (!vatGroups[item.vatRate]) vatGroups[item.vatRate] = { ht: 0, tva: 0 };
    vatGroups[item.vatRate].ht += item.totalHT;
    vatGroups[item.vatRate].tva += item.totalTVA;
  });

  const vatRows = Object.entries(vatGroups).map(([rate, vals]) =>
    `<tr><td style="padding:2px 0;font-size:11px;">TVA ${rate}%</td><td style="padding:2px 0;font-size:11px;text-align:right;">${fmtCur(vals.ht)}</td><td style="padding:2px 0;font-size:11px;text-align:right;">${fmtCur(vals.tva)}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', monospace; width:80mm; margin:0 auto; padding:8mm 4mm; font-size:12px; color:#000; }
    .center { text-align:center; }
    .right { text-align:right; }
    .bold { font-weight:700; }
    .divider { border-top:1px dashed #000; margin:6px 0; }
    table { width:100%; border-collapse:collapse; }
    @page { margin:0; size:80mm auto; }
  </style></head><body>
    <div class="center bold" style="font-size:16px;margin-bottom:4px;">${company.name || 'Mon entreprise'}</div>
    ${company.address ? `<div class="center" style="font-size:10px;">${company.address}, ${company.postalCode || ''} ${company.city || ''}</div>` : ''}
    ${company.phone ? `<div class="center" style="font-size:10px;">Tél: ${company.phone}</div>` : ''}
    ${company.siret ? `<div class="center" style="font-size:10px;">SIRET: ${company.siret}</div>` : ''}
    ${company.vatNumber ? `<div class="center" style="font-size:10px;">TVA: ${company.vatNumber}</div>` : ''}
    <div class="divider"></div>
    <div class="center bold" style="font-size:14px;">TICKET DE CAISSE</div>
    <div class="center" style="font-size:11px;margin-bottom:4px;">${sale.saleNumber}</div>
    <div style="font-size:11px;">Date: ${fmtDate(sale.createdAt)}</div>
    ${sale.clientName ? `<div style="font-size:11px;">Client: ${sale.clientName}</div>` : ''}
    <div class="divider"></div>
    <table>
      <thead><tr>
        <th style="text-align:left;font-size:11px;padding:2px 0;">Article</th>
        <th style="text-align:center;font-size:11px;">Qté</th>
        <th style="text-align:right;font-size:11px;">P.U.</th>
        <th style="text-align:right;font-size:11px;">Total</th>
      </tr></thead>
      <tbody>
        ${sale.items.map(item => `<tr>
          <td style="padding:3px 0;font-size:11px;">${item.productName}</td>
          <td style="padding:3px 0;font-size:11px;text-align:center;">${item.quantity}</td>
          <td style="padding:3px 0;font-size:11px;text-align:right;">${fmtCur(item.unitPrice)}</td>
          <td style="padding:3px 0;font-size:11px;text-align:right;">${fmtCur(item.totalTTC)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="divider"></div>
    <table>
      <tr><td class="bold" style="font-size:11px;">Total HT</td><td class="right" style="font-size:11px;">${fmtCur(sale.totalHT)}</td></tr>
      ${vatRows ? `<tr><td colspan="3" style="padding:2px 0;"><table style="width:100%;">${vatRows}</table></td></tr>` : ''}
      <tr><td class="bold" style="font-size:11px;">Total TVA</td><td class="right" style="font-size:11px;">${fmtCur(sale.totalTVA)}</td></tr>
    </table>
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;">
      <span class="bold" style="font-size:16px;">TOTAL TTC</span>
      <span class="bold" style="font-size:16px;">${fmtCur(sale.totalTTC)}</span>
    </div>
    <div class="divider"></div>
    <div style="font-size:11px;">Paiement: ${paymentLabels[sale.paymentMethod] || sale.paymentMethod}</div>
    ${sale.mobilePhone ? `<div style="font-size:11px;">Tél client: ${sale.mobilePhone}</div>` : ''}
    ${sale.mobileRef ? `<div style="font-size:11px;">Réf. transaction: ${sale.mobileRef}</div>` : ''}
    ${sale.mixedPayments && sale.mixedPayments.length > 0 ? sale.mixedPayments.map(mp => `<div style="font-size:11px;"> · ${paymentLabels[mp.method] || mp.method}: ${fmtCur(mp.amount)}</div>`).join('') : ''}
    <div class="divider"></div>
    <div class="center" style="font-size:10px;margin-top:8px;">Merci de votre visite !</div>
    <div class="center" style="font-size:9px;margin-top:4px;">${company.email || ''}</div>
    ${company.website ? `<div class="center" style="font-size:9px;">${company.website}</div>` : ''}
  </body></html>`;
}

function fmtCurReport(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(amount));
}

function buildReportHeader(company: Company, title: string): string {
  const logoSection = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="Logo" style="max-height:50px;max-width:180px;" />`
    : `<div style="font-size:22px;font-weight:700;color:#0F172A;">${company.name}</div>`;
  const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E293B;background:#fff;padding:40px; }
  @page { margin:30px; }
  table { width:100%;border-collapse:collapse; }
  th { padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;background:#F1F5F9;border-bottom:2px solid #E2E8F0; }
  td { padding:8px 10px;font-size:12px;border-bottom:1px solid #E2E8F0; }
  .right { text-align:right; }
  .center { text-align:center; }
  h2 { font-size:16px;font-weight:700;color:#0F172A;margin:24px 0 12px; }
  .kpi { display:inline-block;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 20px;margin:6px;min-width:160px; }
  .kpi-label { font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px; }
  .kpi-value { font-size:20px;font-weight:700;color:#0F172A;margin-top:4px; }
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;border-bottom:2px solid #2563EB;padding-bottom:20px;">
    <div>${logoSection}<div style="font-size:11px;color:#64748B;margin-top:6px;">${company.address || ''} ${company.city || ''}</div></div>
    <div style="text-align:right;"><div style="font-size:22px;font-weight:700;color:#2563EB;">${title}</div><div style="font-size:12px;color:#64748B;margin-top:6px;">Généré le ${now}</div></div>
  </div>`;
}

export function generateSalesReportHTML(params: {
  company: Company;
  sales: Sale[];
  invoices: Invoice[];
  clients: Client[];
  periodLabel: string;
  currency: string;
}): string {
  const { company, sales, invoices, clients, periodLabel, currency } = params;
  const cur = currency;
  const paidSales = sales.filter(s => s.status === 'paid');
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalCA = paidSales.reduce((s, sale) => s + sale.totalTTC, 0) + paidInvoices.reduce((s, i) => s + i.totalTTC, 0);
  const totalCount = paidSales.length + paidInvoices.length;

  const productMap = new Map<string, { name: string; qty: number; ca: number }>();
  for (const sale of paidSales) {
    for (const item of sale.items) {
      const e = productMap.get(item.productId) || { name: item.productName, qty: 0, ca: 0 };
      e.qty += item.quantity; e.ca += item.totalTTC;
      productMap.set(item.productId, e);
    }
  }
  const topProducts = Array.from(productMap.values()).sort((a, b) => b.ca - a.ca).slice(0, 10);

  const payMethodMap = new Map<string, { count: number; total: number }>();
  for (const sale of paidSales) {
    const e = payMethodMap.get(sale.paymentMethod) || { count: 0, total: 0 };
    e.count++; e.total += sale.totalTTC;
    payMethodMap.set(sale.paymentMethod, e);
  }

  const clientMap = new Map<string, { name: string; ca: number }>();
  for (const sale of paidSales) {
    if (sale.clientId) {
      const c = clients.find(cl => cl.id === sale.clientId);
      const name = sale.clientName || c?.companyName || `${c?.firstName || ''} ${c?.lastName || ''}`;
      const e = clientMap.get(sale.clientId) || { name, ca: 0 };
      e.ca += sale.totalTTC;
      clientMap.set(sale.clientId, e);
    }
  }
  const topClients = Array.from(clientMap.values()).sort((a, b) => b.ca - a.ca).slice(0, 5);

  let html = buildReportHeader(company, 'Rapport de ventes');
  html += `<div style="margin-bottom:16px;"><span style="font-size:13px;color:#64748B;">Période : </span><span style="font-size:13px;font-weight:600;color:#0F172A;">${periodLabel}</span></div>`;
  html += `<div style="margin-bottom:24px;"><div class="kpi"><div class="kpi-label">CA Total</div><div class="kpi-value">${fmtCurReport(totalCA, cur)}</div></div>`;
  html += `<div class="kpi"><div class="kpi-label">Nombre de ventes</div><div class="kpi-value">${totalCount}</div></div></div>`;

  if (topProducts.length > 0) {
    html += `<h2>Détail par produit</h2><table><thead><tr><th>Produit</th><th class="center">Qté vendue</th><th class="right">CA</th></tr></thead><tbody>`;
    for (const p of topProducts) {
      html += `<tr><td>${p.name}</td><td class="center">${p.qty}</td><td class="right" style="font-weight:600;">${fmtCurReport(p.ca, cur)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  if (payMethodMap.size > 0) {
    const labels: Record<string, string> = { cash:'Espèces', card:'Carte', transfer:'Virement', mobile_wave:'Wave', mobile_om:'Orange Money', mixed:'Mixte', check:'Chèque', twint:'TWINT' };
    html += `<h2>Par mode de paiement</h2><table><thead><tr><th>Mode</th><th class="center">Ventes</th><th class="right">Total</th></tr></thead><tbody>`;
    for (const [method, data] of payMethodMap) {
      html += `<tr><td>${labels[method] || method}</td><td class="center">${data.count}</td><td class="right" style="font-weight:600;">${fmtCurReport(data.total, cur)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  if (topClients.length > 0) {
    html += `<h2>Top 5 clients</h2><table><thead><tr><th>Client</th><th class="right">CA</th></tr></thead><tbody>`;
    for (const c of topClients) {
      html += `<tr><td>${c.name}</td><td class="right" style="font-weight:600;">${fmtCurReport(c.ca, cur)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `</body></html>`;
  return html;
}

export function generateStockReportHTML(params: {
  company: Company;
  products: Product[];
  currency: string;
}): string {
  const { company, products, currency } = params;
  const cur = currency;
  const physicalProducts = products.filter(p => p.type !== 'service' && !p.isArchived);
  const outOfStock = physicalProducts.filter(p => p.stockQuantity <= 0);
  const belowThreshold = physicalProducts.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold);
  const totalValue = physicalProducts.reduce((s, p) => s + p.stockQuantity * p.purchasePrice, 0);

  let html = buildReportHeader(company, 'Rapport de stock');
  html += `<div style="margin-bottom:24px;"><div class="kpi"><div class="kpi-label">Produits</div><div class="kpi-value">${physicalProducts.length}</div></div>`;
  html += `<div class="kpi"><div class="kpi-label">En rupture</div><div class="kpi-value" style="color:#DC2626;">${outOfStock.length}</div></div>`;
  html += `<div class="kpi"><div class="kpi-label">Stock bas</div><div class="kpi-value" style="color:#D97706;">${belowThreshold.length}</div></div>`;
  html += `<div class="kpi"><div class="kpi-label">Valeur du stock</div><div class="kpi-value">${fmtCurReport(totalValue, cur)}</div></div></div>`;

  html += `<h2>Inventaire complet</h2><table><thead><tr><th>Produit</th><th>SKU</th><th class="center">Stock</th><th class="center">Seuil</th><th class="right">Valeur</th><th class="center">Statut</th></tr></thead><tbody>`;
  for (const p of physicalProducts.sort((a, b) => a.stockQuantity - b.stockQuantity)) {
    const status = p.stockQuantity <= 0 ? '<span style="color:#DC2626;font-weight:600;">Rupture</span>' : p.stockQuantity <= p.lowStockThreshold ? '<span style="color:#D97706;font-weight:600;">Bas</span>' : '<span style="color:#16A34A;">OK</span>';
    html += `<tr><td>${p.name}</td><td style="color:#64748B;">${p.sku || '—'}</td><td class="center" style="font-weight:600;">${p.stockQuantity}</td><td class="center">${p.lowStockThreshold}</td><td class="right">${fmtCurReport(p.stockQuantity * p.purchasePrice, cur)}</td><td class="center">${status}</td></tr>`;
  }
  html += `</tbody></table></body></html>`;
  return html;
}

export function generateFinancialReportHTML(params: {
  company: Company;
  revenue: number;
  expenses: number;
  unpaidAmount: number;
  periodLabel: string;
  currency: string;
}): string {
  const { company, revenue, expenses, unpaidAmount, periodLabel, currency } = params;
  const cur = currency;
  const profit = revenue - expenses;

  let html = buildReportHeader(company, 'Rapport financier');
  html += `<div style="margin-bottom:16px;"><span style="font-size:13px;color:#64748B;">Période : </span><span style="font-size:13px;font-weight:600;color:#0F172A;">${periodLabel}</span></div>`;
  html += `<div style="margin-bottom:24px;"><div class="kpi"><div class="kpi-label">Chiffre d'affaires</div><div class="kpi-value">${fmtCurReport(revenue, cur)}</div></div>`;
  html += `<div class="kpi"><div class="kpi-label">Charges (achats)</div><div class="kpi-value" style="color:#DC2626;">${fmtCurReport(expenses, cur)}</div></div>`;
  html += `<div class="kpi"><div class="kpi-label">Bénéfice brut</div><div class="kpi-value" style="color:${profit >= 0 ? '#16A34A' : '#DC2626'};">${fmtCurReport(profit, cur)}</div></div>`;
  html += `<div class="kpi"><div class="kpi-label">Impayés en cours</div><div class="kpi-value" style="color:#D97706;">${fmtCurReport(unpaidAmount, cur)}</div></div></div>`;
  html += `</body></html>`;
  return html;
}

export async function printPDF(html: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 300);
        return true;
      }
      return false;
    }

    const Print: any = await import('expo-print');
    await Print.printAsync({ html });
    return true;
  } catch {
    return false;
  }
}
