/**
 * hooks/useVariantDrafts.ts
 * Gestion des brouillons de variantes pour le formulaire multi-étapes.
 * Centralise : génération des combinaisons, application des prix en masse,
 * et synchronisation avec les variantes existantes lors de l'édition.
 */

import { useState, useCallback } from 'react';
import type { VariantDraft } from '@/types/product.types';

interface UseVariantDraftsOptions {
  generateVariantSKU: (brand: string, name: string, index: number) => string;
}

export function useVariantDrafts({ generateVariantSKU }: UseVariantDraftsOptions) {
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  /** Génère toutes les combinaisons d'attributs x valeurs sélectionnés */
  const generateCombinations = useCallback(
    (
      selectedAttrIds: string[],
      selectedAttrValues: Record<string, string[]>,
      productAttributes: { id: string; name: string; values: string[] }[],
      formName: string,
      formBrand: string,
      formPurchasePrice: string,
      formSalePrice: string,
      formLowStockThreshold: string,
    ): VariantDraft[] => {
      const attrEntries = selectedAttrIds
        .map((id) => {
          const attr = productAttributes.find((a) => a.id === id);
          if (!attr) return null;
          const vals = selectedAttrValues[id] || [];
          if (vals.length === 0) return null;
          return { name: attr.name, values: vals };
        })
        .filter(Boolean) as { name: string; values: string[] }[];

      if (attrEntries.length === 0) return [];

      const combos: Record<string, string>[][] = [[]];
      for (const entry of attrEntries) {
        const newCombos: Record<string, string>[][] = [];
        for (const existing of combos) {
          for (const val of entry.values) {
            newCombos.push([...existing, { [entry.name]: val }]);
          }
        }
        combos.length = 0;
        combos.push(...newCombos);
      }

      return combos.map((combo, idx) => {
        const attrs: Record<string, string> = {};
        combo.forEach((pair) => Object.assign(attrs, pair));
        return {
          attributes: attrs,
          sku: generateVariantSKU(formBrand, formName, idx + 1),
          purchasePrice: formPurchasePrice || '0',
          salePrice: formSalePrice || '0',
          stockQuantity: '0',
          minStock: formLowStockThreshold || '0',
          included: true,
          existingVariantId: undefined,
        } as VariantDraft;
      });
    },
    [generateVariantSKU],
  );

  /** Applique les prix bulk à tous les brouillons existants */
  const applyBulkPrices = useCallback(() => {
    setVariantDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        ...(bulkPurchasePrice ? { purchasePrice: bulkPurchasePrice } : {}),
        ...(bulkSalePrice ? { salePrice: bulkSalePrice } : {}),
      })),
    );
  }, [bulkPurchasePrice, bulkSalePrice]);

  /** Met à jour un champ d'un brouillon par index */
  const updateDraft = useCallback(
    (index: number, field: keyof VariantDraft, value: string | boolean) => {
      setVariantDrafts((prev) =>
        prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
      );
    },
    [],
  );

  /** Supprime un brouillon par index */
  const removeDraft = useCallback((index: number) => {
    setVariantDrafts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** Réinitialise complètement les brouillons */
  const resetDrafts = useCallback(() => {
    setVariantDrafts([]);
    setBulkPurchasePrice('');
    setBulkSalePrice('');
  }, []);

  return {
    variantDrafts,
    setVariantDrafts,
    bulkPurchasePrice,
    setBulkPurchasePrice,
    bulkSalePrice,
    setBulkSalePrice,
    generateCombinations,
    applyBulkPrices,
    updateDraft,
    removeDraft,
    resetDrafts,
  };
}