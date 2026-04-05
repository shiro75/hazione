/**
 * hooks/useProductForm.ts
 * State et handlers du formulaire multi-étapes de création / édition produit.
 * Centralise : champs du formulaire, navigation entre étapes, soumission finale,
 * sauvegarde rapide, et détection de doublons.
 */

import { useState, useCallback, useMemo } from 'react';
import { EMPTY_FORM, generateUniqueSKU } from '@/types/product.types';
import { ttcToHt } from '@/utils/price';
import type { VATRate, ProductType, Product, ProductVariant } from '@/types';
import type { FormStep, VariantDraft, CreateVariantInput, CreateVariantBatchInput, CreateProductInput } from '@/types/product.types';

interface UseProductFormOptions {
  products: Product[];
  getVariantsForProduct: (id: string) => ProductVariant[];
  productAttributes: { id: string; name: string; values: string[] }[];
  createProduct: (data: CreateProductInput) =>  { success: boolean; error?: string; productId?: string};
  updateProduct: (id: string, data: Partial<Product>, opts?: { silent?: boolean }) => { success: boolean; error?: string };
  createVariant: (data: CreateVariantInput) => void;
  createVariantsBatch: (productId: string, data: CreateVariantBatchInput[]) => void;
  updateVariant: (id: string, data: Partial<ProductVariant>, opts?: { silent?: boolean }) => void;
  deleteVariant: (id: string) => void;
  showToast: (msg: string) => void;
  generateVariantSKU: (brand: string, name: string, index: number) => string;
  generateCombinations: (
    selectedAttrIds: string[],
    selectedAttrValues: Record<string, string[]>,
    productAttributes: { id: string; name: string; values: string[] }[],
    formName: string,
    formBrand: string,
    formPurchasePrice: string,
    formSalePrice: string,
    formLowStockThreshold: string,
  ) => VariantDraft[];
  variantDrafts: VariantDraft[];
  setVariantDrafts: React.Dispatch<React.SetStateAction<VariantDraft[]>>;
  resetDrafts: () => void;
  setBulkPurchasePrice: (v: string) => void;
  setBulkSalePrice: (v: string) => void;
}

