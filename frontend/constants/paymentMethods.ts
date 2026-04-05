/**
 * @fileoverview Payment method configurations, digital sub-methods, and filter constants.
 * Used by the POS module for payment selection and sales history filtering.
 */

import React from 'react';
import {
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Smartphone,
} from 'lucide-react-native';
import type { SalePaymentMethod } from '@/types';
import type { PaymentCategory, DigitalSubMethod, DateFilter } from '@/types/sales.types';

// ============================================
// SECTION: Payment Category Configurations
// ============================================

/** Main payment categories shown in the POS checkout */
export const PAYMENT_CATEGORIES: {
  value: PaymentCategory;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}[] = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'CB', icon: CreditCard },
  { value: 'mixed', label: 'Mixte', icon: ArrowRightLeft },
];

/** Extended payment categories including digital, used in history filters */
export const ALL_PAYMENT_CATEGORIES_WITH_DIGITAL: {
  value: PaymentCategory;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}[] = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'CB', icon: CreditCard },
  { value: 'mixed', label: 'Mixte', icon: ArrowRightLeft },
  { value: 'digital', label: 'Paiement Digital', icon: Smartphone },
];

/** Digital payment sub-methods with brand colors */
export const DIGITAL_SUB_METHODS: {
  value: DigitalSubMethod;
  label: string;
  color: string;
}[] = [
  { value: 'mobile_wave', label: 'Wave', color: '#1DC3E2' },
  { value: 'mobile_om', label: 'Orange Money', color: '#FF6600' },
  { value: 'twint', label: 'TWINT', color: '#000000' },
];

/** Methods available for mixed payment splits */
export const MIXED_SUB_METHODS: {
  value: SalePaymentMethod;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}[] = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'CB', icon: CreditCard },
  { value: 'mobile_wave', label: 'Wave', icon: Smartphone },
  { value: 'mobile_om', label: 'Orange Money', icon: Smartphone },
  { value: 'twint', label: 'TWINT', icon: Smartphone },
];

// ============================================
// SECTION: Date Filters
// ============================================

/** Date range filter options for sales history, with i18n label keys */
export const DATE_FILTER_KEYS: { value: DateFilter; labelKey: string }[] = [
  { value: 'today', labelKey: 'dashboard.today' },
  { value: '7days', labelKey: 'pos.7days' },
  { value: '30days', labelKey: 'pos.30days' },
  { value: 'all', labelKey: 'pos.allSales' },
];

// ============================================
// SECTION: Helper Functions
// ============================================

/** Check if a payment method is a digital method */
export function isDigitalMethod(method: string): boolean {
  return ['mobile_wave', 'mobile_om', 'twint', 'mobile'].includes(method);
}

/** Map a payment method string to its high-level category */
export function getPaymentCategory(method: string): PaymentCategory {
  if (method === 'cash') return 'cash';
  if (method === 'card') return 'card';
  if (method === 'mixed') return 'mixed';
  return 'digital';
}

/** Generate a unique ID for sale items */
export function generateItemId(): string {
  return `si_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
