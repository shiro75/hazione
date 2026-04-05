/**
 * @fileoverview Line items editor for invoices, quotes, and orders.
 * Allows searching products, adding/removing lines, editing quantities and prices.
 * Supports product variant expansion and selection.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, Plus, X, Minus, ChevronDown, ChevronRight, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/utils/format';
import type { VATRate, ProductType, Product, ProductVariant } from '@/types';

export interface LineItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: VATRate;
  discount?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  variantId?: string;
  variantInfo?: Record<string, string>;
}

interface LineItemsEditorProps {
  items: LineItem[];
  onItemsChange: (items: LineItem[]) => void;
  idPrefix?: string;
  showDiscount?: boolean;
  currency?: string;
  allowedProductTypes?: ProductType[];
  defaultDiscount?: number;
}

function generateItemId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function recalcLine(item: LineItem): LineItem {
  const disc = item.discount || 0;
  const baseHT = item.unitPrice * item.quantity;
  const totalHT = baseHT * (1 - disc / 100);
  const totalTVA = totalHT * (item.vatRate / 100);
  return { ...item, totalHT, totalTVA, totalTTC: totalHT + totalTVA };
}

export default React.memo(function LineItemsEditor({ items, onItemsChange, idPrefix = 'li', showDiscount = false, currency, allowedProductTypes, defaultDiscount = 0 }: LineItemsEditorProps) {
  const { colors } = useTheme();
  const { activeProducts, company, variants } = useData();
  const cur = currency || company.currency || 'EUR';
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
  const [lineSearches, setLineSearches] = useState<Record<number, string>>({});
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const getProductVariants = useCallback((productId: string): ProductVariant[] => {
    if (!variants) return [];
    return variants.filter((v: ProductVariant) => v.productId === productId && v.isActive);
  }, [variants]);

  const getFilteredProducts = useCallback((idx: number) => {
    let base = activeProducts.filter((p) => p.isAvailableForSale !== false);
    if (allowedProductTypes && allowedProductTypes.length > 0) {
      base = base.filter((p) => allowedProductTypes.includes(p.type));
    }
    const q = (lineSearches[idx] || '').toLowerCase();
    if (!q) return base.slice(0, 30);
    return base.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [activeProducts, lineSearches, allowedProductTypes]);

  const addEmptyLine = useCallback(() => {
    const newItem: LineItem = {
      id: generateItemId(idPrefix),
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      vatRate: 20 as VATRate,
      discount: defaultDiscount,
      totalHT: 0,
      totalTVA: 0,
      totalTTC: 0,
    };
    onItemsChange([...items, newItem]);
    setOpenDropdownIdx(items.length);
  }, [items, onItemsChange, idPrefix, defaultDiscount]);

  const selectProduct = useCallback((idx: number, productId: string, variant?: ProductVariant) => {
    const product = activeProducts.find((p) => p.id === productId);
    if (!product) return;
    const price = variant ? variant.salePrice : product.salePrice;
    const variantAttrs = variant?.attributes || {};
    const variantLabel = variant
      ? Object.values(variantAttrs).join(' / ')
      : '';
    onItemsChange(items.map((item, i) => {
      if (i !== idx) return item;
      const disc = item.discount || defaultDiscount;
      return recalcLine({
        ...item,
        productId: product.id,
        productName: variant ? `${product.name} — ${variantLabel}` : product.name,
        unitPrice: price,
        vatRate: product.vatRate,
        discount: disc,
        variantId: variant?.id,
        variantInfo: variant ? variantAttrs : undefined,
      });
    }));
    setOpenDropdownIdx(null);
    setExpandedProductId(null);
    setLineSearches((prev) => ({ ...prev, [idx]: '' }));
  }, [activeProducts, items, onItemsChange, defaultDiscount]);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    onItemsChange(items.map((i) => {
      if (i.id === itemId) {
        return recalcLine({ ...i, quantity: Math.max(1, i.quantity + delta) });
      }
      return i;
    }));
  }, [items, onItemsChange]);

  const updateDiscount = useCallback((itemId: string, discountStr: string) => {
    const disc = parseFloat(discountStr) || 0;
    onItemsChange(items.map((i) => {
      if (i.id === itemId) {
        return recalcLine({ ...i, discount: Math.min(100, Math.max(0, disc)) });
      }
      return i;
    }));
  }, [items, onItemsChange]);

  const removeItem = useCallback((idx: number) => {
    onItemsChange(items.filter((_, i) => i !== idx));
    if (openDropdownIdx === idx) setOpenDropdownIdx(null);
  }, [items, onItemsChange, openDropdownIdx]);

  const renderProductDropdownItem = useCallback((p: Product, idx: number, isSelected: boolean) => {
    const productVariants = getProductVariants(p.id);
    const hasVariants = productVariants.length > 0;
    const isExpanded = expandedProductId === p.id;

    return (
      <View key={p.id}>
        <TouchableOpacity
          style={[
            lineStyles.dropdownItem,
            { borderBottomColor: colors.borderLight },
            isSelected && { backgroundColor: colors.primaryLight },
          ]}
          onPress={() => {
            if (hasVariants) {
              setExpandedProductId(isExpanded ? null : p.id);
            } else {
              selectProduct(idx, p.id);
            }
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
              {hasVariants ? (
                isExpanded ? <ChevronDown size={12} color={colors.textTertiary} /> : <ChevronRight size={12} color={colors.textTertiary} />
              ) : null}
              <Text style={[lineStyles.dropdownItemName, { color: colors.text }]}>{p.name}</Text>
              {hasVariants ? (
                <View style={[lineStyles.variantBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[lineStyles.variantBadgeText, { color: colors.primary }]}>{productVariants.length} variante{productVariants.length > 1 ? 's' : ''}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[lineStyles.dropdownItemSku, { color: colors.textTertiary }]}>
              {p.sku || 'Sans réf.'} · {formatCurrency(p.salePrice * (1 + p.vatRate / 100), cur)} TTC
            </Text>
          </View>
          {isSelected && !hasVariants && <Check size={14} color={colors.primary} />}
        </TouchableOpacity>
        {hasVariants && isExpanded ? (
          <View style={{ backgroundColor: colors.surfaceHover || colors.inputBg }}>
            {productVariants.map((v) => {
              const attrLabel = Object.values(v.attributes).join(' / ');
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[lineStyles.variantItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => selectProduct(idx, p.id, v)}
                >
                  <View style={{ flex: 1, paddingLeft: 24 }}>
                    <Text style={[lineStyles.dropdownItemName, { color: colors.text }]}>{attrLabel}</Text>
                    <Text style={[lineStyles.dropdownItemSku, { color: colors.textTertiary }]}>
                      {v.sku || 'Sans réf.'} · {formatCurrency(v.salePrice * (1 + (activeProducts.find(pp => pp.id === v.productId)?.vatRate || 20) / 100), cur)} TTC · Stock: {v.stockQuantity}
                    </Text>
                  </View>
                  <Check size={14} color="transparent" />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }, [getProductVariants, expandedProductId, colors, cur, selectProduct, activeProducts]);

  return (
    <View style={lineStyles.container}>
      <View style={lineStyles.headerRow}>
        <Text style={[lineStyles.headerLabel, { color: colors.textSecondary }]}>Lignes</Text>
        <TouchableOpacity
          style={[lineStyles.addLineBtn, { backgroundColor: colors.primaryLight }]}
          onPress={addEmptyLine}
          activeOpacity={0.7}
        >
          <Plus size={14} color={colors.primary} />
          <Text style={[lineStyles.addLineBtnText, { color: colors.primary }]}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {items.map((item, idx) => {
        const isDropdownOpen = openDropdownIdx === idx;
        const filteredProducts = getFilteredProducts(idx);
        return (
          <View key={item.id} style={[lineStyles.lineCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <View style={lineStyles.lineTop}>
              <View style={{ flex: 1 }}>
                <Text style={[lineStyles.lineLabel, { color: colors.textTertiary }]}>Produit</Text>
                <TouchableOpacity
                  style={[
                    lineStyles.productSelector,
                    {
                      backgroundColor: colors.card,
                      borderColor: item.productId ? colors.primary : colors.inputBorder,
                    },
                  ]}
                  onPress={() => { setOpenDropdownIdx(isDropdownOpen ? null : idx); setExpandedProductId(null); }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[lineStyles.productSelectorText, { color: item.productId ? colors.text : colors.textTertiary }]}
                    numberOfLines={1}
                  >
                    {item.productName || 'Sélectionner un produit...'}
                  </Text>
                  <ChevronDown size={14} color={colors.textTertiary} />
                </TouchableOpacity>
                {isDropdownOpen && (
                  <View style={[lineStyles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[lineStyles.dropdownSearchRow, { borderBottomColor: colors.borderLight }]}>
                      <Search size={14} color={colors.textTertiary} />
                      <TextInput
                        style={[lineStyles.dropdownSearchInput, { color: colors.text }]}
                        placeholder="Rechercher..."
                        placeholderTextColor={colors.textTertiary}
                        value={lineSearches[idx] || ''}
                        onChangeText={(v) => setLineSearches((prev) => ({ ...prev, [idx]: v }))}
                        autoFocus
                      />
                      {(lineSearches[idx] || '').length > 0 && (
                        <TouchableOpacity onPress={() => setLineSearches((prev) => ({ ...prev, [idx]: '' }))} hitSlop={8}>
                          <X size={12} color={colors.textTertiary} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <ScrollView style={lineStyles.dropdownList} nestedScrollEnabled>
                      {filteredProducts.map((p) => renderProductDropdownItem(p, idx, item.productId === p.id))}
                      {filteredProducts.length === 0 && (
                        <Text style={[lineStyles.dropdownEmpty, { color: colors.textTertiary }]}>Aucun produit trouvé</Text>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => removeItem(idx)} style={{ padding: 4 }}>
                <X size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>

            {item.productId ? (
              <>
                <View style={lineStyles.lineBottom}>
                  <View style={lineStyles.qtyControls}>
                    <TouchableOpacity
                      style={[lineStyles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}
                      onPress={() => updateQuantity(item.id, -1)}
                    >
                      <Minus size={12} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[lineStyles.qtyText, { color: colors.text }]}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[lineStyles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}
                      onPress={() => updateQuantity(item.id, 1)}
                    >
                      <Plus size={12} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={lineStyles.pricingInfo}>
                    <Text style={[lineStyles.pricingDetail, { color: colors.textTertiary }]}>
                      {formatCurrency(item.unitPrice, cur)} × {item.quantity}{item.discount ? ` -${item.discount}%` : ''} · TVA {item.vatRate}%
                    </Text>
                    <Text style={[lineStyles.pricingTotal, { color: colors.text }]}>{formatCurrency(item.totalTTC, cur)}</Text>
                  </View>
                </View>
                {showDiscount && (
                  <View style={lineStyles.discountRow}>
                    <Text style={[lineStyles.discountLabel, { color: colors.textTertiary }]}>Remise %</Text>
                    <TextInput
                      style={[lineStyles.discountInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.inputBorder }]}
                      value={item.discount ? String(item.discount) : ''}
                      onChangeText={(v) => updateDiscount(item.id, v)}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}
              </>
            ) : null}
          </View>
        );
      })}

      {items.length === 0 && (
        <TouchableOpacity
          style={[lineStyles.emptyAdd, { borderColor: colors.border }]}
          onPress={addEmptyLine}
          activeOpacity={0.7}
        >
          <Plus size={16} color={colors.textTertiary} />
          <Text style={[lineStyles.emptyAddText, { color: colors.textTertiary }]}>Ajouter un produit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const lineStyles = StyleSheet.create({
  container: { gap: 8 },
  headerRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 4,
  },
  headerLabel: { fontSize: 13, fontWeight: '500' as const },
  addLineBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  addLineBtnText: { fontSize: 13, fontWeight: '600' as const },
  lineCard: {
    borderWidth: 1, borderRadius: 10, padding: 12, gap: 10,
  },
  lineTop: {
    flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8,
  },
  lineLabel: { fontSize: 11, fontWeight: '500' as const, marginBottom: 4 },
  productSelector: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  productSelectorText: { fontSize: 14, flex: 1 },
  dropdown: {
    borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' as const,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
    maxHeight: 280,
  },
  dropdownSearchRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1,
  },
  dropdownSearchInput: { flex: 1, fontSize: 13, outlineStyle: 'none' as never },
  dropdownList: { maxHeight: 230 },
  dropdownItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1,
  },
  dropdownItemName: { fontSize: 13, fontWeight: '500' as const },
  dropdownItemSku: { fontSize: 11, marginTop: 1 },
  dropdownEmpty: { padding: 14, textAlign: 'center' as const, fontSize: 13 },
  variantBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4,
  },
  variantBadgeText: { fontSize: 10, fontWeight: '600' as const },
  variantItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1,
  },
  lineBottom: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  qtyControls: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 1,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  qtyText: { fontSize: 14, fontWeight: '600' as const, minWidth: 20, textAlign: 'center' as const },
  pricingInfo: { alignItems: 'flex-end' as const },
  pricingDetail: { fontSize: 11 },
  pricingTotal: { fontSize: 14, fontWeight: '700' as const },
  discountRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  discountLabel: { fontSize: 11, fontWeight: '500' as const },
  discountInput: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 13, width: 60, textAlign: 'center' as const,
  },
  emptyAdd: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: 8,
    borderWidth: 1, borderStyle: 'dashed' as const, borderRadius: 8,
    paddingVertical: 16,
  },
  emptyAddText: { fontSize: 13, fontWeight: '500' as const },
});