export function useProductForm({
  products,
  getVariantsForProduct,
  productAttributes,
  createProduct,
  updateProduct,
  createVariant,
  createVariantsBatch,
  updateVariant,
  deleteVariant,
  showToast,
  generateVariantSKU,
  generateCombinations,
  variantDrafts,
  setVariantDrafts,
  resetDrafts,
  setBulkPurchasePrice,
  setBulkSalePrice,
}: UseProductFormOptions) {
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formStep, setFormStep] = useState<FormStep>(1);
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);
  const [selectedAttrValues, setSelectedAttrValues] = useState<Record<string, string[]>>({});

  const updateField = useCallback(<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError('');
  }, []);

  /** Détecte un produit potentiellement dupliqué lors de la création */
  const duplicateProduct = useMemo(() => {
    if (editingId) return null;
    const name = form.name.trim().toLowerCase();
    if (!name) return null;
    return (
      products.find(
        (p) =>
          !p.isArchived &&
          p.name.trim().toLowerCase() === name &&
          p.type === form.type &&
          (p.categoryName || '') === (form.category || ''),
      ) ?? null
    );
  }, [form.name, form.type, form.category, products, editingId]);

  /** Ouvre le formulaire en mode création */
  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sku: generateUniqueSKU() });
    setFormError('');
    setFormStep(1);
    setSelectedAttrIds([]);
    setSelectedAttrValues({});
    resetDrafts();
    setFormVisible(true);
  }, [resetDrafts]);

  /** Ouvre le formulaire en mode édition, reconvertit les prix HT → TTC */
  const openEdit = useCallback(
    (productId: string) => {
      const p = products.find((pr) => pr.id === productId);
      if (!p) return;
      setEditingId(p.id);
      const salePriceTTC = Math.round(p.salePrice * (1 + p.vatRate / 100) * 100) / 100;
      setForm({
        name: p.name,
        description: p.description,
        sku: p.sku || generateUniqueSKU(),
        barcode: p.barcode || '',
        category: p.categoryName || '',
        brand: p.brand || '',
        purchasePrice: String(p.purchasePrice),
        salePrice: String(salePriceTTC),
        vatRate: String(p.vatRate),
        lowStockThreshold: String(p.lowStockThreshold),
        unit: p.unit || 'pièce',
        type: p.type,
        isActive: p.isActive,
        photoUrl: p.photoUrl || '',
        imageUrls: p.imageUrls || [],
      });
      setFormError('');
      setFormStep(1);

      // Reconstruction des attributs sélectionnés depuis les variantes existantes
      const existingVariants = getVariantsForProduct(productId);
      const attrIdsSet = new Set<string>();
      const attrValsMap: Record<string, string[]> = {};
      existingVariants.forEach((v) => {
        Object.entries(v.attributes).forEach(([attrName, attrVal]) => {
          const matchingAttr = productAttributes.find((a) => a.name === attrName);
          if (matchingAttr) {
            attrIdsSet.add(matchingAttr.id);
            if (!attrValsMap[matchingAttr.id]) attrValsMap[matchingAttr.id] = [];
            if (!attrValsMap[matchingAttr.id].includes(attrVal))
              attrValsMap[matchingAttr.id].push(attrVal);
          }
        });
      });
      setSelectedAttrIds(Array.from(attrIdsSet));
      setSelectedAttrValues(attrValsMap);

      // Construction des brouillons avec prix reconvertis en TTC
      const drafts: VariantDraft[] = existingVariants.map((v) => ({
        attributes: { ...v.attributes },
        sku: v.sku,
        purchasePrice: String(v.purchasePrice),
        salePrice: String(v.salePrice * (1 + p.vatRate / 100)),
        stockQuantity: String(v.stockQuantity),
        minStock: String(v.minStock),
        included: true,
        existingVariantId: v.id,
      }));
      setVariantDrafts(drafts);
      setBulkPurchasePrice(String(p.purchasePrice));
      setBulkSalePrice(String(p.salePrice));
      setFormVisible(true);
    },
    [products, getVariantsForProduct, productAttributes, setVariantDrafts, setBulkPurchasePrice, setBulkSalePrice],
  );

  const handlePrevStep = useCallback(() => {
    setFormStep((s) => (s > 1 ? ((s - 1) as FormStep) : s));
  }, []);

  /** Navigation vers l'étape suivante avec validation */
  const handleNextStep = useCallback(
    (isTransformedType: boolean) => {
      if (formStep === 1) {
        if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
        const isRawMat = form.type === 'matiere_premiere';
        if (isRawMat) {
          if ((parseFloat(form.purchasePrice) || 0) <= 0) {
            setFormError("Le prix d'achat est requis pour les matières premières");
            return;
          }
        } else {
          if ((parseFloat(form.salePrice) || 0) <= 0) {
            setFormError('Le prix de vente doit être un nombre positif');
            return;
          }
        }
        setFormError('');
        setFormStep(2);
      } else if (formStep === 2) {
        setFormError('');
        if (editingId) {
          const newCombos = generateCombinations(
            selectedAttrIds, selectedAttrValues, productAttributes,
            form.name, form.brand, form.purchasePrice, form.salePrice, form.lowStockThreshold,
          );
          const existingDrafts = variantDrafts.filter((d) => d.existingVariantId);
          const newOnly = newCombos.filter((nc) => {
            const ncKey = Object.entries(nc.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|');
            return !existingDrafts.some((ed) => {
              const edKey = Object.entries(ed.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|');
              return edKey === ncKey;
            });
          });
          setVariantDrafts([...existingDrafts, ...newOnly]);
        } else {
          setVariantDrafts(
            generateCombinations(
              selectedAttrIds, selectedAttrValues, productAttributes,
              form.name, form.brand, form.purchasePrice, form.salePrice, form.lowStockThreshold,
            ),
          );
        }
        setBulkPurchasePrice(form.purchasePrice);
        setBulkSalePrice(form.salePrice);
        setFormStep(3);
      } else if (formStep === 3 && isTransformedType) {
        setFormError('');
        setFormStep(4);
      }
    },
    [formStep, form, editingId, selectedAttrIds, selectedAttrValues, productAttributes,
      generateCombinations, variantDrafts, setVariantDrafts, setBulkPurchasePrice, setBulkSalePrice],
  );

  /** Soumission finale : convertit TTC → HT, crée/met à jour produit et variantes */
  const handleFinalSubmit = useCallback(() => {
    if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
    const isRawMat = form.type === 'matiere_premiere';
    const salePriceTTC = parseFloat(form.salePrice) || 0;
    if (!isRawMat && salePriceTTC <= 0) { setFormError('Le prix de vente doit être positif'); return; }
    const purchasePriceVal = parseFloat(form.purchasePrice) || 0;
    if (isRawMat && purchasePriceVal <= 0) { setFormError("Le prix d'achat est requis pour les matières premières"); return; }

    const vatRate = parseFloat(form.vatRate) as VATRate;
    const salePrice = salePriceTTC > 0 ? ttcToHt(salePriceTTC, vatRate) : 0;
    const purchasePrice = purchasePriceVal;
    const lowStockThreshold = parseInt(form.lowStockThreshold, 10) || 5;

    const allImageUrls = [
      ...form.imageUrls.filter((u) => u.trim()),
      ...(form.photoUrl.trim() ? [form.photoUrl.trim()] : []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      categoryName: form.category || undefined,
      brand: form.brand || undefined,
      purchasePrice,
      salePrice,
      vatRate,
      stockQuantity: 0,
      lowStockThreshold,
      unit: form.unit || 'pièce',
      type: form.type,
      isActive: form.isActive,
      photoUrl: allImageUrls[0] || undefined,
      imageUrls: allImageUrls.length > 0 ? allImageUrls : undefined,
    };

    if (editingId) {
      const result = updateProduct(editingId, data);
      if (!result.success) { setFormError(result.error || 'Erreur inconnue'); return; }

      const existingVariants = getVariantsForProduct(editingId);
      const includedDrafts = variantDrafts.filter((d) => d.included);
      const keptExistingIds = new Set(includedDrafts.filter((d) => d.existingVariantId).map((d) => d.existingVariantId!));

      existingVariants.forEach((v) => { if (!keptExistingIds.has(v.id)) deleteVariant(v.id); });

      includedDrafts.forEach((d) => {
        const variantSalePriceHT = ttcToHt(parseFloat(d.salePrice) || 0, vatRate);
        if (d.existingVariantId) {
          updateVariant(d.existingVariantId, {
            attributes: d.attributes, sku: d.sku,
            purchasePrice: parseFloat(d.purchasePrice) || 0,
            salePrice: variantSalePriceHT,
            stockQuantity: parseInt(d.stockQuantity, 10) || 0,
            minStock: parseInt(d.minStock, 10) || 0,
          }, { silent: true });
        } else {
          createVariant({
            productId: editingId, attributes: d.attributes, sku: d.sku,
            purchasePrice: parseFloat(d.purchasePrice) || 0, salePrice: variantSalePriceHT,
            stockQuantity: parseInt(d.stockQuantity, 10) || 0,
            minStock: parseInt(d.minStock, 10) || 0, isActive: true,
          });
        }
      });
    } else {
      const result = createProduct(data);
      if (!result.success) { setFormError(result.error || 'Erreur inconnue'); return; }
      const productId = result.productId;
      const includedDrafts = variantDrafts.filter((d) => d.included);
      if (includedDrafts.length > 0 && productId) {
        createVariantsBatch(
          productId,
          includedDrafts.map((d) => ({
            attributes: d.attributes, sku: d.sku,
            purchasePrice: parseFloat(d.purchasePrice) || 0,
            salePrice: ttcToHt(parseFloat(d.salePrice) || 0, vatRate),
            stockQuantity: parseInt(d.stockQuantity, 10) || 0,
            minStock: parseInt(d.minStock, 10) || 0,
          })),
        );
      }
    }
    setFormVisible(false);
  }, [form, variantDrafts, editingId, createProduct, updateProduct, createVariantsBatch,
    createVariant, updateVariant, deleteVariant, getVariantsForProduct]);

  /** Sauvegarde rapide depuis l'étape 1 ou 2, sans configurer les variantes */
  const handleQuickSave = useCallback(() => {
    if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
    const isRawMat = form.type === 'matiere_premiere';
    const salePriceTTC = parseFloat(form.salePrice) || 0;
    if (!isRawMat && salePriceTTC <= 0) { setFormError('Le prix de vente doit être positif'); return; }
    const purchasePrice = parseFloat(form.purchasePrice) || 0;
    if (isRawMat && purchasePrice <= 0) { setFormError("Le prix d'achat est requis pour les matières premières"); return; }

    const vatRate = parseFloat(form.vatRate) as VATRate;
    const salePrice = salePriceTTC > 0 ? ttcToHt(salePriceTTC, vatRate) : 0;

    const data = {
      name: form.name.trim(), description: form.description.trim(), sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      categoryName: form.category || undefined, brand: form.brand || undefined,
      purchasePrice, salePrice, vatRate,
      lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 5,
      unit: form.unit || 'pièce', type: form.type, isActive: form.isActive,
      photoUrl: form.photoUrl.trim() || undefined,
    };

    if (editingId) {
      const result = updateProduct(editingId, data);
      if (!result.success) { setFormError(result.error || 'Erreur inconnue'); return; }
    } else {
      const result = createProduct({ ...data, stockQuantity: 0 });
      if (!result.success) { setFormError(result.error || 'Erreur inconnue'); return; }
      if (result.productId) setEditingId(result.productId);
    }
    setFormVisible(false);
    showToast('Produit enregistré');
  }, [editingId, form, updateProduct, createProduct, showToast]);

  return {
    formVisible, setFormVisible,
    editingId, setEditingId,
    form, setForm, updateField,
    formError, setFormError,
    formStep, setFormStep,
    selectedAttrIds, setSelectedAttrIds,
    selectedAttrValues, setSelectedAttrValues,
    duplicateProduct,
    openCreate, openEdit,
    handleNextStep, handlePrevStep,
    handleFinalSubmit, handleQuickSave,
  };
}