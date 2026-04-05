/**
 * @fileoverview Type definitions for the Dashboard module.
 * Contains tab, filter, movement, and objective types.
 */

import React from 'react';

// ============================================
// SECTION: Tab & Filter Types
// ============================================

/** Active tab in the dashboard */
export type DashboardTab = 'overview' | 'analysis' | 'treasury';

/** Period filter for dashboard data */
export type PeriodFilter = 'today' | 'week' | 'month' | 'quarter' | 'year';

/** Movement filter for treasury tab */
export type MovementFilter = 'all' | 'income' | 'expense';

// ============================================
// SECTION: Data Types
// ============================================

/** Real cash movement for the treasury movements list */
export interface RealMovement {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  source: string;
}

/** Sales objectives stored in AsyncStorage */
export interface SalesObjectives {
  mode: 'yearly' | 'monthly';
  yearlyTarget: number;
  monthlyTargets: Record<string, number>;
  productTargets: Record<string, number>;
}

// ============================================
// SECTION: Dashboard Tab Configuration
// ============================================

/** Dashboard tab config with i18n label key and icon */
export interface DashboardTabConfig {
  key: DashboardTab;
  labelKey: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}

// ============================================
// SECTION: Chart Data Types
// ============================================

/** Variant detail for ABC product classification */
export interface VariantDetail {
  variantId: string;
  attributes: Record<string, string>;
  attributeLabel: string;
}

/** Variant sale detail for ABC classification with trends */
export interface VariantSaleDetail {
  variantId: string;
  attributeLabel: string;
  quantity: number;
  totalTTC: number;
  unitPrice?: number;
}

/** Product sale detail for ABC classification */
export interface ProductSaleDetail {
  productId: string;
  productName: string;
  quantity: number;
  totalTTC: number;
  attributes: string;
  unitPrice?: number;
  totalHT?: number;
  totalTVA?: number;
  variants: VariantDetail[];
  variantSales: VariantSaleDetail[];
}

/** ABC variant data with trend analysis */
export interface VariantAbcData {
  variantId: string;
  label: string;
  ca: number;
  margin: number;
  sparkline: number[];
  trend: 'up' | 'down' | 'stable';
  hasSufficientData: boolean;
}
