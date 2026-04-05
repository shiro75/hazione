/**
 * components/sales/ProductGrid.tsx
 *
 * Grille / liste de produits pour le POS.
 * Supporte 3 modes d'affichage : grid, compact, list.
 * Gère les variantes expandées inline, les filtres catégorie,
 * la recherche, le scan code-barres et la saisie manuelle.
 */

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
} from 'react-native';
import {
  Search, X, LayoutGrid, AlignJustify, List, PenLine, ScanBarcode,
  Package, Tag, Layers, Image as ImageIcon,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/utils/format';
import { isStockableType } from '@/constants/productTypes';
import s from '@/components/sales/salesStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryData {
  name: string;
  count: number;
}

interface ProductGridProps {
  // Produits
  groupedFilteredProducts: { category: string; items: any[] }[];
  filteredProducts: any[];
  salesProducts: any[];
  // Filtres
  productSearch: string;
  setProductSearch: (v: string) => void;
  selectedCategoryFilter: string | null;
  setSelectedCategoryFilter: (v: string | null) => void;
  categoryData: CategoryData[];
  // Vue
  posViewMode: 'grid' | 'list' | 'compact';
  setPosViewMode: (v: 'grid' | 'list' | 'compact') => void;
  isMobile: boolean;
  // Panier
  cart: any[];
  addToCart: (productId: string, variant?: any) => void;
  handleProductTap: (productId: string) => void;
  expandedProductId: string | null;
  // Variantes
  getVariantsForProduct: (id: string) => any[];
  getProductStock: (id: string) => number;
  productAttributes: any[];
  // Barcode + saisie manuelle
  barcodeInput: string;
  setBarcodeInput: (v: string) => void;
  handleBarcodeSubmit: () => void;
  onOpenManualEntry: () => void;
  // Currency
  currency: string;
  // Couleur catégorie
  getCategoryColor: (name: string) => string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ProductGrid({
  groupedFilteredProducts, filteredProducts, salesProducts,
  productSearch, setProductSearch, selectedCategoryFilter, setSelectedCategoryFilter,
  categoryData, posViewMode, setPosViewMode, isMobile,
  cart, addToCart, handleProductTap, expandedProductId,
  getVariantsForProduct, getProductStock, productAttributes,
  barcodeInput, setBarcodeInput, handleBarcodeSubmit, onOpenManualEntry,
  currency, getCategoryColor,
}: ProductGridProps) {
  const { colors } = useTheme();

  return (
    <View style={s.productsSection}>
      {/* ── Barre recherche + toggle vue ── */}
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
          {(['grid', 'compact', 'list'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[s.viewToggleBtn, posViewMode === mode && { backgroundColor: colors.primary }]}
              onPress={() => setPosViewMode(mode)}
              activeOpacity={0.7}
            >
              {mode === 'grid' && <LayoutGrid size={13} color={posViewMode === mode ? '#FFF' : colors.textSecondary} />}
              {mode === 'compact' && <AlignJustify size={13} color={posViewMode === mode ? '#FFF' : colors.textSecondary} />}
              {mode === 'list' && <List size={13} color={posViewMode === mode ? '#FFF' : colors.textSecondary} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Filtres catégories ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexShrink: 0, flexGrow: 0 }}
        contentContainerStyle={s.categoryTabs}
      >
        <TouchableOpacity
          style={[s.categoryTab, {
            backgroundColor: !selectedCategoryFilter ? colors.primary : colors.card,
            borderColor: !selectedCategoryFilter ? colors.primary : colors.cardBorder,
          }]}
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
              style={[s.categoryTab, {
                backgroundColor: isActive ? catColor : colors.card,
                borderColor: isActive ? catColor : colors.cardBorder,
              }]}
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

      {/* ── Saisie manuelle + Code-barres ── */}
      <View style={s.quickActions}>
        <TouchableOpacity
          style={[s.quickBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={onOpenManualEntry}
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
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>OK</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Produits par groupe catégorie ── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.productGridContent, { flexGrow: 1, justifyContent: 'flex-start' }]}
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
                  <ListView
                    items={group.items} cart={cart}
                    getVariantsForProduct={getVariantsForProduct} getProductStock={getProductStock}
                    handleProductTap={handleProductTap} currency={currency} colors={colors}
                  />
                ) : (
                  <GridView
                    items={group.items} cart={cart} isMobile={isMobile}
                    posViewMode={posViewMode} expandedProductId={expandedProductId}
                    getVariantsForProduct={getVariantsForProduct} getProductStock={getProductStock}
                    productAttributes={productAttributes}
                    handleProductTap={handleProductTap} addToCart={addToCart}
                    currency={currency} colors={colors}
                  />
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sous-composant ListView ──────────────────────────────────────────────────

function ListView({ items, cart, getVariantsForProduct, getProductStock, handleProductTap, currency, colors }: any) {
  return (
    <View style={[s.listContainer, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
      {items.map((product: any) => {
        const cartItems = cart.filter((c: any) => c.productId === product.id);
        const totalInCart = cartItems.reduce((acc: number, c: any) => acc + c.quantity, 0);
        const productVariantsList = getVariantsForProduct(product.id);
        const productStock = productVariantsList.length > 0
          ? productVariantsList.reduce((sum: number, v: any) => sum + v.stockQuantity, 0)
          : getProductStock(product.id);
        const isLowStock = isStockableType(product.type) && productStock <= product.lowStockThreshold && productStock > 0;
        const isOutOfStock = isStockableType(product.type) && productStock <= 0;
        const hasRealVariants = productVariantsList.length > 0 && Object.keys(productVariantsList[0].attributes).length > 0;

        return (
          <TouchableOpacity
            key={product.id}
            style={[s.listRow, {
              backgroundColor: totalInCart > 0 ? `${colors.primary}08` : colors.card,
              borderBottomColor: colors.borderLight,
              opacity: isOutOfStock ? 0.45 : 1,
            }]}
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
              <Text style={[s.listName, { color: isOutOfStock ? colors.textTertiary : colors.text }]} numberOfLines={1}>
                {product.name}
              </Text>
              {hasRealVariants ? (
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                  {productVariantsList.length} variante{productVariantsList.length > 1 ? 's' : ''}
                </Text>
              ) : null}
            </View>
            {isStockableType(product.type) && (
              <Text style={[s.listStock, { color: isOutOfStock ? colors.danger : isLowStock ? colors.warning : colors.textTertiary }]}>
                {isOutOfStock ? 'Rupture' : productStock}
              </Text>
            )}
            <Text style={[s.listPrice, { color: isOutOfStock ? colors.textTertiary : colors.primary }]}>
              {formatCurrency(product.salePrice * (1 + product.vatRate / 100), currency)}
            </Text>
            {totalInCart > 0 && (
              <View style={[s.tileCartBadge, { position: 'relative', top: 0, right: 0 }]}>
                <Text style={s.tileCartBadgeText}>{totalInCart}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Sous-composant GridView ──────────────────────────────────────────────────

function GridView({
  items, cart, isMobile, posViewMode, expandedProductId,
  getVariantsForProduct, getProductStock, productAttributes,
  handleProductTap, addToCart, currency, colors,
}: any) {
  const isCompact = posViewMode === 'compact';

  return (
    <View style={[s.gridWrap, { alignContent: 'flex-start', marginBottom: 8 }]}>
      {items.map((product: any) => {
        const cartItems = cart.filter((c: any) => c.productId === product.id);
        const totalInCart = cartItems.reduce((acc: number, c: any) => acc + c.quantity, 0);
        const productVariantsList = getVariantsForProduct(product.id);
        const productStock = productVariantsList.length > 0
          ? productVariantsList.reduce((sum: number, v: any) => sum + v.stockQuantity, 0)
          : getProductStock(product.id);
        const isLowStock = isStockableType(product.type) && productStock <= product.lowStockThreshold && productStock > 0;
        const isOutOfStock = isStockableType(product.type) && productStock <= 0;
        const variantCount = productVariantsList.length;
        const tileExpanded = expandedProductId === product.id;
        const hasRealVariants = productVariantsList.length > 0 && Object.keys(productVariantsList[0].attributes).length > 0;

        // Calcul dynamique de la largeur quand les variantes sont expandées
        const tileWidth = tileExpanded && hasRealVariants
          ? (() => {
              const allVariants = getVariantsForProduct(product.id);
              const maxLength = Math.max(...allVariants.map((v: any) =>
                Object.entries(v.attributes).reduce((sum: number, [key, value]: any, idx: number, arr: any[]) => {
                  let length = sum + key.length + 2 + value.length;
                  if (idx < arr.length - 1) length += 3;
                  return length;
                }, 0),
              ));
              return Math.max(180, maxLength * 7 + 80);
            })()
          : isCompact
          ? (isMobile ? '47%' as any : 120)
          : (isMobile ? '47%' as any : 160);

        return (
          <View
            key={product.id}
            style={[
              s.productTile,
              {
                backgroundColor: colors.card,
                borderColor: tileExpanded ? colors.primary : totalInCart > 0 ? colors.primary : colors.cardBorder,
                borderWidth: (tileExpanded || totalInCart > 0) ? 2 : 1,
                width: tileWidth,
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
              {isOutOfStock && <View style={s.tileRuptureBadge}><Text style={s.tileRuptureBadgeText}>RUPTURE</Text></View>}
              {hasRealVariants && !isOutOfStock && !tileExpanded && (
                <View style={[s.tileVariantBadge, { backgroundColor: `${colors.primary}22` }]}>
                  <Layers size={9} color={colors.primary} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: colors.primary }}>{variantCount}</Text>
                </View>
              )}
              <View style={s.tileBody}>
                <Text style={[s.tileName, { color: isOutOfStock ? colors.textTertiary : colors.text }]} numberOfLines={2}>
                  {product.name}
                </Text>
                <View style={s.tileFooter}>
                  <Text style={[s.tilePrice, { color: isOutOfStock ? colors.textTertiary : colors.primary }]}>
                    {formatCurrency(product.salePrice * (1 + product.vatRate / 100), currency)}
                  </Text>
                  {isStockableType(product.type) && (
                    <Text style={[s.tileStockSmall, { color: isOutOfStock ? colors.danger : isLowStock ? colors.warning : colors.textTertiary }]}>
                      {isOutOfStock ? '0' : productStock}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {/* Variantes expandées inline */}
            {tileExpanded && hasRealVariants && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                {productVariantsList.map((v: any) => {
                  const sortedAttrs = Object.entries(v.attributes).sort((a: any, b: any) => {
                    const idxA = productAttributes.findIndex((pa: any) => pa.name === a[0]);
                    const idxB = productAttributes.findIndex((pa: any) => pa.name === b[0]);
                    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                  });
                  const vLabel = sortedAttrs.map(([k, val]) => `${k}: ${val}`).join(' / ');
                  const inCart = cart.find((c: any) => c.variantId === v.id);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.expandedVariantRow, {
                        backgroundColor: inCart ? `${colors.primary}08` : 'transparent',
                        borderBottomColor: colors.borderLight,
                      }]}
                      onPress={() => addToCart(product.id, v)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {vLabel}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                        {formatCurrency(v.salePrice * (1 + product.vatRate / 100), currency)}
                      </Text>
                      {inCart ? (
                        <View style={[s.tileCartBadge, { position: 'relative', top: 0, right: 0, width: 18, height: 18, borderRadius: 9 }]}>
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
  );
}