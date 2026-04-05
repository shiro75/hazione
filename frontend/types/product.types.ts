/**
 * @fileoverview Type definitions for the Products module.
 * Contains form step, variant draft, and form default types.
 */

import type { ProductType, ProductVariant, Product } from '@/types';

// ============================================
// SECTION: Form Types
// ============================================

/** Step in the multi-step product creation/edit form */
export type FormStep = 1 | 2 | 3 | 4;

/**
 * Draft variant before save. Prices are in TTC at this stage
 * (conversion to HT happens at submit time).
 */
export interface VariantDraft {
  attributes: Record<string, string>;
  sku: string;
  purchasePrice: string;
  salePrice: string;
  stockQuantity: string;
  minStock: string;
  included: boolean;
  existingVariantId?: string;
}

/** Variant form state for individual variant creation/edit */
export interface VariantFormState {
  attributes: { key: string; value: string }[];
  sku: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
}

/** Default values for the product form */
export const EMPTY_FORM = {
  name: '',
  description: '',
  sku: '',
  barcode: '',
  category: '',
  brand: '',
  purchasePrice: '',
  salePrice: '',
  vatRate: '20',
  lowStockThreshold: '5',
  unit: 'pièce',
  type: 'stock.transformedProduct' as ProductType,
  isActive: true,
  photoUrl: '',
  imageUrls: [] as string[],
};

/** Product form state type derived from EMPTY_FORM */
export type ProductFormState = typeof EMPTY_FORM;

// ============================================
// SECTION: Utility Functions
// ============================================

/** Generate a unique random SKU in REF-XXXXXX format */
export function generateUniqueSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF-${code}`;
};

export type CreateVariantInput = Pick<ProductVariant,'productId' | 'attributes' | 'sku' | 'purchasePrice' | 'salePrice' | 'stockQuantity' | 'minStock' | 'isActive'>;

export type CreateVariantBatchInput = Pick<ProductVariant,'attributes' | 'sku' | 'purchasePrice' | 'salePrice' | 'stockQuantity' | 'minStock'>;

export type CreateProductInput = Pick<Product,'name' | 'description' | 'sku' | 'categoryName' | 'brand' | 'purchasePrice' | 'salePrice' | 'vatRate' | 'stockQuantity' | 'lowStockThreshold' | 'unit' | 'type' | 'isActive' | 'photoUrl' | 'imageUrls' | 'barcode'>;