/**
 * @fileoverview Product type definitions with labels, colors, and helper functions.
 * Defines which product types are allowed for purchases, sales, and stock management.
 * Also provides normalizeProductType() to safely coerce unknown DB values.
 */
import type { ProductType } from '@/types';

export interface ProductTypeConfig {
  value: ProductType;
  labelKey: string;
  color: string;
  bgColor: string;
}

export const PRODUCT_TYPE_CONFIGS: ProductTypeConfig[] = [
  { value: 'matiere_premiere', labelKey: 'stock.rawMaterial', color: '#E67E22', bgColor: '#FDF2E9' },
  { value: 'consommable', labelKey: 'stock.consumable', color: '#F1C40F', bgColor: '#FEF9E7' },
  { value: 'produit_transforme', labelKey: 'stock.transformedProduct', color: '#3498DB', bgColor: '#EBF5FB' },
  { value: 'produit_revendu', labelKey: 'stock.resoldProduct', color: '#9B59B6', bgColor: '#F5EEF8' },
  { value: 'service', labelKey: 'stock.service', color: '#27AE60', bgColor: '#EAFAF1' },
];


export function getProductTypeOptions(t: (key: string, options?: any) => string) {
  return PRODUCT_TYPE_CONFIGS.map(c => ({
    label: t(c.labelKey),
    value: c.value,
  }));
}


export function getProductTypeConfig(type: ProductType): ProductTypeConfig {
  return PRODUCT_TYPE_CONFIGS.find(c => c.value === type) ?? PRODUCT_TYPE_CONFIGS[2];
}

export function getProductTypeLabel(t: (key: string, options?: any) => string, type: ProductType): string {
  const config = getProductTypeConfig(type);
  return t(config.labelKey);
}

export const PURCHASE_ALLOWED_TYPES: ProductType[] = ['matiere_premiere', 'consommable', 'produit_revendu'];

export const SALES_ALLOWED_TYPES: ProductType[] = ['produit_transforme', 'produit_revendu', 'service'];

export const STOCK_TYPES: ProductType[] = ['matiere_premiere', 'consommable', 'produit_revendu'];

export function isStockableType(type: ProductType): boolean {
  return STOCK_TYPES.includes(type);
}

export function normalizeProductType(type: unknown): ProductType {
  if (!type) return 'produit_transforme';
  if (PRODUCT_TYPE_CONFIGS.some(c => c.value === type)) return type as ProductType;
  if (type === 'product') return 'produit_transforme';
  return 'produit_transforme';
}
