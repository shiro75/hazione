import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  useWindowDimensions, Image, Modal, Pressable, Alert, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import {
  Search, Plus, Package, Check, Pencil, Archive, X,
  Briefcase, Box, ArrowUpDown, Trash2, AlertTriangle,
  Tag, Layers, ChevronLeft, ChevronRight, Tags, Upload,
  LayoutGrid, List, Image as ImageIcon, Download,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/utils/format';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import PageHeader from '@/components/PageHeader';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import DropdownPicker from '@/components/DropdownPicker';
import ProductImportModal from '@/components/ProductImportModal';
import type { PreviewProduct, ExistingProductRef } from '@/components/ProductImportModal';
import type { VATRate, ProductType, ProductVariant, Product } from '@/types';
import { PRODUCT_TYPE_OPTIONS, getProductTypeConfig, isStockableType } from '@/constants/productTypes';

const modalOverlay = { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const } as const;

const TYPE_OPTIONS = PRODUCT_TYPE_OPTIONS;

type FormStep = 1 | 2 | 3;

interface VariantDraft {
  attributes: Record<string, string>;
  sku: string;
  purchasePrice: string;
  salePrice: string;
  stockQuantity: string;
  minStock: string;
  included: boolean;
  existingVariantId?: string;
}

function generateUniqueSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF-${code}`;
}

const EMPTY_FORM = {
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
  type: 'produit_fini' as ProductType,
  isActive: true,
  photoUrl: '',
  imageUrls: [] as string[],
};

/**
 * @component ProductsScreen
 * @description Écran principal de gestion du catalogue produits.
 * Permet de créer, modifier, archiver et supprimer des produits avec leurs variantes.
 *
 * CONVENTION DE PRIX :
 *  - La base de données (DataContext) stocke toujours les prix en HT (hors taxe).
 *  - L'utilisateur saisit le prix de vente en TTC dans tous les formulaires.
 *  - La conversion TTC → HT se fait juste avant l'appel createProduct/updateProduct/createVariant.
 *  - La conversion HT → TTC se fait à l'affichage (liste, grille, fiche, édition).
 *  - Formule : HT = TTC / (1 + tva/100)  |  TTC = HT * (1 + tva/100)
 *
 * STRUCTURE :
 *  - renderStep1     : Formulaire étape 1 — infos générales + prix TTC + TVA
 *  - renderStep2     : Formulaire étape 2 — sélection des attributs de variantes
 *  - renderStep3     : Formulaire étape 3 — prix et stocks par variante
 *  - renderProductDetail : Modale de fiche produit (lecture)
 *  - renderVariantFormModal : Formulaire d'ajout/édition d'une variante
 *  - renderFormModal : Modale multi-étapes de création/édition produit
 *  - renderAttributesTab : Gestion des groupes d'attributs
 */
export default function ProductsScreen({ embedded = false }: { embedded?: boolean }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const {
    activeProducts, products, createProduct, updateProduct, archiveProduct, unarchiveProduct, deleteProduct,
    getProductTotalStock, getVariantsForProduct,
    productCategories, productUnits, customVatRates,
    addProductCategory, removeProductCategory, renameProductCategory,
    addProductUnit, productBrands, addProductBrand, removeProductBrand, renameProductBrand,
    createVariant, createVariantsBatch, updateVariant: updateVariantFn, deleteVariant,
    productAttributes, generateVariantSKU,
    addProductAttribute, updateProductAttribute, deleteProductAttribute,
    addAttributeValue, removeAttributeValue,
    company,
    showToast,
  } = useData();
  const cur = company.currency || 'EUR';

  const [csvImportVisible, setCsvImportVisible] = useState(false);

  type ProductsSubTab = 'catalogue' | 'attributes';
  const [subTab, setSubTab] = useState<ProductsSubTab>('catalogue');

  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [archiveConfirm, setArchiveConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'price' | 'stock'>('name');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    AsyncStorage.getItem('@products_view_mode').then((stored) => {
      if (stored === 'grid' || stored === 'list') setViewModeState(stored);
    }).catch(() => {});
  }, []);

  const setViewMode = useCallback((mode: 'grid' | 'list') => {
    setViewModeState(mode);
    AsyncStorage.setItem('@products_view_mode', mode).catch(() => {});
  }, []);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [formStep, setFormStep] = useState<FormStep>(1);
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);
  const [selectedAttrValues, setSelectedAttrValues] = useState<Record<string, string[]>>({});
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [variantFormVisible, setVariantFormVisible] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantForm, setVariantForm] = useState<{
    attributes: { key: string; value: string }[];
    sku: string;
    purchasePrice: string;
    salePrice: string;
    stock: string;
    minStock: string;
  }>({ attributes: [{ key: '', value: '' }], sku: '', purchasePrice: '', salePrice: '', stock: '0', minStock: '0' });

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) ?? null;
  }, [selectedProductId, products]);

  const selectedProductVariants = useMemo(() => {
    if (!selectedProductId) return [];
    return getVariantsForProduct(selectedProductId);
  }, [selectedProductId, getVariantsForProduct]);

  const displayProducts = useMemo(() => {
    const base = showArchived ? products : activeProducts;
    let list = base;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    if (selectedCategoryFilter) {
      list = list.filter((p) => (p.categoryName || 'Sans catégorie') === selectedCategoryFilter);
    }
    if (selectedTypeFilter) {
      list = list.filter((p) => p.type === selectedTypeFilter);
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'category': return (a.categoryName || '').localeCompare(b.categoryName || '');
        case 'price': return b.salePrice - a.salePrice;
        case 'stock': return getProductTotalStock(b.id) - getProductTotalStock(a.id);
        default: return 0;
      }
    });
  }, [search, activeProducts, products, showArchived, sortBy, getProductTotalStock, selectedCategoryFilter, selectedTypeFilter]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    const base = showArchived ? products : activeProducts;
    base.forEach((p) => cats.add(p.categoryName || 'Sans catégorie'));
    return Array.from(cats).sort();
  }, [activeProducts, products, showArchived]);

  const groupedProducts = useMemo(() => {
    const groups: { category: string; items: typeof displayProducts }[] = [];
    const map = new Map<string, typeof displayProducts>();
    displayProducts.forEach((p) => {
      const cat = p.categoryName || 'Sans catégorie';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    for (const [cat, items] of map) {
      groups.push({ category: cat, items });
    }
    groups.sort((a, b) => a.category.localeCompare(b.category));
    return groups;
  }, [displayProducts]);

  const SORT_OPTIONS: { value: typeof sortBy; label: string }[] = [
    { value: 'name', label: 'Nom' },
    { value: 'category', label: 'Catégorie' },
    { value: 'price', label: 'Prix' },
    { value: 'stock', label: 'Stock' },
  ];

  const categoryOptions = useMemo(() =>
    productCategories.map((c) => ({ label: c, value: c })),
    [productCategories]
  );
  const brandOptions = useMemo(() =>
    productBrands.map((b) => ({ label: b, value: b })),
    [productBrands]
  );
  const unitOptions = useMemo(() =>
    productUnits.map((u) => ({ label: u, value: u })),
    [productUnits]
  );
  const vatOptions = useMemo(() =>
    customVatRates.map((v) => ({ label: `${v.replace('.', ',')}%`, value: v })),
    [customVatRates]
  );

  const totalProducts = activeProducts.length;


  const generateCombinations = useCallback(() => {
    const attrEntries = selectedAttrIds
      .map(id => {
        const attr = productAttributes.find(a => a.id === id);
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
      combo.forEach(pair => Object.assign(attrs, pair));
      return {
        attributes: attrs,
        sku: generateVariantSKU(form.brand || '', form.name || '', idx + 1),
        purchasePrice: form.purchasePrice || '0',
        salePrice: form.salePrice || '0',
        stockQuantity: '0',
        minStock: form.lowStockThreshold || '0',
        included: true,
        existingVariantId: undefined,
      } as VariantDraft;
    });
  }, [selectedAttrIds, selectedAttrValues, productAttributes, form.brand, form.name, form.purchasePrice, form.salePrice, form.lowStockThreshold, generateVariantSKU]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sku: generateUniqueSKU() });
    setFormError('');
    setFormStep(1);
    setSelectedAttrIds([]);
    setSelectedAttrValues({});
    setVariantDrafts([]);
    setBulkPurchasePrice('');
    setBulkSalePrice('');
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setEditingId(p.id);
    // La BDD stocke le HT → on reconvertit en TTC pour l'affichage dans le formulaire
    const salePriceTTC = Math.round(p.salePrice * (1 + p.vatRate / 100) * 100) / 100;
    setForm({
      name: p.name, description: p.description, sku: p.sku || generateUniqueSKU(),
      barcode: p.barcode || '',
      category: p.categoryName || '', brand: p.brand || '',
      purchasePrice: String(p.purchasePrice), salePrice: String(salePriceTTC),
      vatRate: String(p.vatRate), lowStockThreshold: String(p.lowStockThreshold),
      unit: p.unit || 'pièce', type: p.type, isActive: p.isActive, photoUrl: p.photoUrl || '',
      imageUrls: p.imageUrls || [],
    });
    setFormError('');
    setFormStep(1);

    const existingVariants = getVariantsForProduct(productId);
    const attrIdsSet = new Set<string>();
    const attrValsMap: Record<string, string[]> = {};
    existingVariants.forEach(v => {
      Object.entries(v.attributes).forEach(([attrName, attrVal]) => {
        const matchingAttr = productAttributes.find(a => a.name === attrName);
        if (matchingAttr) {
          attrIdsSet.add(matchingAttr.id);
          if (!attrValsMap[matchingAttr.id]) attrValsMap[matchingAttr.id] = [];
          if (!attrValsMap[matchingAttr.id].includes(attrVal)) attrValsMap[matchingAttr.id].push(attrVal);
        }
      });
    });
    setSelectedAttrIds(Array.from(attrIdsSet));
    setSelectedAttrValues(attrValsMap);

    const drafts: VariantDraft[] = existingVariants.map(v => ({
      attributes: { ...v.attributes },
      sku: v.sku,
      purchasePrice: String(v.purchasePrice),
      // Variante : BDD stocke HT → reconvertit en TTC pour l'édition
      salePrice: String(v.salePrice * (1 + p.vatRate / 100)),
      stockQuantity: String(v.stockQuantity),
      minStock: String(v.minStock),
      included: true,
      existingVariantId: v.id,
    } as VariantDraft));
    setVariantDrafts(drafts);
    setBulkPurchasePrice(String(p.purchasePrice));
    setBulkSalePrice(String(p.salePrice));
    setFormVisible(true);
  }, [products, getVariantsForProduct, productAttributes]);

  const handleNextStep = useCallback(() => {
    if (formStep === 1) {
      if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
      const salePrice = parseFloat(form.salePrice);
      if (isNaN(salePrice) || salePrice <= 0) { setFormError('Le prix de vente doit être un nombre positif'); return; }
      setFormError('');
      setFormStep(2);
    } else if (formStep === 2) {
      setFormError('');
      if (editingId) {
        const newCombos = generateCombinations();
        const existingDrafts = variantDrafts.filter(d => d.existingVariantId);
        const newOnly = newCombos.filter(nc => {
          const ncKey = Object.entries(nc.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|');
          return !existingDrafts.some(ed => {
            const edKey = Object.entries(ed.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|');
            return edKey === ncKey;
          });
        });
        setVariantDrafts([...existingDrafts, ...newOnly]);
      } else {
        const drafts = generateCombinations();
        setVariantDrafts(drafts);
      }
      setBulkPurchasePrice(form.purchasePrice);
      setBulkSalePrice(form.salePrice);
      setFormStep(3);
    }
  }, [formStep, form, editingId, generateCombinations, variantDrafts]);

  const handlePrevStep = useCallback(() => {
    if (formStep === 2) setFormStep(1);
    else if (formStep === 3) setFormStep(2);
  }, [formStep]);

  const handleFinalSubmit = useCallback(() => {
    if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
    // form.salePrice contient le TTC saisi par l'utilisateur → on calcule le HT pour la BDD
    const salePriceTTC = parseFloat(form.salePrice);
    if (isNaN(salePriceTTC) || salePriceTTC <= 0) { setFormError('Le prix de vente doit être positif'); return; }
    const vatRate = parseFloat(form.vatRate) as VATRate;
    const salePrice = Math.round(salePriceTTC / (1 + vatRate / 100) * 100) / 100; // HT arrondi à 2 décimales
    const purchasePrice = parseFloat(form.purchasePrice) || 0;
    const lowStockThreshold = parseInt(form.lowStockThreshold, 10) || 5;

    const allImageUrls = [...form.imageUrls.filter(u => u.trim()), ...(form.photoUrl.trim() ? [form.photoUrl.trim()] : [])].filter((v, i, a) => a.indexOf(v) === i);
    const data = {
      name: form.name.trim(), description: form.description.trim(), sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      categoryName: form.category || undefined, brand: form.brand || undefined,
      purchasePrice, salePrice, vatRate, stockQuantity: 0, lowStockThreshold,
      unit: form.unit || 'pièce', type: form.type, isActive: form.isActive,
      photoUrl: allImageUrls[0] || undefined,
      imageUrls: allImageUrls.length > 0 ? allImageUrls : undefined,
    };

    if (editingId) {
      const result = updateProduct(editingId, data);
      if (!result.success) { setFormError(result.error || 'Erreur inconnue'); return; }

      const existingVariants = getVariantsForProduct(editingId);
      const includedDrafts = variantDrafts.filter(d => d.included);
      const keptExistingIds = new Set(includedDrafts.filter(d => d.existingVariantId).map(d => d.existingVariantId!));

      existingVariants.forEach(v => {
        if (!keptExistingIds.has(v.id)) {
          deleteVariant(v.id);
        }
      });

      includedDrafts.forEach(d => {
        // Les drafts de variantes contiennent le TTC saisi → convertir en HT pour la BDD
        const variantSalePriceHT = Math.round((parseFloat(d.salePrice) || 0) / (1 + vatRate / 100) * 100) / 100;
        if (d.existingVariantId) {
          updateVariantFn(d.existingVariantId, {
            attributes: d.attributes,
            sku: d.sku,
            purchasePrice: parseFloat(d.purchasePrice) || 0,
            salePrice: variantSalePriceHT,
            stockQuantity: parseInt(d.stockQuantity, 10) || 0,
            minStock: parseInt(d.minStock, 10) || 0,
          }, { silent: true });
        } else {
          createVariant({
            productId: editingId,
            attributes: d.attributes,
            sku: d.sku,
            purchasePrice: parseFloat(d.purchasePrice) || 0,
            salePrice: variantSalePriceHT,
            stockQuantity: parseInt(d.stockQuantity, 10) || 0,
            minStock: parseInt(d.minStock, 10) || 0,
            isActive: true,
          });
        }
      });

      if (includedDrafts.length === 0 && selectedAttrIds.length === 0 && existingVariants.length === 0) {
        createVariant({
          productId: editingId,
          attributes: {},
          sku: generateVariantSKU(form.brand || '', form.name || '', 1),
          purchasePrice, salePrice, stockQuantity: 0, minStock: lowStockThreshold, isActive: true,
        });
      }
    } else {
      const result = createProduct(data);
      if (!result.success) { setFormError(result.error || 'Erreur inconnue'); return; }
      const productId = result.productId;

      const includedDrafts = variantDrafts.filter(d => d.included);
      if (includedDrafts.length > 0 && productId) {
        const batchData = includedDrafts.map(d => ({
          attributes: d.attributes,
          sku: d.sku,
          purchasePrice: parseFloat(d.purchasePrice) || 0,
          // TTC saisi → HT stocké, arrondi à 2 décimales
          salePrice: Math.round((parseFloat(d.salePrice) || 0) / (1 + vatRate / 100) * 100) / 100,
          stockQuantity: parseInt(d.stockQuantity, 10) || 0,
          minStock: parseInt(d.minStock, 10) || 0,
        }));
        createVariantsBatch(productId, batchData);
      } else if (selectedAttrIds.length === 0 && productId) {
        createVariant({
          productId,
          attributes: {},
          sku: generateVariantSKU(form.brand || '', form.name || '', 1),
          purchasePrice, salePrice, stockQuantity: 0, minStock: lowStockThreshold, isActive: true,
        });
      }
    }

    setFormVisible(false);
  }, [form, variantDrafts, selectedAttrIds, editingId, createProduct, updateProduct, createVariantsBatch, createVariant, updateVariantFn, deleteVariant, getVariantsForProduct, products, generateVariantSKU]);

  const handleQuickSave = useCallback(() => {
    if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
    // form.salePrice contient le TTC saisi par l'utilisateur → on calcule le HT pour la BDD
    const salePriceTTC = parseFloat(form.salePrice);
    if (isNaN(salePriceTTC) || salePriceTTC <= 0) { setFormError('Le prix de vente doit être positif'); return; }
    const purchasePrice = parseFloat(form.purchasePrice) || 0;
    const lowStockThreshold = parseInt(form.lowStockThreshold, 10) || 5;
    const vatRate = parseFloat(form.vatRate) as VATRate;
    const salePrice = Math.round(salePriceTTC / (1 + vatRate / 100) * 100) / 100; // HT arrondi à 2 décimales
    const data = {
      name: form.name.trim(), description: form.description.trim(), sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      categoryName: form.category || undefined, brand: form.brand || undefined,
      purchasePrice, salePrice, vatRate, lowStockThreshold,
      unit: form.unit || 'pièce', type: form.type, isActive: form.isActive,
      photoUrl: form.photoUrl.trim() || undefined,
    };
    if (editingId) {
      const result = updateProduct(editingId, data);
      if (!result.success) { setFormError(result.error || 'Erreur inconnue'); return; }
    } else {
      const result = createProduct({ ...data, stockQuantity: 0 });
      if (!result.success) { setFormError(result.error || 'Erreur inconnue'); return; }
      const newProdId = result.productId;
      if (newProdId) {
        setEditingId(newProdId);
        createVariant({
          productId: newProdId,
          attributes: {},
          sku: generateVariantSKU(form.brand || '', form.name || '', 1),
          purchasePrice, salePrice, stockQuantity: 0, minStock: lowStockThreshold, isActive: true,
        });
      }
    }
    setFormVisible(false);
    showToast('Produit enregistré');
  }, [editingId, form, updateProduct, createProduct, products, createVariant, generateVariantSKU, showToast]);

  const applyBulkPrices = useCallback(() => {
    setVariantDrafts(prev => prev.map(d => ({
      ...d,
      ...(bulkPurchasePrice ? { purchasePrice: bulkPurchasePrice } : {}),
      ...(bulkSalePrice ? { salePrice: bulkSalePrice } : {}),
    })));
  }, [bulkPurchasePrice, bulkSalePrice]);

  const handleArchive = useCallback(() => {
    if (archiveConfirm) { archiveProduct(archiveConfirm); setArchiveConfirm(null); }
  }, [archiveConfirm, archiveProduct]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { deleteProduct(deleteConfirm); setDeleteConfirm(null); }
  }, [deleteConfirm, deleteProduct]);

  const updateField = useCallback(<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError('');
  }, []);

  const duplicateProduct = useMemo(() => {
    if (editingId) return null;
    const name = form.name.trim().toLowerCase();
    if (!name) return null;
    return products.find(p => {
      if (p.isArchived) return false;
      return p.name.trim().toLowerCase() === name
        && p.type === form.type
        && (p.categoryName || '') === (form.category || '');
    }) ?? null;
  }, [form.name, form.type, form.category, products, editingId]);

  const openProductDetail = useCallback((productId: string) => {
    setSelectedProductId(productId);
  }, []);

  const openVariantCreate = useCallback(() => {
    if (!selectedProduct) return;
    setEditingVariantId(null);
    // Pré-remplir avec le TTC du produit parent (BDD stocke HT → reconvertit)
    const parentSaleTTC = selectedProduct.salePrice * (1 + selectedProduct.vatRate / 100);
    setVariantForm({
      attributes: [{ key: '', value: '' }],
      sku: '', purchasePrice: String(selectedProduct.purchasePrice || ''),
      salePrice: String(parentSaleTTC || ''), stock: '0',
      minStock: String(selectedProduct.lowStockThreshold || '0'),
    });
    setVariantFormVisible(true);
  }, [selectedProduct]);

  const openVariantEdit = useCallback((v: ProductVariant) => {
    setEditingVariantId(v.id);
    const attrs = Object.entries(v.attributes).map(([key, value]) => ({ key, value }));
    if (attrs.length === 0) attrs.push({ key: '', value: '' });
    // BDD stocke HT → reconvertit en TTC pour affichage dans le formulaire
    const vatRate = selectedProduct?.vatRate ?? 20;
    const salePriceTTC = Math.round(v.salePrice * (1 + vatRate / 100) * 100) / 100;
    setVariantForm({
      attributes: attrs, sku: v.sku,
      purchasePrice: String(v.purchasePrice || ''),
      salePrice: String(salePriceTTC || ''),
      stock: String(v.stockQuantity || 0),
      minStock: String(v.minStock || 0),
    });
    setVariantFormVisible(true);
  }, [selectedProduct]);

  const handleSaveVariant = useCallback(() => {
    if (!selectedProductId) return;
    const attrs: Record<string, string> = {};
    variantForm.attributes.forEach((a) => {
      if (a.key.trim() && a.value.trim()) attrs[a.key.trim()] = a.value.trim();
    });
    // variantForm.salePrice est en TTC → convertir en HT pour la BDD
    const vatRate = selectedProduct?.vatRate ?? 20;
    const salePriceTTC = parseFloat(variantForm.salePrice) || 0;
    const salePrice = Math.round(salePriceTTC / (1 + vatRate / 100) * 100) / 100;
    const purchasePrice = parseFloat(variantForm.purchasePrice) || 0;
    const stock = parseInt(variantForm.stock, 10) || 0;
    const minStock = parseInt(variantForm.minStock, 10) || 0;
    if (editingVariantId) {
      updateVariantFn(editingVariantId, { attributes: attrs, sku: variantForm.sku.trim(), salePrice, purchasePrice, stockQuantity: stock, minStock });
    } else {
      createVariant({ productId: selectedProductId, attributes: attrs, sku: variantForm.sku.trim(), salePrice, purchasePrice, stockQuantity: stock, minStock, isActive: true });
    }
    setVariantFormVisible(false);
    setEditingVariantId(null);
  }, [selectedProductId, selectedProduct, variantForm, editingVariantId, createVariant, updateVariantFn]);

  const handleDeleteVariant = useCallback((variantId: string) => {
    Alert.alert('Supprimer', 'Supprimer cette variante ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteVariant(variantId) },
    ]);
  }, [deleteVariant]);

  const renderInfoRow = useCallback((label: string, value: string | undefined, valueColor?: string) => {
    if (!value) return null;
    return (
      <View style={detailStyles.infoRow}>
        <Text style={[detailStyles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
        <Text style={[detailStyles.infoValue, { color: valueColor || colors.text }]} numberOfLines={2}>{value}</Text>
      </View>
    );
  }, [colors]);

  const renderStepIndicator = () => (
    <View style={stepStyles.container}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={stepStyles.stepRow}>
          <View style={[
            stepStyles.stepCircle,
            {
              backgroundColor: formStep >= step ? colors.primary : colors.surfaceHover,
              borderColor: formStep >= step ? colors.primary : colors.border,
            },
          ]}>
            {formStep > step ? (
              <Check size={12} color="#FFF" />
            ) : (
              <Text style={[stepStyles.stepNumber, { color: formStep >= step ? '#FFF' : colors.textTertiary }]}>{step}</Text>
            )}
          </View>
          <Text style={[stepStyles.stepLabel, { color: formStep >= step ? colors.text : colors.textTertiary }]}>
            {step === 1 ? 'Infos' : step === 2 ? 'Attributs' : 'Variantes'}
          </Text>
          {step < 3 && <View style={[stepStyles.stepLine, { backgroundColor: formStep > step ? colors.primary : colors.border }]} />}
        </View>
      ))}
    </View>
  );

  /**
   * Étape 1 — Infos générales du produit.
   * Champs : type, nom, description, SKU, code-barres, catégorie, marque, unité,
   * TVA, prix d'achat HT, prix de vente TTC (converti en HT à la sauvegarde),
   * seuil stock, images.
   */
  const renderStep1 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
      <DropdownPicker
        label="Type" value={form.type} options={TYPE_OPTIONS}
        onSelect={(v) => updateField('type', v as ProductType)} required placeholder="Sélectionner le type..."
      />
      <FormField label="Nom" value={form.name} onChangeText={(v) => updateField('name', v)} placeholder="Nom du produit" required testID="product-name" />
      {duplicateProduct && (
        <View style={[styles.dupWarning, { backgroundColor: '#FEF3C7', borderColor: '#D97706' }]}>
          <AlertTriangle size={14} color="#B45309" />
          <View style={{ flex: 1 }}>
            <Text style={styles.dupWarningText}>
              Un produit « {duplicateProduct.name} » existe déjà dans{duplicateProduct.categoryName ? ` la catégorie "${duplicateProduct.categoryName}"` : ' cette catégorie'}.
            </Text>
            <TouchableOpacity
              onPress={() => { setFormVisible(false); openEdit(duplicateProduct.id); }}
              activeOpacity={0.7}
              style={styles.dupWarningLink}
            >
              <Text style={styles.dupWarningLinkText}>Voir le produit existant</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <FormField label="Description" value={form.description} onChangeText={(v) => updateField('description', v)} placeholder="Description" multiline numberOfLines={2} />
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <FormField label="Référence / SKU (auto)" value={form.sku} onChangeText={(v) => updateField('sku', v)} placeholder="REF-XXXXXX" editable={false} />
        </View>
        <View style={styles.formCol}>
          <FormField label="Code-barres / EAN" value={form.barcode} onChangeText={(v) => updateField('barcode', v)} placeholder="Ex: 3760001234567" />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <DropdownPicker label="Catégorie" value={form.category} options={categoryOptions}
            onSelect={(v) => updateField('category', v)}
            onAddNew={(v) => { void addProductCategory(v); updateField('category', v); }}
            addLabel="Nouvelle catégorie" placeholder="Sélectionner..."
            onRenameItem={(oldVal, newVal) => {
              void renameProductCategory(oldVal, newVal);
              if (form.category === oldVal) updateField('category', newVal);
            }}
            onDeleteItem={(val) => {
              void removeProductCategory(val);
              if (form.category === val) updateField('category', '');
            }}
            getDeleteWarning={(val) => {
              const count = products.filter(p => p.categoryName === val && !p.isArchived).length;
              if (count > 0) return `${count} produit(s) utilisent cette catégorie. Supprimer quand même ?`;
              return null;
            }}
          />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <DropdownPicker label="Marque" value={form.brand} options={brandOptions}
            onSelect={(v) => updateField('brand', v)}
            onAddNew={(v) => { void addProductBrand(v); updateField('brand', v); }}
            addLabel="Nouvelle marque" placeholder="Sélectionner..."
            onRenameItem={(oldVal, newVal) => {
              void renameProductBrand(oldVal, newVal);
              if (form.brand === oldVal) updateField('brand', newVal);
            }}
            onDeleteItem={(val) => {
              void removeProductBrand(val);
              if (form.brand === val) updateField('brand', '');
            }}
            getDeleteWarning={(val) => {
              const count = products.filter(p => p.brand === val && !p.isArchived).length;
              if (count > 0) return `${count} produit(s) utilisent cette marque. Supprimer quand même ?`;
              return null;
            }}
          />
        </View>
        <View style={styles.formCol}>
          <DropdownPicker label="Unité" value={form.unit} options={unitOptions}
            onSelect={(v) => updateField('unit', v)}
            onAddNew={(v) => { addProductUnit(v); updateField('unit', v); }}
            addLabel="Nouvelle unité" required placeholder="Sélectionner..." />
        </View>
      </View>
      {/* ── Prix ── L'utilisateur saisit le prix TTC ; le HT est calculé en direct */}
      <DropdownPicker label="Taux de TVA" value={form.vatRate} options={vatOptions}
        onSelect={(v) => updateField('vatRate', v)} required placeholder="Sélectionner le taux..." />
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          {/* Prix d'achat HT saisi manuellement pour calcul de marge */}
          <FormField label="Prix d'achat HT" value={form.purchasePrice}
            onChangeText={(v) => updateField('purchasePrice', v)} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
        <View style={styles.formCol}>
          {/* Prix de vente TTC — converti en HT avant enregistrement */}
          <FormField label="Prix de vente TTC" value={form.salePrice}
            onChangeText={(v) => updateField('salePrice', v)} placeholder="0.00" keyboardType="decimal-pad" required />
        </View>
      </View>
      {/* Affichage du prix HT calculé à partir du TTC et de la TVA */}
      {parseFloat(form.salePrice) > 0 && (
        <View style={[styles.marginInfo, { backgroundColor: '#EFF6FF' }]}>
          <Text style={[styles.marginInfoText, { color: '#1E40AF' }]}>
            Prix HT : {formatCurrency(parseFloat(form.salePrice) / (1 + parseFloat(form.vatRate) / 100), cur)} (TVA {form.vatRate.replace('.', ',')}%)
          </Text>
        </View>
      )}
      {/* Marge calculée entre prix d'achat HT et prix de vente HT déduit du TTC */}
      {parseFloat(form.salePrice) > 0 && parseFloat(form.purchasePrice) > 0 && (() => {
        const salePriceHT = parseFloat(form.salePrice) / (1 + parseFloat(form.vatRate) / 100);
        const purchasePriceHT = parseFloat(form.purchasePrice);
        const marginAmt = salePriceHT - purchasePriceHT;
        const marginPct = ((1 - purchasePriceHT / salePriceHT) * 100).toFixed(1);
        return (
          <View style={[styles.marginInfo, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.marginInfoText, { color: colors.success }]}>
              Marge : {formatCurrency(marginAmt, cur)} ({marginPct}%)
            </Text>
          </View>
        );
      })()}
      <FormField label="Seuil alerte stock" value={form.lowStockThreshold}
        onChangeText={(v) => updateField('lowStockThreshold', v)} placeholder="5" keyboardType="numeric" />
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const }}>
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
            <ImageIcon size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }}>Images du produit</Text>
          </View>
          <TouchableOpacity
            onPress={async () => {
              try {
                if (Platform.OS === 'web') {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = true;
                  input.onchange = (e: any) => {
                    const files = e.target?.files;
                    if (!files) return;
                    const newUris: string[] = [];
                    for (let i = 0; i < files.length; i++) {
                      newUris.push(URL.createObjectURL(files[i]));
                    }
                    updateField('imageUrls', [...form.imageUrls, ...newUris]);
                  };
                  input.click();
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsMultipleSelection: true,
                  quality: 0.8,
                });
                if (!result.canceled && result.assets?.length) {
                  const newUris = result.assets.map(a => a.uri);
                  updateField('imageUrls', [...form.imageUrls, ...newUris]);
                }
              } catch {}
            }}
            style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primaryLight }}
          >
            <Upload size={12} color={colors.primary} />
            <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.primary }}>Importer</Text>
          </TouchableOpacity>
        </View>
        {form.imageUrls.length === 0 && !form.photoUrl.trim() ? (
          <TouchableOpacity
            onPress={async () => {
              try {
                if (Platform.OS === 'web') {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = true;
                  input.onchange = (e: any) => {
                    const files = e.target?.files;
                    if (!files) return;
                    const newUris: string[] = [];
                    for (let i = 0; i < files.length; i++) {
                      newUris.push(URL.createObjectURL(files[i]));
                    }
                    updateField('imageUrls', newUris);
                  };
                  input.click();
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsMultipleSelection: true,
                  quality: 0.8,
                });
                if (!result.canceled && result.assets?.length) {
                  const newUris = result.assets.map(a => a.uri);
                  updateField('imageUrls', newUris);
                }
              } catch {}
            }}
            style={{ borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: colors.border, borderRadius: 10, paddingVertical: 20, alignItems: 'center' as const, gap: 6 }}
          >
            <Upload size={24} color={colors.textTertiary} />
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>Importer des images depuis l'appareil</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(form.imageUrls.length > 0 ? form.imageUrls : (form.photoUrl.trim() ? [form.photoUrl] : [])).map((uri, idx) => (
                <View key={`img_${idx}`} style={{ position: 'relative' as const }}>
                  <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 8 }} resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => {
                      if (form.imageUrls.length > 0) {
                        const updated = form.imageUrls.filter((_, i) => i !== idx);
                        updateField('imageUrls', updated);
                      } else {
                        updateField('photoUrl', '');
                      }
                    }}
                    style={{ position: 'absolute' as const, top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center' as const, justifyContent: 'center' as const }}
                    hitSlop={6}
                  >
                    <X size={10} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const [newInlineAttrName, setNewInlineAttrName] = useState('');
  const [newInlineAttrValues, setNewInlineAttrValues] = useState('');
  const [showInlineNewAttr, setShowInlineNewAttr] = useState(false);
  const [inlineAddValueAttrId, setInlineAddValueAttrId] = useState<string | null>(null);
  const [inlineNewValue, setInlineNewValue] = useState('');

  const [attrMgmtNewName, setAttrMgmtNewName] = useState('');
  const [attrMgmtNewValues, setAttrMgmtNewValues] = useState('');
  const [attrMgmtEditingId, setAttrMgmtEditingId] = useState<string | null>(null);
  const [attrMgmtNewValueInput, setAttrMgmtNewValueInput] = useState('');
  const [attrMgmtRenamingId, setAttrMgmtRenamingId] = useState<string | null>(null);
  const [attrMgmtRenameValue, setAttrMgmtRenameValue] = useState('');

  /**
   * Étape 2 — Sélection des attributs (Taille, Couleur…).
   * Chaque attribut coché génère des combinaisons de variantes à l'étape 3.
   * Si aucun attribut n'est sélectionné, le produit sera simple (1 variante par défaut).
   */
  const renderStep2 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
      <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>Sélectionner les attributs</Text>
      <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
        Cochez les attributs applicables puis sélectionnez les valeurs souhaitées.
        Si aucun attribut n'est coché, le produit sera créé sans variante.
      </Text>
      {productAttributes.map(attr => {
        const isSelected = selectedAttrIds.includes(attr.id);
        const selectedVals = selectedAttrValues[attr.id] || [];
        return (
          <View key={attr.id} style={[stepStyles.attrCard, { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.cardBorder }]}>
            <TouchableOpacity
              style={stepStyles.attrHeader}
              onPress={() => {
                if (isSelected) {
                  setSelectedAttrIds(prev => prev.filter(id => id !== attr.id));
                  setSelectedAttrValues(prev => { const n = { ...prev }; delete n[attr.id]; return n; });
                } else {
                  setSelectedAttrIds(prev => [...prev, attr.id]);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[
                stepStyles.checkbox,
                {
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}>
                {isSelected && <Check size={12} color="#FFF" />}
              </View>
              <Text style={[stepStyles.attrName, { color: colors.text }]}>{attr.name}</Text>
              <Text style={[stepStyles.attrCount, { color: colors.textTertiary }]}>{attr.values.length} valeurs</Text>
            </TouchableOpacity>
            {isSelected && (
              <View style={stepStyles.attrValues}>
                {attr.values.map((val, valIdx) => {
                  const isValSelected = selectedVals.includes(val);
                  return (
                    <TouchableOpacity
                      key={`${attr.id}_${val}_${valIdx}`}
                      style={[
                        stepStyles.valueChip,
                        {
                          backgroundColor: isValSelected ? `${colors.primary}15` : colors.surfaceHover,
                          borderColor: isValSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        setSelectedAttrValues(prev => {
                          const curr = prev[attr.id] || [];
                          const next = isValSelected ? curr.filter(v => v !== val) : [...curr, val];
                          return { ...prev, [attr.id]: next };
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      {isValSelected && <Check size={10} color={colors.primary} />}
                      <Text style={[stepStyles.valueChipText, { color: isValSelected ? colors.primary : colors.textSecondary }]}>{val}</Text>
                    </TouchableOpacity>
                  );
                })}
                {inlineAddValueAttrId === attr.id ? (
                  <View style={step2Styles.inlineAddRow}>
                    <TextInput
                      style={[step2Styles.inlineInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                      value={inlineNewValue}
                      onChangeText={setInlineNewValue}
                      placeholder="Valeur..."
                      placeholderTextColor={colors.textTertiary}
                      autoFocus
                      onSubmitEditing={() => {
                        if (inlineNewValue.trim()) {
                          addAttributeValue(attr.id, inlineNewValue.trim());
                          setSelectedAttrValues(prev => ({
                            ...prev,
                            [attr.id]: [...(prev[attr.id] || []), inlineNewValue.trim()],
                          }));
                          setInlineNewValue('');
                        }
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (inlineNewValue.trim()) {
                          addAttributeValue(attr.id, inlineNewValue.trim());
                          setSelectedAttrValues(prev => ({
                            ...prev,
                            [attr.id]: [...(prev[attr.id] || []), inlineNewValue.trim()],
                          }));
                          setInlineNewValue('');
                        }
                        setInlineAddValueAttrId(null);
                      }}
                      style={[step2Styles.inlineAddBtn, { backgroundColor: colors.primary }]}
                    >
                      <Check size={12} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setInlineAddValueAttrId(null); setInlineNewValue(''); }}>
                      <X size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[step2Styles.addValueBtn, { borderColor: colors.primary }]}
                    onPress={() => { setInlineAddValueAttrId(attr.id); setInlineNewValue(''); }}
                  >
                    <Plus size={10} color={colors.primary} />
                    <Text style={[step2Styles.addValueBtnText, { color: colors.primary }]}>Valeur</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      {showInlineNewAttr ? (
        <View style={[step2Styles.newAttrCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={[step2Styles.newAttrTitle, { color: colors.text }]}>Nouvel attribut</Text>
          <TextInput
            style={[step2Styles.newAttrInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={newInlineAttrName}
            onChangeText={setNewInlineAttrName}
            placeholder="Nom (ex: Taille, Couleur...)"
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />
          <TextInput
            style={[step2Styles.newAttrInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={newInlineAttrValues}
            onChangeText={setNewInlineAttrValues}
            placeholder="Valeurs séparées par des virgules (ex: S, M, L)"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={step2Styles.newAttrActions}>
            <TouchableOpacity
              style={[step2Styles.newAttrCancel, { borderColor: colors.border }]}
              onPress={() => { setShowInlineNewAttr(false); setNewInlineAttrName(''); setNewInlineAttrValues(''); }}
            >
              <Text style={[step2Styles.newAttrCancelText, { color: colors.textSecondary }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[step2Styles.newAttrSubmit, { backgroundColor: colors.primary, opacity: newInlineAttrName.trim() ? 1 : 0.5 }]}
              onPress={() => {
                if (!newInlineAttrName.trim()) return;
                const values = newInlineAttrValues.split(',').map(v => v.trim()).filter(Boolean);
                addProductAttribute(newInlineAttrName.trim(), values);
                setNewInlineAttrName('');
                setNewInlineAttrValues('');
                setShowInlineNewAttr(false);
              }}
              disabled={!newInlineAttrName.trim()}
            >
              <Plus size={14} color="#FFF" />
              <Text style={step2Styles.newAttrSubmitText}>Créer</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[step2Styles.addAttrBtn, { borderColor: colors.primary }]}
          onPress={() => setShowInlineNewAttr(true)}
          activeOpacity={0.7}
        >
          <Plus size={14} color={colors.primary} />
          <Text style={[step2Styles.addAttrBtnText, { color: colors.primary }]}>Nouvel attribut</Text>
        </TouchableOpacity>
      )}

      {productAttributes.length === 0 && !showInlineNewAttr && (
        <View style={[stepStyles.emptyAttrs, { backgroundColor: colors.surfaceHover }]}>
          <Tags size={24} color={colors.textTertiary} />
          <Text style={[stepStyles.emptyText, { color: colors.textSecondary }]}>
            Aucun attribut défini. Créez-en un ci-dessus ou passez à l'étape suivante pour un produit simple.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  /**
   * Étape 3 — Variantes et prix.
   * Si aucune variante (produit simple) : champs prix achat HT + vente TTC + stock.
   * Si variantes : tableau de drafts avec prix achat HT + vente TTC + stock par variante.
   * Les prix TTC sont convertis en HT dans handleFinalSubmit avant enregistrement.
   */
  const renderStep3 = () => {
    const hasVariants = variantDrafts.length > 0;
    const includedCount = variantDrafts.filter(d => d.included).length;

    if (!hasVariants) {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
          <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>Produit simple</Text>
          <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
            Aucun attribut sélectionné. Le produit sera créé avec une seule variante par défaut.
          </Text>
          <View style={[step3Styles.simpleCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                {/* Prix d'achat HT pour calcul de marge */}
                <FormField label="Prix d'achat HT (€)" value={form.purchasePrice}
                  onChangeText={(v) => updateField('purchasePrice', v)} placeholder="0.00" keyboardType="decimal-pad" />
              </View>
              <View style={styles.formCol}>
                {/* Prix de vente TTC saisi par l'utilisateur */}
                <FormField label="Prix de vente TTC (€)" value={form.salePrice}
                  onChangeText={(v) => updateField('salePrice', v)} placeholder="0.00" keyboardType="decimal-pad" required />
              </View>
            </View>
            <FormField label="Stock initial" value={form.lowStockThreshold}
              onChangeText={(v) => updateField('lowStockThreshold', v)} placeholder="0" keyboardType="numeric" />
            {parseFloat(form.salePrice) > 0 && parseFloat(form.purchasePrice) > 0 && (() => {
              const salePriceHT = parseFloat(form.salePrice) / (1 + parseFloat(form.vatRate) / 100);
              const purchasePriceHT = parseFloat(form.purchasePrice);
              const marginAmt = salePriceHT - purchasePriceHT;
              const marginPct = ((1 - purchasePriceHT / salePriceHT) * 100).toFixed(1);
              return (
                <View style={[styles.marginInfo, { backgroundColor: colors.successLight }]}>
                  <Text style={[styles.marginInfoText, { color: colors.success }]}>
                    Marge : {formatCurrency(marginAmt, cur)} ({marginPct}%)
                  </Text>
                </View>
              );
            })()}
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
        <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>
          {variantDrafts.length} variante{variantDrafts.length > 1 ? 's' : ''}
        </Text>
        <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
          {includedCount} incluse{includedCount > 1 ? 's' : ''} — Chaque variante peut avoir son propre prix (par défaut : prix générique du produit)
        </Text>

        <View style={[stepStyles.bulkRow, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
          <Text style={[stepStyles.bulkLabel, { color: colors.textSecondary }]}>Appliquer à toutes :</Text>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[stepStyles.bulkInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={bulkPurchasePrice} onChangeText={setBulkPurchasePrice}
              placeholder="Achat HT" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            {/* Vente TTC — sera converti en HT avant enregistrement */}
            <TextInput
              style={[stepStyles.bulkInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={bulkSalePrice} onChangeText={setBulkSalePrice}
              placeholder="Vente TTC" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad"
            />
          </View>
          <TouchableOpacity style={[stepStyles.bulkBtn, { backgroundColor: colors.primary }]} onPress={applyBulkPrices}>
            <Check size={14} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={stepStyles.draftHeaderRow}>
          <View style={{ width: 28 }} />
          <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, flex: 1 }]}>SKU</Text>
          <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, flex: 1 }]}>Prix d'achat HT</Text>
          <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, flex: 1 }]}>Prix de vente TTC</Text>
          <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, width: 60 }]}>Stock</Text>
          <View style={{ width: 14 }} />
        </View>

        {variantDrafts.map((draft, idx) => {
          const attrLabel = Object.entries(draft.attributes).map(([k, v]) => `${k}: ${v}`).join(' / ');
          return (
            <View key={idx} style={[
              stepStyles.draftCard,
              {
                backgroundColor: draft.included ? colors.card : colors.surfaceHover,
                borderColor: draft.included ? colors.cardBorder : colors.border,
                opacity: draft.included ? 1 : 0.5,
              },
            ]}>
              <View style={stepStyles.draftHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setVariantDrafts(prev => prev.map((d, i) => i === idx ? { ...d, included: !d.included } : d));
                  }}
                  style={[
                    stepStyles.checkbox,
                    {
                      backgroundColor: draft.included ? colors.primary : 'transparent',
                      borderColor: draft.included ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {draft.included && <Check size={12} color="#FFF" />}
                </TouchableOpacity>
                <Text style={[stepStyles.draftAttrLabel, { color: colors.text }]} numberOfLines={1}>{attrLabel}</Text>
                <TouchableOpacity onPress={() => setVariantDrafts(prev => prev.filter((_, i) => i !== idx))}>
                  <X size={14} color={colors.danger} />
                </TouchableOpacity>
              </View>
              {draft.included && (
                <View style={stepStyles.draftFields}>
                  <TextInput
                    style={[stepStyles.draftInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                    value={draft.sku} placeholder="SKU" placeholderTextColor={colors.textTertiary}
                    onChangeText={t => setVariantDrafts(prev => prev.map((d, i) => i === idx ? { ...d, sku: t } : d))}
                  />
                  <TextInput
                    style={[stepStyles.draftInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, flex: 1 }]}
                    value={draft.purchasePrice} placeholder="Achat HT" placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    onChangeText={t => setVariantDrafts(prev => prev.map((d, i) => i === idx ? { ...d, purchasePrice: t } : d))}
                  />
                  {/* Vente TTC — sera converti en HT lors de l'enregistrement */}
                  <TextInput
                    style={[stepStyles.draftInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, flex: 1 }]}
                    value={draft.salePrice} placeholder="Vente TTC" placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    onChangeText={t => setVariantDrafts(prev => prev.map((d, i) => i === idx ? { ...d, salePrice: t } : d))}
                  />
                  <TextInput
                    style={[stepStyles.draftInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, width: 60 }]}
                    value={draft.stockQuantity} placeholder="Stock" placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    onChangeText={t => setVariantDrafts(prev => prev.map((d, i) => i === idx ? { ...d, stockQuantity: t } : d))}
                  />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  /**
   * Fiche produit (lecture seule).
   * Affiche les prix en TTC (BDD stocke HT → reconvertit à l'affichage).
   * Permet d'accéder à l'édition et de gérer les variantes.
   */
  const renderProductDetail = () => {
    if (!selectedProduct) return null;
    const totalStock = getProductTotalStock(selectedProduct.id);
    const isLowStock = isStockableType(selectedProduct.type) && selectedProductVariants.some(v => v.stockQuantity <= (v.minStock || selectedProduct.lowStockThreshold));
    // Marge calculée sur les prix HT stockés en BDD (salePrice est HT en BDD)
    const margin = selectedProduct.purchasePrice > 0 && selectedProduct.salePrice > 0
      ? ((1 - selectedProduct.purchasePrice / selectedProduct.salePrice) * 100).toFixed(1)
      : null;

    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={() => setSelectedProductId(null)}>
        <Pressable style={detailStyles.overlay} onPress={() => setSelectedProductId(null)}>
          <Pressable
            style={[detailStyles.modal, { backgroundColor: colors.card, width: isMobile ? width - 24 : 560 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setSelectedProductId(null)} hitSlop={8} style={[detailStyles.backBtn, { backgroundColor: colors.surfaceHover }]}>
                <ChevronLeft size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={detailStyles.headerCenter}>
                <Text style={[detailStyles.headerTitle, { color: colors.text }]} numberOfLines={1}>{selectedProduct.name}</Text>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
                  {selectedProduct.type === 'service' ? <Briefcase size={12} color={colors.primary} /> : <Box size={12} color={getProductTypeConfig(selectedProduct.type).color} />}
                  <Text style={[detailStyles.headerSubtitle, { color: colors.textSecondary }]}>
                    {getProductTypeConfig(selectedProduct.type).label}
                    {selectedProduct.categoryName ? ` · ${selectedProduct.categoryName}` : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => { setSelectedProductId(null); openEdit(selectedProduct.id); }}
                style={[detailStyles.editBtn, { backgroundColor: colors.primaryLight }]}
                hitSlop={8}
              >
                <Pencil size={14} color={colors.primary} />
              </TouchableOpacity>
              {(selectedProduct.isArchived || !selectedProduct.isActive) ? (
                <TouchableOpacity
                  onPress={() => {
                    unarchiveProduct(selectedProduct.id);
                    setSelectedProductId(null);
                  }}
                  style={[detailStyles.editBtn, { backgroundColor: colors.successLight }]}
                  hitSlop={8}
                >
                  <Archive size={14} color={colors.success} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Archiver', `Archiver « ${selectedProduct.name} » ?`, [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Archiver', style: 'destructive', onPress: () => { archiveProduct(selectedProduct.id); setSelectedProductId(null); } },
                    ]);
                  }}
                  style={[detailStyles.editBtn, { backgroundColor: colors.warningLight || '#FEF3C7' }]}
                  hitSlop={8}
                >
                  <Archive size={14} color={colors.warning || '#D97706'} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Supprimer', `Supprimer définitivement « ${selectedProduct.name} » et toutes ses variantes ?`, [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Supprimer', style: 'destructive', onPress: () => { deleteProduct(selectedProduct.id); setSelectedProductId(null); } },
                  ]);
                }}
                style={[detailStyles.deleteBtn, { backgroundColor: colors.dangerLight }]}
                hitSlop={8}
              >
                <Trash2 size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>

            <ScrollView style={detailStyles.body} contentContainerStyle={detailStyles.bodyContent} showsVerticalScrollIndicator={false}>
              {selectedProduct.photoUrl ? (
                <Image source={{ uri: selectedProduct.photoUrl }} style={detailStyles.productImage} resizeMode="cover" />
              ) : null}

              {selectedProduct.description ? (
                <Text style={[detailStyles.description, { color: colors.textSecondary }]}>{selectedProduct.description}</Text>
              ) : null}

              {/* ── Carte des prix — affichage en TTC (BDD stocke HT, on reconvertit) ── */}
              <View style={[detailStyles.priceCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                <View style={detailStyles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>Prix de vente TTC</Text>
                    <Text style={[detailStyles.priceValue, { color: colors.text }]}>
                      {formatCurrency(selectedProduct.salePrice * (1 + selectedProduct.vatRate / 100), cur)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>Prix d'achat HT</Text>
                    <Text style={[detailStyles.priceValue, { color: colors.text }]}>{formatCurrency(selectedProduct.purchasePrice, cur)}</Text>
                  </View>
                  {margin && (
                    <View style={{ flex: 1 }}>
                      <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>Marge</Text>
                      <Text style={[detailStyles.priceValue, { color: colors.success }]}>{margin}%</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={[detailStyles.infoSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                {renderInfoRow('Référence / SKU', selectedProduct.sku || '—')}
                {renderInfoRow('Marque', selectedProduct.brand)}
                {renderInfoRow('Unité', selectedProduct.unit)}
                {renderInfoRow('Taux de TVA', `${String(selectedProduct.vatRate).replace('.', ',')}%`)}
                {isStockableType(selectedProduct.type) && (
                  <>
                    <View style={detailStyles.infoRow}>
                      <Text style={[detailStyles.infoLabel, { color: colors.textTertiary }]}>Stock total</Text>
                      <View style={[detailStyles.stockBadge, { backgroundColor: isLowStock ? colors.dangerLight : colors.successLight }]}>
                        <Text style={[detailStyles.stockText, { color: isLowStock ? colors.danger : colors.success }]}>{totalStock}</Text>
                      </View>
                    </View>
                    {renderInfoRow('Seuil alerte stock', String(selectedProduct.lowStockThreshold))}
                  </>
                )}
              </View>

              <View style={[detailStyles.variantsSection, { borderColor: colors.cardBorder }]}>
                <View style={detailStyles.variantsHeader}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                    <Layers size={16} color={colors.primary} />
                    <Text style={[detailStyles.variantsTitle, { color: colors.text }]}>Variantes</Text>
                    {selectedProductVariants.length > 0 && (
                      <View style={[detailStyles.variantCountBadge, { backgroundColor: `${colors.primary}15` }]}>
                        <Text style={[detailStyles.variantCountText, { color: colors.primary }]}>{selectedProductVariants.length}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={openVariantCreate} style={[detailStyles.addVariantBtn, { backgroundColor: colors.primaryLight }]}>
                    <Plus size={14} color={colors.primary} />
                    <Text style={[detailStyles.addVariantText, { color: colors.primary }]}>Ajouter</Text>
                  </TouchableOpacity>
                </View>

                {selectedProductVariants.length === 0 ? (
                  <View style={detailStyles.emptyVariants}>
                    <Layers size={28} color={colors.textTertiary} />
                    <Text style={[detailStyles.emptyVariantsText, { color: colors.textTertiary }]}>Aucune variante</Text>
                    <Text style={[detailStyles.emptyVariantsHint, { color: colors.textTertiary }]}>
                      Ajoutez des variantes avec des attributs différents (taille, couleur...)
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 1 }}>
                    {!isMobile && (
                      <View style={[detailStyles.variantTableHeader, { backgroundColor: colors.surfaceHover }]}>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 2 }]}>ATTRIBUTS</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 1 }]}>SKU</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 1, textAlign: 'right' as const }]}>ACHAT HT</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 1, textAlign: 'right' as const }]}>VENTE TTC</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 0.6, textAlign: 'center' as const }]}>STOCK</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 0.6, textAlign: 'right' as const }]}>ACTIONS</Text>
                      </View>
                    )}
                    {selectedProductVariants.map((v) => {
                      const hasAttrs = Object.keys(v.attributes).length > 0;
                      const attrLabel = hasAttrs
                        ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' — ')
                        : 'Variante par défaut';
                      const variantLowStock = v.stockQuantity <= (v.minStock || selectedProduct.lowStockThreshold);
                      // BDD stocke HT → reconvertit en TTC pour l'affichage
                      const variantSaleTTC = v.salePrice * (1 + selectedProduct.vatRate / 100);
                      return (
                        <View key={v.id} style={[detailStyles.variantRow, { borderBottomColor: colors.borderLight }]}>
                          {isMobile ? (
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text style={[detailStyles.variantAttrText, { color: colors.text }]}>{attrLabel}</Text>
                              <View style={{ flexDirection: 'row' as const, gap: 12, flexWrap: 'wrap' as const }}>
                                {v.sku ? <Text style={{ fontSize: 11, color: colors.textTertiary }}>SKU: {v.sku}</Text> : null}
                                <Text style={{ fontSize: 11, color: colors.textTertiary }}>Achat HT: {formatCurrency(v.purchasePrice, cur)}</Text>
                                <Text style={{ fontSize: 11, color: colors.text, fontWeight: '600' as const }}>Vente TTC: {formatCurrency(variantSaleTTC, cur)}</Text>
                                <View style={[styles.stockBadge, { backgroundColor: variantLowStock ? colors.dangerLight : colors.successLight }]}>
                                  <Text style={[styles.stockText, { color: variantLowStock ? colors.danger : colors.success }]}>{v.stockQuantity}</Text>
                                </View>
                              </View>
                            </View>
                          ) : (
                            <>
                              <Text style={[detailStyles.variantAttrText, { flex: 2, color: colors.text }]} numberOfLines={1}>{attrLabel}</Text>
                              <Text style={{ flex: 1, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{v.sku || '—'}</Text>
                              <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'right' as const }}>{formatCurrency(v.purchasePrice, cur)}</Text>
                              <Text style={{ flex: 1, fontSize: 12, color: colors.text, fontWeight: '600' as const, textAlign: 'right' as const }}>{formatCurrency(variantSaleTTC, cur)}</Text>
                              <View style={{ flex: 0.6, alignItems: 'center' as const }}>
                                <View style={[styles.stockBadge, { backgroundColor: variantLowStock ? colors.dangerLight : colors.successLight }]}>
                                  <Text style={[styles.stockText, { color: variantLowStock ? colors.danger : colors.success }]}>{v.stockQuantity}</Text>
                                </View>
                              </View>
                            </>
                          )}
                          <View style={{ flex: isMobile ? undefined : 0.6, flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 4 }}>
                            <TouchableOpacity onPress={() => openVariantEdit(v)} style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}>
                              <Pencil size={11} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteVariant(v.id)} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}>
                              <Trash2 size={11} color={colors.danger} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  /**
   * Modale d'ajout / édition d'une variante individuelle depuis la fiche produit.
   * Le champ "Prix de vente TTC" est converti en HT dans handleSaveVariant avant enregistrement.
   * À l'ouverture (openVariantEdit), le HT stocké est reconverti en TTC pour l'affichage.
   */
  const renderVariantFormModal = () => {
    if (!variantFormVisible) return null;
    const existingAttributeKeys = Array.from(new Set(
      productAttributes.map(a => a.name)
    )).sort();

    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={() => { setVariantFormVisible(false); setEditingVariantId(null); }}>
        <Pressable style={modalOverlay} onPress={() => { setVariantFormVisible(false); setEditingVariantId(null); }}>
          <Pressable style={[detailStyles.modal, { backgroundColor: colors.card, width: isMobile ? width - 32 : 460, maxHeight: '85%' as unknown as number }]} onPress={e => e.stopPropagation()}>
            <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[detailStyles.headerTitle, { color: colors.text, flex: 1 }]}>
                {editingVariantId ? 'Modifier la variante' : 'Ajouter une variante'}
              </Text>
              <TouchableOpacity onPress={() => { setVariantFormVisible(false); setEditingVariantId(null); }} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
              <Text style={[variantStyles.sectionLabel, { color: colors.textSecondary }]}>Attributs</Text>
              {variantForm.attributes.map((attr, idx) => (
                <View key={idx} style={variantStyles.attrRow}>
                  <View style={{ flex: 1 }}>
                    <DropdownPicker
                      label="Attribut" value={attr.key}
                      options={existingAttributeKeys.map((k) => ({ label: k, value: k }))}
                      onSelect={(val) => {
                        const updated = [...variantForm.attributes];
                        updated[idx] = { ...updated[idx], key: val };
                        setVariantForm((f) => ({ ...f, attributes: updated }));
                      }}
                      onAddNew={(val) => {
                        const updated = [...variantForm.attributes];
                        updated[idx] = { ...updated[idx], key: val };
                        setVariantForm((f) => ({ ...f, attributes: updated }));
                      }}
                      addLabel="Nouvel attribut" placeholder="Ex: Taille"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label="Valeur" value={attr.value}
                      onChangeText={(t) => {
                        const updated = [...variantForm.attributes];
                        updated[idx] = { ...updated[idx], value: t };
                        setVariantForm((f) => ({ ...f, attributes: updated }));
                      }}
                      placeholder="Ex: XL"
                    />
                  </View>
                  {variantForm.attributes.length > 1 && (
                    <TouchableOpacity
                      onPress={() => {
                        const updated = variantForm.attributes.filter((_, i) => i !== idx);
                        setVariantForm((f) => ({ ...f, attributes: updated }));
                      }}
                      style={{ justifyContent: 'center' as const, paddingTop: 22 }}
                    >
                      <X size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setVariantForm((f) => ({ ...f, attributes: [...f.attributes, { key: '', value: '' }] }))}
                style={[variantStyles.addAttrBtn, { borderColor: colors.primary }]}
              >
                <Plus size={14} color={colors.primary} />
                <Text style={[variantStyles.addAttrText, { color: colors.primary }]}>Ajouter un attribut</Text>
              </TouchableOpacity>

              <FormField label="SKU variante" value={variantForm.sku}
                onChangeText={(t) => setVariantForm((f) => ({ ...f, sku: t }))} placeholder="SKU-001-XL" />
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  {/* Prix d'achat HT pour calcul de marge */}
                  <FormField label="Prix d'achat HT" value={variantForm.purchasePrice}
                    onChangeText={(t) => setVariantForm((f) => ({ ...f, purchasePrice: t }))} placeholder="0.00" keyboardType="decimal-pad" />
                </View>
                <View style={styles.formCol}>
                  {/* Prix de vente TTC — converti en HT à l'enregistrement */}
                  <FormField label="Prix de vente TTC" value={variantForm.salePrice}
                    onChangeText={(t) => setVariantForm((f) => ({ ...f, salePrice: t }))} placeholder="0.00" keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <FormField label="Stock initial" value={variantForm.stock}
                    onChangeText={(t) => setVariantForm((f) => ({ ...f, stock: t }))} placeholder="0" keyboardType="numeric" />
                </View>
                <View style={styles.formCol}>
                  <FormField label="Stock minimum" value={variantForm.minStock}
                    onChangeText={(t) => setVariantForm((f) => ({ ...f, minStock: t }))} placeholder="0" keyboardType="numeric" />
                </View>
              </View>
            </ScrollView>
            <View style={[stepStyles.formFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[stepStyles.cancelBtn, { borderColor: colors.border }]} onPress={() => { setVariantFormVisible(false); setEditingVariantId(null); }}>
                <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleSaveVariant}>
                <Text style={stepStyles.nextBtnText}>{editingVariantId ? 'Mettre à jour' : 'Ajouter'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  /**
   * Modale multi-étapes de création / édition d'un produit.
   * Étapes : 1 (infos) → 2 (attributs) → 3 (variantes + prix).
   * La navigation entre étapes est gérée par handleNextStep / handlePrevStep.
   * La soumission finale est gérée par handleFinalSubmit (conversion TTC→HT incluse).
   */
  const renderFormModal = () => {
    if (!formVisible) return null;
    const isEditing = !!editingId;
    const stepTitle = formStep === 1 ? 'Étape 1 — Informations' : formStep === 2 ? 'Étape 2 — Attributs' : 'Étape 3 — Variantes';
    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <Pressable style={modalOverlay} onPress={() => setFormVisible(false)}>
          <Pressable style={[detailStyles.modal, { backgroundColor: colors.card, width: isMobile ? width - 16 : 540, maxHeight: isMobile ? '95%' as unknown as number : '90%' as unknown as number }]} onPress={e => e.stopPropagation()}>
            <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[detailStyles.headerTitle, { color: colors.text, flex: 1 }]}>
                {stepTitle}
              </Text>
              {editingId && (() => {
                const editProduct = products.find(p => p.id === editingId);
                if (editProduct?.isArchived || (editProduct && !editProduct.isActive)) {
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        unarchiveProduct(editingId);
                        setFormVisible(false);
                      }}
                      style={[detailStyles.editBtn, { backgroundColor: colors.successLight }]}
                      hitSlop={8}
                    >
                      <Archive size={14} color={colors.success} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    onPress={() => {
                      archiveProduct(editingId);
                      setFormVisible(false);
                    }}
                    style={[detailStyles.editBtn, { backgroundColor: colors.warningLight || '#FEF3C7' }]}
                    hitSlop={8}
                  >
                    <Archive size={14} color={colors.warning || '#D97706'} />
                  </TouchableOpacity>
                );
              })()}
              <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {renderStepIndicator()}

            {formError ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight, marginHorizontal: 16, marginTop: 8 }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
              </View>
            ) : null}

            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, minHeight: 0 }}>
              {formStep === 1 && renderStep1()}
              {formStep === 2 && renderStep2()}
              {formStep === 3 && renderStep3()}
            </View>

            <View style={[stepStyles.formFooter, { borderTopColor: colors.border }]}>
              {formStep > 1 ? (
                <TouchableOpacity style={[stepStyles.cancelBtn, { borderColor: colors.border }]} onPress={handlePrevStep}>
                  <ChevronLeft size={14} color={colors.textSecondary} />
                  <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>Retour</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[stepStyles.cancelBtn, { borderColor: colors.border }]} onPress={() => setFormVisible(false)}>
                  <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>Annuler</Text>
                </TouchableOpacity>
              )}
              <View style={{ flexDirection: 'row' as const, gap: 8 }}>
              {(formStep === 1 || formStep === 2) && (
                <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.success }]} onPress={handleQuickSave}>
                  <Check size={14} color="#FFF" />
                  <Text style={stepStyles.nextBtnText}>Enregistrer</Text>
                </TouchableOpacity>
              )}
              {formStep < 3 ? (
                <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleNextStep}>
                  <Text style={stepStyles.nextBtnText}>Suivant</Text>
                  <ChevronRight size={14} color="#FFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleFinalSubmit}>
                  <Check size={14} color="#FFF" />
                  <Text style={stepStyles.nextBtnText}>{isEditing ? 'Mettre à jour' : 'Créer le produit'}</Text>
                </TouchableOpacity>
              )}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const [showAttrMgmtNewForm, setShowAttrMgmtNewForm] = useState(false);

  /**
   * Onglet "Attributs" — Gestion des groupes d'attributs globaux (Taille, Couleur…).
   * Ces attributs sont partagés entre tous les produits et servent à générer les variantes.
   * CRUD : création, renommage, suppression de groupes et de leurs valeurs.
   */
  const renderAttributesTab = () => (
    <View style={{ gap: 16 }}>
      {productAttributes.length === 0 && !showAttrMgmtNewForm ? (
        <View style={attrMgmtStyles.empty}>
          <Tags size={32} color={colors.textTertiary} />
          <Text style={[attrMgmtStyles.emptyText, { color: colors.textSecondary }]}>Aucun attribut défini</Text>
          <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' as const, marginTop: 4 }}>
            Créez des groupes d'attributs (ex: Taille, Couleur) pour vos variantes de produits.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {productAttributes.map(attr => (
            <View key={attr.id} style={[attrMgmtStyles.attrCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={attrMgmtStyles.attrHeader}>
                <Tags size={14} color={colors.primary} />
                {attrMgmtRenamingId === attr.id ? (
                  <View style={attrMgmtStyles.renameRow}>
                    <TextInput
                      style={[attrMgmtStyles.renameInput, { backgroundColor: colors.inputBg, borderColor: colors.primary, color: colors.text }]}
                      value={attrMgmtRenameValue}
                      onChangeText={setAttrMgmtRenameValue}
                      autoFocus
                      onSubmitEditing={() => {
                        if (attrMgmtRenameValue.trim()) {
                          updateProductAttribute(attr.id, { name: attrMgmtRenameValue.trim() });
                        }
                        setAttrMgmtRenamingId(null);
                        setAttrMgmtRenameValue('');
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (attrMgmtRenameValue.trim()) {
                          updateProductAttribute(attr.id, { name: attrMgmtRenameValue.trim() });
                        }
                        setAttrMgmtRenamingId(null);
                        setAttrMgmtRenameValue('');
                      }}
                      style={[attrMgmtStyles.renameConfirmBtn, { backgroundColor: colors.primary }]}
                    >
                      <Check size={12} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setAttrMgmtRenamingId(null); setAttrMgmtRenameValue(''); }}>
                      <X size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => { setAttrMgmtRenamingId(attr.id); setAttrMgmtRenameValue(attr.name); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[attrMgmtStyles.attrName, { color: colors.text }]}>{attr.name}</Text>
                  </TouchableOpacity>
                )}
                <Text style={[attrMgmtStyles.attrCount, { color: colors.textTertiary }]}>{attr.values.length} valeur{attr.values.length > 1 ? 's' : ''}</Text>
                <TouchableOpacity
                  onPress={() => { setAttrMgmtRenamingId(attr.id); setAttrMgmtRenameValue(attr.name); }}
                  style={[attrMgmtStyles.editBtn, { backgroundColor: colors.primaryLight }]}
                  hitSlop={8}
                >
                  <Pencil size={12} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Supprimer', `Supprimer l'attribut "${attr.name}" ?`, [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: () => deleteProductAttribute(attr.id) },
                    ]);
                  }}
                  style={[attrMgmtStyles.deleteBtn, { backgroundColor: colors.dangerLight }]}
                  hitSlop={8}
                >
                  <Trash2 size={12} color={colors.danger} />
                </TouchableOpacity>
              </View>
              <View style={attrMgmtStyles.valuesRow}>
                {[...attr.values].sort((a, b) => a.localeCompare(b)).map((val, valIdx) => (
                  <View key={`${attr.id}_${val}_${valIdx}`} style={[attrMgmtStyles.valueChip, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
                    <Text style={[attrMgmtStyles.valueText, { color: colors.text }]}>{val}</Text>
                    <TouchableOpacity onPress={() => removeAttributeValue(attr.id, val)} hitSlop={4}>
                      <X size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
                {attrMgmtEditingId === attr.id ? (
                  <View style={attrMgmtStyles.inlineAddRow}>
                    <TextInput
                      style={[attrMgmtStyles.inlineInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                      value={attrMgmtNewValueInput}
                      onChangeText={setAttrMgmtNewValueInput}
                      placeholder="Valeur..."
                      placeholderTextColor={colors.textTertiary}
                      autoFocus
                      onSubmitEditing={() => {
                        if (attrMgmtNewValueInput.trim()) {
                          addAttributeValue(attr.id, attrMgmtNewValueInput.trim());
                          setAttrMgmtNewValueInput('');
                        }
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (attrMgmtNewValueInput.trim()) {
                          addAttributeValue(attr.id, attrMgmtNewValueInput.trim());
                          setAttrMgmtNewValueInput('');
                        }
                        setAttrMgmtEditingId(null);
                      }}
                      style={[attrMgmtStyles.inlineAddBtnSmall, { backgroundColor: colors.primary }]}
                    >
                      <Check size={12} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setAttrMgmtEditingId(null); setAttrMgmtNewValueInput(''); }}>
                      <X size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[attrMgmtStyles.addValueBtnSmall, { borderColor: colors.primary }]}
                    onPress={() => { setAttrMgmtEditingId(attr.id); setAttrMgmtNewValueInput(''); }}
                  >
                    <Plus size={12} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {showAttrMgmtNewForm ? (
        <View style={[attrMgmtStyles.newGroupCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={[attrMgmtStyles.newGroupTitle, { color: colors.text }]}>Nouveau groupe d'attributs</Text>
          <TextInput
            style={[attrMgmtStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={attrMgmtNewName}
            onChangeText={setAttrMgmtNewName}
            placeholder="Nom du groupe (ex: Taille, Couleur, Matière...)"
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />
          <TextInput
            style={[attrMgmtStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={attrMgmtNewValues}
            onChangeText={setAttrMgmtNewValues}
            placeholder="Valeurs séparées par des virgules (ex: S, M, L, XL)"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={attrMgmtStyles.newGroupActions}>
            <TouchableOpacity
              style={[attrMgmtStyles.newGroupCancelBtn, { borderColor: colors.border }]}
              onPress={() => { setShowAttrMgmtNewForm(false); setAttrMgmtNewName(''); setAttrMgmtNewValues(''); }}
            >
              <Text style={[attrMgmtStyles.newGroupCancelText, { color: colors.textSecondary }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[attrMgmtStyles.newGroupSubmitBtn, { backgroundColor: colors.primary, opacity: attrMgmtNewName.trim() ? 1 : 0.5 }]}
              onPress={() => {
                if (!attrMgmtNewName.trim()) return;
                const values = attrMgmtNewValues.split(',').map(v => v.trim()).filter(Boolean);
                addProductAttribute(attrMgmtNewName.trim(), values);
                setAttrMgmtNewName('');
                setAttrMgmtNewValues('');
                setShowAttrMgmtNewForm(false);
              }}
              disabled={!attrMgmtNewName.trim()}
            >
              <Check size={14} color="#FFF" />
              <Text style={attrMgmtStyles.newGroupSubmitText}>Créer le groupe</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[attrMgmtStyles.addGroupBtn, { borderColor: colors.primary }]}
          onPress={() => setShowAttrMgmtNewForm(true)}
          activeOpacity={0.7}
        >
          <Plus size={16} color={colors.primary} />
          <Text style={[attrMgmtStyles.addGroupBtnText, { color: colors.primary }]}>Ajouter un groupe d'attributs</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!embedded && (
        <PageHeader
          title="Produits & Services"
          action={
            subTab === 'catalogue' ? (
              <View style={{ flexDirection: 'row' as const, gap: 6 }}>
                <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }} onPress={() => setCsvImportVisible(true)}>
                  <Upload size={16} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
                  onPress={() => {
                    const cols: ExportColumn<Record<string, unknown>>[] = [
                      { key: 'name', label: 'Nom' },
                      { key: 'description', label: 'Description' },
                      { key: 'sku', label: 'SKU' },
                      { key: 'type', label: 'Type' },
                      { key: 'categoryName', label: 'Cat\u00e9gorie' },
                      { key: 'brand', label: 'Marque' },
                      { key: 'salePrice', label: 'Prix vente' },
                      { key: 'purchasePrice', label: 'Prix achat' },
                      { key: 'stockQuantity', label: 'Stock' },
                      { key: 'lowStockThreshold', label: 'Stock min' },
                      { key: 'unit', label: 'Unit\u00e9' },
                    ];
                    const data = displayProducts.map(p => ({ ...p } as unknown as Record<string, unknown>));
                    void exportToCSV(data, cols, `catalogue_${new Date().toISOString().slice(0, 10)}.csv`);
                  }}
                >
                  <Download size={16} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary }} onPress={openCreate} testID="create-product-btn">
                  <Plus size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
      <View style={[subTabStyles.bar, { borderBottomColor: colors.border }]}>
        <View style={subTabStyles.tabsRow}>
          <TouchableOpacity
            style={[subTabStyles.tab, subTab === 'catalogue' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setSubTab('catalogue')}
            activeOpacity={0.7}
          >
            <Package size={15} color={subTab === 'catalogue' ? colors.primary : colors.textTertiary} />
            <Text style={[subTabStyles.tabText, { color: subTab === 'catalogue' ? colors.primary : colors.textSecondary }]}>Produits ({totalProducts})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[subTabStyles.tab, subTab === 'attributes' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setSubTab('attributes')}
            activeOpacity={0.7}
          >
            <Tags size={15} color={subTab === 'attributes' ? colors.primary : colors.textTertiary} />
            <Text style={[subTabStyles.tabText, { color: subTab === 'attributes' ? colors.primary : colors.textSecondary }]}>Attributs</Text>
            {productAttributes.length > 0 && (
              <View style={[subTabStyles.badge, { backgroundColor: `${colors.primary}15` }]}>
                <Text style={[subTabStyles.badgeText, { color: colors.primary }]}>{productAttributes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {subTab === 'catalogue' && (
          <View style={subTabStyles.actionsRow}>
            <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }} onPress={() => setCsvImportVisible(true)}>
              <Upload size={15} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
              onPress={() => {
                const cols: ExportColumn<Record<string, unknown>>[] = [
                  { key: 'name', label: 'Nom' },
                  { key: 'sku', label: 'SKU' },
                  { key: 'type', label: 'Type' },
                  { key: 'categoryName', label: 'Cat\u00e9gorie' },
                  { key: 'salePrice', label: 'Prix vente' },
                  { key: 'purchasePrice', label: 'Prix achat' },
                  { key: 'stockQuantity', label: 'Stock' },
                  { key: 'unit', label: 'Unit\u00e9' },
                ];
                const data = displayProducts.map(p => ({ ...p } as unknown as Record<string, unknown>));
                void exportToCSV(data, cols, `catalogue_${new Date().toISOString().slice(0, 10)}.csv`);
              }}
            >
              <Download size={15} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary }} onPress={openCreate} testID="create-product-btn">
              <Plus size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {subTab === 'attributes' ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {renderAttributesTab()}
        </ScrollView>
      ) : (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.filterBar}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1, minWidth: 140 }]}>
            <Search size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Rechercher..."
              placeholderTextColor={colors.textTertiary}
              value={search} onChangeText={setSearch} testID="product-search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ position: 'relative' as const, zIndex: 200 }}>
            <TouchableOpacity
              style={[styles.sortDropdownBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => setShowSortDropdown(!showSortDropdown)}
              activeOpacity={0.7}
            >
              <ArrowUpDown size={14} color={colors.textSecondary} />
            </TouchableOpacity>
            {showSortDropdown && (
              <>
                <Pressable
                  style={{ position: 'absolute' as const, top: -1000, left: -1000, right: -1000, bottom: -1000, zIndex: 99 }}
                  onPress={() => setShowSortDropdown(false)}
                />
                <View style={[styles.sortDropdownMenu, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  {SORT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.sortDropdownItem, sortBy === opt.value && { backgroundColor: colors.primaryLight }]}
                      onPress={() => { setSortBy(opt.value as typeof sortBy); setShowSortDropdown(false); }}
                    >
                      <Text style={[styles.sortDropdownItemText, { color: sortBy === opt.value ? colors.primary : colors.text }]}>{opt.label}</Text>
                      {sortBy === opt.value && <Check size={12} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>

          <DropdownPicker
            label="" value={selectedTypeFilter || ''}
            options={[{ label: 'Tous types', value: '' }, ...PRODUCT_TYPE_OPTIONS]}
            onSelect={(v) => setSelectedTypeFilter(v || null)}
            placeholder="Type"
            compact
          />

          {allCategories.length > 1 && (
            <DropdownPicker
              label="" value={selectedCategoryFilter || ''}
              options={[{ label: 'Toutes', value: '' }, ...allCategories.map((c) => ({ label: c, value: c }))]}
              onSelect={(v) => setSelectedCategoryFilter(v || null)}
              placeholder="Catégorie"
              compact
            />
          )}

          <View style={gridStyles.viewToggle}>
            <TouchableOpacity
              style={[gridStyles.viewToggleBtn, viewMode === 'grid' && { backgroundColor: colors.primary }]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <LayoutGrid size={14} color={viewMode === 'grid' ? '#FFF' : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[gridStyles.viewToggleBtn, viewMode === 'list' && { backgroundColor: colors.primary }]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <List size={14} color={viewMode === 'list' ? '#FFF' : colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.archiveToggle, { backgroundColor: showArchived ? colors.primary : colors.card, borderColor: showArchived ? colors.primary : colors.cardBorder }]}
            onPress={() => setShowArchived((p) => !p)}
          >
            <Archive size={14} color={showArchived ? '#FFF' : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {displayProducts.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
              <Package size={32} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {search ? 'Aucun résultat' : 'Aucun produit pour l\u2019instant'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              {search ? 'Essayez un autre terme de recherche' : 'Ajoutez votre premier produit au catalogue'}
            </Text>
          </View>
        )}

        {viewMode === 'grid' ? (
          <View>
            {groupedProducts.map((group) => (
              <View key={group.category}>
                <View style={[styles.categoryHeader, { backgroundColor: colors.surfaceHover }]}>
                  <Tag size={13} color={colors.textSecondary} />
                  <Text style={[styles.categoryHeaderText, { color: colors.text }]}>{group.category}</Text>
                  <Text style={[styles.categoryHeaderCount, { color: colors.textTertiary }]}>{group.items.length}</Text>
                </View>
                <View style={gridStyles.gridContainer}>
                  {group.items.map((product) => {
                    const isInactive = !product.isActive || product.isArchived;
                    const typeConfig = getProductTypeConfig(product.type);
                    return (
                      <TouchableOpacity
                        key={product.id}
                        activeOpacity={0.7}
                        onPress={() => openProductDetail(product.id)}
                        onLongPress={() => {
                          Alert.alert(product.name, '', [
                            { text: 'Voir la fiche', onPress: () => openProductDetail(product.id) },
                            { text: 'Modifier', onPress: () => openEdit(product.id) },
                            ...(product.isArchived ? [{ text: 'Désarchiver', onPress: () => { unarchiveProduct(product.id); } }] : [{ text: 'Archiver', style: 'destructive' as const, onPress: () => setArchiveConfirm(product.id) }]),
                            { text: 'Supprimer', style: 'destructive' as const, onPress: () => setDeleteConfirm(product.id) },
                            { text: 'Annuler', style: 'cancel' as const },
                          ]);
                        }}
                        style={[
                          gridStyles.productTile,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.cardBorder,
                            opacity: isInactive ? 0.55 : 1,
                            width: isMobile ? '47%' as unknown as number : '23%' as unknown as number,
                          },
                        ]}
                      >
                        {product.photoUrl ? (
                          <Image
                            source={{ uri: product.photoUrl }}
                            style={gridStyles.tileImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[gridStyles.tilePlaceholder, { backgroundColor: colors.surfaceHover }]}>
                            <ImageIcon size={20} color={colors.textTertiary} />
                          </View>
                        )}
                        <View style={gridStyles.tileBody}>
                          <View style={[gridStyles.tileCatBadge, { backgroundColor: typeConfig.bgColor }]}>
                            <Text style={[gridStyles.tileCatBadgeText, { color: typeConfig.color }]} numberOfLines={1}>
                              {typeConfig.label}
                            </Text>
                          </View>
                          <Text style={[gridStyles.tileName, { color: colors.text }]} numberOfLines={2}>{product.name}</Text>
                          <Text style={[gridStyles.tilePrice, { color: colors.primary }]}>
                            {formatCurrency(product.salePrice * (1 + product.vatRate / 100), cur)} TTC
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View>
            {groupedProducts.map((group) => {
              const renderProductRow = (product: Product) => {
                const variantCount = getVariantsForProduct(product.id).length;
                const isInactive = !product.isActive || product.isArchived;
                const typeConfig = getProductTypeConfig(product.type);
                return isMobile ? (
                  <TouchableOpacity
                    key={product.id} activeOpacity={0.7}
                    onPress={() => openProductDetail(product.id)}
                    onLongPress={() => {
                      Alert.alert(product.name, '', [
                        { text: 'Voir la fiche', onPress: () => openProductDetail(product.id) },
                        { text: 'Modifier', onPress: () => openEdit(product.id) },
                        ...(product.isArchived ? [{ text: 'Désarchiver', onPress: () => { unarchiveProduct(product.id); } }] : [{ text: 'Archiver', style: 'destructive' as const, onPress: () => setArchiveConfirm(product.id) }]),
                        { text: 'Supprimer définitivement', style: 'destructive' as const, onPress: () => setDeleteConfirm(product.id) },
                        { text: 'Annuler', style: 'cancel' as const },
                      ]);
                    }}
                    style={[styles.mobileRow, { borderBottomColor: colors.borderLight, opacity: isInactive ? 0.6 : 1 }]}
                  >
                    {product.photoUrl ? (
                      <Image source={{ uri: product.photoUrl }} style={styles.listThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.listThumbPlaceholder, { backgroundColor: colors.surfaceHover }]}>
                        <ImageIcon size={14} color={colors.textTertiary} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.mobileCell, { color: colors.text, fontWeight: '600' as const }]} numberOfLines={1}>{product.name}</Text>
                      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
                        <View style={[styles.typeBadgeInline, { backgroundColor: typeConfig.bgColor }]}>
                          <Text style={[styles.typeBadgeInlineText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                        </View>
                        {product.categoryName ? <Text style={{ fontSize: 10, color: colors.textTertiary }}>{product.categoryName}</Text> : null}
                      </View>
                    </View>
                    <Text style={[styles.mobileCell, { color: colors.primary, fontWeight: '700' as const }]} numberOfLines={1}>{formatCurrency(product.salePrice * (1 + product.vatRate / 100), cur)} TTC</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={product.id} activeOpacity={0.7}
                    onPress={() => openProductDetail(product.id)}
                    style={[styles.tableRow, { borderBottomColor: colors.borderLight, opacity: isInactive ? 0.6 : 1 }]}
                  >
                    <View style={{ width: 36, height: 36, marginRight: 10 }}>
                      {product.photoUrl ? (
                        <Image source={{ uri: product.photoUrl }} style={styles.listThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.listThumbPlaceholder, { backgroundColor: colors.surfaceHover }]}>
                          <ImageIcon size={14} color={colors.textTertiary} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 2.5, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
                      <Text style={[styles.productName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{product.name}</Text>
                      {variantCount > 0 && (
                        <View style={[styles.variantBadge, { backgroundColor: `${colors.primary}18` }]}>
                          <Layers size={10} color={colors.primary} />
                          <Text style={[styles.variantBadgeText, { color: colors.primary }]}>{variantCount}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' as const }}>
                      <View style={[styles.typeBadgeInline, { backgroundColor: typeConfig.bgColor }]}>
                        <Text style={[styles.typeBadgeInlineText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                      </View>
                    </View>
                    <Text style={[styles.cellText, { flex: 1, color: colors.textSecondary }]} numberOfLines={1}>{product.categoryName || '—'}</Text>
                    <Text style={[styles.cellBold, { flex: 1, color: colors.primary, textAlign: 'right' as const }]} numberOfLines={1}>{formatCurrency(product.salePrice * (1 + product.vatRate / 100), cur)} TTC</Text>
                  </TouchableOpacity>
                );
              };
              return (
                <View key={group.category}>
                  <View style={[styles.categoryHeader, { backgroundColor: colors.surfaceHover }]}>
                    <Tag size={13} color={colors.textSecondary} />
                    <Text style={[styles.categoryHeaderText, { color: colors.text }]}>{group.category}</Text>
                    <Text style={[styles.categoryHeaderCount, { color: colors.textTertiary }]}>{group.items.length}</Text>
                  </View>
                  <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 16 }]}>
                    {!isMobile && (
                      <View style={[styles.columnHeaderBar, { backgroundColor: '#F9FAFB', borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                        <Text style={[styles.colHeaderText, { width: 46 }]}>{' '}</Text>
                        <Text style={[styles.colHeaderText, { flex: 2.5 }]}>NOM</Text>
                        <Text style={[styles.colHeaderText, { flex: 1, textAlign: 'center' as const }]}>TYPE</Text>
                        <Text style={[styles.colHeaderText, { flex: 1 }]}>CATÉGORIE</Text>
                        <Text style={[styles.colHeaderText, { flex: 1, textAlign: 'right' as const }]}>PRIX VENTE</Text>
                      </View>
                    )}
                    {group.items.map(renderProductRow)}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      )}

      {renderFormModal()}
      {selectedProductId && renderProductDetail()}
      {renderVariantFormModal()}

      <ConfirmModal
        visible={archiveConfirm !== null}
        onClose={() => setArchiveConfirm(null)}
        onConfirm={handleArchive}
        title="Archiver ce produit ?"
        message="Le produit sera désactivé. S'il est utilisé dans des factures validées, il ne sera pas supprimé mais marqué comme inactif."
        confirmLabel="Archiver"
        destructive
      />

      <ConfirmModal
        visible={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Supprimer définitivement ?"
        message="Le produit et toutes ses variantes seront supprimés de la base de données. Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
      />

      <ProductImportModal
        visible={csvImportVisible}
        onClose={() => setCsvImportVisible(false)}
        existingCategories={productCategories}
        existingProducts={products.map((p): ExistingProductRef => ({ id: p.id, name: p.name, type: p.type, categoryName: p.categoryName }))}
        onImportProducts={(previewProds: PreviewProduct[]) => {
          const errors: string[] = [];
          let productsCreated = 0;
          let productsUpdated = 0;
          let variantsCreated = 0;
          let categoriesCreated = 0;

          for (const pp of previewProds) {
            if (pp.category && !productCategories.includes(pp.category)) {
              void addProductCategory(pp.category);
              categoriesCreated++;
            }

            if (pp.brand && !productBrands.includes(pp.brand)) {
              void addProductBrand(pp.brand);
            }

            const isUpdate = pp.duplicate?.source === 'database' && pp.duplicateAction === 'update' && pp.duplicate.existingProductId;

            if (isUpdate) {
              const existingId = pp.duplicate!.existingProductId;
              const updateData: Partial<Product> = {
                description: pp.description || undefined,
                brand: pp.brand || undefined,
                purchasePrice: pp.purchasePrice,
                salePrice: pp.salePrice > 0 ? pp.salePrice : undefined,
                unit: pp.unit || undefined,
              };
              const result = updateProduct(existingId, updateData, { silent: true });
              if (!result.success) {
                errors.push(`${pp.name}: ${result.error || 'Erreur mise à jour'}`);
                continue;
              }
              productsUpdated++;

              if (pp.variants.length > 0) {
                const existingVariants = getVariantsForProduct(existingId);
                for (const newV of pp.variants) {
                  const attrKey = Object.entries(newV.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|');
                  const matchingExisting = existingVariants.find(ev => {
                    const evKey = Object.entries(ev.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|');
                    return evKey === attrKey;
                  });
                  if (matchingExisting) {
                    updateVariantFn(matchingExisting.id, {
                      purchasePrice: newV.purchasePrice,
                      salePrice: newV.salePrice,
                      stockQuantity: newV.stockQuantity,
                      minStock: newV.minStock,
                    }, { silent: true });
                  } else {
                    createVariant({
                      productId: existingId,
                      attributes: newV.attributes,
                      sku: generateUniqueSKU(),
                      purchasePrice: newV.purchasePrice,
                      salePrice: newV.salePrice,
                      stockQuantity: newV.stockQuantity,
                      minStock: newV.minStock,
                      isActive: true,
                    });
                    variantsCreated++;
                  }
                }
              }
              continue;
            }

            const prodSku = generateUniqueSKU();
            const prodData = {
              name: pp.name,
              description: pp.description,
              sku: prodSku,
              categoryName: pp.category || undefined,
              brand: pp.brand || undefined,
              purchasePrice: pp.purchasePrice,
              salePrice: pp.salePrice > 0 ? pp.salePrice : 0.01,
              vatRate: 20 as VATRate,
              stockQuantity: pp.stockQuantity,
              lowStockThreshold: pp.minStock,
              unit: pp.unit || 'pièce',
              type: pp.type,
              isActive: true,
            };

            const result = createProduct(prodData);
            if (!result.success) {
              errors.push(`${pp.name}: ${result.error || 'Erreur'}`);
              continue;
            }
            productsCreated++;

            const productId = result.productId;
            if (productId) {
              if (pp.variants.length > 0) {
                const batchData = pp.variants.map(v => ({
                  attributes: v.attributes,
                  sku: generateUniqueSKU(),
                  purchasePrice: v.purchasePrice,
                  salePrice: v.salePrice,
                  stockQuantity: v.stockQuantity,
                  minStock: v.minStock,
                }));
                createVariantsBatch(productId, batchData);
                variantsCreated += batchData.length;
              } else {
                createVariant({
                  productId,
                  attributes: {},
                  sku: prodSku,
                  purchasePrice: prodData.purchasePrice,
                  salePrice: prodData.salePrice,
                  stockQuantity: prodData.stockQuantity,
                  minStock: prodData.lowStockThreshold,
                  isActive: true,
                });
              }
            }
          }

          if (productsCreated > 0 || productsUpdated > 0) {
            const parts: string[] = [];
            if (productsCreated > 0) parts.push(`${productsCreated} créé(s)`);
            if (productsUpdated > 0) parts.push(`${productsUpdated} mis à jour`);
            showToast(`Produits : ${parts.join(', ')}`);
          }

          return { productsCreated, productsUpdated, variantsCreated, categoriesCreated, errors };
        }}
      />
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 0,
  },
  stepRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  stepCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  stepNumber: { fontSize: 11, fontWeight: '700' as const },
  stepLabel: { fontSize: 11, fontWeight: '600' as const },
  stepLine: { width: 24, height: 2, borderRadius: 1, marginHorizontal: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const },
  sectionHint: { fontSize: 13, lineHeight: 18 },
  attrCard: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' as const },
  attrHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 10, padding: 14,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  attrName: { fontSize: 14, fontWeight: '600' as const, flex: 1 },
  attrCount: { fontSize: 12 },
  attrValues: {
    flexDirection: 'row' as const, flexWrap: 'wrap' as const,
    gap: 6, paddingHorizontal: 14, paddingBottom: 14,
  },
  valueChip: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 4, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
  },
  valueChipText: { fontSize: 12, fontWeight: '500' as const },
  emptyAttrs: { padding: 20, borderRadius: 10, alignItems: 'center' as const },
  emptyText: { fontSize: 13, textAlign: 'center' as const },
  bulkRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 8, padding: 10, borderRadius: 10, borderWidth: 1,
  },
  bulkLabel: { fontSize: 11, fontWeight: '600' as const },
  bulkInput: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12,
  },
  bulkBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  draftCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  draftHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  draftHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10 },
  draftHeaderText: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const },
  draftAttrLabel: { flex: 1, fontSize: 13, fontWeight: '600' as const },
  draftFields: { flexDirection: 'row' as const, gap: 6, flexWrap: 'wrap' as const },
  draftInput: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, minWidth: 70,
  },
  formFooter: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, padding: 16, borderTopWidth: 1, gap: 10,
  },
  cancelBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 4,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600' as const },
  nextBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, gap: 6,
  },
  nextBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 12 },

  filterBar: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const, flexWrap: 'wrap' as const },
  searchBar: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, outlineStyle: 'none' as never },
  archiveToggle: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 8, borderWidth: 1 },
  sortDropdownBtn: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 8, borderWidth: 1 },
  sortDropdownMenu: { position: 'absolute' as const, top: 40, right: 0, borderWidth: 1, borderRadius: 10, minWidth: 130, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 },
  sortDropdownItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 14, paddingVertical: 10 },
  sortDropdownItemText: { fontSize: 13, fontWeight: '500' as const },
  listThumb: { width: 36, height: 36, borderRadius: 6 },
  listThumbPlaceholder: { width: 36, height: 36, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  tableCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  tableRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  cellText: { fontSize: 13 },
  cellBold: { fontSize: 13, fontWeight: '600' as const },
  productName: { fontSize: 14, fontWeight: '600' as const },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  stockText: { fontSize: 12, fontWeight: '600' as const },
  mobileRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  mobileCell: { fontSize: 12 },
  iconBtn: { padding: 6, borderRadius: 6 },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  emptyState: { alignItems: 'center' as const, paddingVertical: 48, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, textAlign: 'center' as const },
  emptySubtitle: { fontSize: 13, textAlign: 'center' as const, lineHeight: 18 },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' as const },
  formRow: { flexDirection: 'row' as const, gap: 12 },
  formCol: { flex: 1 },
  marginInfo: { padding: 10, borderRadius: 8 },
  marginInfoText: { fontSize: 13, fontWeight: '600' as const, textAlign: 'center' as const },
  sortRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingBottom: 4 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontWeight: '500' as const },
  columnHeaderBar: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 20, paddingVertical: 10 },
  columnHeaderBarMobile: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 8 },
  colHeaderText: { fontSize: 10, fontWeight: '700' as const, color: '#6B7280', letterSpacing: 0.5 },
  variantBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  variantBadgeText: { fontSize: 10, fontWeight: '700' as const },
  categoryHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginBottom: 4 },
  categoryHeaderText: { fontSize: 14, fontWeight: '700' as const },
  categoryHeaderCount: { fontSize: 12, fontWeight: '500' as const },
  photoUrlInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  photoPreviewContainer: { alignItems: 'flex-start' as const, marginTop: 4 },
  photoPreview: { width: 80, height: 80, borderRadius: 10 },
  typeBadgeInline: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeInlineText: { fontSize: 9, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  dupWarning: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  dupWarningText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  dupWarningLink: {
    marginTop: 6,
  },
  dupWarningLinkText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1D4ED8',
    textDecorationLine: 'underline' as const,
  },
});

const detailStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const },
  modal: { borderRadius: 16, maxHeight: '90%' as unknown as number, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12, overflow: 'hidden' as const },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  editBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 16 },
  productImage: { width: '100%' as unknown as number, height: 180, borderRadius: 12 },
  description: { fontSize: 14, lineHeight: 20 },
  priceCard: { borderWidth: 1, borderRadius: 12, padding: 16 },
  priceRow: { flexDirection: 'row' as const, gap: 12 },
  priceLabel: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.3, marginBottom: 4 },
  priceValue: { fontSize: 16, fontWeight: '700' as const },
  infoSection: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  infoRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '600' as const },
  stockBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  stockText: { fontSize: 13, fontWeight: '700' as const },
  variantsSection: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' as const },
  variantsHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 16 },
  variantsTitle: { fontSize: 15, fontWeight: '700' as const },
  variantCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  variantCountText: { fontSize: 11, fontWeight: '700' as const },
  addVariantBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addVariantText: { fontSize: 12, fontWeight: '600' as const },
  addVariantBtnHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addVariantTextHeader: { fontSize: 11, fontWeight: '600' as const },
  emptyVariants: { alignItems: 'center' as const, paddingVertical: 24, paddingHorizontal: 16, gap: 6 },
  emptyVariantsText: { fontSize: 14, fontWeight: '500' as const },
  emptyVariantsHint: { fontSize: 12, textAlign: 'center' as const },
  variantTableHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 8 },
  variantHeaderCell: { fontSize: 10, fontWeight: '700' as const, color: '#6B7280', letterSpacing: 0.4 },
  variantRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  variantAttrText: { fontSize: 13, fontWeight: '600' as const },
});

const variantStyles = StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '600' as const, marginBottom: -8 },
  attrRow: { flexDirection: 'row' as const, gap: 8, alignItems: 'flex-start' as const },
  addAttrBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed' as const,
  },
  addAttrText: { fontSize: 12, fontWeight: '600' as const },
});

const subTabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row' as const, borderBottomWidth: 1,
    paddingHorizontal: 20, gap: 0, minHeight: 40,
    alignItems: 'center' as const, justifyContent: 'space-between' as const,
  },
  tabsRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
  },
  actionsRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
  },
  tab: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 6, paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '600' as const },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },
});

