/**
 * @fileoverview Hook managing sales history filtering, sale form editing, and client assignment.
 * @hook useSalesHistory
 */

import { useState, useMemo, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { useOffline } from '@/contexts/OfflineContext';
import type { SalePaymentMethod, SaleItem } from '@/types';
import type { DateFilter, PaymentMethodFilter, POSCartItem } from '@/types/sales.types';
import { getPaymentCategory, generateItemId } from '@/constants/paymentMethods';
import { SALES_ALLOWED_TYPES } from '@/constants/productTypes';

export const useSalesHistory = () => {
  const {
    sales, activeProducts, activeClients, createSale, updateSale,
    company,
  } = useData();
  const { isOnline, cachedProducts, cachedClients, cachedCompany } = useOffline();

  const effectiveProducts = isOnline ? activeProducts : (activeProducts.length > 0 ? activeProducts : cachedProducts.filter(p => !p.isArchived && p.isActive));
  const effectiveClients = isOnline ? activeClients : (activeClients.length > 0 ? activeClients : cachedClients.filter(c => !c.isDeleted));
  const effectiveCompany = company?.name ? company : (cachedCompany ?? company);
  const cur = effectiveCompany.currency || 'EUR';

  const salesProducts = useMemo(() =>
    effectiveProducts.filter((p) => SALES_ALLOWED_TYPES.includes(p.type) && p.isAvailableForSale !== false),
    [effectiveProducts]
  );

  const [historySearch, setHistorySearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all');
  const [selectedSale, setSelectedSale] = useState<string | null>(null);

  const [refundConfirm, setRefundConfirm] = useState<string | null>(null);
  const [convertConfirm, setConvertConfirm] = useState<string | null>(null);
  const [assignClientModal, setAssignClientModal] = useState<string | null>(null);
  const [assignClientSearch, setAssignClientSearch] = useState('');
  const [assignClientId, setAssignClientId] = useState('');

  const [saleFormVisible, setSaleFormVisible] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [saleFormItems, setSaleFormItems] = useState<POSCartItem[]>([]);
  const [saleFormPayment, setSaleFormPayment] = useState<SalePaymentMethod>('card');
  const [saleFormClientId, setSaleFormClientId] = useState('');
  const [saleFormProductSearch, setSaleFormProductSearch] = useState('');
  const [saleFormError, setSaleFormError] = useState('');
  const [_saleFormClientSearch, _setSaleFormClientSearch] = useState('');
  const [_saleFormShowClientPicker, _setSaleFormShowClientPicker] = useState(false);

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
        (s) => s.saleNumber.toLowerCase().includes(q) || (s.clientName && s.clientName.toLowerCase().includes(q))
      );
    }
    if (paymentMethodFilter !== 'all') {
      result = result.filter((s) => getPaymentCategory(s.paymentMethod) === paymentMethodFilter);
    }
    return result;
  }, [sales, dateFilter, historySearch, paymentMethodFilter]);

  const filteredClientsForAssign = useMemo(() => {
    if (!assignClientSearch) return effectiveClients.slice(0, 10);
    const q = assignClientSearch.toLowerCase();
    return effectiveClients.filter(
      (c) => (c.companyName && c.companyName.toLowerCase().includes(q)) || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [assignClientSearch, effectiveClients]);

  const saleFormFilteredProducts = useMemo(() => {
    if (!saleFormProductSearch) return salesProducts.slice(0, 20);
    const q = saleFormProductSearch.toLowerCase();
    return salesProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [saleFormProductSearch, salesProducts]);

  const saleFormTotals = useMemo(() => {
    let totalHT = 0, totalTVA = 0, totalTTC = 0;
    saleFormItems.forEach((item) => {
      const lineHT = item.unitPrice * item.quantity;
      const lineTVA = lineHT * (item.vatRate / 100);
      totalHT += lineHT; totalTVA += lineTVA; totalTTC += lineHT + lineTVA;
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
    _setSaleFormClientSearch('');
    _setSaleFormShowClientPicker(false);
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
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.salePrice, vatRate: product.vatRate }];
    });
    setSaleFormProductSearch('');
  }, [effectiveProducts]);

  const updateSaleFormQty = useCallback((productId: string, delta: number, variantId?: string) => {
    setSaleFormItems((prev) =>
      prev.map((c) => {
        const match = variantId ? (c.productId === productId && c.variantId === variantId) : (c.productId === productId && !c.variantId);
        if (match) { const newQty = c.quantity + delta; return newQty > 0 ? { ...c, quantity: newQty } : c; }
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
    if (saleFormItems.length === 0) { setSaleFormError('Ajoutez au moins un produit'); return; }
    const items: SaleItem[] = saleFormItems.map((c) => {
      const lineHT = c.unitPrice * c.quantity;
      const lineTVA = lineHT * (c.vatRate / 100);
      return {
        id: generateItemId(), saleId: editingSaleId || '',
        productId: c.productId, productName: c.productName,
        quantity: c.quantity, unitPrice: c.unitPrice, vatRate: c.vatRate,
        totalHT: lineHT, totalTVA: lineTVA, totalTTC: lineHT + lineTVA,
      };
    });
    let result;
    if (editingSaleId) {
      result = updateSale(editingSaleId, { items, paymentMethod: saleFormPayment, clientId: saleFormClientId || undefined });
    } else {
      result = createSale(items, saleFormPayment, saleFormClientId || undefined);
    }
    if (!result.success) { setSaleFormError(result.error || 'Erreur inconnue'); return; }
    setSaleFormVisible(false);
  }, [saleFormItems, saleFormPayment, saleFormClientId, editingSaleId, createSale, updateSale]);

  return {
    sales, cur,
    historySearch, setHistorySearch,
    dateFilter, setDateFilter,
    paymentMethodFilter, setPaymentMethodFilter,
    selectedSale, setSelectedSale,
    filteredSales, filteredClientsForAssign,
    refundConfirm, setRefundConfirm,
    convertConfirm, setConvertConfirm,
    assignClientModal, setAssignClientModal,
    assignClientSearch, setAssignClientSearch,
    assignClientId, setAssignClientId,
    saleFormVisible, setSaleFormVisible,
    editingSaleId,
    saleFormItems,
    saleFormPayment, setSaleFormPayment,
    saleFormClientId, setSaleFormClientId,
    saleFormProductSearch, setSaleFormProductSearch,
    saleFormError,
    saleFormFilteredProducts, saleFormTotals,
    openEditSaleForm, addToSaleForm, updateSaleFormQty,
    removeSaleFormItem, handleSaleFormSubmit,
  };
};
