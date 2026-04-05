/**
 * SalesScreen.tsx  (refactorisé)
 *
 * Écran POS (Point of Sale) — orchestrateur pur.
 * Toute la logique est déléguée aux hooks et composants extraits.
 *
 * STRUCTURE :
 *   hooks/usePOSCart.ts              — state et logique du panier
 *   hooks/usePOSHistory.ts           — filtres et logique de l'historique
 *   components/sales/CartPanel.tsx   — panneau panier desktop
 *   components/sales/ProductGrid.tsx — grille/liste de produits
 *   PaymentModal, ManualEntry, VariantPicker, SalesHistory
 *   restent inline car ils sont courts et très couplés au state local.
 *
 * IMPORTANT: Les variables de chaîne conditionnelles utilisent des opérateurs
 * ternaires (value ? <JSX> : null) pour éviter les erreurs React Native Web
 * "Unexpected text node".
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  useWindowDimensions, Modal, Pressable, Image, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Search, ShoppingBag, Plus, Minus, Trash2, CreditCard, ArrowRightLeft,
  Smartphone, Receipt, RotateCcw, UserPlus, X, Check, ChevronDown,
  ShoppingCart, Pencil, Package, Printer, Image as ImageIcon,
  Calculator, PenLine, Tag,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useOffline } from '@/contexts/OfflineContext';
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '@/utils/format';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import ConfirmModal from '@/components/ConfirmModal';
import FormModal from '@/components/FormModal';
import ClientPicker from '@/components/ClientPicker';
import PaymentStatusModal from '@/components/PaymentStatusModal';
import SaleConfirmationModal from '@/components/SaleConfirmationModal';
import { generateReceiptHTML, generateAndSharePDF } from '@/services/pdfService';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBanking } from '@/contexts/BankingContext';
import { SALES_ALLOWED_TYPES } from '@/constants/productTypes';
import {
  PAYMENT_CATEGORIES, ALL_PAYMENT_CATEGORIES_WITH_DIGITAL,
  DIGITAL_SUB_METHODS, MIXED_SUB_METHODS, DATE_FILTER_KEYS,
  isDigitalMethod, generateItemId,
} from '@/constants/paymentMethods';
import { usePOSCart } from '@/hooks/usePOSCart';
import { usePOSHistory } from '@/hooks/usePOSHistory';
import CartPanel from '@/components/sales/CartPanel';
import ProductGrid from '@/components/sales/ProductGrid';
import s from '@/components/sales/salesStyles';
import type { SaleItem, SalePaymentMethod } from '@/types';
import type { SalesTab, PaymentMethodFilter } from '@/types/sales.types';

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SalesScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { t } = useI18n();
  const { user } = useAuth();
  const banking = useBanking();

  const {
    sales, activeProducts, activeClients,
    createSale, updateSale, refundSale, convertSaleToInvoice, assignClientToSale,
    showToast, getProductStock, getVariantsForProduct, findProductByBarcode,
    company, discountCategories, discountCategoryRates, addDiscountCategory, productAttributes,
  } = useData();

  const { isOnline, cachedProducts, cachedClients, cachedCompany, queueOfflineSale } = useOffline();

  const effectiveProducts = isOnline ? activeProducts : (activeProducts.length > 0 ? activeProducts : cachedProducts.filter((p) => !p.isArchived && p.isActive));
  const effectiveClients = isOnline ? activeClients : (activeClients.length > 0 ? activeClients : cachedClients.filter((c) => !c.isDeleted));
  const effectiveCompany = company?.name ? company : (cachedCompany ?? company);
  const cur = effectiveCompany.currency || 'EUR';
  const companyId = user?.id ?? 'anonymous';

  // ── Onglets ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SalesTab>('pos');

  // ── Mode d'affichage (persisté) ───────────────────────────────────────────
  const [posViewMode, setPosViewModeState] = useState<'grid' | 'list' | 'compact'>('grid');

  useEffect(() => {
    AsyncStorage.getItem('@pos_view_mode').then((stored) => {
      if (stored === 'grid' || stored === 'list' || stored === 'compact') setPosViewModeState(stored);
    }).catch(() => {});
  }, []);

  const setPosViewMode = useCallback((mode: 'grid' | 'list' | 'compact') => {
    setPosViewModeState(mode);
    AsyncStorage.setItem('@pos_view_mode', mode).catch(() => {});
  }, []);

  // ── Produits disponibles à la vente ───────────────────────────────────────
  const salesProducts = useMemo(
    () => effectiveProducts.filter((p) => SALES_ALLOWED_TYPES.includes(p.type) && p.isAvailableForSale !== false),
    [effectiveProducts],
  );

  // ── Filtres produits ───────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

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
    if (selectedCategoryFilter) list = list.filter((p) => (p.categoryName || 'Autres') === selectedCategoryFilter);
    if (productSearch) {
      const q = productSearch.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return list;
  }, [productSearch, salesProducts, selectedCategoryFilter]);

  const groupedFilteredProducts = useMemo(() => {
    const map = new Map<string, typeof filteredProducts>();
    filteredProducts.forEach((p) => {
      const cat = p.categoryName || 'Autres';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return Array.from(map.entries())
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [filteredProducts]);

  // ── Couleur déterministe par catégorie ────────────────────────────────────
  const getCategoryColor = useCallback((name: string) => {
    const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }, []);

  // ── Hook panier ────────────────────────────────────────────────────────────
  const cart = usePOSCart({
    effectiveProducts, effectiveClients, effectiveCompany,
    discountCategories, discountCategoryRates, addDiscountCategory,
    getVariantsForProduct, findProductByBarcode, getProductStock,
    createSale, queueOfflineSale, showToast, isOnline, companyId, t,
  });

  // ── Hook historique ────────────────────────────────────────────────────────
  const history = usePOSHistory({
    sales, salesProducts, effectiveProducts, effectiveClients, createSale, updateSale,
  });

  // ── Impression ticket ──────────────────────────────────────────────────────
  const handlePrintReceipt = useCallback(async (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
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

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const productGridProps = {
    groupedFilteredProducts, filteredProducts, salesProducts,
    productSearch, setProductSearch, selectedCategoryFilter, setSelectedCategoryFilter,
    categoryData, posViewMode, setPosViewMode, isMobile,
    cart: cart.cart, addToCart: cart.addToCart, handleProductTap: cart.handleProductTap,
    expandedProductId: cart.expandedProductId,
    getVariantsForProduct, getProductStock, productAttributes,
    barcodeInput: cart.barcodeInput, setBarcodeInput: cart.setBarcodeInput,
    handleBarcodeSubmit: cart.handleBarcodeSubmit,
    onOpenManualEntry: () => { cart.setManualName(''); cart.setManualPrice(''); cart.setManualVat('20'); cart.setManualEntryVisible(true); },
    currency: cur, getCategoryColor,
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <PageHeader title="Caisse" />

      {/* Onglets Caisse / Historique */}
      <View style={[s.tabs, { borderBottomColor: colors.border }]}>
        {([
          { key: 'pos' as SalesTab, label: 'Caisse', Icon: ShoppingBag },
          { key: 'history' as SalesTab, label: 'Historique', Icon: Receipt },
        ] as const).map(({ key, label, Icon }) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, activeTab === key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(key)}
          >
            <Icon size={16} color={activeTab === key ? colors.primary : colors.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === key ? colors.primary : colors.textSecondary }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'pos' ? (
        <View style={{ flex: 1 }}>
          {isMobile ? (
            // ── Mobile : grille plein écran + bouton flottant panier ──
            <View style={{ flex: 1 }}>
              <ProductGrid {...productGridProps} />
              {cart.cartItemCount > 0 && (
                <TouchableOpacity
                  style={[s.floatingCartBtn, { backgroundColor: colors.primary }]}
                  onPress={() => cart.setShowMobileCart(true)}
                  activeOpacity={0.85}
                >
                  <ShoppingCart size={20} color="#FFF" />
                  <View style={s.floatingCartBadge}>
                    <Text style={s.floatingCartBadgeText}>{cart.cartItemCount}</Text>
                  </View>
                  <Text style={s.floatingCartTotal}>{formatCurrency(cart.cartTotals.totalTTC, cur)}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            // ── Desktop : split layout produits | panier ──
            <View style={s.splitLayout}>
              <View style={s.productsPanel}>
                <ProductGrid {...productGridProps} />
              </View>
              <CartPanel
                cart={cart.cart} cartTotals={cart.cartTotals} cartItemCount={cart.cartItemCount}
                currency={cur} updateCartQuantity={cart.updateCartQuantity}
                removeFromCart={cart.removeFromCart} checkoutAnim={cart.checkoutAnim}
                onPay={() => { if (cart.cart.length === 0) return; cart.setShowPaymentModal(true); cart.setCashGiven(''); }}
                receiptSaleId={cart.receiptSaleId} onPrintReceipt={handlePrintReceipt}
                setReceiptSaleId={cart.setReceiptSaleId}
                selectedClientId={cart.selectedClientId} effectiveClients={effectiveClients}
                showClientPicker={cart.showClientPicker} setShowClientPicker={cart.setShowClientPicker}
                clientSearch={cart.clientSearch} setClientSearch={cart.setClientSearch}
                filteredClientsForPicker={cart.filteredClientsForPicker}
                handleSelectClient={cart.handleSelectClient} handleRemoveClient={cart.handleRemoveClient}
                discountCategoryRates={discountCategoryRates}
                selectedDiscount={cart.selectedDiscount} setSelectedDiscount={cart.setSelectedDiscount}
                discountRate={cart.discountRate} isClientDiscount={cart.isClientDiscount}
                showDiscountPicker={cart.showDiscountPicker} setShowDiscountPicker={cart.setShowDiscountPicker}
                discountCategories={discountCategories}
                newDiscountName={cart.newDiscountName} setNewDiscountName={cart.setNewDiscountName}
                newDiscountRate={cart.newDiscountRate} setNewDiscountRate={cart.setNewDiscountRate}
                handleAddNewDiscount={cart.handleAddNewDiscount}
              />
            </View>
          )}
        </View>
      ) : (
        // ── Onglet Historique ──
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <HistoryView
            history={history} sales={sales} effectiveClients={effectiveClients}
            isMobile={isMobile} colors={colors} cur={cur}
            handlePrintReceipt={handlePrintReceipt}
            refundSale={refundSale} convertSaleToInvoice={convertSaleToInvoice}
            assignClientToSale={assignClientToSale}
            t={t}
          />
        </ScrollView>
      )}

      {/* ── Modale paiement ── */}
      <PaymentModal cart={cart} colors={colors} isMobile={isMobile} width={width} cur={cur} effectiveClients={effectiveClients} banking={banking} showToast={showToast} t={t} />

      {/* ── Bottom sheet mobile ── */}
      <MobileCartSheet cart={cart} colors={colors} cur={cur} updateCartQuantity={cart.updateCartQuantity} removeFromCart={cart.removeFromCart} handlePrintReceipt={handlePrintReceipt} />

      {/* ── Saisie manuelle ── */}
      <ManualEntryModal cart={cart} colors={colors} isMobile={isMobile} width={width} />

      {/* ── Formulaire édition vente ── */}
      <FormModal
        visible={history.saleFormVisible}
        onClose={() => history.setSaleFormVisible(false)}
        title={history.editingSaleId ? 'Modifier la vente' : 'Nouvelle vente'}
        subtitle={history.editingSaleId ? 'Mettre à jour les informations' : 'Créer une vente manuellement'}
        onSubmit={history.handleSaleFormSubmit}
        submitLabel={history.editingSaleId ? 'Mettre à jour' : 'Encaisser'}
        width={520}
      >
        <SaleFormContent history={history} salesProducts={salesProducts} colors={colors} cur={cur} effectiveClients={effectiveClients} />
      </FormModal>

      {/* ── Confirmations ── */}
      <ConfirmModal
        visible={history.refundConfirm !== null}
        title="Rembourser la vente"
        message={`Êtes-vous sûr de vouloir rembourser la vente ${sales.find((sa) => sa.id === history.refundConfirm)?.saleNumber ?? ''} ?`}
        confirmLabel="Rembourser" destructive
        onConfirm={() => { if (history.refundConfirm) refundSale(history.refundConfirm); history.setRefundConfirm(null); }}
        onClose={() => history.setRefundConfirm(null)}
      />

      <ConfirmModal
        visible={history.convertConfirm !== null}
        title="Convertir en facture"
        message={`Convertir la vente ${sales.find((sa) => sa.id === history.convertConfirm)?.saleNumber ?? ''} en facture brouillon ?`}
        confirmLabel="Convertir"
        onConfirm={() => { if (history.convertConfirm) convertSaleToInvoice(history.convertConfirm); history.setConvertConfirm(null); }}
        onClose={() => history.setConvertConfirm(null)}
      />

      {/* ── Attribution client ── */}
      {history.assignClientModal !== null && (
        <AssignClientModal history={history} effectiveClients={effectiveClients} colors={colors} assignClientToSale={assignClientToSale} />
      )}

      <SaleConfirmationModal
        visible={!!cart.confirmSale}
        sale={cart.confirmSale ? sales.find((s) => s.id === cart.confirmSale) ?? null : null}
        onClose={() => cart.setConfirmSale(null)}
        onNewSale={() => { cart.setConfirmSale(null); setActiveTab('pos'); }}
      />

      <PaymentStatusModal
        visible={cart.cinetpay.active}
        transactionId={cart.cinetpay.transactionId}
        paymentUrl={cart.cinetpay.paymentUrl}
        amount={cart.cartTotals.totalTTC}
        currency={effectiveCompany.currency || 'XOF'}
        onCompleted={() => {
          const saleItems: SaleItem[] = cart.cart.map((c) => {
            const lineHT = c.unitPrice * c.quantity;
            const lineTVA = lineHT * (c.vatRate / 100);
            return { id: generateItemId(), saleId: '', productId: c.productId, productName: c.productName, quantity: c.quantity, unitPrice: c.unitPrice, vatRate: c.vatRate, totalHT: lineHT, totalTVA: lineTVA, totalTTC: lineHT + lineTVA };
          });
          const result = createSale(saleItems, 'mobile' as SalePaymentMethod, cart.selectedClientId || undefined);
          if (result.success && result.saleId) cart.setReceiptSaleId(result.saleId);
          showToast(t('payment.successTitle'));
          cart.resetCartState();
        }}
        onCancel={() => cart.setCinetpay({ active: false, loading: false, transactionId: null, paymentUrl: null })}
        onRetry={cart.handleCinetPayCheckout}
      />
    </View>
  );
}