const step2Styles = StyleSheet.create({
  inlineAddRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  inlineInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, width: 100 },
  inlineAddBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  addValueBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed' as const,
  },
  addValueBtnText: { fontSize: 11, fontWeight: '600' as const },
  addAttrBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed' as const,
  },
  addAttrBtnText: { fontSize: 13, fontWeight: '600' as const },
  newAttrCard: { borderWidth: 1.5, borderRadius: 10, padding: 16, gap: 12 },
  newAttrTitle: { fontSize: 14, fontWeight: '700' as const },
  newAttrInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  newAttrActions: { flexDirection: 'row' as const, gap: 8, justifyContent: 'flex-end' as const },
  newAttrCancel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  newAttrCancelText: { fontSize: 13, fontWeight: '600' as const },
  newAttrSubmit: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  newAttrSubmitText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
});

const step3Styles = StyleSheet.create({
  simpleCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
});

const gridStyles = StyleSheet.create({
  viewToggle: {
    flexDirection: 'row' as const,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  viewToggleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 8,
  },
  gridContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
    marginBottom: 20,
  },
  productTile: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tileImage: {
    width: '100%' as unknown as number,
    height: 80,
  },
  tilePlaceholder: {
    width: '100%' as unknown as number,
    height: 60,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tileBody: {
    padding: 8,
    gap: 3,
  },
  tileCatBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start' as const,
  },
  tileCatBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  tileName: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  tilePrice: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginTop: 2,
  },
});

