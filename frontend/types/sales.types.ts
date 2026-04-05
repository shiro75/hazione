/**
 * @fileoverview Type definitions for the POS (Point of Sale) module.
 * Contains cart item, payment, and filter types used across sales components and hooks.
 */

import type { VATRate } from '@/types';

// ============================================
// SECTION: Tab & Filter Types
// ============================================

/** Active tab in the POS screen */
export type SalesTab = 'pos' | 'history';

/** Date range filter for sales history */
export type DateFilter = 'today' | '7days' | '30days' | 'all';

/** High-level payment category for grouping methods */
export type PaymentCategory = 'cash' | 'card' | 'mixed' | 'digital';

/** Digital payment sub-methods */
export type DigitalSubMethod = 'mobile_wave' | 'mobile_om' | 'twint';

/** Payment method filter in sales history */
export type PaymentMethodFilter = 'all' | PaymentCategory;

// ============================================
// SECTION: Cart Types
// ============================================

/** Item in the POS cart before sale finalization */
export interface POSCartItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
  vatRate: VATRate;
}

/** Computed cart totals */
export interface CartTotals {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

// ============================================
// SECTION: Payment Types
// ============================================

/** State for CinetPay digital payment flow */
export interface CinetPayState {
  active: boolean;
  loading: boolean;
  transactionId: string | null;
  paymentUrl: string | null;
}
