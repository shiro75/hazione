/**
 ** @fileoverview POS (Point of Sale) screen with product grid, cart, and payment modal.
 * Supports cash, card, mobile money (Wave/Orange Money/TWINT), mixed payments, and manual entry.
 * Includes sales history with filters by date and payment method.
 *
 * Payment validation rules:
 * - Cash: "Montant donné" must be filled (ideally >= total).
 * - Card: User must confirm payment received before validating.
 * - Wave / Orange Money / TWINT: Phone number field is required.
 * - Mixed: Sum of both amounts must equal TTC total.
 *
 * IMPORTANT: All conditional rendering of string variables uses ternary operators
 * (value ? <JSX> : null) instead of (value && <JSX>) to avoid React Native Web
 * "Unexpected text node" errors when the value is an empty string.
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  Animated,
  Platform,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Smartphone,
  Receipt,
  RotateCcw,
  UserPlus,
  X,
  Check,
  ChevronDown,
  ShoppingCart,
  Pencil,
  Layers,
  Package,
  ScanBarcode,
  Printer,
  Image as ImageIcon,
  Calculator,
  PenLine,
  LayoutGrid,
  List,
  AlignJustify,
  Tag,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useOffline } from '@/contexts/OfflineContext';
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '@/utils/format';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import ConfirmModal from '@/components/ConfirmModal';
import FormModal from '@/components/FormModal';

import type { SaleItem, SalePaymentMethod, MixedPaymentEntry, VATRate, ProductVariant } from '@/types';
import { generateReceiptHTML, generateAndSharePDF } from '@/services/pdfService';
import { useI18n } from '@/contexts/I18nContext';
import PaymentStatusModal from '@/components/PaymentStatusModal';
import SaleConfirmationModal from '@/components/SaleConfirmationModal';
import { createCinetPayPayment } from '@/services/paymentService';
import { useAuth } from '@/contexts/AuthContext';
import { useBanking } from '@/contexts/BankingContext';
import { SALES_ALLOWED_TYPES } from '@/constants/productTypes';
import { isStockableType } from '@/constants/productTypes';

type SalesTab = 'pos' | 'history';
type DateFilter = 'today' | '7days' | '30days' | 'all';
type PaymentCategory = 'cash' | 'card' | 'mixed' | 'digital';
type DigitalSubMethod = 'mobile_wave' | 'mobile_om' | 'twint';
type PaymentMethodFilter = 'all' | PaymentCategory;

interface CartItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
  vatRate: VATRate;
}

const PAYMENT_CATEGORIES: { value: PaymentCategory; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'CB', icon: CreditCard },
  { value: 'mixed', label: 'Mixte', icon: ArrowRightLeft },
];

const ALL_PAYMENT_CATEGORIES_WITH_DIGITAL: { value: PaymentCategory; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'CB', icon: CreditCard },
  { value: 'mixed', label: 'Mixte', icon: ArrowRightLeft },
  { value: 'digital', label: 'Paiement Digital', icon: Smartphone },
];

const DIGITAL_SUB_METHODS: { value: DigitalSubMethod; label: string; color: string }[] = [
  { value: 'mobile_wave', label: 'Wave', color: '#1DC3E2' },
  { value: 'mobile_om', label: 'Orange Money', color: '#FF6600' },
  { value: 'twint', label: 'TWINT', color: '#000000' },
];

const MIXED_SUB_METHODS: { value: SalePaymentMethod; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'CB', icon: CreditCard },
  { value: 'mobile_wave', label: 'Wave', icon: Smartphone },
  { value: 'mobile_om', label: 'Orange Money', icon: Smartphone },
  { value: 'twint', label: 'TWINT', icon: Smartphone },
];

function isDigitalMethod(method: string): boolean {
  return ['mobile_wave', 'mobile_om', 'twint', 'mobile'].includes(method);
}

function getPaymentCategory(method: string): PaymentCategory {
  if (method === 'cash') return 'cash';
  if (method === 'card') return 'card';
  if (method === 'mixed') return 'mixed';
  return 'digital';
}

type CinetPayState = {
  active: boolean;
  loading: boolean;
  transactionId: string | null;
  paymentUrl: string | null;
};

const DATE_FILTER_KEYS: { value: DateFilter; labelKey: string }[] = [
  { value: 'today', labelKey: 'dashboard.today' },
  { value: '7days', labelKey: 'pos.7days' },
  { value: '30days', labelKey: 'pos.30days' },
  { value: 'all', labelKey: 'pos.allSales' },
];

function generateItemId(): string {
  return `si_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export default function SalesScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { t } = useI18n();

  const {
    sales,
    activeProducts,
    activeClients,
    createSale,
    updateSale,
    refundSale,
    convertSaleToInvoice,
    assignClientToSale,
    showToast,
    getProductStock,
    getVariantsForProduct,
    findProductByBarcode,
    company,
  } = useData();
  const { isOnline, cachedProducts, cachedClients, cachedCompany, queueOfflineSale } = useOffline();

  const effectiveProducts = isOnline ? activeProducts : (activeProducts.length > 0 ? activeProducts : cachedProducts.filter(p => !p.isArchived && p.isActive));
  const effectiveClients = isOnline ? activeClients : (activeClients.length > 0 ? activeClients : cachedClients.filter(c => !c.isDeleted));
  const effectiveCompany = company?.name ? company : (cachedCompany ?? company);
  const cur = effectiveCompany.currency || 'EUR';

  const [activeTab, setActiveTab] = useState<SalesTab>('pos');
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory>('card');
  const [digitalSubMethod, setDigitalSubMethod] = useState<DigitalSubMethod>('mobile_wave');
  const [tpeConnecting, setTpeConnecting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [mixedMethod1, setMixedMethod1] = useState<SalePaymentMethod>('cash');
  const [mixedMethod2, setMixedMethod2] = useState<SalePaymentMethod>('mobile_wave');
  const [mixedAmount1, setMixedAmount1] = useState('');
  const [mixedAmount2, setMixedAmount2] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [selectedSale, setSelectedSale] = useState<string | null>(null);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [posViewMode, setPosViewModeState] = useState<'grid' | 'list' | 'compact'>('grid');
  
  const expandedRef = useRef<string | null>(null);
  

  useEffect(() => {
    AsyncStorage.getItem('@pos_view_mode').then((stored) => {
      if (stored === 'grid' || stored === 'list' || stored === 'compact') setPosViewModeState(stored);
    }).catch(() => {});
  }, []);

  const setPosViewMode = useCallback((mode: 'grid' | 'list' | 'compact') => {
    setPosViewModeState(mode);
    AsyncStorage.setItem('@pos_view_mode', mode).catch(() => {});
  }, []);
  const [variantPickerProductId, setVariantPickerProductId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [cashGiven, setCashGiven] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [mobileRef, setMobileRef] = useState('');
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualVat, setManualVat] = useState('20');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const [refundConfirm, setRefundConfirm] = useState<string | null>(null);
  const [convertConfirm, setConvertConfirm] = useState<string | null>(null);
  const [assignClientModal, setAssignClientModal] = useState<string | null>(null);
  const [assignClientSearch, setAssignClientSearch] = useState('');
  const [assignClientId, setAssignClientId] = useState('');

  const [saleFormVisible, setSaleFormVisible] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [saleFormItems, setSaleFormItems] = useState<CartItem[]>([]);
  const [saleFormPayment, setSaleFormPayment] = useState<SalePaymentMethod>('card');
  const [saleFormClientId, setSaleFormClientId] = useState('');
  const [saleFormProductSearch, setSaleFormProductSearch] = useState('');
  const [saleFormError, setSaleFormError] = useState('');
  const [saleFormClientSearch, setSaleFormClientSearch] = useState('');
  const [saleFormShowClientPicker, setSaleFormShowClientPicker] = useState(false);
  const [confirmSale, setConfirmSale] = useState<string | null>(null);

  const [cinetpay, setCinetpay] = useState<CinetPayState>({
    active: false,
    loading: false,
    transactionId: null,
    paymentUrl: null,
  });

  const { user } = useAuth();
  const banking = useBanking();
  const companyId = user?.id ?? 'anonymous';
  const checkoutAnim = useRef(new Animated.Value(1)).current;

  const selectedPayment: SalePaymentMethod = useMemo(() => {
    if (selectedCategory === 'digital') return digitalSubMethod;
    return selectedCategory;
  }, [selectedCategory, digitalSubMethod]);

  const resetCartState = useCallback(() => {
    setCart([]);
    setSelectedClientId('');
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

  const handleCinetPayCheckout = useCallback(async () => {
    if (cart.length === 0) {
      showToast(t('pos.emptyCartError'), 'error');
      return;
    }
    setCinetpay(prev => ({ ...prev, loading: true }));
    try {
      const client = selectedClientId ? effectiveClients.find(c => c.id === selectedClientId) : undefined;
      let totalTTC = 0;
      cart.forEach((item) => {
        const lineHT = item.unitPrice * item.quantity;
        const lineTVA = lineHT * (item.vatRate / 100);
        totalTTC += lineHT + lineTVA;
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
        setCinetpay({
          active: true,
          loading: false,
          transactionId: result.transactionId || null,
          paymentUrl: result.paymentUrl,
        });
      } else {
        setCinetpay(prev => ({ ...prev, loading: false }));
        showToast(result.error || t('payment.initError'), 'error');
      }
    } catch {
      setCinetpay(prev => ({ ...prev, loading: false }));
      showToast(t('payment.initError'), 'error');
    }
  }, [cart, selectedClientId, effectiveClients, effectiveCompany.currency, companyId, mobilePhone, showToast, t]);

  const salesProducts = useMemo(() =>
    effectiveProducts.filter((p) => SALES_ALLOWED_TYPES.includes(p.type)),
    [effectiveProducts]
  );

  const categoryData = useMemo(() => {
    const catMap = new Map<string, { name: string; count: number }>();
    salesProducts.forEach((p) => {
      const catName = p.categoryName || 'Autres';
      const existing = catMap.get(catName);
      if (existing) {
        existing.count += 1;
      } else {
        catMap.set(catName, { name: catName, count: 1 });
      }
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
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
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
    for (const [cat, items] of map) {
      groups.push({ category: cat, items });
    }
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

  const cartTotals = useMemo(() => {
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    cart.forEach((item) => {
      const lineHT = item.unitPrice * item.quantity;
      const lineTVA = lineHT * (item.vatRate / 100);
      const lineTTC = lineHT + lineTVA;
      totalHT += lineHT;
      totalTVA += lineTVA;
      totalTTC += lineTTC;
    });
    return { totalHT, totalTVA, totalTTC };
  }, [cart]);

  const cartItemCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);

  const isPaymentValid = useMemo(() => {
    if (selectedCategory === 'cash') {
      const given = parseFloat(cashGiven.replace(',', '.'));
      return !isNaN(given) && given >= cartTotals.totalTTC;
    }
    if (selectedCategory === 'card') {
      return true;
    }
    if (selectedCategory === 'digital') {
      return mobilePhone.trim().length > 0;
    }
    if (selectedCategory === 'mixed') {
      const amt1 = parseFloat(mixedAmount1.replace(',', '.')) || 0;
      const amt2 = parseFloat(mixedAmount2.replace(',', '.')) || 0;
      return Math.abs(amt1 + amt2 - cartTotals.totalTTC) < 0.01;
    }
    return true;
  }, [selectedCategory, cashGiven, mobilePhone, mixedAmount1, mixedAmount2, cartTotals.totalTTC]);

  const cashChange = useMemo(() => {
    const given = parseFloat(cashGiven.replace(',', '.'));
    if (isNaN(given) || given < cartTotals.totalTTC) return 0;
    return given - cartTotals.totalTTC;
  }, [cashGiven, cartTotals.totalTTC]);

  const addToCart = useCallback((productId: string, variant?: ProductVariant) => {
    const product = effectiveProducts.find((p) => p.id === productId);
    if (!product) return;
    const price = variant?.salePrice || product.salePrice;
    const variantLabel = variant
      ? Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(' / ')
      : undefined;
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
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          variantId: variant?.id,
          variantLabel,
          quantity: 1,
          unitPrice: price,
          vatRate: product.vatRate,
        },
      ];
    });
  }, [effectiveProducts]);

  const handleProductTap = useCallback((productId: string) => {
  console.log('Tap sur produit:', productId);
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
        const match = variantId
          ? (c.productId === productId && c.variantId === variantId)
          : (c.productId === productId && !c.variantId);
        if (match) {
          const newQty = c.quantity + delta;
          return newQty > 0 ? { ...c, quantity: newQty } : c;
        }
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

  const handleBarcodeSubmit = useCallback(() => {
    if (!barcodeInput.trim()) return;
    const product = findProductByBarcode(barcodeInput.trim());
    if (product) {
      const productVariants = getVariantsForProduct(product.id);
      if (productVariants.length > 0) {
        addToCart(product.id, productVariants[0]);
      } else {
        addToCart(product.id);
      }
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
    setCart((prev) => [
      ...prev,
      {
        productId: `manual_${Date.now()}`,
        productName: manualName.trim(),
        quantity: 1,
        unitPrice: price,
        vatRate: vat,
      },
    ]);
    setManualName('');
    setManualPrice('');
    setManualEntryVisible(false);
  }, [manualName, manualPrice, manualVat]);

  const handlePrintReceipt = useCallback(async (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    try {
      const html = generateReceiptHTML(sale, company);
      const success = await generateAndSharePDF(html, `Ticket_${sale.saleNumber}.pdf`);
      if (success) showToast('Ticket généré');
      else showToast('Erreur lors de la génération du ticket', 'error');
    } catch {
      showToast('Erreur lors de la génération du ticket', 'error');
    }
  }, [sales, company, showToast]);

  const finalizeSale = useCallback(() => {
    const saleItems: SaleItem[] = cart.map((c) => {
      const lineHT = c.unitPrice * c.quantity;
      const lineTVA = lineHT * (c.vatRate / 100);
      const lineTTC = lineHT + lineTVA;
      return {
        id: generateItemId(),
        saleId: '',
        productId: c.productId,
        productName: c.productName,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        vatRate: c.vatRate,
        totalHT: lineHT,
        totalTVA: lineTVA,
        totalTTC: lineTTC,
      };
    });
    const extra: { mobilePhone?: string; mobileRef?: string; mixedPayments?: MixedPaymentEntry[] } = {};
    if ((selectedPayment === 'mobile_wave' || selectedPayment === 'mobile_om' || selectedPayment === 'twint') && mobilePhone) {
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
    if (isOnline) {
      const result = createSale(
        saleItems,
        selectedPayment,
        selectedClientId || undefined,
        Object.keys(extra).length > 0 ? extra : undefined
      );
      if (result.success) {
        Animated.sequence([
          Animated.timing(checkoutAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
          Animated.timing(checkoutAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        ]).start();
        if (result.saleId) {
          setConfirmSale(result.saleId);
          setReceiptSaleId(result.saleId);
        }
        resetCartState();
      }
    } else {
      const client = selectedClientId ? effectiveClients.find(c => c.id === selectedClientId) : undefined;
      const clientName = client ? (client.companyName || `${client.firstName} ${client.lastName}`) : undefined;
      const totalHT = saleItems.reduce((s, i) => s + i.totalHT, 0);
      const totalTVA = saleItems.reduce((s, i) => s + i.totalTVA, 0);
      const totalTTC = saleItems.reduce((s, i) => s + i.totalTTC, 0);
      const offlineSale = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        companyId: effectiveCompany.id || 'unknown',
        saleNumber: `OFF-${Date.now()}`,
        clientId: selectedClientId || undefined,
        clientName,
        items: saleItems,
        totalHT,
        totalTVA,
        totalTTC,
        paymentMethod: selectedPayment,
        ...(extra.mobilePhone ? { mobilePhone: extra.mobilePhone } : {}),
        ...(extra.mobileRef ? { mobileRef: extra.mobileRef } : {}),
        ...(extra.mixedPayments ? { mixedPayments: extra.mixedPayments } : {}),
        status: 'paid' as const,
        createdAt: new Date().toISOString(),
        _offline: true,
      };
      void queueOfflineSale(offlineSale);
      Animated.sequence([
        Animated.timing(checkoutAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
        Animated.timing(checkoutAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      showToast('Vente enregistrée hors-ligne, sera synchronisée au retour de la connexion');
      resetCartState();
    }
  }, [cart, selectedPayment, selectedClientId, createSale, showToast, checkoutAnim, mobilePhone, mobileRef, mixedMethod1, mixedMethod2, mixedAmount1, mixedAmount2, cartTotals.totalTTC, isOnline, queueOfflineSale, effectiveClients, effectiveCompany, resetCartState]);

  const handleCheckout = useCallback(() => {
    if (cart.length === 0) {
      showToast(t('pos.emptyCartError'), 'error');
      return;
    }
    if (selectedCategory === 'cash') {
      const given = parseFloat(cashGiven.replace(',', '.'));
      if (isNaN(given) || given < cartTotals.totalTTC) {
        showToast('Le montant donné est insuffisant', 'error');
        return;
      }
    }
    if (selectedCategory === 'digital' && !mobilePhone.trim()) {
      showToast(t('pos.phoneRequiredError'), 'error');
      return;
    }
    if (selectedCategory === 'card' || selectedCategory === 'digital') {
      setTpeConnecting(true);
      setTimeout(() => {
        setTpeConnecting(false);
        finalizeSale();
      }, 2000);
      return;
    }
    finalizeSale();
  }, [cart, selectedCategory, cashGiven, cartTotals.totalTTC, mobilePhone, showToast, t, finalizeSale]);

  const filteredSales = useMemo(() => {
    let result = [...sales];
    const now = new Date();
    if (dateFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      result = result.filter((s) => s.createdAt.startsWith(todayStr));
    } else if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter((s) => new Date(s.createdAt) >= sevenDaysAgo);
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter((s) => new Date(s.createdAt) >= thirtyDaysAgo);
    }
    if (historySearch) {
      const q = historySearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.saleNumber.toLowerCase().includes(q) ||
          (s.clientName && s.clientName.toLowerCase().includes(q))
      );
    }
    if (paymentMethodFilter !== 'all') {
      result = result.filter((s) => getPaymentCategory(s.paymentMethod) === paymentMethodFilter);
    }
    return result;
  }, [sales, dateFilter, historySearch, paymentMethodFilter]);

  const filteredClientsForPicker = useMemo(() => {
    if (!clientSearch) return effectiveClients.slice(0, 10);
    const q = clientSearch.toLowerCase();
    return effectiveClients.filter(
      (c) =>
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [clientSearch, effectiveClients]);

  const saleFormFilteredProducts = useMemo(() => {
    if (!saleFormProductSearch) return salesProducts.slice(0, 20);
    const q = saleFormProductSearch.toLowerCase();
    return salesProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [saleFormProductSearch, salesProducts]);

  const saleFormFilteredClients = useMemo(() => {
    if (!saleFormClientSearch) return effectiveClients.slice(0, 10);
    const q = saleFormClientSearch.toLowerCase();
    return effectiveClients.filter(
      (c) =>
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [saleFormClientSearch, effectiveClients]);

  const saleFormTotals = useMemo(() => {
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    saleFormItems.forEach((item) => {
      const lineHT = item.unitPrice * item.quantity;
      const lineTVA = lineHT * (item.vatRate / 100);
      totalHT += lineHT;
      totalTVA += lineTVA;
      totalTTC += lineHT + lineTVA;
    });
    return { totalHT, totalTVA, totalTTC };
  }, [saleFormItems]);

  const openEditSaleForm = useCallback((saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale || sale.status === 'refunded') return;
    setEditingSaleId(saleId);
    setSaleFormItems(sale.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      variantId: (item as { variantId?: string }).variantId,
      variantLabel: (item as { variantLabel?: string }).variantLabel,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
    })));
    setSaleFormPayment(sale.paymentMethod);
    setSaleFormClientId(sale.clientId || '');
    setSaleFormProductSearch('');
    setSaleFormError('');
    setSaleFormClientSearch('');
    setSaleFormShowClientPicker(false);
    setSaleFormVisible(true);
  }, [sales]);

  const addToSaleForm = useCallback((productId: string) => {
    const product = effectiveProducts.find((p) => p.id === productId);
    if (!product) return;
    setSaleFormItems((prev) => {
      const existing = prev.find((c) => c.productId === productId && !c.variantId);
      if (existing) {
        return prev.map((c) =>
          (c.productId === productId && !c.variantId) ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.salePrice,
        vatRate: product.vatRate,
      }];
    });
    setSaleFormProductSearch('');
  }, [effectiveProducts]);

  const updateSaleFormQty = useCallback((productId: string, delta: number, variantId?: string) => {
    setSaleFormItems((prev) =>
      prev.map((c) => {
        const match = variantId
          ? (c.productId === productId && c.variantId === variantId)
          : (c.productId === productId && !c.variantId);
        if (match) {
          const newQty = c.quantity + delta;
          return newQty > 0 ? { ...c, quantity: newQty } : c;
        }
        return c;
      }).filter((c) => c.quantity > 0)
    );
  }, []);

  const removeSaleFormItem = useCallback((productId: string, variantId?: string) => {
    setSaleFormItems((prev) => prev.filter((c) => {
      if (variantId) return !(c.productId === productId && c.variantId === variantId);
      return !(c.productId === productId && !c.variantId);
    }));
  }, []);

  const handleSaleFormSubmit = useCallback(() => {
    if (saleFormItems.length === 0) {
      setSaleFormError('Ajoutez au moins un produit');
      return;
    }
    const items: SaleItem[] = saleFormItems.map((c) => {
      const lineHT = c.unitPrice * c.quantity;
      const lineTVA = lineHT * (c.vatRate / 100);
      const lineTTC = lineHT + lineTVA;
      return {
        id: generateItemId(),
        saleId: editingSaleId || '',
        productId: c.productId,
        productName: c.productName,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        vatRate: c.vatRate,
        totalHT: lineHT,
        totalTVA: lineTVA,
        totalTTC: lineTTC,
      };
    });
    let result;
    if (editingSaleId) {
      result = updateSale(editingSaleId, {
        items,
        paymentMethod: saleFormPayment,
        clientId: saleFormClientId || undefined,
      });
    } else {
      result = createSale(items, saleFormPayment, saleFormClientId || undefined);
    }
    if (!result.success) {
      setSaleFormError(result.error || 'Erreur inconnue');
      return;
    }
    setSaleFormVisible(false);
  }, [saleFormItems, saleFormPayment, saleFormClientId, editingSaleId, createSale, updateSale]);

  const filteredClientsForAssign = useMemo(() => {
    if (!assignClientSearch) return effectiveClients.slice(0, 10);
    const q = assignClientSearch.toLowerCase();
    return effectiveClients.filter(
      (c) =>
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [assignClientSearch, effectiveClients]);

  const getCategoryColor = useCallback((name: string) => {
    const PALETTE = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1',
      '#84CC16', '#E11D48', '#0EA5E9', '#A855F7', '#D946EF',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }, []);

  const renderCartContent = () => (
    <>
      <ScrollView style={s.cartList} showsVerticalScrollIndicator={false}>
        {cart.length === 0 ? (
          <View style={s.cartEmpty}>
            <Receipt size={32} color={colors.textTertiary} />
            <Text style={[s.cartEmptyText, { color: colors.textTertiary }]}>Panier vide</Text>
            <Text style={[s.cartEmptyHint, { color: colors.textTertiary }]}>
              Sélectionnez un produit pour l'ajouter
            </Text>
          </View>
        ) : (
          cart.map((item, cartIdx) => {
            const lineHT = item.unitPrice * item.quantity;
            const lineTVA = lineHT * (item.vatRate / 100);
            const lineTTC = lineHT + lineTVA;
            return (
              <TouchableOpacity
                key={`cart_${cartIdx}_${item.productId}_${item.variantId || 'base'}`}
                style={[s.cartItem, { borderBottomColor: colors.borderLight }]}
                activeOpacity={0.8}
              >
                <View style={s.cartItemTop}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[s.cartItemName, { color: colors.text }]} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    {item.variantLabel ? (
                      <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>{item.variantLabel}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => removeFromCart(item.productId, item.variantId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={s.cartItemBottom}>
                  <View style={s.qtyControl}>
                    <TouchableOpacity
                      style={[s.qtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                      onPress={() => updateCartQuantity(item.productId, -1, item.variantId)}
                    >
                      <Minus size={14} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[s.qtyText, { color: colors.text }]}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[s.qtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                      onPress={() => updateCartQuantity(item.productId, 1, item.variantId)}
                    >
                      <Plus size={14} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ alignItems: 'flex-end' as const }}>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                      {formatCurrency(item.unitPrice, cur)} × {item.quantity}
                    </Text>
                    <Text style={[s.cartItemTotal, { color: colors.text }]}>
                      {formatCurrency(lineTTC, cur)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={[s.cartFooter, { borderTopColor: colors.border }]}>
        <View style={s.totalsBlock}>
          <View style={s.totalRow}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(cartTotals.totalHT, cur)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(cartTotals.totalTVA, cur)}</Text>
          </View>
          <View style={[s.totalRow, { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
            <Text style={{ fontSize: 20, fontWeight: '800' as const, color: colors.text }}>Total</Text>
            <Text style={{ fontSize: 24, fontWeight: '800' as const, color: colors.primary }}>
              {formatCurrency(cartTotals.totalTTC, cur)}
            </Text>
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: checkoutAnim }] }}>
          <TouchableOpacity
            style={[
              s.payBtn,
              { backgroundColor: cart.length > 0 ? '#10B981' : colors.textTertiary },
            ]}
            onPress={() => {
              if (cart.length === 0) return;
              setShowPaymentModal(true);
              setCashGiven('');
            }}
            disabled={cart.length === 0}
            activeOpacity={0.8}
          >
            <CreditCard size={20} color="#FFF" />
            <Text style={s.payBtnText}>PAYER</Text>
          </TouchableOpacity>
        </Animated.View>

        {receiptSaleId && (
          <TouchableOpacity
            style={[s.receiptBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => { void handlePrintReceipt(receiptSaleId); setReceiptSaleId(null); }}
            activeOpacity={0.7}
          >
            <Printer size={16} color={colors.primary} />
            <Text style={[s.receiptBtnText, { color: colors.primary }]}>Imprimer le ticket</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );



const renderProductGrid = () => (
  <View style={s.productsSection}>
    {/* Barre de recherche + toggle vue */}
    <View style={[s.posSearchRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Search size={18} color={colors.textTertiary} />
      <TextInput
        style={[s.posSearchInput, { color: colors.text }]}
        placeholder="Rechercher un produit..."
        placeholderTextColor={colors.textTertiary}
        value={productSearch}
        onChangeText={setProductSearch}
      />
      {productSearch ? (
        <TouchableOpacity onPress={() => setProductSearch('')} hitSlop={8}>
          <X size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      ) : null}
      <View style={s.viewToggle}>
        <TouchableOpacity
          style={[s.viewToggleBtn, posViewMode === 'grid' && { backgroundColor: colors.primary }]}
          onPress={() => setPosViewMode('grid')}
          activeOpacity={0.7}
        >
          <LayoutGrid size={13} color={posViewMode === 'grid' ? '#FFF' : colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.viewToggleBtn, posViewMode === 'compact' && { backgroundColor: colors.primary }]}
          onPress={() => setPosViewMode('compact')}
          activeOpacity={0.7}
        >
          <AlignJustify size={13} color={posViewMode === 'compact' ? '#FFF' : colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.viewToggleBtn, posViewMode === 'list' && { backgroundColor: colors.primary }]}
          onPress={() => setPosViewMode('list')}
          activeOpacity={0.7}
        >
          <List size={13} color={posViewMode === 'list' ? '#FFF' : colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>

    {/* Filtres catégories */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0, flexGrow: 0 }} contentContainerStyle={s.categoryTabs}>
      <TouchableOpacity
        style={[s.categoryTab, { backgroundColor: !selectedCategoryFilter ? colors.primary : colors.card, borderColor: !selectedCategoryFilter ? colors.primary : colors.cardBorder }]}
        onPress={() => setSelectedCategoryFilter(null)}
        activeOpacity={0.7}
      >
        <Text style={[s.categoryTabText, { color: !selectedCategoryFilter ? '#FFF' : colors.textSecondary }]}>
          Tout ({salesProducts.length})
        </Text>
      </TouchableOpacity>
      {categoryData.map((cat) => {
        const isActive = selectedCategoryFilter === cat.name;
        const catColor = getCategoryColor(cat.name);
        return (
          <TouchableOpacity
            key={cat.name}
            style={[s.categoryTab, { backgroundColor: isActive ? catColor : colors.card, borderColor: isActive ? catColor : colors.cardBorder }]}
            onPress={() => setSelectedCategoryFilter(isActive ? null : cat.name)}
            activeOpacity={0.7}
          >
            <Text style={[s.categoryTabText, { color: isActive ? '#FFF' : colors.text }]}>
              {cat.name} ({cat.count})
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>

    {/* Saisie manuelle + Code-barres */}
    <View style={s.quickActions}>
      <TouchableOpacity
        style={[s.quickBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        onPress={() => { setManualName(''); setManualPrice(''); setManualVat('20'); setManualEntryVisible(true); }}
        activeOpacity={0.7}
      >
        <PenLine size={14} color={colors.primary} />
        <Text style={[s.quickBtnText, { color: colors.primary }]}>Saisie manuelle</Text>
      </TouchableOpacity>
      <View style={[s.barcodeRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <ScanBarcode size={14} color={colors.primary} />
        <TextInput
          style={[s.barcodeInput, { color: colors.text }]}
          placeholder="Code-barres..."
          placeholderTextColor={colors.textTertiary}
          value={barcodeInput}
          onChangeText={setBarcodeInput}
          onSubmitEditing={handleBarcodeSubmit}
          returnKeyType="search"
          autoCapitalize="none"
          testID="barcode-input"
        />
        {barcodeInput.length > 0 && (
          <TouchableOpacity
            style={[s.barcodeOkBtn, { backgroundColor: colors.primary }]}
            onPress={handleBarcodeSubmit}
          >
            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' as const }}>OK</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>

    {/* Produits groupés par catégorie */}
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.productGridContent, { flexGrow: 1, justifyContent: 'flex-start' as const }]}
    >
      {filteredProducts.length === 0 ? (
        <View style={s.emptyState}>
          <Package size={36} color={colors.textTertiary} />
          <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 8 }}>Aucun produit trouvé</Text>
        </View>
      ) : (
        <View>
          {groupedFilteredProducts.map((group) => (
            <View key={group.category}>
              {groupedFilteredProducts.length > 1 && (
                <View style={[s.categoryGroupHeader, { backgroundColor: colors.surfaceHover }]}>
                  <Tag size={12} color={colors.textSecondary} />
                  <Text style={[s.categoryGroupHeaderText, { color: colors.text }]}>{group.category}</Text>
                  <Text style={[s.categoryGroupHeaderCount, { color: colors.textTertiary }]}>{group.items.length}</Text>
                </View>
              )}
              {posViewMode === 'list' ? (
                <View style={[s.listContainer, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
                  {group.items.map((product) => {
                    // CALCULS HOOKS - TOUT ICI
                    const cartItems = cart.filter((c) => c.productId === product.id);
                    const totalInCart = cartItems.reduce((acc, c) => acc + c.quantity, 0);
                    const productVariantsList = getVariantsForProduct(product.id);
                    const productStock = productVariantsList.length > 0
                      ? productVariantsList.reduce((sum, v) => sum + v.stockQuantity, 0)
                      : getProductStock(product.id);
                    const isLowStock = isStockableType(product.type) && productStock <= product.lowStockThreshold && productStock > 0;
                    const isOutOfStock = isStockableType(product.type) && productStock <= 0;
                    const variantCount = productVariantsList.length;
                    const isExpanded = expandedProductId === product.id;
                    const hasRealVariants = productVariantsList.length > 0 && Object.keys(productVariantsList[0].attributes).length > 0;
                    
                    return (
                      <TouchableOpacity
                        key={product.id}
                        style={[
                          s.listRow,
                          {
                            backgroundColor: totalInCart > 0 ? `${colors.primary}08` : colors.card,
                            borderBottomColor: colors.borderLight,
                            opacity: isOutOfStock ? 0.45 : 1,
                          },
                        ]}
                        onPress={() => !isOutOfStock && handleProductTap(product.id)}
                        activeOpacity={isOutOfStock ? 1 : 0.7}
                        disabled={isOutOfStock}
                      >
                        {product.photoUrl ? (
                          <Image source={{ uri: product.photoUrl }} style={s.listThumb} resizeMode="cover" />
                        ) : (
                          <View style={[s.listThumbPlaceholder, { backgroundColor: colors.surfaceHover }]}>
                            <ImageIcon size={14} color={colors.textTertiary} />
                          </View>
                        )}
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[s.listName, { color: isOutOfStock ? colors.textTertiary : colors.text }]} numberOfLines={1}>{product.name}</Text>
                          {hasRealVariants ? (
                            <Text style={{ fontSize: 10, color: colors.textTertiary }}>{variantCount} variante{variantCount > 1 ? 's' : ''}</Text>
                          ) : null}
                        </View>
                        {isStockableType(product.type) && (
                          <Text style={[s.listStock, { color: isOutOfStock ? colors.danger : isLowStock ? colors.warning : colors.textTertiary }]}>
                            {isOutOfStock ? 'Rupture' : productStock}
                          </Text>
                        )}
                        <Text style={[s.listPrice, { color: isOutOfStock ? colors.textTertiary : colors.primary }]}>
                          {formatCurrency(product.salePrice * (1 + product.vatRate / 100), cur)}
                        </Text>
                        {totalInCart > 0 && (
                          <View style={[s.tileCartBadge, { position: 'relative' as const, top: 0, right: 0 }]}>
                            <Text style={s.tileCartBadgeText}>{totalInCart}</Text>
                          </View>
                        )}
                        {isOutOfStock && isStockableType(product.type) && (
                          <View style={[s.tileRuptureBadge, { position: 'relative' as const, top: 0, right: 0 }]}>
                            <Text style={s.tileRuptureBadgeText}>RUPTURE</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={[s.gridWrap, { alignContent: 'flex-start' as const, marginBottom: groupedFilteredProducts.length > 1 ? 8 : 0 }]}>
                  {group.items.map((product) => {
                    // CALCULS HOOKS - TOUT ICI (idem que pour list)
                    const cartItems = cart.filter((c) => c.productId === product.id);
                    const totalInCart = cartItems.reduce((acc, c) => acc + c.quantity, 0);
                    const productVariantsList = getVariantsForProduct(product.id);
                    const productStock = productVariantsList.length > 0
                      ? productVariantsList.reduce((sum, v) => sum + v.stockQuantity, 0)
                      : getProductStock(product.id);
                    const isLowStock = isStockableType(product.type) && productStock <= product.lowStockThreshold && productStock > 0;
                    const isOutOfStock = isStockableType(product.type) && productStock <= 0;
                    const variantCount = productVariantsList.length;
                    const isExpanded = expandedProductId === product.id;
                    const hasRealVariants = productVariantsList.length > 0 && Object.keys(productVariantsList[0].attributes).length > 0;
                    
                
                    const isCompact = posViewMode === 'compact';
                    
                    return (
                      <View
                        key={product.id}
                        style={[
                          s.productTile,
                          {
                            backgroundColor: colors.card,
                            borderColor: isExpanded ? colors.primary : totalInCart > 0 ? colors.primary : colors.cardBorder,
                            borderWidth: (isExpanded || totalInCart > 0) ? 2 : 1,
                            width: isExpanded && hasRealVariants
  ? (() => {
      const allVariants = getVariantsForProduct(product.id);
      const maxLength = Math.max(...allVariants.map(v => {
        return Object.entries(v.attributes).reduce((sum, [key, value], idx, arr) => {
          let length = sum + key.length + 2 + value.length;
          if (idx < arr.length - 1) length += 3;
          return length;
        }, 0);
      }));
      const calculatedWidth = maxLength * 7 + 80;
      return Math.max(180, calculatedWidth);
    })()
  : (isCompact
    ? (isMobile ? '47%' as unknown as number : 120)
    : (isMobile ? '47%' as unknown as number : 160)),
                          },
                          isOutOfStock && s.tileOutOfStock,
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => !isOutOfStock && handleProductTap(product.id)}
                          activeOpacity={isOutOfStock ? 1 : 0.7}
                          disabled={isOutOfStock}
                        >
                          {product.photoUrl ? (
                            <Image source={{ uri: product.photoUrl }} style={isCompact ? s.tileImage : s.tileImageLarge} resizeMode="cover" />
                          ) : (
                            <View style={[isCompact ? s.tilePlaceholder : s.tilePlaceholderLarge, { backgroundColor: colors.surfaceHover }]}>
                              <ImageIcon size={isCompact ? 18 : 24} color={colors.textTertiary} />
                            </View>
                          )}
                          {totalInCart > 0 && (
                            <View style={[s.tileCartBadge, { backgroundColor: colors.primary }]}>
                              <Text style={s.tileCartBadgeText}>{totalInCart}</Text>
                            </View>
                          )}
                          {isOutOfStock && (
                            <View style={s.tileRuptureBadge}>
                              <Text style={s.tileRuptureBadgeText}>RUPTURE</Text>
                            </View>
                          )}
                          {hasRealVariants && !isOutOfStock && !isExpanded && (
                            <View style={[s.tileVariantBadge, { backgroundColor: `${colors.primary}22` }]}>
                              <Layers size={9} color={colors.primary} />
                              <Text style={{ fontSize: 9, fontWeight: '700' as const, color: colors.primary }}>{variantCount}</Text>
                            </View>
                          )}
                          <View style={s.tileBody}>
                            <Text style={[s.tileName, { color: isOutOfStock ? colors.textTertiary : colors.text }]} numberOfLines={2}>{product.name}</Text>
                            <View style={s.tileFooter}>
                              <Text style={[s.tilePrice, { color: isOutOfStock ? colors.textTertiary : colors.primary }]}>
                                {formatCurrency(product.salePrice * (1 + product.vatRate / 100), cur)}
                              </Text>
                              {isStockableType(product.type) && (
                                <Text style={[s.tileStockSmall, { color: isOutOfStock ? colors.danger : isLowStock ? colors.warning : colors.textTertiary }]}>
                                  {isOutOfStock ? '0' : productStock}
                                </Text>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                        {isExpanded && hasRealVariants && (
                          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                            {productVariantsList.map((v) => {
                              const vLabel = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' / ');
                              const inCart = cart.find((c) => c.variantId === v.id);
                              return (
                                <TouchableOpacity
                                  key={v.id}
                                  style={[s.expandedVariantRow, { backgroundColor: inCart ? `${colors.primary}08` : 'transparent', borderBottomColor: colors.borderLight }]}
                                  onPress={() => addToCart(product.id, v)}
                                  activeOpacity={0.7}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.text }} numberOfLines={1}>{vLabel}</Text>
                                  </View>
                                  <Text style={{ fontSize: 11, fontWeight: '700' as const, color: colors.primary }}>
                                    {formatCurrency(v.salePrice * (1 + product.vatRate / 100), cur)}
                                  </Text>
                                  {inCart ? (
                                    <View style={[s.tileCartBadge, { position: 'relative' as const, top: 0, right: 0, width: 18, height: 18, borderRadius: 9 }]}>
                                      <Text style={[s.tileCartBadgeText, { fontSize: 9 }]}>{inCart.quantity}</Text>
                                    </View>
                                  ) : null}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  </View>
);
  const renderPOS = () => {
    if (isMobile) {
      return (
        <View style={{ flex: 1 }}>
          {renderProductGrid()}
          {cartItemCount > 0 && (
            <TouchableOpacity
              style={[s.floatingCartBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowMobileCart(true)}
              activeOpacity={0.85}
            >
              <ShoppingCart size={20} color="#FFF" />
              <View style={s.floatingCartBadge}>
                <Text style={s.floatingCartBadgeText}>{cartItemCount}</Text>
              </View>
              <Text style={s.floatingCartTotal}>{formatCurrency(cartTotals.totalTTC, cur)}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={s.splitLayout}>
        <View style={s.productsPanel}>
          {renderProductGrid()}
        </View>

        <View style={[s.cartPanel, { backgroundColor: colors.surface, borderLeftColor: colors.border }]}>
          <View style={s.cartHeader}>
            <View style={s.cartHeaderLeft}>
              <ShoppingCart size={18} color={colors.primary} />
              <Text style={[s.cartTitle, { color: colors.text }]}>Panier</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {cartItemCount} article{cartItemCount !== 1 ? 's' : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={[s.clientSelector, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            onPress={() => setShowClientPicker(!showClientPicker)}
          >
            <UserPlus size={14} color={colors.textSecondary} />
            <Text style={[s.clientSelectorText, { color: selectedClientId ? colors.text : colors.textTertiary }]} numberOfLines={1}>
              {selectedClientId
                ? effectiveClients.find((c) => c.id === selectedClientId)?.companyName ||
                  (() => {
                    const cl = effectiveClients.find((c) => c.id === selectedClientId);
                    return cl ? `${cl.firstName} ${cl.lastName}` : 'Client';
                  })()
                : 'Client (optionnel)'}
            </Text>
            <ChevronDown size={14} color={colors.textTertiary} />
          </TouchableOpacity>

          {showClientPicker && (
            <View style={[s.clientDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[s.clientDropdownSearch, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                placeholder="Rechercher un client..."
                placeholderTextColor={colors.textTertiary}
                value={clientSearch}
                onChangeText={setClientSearch}
              />
              {selectedClientId ? (
                <TouchableOpacity
                  style={[s.clientDropdownItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => { setSelectedClientId(''); setShowClientPicker(false); setClientSearch(''); }}
                >
                  <X size={14} color={colors.danger} />
                  <Text style={{ fontSize: 13, color: colors.danger }}>Retirer le client</Text>
                </TouchableOpacity>
              ) : null}
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                {filteredClientsForPicker.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[s.clientDropdownItem, { borderBottomColor: colors.borderLight }, client.id === selectedClientId && { backgroundColor: colors.primaryLight }]}
                    onPress={() => { setSelectedClientId(client.id); setShowClientPicker(false); setClientSearch(''); }}
                  >
                    <Text style={{ fontSize: 13, color: colors.text }}>
                      {client.companyName || `${client.firstName} ${client.lastName}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {renderCartContent()}
        </View>
      </View>
    );
  };

  const renderPaymentModal = () => (
    <Modal visible={showPaymentModal} transparent animationType="fade" onRequestClose={() => setShowPaymentModal(false)}>
      <Pressable style={s.modalOverlay} onPress={() => setShowPaymentModal(false)}>
        <Pressable style={[s.paymentModal, { backgroundColor: colors.card, width: isMobile ? width - 32 : 440 }]} onPress={(e) => e.stopPropagation()}>
          <View style={[s.paymentModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.paymentModalTitle, { color: colors.text }]}>Paiement</Text>
            <TouchableOpacity onPress={() => setShowPaymentModal(false)} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
            <View style={[s.paymentRecap, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {cartItemCount} article{cartItemCount > 1 ? 's' : ''}
              </Text>
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 4 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(cartTotals.totalHT, cur)}</Text>
              </View>
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(cartTotals.totalTVA, cur)}</Text>
              </View>
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <Text style={{ fontSize: 22, fontWeight: '800' as const, color: colors.text }}>Total TTC</Text>
                <Text style={{ fontSize: 22, fontWeight: '800' as const, color: colors.primary }}>{formatCurrency(cartTotals.totalTTC, cur)}</Text>
              </View>
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 8 }}>Mode de paiement</Text>
              <View style={s.paymentGrid}>
                {PAYMENT_CATEGORIES.map((pm) => {
                  const isSelected = selectedCategory === pm.value;
                  const isCardDisabled = pm.value === 'card' && !banking.isDigitalPaymentAvailable;
                  return (
                    <TouchableOpacity
                      key={pm.value}
                      style={[
                        s.paymentMethodBtn,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.inputBg,
                          borderColor: isSelected ? colors.primary : colors.inputBorder,
                          opacity: isCardDisabled ? 0.45 : 1,
                        },
                      ]}
                      onPress={() => {
                        if (isCardDisabled) {
                          showToast('Veuillez configurer vos informations bancaires dans Param\u00e8tres \u2192 Administration \u2192 Paiements', 'error');
                          return;
                        }
                        setSelectedCategory(pm.value);
                        setTpeConnecting(false);
                      }}
                      activeOpacity={isCardDisabled ? 1 : 0.7}
                    >
                      <pm.icon size={20} color={isSelected ? '#FFF' : colors.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600' as const, color: isSelected ? '#FFF' : colors.textSecondary, marginTop: 4 }}>
                        {pm.label}
                      </Text>
                      {isCardDisabled ? (
                        <Text style={{ fontSize: 8, color: colors.danger, marginTop: 2 }}>Non configur\u00e9</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: 4 }}>
              <TouchableOpacity
                style={[
                  s.cinetpayBtn,
                  {
                    backgroundColor: banking.isDigitalPaymentAvailable ? '#00D4AA' : '#9CA3AF',
                    opacity: cinetpay.loading ? 0.6 : 1,
                  },
                ]}
                onPress={() => {
                  if (!banking.isDigitalPaymentAvailable) {
                    showToast('Veuillez configurer vos informations bancaires dans Param\u00e8tres \u2192 Administration \u2192 Paiements', 'error');
                    return;
                  }
                  setSelectedCategory('digital');
                  setTpeConnecting(false);
                }}
                disabled={cinetpay.loading || cart.length === 0}
                activeOpacity={0.8}
              >
                {cinetpay.loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Smartphone size={20} color="#FFF" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' as const }}>
                    Paiement Digital
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 }}>
                    Wave, Orange Money, TWINT
                  </Text>
                </View>
                {!banking.isDigitalPaymentAvailable ? (
                  <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '600' as const, opacity: 0.8 }}>Non configur\u00e9</Text>
                ) : null}
              </TouchableOpacity>
            </View>

            {selectedCategory === 'cash' && (
              <View style={[s.cashCalcSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12 }}>
                  <Calculator size={16} color={colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.text }}>Rendu monnaie</Text>
                </View>
                <View style={{ gap: 10 }}>
                  <View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Montant donné</Text>
                    <TextInput
                      style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                      value={cashGiven}
                      onChangeText={setCashGiven}
                      placeholder="0,00"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                  </View>
                  <View style={s.cashQuickBtns}>
                    {[5, 10, 20, 50, 100].map((amount) => (
                      <TouchableOpacity
                        key={amount}
                        style={[s.cashQuickBtn, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}
                        onPress={() => setCashGiven(String(amount))}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.text }}>{amount}€</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {(() => {
                    const given = parseFloat(cashGiven.replace(',', '.'));
                    if (cashGiven.length > 0 && !isNaN(given) && given >= cartTotals.totalTTC) {
                      return (
                        <View style={[s.changeDisplay, { backgroundColor: '#ECFDF5' }]}>
                          <Text style={{ fontSize: 13, color: '#059669' }}>Monnaie à rendre</Text>
                          <Text style={{ fontSize: 24, fontWeight: '800' as const, color: '#059669' }}>
                            {formatCurrency(cashChange, cur)}
                          </Text>
                        </View>
                      );
                    }
                    if (cashGiven.length > 0 && !isNaN(given) && given > 0 && given < cartTotals.totalTTC) {
                      return (
                        <View style={[s.changeDisplay, { backgroundColor: '#FEF2F2' }]}>
                          <Text style={{ fontSize: 13, color: '#DC2626' }}>Montant manquant</Text>
                          <Text style={{ fontSize: 24, fontWeight: '800' as const, color: '#DC2626' }}>
                            {formatCurrency(cartTotals.totalTTC - given, cur)}
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              </View>
            )}

            {selectedCategory === 'card' && (
              <View style={[s.cashCalcSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12 }}>
                  <CreditCard size={16} color={colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.text }}>Paiement par Carte Bancaire</Text>
                </View>
                {tpeConnecting ? (
                  <View style={[s.changeDisplay, { backgroundColor: '#EFF6FF', gap: 10 }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1E40AF' }}>Connexion au TPE en cours...</Text>
                    <Text style={{ fontSize: 12, color: '#3B82F6' }}>En attente de la confirmation du terminal</Text>
                  </View>
                ) : (
                  <View style={[s.changeDisplay, { backgroundColor: '#F0FDF4' }]}>
                    <CreditCard size={20} color="#16A34A" />
                    <Text style={{ fontSize: 13, color: '#15803D', textAlign: 'center' as const }}>
                      Cliquez sur "Valider" pour initier le paiement via le TPE. La vente sera validée automatiquement après confirmation du terminal.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedCategory === 'digital' && (
              <View style={[s.cashCalcSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12 }}>
                  <Smartphone size={16} color={colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.text }}>Paiement Digital</Text>
                </View>
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row' as const, gap: 8 }}>
                    {DIGITAL_SUB_METHODS.map((dm) => {
                      const isActive = digitalSubMethod === dm.value;
                      return (
                        <TouchableOpacity
                          key={dm.value}
                          style={[s.mixedMethodChip, { backgroundColor: isActive ? dm.color : colors.inputBg, borderColor: isActive ? dm.color : colors.inputBorder, flex: 1, justifyContent: 'center' as const }]}
                          onPress={() => setDigitalSubMethod(dm.value)}
                        >
                          <Smartphone size={12} color={isActive ? '#FFF' : colors.textSecondary} />
                          <Text style={{ fontSize: 11, fontWeight: '600' as const, color: isActive ? '#FFF' : colors.textSecondary }}>{dm.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                      {t('pos.phoneNumber')} <Text style={{ color: colors.danger }}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        s.cashInput,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: mobilePhone.trim().length === 0 ? colors.inputBorder : '#10B981',
                          color: colors.text,
                        },
                      ]}
                      value={mobilePhone}
                      onChangeText={setMobilePhone}
                      placeholder="+221 7X XXX XX XX"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="phone-pad"
                    />
                    {mobilePhone.trim().length === 0 ? (
                      <Text style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>{t('pos.phoneRequiredHint')}</Text>
                    ) : null}
                  </View>
                  {tpeConnecting ? (
                    <View style={[s.changeDisplay, { backgroundColor: '#EFF6FF', gap: 10 }]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1E40AF' }}>Vérification du paiement...</Text>
                      <Text style={{ fontSize: 12, color: '#3B82F6' }}>En attente de la confirmation {DIGITAL_SUB_METHODS.find(d => d.value === digitalSubMethod)?.label}</Text>
                    </View>
                  ) : (
                    <View style={[s.changeDisplay, { backgroundColor: '#F0FDF4' }]}>
                      <Smartphone size={16} color="#16A34A" />
                      <Text style={{ fontSize: 12, color: '#15803D', textAlign: 'center' as const }}>
                        Cliquez sur "Valider" pour initier le paiement. La vente sera validée après confirmation.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {selectedCategory === 'mixed' && (
              <View style={[s.cashCalcSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12 }}>
                  <ArrowRightLeft size={16} color={colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.text }}>Paiement mixte</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                  Répartissez le montant de {formatCurrency(cartTotals.totalTTC, cur)} entre deux modes de paiement.
                </Text>
                <View style={{ gap: 14 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary }}>1er mode</Text>
                    <View style={{ flexDirection: 'row' as const, gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {MIXED_SUB_METHODS.map((pm) => (
                            <TouchableOpacity
                              key={`m1_${pm.value}`}
                              style={[s.mixedMethodChip, { backgroundColor: mixedMethod1 === pm.value ? colors.primary : colors.inputBg, borderColor: mixedMethod1 === pm.value ? colors.primary : colors.inputBorder }]}
                              onPress={() => setMixedMethod1(pm.value)}
                            >
                              <pm.icon size={12} color={mixedMethod1 === pm.value ? '#FFF' : colors.textSecondary} />
                              <Text style={{ fontSize: 11, fontWeight: '600' as const, color: mixedMethod1 === pm.value ? '#FFF' : colors.textSecondary }}>{pm.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    <TextInput
                      style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                      value={mixedAmount1}
                      onChangeText={(val) => {
                        setMixedAmount1(val);
                        const parsed = parseFloat(val.replace(',', '.'));
                        if (!isNaN(parsed) && parsed >= 0) {
                          const remainder = Math.max(0, cartTotals.totalTTC - parsed);
                          setMixedAmount2(remainder.toFixed(2).replace('.', ','));
                        }
                      }}
                      placeholder="Montant"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary }}>2e mode</Text>
                    <View style={{ flexDirection: 'row' as const, gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {MIXED_SUB_METHODS.map((pm) => (
                            <TouchableOpacity
                              key={`m2_${pm.value}`}
                              style={[s.mixedMethodChip, { backgroundColor: mixedMethod2 === pm.value ? colors.primary : colors.inputBg, borderColor: mixedMethod2 === pm.value ? colors.primary : colors.inputBorder }]}
                              onPress={() => setMixedMethod2(pm.value)}
                            >
                              <pm.icon size={12} color={mixedMethod2 === pm.value ? '#FFF' : colors.textSecondary} />
                              <Text style={{ fontSize: 11, fontWeight: '600' as const, color: mixedMethod2 === pm.value ? '#FFF' : colors.textSecondary }}>{pm.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    <TextInput
                      style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                      value={mixedAmount2}
                      onChangeText={(val) => {
                        setMixedAmount2(val);
                        const parsed = parseFloat(val.replace(',', '.'));
                        if (!isNaN(parsed) && parsed >= 0) {
                          const remainder = Math.max(0, cartTotals.totalTTC - parsed);
                          setMixedAmount1(remainder.toFixed(2).replace('.', ','));
                        }
                      }}
                      placeholder="Montant"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  {(() => {
                    const a1 = parseFloat(mixedAmount1.replace(',', '.')) || 0;
                    const a2 = parseFloat(mixedAmount2.replace(',', '.')) || 0;
                    const total = a1 + a2;
                    const isValid = Math.abs(total - cartTotals.totalTTC) < 0.01;
                    return (
                      <View style={[s.changeDisplay, { backgroundColor: isValid ? '#ECFDF5' : '#FEF2F2' }]}>
                        <Text style={{ fontSize: 12, fontWeight: '600' as const, color: isValid ? '#059669' : '#DC2626' }}>
                          Total : {formatCurrency(total, cur)} / {formatCurrency(cartTotals.totalTTC, cur)}
                          {isValid ? ' ✓' : ' — montant incorrect'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            )}

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 8 }}>Client (optionnel)</Text>
              <TouchableOpacity
                style={[s.paymentClientBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                onPress={() => setShowClientPicker(!showClientPicker)}
              >
                <UserPlus size={14} color={colors.textSecondary} />
                <Text style={{ flex: 1, fontSize: 13, color: selectedClientId ? colors.text : colors.textTertiary }} numberOfLines={1}>
                  {selectedClientId
                    ? effectiveClients.find((c) => c.id === selectedClientId)?.companyName ||
                      (() => { const cl = effectiveClients.find((c) => c.id === selectedClientId); return cl ? `${cl.firstName} ${cl.lastName}` : 'Client'; })()
                    : 'Aucun client sélectionné'}
                </Text>
                {selectedClientId ? (
                  <TouchableOpacity onPress={() => setSelectedClientId('')} hitSlop={8}>
                    <X size={14} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[s.paymentModalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[
                s.validateSaleBtn,
                { backgroundColor: isPaymentValid ? '#10B981' : '#9CA3AF' },
              ]}
              onPress={handleCheckout}
              activeOpacity={isPaymentValid ? 0.8 : 1}
              disabled={!isPaymentValid}
            >
              <Check size={20} color="#FFF" />
              <Text style={s.validateSaleBtnText}>{t('pos.validateSale')} — {formatCurrency(cartTotals.totalTTC, cur)}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderMobileCartSheet = () => (
    <Modal visible={showMobileCart} transparent animationType="slide" onRequestClose={() => setShowMobileCart(false)}>
      <View style={s.bottomSheetOverlay}>
        <Pressable style={s.bottomSheetBackdrop} onPress={() => setShowMobileCart(false)} />
        <View style={[s.bottomSheet, { backgroundColor: colors.card }]}>
          <View style={[s.bottomSheetHandle, { backgroundColor: colors.textTertiary }]} />
          <View style={s.cartHeader}>
            <View style={s.cartHeaderLeft}>
              <ShoppingCart size={18} color={colors.primary} />
              <Text style={[s.cartTitle, { color: colors.text }]}>Panier</Text>
            </View>
            <TouchableOpacity onPress={() => setShowMobileCart(false)} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {renderCartContent()}
        </View>
      </View>
    </Modal>
  );

  const renderVariantPicker = () => {
    if (!variantPickerProduct) return null;
    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={() => setVariantPickerProductId(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setVariantPickerProductId(null)}>
          <Pressable style={[s.variantModal, { backgroundColor: colors.card, width: isMobile ? width - 32 : 400 }]} onPress={(e) => e.stopPropagation()}>
            <View style={[s.paymentModalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700' as const, color: colors.text }}>{variantPickerProduct.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Choisir une variante</Text>
              </View>
              <TouchableOpacity onPress={() => setVariantPickerProductId(null)} hitSlop={8}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
              {variantPickerVariants.map((v) => {
                const label = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' — ');
                const inCart = cart.find((c) => c.variantId === v.id);
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      s.variantOption,
                      {
                        backgroundColor: inCart ? `${colors.primary}08` : colors.background,
                        borderColor: inCart ? colors.primary : colors.cardBorder,
                        borderWidth: inCart ? 2 : 1,
                      },
                    ]}
                    onPress={() => {
                      addToCart(variantPickerProduct.id, v);
                      setVariantPickerProductId(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text }}>{label}</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                        Stock: {v.stockQuantity} {v.sku ? `· ${v.sku}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' as const }}>
                      <Text style={{ fontSize: 16, fontWeight: '700' as const, color: colors.primary }}>
                        {formatCurrency(v.salePrice, cur)}
                      </Text>
                      {inCart && (
                        <View style={[s.tileCartBadge, { position: 'relative' as const, top: 0, right: 0, marginTop: 4 }]}>
                          <Text style={s.tileCartBadgeText}>{inCart.quantity}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderManualEntry = () => (
    <Modal visible={manualEntryVisible} transparent animationType="fade" onRequestClose={() => setManualEntryVisible(false)}>
      <Pressable style={s.modalOverlay} onPress={() => setManualEntryVisible(false)}>
        <Pressable style={[s.variantModal, { backgroundColor: colors.card, width: isMobile ? width - 32 : 380 }]} onPress={(e) => e.stopPropagation()}>
          <View style={[s.paymentModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ fontSize: 16, fontWeight: '700' as const, color: colors.text }}>Saisie manuelle</Text>
            <TouchableOpacity onPress={() => setManualEntryVisible(false)} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 14 }}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 4 }}>Désignation</Text>
              <TextInput
                style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={manualName}
                onChangeText={setManualName}
                placeholder="Nom de l'article"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            </View>
            <View style={{ flexDirection: 'row' as const, gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 4 }}>Prix HT (€)</Text>
                <TextInput
                  style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  value={manualPrice}
                  onChangeText={setManualPrice}
                  placeholder="0,00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 4 }}>TVA (%)</Text>
                <View style={{ flexDirection: 'row' as const, gap: 6 }}>
                  {['0', '5.5', '10', '20'].map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[
                        s.vatChip,
                        {
                          backgroundColor: manualVat === rate ? colors.primary : colors.inputBg,
                          borderColor: manualVat === rate ? colors.primary : colors.inputBorder,
                        },
                      ]}
                      onPress={() => setManualVat(rate)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600' as const, color: manualVat === rate ? '#FFF' : colors.textSecondary }}>
                        {rate}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[s.validateSaleBtn, { backgroundColor: colors.primary, opacity: manualName.trim() && manualPrice.trim() ? 1 : 0.5 }]}
              onPress={handleManualEntry}
              disabled={!manualName.trim() || !manualPrice.trim()}
            >
              <Plus size={18} color="#FFF" />
              <Text style={s.validateSaleBtnText}>Ajouter au panier</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderSaleForm = () => (
    <>
      {saleFormError ? (
        <View style={[s.saleFormError, { backgroundColor: colors.dangerLight }]}>
          <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.danger }}>{saleFormError}</Text>
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }}>Client (optionnel)</Text>
        <TouchableOpacity
          style={[s.saleFormClientBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          onPress={() => setSaleFormShowClientPicker(!saleFormShowClientPicker)}
        >
          <UserPlus size={15} color={colors.textSecondary} />
          <Text style={{ flex: 1, fontSize: 13, color: saleFormClientId ? colors.text : colors.textTertiary }} numberOfLines={1}>
            {saleFormClientId
              ? (effectiveClients.find((c) => c.id === saleFormClientId)?.companyName ||
                (() => { const cl = effectiveClients.find((c) => c.id === saleFormClientId); return cl ? `${cl.firstName} ${cl.lastName}` : 'Client'; })())
              : 'Sélectionner un client'}
          </Text>
          {saleFormClientId ? (
            <TouchableOpacity onPress={() => { setSaleFormClientId(''); setSaleFormShowClientPicker(false); }} hitSlop={8}>
              <X size={14} color={colors.danger} />
            </TouchableOpacity>
          ) : (
            <ChevronDown size={14} color={colors.textTertiary} />
          )}
        </TouchableOpacity>
        {saleFormShowClientPicker && (
          <View style={[s.saleFormDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[s.saleFormDropdownSearch, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              placeholder="Rechercher..."
              placeholderTextColor={colors.textTertiary}
              value={saleFormClientSearch}
              onChangeText={setSaleFormClientSearch}
            />
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {saleFormFilteredClients.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={[s.saleFormDropdownItem, { borderBottomColor: colors.borderLight }, client.id === saleFormClientId && { backgroundColor: colors.primaryLight }]}
                  onPress={() => { setSaleFormClientId(client.id); setSaleFormShowClientPicker(false); setSaleFormClientSearch(''); }}
                >
                  <Text style={{ fontSize: 13, color: colors.text }}>
                    {client.companyName || `${client.firstName} ${client.lastName}`}
                  </Text>
                  {client.id === saleFormClientId && <Check size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }}>Moyen de paiement</Text>
        <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 }}>
          {PAYMENT_CATEGORIES.map((pm) => {
            const isSelected = (pm.value === 'digital' && isDigitalMethod(saleFormPayment)) || saleFormPayment === pm.value;
            return (
              <TouchableOpacity
                key={pm.value}
                style={[s.saleFormPaymentBtn, { backgroundColor: isSelected ? colors.primary : colors.inputBg, borderColor: isSelected ? colors.primary : colors.inputBorder }]}
                onPress={() => setSaleFormPayment(pm.value === 'digital' ? 'mobile_wave' : pm.value as SalePaymentMethod)}
              >
                <pm.icon size={14} color={isSelected ? '#FFF' : colors.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: '600' as const, color: isSelected ? '#FFF' : colors.textSecondary }}>{pm.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }}>Produits</Text>
        <View style={[s.saleFormProductSearch, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Search size={15} color={colors.textTertiary} />
          <TextInput
            style={[s.saleFormProductInput, { color: colors.text }]}
            placeholder="Rechercher un produit..."
            placeholderTextColor={colors.textTertiary}
            value={saleFormProductSearch}
            onChangeText={setSaleFormProductSearch}
          />
        </View>
        {saleFormProductSearch.length > 0 && (
          <View style={[s.saleFormDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {saleFormFilteredProducts.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[s.saleFormDropdownItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => addToSaleForm(product.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>{product.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{product.sku}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.primary }}>{formatCurrency(product.salePrice, cur)}</Text>
                </TouchableOpacity>
              ))}
              {saleFormFilteredProducts.length === 0 && (
                <Text style={{ padding: 16, textAlign: 'center' as const, fontSize: 13, color: colors.textTertiary }}>Aucun produit trouvé</Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>
      {saleFormItems.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }}>Articles ({saleFormItems.length})</Text>
          {saleFormItems.map((item, formIdx) => {
            const lineHT = item.unitPrice * item.quantity;
            const lineTVA = lineHT * (item.vatRate / 100);
            const lineTTC = lineHT + lineTVA;
            return (
              <View key={`sf_${formIdx}_${item.productId}_${item.variantId || 'base'}`} style={[s.saleFormItem, { borderColor: colors.borderLight }]}>
                <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.text }} numberOfLines={1}>{item.productName}</Text>
                    {item.variantLabel ? <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>{item.variantLabel}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => removeSaleFormItem(item.productId, item.variantId)} hitSlop={8}>
                    <Trash2 size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                    <TouchableOpacity style={[s.saleFormQtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => updateSaleFormQty(item.productId, -1, item.variantId)}>
                      <Minus size={12} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text, minWidth: 20, textAlign: 'center' as const }}>{item.quantity}</Text>
                    <TouchableOpacity style={[s.saleFormQtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => updateSaleFormQty(item.productId, 1, item.variantId)}>
                      <Plus size={12} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ alignItems: 'flex-end' as const }}>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{formatCurrency(item.unitPrice, cur)} × {item.quantity} · TVA {item.vatRate}%</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.text }}>{formatCurrency(lineTTC, cur)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4, gap: 4 }}>
            <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(saleFormTotals.totalHT, cur)}</Text>
            </View>
            <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(saleFormTotals.totalTVA, cur)}</Text>
            </View>
            <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '700' as const, color: colors.text }}>Total TTC</Text>
              <Text style={{ fontSize: 18, fontWeight: '800' as const, color: colors.primary }}>{formatCurrency(saleFormTotals.totalTTC, cur)}</Text>
            </View>
          </View>
        </View>
      )}
    </>
  );

  const renderHistory = () => (
    <View style={s.historyContainer}>
      <View style={[s.filterRow, isMobile && { flexDirection: 'column' as const, alignItems: 'stretch' as const }]}>
        <View style={[s.historySearchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[s.posSearchInput, { color: colors.text }]}
            placeholder="Rechercher une vente..."
            placeholderTextColor={colors.textTertiary}
            value={historySearch}
            onChangeText={setHistorySearch}
          />
        </View>
        <View style={s.dateFilters}>
          {DATE_FILTER_KEYS.map((df) => (
            <TouchableOpacity
              key={df.value}
              style={[
                s.dateFilterBtn,
                {
                  backgroundColor: dateFilter === df.value ? colors.primary : colors.inputBg,
                  borderColor: dateFilter === df.value ? colors.primary : colors.inputBorder,
                },
              ]}
              onPress={() => setDateFilter(df.value)}
            >
              <Text style={{ fontSize: 12, fontWeight: '600' as const, color: dateFilter === df.value ? '#FFF' : colors.textSecondary }}>
                {t(df.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {[{ value: 'all' as PaymentMethodFilter, label: 'Tout' }, ...ALL_PAYMENT_CATEGORIES_WITH_DIGITAL.map(pm => ({ value: pm.value as PaymentMethodFilter, label: pm.label }))].map((pf) => (
            <TouchableOpacity
              key={pf.value}
              style={[
                s.dateFilterBtn,
                {
                  backgroundColor: paymentMethodFilter === pf.value ? colors.primary : colors.inputBg,
                  borderColor: paymentMethodFilter === pf.value ? colors.primary : colors.inputBorder,
                },
              ]}
              onPress={() => setPaymentMethodFilter(pf.value)}
            >
              <Text style={{ fontSize: 11, fontWeight: '600' as const, color: paymentMethodFilter === pf.value ? '#FFF' : colors.textSecondary }}>
                {pf.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={[s.salesTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {!isMobile && (
          <View style={[s.tableHeader, { backgroundColor: colors.surfaceHover, borderBottomColor: colors.border }]}>
            <Text style={[s.thCell, { width: 130 }]}>N° Vente</Text>
            <Text style={[s.thCell, { width: 150 }]}>Date</Text>
            <Text style={[s.thCell, { width: 120 }]}>Paiement</Text>
            <Text style={[s.thCell, { flex: 1, textAlign: 'right' as const }]}>Montant TTC</Text>
          </View>
        )}
        <ScrollView showsVerticalScrollIndicator={false}>
          {filteredSales.length === 0 ? (
            <View style={s.emptyState}>
              <Receipt size={40} color={colors.textTertiary} />
              <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 8 }}>Aucune vente pour cette période</Text>
            </View>
          ) : (
            filteredSales.map((sale) => (
              <View key={sale.id}>
                {isMobile ? (
                  <TouchableOpacity
                    style={[s.mobileCard, { borderBottomColor: colors.borderLight }]}
                    onPress={() => setSelectedSale(selectedSale === sale.id ? null : sale.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.primary }}>{sale.saleNumber}</Text>
                      <StatusBadge status={sale.status} />
                    </View>
                    <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatDateTime(sale.createdAt)}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{sale.clientName || '—'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const }}>
                      <Text style={{ fontSize: 12, color: colors.textTertiary }}>{getPaymentMethodLabel(sale.paymentMethod)}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700' as const, color: colors.text }}>{formatCurrency(sale.totalTTC, cur)}</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[s.historyRow, { borderBottomColor: colors.borderLight }, selectedSale === sale.id && { backgroundColor: colors.primaryLight }]}
                    onPress={() => setSelectedSale(selectedSale === sale.id ? null : sale.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ width: 130, fontSize: 13, color: colors.primary, fontWeight: '600' as const }}>{sale.saleNumber}</Text>
                    <Text style={{ width: 150, fontSize: 13, color: colors.textSecondary }}>{formatDateTime(sale.createdAt)}</Text>
                    <Text style={{ width: 120, fontSize: 13, color: colors.textSecondary }}>{getPaymentMethodLabel(sale.paymentMethod)}</Text>
                    <Text style={{ flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' as const, textAlign: 'right' as const }}>{formatCurrency(sale.totalTTC, cur)}</Text>
                  </TouchableOpacity>
                )}

                {selectedSale === sale.id && (
                  <View style={[s.saleDetail, { backgroundColor: colors.surfaceHover, borderBottomColor: colors.border }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700' as const, color: colors.text, marginBottom: 8 }}>Détail de la vente</Text>
                    {sale.clientName ? (
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Client : {sale.clientName}</Text>
                    ) : null}
                    {sale.items.map((item) => (
                      <View key={item.id} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 12, flexWrap: 'wrap' as const }}>
                        <Text style={{ fontSize: 13, fontWeight: '500' as const, flex: 1, minWidth: 120, color: colors.text }}>{item.productName}</Text>
                        <Text style={{ fontSize: 12, width: 40, color: colors.textSecondary }}>×{item.quantity}</Text>
                        <Text style={{ fontSize: 12, width: 80, color: colors.textSecondary }}>{formatCurrency(item.unitPrice, cur)} HT</Text>
                        <Text style={{ fontSize: 11, width: 60, color: colors.textTertiary }}>TVA {item.vatRate}%</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600' as const, width: 80, textAlign: 'right' as const, color: colors.text }}>{formatCurrency(item.totalTTC, cur)}</Text>
                      </View>
                    ))}
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        HT: {formatCurrency(sale.totalHT, cur)} | TVA: {formatCurrency(sale.totalTVA, cur)} | TTC: {formatCurrency(sale.totalTTC, cur)}
                      </Text>
                    </View>
                    {sale.status === 'paid' && (
                      <View style={{ flexDirection: 'row' as const, gap: 8, marginTop: 12, flexWrap: 'wrap' as const }}>
                        <TouchableOpacity style={[s.mobileActionBtn, { backgroundColor: colors.primaryLight }]} onPress={() => openEditSaleForm(sale.id)}>
                          <Pencil size={14} color={colors.primary} />
                          <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.primary }}>Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.mobileActionBtn, { backgroundColor: colors.dangerLight }]} onPress={() => setRefundConfirm(sale.id)}>
                          <RotateCcw size={14} color={colors.danger} />
                          <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.danger }}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.mobileActionBtn, { backgroundColor: colors.surfaceHover }]} onPress={() => handlePrintReceipt(sale.id)}>
                          <Printer size={14} color={colors.text} />
                          <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.text }}>Imprimer</Text>
                        </TouchableOpacity>
                        {!sale.clientId && (
                          <TouchableOpacity style={[s.mobileActionBtn, { backgroundColor: colors.warningLight }]} onPress={() => { setAssignClientModal(sale.id); setAssignClientId(''); setAssignClientSearch(''); }}>
                            <UserPlus size={14} color={colors.warning} />
                            <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.warning }}>Client</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <PageHeader title="Caisse" />

      <View style={[s.tabs, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'pos' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('pos')}
        >
          <ShoppingBag size={16} color={activeTab === 'pos' ? colors.primary : colors.textSecondary} />
          <Text style={{ fontSize: 14, fontWeight: '600' as const, color: activeTab === 'pos' ? colors.primary : colors.textSecondary }}>
            Caisse
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'history' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('history')}
        >
          <Receipt size={16} color={activeTab === 'history' ? colors.primary : colors.textSecondary} />
          <Text style={{ fontSize: 14, fontWeight: '600' as const, color: activeTab === 'history' ? colors.primary : colors.textSecondary }}>
            Historique
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'pos' ? (
        <View style={{ flex: 1 }}>
          {renderPOS()}
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {renderHistory()}
        </ScrollView>
      )}

      {renderPaymentModal()}
      {renderMobileCartSheet()}
      {renderVariantPicker()}
      {renderManualEntry()}

      <FormModal
        visible={saleFormVisible}
        onClose={() => setSaleFormVisible(false)}
        title={editingSaleId ? 'Modifier la vente' : 'Nouvelle vente'}
        subtitle={editingSaleId ? 'Mettre à jour les informations' : 'Créer une vente manuellement'}
        onSubmit={handleSaleFormSubmit}
        submitLabel={editingSaleId ? 'Mettre à jour' : 'Encaisser'}
        width={520}
      >
        {renderSaleForm()}
      </FormModal>

      <ConfirmModal
        visible={refundConfirm !== null}
        title="Rembourser la vente"
        message={`Êtes-vous sûr de vouloir rembourser la vente ${sales.find((sa) => sa.id === refundConfirm)?.saleNumber ?? ''} ?`}
        confirmLabel="Rembourser"
        destructive
        onConfirm={() => { if (refundConfirm) refundSale(refundConfirm); setRefundConfirm(null); }}
        onClose={() => setRefundConfirm(null)}
      />

      <ConfirmModal
        visible={convertConfirm !== null}
        title="Convertir en facture"
        message={`Convertir la vente ${sales.find((sa) => sa.id === convertConfirm)?.saleNumber ?? ''} en facture brouillon ?`}
        confirmLabel="Convertir"
        onConfirm={() => { if (convertConfirm) convertSaleToInvoice(convertConfirm); setConvertConfirm(null); }}
        onClose={() => setConvertConfirm(null)}
      />

      {assignClientModal !== null && (
        <View style={s.assignOverlay}>
          <View style={[s.assignModal, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[s.paymentModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: 16, fontWeight: '700' as const, color: colors.text }}>Associer un client</Text>
              <TouchableOpacity onPress={() => setAssignClientModal(null)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[s.assignSearch, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              placeholder="Rechercher..."
              placeholderTextColor={colors.textTertiary}
              value={assignClientSearch}
              onChangeText={setAssignClientSearch}
            />
            <ScrollView style={{ maxHeight: 200, marginHorizontal: 16 }}>
              {filteredClientsForAssign.map((client) => {
                const name = client.companyName || `${client.firstName} ${client.lastName}`;
                const isSelected = assignClientId === client.id;
                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[s.assignItem, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: colors.primaryLight }]}
                    onPress={() => setAssignClientId(client.id)}
                  >
                    <Text style={{ fontSize: 13, color: colors.text }}>{name}</Text>
                    {isSelected && <Check size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[s.assignBtn, { backgroundColor: assignClientId ? colors.primary : colors.textTertiary }]}
              disabled={!assignClientId}
              onPress={() => {
                if (assignClientModal && assignClientId) assignClientToSale(assignClientModal, assignClientId);
                setAssignClientModal(null);
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' as const }}>Associer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SaleConfirmationModal
        visible={!!confirmSale}
        sale={confirmSale ? sales.find(s => s.id === confirmSale) ?? null : null}
        onClose={() => setConfirmSale(null)}
        onNewSale={() => { setConfirmSale(null); setActiveTab('pos'); }}
      />

      <PaymentStatusModal
        visible={cinetpay.active}
        transactionId={cinetpay.transactionId}
        paymentUrl={cinetpay.paymentUrl}
        amount={cartTotals.totalTTC}
        currency={effectiveCompany.currency || 'XOF'}
        onCompleted={() => {
          const saleItems: SaleItem[] = cart.map((c) => {
            const lineHT = c.unitPrice * c.quantity;
            const lineTVA = lineHT * (c.vatRate / 100);
            const lineTTC = lineHT + lineTVA;
            return {
              id: generateItemId(),
              saleId: '',
              productId: c.productId,
              productName: c.productName,
              quantity: c.quantity,
              unitPrice: c.unitPrice,
              vatRate: c.vatRate,
              totalHT: lineHT,
              totalTVA: lineTVA,
              totalTTC: lineTTC,
            };
          });
          const result = createSale(saleItems, 'mobile' as SalePaymentMethod, selectedClientId || undefined);
          if (result.success && result.saleId) {
            setReceiptSaleId(result.saleId);
          }
          showToast(t('payment.successTitle'));
          resetCartState();
        }}
        onCancel={() => {
          setCinetpay({ active: false, loading: false, transactionId: null, paymentUrl: null });
        }}
        onRetry={handleCinetPayCheckout}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row' as const, borderBottomWidth: 1, paddingHorizontal: 24 },
  tab: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 12, paddingHorizontal: 16, gap: 6, marginBottom: -1 },

  splitLayout: { flex: 1, flexDirection: 'row' as const },
  cartPanel: { width: '32%' as unknown as number, minWidth: 280, borderLeftWidth: 1, flexDirection: 'column' as const },
  productsPanel: { flex: 1 },

  productsSection: { flex: 1, paddingHorizontal: 12, paddingTop: 4, gap: 0 },
  posSearchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginBottom: 2 },
  posSearchInput: { flex: 1, fontSize: 14, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },

  categoryTabs: { flexDirection: 'row' as const, gap: 5, paddingBottom: 0, paddingHorizontal: 1 },
  categoryTab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, height: 28, justifyContent: 'center' as const },
  categoryTabText: { fontSize: 11, fontWeight: '600' as const },

  quickActions: { flexDirection: 'row' as const, gap: 6, marginTop: 2, marginBottom: 0 },
  quickBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  quickBtnText: { fontSize: 12, fontWeight: '600' as const },
  barcodeRow: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, gap: 5 },
  barcodeInput: { flex: 1, fontSize: 13, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  barcodeOkBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },

  productGridContent: { paddingBottom: 80, gap: 0, paddingTop: 4 },
  gridWrap: { 
  flexDirection: 'row' as const, 
  flexWrap: 'wrap' as const, 
  gap: 8, 
  marginBottom: 4,
  alignItems: 'flex-start' as const,  // ← Ajouter cette ligne
},
  productTile: { borderRadius: 12, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  tileImage: { width: '100%' as unknown as number, height: 56 },
  tileImageLarge: { width: '100%' as unknown as number, height: 80 },
  tilePlaceholder: { width: '100%' as unknown as number, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  tilePlaceholderLarge: { width: '100%' as unknown as number, height: 64, alignItems: 'center' as const, justifyContent: 'center' as const },

  viewToggle: { flexDirection: 'row' as const, gap: 2, marginLeft: 4 },
  viewToggleBtn: { width: 28, height: 28, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 6 },

  categoryGroupHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 6, marginBottom: 4 },
  categoryGroupHeaderText: { fontSize: 12, fontWeight: '700' as const, flex: 1 },
  categoryGroupHeaderCount: { fontSize: 11, fontWeight: '500' as const },

  listContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' as const, marginBottom: 4 },
  listRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomWidth: 1 },
  listThumb: { width: 38, height: 38, borderRadius: 8 },
  listThumbPlaceholder: { width: 38, height: 38, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  listName: { fontSize: 13, fontWeight: '600' as const },
  listPrice: { fontSize: 13, fontWeight: '800' as const },
  listStock: { fontSize: 11, fontWeight: '500' as const, minWidth: 30, textAlign: 'right' as const },
  tileOutOfStock: { opacity: 0.45 },
  tileRuptureBadge: { position: 'absolute' as const, top: 4, right: 4, backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tileRuptureBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '700' as const, letterSpacing: 0.3 },
  tileCartBadge: { position: 'absolute' as const, top: 6, right: 6, backgroundColor: '#3B82F6', width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  tileCartBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  tileVariantBadge: { position: 'absolute' as const, top: 6, left: 6, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8 },
  tileBody: { padding: 6, gap: 1 },
  tileName: { fontSize: 11, fontWeight: '600' as const, lineHeight: 15 },
  tileFooter: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-end' as const, marginTop: 2 },
  tilePrice: { fontSize: 15, fontWeight: '800' as const },
  tileStockSmall: { fontSize: 9, fontWeight: '500' as const },

  cartHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 8 },
  cartHeaderLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  cartTitle: { fontSize: 16, fontWeight: '700' as const },
  clientSelector: { flexDirection: 'row' as const, alignItems: 'center' as const, marginHorizontal: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 6, marginBottom: 4 },
  clientSelectorText: { flex: 1, fontSize: 13 },
  clientDropdown: { marginHorizontal: 16, borderRadius: 10, borderWidth: 1, maxHeight: 200, marginBottom: 6, overflow: 'hidden' as const },
  clientDropdownSearch: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderBottomWidth: 1, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  clientDropdownItem: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },

  cartList: { flex: 1, paddingHorizontal: 12 },
  cartEmpty: { alignItems: 'center' as const, paddingVertical: 40, gap: 8 },
  cartEmptyText: { fontSize: 14, fontWeight: '500' as const },
  cartEmptyHint: { fontSize: 12 },
  cartItem: { paddingVertical: 12, borderBottomWidth: 1 },
  cartItemTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 8 },
  cartItemName: { fontSize: 13, fontWeight: '600' as const, flex: 1, marginRight: 8 },
  cartItemBottom: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  qtyControl: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  qtyText: { fontSize: 16, fontWeight: '700' as const, minWidth: 24, textAlign: 'center' as const },
  cartItemTotal: { fontSize: 15, fontWeight: '700' as const },

  cartFooter: { borderTopWidth: 1, padding: 12 },
  totalsBlock: { marginBottom: 10 },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 2 },

  payBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 14, borderRadius: 12, gap: 8 },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' as const, letterSpacing: 1 },

  receiptBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 6, marginTop: 8 },
  receiptBtnText: { fontSize: 13, fontWeight: '600' as const },

  floatingCartBtn: { position: 'absolute' as const, bottom: 20, right: 20, left: 20, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 16, borderRadius: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  floatingCartBadge: { backgroundColor: '#FFF', width: 24, height: 24, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  floatingCartBadgeText: { fontSize: 13, fontWeight: '800' as const, color: '#3B82F6' },
  floatingCartTotal: { color: '#FFF', fontSize: 17, fontWeight: '700' as const },

  bottomSheetOverlay: { flex: 1, justifyContent: 'flex-end' as const },
  bottomSheetBackdrop: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { maxHeight: '85%' as unknown as number, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8 },
  bottomSheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' as const, marginBottom: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const },
  paymentModal: { borderRadius: 16, maxHeight: '90%' as unknown as number, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12, overflow: 'hidden' as const },
  paymentModalHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 20, borderBottomWidth: 1 },
  paymentModalTitle: { fontSize: 18, fontWeight: '700' as const },
  paymentModalFooter: { padding: 20, borderTopWidth: 1 },

  paymentRecap: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 4 },
  paymentGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  paymentMethodBtn: { width: '30%' as unknown as number, flexGrow: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  paymentClientBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 8 },

  cashCalcSection: { padding: 16, borderRadius: 12, borderWidth: 1 },
  cashInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600' as const, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  cardConfirmBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 14, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  cardConfirmCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center' as const, justifyContent: 'center' as const },
  cashQuickBtns: { flexDirection: 'row' as const, gap: 8 },
  cashQuickBtn: { flex: 1, alignItems: 'center' as const, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  changeDisplay: { padding: 16, borderRadius: 10, alignItems: 'center' as const, gap: 4 },

  validateSaleBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 16, borderRadius: 14, gap: 10 },
  validateSaleBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' as const },

  vatChip: { flex: 1, alignItems: 'center' as const, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },

  variantModal: { borderRadius: 16, maxHeight: '80%' as unknown as number, overflow: 'hidden' as const },
  variantOption: { borderRadius: 12, padding: 16, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 },

  historyContainer: { padding: 20, gap: 16 },
  filterRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, flexWrap: 'wrap' as const },
  historySearchBar: { flex: 1, minWidth: 200, flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  dateFilters: { flexDirection: 'row' as const, gap: 6 },
  dateFilterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  salesTable: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' as const, maxHeight: 600 },
  tableHeader: { flexDirection: 'row' as const, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  thCell: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: '#6B7280' },
  historyRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  mobileCard: { padding: 14, borderBottomWidth: 1 },
  saleDetail: { padding: 16, borderBottomWidth: 1 },
  actionBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  mobileActionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },

  emptyState: { alignItems: 'center' as const, paddingVertical: 40, gap: 8 },

  saleFormError: { padding: 12, borderRadius: 8 },
  saleFormClientBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 8 },
  saleFormDropdown: { borderRadius: 10, borderWidth: 1, maxHeight: 200, overflow: 'hidden' as const },
  saleFormDropdownSearch: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderBottomWidth: 1, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  saleFormDropdownItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  saleFormPaymentBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, gap: 6 },
  saleFormProductSearch: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  saleFormProductInput: { flex: 1, fontSize: 13, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  saleFormItem: { borderWidth: 1, borderRadius: 10, padding: 12 },
  saleFormQtyBtn: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const },

  assignOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const, zIndex: 1000 },
  assignModal: { width: 340, maxHeight: 420, borderRadius: 14, borderWidth: 1, overflow: 'hidden' as const },
  assignSearch: { marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, fontSize: 13, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  assignItem: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1 },
  assignBtn: { margin: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' as const },
  mixedMethodChip: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4 },
  expandedVariantRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, gap: 12, flexWrap: 'nowrap' as const },
  cinetpayBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, gap: 12 },
});