const attrMgmtStyles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  empty: { alignItems: 'center' as const, paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '500' as const },
  attrCard: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  attrHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  attrName: { fontSize: 15, fontWeight: '600' as const, flex: 1 },
  attrCount: { fontSize: 12 },
  editBtn: { padding: 6, borderRadius: 6 },
  deleteBtn: { padding: 6, borderRadius: 6 },
  renameRow: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  renameInput: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, fontWeight: '600' as const },
  renameConfirmBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center' as const, justifyContent: 'center' as const },
  valuesRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, alignItems: 'center' as const },
  valueChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  valueText: { fontSize: 12, fontWeight: '500' as const },
  addValueBtnSmall: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
  inlineAddRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  inlineInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, width: 100 },
  inlineAddBtnSmall: { width: 24, height: 24, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  addGroupBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed' as const,
  },
  addGroupBtnText: { fontSize: 14, fontWeight: '600' as const },
  newGroupCard: { borderWidth: 1.5, borderRadius: 12, padding: 16, gap: 12 },
  newGroupTitle: { fontSize: 15, fontWeight: '700' as const },
  newGroupActions: { flexDirection: 'row' as const, gap: 8, justifyContent: 'flex-end' as const, marginTop: 4 },
  newGroupCancelBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  newGroupCancelText: { fontSize: 13, fontWeight: '600' as const },
  newGroupSubmitBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  newGroupSubmitText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
});