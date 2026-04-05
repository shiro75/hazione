/**
 * ProductsScreen.tsx  (refactorisé)
 *
 * Écran principal de gestion du catalogue produits.
 * Ce fichier n'est plus qu'un orchestrateur : il assemble les hooks et
 * les composants extraits, sans aucune logique métier en ligne.
 *
 * CONVENTION DE PRIX :
 *   La BDD stocke toujours les prix en HT.
 *   Les conversions HT ↔ TTC sont centralisées dans utils/price.ts.
 *
 * STRUCTURE :
 *   hooks/useProductForm.ts        — state + handlers formulaire multi-étapes
 *   hooks/useVariantDrafts.ts      — brouillons de variantes + bulk pricing
 *   utils/price.ts                 — htToTtc / ttcToHt / calcMargin
 *   components/products/
 *     ProductFormModal.tsx         — modale multi-étapes création/édition
 *     ProductDetailModal.tsx       — fiche produit en lecture
 *     VariantFormModal.tsx         — ajout/édition variante individuelle
 *     AttributesTab.tsx            — gestion des groupes d'attributs
 *     steps/Step1General.tsx
 *     steps/Step2Attributes.tsx
 *     steps/Step3Variants.tsx
 *     steps/Step4Recipe.tsx
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, useWindowDimensions, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Search, Plus, Package, Archive, X, ArrowUpDown, Check,
  Tag, Layers, Tags, Upload, LayoutGrid, List, Image as ImageIcon, Download,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { formatCurrency } from '@/utils/format';
import { htToTtc, ttcToHt } from '@/utils/price';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import PageHeader from '@/components/PageHeader';
import DropdownPicker from '@/components/DropdownPicker';
import ProductImportModal from '@/components/ProductImportModal';
import RecipeEditor from '@/components/RecipeEditor';
import type { PreviewProduct, ExistingProductRef } from '@/components/ProductImportModal';
import { getProductTypeOptions, getProductTypeConfig } from '@/constants/productTypes';
import { generateUniqueSKU } from '@/types/product.types';
import { useProductForm } from '@/hooks/useProductForm';
import { useVariantDrafts } from '@/hooks/useVariantDrafts';
import ProductFormModal from '@/components/products/ProductFormModal';
import ProductDetailModal from '@/components/products/ProductDetailModal';
import VariantFormModal, { type VariantFormState } from '@/components/products/VariantFormModal';
import AttributesTab from '@/components/products/AttributesTab';
import { styles, subTabStyles, gridStyles } from '@/components/products/productsStyles';
import type { VATRate, ProductVariant, Product } from '@/types';

export default function ProductsScreen({ embedded = false }: { embedded?: boolean }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { t } = useI18n();
  const { confirm } = useConfirm();

  const {
    activeProducts, products, createProduct, updateProduct, archiveProduct, unarchiveProduct, deleteProduct,
    getProductTotalStock, getVariantsForProduct,
    productCategories, productUnits, customVatRates,
    addProductCategory, removeProductCategory, renameProductCategory,
    addProductUnit, productBrands, addProductBrand, removeProductBrand, renameProductBrand,
    createVariant, createVariantsBatch, updateVariant: updateVariantFn, deleteVariant,
    productAttributes, generateVariantSKU,
    addProductAttribute, updateProductAttribute, deleteProductAttribute,
    addAttributeValue, removeAttributeValue, updateAttributeValuesOrder,
    company, showToast,
    getRecipeForProduct, getRecipesForProduct, saveRecipe,
    variants,
  } = useData();

  const cur = company.currency || 'EUR';
  const TYPE_OPTIONS = useMemo(() => getProductTypeOptions(t), [t]);

  // ── Sous-onglets ──────────────────────────────────────────────────────────
  type SubTab = 'catalogue' | 'attributes';
  const [subTab, setSubTab] = useState<SubTab>('catalogue');

  // ── Catalogue : filtres / tri / affichage ─────────────────────────────────
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'price' | 'stock'>('name');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<'grid' | 'list'>('list');
  const [csvImportVisible, setCsvImportVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@products_view_mode').then((stored) => {
      if (stored === 'grid' || stored === 'list') setViewModeState(stored);
    }).catch(() => {});
  }, []);

  const setViewMode = useCallback((mode: 'grid' | 'list') => {
    setViewModeState(mode);
    AsyncStorage.setItem('@products_view_mode', mode).catch(() => {});
  }, []);

  // ── Fiche produit ─────────────────────────────────────────────────────────
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [selectedProductId, products],
  );
  const selectedProductVariants = useMemo(
    () => (selectedProductId ? getVariantsForProduct(selectedProductId) : []),
    [selectedProductId, getVariantsForProduct],
  );

  // ── Variante individuelle ─────────────────────────────────────────────────
  const [variantFormVisible, setVariantFormVisible] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantForm, setVariantForm] = useState<VariantFormState>({
    attributes: [{ key: '', value: '' }], sku: '',
    purchasePrice: '', salePrice: '', stock: '0', minStock: '0',
  });

  // ── Recipe editor ─────────────────────────────────────────────────────────
  const [recipeEditorVisible, setRecipeEditorVisible] = useState(false);
  const [recipeEditorProductId, setRecipeEditorProductId] = useState('');
  const [recipeEditorVariantId, setRecipeEditorVariantId] = useState<string | undefined>(undefined);
  const [recipeEditorProductName, setRecipeEditorProductName] = useState('');
  const [recipeEditorVariantLabel, setRecipeEditorVariantLabel] = useState<string | undefined>(undefined);

  const openRecipeEditor = useCallback((productId: string, productName: string, variantId?: string, variantLabel?: string) => {
    setRecipeEditorProductId(productId);
    setRecipeEditorVariantId(variantId);
    setRecipeEditorProductName(productName);
    setRecipeEditorVariantLabel(variantLabel);
    setRecipeEditorVisible(true);
  }, []);

  // ── Hooks métier ──────────────────────────────────────────────────────────
  const variantDraftsHook = useVariantDrafts({ generateVariantSKU });

  const productForm = useProductForm({
    products, getVariantsForProduct, productAttributes,
    createProduct, updateProduct, createVariant, createVariantsBatch,
    updateVariant: updateVariantFn, deleteVariant, showToast, generateVariantSKU,
    generateCombinations: variantDraftsHook.generateCombinations,
    variantDrafts: variantDraftsHook.variantDrafts,
    setVariantDrafts: variantDraftsHook.setVariantDrafts,
    resetDrafts: variantDraftsHook.resetDrafts,
    setBulkPurchasePrice: variantDraftsHook.setBulkPurchasePrice,
    setBulkSalePrice: variantDraftsHook.setBulkSalePrice,
  });

  // ── Listes dérivées ───────────────────────────────────────────────────────
  const categoryOptions = useMemo(() => productCategories.map((c) => ({ label: c, value: c })), [productCategories]);
  const brandOptions = useMemo(() => productBrands.map((b) => ({ label: b, value: b })), [productBrands]);
  const unitOptions = useMemo(() => productUnits.map((u) => ({ label: u, value: u })), [productUnits]);
  const vatOptions = useMemo(() => customVatRates.map((v) => ({ label: `${v.replace('.', ',')}%`, value: v })), [customVatRates]);

  const displayProducts = useMemo(() => {
    const base = showArchived ? products : activeProducts;
    let list = base;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
      );
    }
    if (selectedCategoryFilter) list = list.filter((p) => (p.categoryName || 'Sans catégorie') === selectedCategoryFilter);
    if (selectedTypeFilter) list = list.filter((p) => p.type === selectedTypeFilter);
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'category') return (a.categoryName || '').localeCompare(b.categoryName || '');
      if (sortBy === 'price') return b.salePrice - a.salePrice;
      if (sortBy === 'stock') return getProductTotalStock(b.id) - getProductTotalStock(a.id);
      return 0;
    });
  }, [search, activeProducts, products, showArchived, sortBy, getProductTotalStock, selectedCategoryFilter, selectedTypeFilter]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    (showArchived ? products : activeProducts).forEach((p) => cats.add(p.categoryName || 'Sans catégorie'));
    return Array.from(cats).sort();
  }, [activeProducts, products, showArchived]);

  const groupedProducts = useMemo(() => {
    const map = new Map<string, typeof displayProducts>();
    displayProducts.forEach((p) => {
      const cat = p.categoryName || 'Sans catégorie';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return Array.from(map.entries())
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [displayProducts]);

  /** Trie les variantes selon l'ordre défini dans l'onglet Attributs */
  const getOrderedVariants = useCallback((variantList: ProductVariant[]) => {
    const orderMap: Record<string, Record<string, number>> = {};
    productAttributes.forEach((attr) => {
      orderMap[attr.name] = {};
      attr.values.forEach((value, index) => { orderMap[attr.name][value] = index; });
    });
    return [...variantList].sort((a, b) => {
      const key = (v: ProductVariant) =>
        Object.entries(v.attributes).sort(([k1], [k2]) => k1.localeCompare(k2))
          .map(([name, value]) => String(orderMap[name]?.[value] ?? 999).padStart(3, '0'))
          .join('-');
      return key(a).localeCompare(key(b));
    });
  }, [productAttributes]);

  // ── Gestion de la variante individuelle ──────────────────────────────────
  const openVariantCreate = useCallback(() => {
    if (!selectedProduct) return;
    setEditingVariantId(null);
    setVariantForm({
      attributes: [{ key: '', value: '' }], sku: '',
      purchasePrice: String(selectedProduct.purchasePrice || ''),
      salePrice: String(htToTtc(selectedProduct.salePrice, selectedProduct.vatRate) || ''),
      stock: '0', minStock: String(selectedProduct.lowStockThreshold || '0'),
    });
    setVariantFormVisible(true);
  }, [selectedProduct]);

  const openVariantEdit = useCallback((v: ProductVariant) => {
    setEditingVariantId(v.id);
    const attrs = Object.entries(v.attributes).map(([key, value]) => ({ key, value }));
    const vatRate = selectedProduct?.vatRate ?? 20;
    setVariantForm({
      attributes: attrs.length > 0 ? attrs : [{ key: '', value: '' }],
      sku: v.sku,
      purchasePrice: String(v.purchasePrice || ''),
      salePrice: String(htToTtc(v.salePrice, vatRate)),
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
    const vatRate = selectedProduct?.vatRate ?? 20;
    const salePrice = ttcToHt(parseFloat(variantForm.salePrice) || 0, vatRate);
    const purchasePrice = parseFloat(variantForm.purchasePrice) || 0;
    if (editingVariantId) {
      updateVariantFn(editingVariantId, {
        attributes: attrs, sku: variantForm.sku.trim(), salePrice, purchasePrice,
        stockQuantity: parseInt(variantForm.stock, 10) || 0,
        minStock: parseInt(variantForm.minStock, 10) || 0,
      });
    } else {
      createVariant({
        productId: selectedProductId, attributes: attrs, sku: variantForm.sku.trim(),
        salePrice, purchasePrice,
        stockQuantity: parseInt(variantForm.stock, 10) || 0,
        minStock: parseInt(variantForm.minStock, 10) || 0, isActive: true,
      });
    }
    setVariantFormVisible(false);
    setEditingVariantId(null);
  }, [selectedProductId, selectedProduct, variantForm, editingVariantId, createVariant, updateVariantFn]);

  const handleDeleteVariant = useCallback((variantId: string) => {
    confirm('Supprimer', 'Supprimer cette variante ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteVariant(variantId) },
    ]);
  }, [deleteVariant, confirm]);

  // ── Duplication ───────────────────────────────────────────────────────────
  const handleDuplicateProduct = useCallback(() => {
    const { editingId } = productForm;
    if (!editingId) return;
    const p = products.find((pr) => pr.id === editingId);
    if (!p) return;
    const result = createProduct({
      ...p, name: `${p.name} - Copy`, sku: generateUniqueSKU(), stockQuantity: 0, isActive: true,
    });
    if (result.success && result.productId) {
      const newId = result.productId;
      const srcVariants = getVariantsForProduct(editingId);
      if (srcVariants.length > 0) {
        createVariantsBatch(newId, srcVariants.map((v, idx) => ({
          attributes: { ...v.attributes },
          sku: generateVariantSKU(p.brand || '', `${p.name} - Copy`, idx + 1),
          purchasePrice: v.purchasePrice, salePrice: v.salePrice,
          stockQuantity: 0, minStock: v.minStock ?? 0,
        })));
        const newVariants = getVariantsForProduct(newId);
        srcVariants.forEach((sv) => {
          const recipe = getRecipeForProduct(editingId, sv.id);
          if (recipe && recipe.items.length > 0) {
            const match = newVariants.find((nv) => JSON.stringify(nv.attributes) === JSON.stringify(sv.attributes));
            if (match) saveRecipe(newId, recipe.items.map((i: any) => ({ ...i })), match.id);
          }
        });
      }
      const productRecipe = getRecipeForProduct(editingId);
      if (productRecipe && productRecipe.items.length > 0) {
        saveRecipe(newId, productRecipe.items.map((i: any) => ({ ...i })));
      }
      productForm.setFormVisible(false);
      showToast('Produit dupliqué avec variantes et recettes');
    }
  }, [productForm, products, createProduct, getVariantsForProduct, createVariantsBatch, generateVariantSKU, getRecipeForProduct, saveRecipe, showToast]);

  const SORT_OPTIONS = [
    { value: 'name' as const, label: 'Nom' },
    { value: 'category' as const, label: 'Catégorie' },
    { value: 'price' as const, label: 'Prix' },
    { value: 'stock' as const, label: 'Stock' },
  ];

  const isTransformedType = productForm.form.type === 'produit_transforme' || productForm.form.type === 'produit_fini';
  const existingAttributeKeys = Array.from(new Set(productAttributes.map((a) => a.name))).sort();

  // ── Rendu de la liste produits ────────────────────────────────────────────
  const renderProductRow = useCallback((product: Product) => {
    const variantCount = getVariantsForProduct(product.id).length;
    const isInactive = !product.isActive || product.isArchived;
    const typeConfig = getProductTypeConfig(product.type);
    const saleTTC = htToTtc(product.salePrice, product.vatRate);

    return isMobile ? (
      <TouchableOpacity
        key={product.id} activeOpacity={0.7}
        onPress={() => setSelectedProductId(product.id)}
        onLongPress={() => {
          confirm(product.name, 'Que souhaitez-vous faire ?', [
            { text: 'Voir la fiche', onPress: () => setSelectedProductId(product.id) },
            { text: 'Modifier', onPress: () => productForm.openEdit(product.id) },
            ...(product.isArchived
              ? [{ text: 'Désarchiver', onPress: () => unarchiveProduct(product.id) }]
              : [{ text: 'Archiver', style: 'destructive' as const, onPress: () => archiveProduct(product.id) }]),
            { text: 'Supprimer définitivement', style: 'destructive' as const, onPress: () => deleteProduct(product.id) },
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
          <Text style={[styles.mobileCell, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{product.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.typeBadgeInline, { backgroundColor: typeConfig.bgColor }]}>
              <Text style={[styles.typeBadgeInlineText, { color: typeConfig.color }]}>{t(typeConfig.labelKey)}</Text>
            </View>
            {product.categoryName ? <Text style={{ fontSize: 10, color: colors.textTertiary }}>{product.categoryName}</Text> : null}
          </View>
        </View>
        <Text style={[styles.mobileCell, { color: colors.primary, fontWeight: '700' }]} numberOfLines={1}>
          {formatCurrency(saleTTC, cur)} TTC
        </Text>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity
        key={product.id} activeOpacity={0.7}
        onPress={() => setSelectedProductId(product.id)}
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
        <View style={{ flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.productName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{product.name}</Text>
          {variantCount > 0 && (
            <View style={[styles.variantBadge, { backgroundColor: `${colors.primary}18` }]}>
              <Layers size={10} color={colors.primary} />
              <Text style={[styles.variantBadgeText, { color: colors.primary }]}>{variantCount}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={[styles.typeBadgeInline, { backgroundColor: typeConfig.bgColor }]}>
            <Text style={[styles.typeBadgeInlineText, { color: typeConfig.color }]}>{t(typeConfig.labelKey)}</Text>
          </View>
        </View>
        <Text style={[styles.cellText, { flex: 1, color: colors.textSecondary }]} numberOfLines={1}>{product.categoryName || '—'}</Text>
        <Text style={[styles.cellBold, { flex: 1, color: colors.primary, textAlign: 'right' }]} numberOfLines={1}>
          {formatCurrency(saleTTC, cur)} TTC
        </Text>
      </TouchableOpacity>
    );
  }, [isMobile, colors, cur, t, getVariantsForProduct, confirm, unarchiveProduct, archiveProduct, deleteProduct, productForm]);

  // ── Rendu principal ───────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!embedded && (
        <PageHeader
          title={t('stock.productsServices')}
          action={subTab === 'catalogue' ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setCsvImportVisible(true)}>
                <Upload size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => {
                  const cols: ExportColumn<Record<string, unknown>>[] = [
                    { key: 'name', label: 'Nom' }, { key: 'description', label: 'Description' },
                    { key: 'sku', label: 'SKU' }, { key: 'type', label: 'Type' },
                    { key: 'categoryName', label: 'Catégorie' }, { key: 'brand', label: 'Marque' },
                    { key: 'salePrice', label: 'Prix vente' }, { key: 'purchasePrice', label: 'Prix achat' },
                    { key: 'stockQuantity', label: 'Stock' }, { key: 'unit', label: 'Unité' },
                  ];
                  void exportToCSV(displayProducts.map((p) => ({ ...p } as any)), cols, `catalogue_${new Date().toISOString().slice(0, 10)}.csv`);
                }}
              >
                <Download size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.primary }]} onPress={productForm.openCreate} testID="create-product-btn">
                <Plus size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : null}
        />
      )}

      {/* Sous-onglets */}
      <View style={[subTabStyles.bar, { borderBottomColor: colors.border }]}>
        <View style={subTabStyles.tabsRow}>
          {(['catalogue', 'attributes'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[subTabStyles.tab, subTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setSubTab(tab)}
              activeOpacity={0.7}
            >
              {tab === 'catalogue'
                ? <Package size={15} color={subTab === tab ? colors.primary : colors.textTertiary} />
                : <Tags size={15} color={subTab === tab ? colors.primary : colors.textTertiary} />}
              <Text style={[subTabStyles.tabText, { color: subTab === tab ? colors.primary : colors.textSecondary }]}>
                {tab === 'catalogue' ? `${t('stock.products')} (${activeProducts.length})` : t('stock.attributes')}
              </Text>
              {tab === 'attributes' && productAttributes.length > 0 && (
                <View style={[subTabStyles.badge, { backgroundColor: `${colors.primary}15` }]}>
                  <Text style={[subTabStyles.badgeText, { color: colors.primary }]}>{productAttributes.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        {subTab === 'catalogue' && (
          <View style={subTabStyles.actionsRow}>
            <TouchableOpacity style={styles.smBtn} onPress={() => setCsvImportVisible(true)}>
              <Upload size={15} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smBtn}
              onPress={() => {
                const cols: ExportColumn<Record<string, unknown>>[] = [
                  { key: 'name', label: 'Nom' }, { key: 'sku', label: 'SKU' },
                  { key: 'type', label: 'Type' }, { key: 'categoryName', label: 'Catégorie' },
                  { key: 'salePrice', label: 'Prix vente' }, { key: 'unit', label: 'Unité' },
                ];
                void exportToCSV(displayProducts.map((p) => ({ ...p } as any)), cols, `catalogue_${new Date().toISOString().slice(0, 10)}.csv`);
              }}
            >
              <Download size={15} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smBtn, { backgroundColor: colors.primary }]} onPress={productForm.openCreate} testID="create-product-btn">
              <Plus size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Contenu */}
      {subTab === 'attributes' ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <AttributesTab
            productAttributes={productAttributes}
            addProductAttribute={addProductAttribute}
            updateProductAttribute={updateProductAttribute}
            deleteProductAttribute={deleteProductAttribute}
            addAttributeValue={addAttributeValue}
            removeAttributeValue={removeAttributeValue}
            updateAttributeValuesOrder={updateAttributeValuesOrder}
          />
        </ScrollView>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {/* Barre de filtres */}
          <View style={styles.filterBar}>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1, minWidth: 140 }]}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('stock.search')} placeholderTextColor={colors.textTertiary}
                value={search} onChangeText={setSearch} testID="product-search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <X size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ position: 'relative', zIndex: 200 }}>
              <TouchableOpacity
                style={[styles.sortDropdownBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => setShowSortDropdown(!showSortDropdown)}
                activeOpacity={0.7}
              >
                <ArrowUpDown size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              {showSortDropdown && (
                <>
                  <TouchableOpacity
                    style={{ position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000, zIndex: 99 }}
                    onPress={() => setShowSortDropdown(false)}
                  />
                  <View style={[styles.sortDropdownMenu, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    {SORT_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.sortDropdownItem, sortBy === opt.value && { backgroundColor: colors.primaryLight }]}
                        onPress={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                      >
                        <Text style={[styles.sortDropdownItemText, { color: sortBy === opt.value ? colors.primary : colors.text }]}>
                          {opt.label}
                        </Text>
                        {sortBy === opt.value && <Check size={12} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>

            <DropdownPicker
              label="" value={selectedTypeFilter || ''}
              options={[{ label: t('stock.allTypes'), value: '' }, ...TYPE_OPTIONS]}
              onSelect={(v) => setSelectedTypeFilter(v || null)}
              placeholder={t('stock.productType')} compact
            />
            {allCategories.length > 1 && (
              <DropdownPicker
                label="" value={selectedCategoryFilter || ''}
                options={[{ label: t('stock.allCategories'), value: '' }, ...allCategories.map((c) => ({ label: c, value: c }))]}
                onSelect={(v) => setSelectedCategoryFilter(v || null)}
                placeholder={t('stock.productCategory')} compact
              />
            )}

            <View style={gridStyles.viewToggle}>
              {(['grid', 'list'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[gridStyles.viewToggleBtn, viewMode === mode && { backgroundColor: colors.primary }]}
                  onPress={() => setViewMode(mode)} activeOpacity={0.7}
                >
                  {mode === 'grid'
                    ? <LayoutGrid size={14} color={viewMode === mode ? '#FFF' : colors.textSecondary} />
                    : <List size={14} color={viewMode === mode ? '#FFF' : colors.textSecondary} />}
                </TouchableOpacity>
              ))}
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
                {search ? t('stock.noResults') : t('stock.noProducts')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                {search ? t('stock.tryDifferentSearch') : t('stock.noProductsHint')}
              </Text>
            </View>
          )}

          {/* Liste / Grille par groupe */}
          {groupedProducts.map((group) => (
            <View key={group.category}>
              <View style={[styles.categoryHeader, { backgroundColor: colors.surfaceHover }]}>
                <Tag size={13} color={colors.textSecondary} />
                <Text style={[styles.categoryHeaderText, { color: colors.text }]}>{group.category}</Text>
                <Text style={[styles.categoryHeaderCount, { color: colors.textTertiary }]}>{group.items.length}</Text>
              </View>

              {viewMode === 'grid' ? (
                <View style={gridStyles.gridContainer}>
                  {group.items.map((product) => {
                    const isInactive = !product.isActive || product.isArchived;
                    const typeConfig = getProductTypeConfig(product.type);
                    return (
                      <TouchableOpacity
                        key={product.id} activeOpacity={0.7}
                        onPress={() => setSelectedProductId(product.id)}
                        style={[gridStyles.productTile, {
                          backgroundColor: colors.card, borderColor: colors.cardBorder,
                          opacity: isInactive ? 0.55 : 1,
                          width: isMobile ? '47%' as any : '15%' as any,
                        }]}
                      >
                        {product.photoUrl ? (
                          <Image source={{ uri: product.photoUrl }} style={gridStyles.tileImage} resizeMode="cover" />
                        ) : (
                          <View style={[gridStyles.tilePlaceholder, { backgroundColor: colors.surfaceHover }]}>
                            <ImageIcon size={20} color={colors.textTertiary} />
                          </View>
                        )}
                        <View style={gridStyles.tileBody}>
                          <View style={[gridStyles.tileCatBadge, { backgroundColor: typeConfig.bgColor }]}>
                            <Text style={[gridStyles.tileCatBadgeText, { color: typeConfig.color }]} numberOfLines={1}>
                              {t(typeConfig.labelKey)}
                            </Text>
                          </View>
                          <Text style={[gridStyles.tileName, { color: colors.text }]} numberOfLines={2}>{product.name}</Text>
                          <Text style={[gridStyles.tilePrice, { color: colors.primary }]}>
                            {formatCurrency(htToTtc(product.salePrice, product.vatRate), cur)} TTC
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 16 }]}>
                  {!isMobile && (
                    <View style={[styles.columnHeaderBar, { backgroundColor: '#F9FAFB', borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                      <Text style={[styles.colHeaderText, { width: 46 }]}>{' '}</Text>
                      <Text style={[styles.colHeaderText, { flex: 2.5 }]}>{t('stock.productName').toUpperCase()}</Text>
                      <Text style={[styles.colHeaderText, { flex: 1, textAlign: 'center' }]}>{t('stock.productType').toUpperCase()}</Text>
                      <Text style={[styles.colHeaderText, { flex: 1 }]}>{t('stock.productCategory').toUpperCase()}</Text>
                      <Text style={[styles.colHeaderText, { flex: 1, textAlign: 'right' }]}>{t('stock.salePrice').toUpperCase()}</Text>
                    </View>
                  )}
                  {group.items.map(renderProductRow)}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Modales ── */}
      <ProductFormModal
        visible={productForm.formVisible}
        onClose={() => productForm.setFormVisible(false)}
        editingId={productForm.editingId}
        form={productForm.form}
        updateField={productForm.updateField}
        formError={productForm.formError}
        formStep={productForm.formStep}
        isTransformedType={isTransformedType}
        duplicateProduct={productForm.duplicateProduct}
        onOpenEdit={productForm.openEdit}
        handleNextStep={productForm.handleNextStep}
        handlePrevStep={productForm.handlePrevStep}
        handleFinalSubmit={productForm.handleFinalSubmit}
        handleQuickSave={productForm.handleQuickSave}
        handleDuplicateProduct={handleDuplicateProduct}
        selectedAttrIds={productForm.selectedAttrIds}
        setSelectedAttrIds={productForm.setSelectedAttrIds}
        selectedAttrValues={productForm.selectedAttrValues}
        setSelectedAttrValues={productForm.setSelectedAttrValues}
        productAttributes={productAttributes}
        addProductAttribute={addProductAttribute}
        addAttributeValue={addAttributeValue}
        variantDrafts={variantDraftsHook.variantDrafts}
        setVariantDrafts={variantDraftsHook.setVariantDrafts}
        bulkPurchasePrice={variantDraftsHook.bulkPurchasePrice}
        setBulkPurchasePrice={variantDraftsHook.setBulkPurchasePrice}
        bulkSalePrice={variantDraftsHook.bulkSalePrice}
        setBulkSalePrice={variantDraftsHook.setBulkSalePrice}
        applyBulkPrices={variantDraftsHook.applyBulkPrices}
        getVariantsForProduct={getVariantsForProduct}
        getRecipeForProduct={getRecipeForProduct}
        saveRecipe={saveRecipe}
        openRecipeEditor={openRecipeEditor}
        getOrderedVariants={getOrderedVariants}
        showToast={showToast}
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
        unitOptions={unitOptions}
        vatOptions={vatOptions}
        products={products}
        currency={cur}
        addProductCategory={addProductCategory}
        removeProductCategory={removeProductCategory}
        renameProductCategory={renameProductCategory}
        addProductBrand={addProductBrand}
        removeProductBrand={removeProductBrand}
        renameProductBrand={renameProductBrand}
        addProductUnit={addProductUnit}
        archiveProduct={archiveProduct}
        unarchiveProduct={unarchiveProduct}
        deleteProduct={deleteProduct}
        updateProduct={updateProduct}
      />

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          variants={selectedProductVariants}
          currency={cur}
          onClose={() => setSelectedProductId(null)}
          onEdit={productForm.openEdit}
          onArchive={archiveProduct}
          onUnarchive={unarchiveProduct}
          onDelete={deleteProduct}
          onAddVariant={openVariantCreate}
          onEditVariant={openVariantEdit}
          onDeleteVariant={handleDeleteVariant}
          onOpenRecipeEditor={openRecipeEditor}
          getProductTotalStock={getProductTotalStock}
          getRecipeForProduct={getRecipeForProduct}
          getOrderedVariants={getOrderedVariants}
        />
      )}

      <VariantFormModal
        visible={variantFormVisible}
        editingVariantId={editingVariantId}
        variantForm={variantForm}
        setVariantForm={setVariantForm}
        existingAttributeKeys={existingAttributeKeys}
        onClose={() => { setVariantFormVisible(false); setEditingVariantId(null); }}
        onSave={handleSaveVariant}
      />

      <RecipeEditor
        visible={recipeEditorVisible}
        onClose={() => setRecipeEditorVisible(false)}
        productId={recipeEditorProductId}
        variantId={recipeEditorVariantId}
        productName={recipeEditorProductName}
        variantLabel={recipeEditorVariantLabel}
        onRecipeSaved={(totalCost) => {
          if (recipeEditorVariantId) {
            updateVariantFn(recipeEditorVariantId, { purchasePrice: totalCost }, { silent: true });
            variantDraftsHook.setVariantDrafts((prev) =>
              prev.map((d) => d.existingVariantId === recipeEditorVariantId ? { ...d, purchasePrice: String(totalCost) } : d),
            );
          } else {
            updateProduct(recipeEditorProductId, { purchasePrice: totalCost });
            if (productForm.editingId === recipeEditorProductId) {
              productForm.updateField('purchasePrice', String(totalCost));
              variantDraftsHook.setBulkPurchasePrice(String(totalCost));
            }
            const variantRecipes = getRecipesForProduct(recipeEditorProductId).filter((r: any) => r.variantId);
            for (const vr of variantRecipes) {
              if (!vr.variantId) continue;
              let vrCost = 0;
              for (const item of vr.items) {
                const ingProduct = products.find((p) => p.id === item.ingredientProductId);
                if (ingProduct) {
                  let unitCost = ingProduct.purchasePrice;
                  const ingVariant = variants.find((v) => v.id === item.ingredientVariantId);
                  if (ingVariant) unitCost = ingVariant.purchasePrice;
                  vrCost += unitCost * item.quantity;
                }
              }
              vrCost = Math.round(vrCost * 100) / 100;
              updateVariantFn(vr.variantId, { purchasePrice: vrCost }, { silent: true });
              variantDraftsHook.setVariantDrafts((prev) =>
                prev.map((d) => d.existingVariantId === vr.variantId ? { ...d, purchasePrice: String(vrCost) } : d),
              );
            }
          }
        }}
      />

      <ProductImportModal
        visible={csvImportVisible}
        onClose={() => setCsvImportVisible(false)}
        existingCategories={productCategories}
        existingProducts={products.map((p): ExistingProductRef => ({ id: p.id, name: p.name, type: p.type, categoryName: p.categoryName }))}
        onImportProducts={(previewProds: PreviewProduct[]) => {
          let productsCreated = 0, productsUpdated = 0, variantsCreated = 0, categoriesCreated = 0;
          const errors: string[] = [];
          for (const pp of previewProds) {
            if (pp.category && !productCategories.includes(pp.category)) { void addProductCategory(pp.category); categoriesCreated++; }
            if (pp.brand && !productBrands.includes(pp.brand)) void addProductBrand(pp.brand);
            const isUpdate = pp.duplicate?.source === 'database' && pp.duplicateAction === 'update' && pp.duplicate.existingProductId;
            if (isUpdate) {
              const existingId = pp.duplicate!.existingProductId;
              const result = updateProduct(existingId, { description: pp.description || undefined, brand: pp.brand || undefined, purchasePrice: pp.purchasePrice, salePrice: pp.salePrice > 0 ? pp.salePrice : undefined, unit: pp.unit || undefined } as any, { silent: true });
              if (!result.success) { errors.push(`${pp.name}: ${result.error || 'Erreur mise à jour'}`); continue; }
              productsUpdated++;
              if (pp.variants.length > 0) {
                const existingVariants = getVariantsForProduct(existingId);
                for (const newV of pp.variants) {
                  const attrKey = Object.entries(newV.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|');
                  const match = existingVariants.find((ev) => Object.entries(ev.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|') === attrKey);
                  if (match) { updateVariantFn(match.id, { purchasePrice: newV.purchasePrice, salePrice: newV.salePrice, stockQuantity: newV.stockQuantity, minStock: newV.minStock }, { silent: true }); }
                  else { createVariant({ productId: existingId, attributes: newV.attributes, sku: generateUniqueSKU(), purchasePrice: newV.purchasePrice, salePrice: newV.salePrice, stockQuantity: newV.stockQuantity, minStock: newV.minStock, isActive: true }); variantsCreated++; }
                }
              }
              continue;
            }
            const result = createProduct({ name: pp.name, description: pp.description, sku: generateUniqueSKU(), categoryName: pp.category || undefined, brand: pp.brand || undefined, purchasePrice: pp.purchasePrice, salePrice: pp.salePrice > 0 ? pp.salePrice : 0.01, vatRate: 20 as VATRate, stockQuantity: pp.stockQuantity, lowStockThreshold: pp.minStock, unit: pp.unit || 'pièce', type: pp.type, isActive: true });
            if (!result.success) { errors.push(`${pp.name}: ${result.error || 'Erreur'}`); continue; }
            productsCreated++;
            if (result.productId && pp.variants.length > 0) {
              createVariantsBatch(result.productId, pp.variants.map((v) => ({ attributes: v.attributes, sku: generateUniqueSKU(), purchasePrice: v.purchasePrice, salePrice: v.salePrice, stockQuantity: v.stockQuantity, minStock: v.minStock })));
              variantsCreated += pp.variants.length;
            }
          }
          const parts = [];
          if (productsCreated > 0) parts.push(`${productsCreated} créé(s)`);
          if (productsUpdated > 0) parts.push(`${productsUpdated} mis à jour`);
          if (parts.length > 0) showToast(`Produits : ${parts.join(', ')}`);
          return { productsCreated, productsUpdated, variantsCreated, categoriesCreated, errors };
        }}
      />
    </View>
  );
}