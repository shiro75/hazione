/**
 * hooks/usePOSHistory.ts
 *
 * Gère les filtres, la recherche et l'édition dans l'historique des ventes.
 *
 * RESPONSABILITÉS :
 *   - Filtrage par date, recherche textuelle, mode de paiement
 *   - État de sélection / expansion d'une vente
 *   - Formulaire d'édition d'une vente existante
 *   - Actions : remboursement, conversion en facture, attribution client
 */

import { useState, useMemo, useCallback } from 'react';
import type { SaleItem, SalePaymentMethod } from '@/types';
import type { DateFilter, PaymentMethodFilter, POSCartItem } from '@/types/sales.types';
import { generateItemId, getPaymentCategory, isDigitalMethod } from '@/constants/paymentMethods';

type CartItem = POSCartItem;

interface UsePOSHistoryOptions {
  sales: any[];
  salesProducts: any[];
  effectiveProducts: any[];
  effectiveClients: any[];
  createSale: (items: SaleItem[], payment: SalePaymentMethod, clientId?: string) => { success: boolean; error?: string };
  updateSale: (id: string, data: any) => { success: boolean; error?: string };
}

export function usePOSHistory({
  sales, salesProducts, effectiveProducts, effectiveClients, createSale, updateSale,
}: UsePOSHistoryOptions) {

  // ── Filtres historique ─────────────────────────────────────────────────────
  const [historySearch, setHistorySearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all');
  const [selectedSale, setSelectedSale] = useState<string | null>(null);

  // ── Actions sur vente ──────────────────────────────────────────────────────
  const [refundConfirm, setRefundConfirm] = useState<string | null>(null);
  const [convertConfirm, setConvertConfirm] = useState<string | null>(null);
  const [assignClientModal, setAssignClientModal] = useState<string | null>(null);
  const [assignClientSearch, setAssignClientSearch] = useState('');
  const [assignClientId, setAssignClientId] = useState('');

  // ── Formulaire d'édition ───────────────────────────────────────────────────
  const [saleFormVisible, setSaleFormVisible] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [saleFormItems, setSaleFormItems] = useState<CartItem[]>([]);
  const [saleFormPayment, setSaleFormPayment] = useState<SalePaymentMethod>('card');
  const [saleFormClientId, setSaleFormClientId] = useState('');
  const [saleFormProductSearch, setSaleFormProductSearch] = useState('');
  const [saleFormError, setSaleFormError] = useState('');
  const [_saleFormClientSearch, _setSaleFormClientSearch] = useState('');
  const [_saleFormShowClientPicker, _setSaleFormShowClientPicker] = useState(false);

  // ── Ventes filtrées ────────────────────────────────────────────────────────

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
          (s.clientName && s.clientName.toLowerCase().includes(q)),
      );
    }

    if (paymentMethodFilter !== 'all') {
      result = result.filter((s) => getPaymentCategory(s.paymentMethod) === paymentMethodFilter);
    }

    return result;
  }, [sales, dateFilter, historySearch, paymentMethodFilter]);

  // ── Produits filtrés pour le formulaire d'édition ──────────────────────────

  const saleFormFilteredProducts = useMemo(() => {
    if (!saleFormProductSearch) return salesProducts.slice(0, 20);
    const q = saleFormProductSearch.toLowerCase();
    return salesProducts.filter(
      (p: any) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    ).slice(0, 20);
  }, [saleFormProductSearch, salesProducts]);

  const _saleFormFilteredClients = useMemo(() => {
    if (!_saleFormClientSearch) return effectiveClients.slice(0, 10);
    const q = _saleFormClientSearch.toLowerCase();
    return effectiveClients.filter(
      (c: any) =>
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
    ).slice(0, 10);
  }, [_saleFormClientSearch, effectiveClients]);

  // ── Totaux du formulaire d'édition ─────────────────────────────────────────

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

  // ── Clients filtrés pour attribution ──────────────────────────────────────

  const filteredClientsForAssign = useMemo(() => {
    if (!assignClientSearch) return effectiveClients.slice(0, 10);
    const q = assignClientSearch.toLowerCase();
    return effectiveClients.filter(
      (c: any) =>
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
    ).slice(0, 10);
  }, [assignClientSearch, effectiveClients]);

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Ouvre le formulaire d'édition pré-rempli avec les données de la vente */
  const openEditSaleForm = useCallback((saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale || sale.status === 'refunded') return;
    setEditingSaleId(saleId);
    setSaleFormItems(sale.items.map((item: any) => ({
      productId: item.productId, productName: item.productName,
      variantId: item.variantId, variantLabel: item.variantLabel,
      quantity: item.quantity, unitPrice: item.unitPrice, vatRate: item.vatRate,
    })));
    setSaleFormPayment(sale.paymentMethod);
    setSaleFormClientId(sale.clientId || '');
    setSaleFormProductSearch('');
    setSaleFormError('');
    _setSaleFormClientSearch('');
    _setSaleFormShowClientPicker(false);
    setSaleFormVisible(true);
  }, [sales]);

  /** Ajoute un produit au formulaire d'édition */
  const addToSaleForm = useCallback((productId: string) => {
    const product = effectiveProducts.find((p: any) => p.id === productId);
    if (!product) return;
    setSaleFormItems((prev) => {
      const existing = prev.find((c) => c.productId === productId && !c.variantId);
      if (existing) return prev.map((c) => (c.productId === productId && !c.variantId) ? { ...c, quantity: c.quantity + 1 } : c);
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
      }).filter((c) => c.quantity > 0),
    );
  }, []);

  const removeSaleFormItem = useCallback((productId: string, variantId?: string) => {
    setSaleFormItems((prev) => prev.filter((c) => {
      if (variantId) return !(c.productId === productId && c.variantId === variantId);
      return !(c.productId === productId && !c.variantId);
    }));
  }, []);

  /** Soumet le formulaire d'édition (création ou mise à jour) */
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
    const result = editingSaleId
      ? updateSale(editingSaleId, { items, paymentMethod: saleFormPayment, clientId: saleFormClientId || undefined })
      : createSale(items, saleFormPayment, saleFormClientId || undefined);
    if (!result.success) { setSaleFormError(result.error || 'Erreur inconnue'); return; }
    setSaleFormVisible(false);
  }, [saleFormItems, saleFormPayment, saleFormClientId, editingSaleId, createSale, updateSale]);

  return {
    // Filtres
    historySearch, setHistorySearch,
    dateFilter, setDateFilter,
    paymentMethodFilter, setPaymentMethodFilter,
    selectedSale, setSelectedSale,
    filteredSales,
    // Actions vente
    refundConfirm, setRefundConfirm,
    convertConfirm, setConvertConfirm,
    assignClientModal, setAssignClientModal,
    assignClientSearch, setAssignClientSearch,
    assignClientId, setAssignClientId,
    filteredClientsForAssign,
    // Formulaire édition
    saleFormVisible, setSaleFormVisible,
    editingSaleId, setEditingSaleId,
    saleFormItems, setSaleFormItems,
    saleFormPayment, setSaleFormPayment,
    saleFormClientId, setSaleFormClientId,
    saleFormProductSearch, setSaleFormProductSearch,
    saleFormError, setSaleFormError,
    saleFormTotals, saleFormFilteredProducts,
    openEditSaleForm, addToSaleForm,
    updateSaleFormQty, removeSaleFormItem,
    handleSaleFormSubmit,
  };
}