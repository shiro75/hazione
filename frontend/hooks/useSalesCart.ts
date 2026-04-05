/**
 * @fileoverview Hook managing POS cart state, product filtering, client selection, and discounts.
 * @hook useSalesCart
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useData } from '@/contexts/DataContext';
import { useOffline } from '@/contexts/OfflineContext';
import { SALES_ALLOWED_TYPES, isStockableType } from '@/constants/productTypes';
import type { VATRate, ProductVariant } from '@/types';
import type { POSCartItem } from '@/types/sales.types';

export const useSalesCart = () => {
  const {
    activeProducts, activeClients, getProductStock, getVariantsForProduct,
    findProductByBarcode, company, discountCategories, discountCategoryRates,
    addDiscountCategory, productAttributes, showToast,
  } = useData();
  const { isOnline, cachedProducts, cachedClients, cachedCompany } = useOffline();

  const effectiveProducts = isOnline ? activeProducts : (activeProducts.length > 0 ? activeProducts : cachedProducts.filter(p => !p.isArchived && p.isActive));
  const effectiveClients = isOnline ? activeClients : (activeClients.length > 0 ? activeClients : cachedClients.filter(c => !c.isDeleted));
  const effectiveCompany = company?.name ? company : (cachedCompany ?? company);
  const cur = effectiveCompany.currency || 'EUR';

  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [posViewMode, setPosViewModeState] = useState<'grid' | 'list' | 'compact'>('grid');
  const expandedRef = useRef<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [variantPickerProductId, setVariantPickerProductId] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedDiscount, setSelectedDiscount] = useState<string>('');
  const [isClientDiscount, setIsClientDiscount] = useState(false);
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const [newDiscountName, setNewDiscountName] = useState('');
  const [newDiscountRate, setNewDiscountRate] = useState('');

  const [barcodeInput, setBarcodeInput] = useState('');
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualVat, setManualVat] = useState('20');
  const [showMobileCart, setShowMobileCart] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@pos_view_mode').then((stored) => {
      if (stored === 'grid' || stored === 'list' || stored === 'compact') setPosViewModeState(stored);
    }).catch(() => {});
  }, []);

  const setPosViewMode = useCallback((mode: 'grid' | 'list' | 'compact') => {
    setPosViewModeState(mode);
    AsyncStorage.setItem('@pos_view_mode', mode).catch(() => {});
  }, []);

  const salesProducts = useMemo(() =>
    effectiveProducts.filter((p) => SALES_ALLOWED_TYPES.includes(p.type) && p.isAvailableForSale !== false),
    [effectiveProducts]
  );

  const categoryData = useMemo(() => {
    const catMap = new Map<string, { name: string; count: number }>();
    salesProducts.forEach((p) => {
      const catName = p.categoryName || 'Autres';
      const existing = catMap.get(catName);
      if (existing) existing.count += 1;
      else catMap.set(catName, { name: catName, count: 1 });
    });
    return Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [salesProducts]);

  const filteredProducts = useMemo(() => {
    let list = salesProducts;
    if (selectedCategoryFilter) {
      list = list.filter((p) => (p.categoryName || 'Autres') === selectedCategoryFilter);
    }
    if (productSearch) {
      const q = productSearch.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [productSearch, salesProducts, selectedCategoryFilter]);

  const groupedFilteredProducts = useMemo(() => {
    const groups: { category: string; items: typeof filteredProducts }[] = [];
    const map = new Map<string, typeof filteredProducts>();
    filteredProducts.forEach((p) => {
      const cat = p.categoryName || 'Autres';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    for (const [cat, items] of map) groups.push({ category: cat, items });
    groups.sort((a, b) => a.category.localeCompare(b.category));
    return groups;
  }, [filteredProducts]);

  const variantPickerProduct = useMemo(() => {
    if (!variantPickerProductId) return null;
    return effectiveProducts.find((p) => p.id === variantPickerProductId) ?? null;
  }, [variantPickerProductId, effectiveProducts]);

  const variantPickerVariants = useMemo(() => {
    if (!variantPickerProductId) return [];
    return getVariantsForProduct(variantPickerProductId);
  }, [variantPickerProductId, getVariantsForProduct]);

  const discountRate = useMemo(() => {
    if (selectedDiscount && discountCategoryRates[selectedDiscount]) return discountCategoryRates[selectedDiscount];
    return 0;
  }, [selectedDiscount, discountCategoryRates]);

  const cartTotals = useMemo(() => {
    let totalHT = 0, totalTVA = 0, totalTTC = 0;
    cart.forEach((item) => {
      const lineHT = item.unitPrice * item.quantity;
      const lineTVA = lineHT * (item.vatRate / 100);
      totalHT += lineHT; totalTVA += lineTVA; totalTTC += lineHT + lineTVA;
    });
    if (discountRate > 0) {
      const dm = 1 - discountRate / 100;
      totalHT *= dm; totalTVA *= dm; totalTTC *= dm;
    }
    return { totalHT: Math.round(totalHT * 100) / 100, totalTVA: Math.round(totalTVA * 100) / 100, totalTTC: Math.round(totalTTC * 100) / 100 };
  }, [cart, discountRate]);

  const cartItemCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);

  const addToCart = useCallback((productId: string, variant?: ProductVariant) => {
    const product = effectiveProducts.find((p) => p.id === productId);
    if (!product) return;
    const price = variant?.salePrice || product.salePrice;
    const variantLabel = variant ? Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(' / ') : undefined;
    setCart((prev) => {
      const existing = prev.find((c) => {
        if (variant) return c.productId === productId && c.variantId === variant.id;
        return c.productId === productId && !c.variantId;
      });
      if (existing) {
        return prev.map((c) => {
          if (variant) return (c.productId === productId && c.variantId === variant.id) ? { ...c, quantity: c.quantity + 1 } : c;
          return (c.productId === productId && !c.variantId) ? { ...c, quantity: c.quantity + 1 } : c;
        });
      }
      return [...prev, { productId: product.id, productName: product.name, variantId: variant?.id, variantLabel, quantity: 1, unitPrice: price, vatRate: product.vatRate }];
    });
  }, [effectiveProducts]);

  const handleProductTap = useCallback((productId: string) => {
    const product = effectiveProducts.find((p) => p.id === productId);
    if (!product) return;
    const productVariants = getVariantsForProduct(productId);
    if (productVariants.length > 0 && Object.keys(productVariants[0].attributes).length > 0) {
      const newExpanded = expandedRef.current === productId ? null : productId;
      expandedRef.current = newExpanded;
      setExpandedProductId(newExpanded);
    } else if (productVariants.length > 0) {
      addToCart(productId, productVariants[0]);
    } else {
      addToCart(productId);
    }
  }, [getVariantsForProduct, addToCart, effectiveProducts]);

  const updateCartQuantity = useCallback((productId: string, delta: number, variantId?: string) => {
    setCart((prev) => {
      const updated = prev.map((c) => {
        const match = variantId ? (c.productId === productId && c.variantId === variantId) : (c.productId === productId && !c.variantId);
        if (match) { const newQty = c.quantity + delta; return newQty > 0 ? { ...c, quantity: newQty } : c; }
        return c;
      });
      return updated.filter((c) => c.quantity > 0);
    });
  }, []);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    setCart((prev) => prev.filter((c) => {
      if (variantId) return !(c.productId === productId && c.variantId === variantId);
      return !(c.productId === productId && !c.variantId);
    }));
  }, []);

  const handleSelectClient = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setShowClientPicker(false);
    setClientSearch('');
    const client = effectiveClients.find(c => c.id === clientId);
    if (client?.discountCategory) {
      setSelectedDiscount(client.discountCategory);
      setIsClientDiscount(true);
    } else if (client?.discountPercent && client.discountPercent > 0) {
      setSelectedDiscount('');
      setIsClientDiscount(false);
    } else {
      if (isClientDiscount) { setSelectedDiscount(''); setIsClientDiscount(false); }
    }
  }, [effectiveClients, isClientDiscount]);

  const handleRemoveClient = useCallback(() => {
    setSelectedClientId('');
    if (isClientDiscount) { setSelectedDiscount(''); setIsClientDiscount(false); }
    setShowClientPicker(false);
    setClientSearch('');
  }, [isClientDiscount]);

  const handleAddNewDiscount = useCallback(() => {
    const name = newDiscountName.trim();
    const rate = parseFloat(newDiscountRate.replace(',', '.'));
    if (!name || isNaN(rate) || rate <= 0 || rate > 100) return;
    addDiscountCategory(name, rate);
    setSelectedDiscount(name);
    setNewDiscountName('');
    setNewDiscountRate('');
    setShowDiscountPicker(false);
  }, [newDiscountName, newDiscountRate, addDiscountCategory]);

  const handleBarcodeSubmit = useCallback(() => {
    if (!barcodeInput.trim()) return;
    const product = findProductByBarcode(barcodeInput.trim());
    if (product) {
      const productVariants = getVariantsForProduct(product.id);
      if (productVariants.length > 0) addToCart(product.id, productVariants[0]);
      else addToCart(product.id);
      showToast(`${product.name} ajouté au panier`);
    } else {
      showToast('Aucun produit trouvé avec ce code-barres', 'error');
    }
    setBarcodeInput('');
  }, [barcodeInput, findProductByBarcode, getVariantsForProduct, addToCart, showToast]);

  const handleManualEntry = useCallback(() => {
    if (!manualName.trim() || !manualPrice.trim()) return;
    const price = parseFloat(manualPrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) return;
    const vat = parseFloat(manualVat) as VATRate;
    setCart((prev) => [...prev, { productId: `manual_${Date.now()}`, productName: manualName.trim(), quantity: 1, unitPrice: price, vatRate: vat }]);
    setManualName('');
    setManualPrice('');
    setManualEntryVisible(false);
  }, [manualName, manualPrice, manualVat]);

  const filteredClientsForPicker = useMemo(() => {
    if (!clientSearch) return effectiveClients.slice(0, 10);
    const q = clientSearch.toLowerCase();
    return effectiveClients.filter(
      (c) => (c.companyName && c.companyName.toLowerCase().includes(q)) || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [clientSearch, effectiveClients]);

  const getCategoryColor = useCallback((name: string) => {
    const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1', '#84CC16', '#E11D48', '#0EA5E9', '#A855F7', '#D946EF'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }, []);

  const resetCartState = useCallback(() => {
    setCart([]);
    setSelectedClientId('');
    setSelectedDiscount('');
    setIsClientDiscount(false);
    setShowMobileCart(false);
  }, []);

  return {
    effectiveProducts, effectiveClients, effectiveCompany, cur,
    cart, setCart, cartTotals, cartItemCount,
    productSearch, setProductSearch,
    selectedCategoryFilter, setSelectedCategoryFilter,
    posViewMode, setPosViewMode,
    expandedProductId, setExpandedProductId,
    variantPickerProductId, setVariantPickerProductId,
    variantPickerProduct, variantPickerVariants,
    selectedClientId, setSelectedClientId,
    showClientPicker, setShowClientPicker,
    clientSearch, setClientSearch,
    selectedDiscount, setSelectedDiscount,
    isClientDiscount,
    showDiscountPicker, setShowDiscountPicker,
    newDiscountName, setNewDiscountName,
    newDiscountRate, setNewDiscountRate,
    barcodeInput, setBarcodeInput,
    manualEntryVisible, setManualEntryVisible,
    manualName, setManualName,
    manualPrice, setManualPrice,
    manualVat, setManualVat,
    showMobileCart, setShowMobileCart,
    salesProducts, categoryData, filteredProducts, groupedFilteredProducts,
    discountRate, discountCategories, discountCategoryRates,
    filteredClientsForPicker,
    addToCart, handleProductTap, updateCartQuantity, removeFromCart,
    handleSelectClient, handleRemoveClient, handleAddNewDiscount,
    handleBarcodeSubmit, handleManualEntry,
    getCategoryColor, resetCartState,
    getVariantsForProduct, getProductStock, productAttributes,
    isStockableType,
  };
};
