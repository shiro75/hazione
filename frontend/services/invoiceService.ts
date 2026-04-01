/**
 * @fileoverview Invoice business logic: number generation, validation/locking,
 * legal mentions, and compliance helpers. Enforces sequential numbering
 * and immutability of validated invoices per French anti-fraud law.
 */

import type { Invoice, Company, OrderItem } from '@/types';

export function generateInvoiceNumber(prefix: string, nextNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(nextNumber).padStart(3, '0');
  return `${prefix}-${year}-${padded}`;
}

export function generateCreditNoteNumber(prefix: string, nextNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(nextNumber).padStart(3, '0');
  return `${prefix}-${year}-${padded}`;
}

export function generateQuoteNumber(prefix: string, nextNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(nextNumber).padStart(3, '0');
  return `${prefix}-${year}-${padded}`;
}

export function canEditInvoice(invoice: Invoice): boolean {
  if (invoice.isLocked || invoice.isValidated) return false;
  if (invoice.status === 'validated' || invoice.status === 'paid') return false;
  return invoice.status === 'draft';
}

export function canValidateInvoice(invoice: Invoice): boolean {
  if (invoice.isValidated || invoice.isLocked) return false;
  if (invoice.items.length === 0) return false;
  return invoice.status === 'draft';
}

export function canCancelInvoice(invoice: Invoice): boolean {
  if (invoice.status === 'cancelled') return false;
  if (invoice.isValidated) return true;
  return true;
}

export function validateAndLockInvoice(invoice: Invoice): Invoice {
  const now = new Date().toISOString();
  return {
    ...invoice,
    status: 'validated',
    isValidated: true,
    isLocked: true,
    validatedAt: now,
    electronicReady: true,
  };
}

export function buildLegalMentions(company: Company): string {
  const parts = [
    `${company.name} ${company.legalStructure}`,
    `SIRET: ${company.siret}`,
    `TVA: ${company.vatNumber}`,
    `${company.address}, ${company.postalCode} ${company.city}`,
  ];
  if (company.vatExempt && company.vatExemptArticle) {
    parts.push(`TVA non applicable, art. ${company.vatExemptArticle} du CGI`);
  }
  return parts.join(' · ');
}

export function calculateVATSummary(items: OrderItem[]): Record<string, { ht: number; tva: number; ttc: number }> {
  const summary: Record<string, { ht: number; tva: number; ttc: number }> = {};
  items.forEach((item) => {
    const key = `${item.vatRate}%`;
    if (!summary[key]) {
      summary[key] = { ht: 0, tva: 0, ttc: 0 };
    }
    summary[key].ht += item.totalHT;
    summary[key].tva += item.totalTVA;
    summary[key].ttc += item.totalTTC;
  });
  return summary;
}

export function buildInvoiceXMLStructure(invoice: Invoice, company: Company): string {
  return JSON.stringify({
    version: '1.0',
    format: 'Factur-X',
    header: {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: 'EUR',
    },
    seller: {
      name: company.name,
      siret: company.siret,
      vatNumber: company.vatNumber,
      address: `${company.address}, ${company.postalCode} ${company.city}`,
    },
    buyer: {
      name: invoice.clientName,
      id: invoice.clientId,
    },
    lines: invoice.items.map((item) => ({
      description: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      totalHT: item.totalHT,
      totalTVA: item.totalTVA,
      totalTTC: item.totalTTC,
    })),
    totals: {
      totalHT: invoice.totalHT,
      totalTVA: invoice.totalTVA,
      totalTTC: invoice.totalTTC,
    },
  }, null, 2);
}

export function calculateLateFees(
  invoiceTTC: number,
  dueDate: string,
  feeRate: number
): { days: number; fee: number } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = now.getTime() - due.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const fee = days > 0 ? (invoiceTTC * (feeRate / 100) * days) / 365 : 0;
  return { days, fee: Math.round(fee * 100) / 100 };
}
