/**
 * @fileoverview Products & Stock management screen.
 * Tabs: Catalogue, Inventaire, Mouvements, Entrepôts.
 * Embeds ProductsScreen for catalogue tab, handles stock adjustments,
 * movement history, warehouse CRUD, and CSV export.
 * Scrolls to top on tab change.
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  useWindowDimensions,
} from 'react-native';
import {
  Package, AlertTriangle, ClipboardList, History,
  ArrowUpDown as ArrowUpDownIcon, Plus, Pencil, Trash2, ArrowRightLeft, Warehouse,
  ArrowUp, ArrowDown, RotateCcw, ChevronDown, ChevronRight, Download,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatDate } from '@/utils/format';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import PageHeader from '@/components/PageHeader';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import ProductsScreen from './products';

import ConfirmModal from '@/components/ConfirmModal';
import { useI18n } from '@/contexts/I18nContext';
import type { Warehouse as WarehouseType } from '@/types';

type StockTab = 'catalogue' | 'inventaire' | 'mouvements' | 'entrepots';

const TAB_KEYS: { key: StockTab; labelKey: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { key: 'catalogue', labelKey: 'stock.catalogue', icon: Package },
  { key: 'inventaire', labelKey: 'stock.inventory', icon: ClipboardList },
  { key: 'mouvements', labelKey: 'stock.movements', icon: History },
  { key: 'entrepots', labelKey: 'stock.warehouses', icon: Warehouse },
];

function StockTabExportButton({ activeTab }: { activeTab: StockTab }) {
  const { colors } = useTheme();
  const { activeProducts, stockMovements, getProductStock, getVariantsForProduct } = useData();

  const handleExport = useCallback(() => {
    if (activeTab === 'inventaire') {
      const physicalProducts = activeProducts.filter(p => p.type !== 'service');
      const cols: ExportColumn<Record<string, unknown>>[] = [
        { key: 'name', label: 'Produit' },
        { key: 'sku', label: 'SKU' },
        { key: 'stockQuantity', label: 'Stock actuel' },
        { key: 'lowStockThreshold', label: 'Seuil min' },
        { key: 'unit', label: 'Unit\u00e9' },
        { key: 'salePrice', label: 'Prix vente' },
        { key: 'purchasePrice', label: 'Prix achat' },
      ];
      const data = physicalProducts.map(p => {
        const pv = getVariantsForProduct(p.id);
        const stock = pv.length > 0 ? pv.reduce((s, v) => s + v.stockQuantity, 0) : getProductStock(p.id);
        return { ...p, stockQuantity: stock } as unknown as Record<string, unknown>;
      });
      void exportToCSV(data, cols, `inventaire_${new Date().toISOString().slice(0, 10)}.csv`);
    } else if (activeTab === 'mouvements') {
      const cols: ExportColumn<Record<string, unknown>>[] = [
        { key: 'productName', label: 'Produit' },
        { key: 'type', label: 'Type' },
        { key: 'quantity', label: 'Quantit\u00e9' },
        { key: 'reference', label: 'R\u00e9f\u00e9rence' },
        { key: 'notes', label: 'Notes' },
        { key: 'createdAt', label: 'Date' },
      ];
      const data = stockMovements.map(sm => {
        const pName = sm.productName || activeProducts.find(p => p.id === sm.productId)?.name || 'Inconnu';
        return { ...sm, productName: pName } as unknown as Record<string, unknown>;
      });
      void exportToCSV(data, cols, `mouvements_stock_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  }, [activeTab, activeProducts, stockMovements, getProductStock, getVariantsForProduct]);

  return (
    <TouchableOpacity
      style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginRight: 4 }}
      onPress={handleExport}
      activeOpacity={0.7}
    >
      <Download size={14} color={colors.text} />
    </TouchableOpacity>
  );
}

export default function StockScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [activeTab, setActiveTab] = useState<StockTab>('catalogue');
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title={t('stock.title')} />
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <View style={styles.tabBarRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {TAB_KEYS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                  onPress={() => { setActiveTab(tab.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                  activeOpacity={0.7}
                >
                  <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>{t(tab.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {(activeTab === 'inventaire' || activeTab === 'mouvements') && (
            <StockTabExportButton activeTab={activeTab} />
          )}
        </View>
      </View>
      {activeTab === 'catalogue' ? (
        <ProductsScreen embedded />
      ) : (
        <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {activeTab === 'inventaire' && <InventaireSection isMobile={isMobile} />}
          {activeTab === 'mouvements' && <MouvementsSection isMobile={isMobile} />}
          {activeTab === 'entrepots' && <EntrepotsSection isMobile={isMobile} />}
        </ScrollView>
      )}
    </View>
  );
}

function InventaireSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { activeProducts, createStockAdjustment, getProductStock, getVariantsForProduct } = useData();
  const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'negative'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'value'>('name');
  const [adjustModal, setAdjustModal] = useState<string | null>(null);
  const [_adjustVariantId, setAdjustVariantId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [adjustVariantQtys, setAdjustVariantQtys] = useState<Record<string, string>>({});
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const physicalProducts = useMemo(() =>
    activeProducts.filter((p) => p.type !== 'service'),
    [activeProducts]
  );

  const getStockForProduct = useCallback((productId: string): number => {
    const pv = getVariantsForProduct(productId);
    if (pv.length > 0) return pv.reduce((s, v) => s + v.stockQuantity, 0);
    return getProductStock(productId);
  }, [getVariantsForProduct, getProductStock]);

  const getVariantStatus = useCallback((variantStock: number, variantMinStock: number, fallbackThreshold: number): { label: string; color: string; bgColor: string } => {
    const threshold = variantMinStock || fallbackThreshold;
    if (variantStock < 0) return { label: 'Négatif', color: colors.danger, bgColor: colors.dangerLight };
    if (variantStock === 0) return { label: 'Rupture', color: colors.danger, bgColor: colors.dangerLight };
    if (variantStock <= threshold) return { label: 'Bas', color: colors.warning, bgColor: colors.warningLight };
    return { label: 'OK', color: colors.success, bgColor: colors.successLight };
  }, [colors]);

  const getProductStatus = useCallback((productId: string, threshold: number): { label: string; color: string; bgColor: string } => {
    const pv = getVariantsForProduct(productId);
    if (pv.length === 0) {
      const stock = getProductStock(productId);
      if (stock < 0) return { label: 'Négatif', color: colors.danger, bgColor: colors.dangerLight };
      if (stock === 0) return { label: 'Rupture', color: colors.danger, bgColor: colors.dangerLight };
      if (stock <= threshold) return { label: 'Bas', color: colors.warning, bgColor: colors.warningLight };
      return { label: 'OK', color: colors.success, bgColor: colors.successLight };
    }
    const hasNegative = pv.some(v => v.stockQuantity < 0);
    if (hasNegative) return { label: 'Négatif', color: colors.danger, bgColor: colors.dangerLight };
    const allOut = pv.every(v => v.stockQuantity === 0);
    if (allOut) return { label: 'Rupture', color: colors.danger, bgColor: colors.dangerLight };
    const hasOut = pv.some(v => v.stockQuantity === 0);
    const hasLow = pv.some(v => v.stockQuantity > 0 && v.stockQuantity <= (v.minStock || threshold));
    if (hasOut || hasLow) return { label: 'Alerte', color: colors.warning, bgColor: colors.warningLight };
    return { label: 'OK', color: colors.success, bgColor: colors.successLight };
  }, [getVariantsForProduct, getProductStock, colors]);

  const summaryStats = useMemo(() => {
    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const p of physicalProducts) {
      const pv = getVariantsForProduct(p.id);
      if (pv.length > 0) {
        for (const v of pv) {
          if (v.stockQuantity === 0) outOfStockCount++;
          else if (v.stockQuantity > 0 && v.stockQuantity <= (v.minStock || p.lowStockThreshold)) lowStockCount++;
        }
      } else {
        const stock = getProductStock(p.id);
        if (stock === 0) outOfStockCount++;
        else if (stock > 0 && stock <= p.lowStockThreshold) lowStockCount++;
      }
    }
    return { lowStockCount, outOfStockCount };
  }, [physicalProducts, getVariantsForProduct, getProductStock]);

  const filtered = useMemo(() => {
    let list: typeof physicalProducts;
    if (filter === 'low') list = physicalProducts.filter((p) => {
      const pv = getVariantsForProduct(p.id);
      if (pv.length > 0) return pv.some(v => v.stockQuantity > 0 && v.stockQuantity <= (v.minStock || p.lowStockThreshold));
      const stock = getProductStock(p.id);
      return stock > 0 && stock <= p.lowStockThreshold;
    });
    else if (filter === 'out') list = physicalProducts.filter((p) => {
      const pv = getVariantsForProduct(p.id);
      if (pv.length > 0) return pv.some(v => v.stockQuantity === 0);
      return getProductStock(p.id) === 0;
    });
    else if (filter === 'negative') list = physicalProducts.filter((p) => {
      const pv = getVariantsForProduct(p.id);
      if (pv.length > 0) return pv.some(v => v.stockQuantity < 0);
      return getProductStock(p.id) < 0;
    });
    else list = physicalProducts;
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'stock': return getStockForProduct(a.id) - getStockForProduct(b.id);
        case 'value': return (b.salePrice * getStockForProduct(b.id)) - (a.salePrice * getStockForProduct(a.id));
        default: return 0;
      }
    });
  }, [physicalProducts, filter, getStockForProduct, getVariantsForProduct, getProductStock, sortBy]);

  const handleAdjust = useCallback(() => {
    if (!adjustModal) return;
    if (!adjustNotes.trim()) { setAdjustError('Le motif est obligatoire'); return; }
    const pVariants = getVariantsForProduct(adjustModal);
    if (pVariants.length >= 2) {
      let hasAny = false;
      for (const v of pVariants) {
        const qtyStr = adjustVariantQtys[v.id] || '';
        const qty = parseInt(qtyStr, 10);
        if (!isNaN(qty) && qty !== 0) {
          hasAny = true;
          const newStock = v.stockQuantity + qty;
          if (newStock < 0) { setAdjustError(`Stock négatif pour variante ${Object.values(v.attributes).join('/')}`); return; }
        }
      }
      if (!hasAny) { setAdjustError('Renseignez au moins une quantité'); return; }
      for (const v of pVariants) {
        const qtyStr = adjustVariantQtys[v.id] || '';
        const qty = parseInt(qtyStr, 10);
        if (!isNaN(qty) && qty !== 0) {
          createStockAdjustment(adjustModal, qty, `${adjustNotes} (variante: ${Object.values(v.attributes).join('/')})`);
        }
      }
    } else {
      const qty = parseInt(adjustQty, 10);
      if (isNaN(qty) || qty === 0) { setAdjustError('Quantité invalide'); return; }
      const result = createStockAdjustment(adjustModal, qty, adjustNotes);
      if (!result.success) { setAdjustError(result.error || 'Erreur'); return; }
    }
    setAdjustModal(null);
    setAdjustVariantId(null);
    setAdjustQty('');
    setAdjustNotes('');
    setAdjustError('');
    setAdjustVariantQtys({});
  }, [adjustModal, adjustQty, adjustNotes, adjustVariantQtys, createStockAdjustment, getVariantsForProduct]);

  const openAdjust = useCallback((productId: string, variantId?: string) => {
    setAdjustModal(productId);
    setAdjustVariantId(variantId || null);
    setAdjustQty('');
    setAdjustNotes('');
    setAdjustError('');
    setAdjustVariantQtys({});
  }, []);

  const FILTERS = [
    { label: 'Tous', value: 'all' as const },
    { label: 'Stock bas', value: 'low' as const },
    { label: 'Rupture', value: 'out' as const },
    { label: 'Stock négatif', value: 'negative' as const },
  ];

  return (
    <>
      <View style={[styles.summaryRow, isMobile && { flexDirection: 'column' as const }]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Package size={18} color={colors.primary} />
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{physicalProducts.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Produits physiques</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <AlertTriangle size={18} color={colors.warning} />
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>{summaryStats.lowStockCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Stock bas</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <AlertTriangle size={18} color={colors.danger} />
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{summaryStats.outOfStockCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Rupture</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, { backgroundColor: filter === f.value ? colors.primary : colors.card, borderColor: filter === f.value ? colors.primary : colors.cardBorder }]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterChipText, { color: filter === f.value ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        <ArrowUpDownIcon size={13} color={colors.textTertiary} />
        {([{ value: 'name' as const, label: 'Nom' }, { value: 'stock' as const, label: 'Stock' }, { value: 'value' as const, label: 'Valeur' }]).map((opt) => (
          <TouchableOpacity key={opt.value} style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? colors.primary : colors.card, borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder }]} onPress={() => setSortBy(opt.value)}>
            <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <Package size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{filter !== 'all' ? 'Aucun produit dans ce filtre' : 'Aucun produit en stock'}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Ajoutez des produits dans le catalogue pour gérer votre inventaire</Text>
        </View>
      ) : (
        <>
        {isMobile && filtered.length > 0 && (
          <View style={[styles.inventoryHeaderRowMobile, { backgroundColor: '#F9FAFB', borderColor: colors.border }]}>
            <Text style={[styles.inventoryColHeader, { flex: 1 }]}>PRODUIT</Text>
            <Text style={[styles.inventoryColHeader, { textAlign: 'right' as const }]}>STOCK / STATUT</Text>
          </View>
        )}
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {!isMobile && filtered.length > 0 && (
            <View style={[styles.inventoryHeaderRow, { backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.inventoryColHeader, { flex: 2 }]}>PRODUIT</Text>
              <Text style={[styles.inventoryColHeader, { flex: 1, textAlign: 'center' as const }]}>STOCK ACTUEL</Text>
              <Text style={[styles.inventoryColHeader, { flex: 1, textAlign: 'center' as const }]}>SEUIL</Text>
              <Text style={[styles.inventoryColHeader, { flex: 0.8, textAlign: 'center' as const }]}>STATUT</Text>
              <Text style={[styles.inventoryColHeader, { flex: 0.6, textAlign: 'center' as const }]}>ACTIONS</Text>
            </View>
          )}
          {filtered.map((product, i) => {
            const stockQty = getStockForProduct(product.id);
            const pVariants = getVariantsForProduct(product.id);
            const hasVariants = pVariants.length > 0;
            const isExpanded = expandedProducts.has(product.id);
            const productStatus = getProductStatus(product.id, product.lowStockThreshold);
            const isNegative = stockQty < 0;
            const stockMaxRef = Math.max(product.lowStockThreshold * 3, 1);
            const stockPercent = isNegative ? 0 : Math.min((stockQty / stockMaxRef) * 100, 100);
            const stockBarColor = productStatus.label === 'OK' ? colors.success : productStatus.label === 'Alerte' || productStatus.label === 'Bas' ? colors.warning : colors.danger;
            return (
              <View key={product.id}>
                <TouchableOpacity
                  activeOpacity={hasVariants ? 0.7 : 1}
                  onPress={() => { if (hasVariants) toggleExpand(product.id); }}
                  style={[styles.productRow, i < filtered.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }, i % 2 === 1 && { backgroundColor: colors.surfaceHover + '60' }, isNegative && { backgroundColor: colors.dangerLight + '30' }]}
                >
                  <View style={styles.productRowMain}>
                    <View style={[styles.productInfo, !isMobile && { flex: 2 }]}>
                      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
                        {hasVariants && (
                          isExpanded
                            ? <ChevronDown size={14} color={colors.textTertiary} />
                            : <ChevronRight size={14} color={colors.textTertiary} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.productName, { color: isNegative ? colors.danger : colors.text }]}>{product.name}</Text>
                          <Text style={[styles.productSku, { color: colors.textTertiary }]}>{product.sku}</Text>
                        </View>
                      </View>
                      {isNegative && (
                        <View style={[styles.negativeStockBadge, { backgroundColor: colors.danger }]}>
                          <Text style={styles.negativeStockBadgeText}>Stock négatif</Text>
                        </View>
                      )}
                      <View style={styles.stockBarContainer}>
                        <View style={[styles.stockBarBg, { backgroundColor: colors.borderLight }]}>
                          <View style={[styles.stockBarFill, { width: `${stockPercent}%` as never, backgroundColor: stockBarColor }]} />
                        </View>
                      </View>
                    </View>
                    <View style={[!isMobile && { flex: 1, alignItems: 'center' as const }]}>
                      <View style={[styles.stockBadgeLarge, { backgroundColor: productStatus.bgColor }]}>
                        <Text style={[styles.stockTextLarge, { color: productStatus.color }]}>
                          {stockQty} {product.unit}
                        </Text>
                      </View>
                      {hasVariants && (
                        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{pVariants.length} variante{pVariants.length > 1 ? 's' : ''}</Text>
                      )}
                    </View>
                    {!isMobile && (
                      <View style={{ flex: 1, alignItems: 'center' as const }}>
                        <Text style={[styles.productSku, { color: productStatus.label !== 'OK' ? colors.danger : colors.textTertiary, fontWeight: productStatus.label !== 'OK' ? '600' as const : '400' as const }]}>{product.lowStockThreshold}</Text>
                      </View>
                    )}
                    {!isMobile && (
                      <View style={{ flex: 0.8, alignItems: 'center' as const }}>
                        <View style={[styles.statusBadge, { backgroundColor: productStatus.color }]}>
                          <Text style={[styles.statusBadgeText, { color: '#FFFFFF' }]}>
                            {productStatus.label}
                          </Text>
                        </View>
                      </View>
                    )}
                    <View style={[!isMobile && { flex: 0.6, alignItems: 'center' as const }]}>
                      <TouchableOpacity onPress={() => openAdjust(product.id)} style={[styles.adjustBtn, { borderColor: colors.border }]}>
                        <ArrowUpDownIcon size={14} color={colors.primary} />
                        {!isMobile && <Text style={[styles.adjustBtnText, { color: colors.primary }]}>Ajuster</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
                {hasVariants && isExpanded && (
                  <View style={{ borderBottomWidth: i < filtered.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                    {pVariants.map((variant, vi) => {
                      const variantStatus = getVariantStatus(variant.stockQuantity, variant.minStock, product.lowStockThreshold);
                      const attrLabel = Object.keys(variant.attributes).length > 0
                        ? Object.entries(variant.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ')
                        : 'Variante par défaut';
                      return (
                        <View
                          key={variant.id}
                          style={[
                            invStyles.variantSubRow,
                            { backgroundColor: colors.surfaceHover + '40', borderTopWidth: vi === 0 ? 1 : 0, borderTopColor: colors.borderLight },
                            vi < pVariants.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight + '80' },
                          ]}
                        >
                          <View style={styles.productRowMain}>
                            <View style={[styles.productInfo, !isMobile && { flex: 2 }]}>
                              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingLeft: 20 }}>
                                <View style={[invStyles.variantDot, { backgroundColor: variantStatus.color }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[invStyles.variantAttrText, { color: colors.text }]}>{attrLabel}</Text>
                                  {variant.sku ? <Text style={[styles.productSku, { color: colors.textTertiary, fontSize: 10 }]}>{variant.sku}</Text> : null}
                                </View>
                              </View>
                            </View>
                            <View style={[!isMobile && { flex: 1, alignItems: 'center' as const }]}>
                              <View style={[invStyles.variantStockBadge, { backgroundColor: variantStatus.bgColor }]}>
                                <Text style={[invStyles.variantStockText, { color: variantStatus.color }]}>
                                  {variant.stockQuantity} {product.unit}
                                </Text>
                              </View>
                            </View>
                            {!isMobile && (
                              <View style={{ flex: 1, alignItems: 'center' as const }}>
                                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{variant.minStock || product.lowStockThreshold}</Text>
                              </View>
                            )}
                            {!isMobile && (
                              <View style={{ flex: 0.8, alignItems: 'center' as const }}>
                                <View style={[invStyles.variantStatusBadge, { backgroundColor: variantStatus.bgColor }]}>
                                  <Text style={[invStyles.variantStatusText, { color: variantStatus.color }]}>
                                    {variantStatus.label}
                                  </Text>
                                </View>
                              </View>
                            )}
                            {isMobile && (
                              <View style={[invStyles.variantStatusBadge, { backgroundColor: variantStatus.bgColor }]}>
                                <Text style={[invStyles.variantStatusText, { color: variantStatus.color }]}>
                                  {variantStatus.label}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        </>
      )}

      <FormModal
        visible={adjustModal !== null}
        onClose={() => setAdjustModal(null)}
        title="Ajustement de stock"
        subtitle="Correction manuelle d'inventaire"
        onSubmit={handleAdjust}
        submitLabel="Appliquer"
      >
        {adjustError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{adjustError}</Text>
          </View>
        ) : null}
        {adjustModal && (() => {
          const pVars = getVariantsForProduct(adjustModal);
          if (pVars.length >= 2) {
            return (
              <View style={{ gap: 10 }}>
                {pVars.map((v) => {
                  const attrLabel = Object.keys(v.attributes).length > 0
                    ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ')
                    : 'Variante par défaut';
                  return (
                    <View key={v.id} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, backgroundColor: colors.surfaceHover, borderRadius: 8, padding: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.text }}>{attrLabel}</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>Stock actuel : {v.stockQuantity}</Text>
                      </View>
                      <View style={{ width: 90 }}>
                        <TextInput
                          style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: colors.text, textAlign: 'center' as const }}
                          value={adjustVariantQtys[v.id] || ''}
                          onChangeText={(val: string) => setAdjustVariantQtys(prev => ({ ...prev, [v.id]: val }))}
                          placeholder="+/-"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          }
          return <FormField label="Quantité (+ ou -)" value={adjustQty} onChangeText={setAdjustQty} placeholder="+10 ou -5" keyboardType="numeric" required />;
        })()}
        <FormField label="Motif" value={adjustNotes} onChangeText={setAdjustNotes} placeholder="Motif de l'ajustement (obligatoire)" required multiline numberOfLines={2} />
      </FormModal>
    </>
  );
}

const invStyles = StyleSheet.create({
  variantSubRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  variantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  variantAttrText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  variantStockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  variantStockText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  variantStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variantStatusText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
});

function MouvementsSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { stockMovements, activeProducts } = useData();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'product' | 'type'>('date');
  const [productFilter, _setProductFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let list = stockMovements;
    if (typeFilter !== 'all') {
      list = list.filter((sm) => sm.type === typeFilter);
    }
    if (productFilter !== 'all') {
      list = list.filter((sm) => sm.productId === productFilter);
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'product': return (a.productName || '').localeCompare(b.productName || '');
        case 'type': return a.type.localeCompare(b.type);
        default: return 0;
      }
    });
  }, [stockMovements, typeFilter, productFilter, sortBy]);

  const TYPE_FILTERS = [
    { label: 'Tous', value: 'all' },
    { label: 'Entrée achat', value: 'purchase_in' },
    { label: 'Sortie vente', value: 'sale_out' },
    { label: 'Ajustement', value: 'adjustment' },
    { label: 'Correction', value: 'inventory_correction' },
  ];

  const getTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      purchase_in: 'Entrée achat',
      sale_out: 'Sortie vente',
      adjustment: 'Ajustement',
      inventory_correction: 'Correction inventaire',
      in: 'Entrée',
      out: 'Sortie',
    };
    return map[type] || type;
  };

  const getTypeColor = (type: string) => {
    if (type === 'purchase_in' || type === 'in') return { bg: colors.successLight, text: colors.success };
    if (type === 'sale_out' || type === 'out') return { bg: colors.dangerLight, text: colors.danger };
    return { bg: colors.warningLight, text: colors.warning };
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {TYPE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, { backgroundColor: typeFilter === f.value ? colors.primary : colors.card, borderColor: typeFilter === f.value ? colors.primary : colors.cardBorder }]}
            onPress={() => setTypeFilter(f.value)}
          >
            <Text style={[styles.filterChipText, { color: typeFilter === f.value ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        <ArrowUpDownIcon size={13} color={colors.textTertiary} />
        {([{ value: 'date' as const, label: 'Date' }, { value: 'product' as const, label: 'Produit' }, { value: 'type' as const, label: 'Type' }]).map((opt) => (
          <TouchableOpacity key={opt.value} style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? colors.primary : colors.card, borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder }]} onPress={() => setSortBy(opt.value)}>
            <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <History size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun mouvement de stock</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Les entrées, sorties et corrections apparaîtront ici</Text>
        </View>
      ) : (
        <View style={styles.timelineContainer}>
          {filtered.map((sm, i) => {
            const tc = getTypeColor(sm.type);
            const isIn = sm.type === 'purchase_in' || sm.type === 'in';
            const isOut = sm.type === 'sale_out' || sm.type === 'out';
            const productName = sm.productName || activeProducts.find((p) => p.id === sm.productId)?.name || 'Inconnu';
            return (
              <View key={sm.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineIcon, { backgroundColor: tc.bg }]}>
                    {isIn ? <ArrowUp size={14} color={tc.text} /> : isOut ? <ArrowDown size={14} color={tc.text} /> : <RotateCcw size={14} color={tc.text} />}
                  </View>
                  {i < filtered.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: colors.borderLight }]} />
                  )}
                </View>
                <View style={[styles.timelineContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.timelineContentHeader}>
                    <Text style={[styles.movementProduct, { color: colors.text }]}>{productName}</Text>
                    <View style={[styles.timelineQtyBadge, { backgroundColor: tc.bg }]}>
                      <Text style={[styles.timelineQtyText, { color: tc.text }]}>{sm.quantity > 0 ? '+' : ''}{sm.quantity}</Text>
                    </View>
                  </View>
                  <Text style={[styles.movementMeta, { color: colors.textTertiary }]}>
                    {getTypeLabel(sm.type)} · {sm.reference}
                  </Text>
                  <Text style={[styles.timelineDate, { color: colors.textTertiary }]}>{formatDate(sm.createdAt)}</Text>
                  {sm.notes ? <Text style={[styles.movementNotes, { color: colors.textSecondary }]}>{sm.notes}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

function EntrepotsSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const {
    warehouses, warehouseTransfers, activeProducts,
    createWarehouse, updateWarehouse, deleteWarehouse, createWarehouseTransfer,
  } = useData();
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPostalCode, setFormPostalCode] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formCountry, setFormCountry] = useState('France');
  const [formResponsable, setFormResponsable] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [transferVisible, setTransferVisible] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferError, setTransferError] = useState('');

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormName('');
    setFormAddress('');
    setFormPostalCode('');
    setFormCity('');
    setFormCountry('France');
    setFormResponsable('');
    setFormPhone('');
    setFormIsDefault(false);
    setFormError('');
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((wh: WarehouseType) => {
    setEditingId(wh.id);
    setFormName(wh.name);
    setFormAddress(wh.address);
    setFormPostalCode('');
    setFormCity('');
    setFormCountry('France');
    setFormResponsable('');
    setFormIsDefault(wh.isDefault);
    setFormError('');
    setFormVisible(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!formName.trim()) { setFormError('Le nom est requis'); return; }
    const fullAddress = [formAddress.trim(), formPostalCode.trim(), formCity.trim(), formCountry.trim()].filter(Boolean).join(', ');
    const result = editingId
      ? updateWarehouse(editingId, { name: formName.trim(), address: fullAddress, isDefault: formIsDefault })
      : createWarehouse({ name: formName.trim(), address: fullAddress, isDefault: formIsDefault });
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [formName, formAddress, formPostalCode, formCity, formCountry, formIsDefault, editingId, createWarehouse, updateWarehouse]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteWarehouse(deleteConfirm);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteWarehouse]);

  const openTransfer = useCallback(() => {
    setTransferFrom(warehouses.length > 0 ? warehouses[0].id : '');
    setTransferTo(warehouses.length > 1 ? warehouses[1].id : '');
    setTransferProductId('');
    setTransferQty('');
    setTransferNotes('');
    setTransferError('');
    setTransferVisible(true);
  }, [warehouses]);

  const handleTransfer = useCallback(() => {
    if (!transferFrom || !transferTo) { setTransferError('Sélectionnez les entrepôts'); return; }
    if (!transferProductId) { setTransferError('Sélectionnez un produit'); return; }
    const qty = parseInt(transferQty, 10);
    if (isNaN(qty) || qty <= 0) { setTransferError('Quantité invalide'); return; }
    const result = createWarehouseTransfer({
      fromWarehouseId: transferFrom,
      toWarehouseId: transferTo,
      productId: transferProductId,
      quantity: qty,
      notes: transferNotes,
    });
    if (!result.success) { setTransferError(result.error || 'Erreur'); return; }
    setTransferVisible(false);
  }, [transferFrom, transferTo, transferProductId, transferQty, transferNotes, createWarehouseTransfer]);

  const physicalProducts = useMemo(() =>
    activeProducts.filter(p => p.type !== 'service'),
    [activeProducts]
  );

  return (
    <>
      <View style={styles.searchRow}>
        <TouchableOpacity style={[styles.whAddBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Plus size={16} color="#FFF" />
          {!isMobile && <Text style={styles.whAddBtnText}>Nouvel entrepôt</Text>}
        </TouchableOpacity>
        {warehouses.length >= 2 && (
          <TouchableOpacity style={[styles.whTransferBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={openTransfer}>
            <ArrowRightLeft size={16} color={colors.primary} />
            {!isMobile && <Text style={[styles.whTransferBtnText, { color: colors.primary }]}>Transfert</Text>}
          </TouchableOpacity>
        )}
      </View>

      {warehouses.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <Warehouse size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun entrepôt pour l’instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            Créez des entrepôts pour gérer votre stock par lieu de stockage
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {warehouses.map((wh) => (
            <View key={wh.id} style={[styles.whCard, { backgroundColor: colors.card, borderColor: wh.isDefault ? colors.primary : colors.cardBorder }]}>
              <View style={styles.whCardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                    <Text style={[styles.whCardName, { color: colors.text }]}>{wh.name}</Text>
                    {wh.isDefault && (
                      <View style={[styles.whDefaultBadge, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.whDefaultBadgeText, { color: colors.primary }]}>Par défaut</Text>
                      </View>
                    )}
                  </View>
                  {wh.address ? <Text style={[styles.whCardAddress, { color: colors.textTertiary }]}>{wh.address}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row' as const, gap: 6 }}>
                  <TouchableOpacity onPress={() => openEdit(wh)} style={[styles.whIconBtn, { backgroundColor: colors.primaryLight }]}>
                    <Pencil size={13} color={colors.primary} />
                  </TouchableOpacity>
                  {!wh.isDefault && (
                    <TouchableOpacity onPress={() => setDeleteConfirm(wh.id)} style={[styles.whIconBtn, { backgroundColor: colors.dangerLight }]}>
                      <Trash2 size={13} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {warehouseTransfers.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.whSectionTitle, { color: colors.text }]}>Transferts récents</Text>
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {warehouseTransfers.slice(0, 20).map((t, i) => (
              <View key={t.id} style={[styles.movementRow, i < Math.min(warehouseTransfers.length, 20) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={[styles.typeBadge, { backgroundColor: colors.primaryLight }]}>
                  <ArrowRightLeft size={14} color={colors.primary} />
                </View>
                <View style={styles.movementInfo}>
                  <Text style={[styles.movementProduct, { color: colors.text }]}>{t.productName} ×{t.quantity}</Text>
                  <Text style={[styles.movementMeta, { color: colors.textTertiary }]}>
                    {t.fromWarehouseName} → {t.toWarehouseName} · {formatDate(t.createdAt)}
                  </Text>
                  {t.notes ? <Text style={[styles.movementNotes, { color: colors.textSecondary }]}>{t.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Mettre à jour' : 'Créer'}
      >
        {formError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
          </View>
        ) : null}
        <FormField label="Nom" value={formName} onChangeText={setFormName} placeholder="Nom de l'entrepôt" required />
        <FormField label="Responsable" value={formResponsable} onChangeText={setFormResponsable} placeholder="Nom du responsable (optionnel)" />
        <AddressFields
          address={formAddress}
          postalCode={formPostalCode}
          city={formCity}
          country={formCountry}
          onAddressChange={setFormAddress}
          onPostalCodeChange={setFormPostalCode}
          onCityChange={setFormCity}
          onCountryChange={setFormCountry}
        />
        <PhoneField value={formPhone} onChangeText={setFormPhone} label="Téléphone (optionnel)" />
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text }}>Entrepôt par défaut</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Définir comme lieu de stockage principal</Text>
          </View>
          <TouchableOpacity
            onPress={() => setFormIsDefault(!formIsDefault)}
            style={[{
              width: 48, height: 28, borderRadius: 14,
              backgroundColor: formIsDefault ? colors.primary : colors.border,
              justifyContent: 'center' as const,
              paddingHorizontal: 2,
            }]}
          >
            <View style={[{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: '#FFF',
              alignSelf: formIsDefault ? 'flex-end' as const : 'flex-start' as const,
            }]} />
          </TouchableOpacity>
        </View>
      </FormModal>

      <FormModal
        visible={transferVisible}
        onClose={() => setTransferVisible(false)}
        title="Transfert inter-entrepôts"
        subtitle="Déplacer du stock entre entrepôts"
        onSubmit={handleTransfer}
        submitLabel="Transférer"
      >
        {transferError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{transferError}</Text>
          </View>
        ) : null}
        <View style={{ gap: 8 }}>
          <Text style={[{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }]}>Entrepôt source</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {warehouses.map(wh => (
              <TouchableOpacity
                key={wh.id}
                style={[styles.whSelectChip, { backgroundColor: transferFrom === wh.id ? colors.primary : colors.inputBg, borderColor: transferFrom === wh.id ? colors.primary : colors.inputBorder }]}
                onPress={() => setTransferFrom(wh.id)}
              >
                <Text style={[styles.whSelectChipText, { color: transferFrom === wh.id ? '#FFF' : colors.text }]}>{wh.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }]}>Entrepôt destination</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {warehouses.filter(wh => wh.id !== transferFrom).map(wh => (
              <TouchableOpacity
                key={wh.id}
                style={[styles.whSelectChip, { backgroundColor: transferTo === wh.id ? colors.primary : colors.inputBg, borderColor: transferTo === wh.id ? colors.primary : colors.inputBorder }]}
                onPress={() => setTransferTo(wh.id)}
              >
                <Text style={[styles.whSelectChipText, { color: transferTo === wh.id ? '#FFF' : colors.text }]}>{wh.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }]}>Produit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {physicalProducts.slice(0, 30).map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.whSelectChip, { backgroundColor: transferProductId === p.id ? colors.primary : colors.inputBg, borderColor: transferProductId === p.id ? colors.primary : colors.inputBorder }]}
                onPress={() => setTransferProductId(p.id)}
              >
                <Text style={[styles.whSelectChipText, { color: transferProductId === p.id ? '#FFF' : colors.text }]} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <FormField label="Quantité" value={transferQty} onChangeText={setTransferQty} placeholder="Quantité à transférer" keyboardType="numeric" required />
        <FormField label="Notes" value={transferNotes} onChangeText={setTransferNotes} placeholder="Notes (optionnel)" />
      </FormModal>

      <ConfirmModal
        visible={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Supprimer cet entrepôt ?"
        message="L'entrepôt sera définitivement supprimé."
        confirmLabel="Supprimer"
        destructive
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 12, paddingBottom: 40 },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBarRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  tabBar: { flexDirection: 'row' as const, gap: 0, flex: 1 },
  tab: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 6, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' as const },
  summaryRow: { flexDirection: 'row' as const, gap: 12 },
  summaryCard: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 14, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  summaryInfo: { flex: 1 },
  summaryValue: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 4, opacity: 0.7 },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '500' as const },
  tableCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  productRow: { paddingHorizontal: 16, paddingVertical: 12 },
  productRowMain: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600' as const },
  productSku: { fontSize: 12, marginTop: 2 },
  stockBarContainer: { marginTop: 6, width: '100%' as const, maxWidth: 120 },
  stockBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' as const },
  stockBarFill: { height: 4, borderRadius: 2 },
  stockBadgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  stockTextLarge: { fontSize: 14, fontWeight: '700' as const },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3 },
  adjustBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, gap: 4 },
  adjustBtnText: { fontSize: 12, fontWeight: '600' as const },
  negativeStockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' as const, marginTop: 4 },
  negativeStockBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const },
  emptyState: { alignItems: 'center' as const, paddingVertical: 48, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, textAlign: 'center' as const },
  emptySubtitle: { fontSize: 13, textAlign: 'center' as const, lineHeight: 18 },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' as const },
  sortRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingBottom: 4 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontWeight: '500' as const },
  inventoryHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10 },
  inventoryHeaderRowMobile: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderRadius: 10, marginBottom: 4 },
  inventoryColHeader: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: '#6B7280' },
  movementRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, minWidth: 44, alignItems: 'center' as const },
  typeBadgeText: { fontSize: 13, fontWeight: '700' as const },
  movementInfo: { flex: 1 },
  movementProduct: { fontSize: 14, fontWeight: '600' as const },
  movementMeta: { fontSize: 12, marginTop: 2 },
  movementNotes: { fontSize: 12, marginTop: 2, fontStyle: 'italic' as const },
  searchRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 4 },
  whAddBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  whAddBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  whTransferBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 6 },
  whTransferBtnText: { fontSize: 14, fontWeight: '600' as const },
  whCard: { borderWidth: 1, borderRadius: 14, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  whCardHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  whCardName: { fontSize: 16, fontWeight: '700' as const },
  whCardAddress: { fontSize: 12, marginTop: 2 },
  whDefaultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  whDefaultBadgeText: { fontSize: 10, fontWeight: '600' as const },
  whIconBtn: { padding: 8, borderRadius: 6 },
  whSectionTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 10 },
  whSelectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  whSelectChipText: { fontSize: 13, fontWeight: '500' as const },
  timelineContainer: { gap: 0 },
  timelineItem: { flexDirection: 'row' as const, minHeight: 80 },
  timelineLeft: { width: 40, alignItems: 'center' as const },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -4 },
  timelineContent: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, marginLeft: 8, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  timelineContentHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 4 },
  timelineQtyBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  timelineQtyText: { fontSize: 13, fontWeight: '700' as const },
  timelineDate: { fontSize: 11, marginTop: 4 },
});
