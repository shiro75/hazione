/**
 * hooks/usePOSCart.ts
 *
 * Centralise tout le state et la logique du panier POS.
 *
 * RESPONSABILITÉS :
 *   - Gestion du panier (ajout, retrait, quantités)
 *   - Calcul des totaux HT/TVA/TTC avec remise
 *   - Sélection client et remise
 *   - Finalisation de vente (online et offline)
 *   - Validation du paiement
 *   - Saisie manuelle d'articles
 *   - Scan code-barres
 *   - Paiement CinetPay
 *
 * CONVENTION PRIX :
 *   Les prix des produits sont stockés en HT dans la BDD.
 *   L'affichage au POS se fait en TTC (salePrice * (1 + vatRate/100)).
 *   Les SaleItems stockent à la fois HT et TTC.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import type {
  SaleItem, SalePaymentMethod, MixedPaymentEntry, VATRate, ProductVariant,
} from '@/types';
import type {
  PaymentCategory, DigitalSubMethod, POSCartItem, CinetPayState,
} from '@/types/sales.types';
import {
  generateItemId, isDigitalMethod,
} from '@/constants/paymentMethods';
import { createCinetPayPayment } from '@/services/paymentService';

// ─── Types ────────────────────────────────────────────────────────────────────

type CartItem = POSCartItem;

interface UsePOSCartOptions {
  effectiveProducts: any[];
  effectiveClients: any[];
  effectiveCompany: any;
  discountCategories: string[];
  discountCategoryRates: Record<string, number>;
  addDiscountCategory: (name: string, rate: number) => void;
  getVariantsForProduct: (id: string) => ProductVariant[];
  findProductByBarcode: (barcode: string) => any;
  getProductStock: (id: string) => number;
  createSale: (items: SaleItem[], payment: SalePaymentMethod, clientId?: string, extra?: any) => { success: boolean; saleId?: string; error?: string };
  queueOfflineSale: (sale: any) => Promise<void>;
  showToast: (msg: string, type?: 'error' | 'success') => void;
  isOnline: boolean;
  companyId: string;
  t: (key: string) => string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePOSCart({
  effectiveProducts, effectiveClients, effectiveCompany,
  discountCategories, discountCategoryRates, addDiscountCategory,
  getVariantsForProduct, findProductByBarcode, getProductStock,
  createSale, queueOfflineSale, showToast, isOnline, companyId, t,
}: UsePOSCartOptions) {

  // ── Panier ──────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedDiscount, setSelectedDiscount] = useState('');
  const [isClientDiscount, setIsClientDiscount] = useState(false);

  // ── Paiement ────────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory>('card');
  const [digitalSubMethod, setDigitalSubMethod] = useState<DigitalSubMethod>('mobile_wave');
  const [tpeConnecting, setTpeConnecting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cashGiven, setCashGiven] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [mobileRef, setMobileRef] = useState('');
  const [mixedMethod1, setMixedMethod1] = useState<SalePaymentMethod>('cash');
  const [mixedMethod2, setMixedMethod2] = useState<SalePaymentMethod>('mobile_wave');
  const [mixedAmount1, setMixedAmount1] = useState('');
  const [mixedAmount2, setMixedAmount2] = useState('');

  // ── UI divers ───────────────────────────────────────────────────────────────
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const [newDiscountName, setNewDiscountName] = useState('');
  const [newDiscountRate, setNewDiscountRate] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualVat, setManualVat] = useState('20');
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [confirmSale, setConfirmSale] = useState<string | null>(null);

  // ── Variantes ───────────────────────────────────────────────────────────────
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const expandedRef = useRef<string | null>(null);

  // ── CinetPay ────────────────────────────────────────────────────────────────
  const [cinetpay, setCinetpay] = useState<CinetPayState>({
    active: false, loading: false, transactionId: null, paymentUrl: null,
  });

  // ── Animation checkout ──────────────────────────────────────────────────────
  const checkoutAnim = useRef(new Animated.Value(1)).current;

  // ── Paiement sélectionné ─────────────────────────────────────────────────

  const selectedPayment: SalePaymentMethod = useMemo(() => {
    if (selectedCategory === 'digital') return digitalSubMethod;
    return selectedCategory;
  }, [selectedCategory, digitalSubMethod]);

  // ── Taux de remise ─────────────────────────────────────────────────────────

  const discountRate = useMemo(() => {
    if (selectedDiscount && discountCategoryRates[selectedDiscount]) {
      return discountCategoryRates[selectedDiscount];
    }
    return 0;
  }, [selectedDiscount, discountCategoryRates]);

  // ── Totaux du panier ────────────────────────────────────────────────────────

  const cartTotals = useMemo(() => {
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    cart.forEach((item) => {
      const lineHT = item.unitPrice * item.quantity;
      const lineTVA = lineHT * (item.vatRate / 100);
      totalHT += lineHT;
      totalTVA += lineTVA;
      totalTTC += lineHT + lineTVA;
    });
    if (discountRate > 0) {
      const m = 1 - discountRate / 100;
      totalHT = totalHT * m;
      totalTVA = totalTVA * m;
      totalTTC = totalTTC * m;
    }
    return {
      totalHT: Math.round(totalHT * 100) / 100,
      totalTVA: Math.round(totalTVA * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100,
    };
  }, [cart, discountRate]);

  const cartItemCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);

  // ── Validation du paiement ─────────────────────────────────────────────────

  const isPaymentValid = useMemo(() => {
    if (selectedCategory === 'cash') {
      const given = parseFloat(cashGiven.replace(',', '.'));
      return !isNaN(given) && given >= cartTotals.totalTTC;
    }
    if (selectedCategory === 'card') return true;
    if (selectedCategory === 'digital') return mobilePhone.trim().length > 0;
    if (selectedCategory === 'mixed') {
      const a1 = parseFloat(mixedAmount1.replace(',', '.')) || 0;
      const a2 = parseFloat(mixedAmount2.replace(',', '.')) || 0;
      return Math.abs(a1 + a2 - cartTotals.totalTTC) < 0.01;
    }
    return true;
  }, [selectedCategory, cashGiven, mobilePhone, mixedAmount1, mixedAmount2, cartTotals.totalTTC]);

  const cashChange = useMemo(() => {
    const given = parseFloat(cashGiven.replace(',', '.'));
    if (isNaN(given) || given < cartTotals.totalTTC) return 0;
    return given - cartTotals.totalTTC;
  }, [cashGiven, cartTotals.totalTTC]);

  // ── Clients filtrés pour le picker ─────────────────────────────────────────

  const filteredClientsForPicker = useMemo(() => {
    if (!clientSearch) return effectiveClients.slice(0, 10);
    const q = clientSearch.toLowerCase();
    return effectiveClients.filter(
      (c: any) =>
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
    ).slice(0, 10);
  }, [clientSearch, effectiveClients]);

  // ── Actions panier ─────────────────────────────────────────────────────────

  /** Réinitialise tout le state du panier après une vente */
  const resetCartState = useCallback(() => {
    setCart([]);
    setSelectedClientId('');
    setSelectedDiscount('');
    setIsClientDiscount(false);
    setSelectedCategory('card');
    setDigitalSubMethod('mobile_wave');
    setShowPaymentModal(false);
    setShowMobileCart(false);
    setCashGiven('');
    setMobilePhone('');
    setMobileRef('');
    setMixedAmount1('');
    setMixedAmount2('');
    setTpeConnecting(false);
    setCinetpay({ active: false, loading: false, transactionId: null, paymentUrl: null });
  }, []);

  /** Ajoute un produit au panier (ou incrémente la quantité si déjà présent) */
  const addToCart = useCallback((productId: string, variant?: ProductVariant) => {
    const product = effectiveProducts.find((p: any) => p.id === productId);
    if (!product) return;
    const price = variant?.salePrice || product.salePrice;
    const variantLabel = variant
      ? Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(' / ')
      : undefined;
    setCart((prev) => {
      const existing = prev.find((c) =>
        variant ? c.productId === productId && c.variantId === variant.id
                : c.productId === productId && !c.variantId,
      );
      if (existing) {
        return prev.map((c) => {
          const match = variant
            ? c.productId === productId && c.variantId === variant.id
            : c.productId === productId && !c.variantId;
          return match ? { ...c, quantity: c.quantity + 1 } : c;
        });
      }
      return [...prev, {
        productId: product.id, productName: product.name,
        variantId: variant?.id, variantLabel,
        quantity: 1, unitPrice: price, vatRate: product.vatRate,
      }];
    });
  }, [effectiveProducts]);

  /** Gère le tap sur une tuile produit : expand variantes ou ajout direct */
  const handleProductTap = useCallback((productId: string) => {
    const product = effectiveProducts.find((p: any) => p.id === productId);
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

  /** Met à jour la quantité d'un article (delta positif ou négatif) */
  const updateCartQuantity = useCallback((productId: string, delta: number, variantId?: string) => {
    setCart((prev) =>
      prev.map((c) => {
        const match = variantId
          ? c.productId === productId && c.variantId === variantId
          : c.productId === productId && !c.variantId;
        if (match) {
          const newQty = c.quantity + delta;
          return newQty > 0 ? { ...c, quantity: newQty } : c;
        }
        return c;
      }).filter((c) => c.quantity > 0),
    );
  }, []);

  /** Supprime un article du panier */
  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    setCart((prev) => prev.filter((c) => {
      if (variantId) return !(c.productId === productId && c.variantId === variantId);
      return !(c.productId === productId && !c.variantId);
    }));
  }, []);

  // ── Gestion client ─────────────────────────────────────────────────────────

  const handleSelectClient = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setShowClientPicker(false);
    setClientSearch('');
    const client = effectiveClients.find((c: any) => c.id === clientId);
    if (client?.discountCategory) {
      setSelectedDiscount(client.discountCategory);
      setIsClientDiscount(true);
    } else {
      if (isClientDiscount) {
        setSelectedDiscount('');
        setIsClientDiscount(false);
      }
    }
  }, [effectiveClients, isClientDiscount]);

  const handleRemoveClient = useCallback(() => {
    setSelectedClientId('');
    if (isClientDiscount) {
      setSelectedDiscount('');
      setIsClientDiscount(false);
    }
    setShowClientPicker(false);
    setClientSearch('');
  }, [isClientDiscount]);

  // ── Gestion remise ─────────────────────────────────────────────────────────

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

  // ── Code-barres ────────────────────────────────────────────────────────────

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

  // ── Saisie manuelle ────────────────────────────────────────────────────────

  const handleManualEntry = useCallback(() => {
    if (!manualName.trim() || !manualPrice.trim()) return;
    const price = parseFloat(manualPrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) return;
    const vat = parseFloat(manualVat) as VATRate;
    setCart((prev) => [...prev, {
      productId: `manual_${Date.now()}`,
      productName: manualName.trim(),
      quantity: 1, unitPrice: price, vatRate: vat,
    }]);
    setManualName('');
    setManualPrice('');
    setManualEntryVisible(false);
  }, [manualName, manualPrice, manualVat]);

  // ── Finalisation de vente ──────────────────────────────────────────────────

  /**
   * Construit les SaleItems et crée la vente (online ou offline).
   * Applique la remise sur chaque ligne avant d'envoyer au DataContext.
   */
  const finalizeSale = useCallback(() => {
    const discMul = discountRate > 0 ? (1 - discountRate / 100) : 1;
    const saleItems: SaleItem[] = cart.map((c) => {
      const lineHT = Math.round(c.unitPrice * c.quantity * discMul * 100) / 100;
      const lineTVA = Math.round(lineHT * (c.vatRate / 100) * 100) / 100;
      return {
        id: generateItemId(), saleId: '',
        productId: c.productId, productName: c.productName,
        quantity: c.quantity,
        unitPrice: Math.round(c.unitPrice * discMul * 100) / 100,
        vatRate: c.vatRate,
        totalHT: lineHT, totalTVA: lineTVA, totalTTC: lineHT + lineTVA,
        ...(c.variantId ? { variantId: c.variantId } : {}),
      } as SaleItem;
    });

    // Construction des extras paiement (mobile, mixte)
    const extra: { mobilePhone?: string; mobileRef?: string; mixedPayments?: MixedPaymentEntry[] } = {};
    if (['mobile_wave', 'mobile_om', 'twint'].includes(selectedPayment) && mobilePhone) {
      extra.mobilePhone = mobilePhone;
      if (mobileRef) extra.mobileRef = mobileRef;
    }
    if (selectedPayment === 'mixed') {
      const amt1 = parseFloat(mixedAmount1.replace(',', '.')) || 0;
      const amt2 = parseFloat(mixedAmount2.replace(',', '.')) || 0;
      if (Math.abs(amt1 + amt2 - cartTotals.totalTTC) > 0.01) {
        showToast('Le total des paiements mixtes doit être égal au montant TTC', 'error');
        return;
      }
      extra.mixedPayments = [
        { method: mixedMethod1, amount: amt1 },
        { method: mixedMethod2, amount: amt2 },
      ];
    }

    const animateCheckout = () => {
      Animated.sequence([
        Animated.timing(checkoutAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
        Animated.timing(checkoutAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    };

    if (isOnline) {
      const result = createSale(saleItems, selectedPayment, selectedClientId || undefined, Object.keys(extra).length > 0 ? extra : undefined);
      if (result.success) {
        animateCheckout();
        if (result.saleId) {
          setConfirmSale(result.saleId);
          setReceiptSaleId(result.saleId);
        }
        resetCartState();
      }
    } else {
      // Mode hors-ligne : mise en file d'attente
      const client = selectedClientId ? effectiveClients.find((c: any) => c.id === selectedClientId) : undefined;
      const clientName = client ? (client.companyName || `${client.firstName} ${client.lastName}`) : undefined;
      const totalHT = saleItems.reduce((s, i) => s + i.totalHT, 0);
      const totalTVA = saleItems.reduce((s, i) => s + i.totalTVA, 0);
      const totalTTC = saleItems.reduce((s, i) => s + i.totalTTC, 0);
      void queueOfflineSale({
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        companyId: effectiveCompany.id || 'unknown',
        saleNumber: `OFF-${Date.now()}`,
        clientId: selectedClientId || undefined, clientName,
        items: saleItems, totalHT, totalTVA, totalTTC,
        paymentMethod: selectedPayment,
        ...(extra.mobilePhone ? { mobilePhone: extra.mobilePhone } : {}),
        ...(extra.mobileRef ? { mobileRef: extra.mobileRef } : {}),
        ...(extra.mixedPayments ? { mixedPayments: extra.mixedPayments } : {}),
        status: 'paid' as const,
        createdAt: new Date().toISOString(),
        _offline: true,
      });
      animateCheckout();
      showToast('Vente enregistrée hors-ligne, sera synchronisée au retour de la connexion');
      resetCartState();
    }
  }, [
    cart, selectedPayment, selectedClientId, createSale, showToast, checkoutAnim,
    mobilePhone, mobileRef, mixedMethod1, mixedMethod2, mixedAmount1, mixedAmount2,
    cartTotals.totalTTC, isOnline, queueOfflineSale, effectiveClients, effectiveCompany,
    resetCartState, discountRate,
  ]);

  /** Déclenche le checkout avec validations préalables */
  const handleCheckout = useCallback(() => {
    if (cart.length === 0) { showToast(t('pos.emptyCartError'), 'error'); return; }
    if (selectedCategory === 'cash') {
      const given = parseFloat(cashGiven.replace(',', '.'));
      if (isNaN(given) || given < cartTotals.totalTTC) { showToast('Le montant donné est insuffisant', 'error'); return; }
    }
    if (selectedCategory === 'digital' && !mobilePhone.trim()) { showToast(t('pos.phoneRequiredError'), 'error'); return; }
    if (selectedCategory === 'card' || selectedCategory === 'digital') {
      setTpeConnecting(true);
      setTimeout(() => { setTpeConnecting(false); finalizeSale(); }, 2000);
      return;
    }
    finalizeSale();
  }, [cart, selectedCategory, cashGiven, cartTotals.totalTTC, mobilePhone, showToast, t, finalizeSale]);

  // ── CinetPay ───────────────────────────────────────────────────────────────

  const handleCinetPayCheckout = useCallback(async () => {
    if (cart.length === 0) { showToast(t('pos.emptyCartError'), 'error'); return; }
    setCinetpay((prev) => ({ ...prev, loading: true }));
    try {
      const client = selectedClientId ? effectiveClients.find((c: any) => c.id === selectedClientId) : undefined;
      let totalTTC = 0;
      cart.forEach((item) => {
        const lineHT = item.unitPrice * item.quantity;
        totalTTC += lineHT + lineHT * (item.vatRate / 100);
      });
      const result = await createCinetPayPayment({
        amount: totalTTC,
        currency: effectiveCompany.currency || 'XOF',
        description: `Vente POS - ${cart.length} article(s)`,
        companyId,
        customerName: client?.lastName || client?.companyName,
        customerSurname: client?.firstName,
        customerEmail: client?.email,
        customerPhone: client?.phone || mobilePhone,
      });
      if (result.success && result.paymentUrl) {
        setShowPaymentModal(false);
        setCinetpay({ active: true, loading: false, transactionId: result.transactionId || null, paymentUrl: result.paymentUrl });
      } else {
        setCinetpay((prev) => ({ ...prev, loading: false }));
        showToast(result.error || t('payment.initError'), 'error');
      }
    } catch {
      setCinetpay((prev) => ({ ...prev, loading: false }));
      showToast(t('payment.initError'), 'error');
    }
  }, [cart, selectedClientId, effectiveClients, effectiveCompany.currency, companyId, mobilePhone, showToast, t]);

  // ─── Retour ───────────────────────────────────────────────────────────────

  return {
    // Panier
    cart, cartTotals, cartItemCount,
    addToCart, removeFromCart, updateCartQuantity, resetCartState, finalizeSale,
    handleProductTap,
    // Variantes
    expandedProductId, setExpandedProductId, expandedRef,
    // Client
    selectedClientId, setSelectedClientId,
    showClientPicker, setShowClientPicker,
    clientSearch, setClientSearch,
    filteredClientsForPicker,
    handleSelectClient, handleRemoveClient,
    // Remise
    selectedDiscount, setSelectedDiscount,
    isClientDiscount, setIsClientDiscount,
    discountRate,
    showDiscountPicker, setShowDiscountPicker,
    newDiscountName, setNewDiscountName,
    newDiscountRate, setNewDiscountRate,
    handleAddNewDiscount,
    // Paiement
    selectedCategory, setSelectedCategory,
    digitalSubMethod, setDigitalSubMethod,
    selectedPayment,
    tpeConnecting, setTpeConnecting,
    showPaymentModal, setShowPaymentModal,
    cashGiven, setCashGiven, cashChange,
    mobilePhone, setMobilePhone,
    mobileRef, setMobileRef,
    mixedMethod1, setMixedMethod1,
    mixedMethod2, setMixedMethod2,
    mixedAmount1, setMixedAmount1,
    mixedAmount2, setMixedAmount2,
    isPaymentValid,
    handleCheckout,
    // Barcode
    barcodeInput, setBarcodeInput, handleBarcodeSubmit,
    // Saisie manuelle
    manualEntryVisible, setManualEntryVisible,
    manualName, setManualName,
    manualPrice, setManualPrice,
    manualVat, setManualVat,
    handleManualEntry,
    // UI
    showMobileCart, setShowMobileCart,
    receiptSaleId, setReceiptSaleId,
    confirmSale, setConfirmSale,
    checkoutAnim,
    // CinetPay
    cinetpay, setCinetpay, handleCinetPayCheckout,
  };
}