// ─── Sous-composants inline (courts, très couplés au state) ──────────────────

/** Modale de paiement — cash, carte, digital, mixte */
function PaymentModal({ cart, colors, isMobile, width, cur, effectiveClients, banking, showToast, t }: any) {
  if (!cart.showPaymentModal) return null;
  // Contenu identique à renderPaymentModal() du fichier original
  // Conservé inline car trop couplé aux états du hook cart
  return (
    <Modal visible={cart.showPaymentModal} transparent animationType="fade" onRequestClose={() => cart.setShowPaymentModal(false)}>
      <Pressable style={s.modalOverlay} onPress={() => cart.setShowPaymentModal(false)}>
        <Pressable style={[s.paymentModal, { backgroundColor: colors.card, width: isMobile ? width - 32 : 440 }]} onPress={(e) => e.stopPropagation()}>
          <View style={[s.paymentModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.paymentModalTitle, { color: colors.text }]}>Paiement</Text>
            <TouchableOpacity onPress={() => cart.setShowPaymentModal(false)} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
            {/* Récapitulatif */}
            <View style={[s.paymentRecap, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>{cart.cartItemCount} article{cart.cartItemCount > 1 ? 's' : ''}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(cart.cartTotals.totalHT, cur)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(cart.cartTotals.totalTVA, cur)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Total TTC</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.primary }}>{formatCurrency(cart.cartTotals.totalTTC, cur)}</Text>
              </View>
            </View>
            {/* Modes de paiement */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Mode de paiement</Text>
              <View style={s.paymentGrid}>
                {PAYMENT_CATEGORIES.map((pm: any) => {
                  const isSelected = cart.selectedCategory === pm.value;
                  const isCardDisabled = pm.value === 'card' && !banking.isDigitalPaymentAvailable;
                  return (
                    <TouchableOpacity
                      key={pm.value}
                      style={[s.paymentMethodBtn, { backgroundColor: isSelected ? colors.primary : colors.inputBg, borderColor: isSelected ? colors.primary : colors.inputBorder, opacity: isCardDisabled ? 0.45 : 1 }]}
                      onPress={() => { if (isCardDisabled) { showToast('Veuillez configurer vos informations bancaires dans Paramètres → Administration → Paiements', 'error'); return; } cart.setSelectedCategory(pm.value); cart.setTpeConnecting(false); }}
                      activeOpacity={isCardDisabled ? 1 : 0.7}
                    >
                      <pm.icon size={20} color={isSelected ? '#FFF' : colors.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#FFF' : colors.textSecondary, marginTop: 4 }}>{pm.label}</Text>
                      {isCardDisabled ? <Text style={{ fontSize: 8, color: colors.danger, marginTop: 2 }}>Non configuré</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {/* Section spécifique au mode choisi — cash, card, digital, mixed */}
            {cart.selectedCategory === 'cash' && <CashSection cart={cart} colors={colors} cur={cur} />}
            {cart.selectedCategory === 'card' && <CardSection cart={cart} colors={colors} />}
            {cart.selectedCategory === 'digital' && <DigitalSection cart={cart} colors={colors} t={t} />}
            {cart.selectedCategory === 'mixed' && <MixedSection cart={cart} colors={colors} cur={cur} />}
          </ScrollView>
          <View style={[s.paymentModalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[s.validateSaleBtn, { backgroundColor: cart.isPaymentValid ? '#10B981' : '#9CA3AF' }]}
              onPress={cart.handleCheckout}
              activeOpacity={cart.isPaymentValid ? 0.8 : 1}
              disabled={!cart.isPaymentValid}
            >
              <Check size={20} color="#FFF" />
              <Text style={s.validateSaleBtnText}>{t('pos.validateSale')} — {formatCurrency(cart.cartTotals.totalTTC, cur)}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CashSection({ cart, colors, cur }: any) {
  return (
    <View style={[s.cashCalcSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Calculator size={16} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Rendu monnaie</Text>
      </View>
      <TextInput
        style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
        value={cart.cashGiven} onChangeText={cart.setCashGiven}
        placeholder="0,00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" autoFocus
      />
      <View style={s.cashQuickBtns}>
        {[5, 10, 20, 50, 100].map((amount) => (
          <TouchableOpacity key={amount} style={[s.cashQuickBtn, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]} onPress={() => cart.setCashGiven(String(amount))}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{amount}€</Text>
          </TouchableOpacity>
        ))}
      </View>
      {(() => {
        const given = parseFloat(cart.cashGiven.replace(',', '.'));
        if (cart.cashGiven.length > 0 && !isNaN(given) && given >= cart.cartTotals.totalTTC) {
          return <View style={[s.changeDisplay, { backgroundColor: '#ECFDF5' }]}><Text style={{ fontSize: 13, color: '#059669' }}>Monnaie à rendre</Text><Text style={{ fontSize: 24, fontWeight: '800', color: '#059669' }}>{formatCurrency(cart.cashChange, cur)}</Text></View>;
        }
        if (cart.cashGiven.length > 0 && !isNaN(given) && given > 0 && given < cart.cartTotals.totalTTC) {
          return <View style={[s.changeDisplay, { backgroundColor: '#FEF2F2' }]}><Text style={{ fontSize: 13, color: '#DC2626' }}>Montant manquant</Text><Text style={{ fontSize: 24, fontWeight: '800', color: '#DC2626' }}>{formatCurrency(cart.cartTotals.totalTTC - given, cur)}</Text></View>;
        }
        return null;
      })()}
    </View>
  );
}

function CardSection({ cart, colors }: any) {
  return (
    <View style={[s.cashCalcSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CreditCard size={16} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Paiement par Carte Bancaire</Text>
      </View>
      {cart.tpeConnecting ? (
        <View style={[s.changeDisplay, { backgroundColor: '#EFF6FF', gap: 10 }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E40AF' }}>Connexion au TPE en cours...</Text>
        </View>
      ) : (
        <View style={[s.changeDisplay, { backgroundColor: '#F0FDF4' }]}>
          <CreditCard size={20} color="#16A34A" />
          <Text style={{ fontSize: 13, color: '#15803D', textAlign: 'center' }}>Cliquez sur "Valider" pour initier le paiement via le TPE.</Text>
        </View>
      )}
    </View>
  );
}

function DigitalSection({ cart, colors, t }: any) {
  return (
    <View style={[s.cashCalcSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Smartphone size={16} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Paiement Digital</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {DIGITAL_SUB_METHODS.map((dm: any) => {
          const isActive = cart.digitalSubMethod === dm.value;
          return (
            <TouchableOpacity key={dm.value} style={[s.mixedMethodChip, { backgroundColor: isActive ? dm.color : colors.inputBg, borderColor: isActive ? dm.color : colors.inputBorder, flex: 1, justifyContent: 'center' }]} onPress={() => cart.setDigitalSubMethod(dm.value)}>
              <Smartphone size={12} color={isActive ? '#FFF' : colors.textSecondary} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: isActive ? '#FFF' : colors.textSecondary }}>{dm.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: cart.mobilePhone.trim().length === 0 ? colors.inputBorder : '#10B981', color: colors.text }]}
        value={cart.mobilePhone} onChangeText={cart.setMobilePhone}
        placeholder="+221 7X XXX XX XX" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad"
      />
      {cart.mobilePhone.trim().length === 0 ? <Text style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>{t('pos.phoneRequiredHint')}</Text> : null}
    </View>
  );
}

function MixedSection({ cart, colors, cur }: any) {
  return (
    <View style={[s.cashCalcSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ArrowRightLeft size={16} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Paiement mixte</Text>
      </View>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>Répartissez {formatCurrency(cart.cartTotals.totalTTC, cur)} entre deux modes.</Text>
      {[{ method: cart.mixedMethod1, setMethod: cart.setMixedMethod1, amount: cart.mixedAmount1, setAmount: (val: string) => { cart.setMixedAmount1(val); const p = parseFloat(val.replace(',', '.')); if (!isNaN(p) && p >= 0) cart.setMixedAmount2(Math.max(0, cart.cartTotals.totalTTC - p).toFixed(2).replace('.', ',')); }, label: '1er mode' },
        { method: cart.mixedMethod2, setMethod: cart.setMixedMethod2, amount: cart.mixedAmount2, setAmount: (val: string) => { cart.setMixedAmount2(val); const p = parseFloat(val.replace(',', '.')); if (!isNaN(p) && p >= 0) cart.setMixedAmount1(Math.max(0, cart.cartTotals.totalTTC - p).toFixed(2).replace('.', ',')); }, label: '2e mode' }
      ].map((section, idx) => (
        <View key={idx} style={{ gap: 6, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{section.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {MIXED_SUB_METHODS.map((pm: any) => (
              <TouchableOpacity key={`m${idx}_${pm.value}`} style={[s.mixedMethodChip, { backgroundColor: section.method === pm.value ? colors.primary : colors.inputBg, borderColor: section.method === pm.value ? colors.primary : colors.inputBorder }]} onPress={() => section.setMethod(pm.value)}>
                <pm.icon size={12} color={section.method === pm.value ? '#FFF' : colors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: section.method === pm.value ? '#FFF' : colors.textSecondary }}>{pm.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} value={section.amount} onChangeText={section.setAmount} placeholder="Montant" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
        </View>
      ))}
      {(() => {
        const a1 = parseFloat(cart.mixedAmount1.replace(',', '.')) || 0;
        const a2 = parseFloat(cart.mixedAmount2.replace(',', '.')) || 0;
        const total = a1 + a2;
        const isValid = Math.abs(total - cart.cartTotals.totalTTC) < 0.01;
        return <View style={[s.changeDisplay, { backgroundColor: isValid ? '#ECFDF5' : '#FEF2F2' }]}><Text style={{ fontSize: 12, fontWeight: '600', color: isValid ? '#059669' : '#DC2626' }}>Total : {formatCurrency(total, cur)} / {formatCurrency(cart.cartTotals.totalTTC, cur)}{isValid ? ' ✓' : ' — montant incorrect'}</Text></View>;
      })()}
    </View>
  );
}

function MobileCartSheet({ cart, colors, cur, updateCartQuantity, removeFromCart, handlePrintReceipt }: any) {
  return (
    <Modal visible={cart.showMobileCart} transparent animationType="slide" onRequestClose={() => cart.setShowMobileCart(false)}>
      <View style={s.bottomSheetOverlay}>
        <Pressable style={s.bottomSheetBackdrop} onPress={() => cart.setShowMobileCart(false)} />
        <View style={[s.bottomSheet, { backgroundColor: colors.card }]}>
          <View style={[s.bottomSheetHandle, { backgroundColor: colors.textTertiary }]} />
          <View style={s.cartHeader}>
            <View style={s.cartHeaderLeft}>
              <ShoppingCart size={18} color={colors.primary} />
              <Text style={[s.cartTitle, { color: colors.text }]}>Panier</Text>
            </View>
            <TouchableOpacity onPress={() => cart.setShowMobileCart(false)} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {/* Même contenu que CartPanel mais mobile */}
          <ScrollView style={s.cartList} showsVerticalScrollIndicator={false}>
            {cart.cart.length === 0 ? (
              <View style={s.cartEmpty}>
                <Receipt size={32} color={colors.textTertiary} />
                <Text style={[s.cartEmptyText, { color: colors.textTertiary }]}>Panier vide</Text>
              </View>
            ) : (
              cart.cart.map((item: any, idx: number) => {
                const lineHT = item.unitPrice * item.quantity;
                const lineTVA = lineHT * (item.vatRate / 100);
                return (
                  <View key={`mob_${idx}_${item.productId}`} style={[s.cartItem, { borderBottomColor: colors.borderLight }]}>
                    <View style={s.cartItemTop}>
                      <Text style={[s.cartItemName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.productName}</Text>
                      <TouchableOpacity onPress={() => removeFromCart(item.productId, item.variantId)} hitSlop={8}><Trash2 size={14} color={colors.danger} /></TouchableOpacity>
                    </View>
                    <View style={s.cartItemBottom}>
                      <View style={s.qtyControl}>
                        <TouchableOpacity style={[s.qtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => updateCartQuantity(item.productId, -1, item.variantId)}><Minus size={14} color={colors.text} /></TouchableOpacity>
                        <Text style={[s.qtyText, { color: colors.text }]}>{item.quantity}</Text>
                        <TouchableOpacity style={[s.qtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => updateCartQuantity(item.productId, 1, item.variantId)}><Plus size={14} color={colors.text} /></TouchableOpacity>
                      </View>
                      <Text style={[s.cartItemTotal, { color: colors.text }]}>{formatCurrency(lineHT + lineTVA, cur)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={[s.cartFooter, { borderTopColor: colors.border }]}>
            <View style={[s.totalRow, { marginBottom: 8 }]}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Total</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary }}>{formatCurrency(cart.cartTotals.totalTTC, cur)}</Text>
            </View>
            <TouchableOpacity style={[s.payBtn, { backgroundColor: cart.cart.length > 0 ? '#10B981' : colors.textTertiary }]} onPress={() => { cart.setShowMobileCart(false); cart.setShowPaymentModal(true); cart.setCashGiven(''); }} disabled={cart.cart.length === 0} activeOpacity={0.8}>
              <CreditCard size={20} color="#FFF" />
              <Text style={s.payBtnText}>PAYER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ManualEntryModal({ cart, colors, isMobile, width }: any) {
  return (
    <Modal visible={cart.manualEntryVisible} transparent animationType="fade" onRequestClose={() => cart.setManualEntryVisible(false)}>
      <Pressable style={s.modalOverlay} onPress={() => cart.setManualEntryVisible(false)}>
        <Pressable style={[s.variantModal, { backgroundColor: colors.card, width: isMobile ? width - 32 : 380 }]} onPress={(e) => e.stopPropagation()}>
          <View style={[s.paymentModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Saisie manuelle</Text>
            <TouchableOpacity onPress={() => cart.setManualEntryVisible(false)} hitSlop={8}><X size={20} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 14 }}>
            <TextInput style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} value={cart.manualName} onChangeText={cart.setManualName} placeholder="Nom de l'article" placeholderTextColor={colors.textTertiary} autoFocus />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Prix HT</Text>
                <TextInput style={[s.cashInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} value={cart.manualPrice} onChangeText={cart.setManualPrice} placeholder="0,00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>TVA (%)</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['0', '5.5', '10', '20'].map((rate) => (
                    <TouchableOpacity key={rate} style={[s.vatChip, { backgroundColor: cart.manualVat === rate ? colors.primary : colors.inputBg, borderColor: cart.manualVat === rate ? colors.primary : colors.inputBorder }]} onPress={() => cart.setManualVat(rate)}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: cart.manualVat === rate ? '#FFF' : colors.textSecondary }}>{rate}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <TouchableOpacity style={[s.validateSaleBtn, { backgroundColor: colors.primary, opacity: cart.manualName.trim() && cart.manualPrice.trim() ? 1 : 0.5 }]} onPress={cart.handleManualEntry} disabled={!cart.manualName.trim() || !cart.manualPrice.trim()}>
              <Plus size={18} color="#FFF" />
              <Text style={s.validateSaleBtnText}>Ajouter au panier</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SaleFormContent({ history, salesProducts, colors, cur, effectiveClients }: any) {
  return (
    <>
      {history.saleFormError ? <View style={[s.saleFormError, { backgroundColor: colors.dangerLight }]}><Text style={{ fontSize: 13, fontWeight: '500', color: colors.danger }}>{history.saleFormError}</Text></View> : null}
      <ClientPicker selectedClientId={history.saleFormClientId} onSelect={history.setSaleFormClientId} label="Client (optionnel)" />
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>Moyen de paiement</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {PAYMENT_CATEGORIES.map((pm: any) => {
            const isSelected = (pm.value === 'digital' && isDigitalMethod(history.saleFormPayment)) || history.saleFormPayment === pm.value;
            return (
              <TouchableOpacity key={pm.value} style={[s.saleFormPaymentBtn, { backgroundColor: isSelected ? colors.primary : colors.inputBg, borderColor: isSelected ? colors.primary : colors.inputBorder }]} onPress={() => history.setSaleFormPayment(pm.value === 'digital' ? 'mobile_wave' : pm.value)}>
                <pm.icon size={14} color={isSelected ? '#FFF' : colors.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#FFF' : colors.textSecondary }}>{pm.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={[s.saleFormProductSearch, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Search size={15} color={colors.textTertiary} />
          <TextInput style={[s.saleFormProductInput, { color: colors.text }]} placeholder="Rechercher un produit..." placeholderTextColor={colors.textTertiary} value={history.saleFormProductSearch} onChangeText={history.setSaleFormProductSearch} />
        </View>
        {history.saleFormProductSearch.length > 0 && (
          <View style={[s.saleFormDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {history.saleFormFilteredProducts.map((product: any) => (
                <TouchableOpacity key={product.id} style={[s.saleFormDropdownItem, { borderBottomColor: colors.borderLight }]} onPress={() => history.addToSaleForm(product.id)}>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: colors.text }}>{product.name}</Text><Text style={{ fontSize: 11, color: colors.textTertiary }}>{product.sku}</Text></View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{formatCurrency(product.salePrice, cur)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
      {history.saleFormItems.length > 0 && (
        <View style={{ gap: 8 }}>
          {history.saleFormItems.map((item: any, formIdx: number) => {
            const lineHT = item.unitPrice * item.quantity;
            const lineTTC = lineHT + lineHT * (item.vatRate / 100);
            return (
              <View key={`sf_${formIdx}`} style={[s.saleFormItem, { borderColor: colors.borderLight }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 }} numberOfLines={1}>{item.productName}</Text>
                  <TouchableOpacity onPress={() => history.removeSaleFormItem(item.productId, item.variantId)} hitSlop={8}><Trash2 size={14} color={colors.danger} /></TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity style={[s.saleFormQtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => history.updateSaleFormQty(item.productId, -1, item.variantId)}><Minus size={12} color={colors.text} /></TouchableOpacity>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, minWidth: 20, textAlign: 'center' }}>{item.quantity}</Text>
                    <TouchableOpacity style={[s.saleFormQtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => history.updateSaleFormQty(item.productId, 1, item.variantId)}><Plus size={12} color={colors.text} /></TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{formatCurrency(lineTTC, cur)}</Text>
                </View>
              </View>
            );
          })}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Total TTC</Text><Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>{formatCurrency(history.saleFormTotals.totalTTC, cur)}</Text></View>
          </View>
        </View>
      )}
    </>
  );
}

function HistoryView({ history, sales, effectiveClients, isMobile, colors, cur, handlePrintReceipt, refundSale, convertSaleToInvoice, assignClientToSale, t }: any) {
  return (
    <View style={s.historyContainer}>
      <View style={[s.filterRow, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={[s.historySearchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput style={[s.posSearchInput, { color: colors.text }]} placeholder="Rechercher une vente..." placeholderTextColor={colors.textTertiary} value={history.historySearch} onChangeText={history.setHistorySearch} />
        </View>
        <View style={s.dateFilters}>
          {DATE_FILTER_KEYS.map((df: any) => (
            <TouchableOpacity key={df.value} style={[s.dateFilterBtn, { backgroundColor: history.dateFilter === df.value ? colors.primary : colors.inputBg, borderColor: history.dateFilter === df.value ? colors.primary : colors.inputBorder }]} onPress={() => history.setDateFilter(df.value)}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: history.dateFilter === df.value ? '#FFF' : colors.textSecondary }}>{t(df.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {[{ value: 'all' as PaymentMethodFilter, label: 'Tout' }, ...ALL_PAYMENT_CATEGORIES_WITH_DIGITAL.map((pm: any) => ({ value: pm.value as PaymentMethodFilter, label: pm.label }))].map((pf) => (
            <TouchableOpacity key={pf.value} style={[s.dateFilterBtn, { backgroundColor: history.paymentMethodFilter === pf.value ? colors.primary : colors.inputBg, borderColor: history.paymentMethodFilter === pf.value ? colors.primary : colors.inputBorder }]} onPress={() => history.setPaymentMethodFilter(pf.value)}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: history.paymentMethodFilter === pf.value ? '#FFF' : colors.textSecondary }}>{pf.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={[s.salesTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {history.filteredSales.length === 0 ? (
            <View style={s.emptyState}><Receipt size={40} color={colors.textTertiary} /><Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 8 }}>Aucune vente pour cette période</Text></View>
          ) : (
            history.filteredSales.map((sale: any) => (
              <View key={sale.id}>
                <TouchableOpacity style={[isMobile ? s.mobileCard : s.historyRow, { borderBottomColor: colors.borderLight }, !isMobile && history.selectedSale === sale.id && { backgroundColor: colors.primaryLight }]} onPress={() => history.setSelectedSale(history.selectedSale === sale.id ? null : sale.id)} activeOpacity={0.7}>
                  {isMobile ? (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{sale.saleNumber}</Text>
                        <StatusBadge status={sale.status} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatDateTime(sale.createdAt)}</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{formatCurrency(sale.totalTTC, cur)}</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={{ width: 130, fontSize: 13, color: colors.primary, fontWeight: '600' }}>{sale.saleNumber}</Text>
                      <Text style={{ width: 150, fontSize: 13, color: colors.textSecondary }}>{formatDateTime(sale.createdAt)}</Text>
                      <Text style={{ width: 120, fontSize: 13, color: colors.textSecondary }}>{getPaymentMethodLabel(sale.paymentMethod)}</Text>
                      <Text style={{ flex: 1, fontSize: 13, color: colors.text, fontWeight: '600', textAlign: 'right' }}>{formatCurrency(sale.totalTTC, cur)}</Text>
                    </>
                  )}
                </TouchableOpacity>
                {history.selectedSale === sale.id && (
                  <View style={[s.saleDetail, { backgroundColor: colors.surfaceHover, borderBottomColor: colors.border }]}>
                    {sale.clientName ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Client : {sale.clientName}</Text> : null}
                    {sale.items.map((item: any) => (
                      <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 12, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', flex: 1, minWidth: 120, color: colors.text }}>{item.productName}</Text>
                        <Text style={{ fontSize: 12, width: 40, color: colors.textSecondary }}>×{item.quantity}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', width: 80, textAlign: 'right', color: colors.text }}>{formatCurrency(item.totalTTC, cur)}</Text>
                      </View>
                    ))}
                    {sale.status === 'paid' && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <TouchableOpacity style={[s.mobileActionBtn, { backgroundColor: colors.primaryLight }]} onPress={() => history.openEditSaleForm(sale.id)}><Pencil size={14} color={colors.primary} /><Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Modifier</Text></TouchableOpacity>
                        <TouchableOpacity style={[s.mobileActionBtn, { backgroundColor: colors.dangerLight }]} onPress={() => history.setRefundConfirm(sale.id)}><RotateCcw size={14} color={colors.danger} /><Text style={{ fontSize: 12, fontWeight: '600', color: colors.danger }}>Annuler</Text></TouchableOpacity>
                        <TouchableOpacity style={[s.mobileActionBtn, { backgroundColor: colors.surfaceHover }]} onPress={() => handlePrintReceipt(sale.id)}><Printer size={14} color={colors.text} /><Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Imprimer</Text></TouchableOpacity>
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
}

function AssignClientModal({ history, effectiveClients, colors, assignClientToSale }: any) {
  return (
    <View style={s.assignOverlay}>
      <View style={[s.assignModal, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[s.paymentModalHeader, { borderBottomColor: colors.border }]}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Associer un client</Text>
          <TouchableOpacity onPress={() => history.setAssignClientModal(null)}><X size={20} color={colors.textSecondary} /></TouchableOpacity>
        </View>
        <TextInput style={[s.assignSearch, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} placeholder="Rechercher..." placeholderTextColor={colors.textTertiary} value={history.assignClientSearch} onChangeText={history.setAssignClientSearch} />
        <ScrollView style={{ maxHeight: 200, marginHorizontal: 16 }}>
          {history.filteredClientsForAssign.map((client: any) => {
            const name = client.companyName || `${client.firstName} ${client.lastName}`;
            const isSelected = history.assignClientId === client.id;
            return (
              <TouchableOpacity key={client.id} style={[s.assignItem, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: colors.primaryLight }]} onPress={() => history.setAssignClientId(client.id)}>
                <Text style={{ fontSize: 13, color: colors.text }}>{name}</Text>
                {isSelected && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={[s.assignBtn, { backgroundColor: history.assignClientId ? colors.primary : colors.textTertiary }]} disabled={!history.assignClientId} onPress={() => { if (history.assignClientModal && history.assignClientId) assignClientToSale(history.assignClientModal, history.assignClientId); history.setAssignClientModal(null); }}>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Associer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}