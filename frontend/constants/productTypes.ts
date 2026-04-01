/**
 * @fileoverview Product type definitions with labels, colors, and helper functions.
 * Defines which product types are allowed for purchases, sales, and stock management.
 * Also provides normalizeProductType() to safely coerce unknown DB values.
 */
import type { ProductType } from '@/types';

export interface ProductTypeConfig {
  value: ProductType;
  label: string;
  color: string;
  bgColor: string;
}

export const PRODUCT_TYPE_CONFIGS: ProductTypeConfig[] = [
  { value: 'matiere_premiere', label: 'Matière première', color: '#E67E22', bgColor: '#FDF2E9' },
  { value: 'consommable', label: 'Consommable', color: '#F1C40F', bgColor: '#FEF9E7' },
  { value: 'produit_fini', label: 'Produit fini', color: '#3498DB', bgColor: '#EBF5FB' },
  { value: 'produit_revendu', label: 'Produit revendu', color: '#9B59B6', bgColor: '#F5EEF8' },
  { value: 'service', label: 'Service', color: '#27AE60', bgColor: '#EAFAF1' },
];

export const PRODUCT_TYPE_OPTIONS = PRODUCT_TYPE_CONFIGS.map(c => ({
  label: c.label,
  value: c.value,
}));

export function getProductTypeConfig(type: ProductType): ProductTypeConfig {
  return PRODUCT_TYPE_CONFIGS.find(c => c.value === type) ?? PRODUCT_TYPE_CONFIGS[2];
}

export function getProductTypeLabel(type: ProductType): string {
  return getProductTypeConfig(type).label;
}

export const PURCHASE_ALLOWED_TYPES: ProductType[] = ['matiere_premiere', 'consommable', 'produit_revendu'];

export const SALES_ALLOWED_TYPES: ProductType[] = ['produit_fini', 'produit_revendu', 'service'];

export const STOCK_TYPES: ProductType[] = ['matiere_premiere', 'consommable', 'produit_revendu'];

export function isStockableType(type: ProductType): boolean {
  return STOCK_TYPES.includes(type);
}

export function normalizeProductType(type: unknown): ProductType {
  if (!type) return 'produit_fini';
  if (PRODUCT_TYPE_CONFIGS.some(c => c.value === type)) return type as ProductType;
  if (type === 'product') return 'produit_fini';
  return 'produit_fini';
}
