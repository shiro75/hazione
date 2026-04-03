/**
 * ProductsScreen.tsx
 *
 * Ecran principal de gestion du catalogue produits.
 * Permet de creer, modifier, archiver et supprimer des produits avec leurs variantes.
 *
 * CONVENTION DE PRIX :
 *   - La base de donnees (DataContext) stocke toujours les prix en HT (hors taxe).
 *   - L'utilisateur saisit le prix de vente en TTC dans tous les formulaires.
 *   - La conversion TTC -> HT se fait juste avant l'appel createProduct / updateProduct / createVariant.
 *   - La conversion HT -> TTC se fait a l'affichage (liste, grille, fiche, edition).
 *   - Formule : HT = TTC / (1 + tva/100)  |  TTC = HT * (1 + tva/100)
 *
 * STRUCTURE DES RENDUS :
 *   - renderStep1          : Formulaire etape 1 — infos generales + prix TTC + TVA
 *   - renderStep2          : Formulaire etape 2 — selection des attributs de variantes
 *   - renderStep3          : Formulaire etape 3 — prix et stocks par variante
 *   - renderProductDetail  : Modale de fiche produit (lecture)
 *   - renderVariantFormModal : Formulaire d'ajout / edition d'une variante
 *   - renderFormModal      : Modale multi-etapes de creation / edition produit
 *   - renderAttributesTab  : Gestion des groupes d'attributs avec boutons de reordonnancement
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  useWindowDimensions, Image, Modal, Pressable, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import {
  Search, Plus, Package, Check, Pencil, Archive, X,
  Briefcase, Box, ArrowUpDown, Trash2, AlertTriangle,
  Tag, Layers, ChevronLeft, ChevronRight, Tags, Upload,
  LayoutGrid, List, Image as ImageIcon, Download,
  ChefHat, EyeOff, Eye, Copy,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { formatCurrency } from '@/utils/format';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import PageHeader from '@/components/PageHeader';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import DropdownPicker from '@/components/DropdownPicker';
import ProductImportModal from '@/components/ProductImportModal';
import type { PreviewProduct, ExistingProductRef } from '@/components/ProductImportModal';
import RecipeEditor from '@/components/RecipeEditor';
import type { VATRate, ProductType, ProductVariant, Product } from '@/types';
import { getProductTypeOptions, getProductTypeConfig, isStockableType } from '@/constants/productTypes';

// Styles partagés pour la superposition de modales
const modalOverlay = {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
} as const;

// Type representant l'etape courante dans le formulaire multi-etapes
type FormStep = 1 | 2 | 3 | 4;

/**
 * Structure d'un brouillon de variante avant enregistrement.
 * Les prix sont en TTC a ce stade (conversion en HT faite au moment du submit).
 */
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

/**
 * Genere un SKU unique aleatoire au format REF-XXXXXX.
 * Utilise pour les nouveaux produits et variantes sans SKU defini.
 */
function generateUniqueSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF-${code}`;
}

// Valeurs par defaut du formulaire produit, utilisees a la creation et a la reinitialisation
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
  type: 'stock.transformedProduct' as ProductType,
  isActive: true,
  photoUrl: '',
  imageUrls: [] as string[],
};

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
    company,
    showToast,
    getRecipeForProduct,
    saveRecipe,
  } = useData();

  const cur = company.currency || 'EUR';
  const TYPE_OPTIONS = useMemo(() => getProductTypeOptions(t), [t]);
  const [csvImportVisible, setCsvImportVisible] = useState(false);

  // Sous-onglets de l'ecran : catalogue de produits ou gestion des attributs
  type ProductsSubTab = 'catalogue' | 'attributes';
  const [subTab, setSubTab] = useState<ProductsSubTab>('catalogue');

  // Etats de recherche et tri dans le catalogue
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

  // Persistance du mode d'affichage (grille ou liste) entre les sessions
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

  // Etats du formulaire multi-etapes de creation / edition produit
  const [formStep, setFormStep] = useState<FormStep>(1);
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);
  const [selectedAttrValues, setSelectedAttrValues] = useState<Record<string, string[]>>({});
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  // Etats de la fiche produit et du formulaire de variante individuelle
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

  // Recipe editor state
  const [recipeEditorVisible, setRecipeEditorVisible] = useState(false);
  const [recipeEditorProductId, setRecipeEditorProductId] = useState<string>('');
  const [recipeEditorVariantId, setRecipeEditorVariantId] = useState<string | undefined>(undefined);
  const [recipeEditorProductName, setRecipeEditorProductName] = useState<string>('');
  const [recipeEditorVariantLabel, setRecipeEditorVariantLabel] = useState<string | undefined>(undefined);

  const openRecipeEditor = useCallback((productId: string, productName: string, variantId?: string, variantLabel?: string) => {
    setRecipeEditorProductId(productId);
    setRecipeEditorVariantId(variantId);
    setRecipeEditorProductName(productName);
    setRecipeEditorVariantLabel(variantLabel);
    setRecipeEditorVisible(true);
  }, []);

  // Produit actuellement selectionne pour la fiche de detail
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) ?? null;
  }, [selectedProductId, products]);

  // Variantes du produit selectionne
  const selectedProductVariants = useMemo(() => {
    if (!selectedProductId) return [];
    return getVariantsForProduct(selectedProductId);
  }, [selectedProductId, getVariantsForProduct]);

  /**
   * Liste des produits a afficher apres application de la recherche,
   * des filtres de categorie / type, et du tri choisi.
   */
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

  // Liste unique des categories presentes dans les produits visibles
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    const base = showArchived ? products : activeProducts;
    base.forEach((p) => cats.add(p.categoryName || 'Sans catégorie'));
    return Array.from(cats).sort();
  }, [activeProducts, products, showArchived]);

  /**
   * Produits regroupes par categorie pour l'affichage en liste ou en grille.
   * Chaque groupe contient son nom de categorie et ses produits.
   */
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

  // Options de selects derives des listes du DataContext
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

  /**
   * Genere toutes les combinaisons de variantes a partir des attributs et valeurs
   * selectionnes a l'etape 2 du formulaire.
   * Exemple : Taille [S, M] x Couleur [Rouge, Bleu] => 4 combinaisons.
   */
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

  /**
   * Ouvre le formulaire en mode creation.
   * Reinitialise tous les champs et genere un nouveau SKU aleatoire.
   */
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

  /**
   * Ouvre le formulaire en mode edition pour un produit existant.
   * Charge les donnees du produit et reconvertit les prix HT en TTC pour l'affichage.
   * Reconstruit egalement les brouillons de variantes existantes.
   */
  const openEdit = useCallback((productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setEditingId(p.id);
    // La BDD stocke le HT : on reconvertit en TTC pour l'affichage dans le formulaire
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

    // Reconstruction des attributs et valeurs selectionnes a partir des variantes existantes
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

    // Construction des brouillons de variantes avec prix reconvertis en TTC
    const drafts: VariantDraft[] = existingVariants.map(v => ({
      attributes: { ...v.attributes },
      sku: v.sku,
      purchasePrice: String(v.purchasePrice),
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

  /**
   * Gere la navigation vers l'etape suivante du formulaire multi-etapes.
   * Valide les champs requis avant de passer a l'etape suivante.
   * A l'etape 2, genere les brouillons de variantes a partir des combinaisons.
   */
  const handleNextStep = useCallback(() => {
    if (formStep === 1) {
      if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
      const isRawMat = form.type === 'matiere_premiere';
      if (isRawMat) {
        const purchasePrice = parseFloat(form.purchasePrice);
        if (isNaN(purchasePrice) || purchasePrice <= 0) { setFormError('Le prix d\'achat est requis pour les matieres premieres'); return; }
      } else {
        const salePrice = parseFloat(form.salePrice);
        if (isNaN(salePrice) || salePrice <= 0) { setFormError('Le prix de vente doit etre un nombre positif'); return; }
      }
      setFormError('');
      setFormStep(2);
    } else if (formStep === 2) {
      setFormError('');
      if (editingId) {
        // En edition, on conserve les variantes existantes et on ajoute les nouvelles combinaisons
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
    } else if (formStep === 3 && (form.type === 'produit_transforme' || form.type === 'produit_fini')) {
      setFormError('');
      setFormStep(4);
    }
  }, [formStep, form, editingId, generateCombinations, variantDrafts]);

  const handlePrevStep = useCallback(() => {
    if (formStep === 2) setFormStep(1);
    else if (formStep === 3) setFormStep(2);
    else if (formStep === 4) setFormStep(3);
  }, [formStep]);

  /**
   * Soumission finale du formulaire a l'etape 3.
   * Convertit tous les prix TTC en HT avant enregistrement.
   * Gere la creation / mise a jour des variantes en comparant avec l'existant.
   */
  const handleFinalSubmit = useCallback(() => {
    if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
    const isRawMat = form.type === 'matiere_premiere';
    const salePriceTTC = parseFloat(form.salePrice) || 0;
    if (!isRawMat && (isNaN(salePriceTTC) || salePriceTTC <= 0)) { setFormError('Le prix de vente doit etre positif'); return; }
    const purchasePriceVal = parseFloat(form.purchasePrice) || 0;
    if (isRawMat && purchasePriceVal <= 0) { setFormError('Le prix d\'achat est requis pour les matieres premieres'); return; }
    const vatRate = parseFloat(form.vatRate) as VATRate;
    const salePrice = salePriceTTC > 0 ? Math.round(salePriceTTC / (1 + vatRate / 100) * 100) / 100 : 0;
    const purchasePrice = purchasePriceVal;
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

      // Suppression des variantes qui ont ete decochees
      existingVariants.forEach(v => {
        if (!keptExistingIds.has(v.id)) {
          deleteVariant(v.id);
        }
      });

      // Mise a jour ou creation des variantes incluses
      includedDrafts.forEach(d => {
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
          salePrice: Math.round((parseFloat(d.salePrice) || 0) / (1 + vatRate / 100) * 100) / 100,
          stockQuantity: parseInt(d.stockQuantity, 10) || 0,
          minStock: parseInt(d.minStock, 10) || 0,
        }));
        createVariantsBatch(productId, batchData);
      }
    }

    setFormVisible(false);
  }, [form, variantDrafts, editingId, createProduct, updateProduct, createVariantsBatch, createVariant, updateVariantFn, deleteVariant, getVariantsForProduct]);

  /**
   * Sauvegarde rapide depuis l'etape 1 ou 2, sans passer par l'etape 3.
   * Utile pour enregistrer les infos de base sans configurer les variantes.
   * Convertit le prix TTC en HT avant enregistrement.
   */
  const handleQuickSave = useCallback(() => {
    if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
    const isRawMat = form.type === 'matiere_premiere';
    const salePriceTTC = parseFloat(form.salePrice) || 0;
    if (!isRawMat && (isNaN(salePriceTTC) || salePriceTTC <= 0)) { setFormError('Le prix de vente doit etre positif'); return; }
    const purchasePrice = parseFloat(form.purchasePrice) || 0;
    if (isRawMat && purchasePrice <= 0) { setFormError('Le prix d\'achat est requis pour les matieres premieres'); return; }
    const lowStockThreshold = parseInt(form.lowStockThreshold, 10) || 5;
    const vatRate = parseFloat(form.vatRate) as VATRate;
    const salePrice = salePriceTTC > 0 ? Math.round(salePriceTTC / (1 + vatRate / 100) * 100) / 100 : 0;
    const data = {
      name: form.name.trim(), description: form.description.trim(), sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      categoryName: form.category || undefined, brand: form.brand || undefined,
      purchasePrice, salePrice, vatRate, lowStockThreshold,
      unit: form.unit || 'piece', type: form.type, isActive: form.isActive,
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
      }
    }
    setFormVisible(false);
    showToast('Produit enregistre');
  }, [editingId, form, updateProduct, createProduct, showToast]);

  /**
   * Applique les prix saisis dans les champs "Appliquer a toutes" a l'ensemble
   * des brouillons de variantes de l'etape 3.
   */
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

  const handleDuplicateProduct = useCallback(() => {
    if (!editingId) return;
    const product = products.find(p => p.id === editingId);
    if (!product) return;
    const data = {
      name: product.name + ' - Copy',
      description: product.description,
      sku: generateUniqueSKU(),
      barcode: '',
      categoryName: product.categoryName,
      brand: product.brand,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      vatRate: product.vatRate,
      stockQuantity: 0,
      lowStockThreshold: product.lowStockThreshold,
      unit: product.unit,
      type: product.type,
      isActive: true,
      photoUrl: product.photoUrl,
      imageUrls: product.imageUrls,
    };
    const result = createProduct(data);
    if (result.success && result.productId) {
      const newProductId = result.productId;
      const sourceVariants = getVariantsForProduct(editingId);
      if (sourceVariants.length > 0) {
        const batchData = sourceVariants.map((v, idx) => ({
          attributes: { ...v.attributes },
          sku: generateVariantSKU(product.brand || '', product.name + ' - Copy', idx + 1),
          purchasePrice: v.purchasePrice,
          salePrice: v.salePrice,
          stockQuantity: 0,
          minStock: v.minStock ?? 0,
        }));
        createVariantsBatch(newProductId, batchData);
        const newVariants = getVariantsForProduct(newProductId);
        sourceVariants.forEach((srcVariant) => {
          const srcRecipe = getRecipeForProduct(editingId, srcVariant.id);
          if (srcRecipe && srcRecipe.items.length > 0) {
            const matchingNew = newVariants.find(nv =>
              JSON.stringify(nv.attributes) === JSON.stringify(srcVariant.attributes)
            );
            if (matchingNew) {
              saveRecipe(newProductId, srcRecipe.items.map(item => ({ ...item })), matchingNew.id);
            }
          }
        });
      }
      const productRecipe = getRecipeForProduct(editingId);
      if (productRecipe && productRecipe.items.length > 0) {
        saveRecipe(newProductId, productRecipe.items.map(item => ({ ...item })));
      }
      setFormVisible(false);
      showToast('Produit dupliqué avec variantes et recettes');
    } else if (result.success) {
      setFormVisible(false);
      showToast('Produit dupliqué');
    }
  }, [editingId, products, createProduct, showToast, getVariantsForProduct, createVariantsBatch, generateVariantSKU, getRecipeForProduct, saveRecipe]);

  // Mise a jour d'un champ du formulaire principal avec reinitialisation de l'erreur
  const updateField = useCallback(<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError('');
  }, []);

  /**
   * Detection d'un produit potentiellement duplique lors de la creation.
   * Compare le nom, le type et la categorie avec les produits actifs existants.
   */
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

  /**
   * Ouvre le formulaire de creation d'une nouvelle variante pour le produit selectionne.
   * Pre-remplit les prix a partir du produit parent (reconvertis en TTC).
   */
  const openVariantCreate = useCallback(() => {
    if (!selectedProduct) return;
    setEditingVariantId(null);
    const parentSaleTTC = selectedProduct.salePrice * (1 + selectedProduct.vatRate / 100);
    setVariantForm({
      attributes: [{ key: '', value: '' }],
      sku: '', purchasePrice: String(selectedProduct.purchasePrice || ''),
      salePrice: String(parentSaleTTC || ''), stock: '0',
      minStock: String(selectedProduct.lowStockThreshold || '0'),
    });
    setVariantFormVisible(true);
  }, [selectedProduct]);

  /**
   * Ouvre le formulaire d'edition d'une variante existante.
   * Reconvertit le prix HT stocke en TTC pour l'affichage dans le formulaire.
   */
  const openVariantEdit = useCallback((v: ProductVariant) => {
    setEditingVariantId(v.id);
    const attrs = Object.entries(v.attributes).map(([key, value]) => ({ key, value }));
    if (attrs.length === 0) attrs.push({ key: '', value: '' });
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

  /**
   * Enregistre la variante individuelle (creation ou mise a jour).
   * Convertit le prix de vente TTC saisi en HT avant d'appeler le DataContext.
   */
  const handleSaveVariant = useCallback(() => {
    if (!selectedProductId) return;
    const attrs: Record<string, string> = {};
    variantForm.attributes.forEach((a) => {
      if (a.key.trim() && a.value.trim()) attrs[a.key.trim()] = a.value.trim();
    });
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
    confirm('Supprimer', 'Supprimer cette variante ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteVariant(variantId) },
    ]);
  }, [deleteVariant, confirm]);

  // Affiche une ligne label / valeur dans la fiche produit, masquee si la valeur est vide
  const renderInfoRow = useCallback((label: string, value: string | undefined, valueColor?: string) => {
    if (!value) return null;
    return (
      <View style={detailStyles.infoRow}>
        <Text style={[detailStyles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
        <Text style={[detailStyles.infoValue, { color: valueColor || colors.text }]} numberOfLines={2}>{value}</Text>
      </View>
    );
  }, [colors]);

  const isTransformedType = form.type === 'produit_transforme' || form.type === 'produit_fini';
  const isRawMaterial = form.type === 'matiere_premiere';

  const getUserVariants = useCallback((productId: string) => {
    const pvs = getVariantsForProduct(productId);
    const userVars = pvs.filter(v => Object.keys(v.attributes).length > 0);
    return userVars.length > 0 ? userVars : [];
  }, [getVariantsForProduct]);
  const stepLabels: Record<number, string> = { 1: 'Infos', 2: 'Attributs', 3: 'Variantes', 4: t('recipe.title') };
  const stepsToShow = isTransformedType ? [1, 2, 3, 4] : [1, 2, 3];

  const renderStepIndicator = () => (
    <View style={stepStyles.container}>
      {stepsToShow.map((step) => (
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
            {stepLabels[step]}
          </Text>
          {step < stepsToShow[stepsToShow.length - 1] && <View style={[stepStyles.stepLine, { backgroundColor: formStep > step ? colors.primary : colors.border }]} />}
        </View>
      ))}
    </View>
  );

  // ---------- DEBUT DES FONCTIONS DE RENDU ----------

  /**
   * Etape 1 : infos generales du produit.
   * Champs : type, nom, description, SKU, code-barres, categorie, marque, unite,
   * TVA, prix d'achat HT, prix de vente TTC (converti en HT a la sauvegarde), images.
   * Affiche en direct le prix HT calcule et la marge.
   */
  const renderStep1 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
      <DropdownPicker
        label={t('stock.productType')} value={form.type} options={TYPE_OPTIONS}
        onSelect={(v) => updateField('type', v as ProductType)} required placeholder={t('stock.selectProductType')}
      />
      <FormField label={t('stock.productName')} value={form.name} onChangeText={(v) => updateField('name', v)} placeholder={t('stock.productName')} required testID="product-name" />

      {/* Avertissement si un produit similaire existe deja dans le catalogue */}
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

      <FormField label="Description" value={form.description} onChangeText={(v) => updateField('description', v)} placeholder={t('stock.productDescription')} multiline numberOfLines={2} />
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <FormField label={t('stock.productBarcode')} value={form.barcode} onChangeText={(v) => updateField('barcode', v)} placeholder={t('stock.barcodePlaceholder')} />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <DropdownPicker label={t('stock.productCategory')} value={form.category} options={categoryOptions}
            onSelect={(v) => updateField('category', v)}
            onAddNew={(v) => { void addProductCategory(v); updateField('category', v); }}
            addLabel={t('stock.newCategory')}
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
            addLabel={t('stock.newBrand')} placeholder={t('stock.brandPlaceholder')}
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
          <DropdownPicker label={t('stock.productUnit')} value={form.unit} options={unitOptions}
            onSelect={(v) => updateField('unit', v)}
            onAddNew={(v) => { addProductUnit(v); updateField('unit', v); }}
            addLabel={t('stock.newUnit')} required placeholder={t('stock.unitPlaceholder')} />
        </View>
      </View>

      {/* Section prix : TVA, prix d'achat HT, prix de vente TTC */}
      <DropdownPicker label={t('stock.vatRate')} value={form.vatRate} options={vatOptions}
        onSelect={(v) => updateField('vatRate', v)} required placeholder={t('stock.vatPlaceholder')} />
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <FormField label={t('stock.purchasePrice')} value={form.purchasePrice}
            onChangeText={(v) => updateField('purchasePrice', v)} placeholder={t('stock.purchasePricePlaceholder')} keyboardType="decimal-pad" required={isRawMaterial} />
        </View>
        <View style={styles.formCol}>
          <FormField label={t('stock.salePrice')} value={form.salePrice}
            onChangeText={(v) => updateField('salePrice', v)} placeholder={t('stock.salePricePlaceholder')} keyboardType="decimal-pad" required={!isRawMaterial} />
        </View>
      </View>

      {/* Affichage du prix HT calcule en temps reel a partir du TTC et du taux de TVA */}
      {parseFloat(form.salePrice) > 0 && (
        <View style={[styles.marginInfo, { backgroundColor: '#EFF6FF' }]}>
          <Text style={[styles.marginInfoText, { color: '#1E40AF' }]}>
            {t('stock.priceExcludingVat')} : {formatCurrency(parseFloat(form.salePrice) / (1 + parseFloat(form.vatRate) / 100), cur)} ({t('stock.vatRate')} {form.vatRate.replace('.', ',')}%)
          </Text>
        </View>
      )}

      {/* Affichage de la marge calculee entre prix d'achat HT et prix de vente HT deduit du TTC */}
      {parseFloat(form.salePrice) > 0 && parseFloat(form.purchasePrice) > 0 && (() => {
        const salePriceHT = parseFloat(form.salePrice) / (1 + parseFloat(form.vatRate) / 100);
        const purchasePriceHT = parseFloat(form.purchasePrice);
        const marginAmt = salePriceHT - purchasePriceHT;
        const marginPct = ((1 - purchasePriceHT / salePriceHT) * 100).toFixed(1);
        return (
          <View style={[styles.marginInfo, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.marginInfoText, { color: colors.success }]}>
              {t('stock.margin')} : {formatCurrency(marginAmt, cur)} ({marginPct}%)
            </Text>
          </View>
        );
      })()}

      <FormField label={t('stock.lowStockAlert')} value={form.lowStockThreshold}
        onChangeText={(v) => updateField('lowStockThreshold', v)} placeholder={t('stock.lowStockPlaceholder')} keyboardType="numeric" />

      {/* Section images : import depuis la galerie ou par URL */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const }}>
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
            <ImageIcon size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }}>{t('stock.productImages')}</Text>
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
            <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.primary }}>{t('stock.importImages')}</Text>
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
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('stock.importFromDevice')}</Text>
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

  // Etats locaux de l'etape 2 pour la creation inline de nouveaux attributs et valeurs
  const [newInlineAttrName, setNewInlineAttrName] = useState('');
  const [newInlineAttrValues, setNewInlineAttrValues] = useState('');
  const [showInlineNewAttr, setShowInlineNewAttr] = useState(false);
  const [inlineAddValueAttrId, setInlineAddValueAttrId] = useState<string | null>(null);
  const [inlineNewValue, setInlineNewValue] = useState('');

  // Etats de l'onglet de gestion des attributs globaux
  const [attrMgmtNewName, setAttrMgmtNewName] = useState('');
  const [attrMgmtNewValues, setAttrMgmtNewValues] = useState('');
  const [attrMgmtEditingId, setAttrMgmtEditingId] = useState<string | null>(null);
  const [attrMgmtNewValueInput, setAttrMgmtNewValueInput] = useState('');
  const [attrMgmtRenamingId, setAttrMgmtRenamingId] = useState<string | null>(null);
  const [attrMgmtRenameValue, setAttrMgmtRenameValue] = useState('');

  /**
   * Etape 2 : selection des attributs de variantes.
   * Chaque attribut coche (Taille, Couleur, etc.) contribue aux combinaisons generees a l'etape 3.
   * Si aucun attribut n'est selectionne, le produit sera simple (1 variante par defaut).
   * Permet aussi de creer de nouveaux attributs et d'ajouter des valeurs a la volee.
   */
  const renderStep2 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
      <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>{t('stock.selectAttributes')}</Text>
      <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
        {t('stock.attributesStepHint')}
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
          <Text style={[step2Styles.newAttrTitle, { color: colors.text }]}>{t('stock.newAttribute')}</Text>
          <TextInput
            style={[step2Styles.newAttrInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={newInlineAttrName}
            onChangeText={setNewInlineAttrName}
            placeholder={t('stock.newAttributeName')}
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />
          <TextInput
            style={[step2Styles.newAttrInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={newInlineAttrValues}
            onChangeText={setNewInlineAttrValues}
            placeholder={t('stock.newAttributeValues')}
            placeholderTextColor={colors.textTertiary}
          />
          <View style={step2Styles.newAttrActions}>
            <TouchableOpacity
              style={[step2Styles.newAttrCancel, { borderColor: colors.border }]}
              onPress={() => { setShowInlineNewAttr(false); setNewInlineAttrName(''); setNewInlineAttrValues(''); }}
            >
              <Text style={[step2Styles.newAttrCancelText, { color: colors.textSecondary }]}>{t('stock.cancel')}</Text>
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
              <Text style={step2Styles.newAttrSubmitText}>{t('stock.createAttribute')}</Text>
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
          <Text style={[step2Styles.addAttrBtnText, { color: colors.primary }]}>{t('stock.newAttribute')}</Text>
        </TouchableOpacity>
      )}

      {productAttributes.length === 0 && !showInlineNewAttr && (
        <View style={[stepStyles.emptyAttrs, { backgroundColor: colors.surfaceHover }]}>
          <Tags size={24} color={colors.textTertiary} />
          <Text style={[stepStyles.emptyText, { color: colors.textSecondary }]}>
            {t('stock.noAttributesHint')}
          </Text>
        </View>
      )}
    </ScrollView>
  );

  /**
   * Etape 3 : variantes et prix.
   * Si aucune variante : formulaire simple avec prix achat HT, vente TTC et stock.
   * Si des variantes existent : tableau de brouillons avec prix et stock par variante.
   * Les prix affiches sont en TTC, convertis en HT dans handleFinalSubmit.
   */
  const renderStep3 = () => {
    const hasVariants = variantDrafts.length > 0;
    const includedCount = variantDrafts.filter(d => d.included).length;

    if (!hasVariants) {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
          <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>{t('stock.productSimple')}</Text>
          <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
            {t('stock.noAttributesSelected')}
          </Text>
          <View style={[step3Styles.simpleCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <FormField label={t('stock.purchasePrice')} value={form.purchasePrice}
                  onChangeText={(v) => updateField('purchasePrice', v)} placeholder="0.00" keyboardType="decimal-pad" />
              </View>
              <View style={styles.formCol}>
                <FormField label={t('stock.salePrice')} value={form.salePrice}
                  onChangeText={(v) => updateField('salePrice', v)} placeholder="0.00" keyboardType="decimal-pad" required />
              </View>
            </View>
            <FormField label={t('stock.stockInitial')} value={form.lowStockThreshold}
              onChangeText={(v) => updateField('lowStockThreshold', v)} placeholder="0" keyboardType="numeric" />
            {parseFloat(form.salePrice) > 0 && parseFloat(form.purchasePrice) > 0 && (() => {
              const salePriceHT = parseFloat(form.salePrice) / (1 + parseFloat(form.vatRate) / 100);
              const purchasePriceHT = parseFloat(form.purchasePrice);
              const marginAmt = salePriceHT - purchasePriceHT;
              const marginPct = ((1 - purchasePriceHT / salePriceHT) * 100).toFixed(1);
              return (
                <View style={[styles.marginInfo, { backgroundColor: colors.successLight }]}>
                  <Text style={[styles.marginInfoText, { color: colors.success }]}>
                    {t('stock.margin')} : {formatCurrency(marginAmt, cur)} ({marginPct}%)
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
          {variantDrafts.length === 1 ? t('stock.variantsCount', { count: 1 }) : t('stock.variantsCount', { count: variantDrafts.length })}
        </Text>
        <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
          {t('stock.variantIncluded')} {includedCount} — {t('stock.variantsHint')}
        </Text>

        {/* Application en masse des prix a toutes les variantes */}
        <View style={[stepStyles.bulkRow, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
          <Text style={[stepStyles.bulkLabel, { color: colors.textSecondary }]}>{t('stock.applyToAll')}</Text>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[stepStyles.bulkInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={bulkPurchasePrice} onChangeText={setBulkPurchasePrice}
              placeholder={t('stock.bulkPurchasePrice')} placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[stepStyles.bulkInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={bulkSalePrice} onChangeText={setBulkSalePrice}
              placeholder={t('stock.bulkSalePrice')} placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad"
            />
          </View>
          <TouchableOpacity style={[stepStyles.bulkBtn, { backgroundColor: colors.primary }]} onPress={applyBulkPrices}>
            <Check size={14} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={stepStyles.draftHeaderRow}>
          <View style={{ width: 28 }} />
          <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, flex: 1 }]}>{t('stock.purchasePrice').toUpperCase()}</Text>
          <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, flex: 1 }]}>{t('stock.salePrice').toUpperCase()}</Text>
          <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, width: 60 }]}>{t('stock.currentStock').toUpperCase()}</Text>
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
   * Fonction utilitaire pour trier les variantes selon l'ordre défini dans l'onglet Attributs.
   * Cette fonction doit être définie au niveau du composant principal pour respecter les règles des hooks.
   */
  const getOrderedVariants = useCallback((variants: ProductVariant[]) => {
    // Créer un map de l'ordre des valeurs pour chaque attribut
    const orderMap: Record<string, Record<string, number>> = {};

    productAttributes.forEach(attr => {
      orderMap[attr.name] = {};
      attr.values.forEach((value, index) => {
        orderMap[attr.name][value] = index;
      });
    });

    // Fonction pour obtenir la clé de tri
    const getSortKey = (variant: ProductVariant): string => {
      const sortedAttrs = Object.entries(variant.attributes)
        .sort(([a], [b]) => a.localeCompare(b));

      return sortedAttrs.map(([attrName, value]) => {
        const order = orderMap[attrName]?.[value] ?? 999;
        return String(order).padStart(3, '0');
      }).join('-');
    };

    return [...variants].sort((a, b) => {
      const keyA = getSortKey(a);
      const keyB = getSortKey(b);
      return keyA.localeCompare(keyB);
    });
  }, [productAttributes]);

  const renderStep4 = () => {
    const productId = editingId;
    const productVariantsForRecipe = productId ? getVariantsForProduct(productId) : [];
    const hasMultipleVariants = productVariantsForRecipe.length > 1 ||
      (productVariantsForRecipe.length === 1 && Object.keys(productVariantsForRecipe[0].attributes).length > 0);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
        <View style={[{ backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}20`, borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }]}>
          <ChefHat size={16} color={colors.primary} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>
            {t('recipe.step4Hint')}
          </Text>
        </View>

        {!productId ? (
          <View style={{ alignItems: 'center' as const, paddingVertical: 24 }}>
            <Text style={{ fontSize: 13, color: colors.textTertiary }}>
              {t('recipe.noRecipeHint')}
            </Text>
          </View>
        ) : hasMultipleVariants ? (
          <View style={{ gap: 8 }}>
            <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>
              {t('recipe.variantRecipe')}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
              {t('recipe.stockDeduction')}
            </Text>
            {getOrderedVariants(productVariantsForRecipe).map((v) => {
              const hasAttrs = Object.keys(v.attributes).length > 0;
              const attrLabel = hasAttrs
                ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' / ')
                : t('recipe.defaultVariant');
              const recipe = getRecipeForProduct(productId, v.id);
              const hasRecipe = recipe && recipe.items.length > 0;
              return (
                <View key={v.id} style={[{
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  gap: 8,
                }]}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const }}>
                    <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.text, flex: 1 }} numberOfLines={1}>
                      {attrLabel}
                    </Text>
                    <TouchableOpacity
                      style={[styles.iconBtn, {
                        backgroundColor: hasRecipe ? '#ECFDF5' : colors.primaryLight,
                        flexDirection: 'row' as const,
                        gap: 4,
                        paddingHorizontal: 8,
                        width: 'auto' as unknown as number,
                      }]}
                      onPress={() => openRecipeEditor(productId, form.name, v.id, attrLabel)}
                    >
                      <ChefHat size={12} color={hasRecipe ? '#059669' : colors.primary} />
                      <Text style={{ fontSize: 11, fontWeight: '600' as const, color: hasRecipe ? '#059669' : colors.primary }}>
                        {hasRecipe ? t('recipe.editRecipe') : t('recipe.addRecipe')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {hasRecipe && (
                    <View style={{ gap: 4 }}>
                      {recipe.items.map(item => (
                        <View key={item.id} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
                          <Package size={10} color={colors.textTertiary} />
                          <Text style={{ flex: 1, fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                            {item.ingredientProductName}
                            {item.ingredientVariantLabel ? ` (${item.ingredientVariantLabel})` : ''}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' as const }}>
                            {item.quantity} {item.unit}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>
              {t('recipe.productRecipe')}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
              {t('recipe.stockDeduction')}
            </Text>
            {(() => {
              const recipe = getRecipeForProduct(productId);
              const hasRecipe = recipe && recipe.items.length > 0;
              return (
                <View style={[{
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  gap: 8,
                }]}>
                  {hasRecipe && (
                    <View style={{ gap: 4 }}>
                      {recipe.items.map(item => (
                        <View key={item.id} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
                          <Package size={10} color={colors.textTertiary} />
                          <Text style={{ flex: 1, fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                            {item.ingredientProductName}
                            {item.ingredientVariantLabel ? ` (${item.ingredientVariantLabel})` : ''}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' as const }}>
                            {item.quantity} {item.unit}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity
                    style={[{
                      flexDirection: 'row' as const,
                      alignItems: 'center' as const,
                      justifyContent: 'center' as const,
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderStyle: 'dashed' as const,
                      borderColor: hasRecipe ? '#059669' : colors.primary,
                    }]}
                    onPress={() => openRecipeEditor(productId, form.name)}
                  >
                    <ChefHat size={14} color={hasRecipe ? '#059669' : colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '600' as const, color: hasRecipe ? '#059669' : colors.primary }}>
                      {hasRecipe ? t('recipe.editRecipe') : t('recipe.addRecipe')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderProductDetail = () => {
    if (!selectedProduct) return null;
    const totalStock = getProductTotalStock(selectedProduct.id);
    const isLowStock = isStockableType(selectedProduct.type) && selectedProductVariants.some(v => v.stockQuantity <= (v.minStock || selectedProduct.lowStockThreshold));
    // La marge est calculee sur les prix HT stockes en BDD
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
                    {t(getProductTypeConfig(selectedProduct.type).labelKey)}
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
                  onPress={() => { unarchiveProduct(selectedProduct.id); setSelectedProductId(null); }}
                  style={[detailStyles.editBtn, { backgroundColor: colors.successLight }]}
                  hitSlop={8}
                >
                  <Archive size={14} color={colors.success} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    confirm('Archiver', `Archiver « ${selectedProduct.name} » ?`, [
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
                  confirm('Supprimer', `Supprimer définitivement « ${selectedProduct.name} » et toutes ses variantes ?`, [
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

              {/* Carte des prix en TTC (BDD stocke HT, reconverti ici pour l'affichage) */}
              <View style={[detailStyles.priceCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                <View style={detailStyles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>{t('stock.salePrice')}</Text>
                    <Text style={[detailStyles.priceValue, { color: colors.text }]}>
                      {formatCurrency(selectedProduct.salePrice * (1 + selectedProduct.vatRate / 100), cur)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>{t('stock.purchasePrice')}</Text>
                    <Text style={[detailStyles.priceValue, { color: colors.text }]}>{formatCurrency(selectedProduct.purchasePrice, cur)}</Text>
                  </View>
                  {margin && (
                    <View style={{ flex: 1 }}>
                      <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>{t('stock.margin')}</Text>
                      <Text style={[detailStyles.priceValue, { color: colors.success }]}>{margin}%</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={[detailStyles.infoSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                {renderInfoRow(t('stock.productBrand'), selectedProduct.brand)}
                {renderInfoRow(t('stock.productUnit'), selectedProduct.unit)}
                {renderInfoRow(t('stock.vatRate'), `${String(selectedProduct.vatRate).replace('.', ',')}%`)}
                {isStockableType(selectedProduct.type) && (
                  <>
                    <View style={detailStyles.infoRow}>
                      <Text style={[detailStyles.infoLabel, { color: colors.textTertiary }]}>{t('stock.currentStock')}</Text>
                      <View style={[detailStyles.stockBadge, { backgroundColor: isLowStock ? colors.dangerLight : colors.successLight }]}>
                        <Text style={[detailStyles.stockText, { color: isLowStock ? colors.danger : colors.success }]}>{totalStock}</Text>
                      </View>
                    </View>
                    {renderInfoRow(t('stock.lowStockAlert'), String(selectedProduct.lowStockThreshold))}
                  </>
                )}
              </View>

              <View style={[detailStyles.variantsSection, { borderColor: colors.cardBorder }]}>
                <View style={detailStyles.variantsHeader}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                    <Layers size={16} color={colors.primary} />
                    <Text style={[detailStyles.variantsTitle, { color: colors.text }]}>
                      {t('stock.variants', { count: getUserVariants(selectedProduct.id).length })}
                    </Text>
                    {getUserVariants(selectedProduct.id).length > 0 && (
                      <View style={[detailStyles.variantCountBadge, { backgroundColor: `${colors.primary}15` }]}>
                        <Text style={[detailStyles.variantCountText, { color: colors.primary }]}>
                          {getUserVariants(selectedProduct.id).length}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={openVariantCreate} style={[detailStyles.addVariantBtn, { backgroundColor: colors.primaryLight }]}>
                    <Plus size={14} color={colors.primary} />
                    <Text style={[detailStyles.addVariantText, { color: colors.primary }]}>{t('stock.addVariant')}</Text>
                  </TouchableOpacity>
                </View>

                {getUserVariants(selectedProduct.id).length === 0 ? (
                  <View style={detailStyles.emptyVariants}>
                    <Layers size={28} color={colors.textTertiary} />
                    <Text style={[detailStyles.emptyVariantsText, { color: colors.textTertiary }]}>{t('stock.noVariants')}</Text>
                    <Text style={[detailStyles.emptyVariantsHint, { color: colors.textTertiary }]}>
                      {t('stock.noVariantsHint')}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 1 }}>
                    {!isMobile && (
                      <View style={[detailStyles.variantTableHeader, { backgroundColor: colors.surfaceHover }]}>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 1 }]}>{t('stock.attributes')}</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 1, textAlign: 'right' as const }]}>{t('stock.purchasePrice').toUpperCase()}</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 1, textAlign: 'right' as const }]}>{t('stock.salePrice').toUpperCase()}</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 0.6, textAlign: 'center' as const }]}>{t('stock.currentStock').toUpperCase()}</Text>
                        <Text style={[detailStyles.variantHeaderCell, { flex: 0.6, textAlign: 'right' as const }]}>{t('stock.actions').toUpperCase()}</Text>
                      </View>
                    )}
                    {/* Utilisation de getOrderedVariants pour afficher les variantes dans l'ordre défini */}
                    {getOrderedVariants(getUserVariants(selectedProduct.id)).map((v) => {
                      const hasAttrs = Object.keys(v.attributes).length > 0;
                      const attrLabel = hasAttrs
                        ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' — ')
                        : 'Variante par défaut';
                      const variantLowStock = v.stockQuantity <= (v.minStock || selectedProduct.lowStockThreshold);
                      // BDD stocke HT, reconverti en TTC pour l'affichage
                      const variantSaleTTC = v.salePrice * (1 + selectedProduct.vatRate / 100);
                      return (
                        <View key={v.id} style={[detailStyles.variantRow, { borderBottomColor: colors.borderLight }]}>
                          {isMobile ? (
                            <View style={{ flex: 1, gap: 4 }}>
                              {!hasAttrs && <Text style={[detailStyles.variantAttrText, { color: colors.text }]}>{attrLabel}</Text>}
                              <View style={{ flexDirection: 'row' as const, gap: 12, flexWrap: 'wrap' as const }}>
                                <Text style={{ fontSize: 11, color: colors.textTertiary }}>Achat HT: {formatCurrency(v.purchasePrice, cur)}</Text>
                                <Text style={{ fontSize: 11, color: colors.text, fontWeight: '600' as const }}>Vente TTC: {formatCurrency(variantSaleTTC, cur)}</Text>
                                <View style={[styles.stockBadge, { backgroundColor: variantLowStock ? colors.dangerLight : colors.successLight }]}>
                                  <Text style={[styles.stockText, { color: variantLowStock ? colors.danger : colors.success }]}>{v.stockQuantity}</Text>
                                </View>
                              </View>
                            </View>
                          ) : (
                            <>
                              <Text style={[detailStyles.variantAttrText, { flex: 1, color: colors.text }]} numberOfLines={1}>{attrLabel}</Text>
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
                            {(selectedProduct.type === 'produit_transforme' || selectedProduct.type === 'produit_fini') && hasAttrs && (
                              <TouchableOpacity
                                onPress={() => openRecipeEditor(selectedProduct.id, selectedProduct.name, v.id, attrLabel)}
                                style={[styles.iconBtn, { backgroundColor: getRecipeForProduct(selectedProduct.id, v.id) ? '#ECFDF5' : `${colors.primary}10` }]}
                              >
                                <ChefHat size={11} color={getRecipeForProduct(selectedProduct.id, v.id) ? '#059669' : colors.primary} />
                              </TouchableOpacity>
                            )}
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

              {(selectedProduct.type === 'produit_transforme' || selectedProduct.type === 'produit_fini') && getUserVariants(selectedProduct.id).length === 0 && (
                <View style={[detailStyles.variantsSection, { borderColor: colors.cardBorder, marginTop: 12 }]}>
                  <View style={detailStyles.variantsHeader}>
                    <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                      <ChefHat size={16} color={colors.primary} />
                      <Text style={[detailStyles.variantsTitle, { color: colors.text }]}>
                        {t('recipe.title')}
                      </Text>
                    </View>
                  </View>
                  {(() => {
                    const productRecipe = getRecipeForProduct(selectedProduct.id);
                    return (
                      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                        {productRecipe && productRecipe.items.length > 0 ? (
                          <View style={{ gap: 6 }}>
                            {productRecipe.items.map(item => (
                              <View key={item.id} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingVertical: 4 }}>
                                <Package size={12} color={colors.textTertiary} />
                                <Text style={{ flex: 1, fontSize: 12, color: colors.text }} numberOfLines={1}>
                                  {item.ingredientProductName}
                                  {item.ingredientVariantLabel ? ` (${item.ingredientVariantLabel})` : ''}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' as const }}>
                                  {item.quantity} {item.unit}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                            {t('recipe.noRecipe')}
                          </Text>
                        )}
                        <TouchableOpacity
                          style={[styles.iconBtn, { backgroundColor: productRecipe ? '#ECFDF5' : colors.primaryLight, flexDirection: 'row' as const, gap: 6, paddingHorizontal: 10, width: 'auto' as unknown as number }]}
                          onPress={() => openRecipeEditor(selectedProduct.id, selectedProduct.name)}
                        >
                          <ChefHat size={13} color={productRecipe ? '#059669' : colors.primary} />
                          <Text style={{ fontSize: 12, fontWeight: '600' as const, color: productRecipe ? '#059669' : colors.primary }}>
                            {productRecipe ? t('recipe.editRecipe') : t('recipe.addRecipe')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  /**
   * Modale d'ajout ou d'edition d'une variante individuelle depuis la fiche produit.
   * Le champ "Prix de vente" est en TTC, converti en HT dans handleSaveVariant.
   * A l'ouverture via openVariantEdit, le HT stocke est reconverti en TTC.
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
                {editingVariantId ? t('stock.editVariant') : t('stock.addVariant')}
              </Text>
              <TouchableOpacity onPress={() => { setVariantFormVisible(false); setEditingVariantId(null); }} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
              <Text style={[variantStyles.sectionLabel, { color: colors.textSecondary }]}>{t('stock.attributes')}</Text>
              {variantForm.attributes.map((attr, idx) => (
                <View key={idx} style={variantStyles.attrRow}>
                  <View style={{ flex: 1 }}>
                    <DropdownPicker
                      label={t('stock.selectAttribute')} value={attr.key}
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
                    <FormField label={t('stock.selectValue')} value={attr.value}
                      onChangeText={(t) => {
                        const updated = [...variantForm.attributes];
                        updated[idx] = { ...updated[idx], value: t };
                        setVariantForm((f) => ({ ...f, attributes: updated }));
                      }}
                      placeholder={t('stock.selectValue')}
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
                <Text style={[variantStyles.addAttrText, { color: colors.primary }]}>{t('stock.addAttribute')}</Text>
              </TouchableOpacity>

              <FormField label={t('stock.variantSku')} value={variantForm.sku}
                onChangeText={(t) => setVariantForm((f) => ({ ...f, sku: t }))} placeholder="SKU-001-XL" />
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <FormField label={t('stock.variantPurchasePrice')} value={variantForm.purchasePrice}
                    onChangeText={(t) => setVariantForm((f) => ({ ...f, purchasePrice: t }))} placeholder="0.00" keyboardType="decimal-pad" />
                </View>
                <View style={styles.formCol}>
                  {/* Prix de vente TTC, converti en HT a l'enregistrement */}
                  <FormField label={t('stock.variantSalePrice')} value={variantForm.salePrice}
                    onChangeText={(t) => setVariantForm((f) => ({ ...f, salePrice: t }))} placeholder="0.00" keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <FormField label={t('stock.variantStock')} value={variantForm.stock}
                    onChangeText={(t) => setVariantForm((f) => ({ ...f, stock: t }))} placeholder="0" keyboardType="numeric" />
                </View>
                <View style={styles.formCol}>
                  <FormField label={t('stock.variantMinStock')} value={variantForm.minStock}
                    onChangeText={(t) => setVariantForm((f) => ({ ...f, minStock: t }))} placeholder="0" keyboardType="numeric" />
                </View>
              </View>
            </ScrollView>
            <View style={[stepStyles.formFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[stepStyles.cancelBtn, { borderColor: colors.border }]} onPress={() => { setVariantFormVisible(false); setEditingVariantId(null); }}>
                <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>{t('stock.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleSaveVariant}>
                <Text style={stepStyles.nextBtnText}>{editingVariantId ? t('stock.update') : t('stock.addVariant')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  /**
   * Modale multi-etapes de creation ou d'edition d'un produit.
   * Navigation : etape 1 (infos) -> etape 2 (attributs) -> etape 3 (variantes et prix).
   * Bouton de sauvegarde rapide disponible aux etapes 1 et 2.
   */
  const renderFormModal = () => {
    if (!formVisible) return null;
    const isEditing = !!editingId;
    const stepTitle = formStep === 1 ? t('stock.step1Title') : formStep === 2 ? t('stock.step2Title') : formStep === 3 ? t('stock.step3Title') : t('recipe.step4Title');
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
                if (!editProduct) return null;
                const isAvailable = editProduct.isAvailableForSale !== false;
                return (
                  <>
                    <TouchableOpacity
                      onPress={handleDuplicateProduct}
                      style={[detailStyles.editBtn, { backgroundColor: '#E8F5E9' }]}
                      hitSlop={8}
                    >
                      <Copy size={14} color="#2E7D32" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        updateProduct(editingId, { isAvailableForSale: !isAvailable } as Partial<Product>);
                      }}
                      style={[detailStyles.editBtn, { backgroundColor: isAvailable ? colors.successLight : colors.dangerLight }]}
                      hitSlop={8}
                    >
                      {isAvailable ? <Eye size={14} color={colors.success} /> : <EyeOff size={14} color={colors.danger} />}
                    </TouchableOpacity>
                    {editProduct.isArchived || !editProduct.isActive ? (
                      <TouchableOpacity
                        onPress={() => { unarchiveProduct(editingId); setFormVisible(false); }}
                        style={[detailStyles.editBtn, { backgroundColor: colors.successLight }]}
                        hitSlop={8}
                      >
                        <Archive size={14} color={colors.success} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => { archiveProduct(editingId); setFormVisible(false); }}
                        style={[detailStyles.editBtn, { backgroundColor: colors.warningLight || '#FEF3C7' }]}
                        hitSlop={8}
                      >
                        <Archive size={14} color={colors.warning || '#D97706'} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        confirm('Supprimer', `Supprimer définitivement « ${editProduct.name} » et toutes ses variantes ?`, [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: () => { deleteProduct(editingId); setFormVisible(false); } },
                        ]);
                      }}
                      style={[detailStyles.editBtn, { backgroundColor: colors.dangerLight }]}
                      hitSlop={8}
                    >
                      <Trash2 size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </>
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
              {formStep === 4 && renderStep4()}
            </View>

            <View style={[stepStyles.formFooter, { borderTopColor: colors.border }]}>
              {formStep > 1 ? (
                <TouchableOpacity style={[stepStyles.cancelBtn, { borderColor: colors.border }]} onPress={handlePrevStep}>
                  <ChevronLeft size={14} color={colors.textSecondary} />
                  <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>{t('stock.back')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[stepStyles.cancelBtn, { borderColor: colors.border }]} onPress={() => setFormVisible(false)}>
                  <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>{t('stock.cancel')}</Text>
                </TouchableOpacity>
              )}
              <View style={{ flexDirection: 'row' as const, gap: 8 }}>
                {(formStep === 1 || formStep === 2) && (
                  <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.success }]} onPress={handleQuickSave}>
                    <Check size={14} color="#FFF" />
                    <Text style={stepStyles.nextBtnText}>{t('stock.save')}</Text>
                  </TouchableOpacity>
                )}
                {(() => {
                  const isLastStep = isTransformedType ? formStep === 4 : formStep === 3;
                  if (isLastStep) {
                    return (
                      <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleFinalSubmit}>
                        <Check size={14} color="#FFF" />
                        <Text style={stepStyles.nextBtnText}>{isEditing ? t('stock.update') : t('stock.create')}</Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleNextStep}>
                      <Text style={stepStyles.nextBtnText}>{t('stock.next')}</Text>
                      <ChevronRight size={14} color="#FFF" />
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const [showAttrMgmtNewForm, setShowAttrMgmtNewForm] = useState(false);

  /**
   * Deplace une valeur d'un attribut vers la gauche dans son tableau de valeurs.
   * Ne fait rien si la valeur est deja en premiere position.
   */
  const moveAttributeValueLeft = useCallback((attrId: string, index: number) => {
    if (index === 0) return;
    const attr = productAttributes.find(a => a.id === attrId);
    if (!attr) return;
    const newValues = [...attr.values];
    // Echange l'element avec son voisin de gauche
    [newValues[index - 1], newValues[index]] = [newValues[index], newValues[index - 1]];
    updateAttributeValuesOrder(attrId, newValues);
  }, [productAttributes, updateAttributeValuesOrder]);

  /**
   * Deplace une valeur d'un attribut vers la droite dans son tableau de valeurs.
   * Ne fait rien si la valeur est deja en derniere position.
   */
  const moveAttributeValueRight = useCallback((attrId: string, index: number) => {
    const attr = productAttributes.find(a => a.id === attrId);
    if (!attr) return;
    if (index >= attr.values.length - 1) return;
    const newValues = [...attr.values];
    // Echange l'element avec son voisin de droite
    [newValues[index], newValues[index + 1]] = [newValues[index + 1], newValues[index]];
    updateAttributeValuesOrder(attrId, newValues);
  }, [productAttributes, updateAttributeValuesOrder]);

  /**
   * Onglet "Attributs" : gestion des groupes d'attributs globaux (Taille, Couleur, etc.).
   * Ces attributs sont partages entre tous les produits et servent a generer les variantes.
   *
   * Chaque valeur d'un attribut peut etre reordonnee via les boutons fleches gauche / droite.
   * Ce systeme remplace le drag and drop qui entrait en conflit avec le ScrollView parent.
   *
   * CRUD disponible : creation de groupe, renommage, suppression de groupe,
   * ajout de valeur, suppression de valeur, reordonnancement de valeurs.
   */
  const renderAttributesTab = () => (
    <View style={{ gap: 16 }}>
      {productAttributes.length === 0 && !showAttrMgmtNewForm ? (
        <View style={attrMgmtStyles.empty}>
          <Tags size={32} color={colors.textTertiary} />
          <Text style={[attrMgmtStyles.emptyText, { color: colors.textSecondary }]}>{t('stock.noAttributes')}</Text>
          <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' as const, marginTop: 4 }}>
            {t('stock.noAttributesHint')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {productAttributes.map(attr => (
            <View key={attr.id} style={[attrMgmtStyles.attrCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>

              {/* En-tete de la carte attribut : nom, boutons renommer et supprimer */}
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
                <Text style={[attrMgmtStyles.attrCount, { color: colors.textTertiary }]}>
                  {attr.values.length} valeur{attr.values.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  onPress={() => { setAttrMgmtRenamingId(attr.id); setAttrMgmtRenameValue(attr.name); }}
                  style={[attrMgmtStyles.editBtn, { backgroundColor: colors.primaryLight }]}
                  hitSlop={8}
                >
                  <Pencil size={12} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    confirm(t('stock.deleteAttribute'), t('stock.deleteAttributeConfirm', { name: attr.name }), [
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

              {/*
                Liste des valeurs de l'attribut avec boutons de reordonnancement.
                Chaque chip affiche la valeur, un bouton gauche, un bouton droite
                et un bouton de suppression.
                Les boutons gauche / droite sont desactives aux extremites de la liste.
              */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={attrMgmtStyles.valuesRow}
              >
                {attr.values.map((item, index) => (
                  <View
                    key={`${attr.id}_${item}_${index}`}
                    style={[
                      attrMgmtStyles.valueChip,
                      {
                        backgroundColor: `${colors.primary}10`,
                        borderColor: `${colors.primary}30`,
                      },
                    ]}
                  >
                    {/* Bouton de deplacement vers la gauche, desactive en premiere position */}
                    <TouchableOpacity
                      onPress={() => moveAttributeValueLeft(attr.id, index)}
                      disabled={index === 0}
                      hitSlop={4}
                      style={[
                        attrMgmtStyles.reorderBtn,
                        { opacity: index === 0 ? 0.25 : 1 },
                      ]}
                    >
                      <ChevronLeft size={12} color={colors.primary} />
                    </TouchableOpacity>

                    <Text style={[attrMgmtStyles.valueText, { color: colors.text }]}>{item}</Text>

                    {/* Bouton de deplacement vers la droite, desactive en derniere position */}
                    <TouchableOpacity
                      onPress={() => moveAttributeValueRight(attr.id, index)}
                      disabled={index === attr.values.length - 1}
                      hitSlop={4}
                      style={[
                        attrMgmtStyles.reorderBtn,
                        { opacity: index === attr.values.length - 1 ? 0.25 : 1 },
                      ]}
                    >
                      <ChevronRight size={12} color={colors.primary} />
                    </TouchableOpacity>

                    {/* Bouton de suppression de la valeur */}
                    <TouchableOpacity
                      onPress={() => removeAttributeValue(attr.id, item)}
                      hitSlop={4}
                      style={attrMgmtStyles.removeBtn}
                    >
                      <X size={11} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              {/* Formulaire inline d'ajout d'une nouvelle valeur a l'attribut */}
              {attrMgmtEditingId === attr.id ? (
                <View style={attrMgmtStyles.inlineAddRow}>
                  <TextInput
                    style={[attrMgmtStyles.inlineInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                    value={attrMgmtNewValueInput}
                    onChangeText={setAttrMgmtNewValueInput}
                    placeholder={t('stock.selectValue')}
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
          ))}
        </View>
      )}

      {/* Formulaire de creation d'un nouveau groupe d'attributs */}
      {showAttrMgmtNewForm ? (
        <View style={[attrMgmtStyles.newGroupCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={[attrMgmtStyles.newGroupTitle, { color: colors.text }]}>{t('stock.newAttributeGroup')}</Text>
          <TextInput
            style={[attrMgmtStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={attrMgmtNewName}
            onChangeText={setAttrMgmtNewName}
            placeholder={t('stock.attributeGroupName')}
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

  // ---------- RENDU PRINCIPAL ----------
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!embedded && (
        <PageHeader
          title={t('stock.productsServices')}
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
                      { key: 'categoryName', label: 'Catégorie' },
                      { key: 'brand', label: 'Marque' },
                      { key: 'salePrice', label: 'Prix vente' },
                      { key: 'purchasePrice', label: 'Prix achat' },
                      { key: 'stockQuantity', label: 'Stock' },
                      { key: 'lowStockThreshold', label: 'Stock min' },
                      { key: 'unit', label: 'Unité' },
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

      {/* Barre de sous-onglets : Catalogue / Attributs */}
      <View style={[subTabStyles.bar, { borderBottomColor: colors.border }]}>
        <View style={subTabStyles.tabsRow}>
          <TouchableOpacity
            style={[subTabStyles.tab, subTab === 'catalogue' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setSubTab('catalogue')}
            activeOpacity={0.7}
          >
            <Package size={15} color={subTab === 'catalogue' ? colors.primary : colors.textTertiary} />
            <Text style={[subTabStyles.tabText, { color: subTab === 'catalogue' ? colors.primary : colors.textSecondary }]}>{t('stock.products')} ({totalProducts})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[subTabStyles.tab, subTab === 'attributes' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setSubTab('attributes')}
            activeOpacity={0.7}
          >
            <Tags size={15} color={subTab === 'attributes' ? colors.primary : colors.textTertiary} />
            <Text style={[subTabStyles.tabText, { color: subTab === 'attributes' ? colors.primary : colors.textSecondary }]}>{t('stock.attributes')}</Text>
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
                  { key: 'categoryName', label: 'Catégorie' },
                  { key: 'salePrice', label: 'Prix vente' },
                  { key: 'purchasePrice', label: 'Prix achat' },
                  { key: 'stockQuantity', label: 'Stock' },
                  { key: 'unit', label: 'Unité' },
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
          {/* Barre de filtres : recherche, tri, type, categorie, mode d'affichage, archives */}
          <View style={styles.filterBar}>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1, minWidth: 140 }]}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('stock.search')}
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
              options={[{ label: t('stock.allTypes'), value: '' }, ...TYPE_OPTIONS]}
              onSelect={(v) => setSelectedTypeFilter(v || null)}
              placeholder={t('stock.productType')}
              compact
            />

            {allCategories.length > 1 && (
              <DropdownPicker
                label="" value={selectedCategoryFilter || ''}
                options={[{ label: t('stock.allCategories'), value: '' }, ...allCategories.map((c) => ({ label: c, value: c }))]}
                onSelect={(v) => setSelectedCategoryFilter(v || null)}
                placeholder={t('stock.productCategory')}
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
                {search ? t('stock.noResults') : t('stock.noProducts')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                {search ? t('stock.tryDifferentSearch') : t('stock.noProductsHint')}
              </Text>
            </View>
          )}

          {/* Affichage en grille ou en liste selon le mode selectionne */}
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
                            confirm(product.name, 'Que souhaitez-vous faire ?', [
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
                              width: isMobile ? '47%' as unknown as number : '15%' as unknown as number,
                            },
                          ]}
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
                        confirm(product.name, 'Que souhaitez-vous faire ?', [
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
                            <Text style={[styles.typeBadgeInlineText, { color: typeConfig.color }]}>{t(typeConfig.labelKey)}</Text>
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
                          <Text style={[styles.typeBadgeInlineText, { color: typeConfig.color }]}>{t(typeConfig.labelKey)}</Text>
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
                          <Text style={[styles.colHeaderText, { flex: 2.5 }]}>{t('stock.productName').toUpperCase()}</Text>
                          <Text style={[styles.colHeaderText, { flex: 1, textAlign: 'center' as const }]}>{t('stock.productType').toUpperCase()}</Text>
                          <Text style={[styles.colHeaderText, { flex: 1 }]}>{t('stock.productCategory').toUpperCase()}</Text>
                          <Text style={[styles.colHeaderText, { flex: 1, textAlign: 'right' as const }]}>{t('stock.salePrice').toUpperCase()}</Text>
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

      <RecipeEditor
        visible={recipeEditorVisible}
        onClose={() => setRecipeEditorVisible(false)}
        productId={recipeEditorProductId}
        variantId={recipeEditorVariantId}
        productName={recipeEditorProductName}
        variantLabel={recipeEditorVariantLabel}
        onRecipeSaved={(totalCost) => {
          if (recipeEditorVariantId) {
            const variant = getVariantsForProduct(recipeEditorProductId).find(v => v.id === recipeEditorVariantId);
            if (variant) {
              updateVariantFn(recipeEditorVariantId, { purchasePrice: totalCost }, { silent: true });
            }
          } else {
            updateProduct(recipeEditorProductId, { purchasePrice: totalCost });
          }
        }}
      />

      <ConfirmModal
        visible={archiveConfirm !== null}
        onClose={() => setArchiveConfirm(null)}
        onConfirm={handleArchive}
        title={t('stock.archiveProductConfirm')}
        message={t('stock.archiveProductMessage')}
        confirmLabel={t('stock.archiveProduct')}
        destructive
      />

      <ConfirmModal
        visible={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={t('stock.deleteProductConfirm')}
        message={t('stock.deleteProductMessage')}
        confirmLabel={t('stock.deleteProduct')}
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

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

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
    flexDirection: 'row' as const, alignItems: 'flex-start' as const,
    gap: 10, padding: 12, borderRadius: 10, borderWidth: 1,
  },
  dupWarningText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  dupWarningLink: { marginTop: 6 },
  dupWarningLinkText: { fontSize: 12, fontWeight: '600' as const, color: '#1D4ED8', textDecorationLine: 'underline' as const },
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
  tabsRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  actionsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
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
  viewToggle: { flexDirection: 'row' as const, borderRadius: 8, overflow: 'hidden' as const },
  viewToggleBtn: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 8 },
  gridContainer: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, marginBottom: 20 },
  productTile: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  tileImage: { width: '100%' as unknown as number, height: 80 },
  tilePlaceholder: { width: '100%' as unknown as number, height: 60, alignItems: 'center' as const, justifyContent: 'center' as const },
  tileBody: { padding: 8, gap: 3 },
  tileCatBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start' as const },
  tileCatBadgeText: { fontSize: 9, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  tileName: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
  tilePrice: { fontSize: 13, fontWeight: '700' as const, marginTop: 2 },
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

  // Conteneur scrollable horizontal des chips de valeurs
  valuesRow: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
    paddingVertical: 4,
  },

  // Chip d'une valeur d'attribut avec ses boutons de reordonnancement et de suppression
  valueChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },

  // Texte de la valeur dans le chip
  valueText: { fontSize: 12, fontWeight: '500' as const, paddingHorizontal: 2 },

  // Bouton de reordonnancement (gauche ou droite), partagé entre les deux directions
  reorderBtn: {
    padding: 3,
    borderRadius: 4,
  },

  // Bouton de suppression de la valeur, separe visuellement du reste du chip
  removeBtn: {
    padding: 3,
    marginLeft: 2,
  },

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