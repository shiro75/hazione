/**
 * components/stock/InventaireSection.tsx
 *
 * Section Inventaire — liste les produits physiques avec :
 * - Filtres (tous, stock bas, rupture, négatif)
 * - Tri (nom, stock, valeur)
 * - Affichage variantes expandables
 * - Stock théorique pour produits transformés (calculé depuis recettes)
 * - Modal d'ajustement de stock (par variante ou global)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import {
  Package, AlertTriangle, ArrowUpDown as ArrowUpDownIcon,
  ChevronDown, ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import { styles } from './stockStyles';

export default function InventaireSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const {
    activeProducts, createStockAdjustment,
    getProductStock, getVariantsForProduct, getRecipeForProduct,
    products: allProducts, variants: allVariants,
  } = useData();

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
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  // ── Catégories de produits ─────────────────────────────────────────────────

  const countableProducts = useMemo(() =>
    activeProducts.filter((p) => p.type !== 'service' && p.type !== 'produit_transforme' && p.type !== 'produit_fini'),
    [activeProducts]);

  const transformedProducts = useMemo(() =>
    activeProducts.filter((p) => p.type === 'produit_transforme' || p.type === 'produit_fini'),
    [activeProducts]);

  const physicalProducts = useMemo(() =>
    activeProducts.filter((p) => p.type !== 'service'),
    [activeProducts]);

  // ── Stock théorique (produits transformés) ─────────────────────────────────

  const getTheoreticalStock = useCallback((product: typeof activeProducts[0]): number | null => {
    const recipe = getRecipeForProduct(product.id);
    if (!recipe || recipe.items.length === 0) return null;
    let minProducible = Infinity;
    for (const item of recipe.items) {
      const ingredientProduct = allProducts.find((p) => p.id === item.ingredientProductId);
      if (!ingredientProduct) return null;
      let availableStock = 0;
      if (item.ingredientVariantId) {
        const variant = allVariants.find((v) => v.id === item.ingredientVariantId);
        availableStock = variant?.stockQuantity ?? 0;
      } else {
        const pvs = getVariantsForProduct(item.ingredientProductId);
        if (pvs.length > 0) availableStock = pvs.reduce((s, v) => s + v.stockQuantity, 0);
        else availableStock = getProductStock(item.ingredientProductId);
      }
      if (item.quantity > 0) minProducible = Math.min(minProducible, Math.floor(availableStock / item.quantity));
    }
    return minProducible === Infinity ? null : minProducible;
  }, [getRecipeForProduct, allProducts, allVariants, getVariantsForProduct, getProductStock]);

  // ── Helpers stock ──────────────────────────────────────────────────────────

  const getStockForProduct = useCallback((productId: string): number => {
    const pv = getVariantsForProduct(productId);
    if (pv.length > 0) return pv.reduce((s, v) => s + v.stockQuantity, 0);
    return getProductStock(productId);
  }, [getVariantsForProduct, getProductStock]);

  const getVariantStatus = useCallback((variantStock: number, variantMinStock: number, fallbackThreshold: number) => {
    const threshold = variantMinStock || fallbackThreshold;
    if (variantStock < 0) return { label: 'Négatif', color: colors.danger, bgColor: colors.dangerLight };
    if (variantStock === 0) return { label: 'Rupture', color: colors.danger, bgColor: colors.dangerLight };
    if (variantStock <= threshold) return { label: 'Bas', color: colors.warning, bgColor: colors.warningLight };
    return { label: 'OK', color: colors.success, bgColor: colors.successLight };
  }, [colors]);

  const getProductStatus = useCallback((productId: string, threshold: number) => {
    const pv = getVariantsForProduct(productId);
    if (pv.length === 0) {
      const stock = getProductStock(productId);
      if (stock < 0) return { label: 'Négatif', color: colors.danger, bgColor: colors.dangerLight };
      if (stock === 0) return { label: 'Rupture', color: colors.danger, bgColor: colors.dangerLight };
      if (stock <= threshold) return { label: 'Bas', color: colors.warning, bgColor: colors.warningLight };
      return { label: 'OK', color: colors.success, bgColor: colors.successLight };
    }
    if (pv.some((v) => v.stockQuantity < 0)) return { label: 'Négatif', color: colors.danger, bgColor: colors.dangerLight };
    if (pv.every((v) => v.stockQuantity === 0)) return { label: 'Rupture', color: colors.danger, bgColor: colors.dangerLight };
    if (pv.some((v) => v.stockQuantity === 0) || pv.some((v) => v.stockQuantity > 0 && v.stockQuantity <= (v.minStock || threshold))) {
      return { label: 'Alerte', color: colors.warning, bgColor: colors.warningLight };
    }
    return { label: 'OK', color: colors.success, bgColor: colors.successLight };
  }, [getVariantsForProduct, getProductStock, colors]);

  // ── KPIs résumés ───────────────────────────────────────────────────────────

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

  // ── Filtrage & tri ─────────────────────────────────────────────────────────

  const applyFilter = useCallback((list: typeof physicalProducts) => {
    let result: typeof physicalProducts;
    if (filter === 'low') result = list.filter((p) => {
      const pv = getVariantsForProduct(p.id);
      if (pv.length > 0) return pv.some((v) => v.stockQuantity > 0 && v.stockQuantity <= (v.minStock || p.lowStockThreshold));
      const stock = getProductStock(p.id);
      return stock > 0 && stock <= p.lowStockThreshold;
    });
    else if (filter === 'out') result = list.filter((p) => {
      const pv = getVariantsForProduct(p.id);
      if (pv.length > 0) return pv.some((v) => v.stockQuantity === 0);
      return getProductStock(p.id) === 0;
    });
    else if (filter === 'negative') result = list.filter((p) => {
      const pv = getVariantsForProduct(p.id);
      if (pv.length > 0) return pv.some((v) => v.stockQuantity < 0);
      return getProductStock(p.id) < 0;
    });
    else result = list;
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'stock': return getStockForProduct(a.id) - getStockForProduct(b.id);
        case 'value': return (b.salePrice * getStockForProduct(b.id)) - (a.salePrice * getStockForProduct(a.id));
        default: return 0;
      }
    });
  }, [filter, getStockForProduct, getVariantsForProduct, getProductStock, sortBy]);

  const filtered = useMemo(() => applyFilter(countableProducts), [countableProducts, applyFilter]);
  const filteredTransformed = useMemo(() => {
    if (filter !== 'all') return applyFilter(transformedProducts);
    return [...transformedProducts].sort((a, b) => a.name.localeCompare(b.name));
  }, [transformedProducts, filter, applyFilter]);

  // ── Ajustement de stock ────────────────────────────────────────────────────

  const openAdjust = useCallback((productId: string, variantId?: string) => {
    setAdjustModal(productId);
    setAdjustVariantId(variantId || null);
    setAdjustQty(''); setAdjustNotes(''); setAdjustError(''); setAdjustVariantQtys({});
  }, []);

  const handleAdjust = useCallback(() => {
    if (!adjustModal) return;
    if (!adjustNotes.trim()) { setAdjustError('Le motif est obligatoire'); return; }
    const pVars = getVariantsForProduct(adjustModal);
    if (pVars.length >= 2) {
      let hasAny = false;
      for (const v of pVars) {
        const qty = parseInt(adjustVariantQtys[v.id] || '', 10);
        if (!isNaN(qty) && qty !== 0) {
          hasAny = true;
          if (v.stockQuantity + qty < 0) { setAdjustError(`Stock négatif pour variante ${Object.values(v.attributes).join('/')}`); return; }
        }
      }
      if (!hasAny) { setAdjustError('Renseignez au moins une quantité'); return; }
      for (const v of pVars) {
        const qty = parseInt(adjustVariantQtys[v.id] || '', 10);
        if (!isNaN(qty) && qty !== 0) {
          createStockAdjustment(adjustModal, qty, `${adjustNotes} (variante: ${Object.values(v.attributes).join('/')})`, v.id);
        }
      }
    } else {
      const qty = parseInt(adjustQty, 10);
      if (isNaN(qty) || qty === 0) { setAdjustError('Quantité invalide'); return; }
      const singleVariant = pVars.length === 1 ? pVars[0].id : undefined;
      const result = createStockAdjustment(adjustModal, qty, adjustNotes, singleVariant);
      if (!result.success) { setAdjustError(result.error || 'Erreur'); return; }
    }
    setAdjustModal(null); setAdjustVariantId(null);
    setAdjustQty(''); setAdjustNotes(''); setAdjustError(''); setAdjustVariantQtys({});
  }, [adjustModal, adjustQty, adjustNotes, adjustVariantQtys, createStockAdjustment, getVariantsForProduct]);

  const FILTERS = [
    { label: 'Tous', value: 'all' as const },
    { label: 'Stock bas', value: 'low' as const },
    { label: 'Rupture', value: 'out' as const },
    { label: 'Stock négatif', value: 'negative' as const },
  ];

  // ── Rendu d'une ligne produit ──────────────────────────────────────────────

  const renderProductRow = (product: typeof activeProducts[0], idx: number, listLength: number, isTransformed = false) => {
    const pVariants = getVariantsForProduct(product.id);
    const hasVariants = pVariants.length > 0;
    const isExpanded = expandedProducts.has(product.id);

    if (isTransformed) {
      // Ligne produit transformé avec stock théorique
      const theoreticalStock = getTheoreticalStock(product);
      const hasRecipe = theoreticalStock !== null;
      const stockLabel = hasRecipe ? `${theoreticalStock}` : '—';
      const statusColor = !hasRecipe ? colors.textTertiary : theoreticalStock <= 0 ? colors.danger : theoreticalStock <= product.lowStockThreshold ? colors.warning : colors.success;
      const statusBg = !hasRecipe ? colors.surfaceHover : theoreticalStock <= 0 ? colors.dangerLight : theoreticalStock <= product.lowStockThreshold ? colors.warningLight : colors.successLight;
      const statusLabel = !hasRecipe ? 'Sans recette' : theoreticalStock <= 0 ? 'Rupture' : theoreticalStock <= product.lowStockThreshold ? 'Bas' : 'OK';
      const realVariants = pVariants.filter((v) => Object.keys(v.attributes).length > 0);

      return (
        <View key={product.id}>
          <TouchableOpacity
            activeOpacity={realVariants.length > 0 ? 0.7 : 1}
            onPress={() => { if (realVariants.length > 0) toggleExpand(product.id); }}
            style={[styles.productRow, idx < listLength - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }, idx % 2 === 1 && { backgroundColor: colors.surfaceHover + '60' }]}
          >
            <View style={styles.productRowMain}>
              <View style={[styles.productInfo, !isMobile && { flex: 2 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {realVariants.length > 0 && (isExpanded ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronRight size={14} color={colors.textTertiary} />)}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                    <Text style={[styles.productSku, { color: colors.textTertiary }]}>{product.sku}</Text>
                  </View>
                </View>
                {realVariants.length > 0 && <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{realVariants.length} variante{realVariants.length > 1 ? 's' : ''}</Text>}
              </View>
              <View style={[!isMobile && { flex: 1, alignItems: 'center' }]}>
                <View style={[styles.stockBadgeLarge, { backgroundColor: statusBg }]}>
                  <Text style={[styles.stockTextLarge, { color: statusColor }]}>{stockLabel} {hasRecipe ? product.unit : ''}</Text>
                </View>
              </View>
              {!isMobile && <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 11, color: hasRecipe ? colors.success : colors.textTertiary, fontWeight: '500' }}>{hasRecipe ? 'Définie' : 'Non définie'}</Text></View>}
              {!isMobile && <View style={{ flex: 0.8, alignItems: 'center' }}><View style={[styles.statusBadge, { backgroundColor: statusColor }]}><Text style={[styles.statusBadgeText, { color: '#FFF' }]}>{statusLabel}</Text></View></View>}
              {isMobile && <View style={[styles.variantStatusBadge, { backgroundColor: statusBg }]}><Text style={[styles.variantStatusText, { color: statusColor }]}>{statusLabel}</Text></View>}
            </View>
          </TouchableOpacity>
          {realVariants.length > 0 && isExpanded && renderTransformedVariants(product, realVariants)}
        </View>
      );
    }

    // Ligne produit physique standard
    const stockQty = getStockForProduct(product.id);
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
          style={[styles.productRow, idx < listLength - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }, idx % 2 === 1 && { backgroundColor: colors.surfaceHover + '60' }, isNegative && { backgroundColor: colors.dangerLight + '30' }]}
        >
          <View style={styles.productRowMain}>
            <View style={[styles.productInfo, !isMobile && { flex: 2 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {hasVariants && (isExpanded ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronRight size={14} color={colors.textTertiary} />)}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.productName, { color: isNegative ? colors.danger : colors.text }]}>{product.name}</Text>
                  <Text style={[styles.productSku, { color: colors.textTertiary }]}>{product.sku}</Text>
                </View>
              </View>
              {isNegative && <View style={[styles.negativeStockBadge, { backgroundColor: colors.danger }]}><Text style={styles.negativeStockBadgeText}>Stock négatif</Text></View>}
              <View style={styles.stockBarContainer}>
                <View style={[styles.stockBarBg, { backgroundColor: colors.borderLight }]}>
                  <View style={[styles.stockBarFill, { width: `${stockPercent}%` as any, backgroundColor: stockBarColor }]} />
                </View>
              </View>
            </View>
            <View style={[!isMobile && { flex: 1, alignItems: 'center' }]}>
              <View style={[styles.stockBadgeLarge, { backgroundColor: productStatus.bgColor }]}>
                <Text style={[styles.stockTextLarge, { color: productStatus.color }]}>{stockQty} {product.unit}</Text>
              </View>
              {hasVariants && <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{pVariants.length} variante{pVariants.length > 1 ? 's' : ''}</Text>}
            </View>
            {!isMobile && <View style={{ flex: 1, alignItems: 'center' }}><Text style={[styles.productSku, { color: productStatus.label !== 'OK' ? colors.danger : colors.textTertiary, fontWeight: productStatus.label !== 'OK' ? '600' : '400' }]}>{product.lowStockThreshold}</Text></View>}
            {!isMobile && <View style={{ flex: 0.8, alignItems: 'center' }}><View style={[styles.statusBadge, { backgroundColor: productStatus.color }]}><Text style={[styles.statusBadgeText, { color: '#FFF' }]}>{productStatus.label}</Text></View></View>}
            <View style={[!isMobile && { flex: 0.6, alignItems: 'center' }]}>
              <TouchableOpacity onPress={() => openAdjust(product.id)} style={[styles.adjustBtn, { borderColor: colors.border }]}>
                <ArrowUpDownIcon size={14} color={colors.primary} />
                {!isMobile && <Text style={[styles.adjustBtnText, { color: colors.primary }]}>Ajuster</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
        {hasVariants && isExpanded && renderVariants(product, pVariants, idx, listLength)}
      </View>
    );
  };

  const renderVariants = (product: any, pVariants: any[], productIdx: number, listLength: number) => (
    <View style={{ borderBottomWidth: productIdx < listLength - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
      {pVariants.map((variant, vi) => {
        const variantStatus = getVariantStatus(variant.stockQuantity, variant.minStock, product.lowStockThreshold);
        const attrLabel = Object.keys(variant.attributes).length > 0
          ? Object.entries(variant.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ')
          : 'Variante par défaut';
        return (
          <View key={variant.id} style={[styles.variantSubRow, { backgroundColor: colors.surfaceHover + '40', borderTopWidth: vi === 0 ? 1 : 0, borderTopColor: colors.borderLight }, vi < pVariants.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight + '80' }]}>
            <View style={styles.productRowMain}>
              <View style={[styles.productInfo, !isMobile && { flex: 2 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 20 }}>
                  <View style={[styles.variantDot, { backgroundColor: variantStatus.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.variantAttrText, { color: colors.text }]}>{attrLabel}</Text>
                    {variant.sku ? <Text style={[styles.productSku, { color: colors.textTertiary, fontSize: 10 }]}>{variant.sku}</Text> : null}
                  </View>
                </View>
              </View>
              <View style={[!isMobile && { flex: 1, alignItems: 'center' }]}>
                <View style={[styles.variantStockBadge, { backgroundColor: variantStatus.bgColor }]}>
                  <Text style={[styles.variantStockText, { color: variantStatus.color }]}>{variant.stockQuantity} {product.unit}</Text>
                </View>
              </View>
              {!isMobile && <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 11, color: colors.textTertiary }}>{variant.minStock || product.lowStockThreshold}</Text></View>}
              {!isMobile && <View style={{ flex: 0.8, alignItems: 'center' }}><View style={[styles.variantStatusBadge, { backgroundColor: variantStatus.bgColor }]}><Text style={[styles.variantStatusText, { color: variantStatus.color }]}>{variantStatus.label}</Text></View></View>}
              {!isMobile && <View style={{ flex: 0.6 }} />}
              {isMobile && <View style={[styles.variantStatusBadge, { backgroundColor: variantStatus.bgColor }]}><Text style={[styles.variantStatusText, { color: variantStatus.color }]}>{variantStatus.label}</Text></View>}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderTransformedVariants = (product: any, realVariants: any[]) => (
    <View style={{ borderBottomColor: colors.borderLight }}>
      {realVariants.map((variant, vi) => {
        const variantRecipe = getRecipeForProduct(product.id, variant.id);
        const variantHasRecipe = variantRecipe && variantRecipe.items.length > 0;
        let variantTheoreticalStock: number | null = null;
        if (variantHasRecipe) {
          let minProducible = Infinity;
          for (const rItem of variantRecipe.items) {
            const ingredientProduct = allProducts.find((p) => p.id === rItem.ingredientProductId);
            if (!ingredientProduct) { minProducible = 0; break; }
            let availableStock = 0;
            if (rItem.ingredientVariantId) {
              const vr = allVariants.find((v) => v.id === rItem.ingredientVariantId);
              availableStock = vr?.stockQuantity ?? 0;
            } else {
              const pvs = getVariantsForProduct(rItem.ingredientProductId);
              if (pvs.length > 0) availableStock = pvs.reduce((s, v) => s + v.stockQuantity, 0);
              else availableStock = getProductStock(rItem.ingredientProductId);
            }
            if (rItem.quantity > 0) minProducible = Math.min(minProducible, Math.floor(availableStock / rItem.quantity));
          }
          variantTheoreticalStock = minProducible === Infinity ? null : minProducible;
        }
        const vStockLabel = variantTheoreticalStock !== null ? `${variantTheoreticalStock}` : '—';
        const vStatusColor = variantTheoreticalStock === null ? colors.textTertiary : variantTheoreticalStock <= 0 ? colors.danger : variantTheoreticalStock <= product.lowStockThreshold ? colors.warning : colors.success;
        const vStatusBg = variantTheoreticalStock === null ? colors.surfaceHover : variantTheoreticalStock <= 0 ? colors.dangerLight : variantTheoreticalStock <= product.lowStockThreshold ? colors.warningLight : colors.successLight;
        const vStatusLabel = !variantHasRecipe ? 'Sans recette' : variantTheoreticalStock !== null && variantTheoreticalStock <= 0 ? 'Rupture' : variantTheoreticalStock !== null && variantTheoreticalStock <= product.lowStockThreshold ? 'Bas' : variantHasRecipe ? 'OK' : 'Sans recette';
        const attrLabel = Object.entries(variant.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ');
        return (
          <View key={variant.id} style={[styles.variantSubRow, { backgroundColor: colors.surfaceHover + '40', borderTopWidth: vi === 0 ? 1 : 0, borderTopColor: colors.borderLight }, vi < realVariants.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight + '80' }]}>
            <View style={styles.productRowMain}>
              <View style={[styles.productInfo, !isMobile && { flex: 2 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 20 }}>
                  <View style={[styles.variantDot, { backgroundColor: vStatusColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.variantAttrText, { color: colors.text }]}>{attrLabel}</Text>
                    {variant.sku ? <Text style={[styles.productSku, { color: colors.textTertiary, fontSize: 10 }]}>{variant.sku}</Text> : null}
                  </View>
                </View>
              </View>
              <View style={[!isMobile && { flex: 1, alignItems: 'center' }]}>
                <View style={[styles.variantStockBadge, { backgroundColor: vStatusBg }]}>
                  <Text style={[styles.variantStockText, { color: vStatusColor }]}>{vStockLabel} {variantTheoreticalStock !== null ? product.unit : ''}</Text>
                </View>
              </View>
              {!isMobile && <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 11, color: variantHasRecipe ? colors.success : colors.textTertiary, fontWeight: '500' }}>{variantHasRecipe ? 'Définie' : 'Non définie'}</Text></View>}
              {!isMobile && <View style={{ flex: 0.8, alignItems: 'center' }}><View style={[styles.variantStatusBadge, { backgroundColor: vStatusBg }]}><Text style={[styles.variantStatusText, { color: vStatusColor }]}>{vStatusLabel}</Text></View></View>}
              {isMobile && <View style={[styles.variantStatusBadge, { backgroundColor: vStatusBg }]}><Text style={[styles.variantStatusText, { color: vStatusColor }]}>{vStatusLabel}</Text></View>}
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <>
      {/* KPIs */}
      <View style={[styles.summaryRow, isMobile && { flexDirection: 'column' }]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Package size={18} color={colors.primary} />
          <View style={styles.summaryInfo}><Text style={[styles.summaryValue, { color: colors.text }]}>{physicalProducts.length}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Produits physiques</Text></View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <AlertTriangle size={18} color={colors.warning} />
          <View style={styles.summaryInfo}><Text style={[styles.summaryValue, { color: colors.warning }]}>{summaryStats.lowStockCount}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Stock bas</Text></View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <AlertTriangle size={18} color={colors.danger} />
          <View style={styles.summaryInfo}><Text style={[styles.summaryValue, { color: colors.danger }]}>{summaryStats.outOfStockCount}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Rupture</Text></View>
        </View>
      </View>

      {/* Filtres & tri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f.value} style={[styles.filterChip, { backgroundColor: filter === f.value ? colors.primary : colors.card, borderColor: filter === f.value ? colors.primary : colors.cardBorder }]} onPress={() => setFilter(f.value)}>
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

      {/* Section matières premières / consommables */}
      {countableProducts.length > 0 && <Text style={[styles.sectionTitle, { color: colors.text }]}>Matières premières / Consommables</Text>}
      {filtered.length > 0 ? (
        <>
          {isMobile && (
            <View style={[styles.inventoryHeaderRowMobile, { backgroundColor: '#F9FAFB', borderColor: colors.border }]}>
              <Text style={[styles.inventoryColHeader, { flex: 1 }]}>PRODUIT</Text>
              <Text style={[styles.inventoryColHeader, { textAlign: 'right' }]}>STOCK / STATUT</Text>
            </View>
          )}
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {!isMobile && (
              <View style={[styles.inventoryHeaderRow, { backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.inventoryColHeader, { flex: 2 }]}>PRODUIT</Text>
                <Text style={[styles.inventoryColHeader, { flex: 1, textAlign: 'center' }]}>STOCK ACTUEL</Text>
                <Text style={[styles.inventoryColHeader, { flex: 1, textAlign: 'center' }]}>SEUIL</Text>
                <Text style={[styles.inventoryColHeader, { flex: 0.8, textAlign: 'center' }]}>STATUT</Text>
                <Text style={[styles.inventoryColHeader, { flex: 0.6, textAlign: 'center' }]}>ACTIONS</Text>
              </View>
            )}
            {filtered.map((product, i) => renderProductRow(product, i, filtered.length))}
          </View>
        </>
      ) : countableProducts.length > 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><Package size={32} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{filter !== 'all' ? 'Aucun produit dans ce filtre' : 'Aucun produit en stock'}</Text>
        </View>
      ) : null}

      {/* Section produits transformés */}
      {transformedProducts.length > 0 && <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Produits transformés — Stock théorique</Text>}
      {filteredTransformed.length > 0 && (
        <>
          {isMobile && (
            <View style={[styles.inventoryHeaderRowMobile, { backgroundColor: '#F9FAFB', borderColor: colors.border }]}>
              <Text style={[styles.inventoryColHeader, { flex: 1 }]}>PRODUIT</Text>
              <Text style={[styles.inventoryColHeader, { textAlign: 'right' }]}>STOCK THÉORIQUE</Text>
            </View>
          )}
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {!isMobile && (
              <View style={[styles.inventoryHeaderRow, { backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.inventoryColHeader, { flex: 2 }]}>PRODUIT</Text>
                <Text style={[styles.inventoryColHeader, { flex: 1, textAlign: 'center' }]}>STOCK THÉORIQUE</Text>
                <Text style={[styles.inventoryColHeader, { flex: 1, textAlign: 'center' }]}>RECETTE</Text>
                <Text style={[styles.inventoryColHeader, { flex: 0.8, textAlign: 'center' }]}>STATUT</Text>
              </View>
            )}
            {filteredTransformed.map((product, i) => renderProductRow(product, i, filteredTransformed.length, true))}
          </View>
        </>
      )}

      {/* État vide global */}
      {filtered.length === 0 && filteredTransformed.length === 0 && physicalProducts.length === 0 && (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><Package size={32} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun produit en stock</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Ajoutez des produits dans le catalogue pour gérer votre inventaire</Text>
        </View>
      )}

      {/* Modal ajustement */}
      <FormModal visible={adjustModal !== null} onClose={() => setAdjustModal(null)} title="Ajustement de stock" subtitle="Correction manuelle d'inventaire" onSubmit={handleAdjust} submitLabel="Appliquer">
        {adjustError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{adjustError}</Text></View> : null}
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
                    <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceHover, borderRadius: 8, padding: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>{attrLabel}</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>Stock actuel : {v.stockQuantity}</Text>
                      </View>
                      <View style={{ width: 90 }}>
                        <TextInput
                          style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: colors.text, textAlign: 'center' }}
                          value={adjustVariantQtys[v.id] || ''}
                          onChangeText={(val) => setAdjustVariantQtys((prev) => ({ ...prev, [v.id]: val }))}
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