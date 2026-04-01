/**
 * @fileoverview Business calculation utilities for line totals, VAT,
 * margins, and ID generation. Used by invoice, quote, and order creation logic.
 */

import type { VATRate } from '@/types';

/** Result of a line total calculation with HT, TVA, and TTC breakdowns */
export interface LineTotal {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

/**
 * Calculates totals for a single invoice/order line.
 * @param unitPrice - Unit price before tax (HT)
 * @param quantity - Number of units
 * @param vatRate - VAT rate percentage
 * @param discountPercent - Optional line discount percentage
 * @returns Object with totalHT, totalTVA, and totalTTC
 */
export function calculateLineTotal(
  unitPrice: number,
  quantity: number,
  vatRate: VATRate,
  discountPercent: number = 0,
): LineTotal {
  const baseHT = unitPrice * quantity;
  const discountAmount = baseHT * (discountPercent / 100);
  const totalHT = baseHT - discountAmount;
  const totalTVA = totalHT * (vatRate / 100);
  const totalTTC = totalHT + totalTVA;
  return { totalHT, totalTVA, totalTTC };
}

/**
 * Sums up totals across multiple line items.
 * @param items - Array of items with unitPrice, quantity, vatRate
 * @returns Aggregated totals (HT, TVA, TTC)
 */
export function calculateTotals(
  items: Array<{ unitPrice: number; quantity: number; vatRate: VATRate; discountPercent?: number }>,
): LineTotal {
  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;
  items.forEach((item) => {
    const line = calculateLineTotal(item.unitPrice, item.quantity, item.vatRate, item.discountPercent);
    totalHT += line.totalHT;
    totalTVA += line.totalTVA;
    totalTTC += line.totalTTC;
  });
  return { totalHT, totalTVA, totalTTC };
}

/**
 * Calculates profit margin from sale and purchase prices.
 * @param salePrice - Selling price HT
 * @param purchasePrice - Purchase/cost price HT
 * @returns Object with margin amount and percentage
 */
export function calculateMargin(salePrice: number, purchasePrice: number): { amount: number; percent: number } {
  const amount = salePrice - purchasePrice;
  const percent = salePrice > 0 ? ((1 - purchasePrice / salePrice) * 100) : 0;
  return { amount, percent };
}

/**
 * Generates a unique ID with a given prefix, timestamp, and random suffix.
 * @param prefix - ID prefix (e.g. 'inv', 'cli', 'prod')
 * @returns Unique string ID
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateItemId(): string {
  return `si_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function generateUniqueSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF-${code}`;
}
