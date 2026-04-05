/**
 * components/products/ProductDetailModal.tsx
 * Fiche produit en lecture seule.
 * Affiche les infos, les prix reconvertis en TTC, les variantes et les recettes.
 */

import React, { useCallback } from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity,
  ScrollView, Image, useWindowDimensions,
} from 'react-native';
import {
  ChevronLeft, Pencil, Archive, Trash2, Plus, Layers,
  Briefcase, Box, Package, ChefHat,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { formatCurrency } from '@/utils/format';
import { htToTtc, calcMargin } from '@/utils/price';
import { detailStyles, styles } from '@/components/stock/products/productsStyles';
import { getProductTypeConfig, isStockableType } from '@/constants/productTypes';
import type { Product, ProductVariant } from '@/types';

interface ProductDetailModalProps {
  product: Product;
  variants: ProductVariant[];
  currency: string;
  onClose: () => void;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  onAddVariant: () => void;
  onEditVariant: (v: ProductVariant) => void;
  onDeleteVariant: (id: string) => void;
  onOpenRecipeEditor: (productId: string, name: string, variantId?: string, label?: string) => void;
  getProductTotalStock: (id: string) => number;
  getRecipeForProduct: (productId: string, variantId?: string) => any;
  getOrderedVariants: (variants: ProductVariant[]) => ProductVariant[];
}

export default function ProductDetailModal({
  product, variants, currency,
  onClose, onEdit, onArchive, onUnarchive, onDelete,
  onAddVariant, onEditVariant, onDeleteVariant, onOpenRecipeEditor,
  getProductTotalStock, getRecipeForProduct, getOrderedVariants,
}: ProductDetailModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const totalStock = getProductTotalStock(product.id);
  const userVariants = variants.filter((v) => Object.keys(v.attributes).length > 0);
  const isLowStock =
    isStockableType(product.type) &&
    variants.some((v) => v.stockQuantity <= (v.minStock || product.lowStockThreshold));
  const margin = calcMargin(product.purchasePrice, product.salePrice);
  const typeConfig = getProductTypeConfig(product.type);
  const isTransformed = product.type === 'produit_transforme' || product.type === 'produit_fini';

  const renderInfoRow = useCallback(
    (label: string, value: string | undefined, valueColor?: string) => {
      if (!value) return null;
      return (
        <View style={detailStyles.infoRow}>
          <Text style={[detailStyles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
          <Text style={[detailStyles.infoValue, { color: valueColor || colors.text }]} numberOfLines={2}>
            {value}
          </Text>
        </View>
      );
    },
    [colors],
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={detailStyles.overlay} onPress={onClose}>
        <Pressable
          style={[detailStyles.modal, { backgroundColor: colors.card, width: isMobile ? width - 24 : 560 }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={onClose} hitSlop={8}
              style={[detailStyles.backBtn, { backgroundColor: colors.surfaceHover }]}
            >
              <ChevronLeft size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={detailStyles.headerCenter}>
              <Text style={[detailStyles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {product.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {product.type === 'service'
                  ? <Briefcase size={12} color={colors.primary} />
                  : <Box size={12} color={typeConfig.color} />}
                <Text style={[detailStyles.headerSubtitle, { color: colors.textSecondary }]}>
                  {t(typeConfig.labelKey)}
                  {product.categoryName ? ` · ${product.categoryName}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => { onClose(); onEdit(product.id); }}
              style={[detailStyles.editBtn, { backgroundColor: colors.primaryLight }]}
              hitSlop={8}
            >
              <Pencil size={14} color={colors.primary} />
            </TouchableOpacity>
            {product.isArchived || !product.isActive ? (
              <TouchableOpacity
                onPress={() => { onUnarchive(product.id); onClose(); }}
                style={[detailStyles.editBtn, { backgroundColor: colors.successLight }]}
                hitSlop={8}
              >
                <Archive size={14} color={colors.success} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  confirm('Archiver', `Archiver « ${product.name} » ?`, [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Archiver', style: 'destructive', onPress: () => { onArchive(product.id); onClose(); } },
                  ]);
                }}
                style={[detailStyles.editBtn, { backgroundColor: colors.warningLight || '#FEF3C7' }]}
                hitSlop={8}
              >
                <Archive size={14} color={colors.warning || '#D97706'} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                confirm('Supprimer', `Supprimer définitivement « ${product.name} » et toutes ses variantes ?`, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => { onDelete(product.id); onClose(); } },
                ]);
              }}
              style={[detailStyles.deleteBtn, { backgroundColor: colors.dangerLight }]}
              hitSlop={8}
            >
              <Trash2 size={14} color={colors.danger} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={detailStyles.body}
            contentContainerStyle={detailStyles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {product.photoUrl ? (
              <Image source={{ uri: product.photoUrl }} style={detailStyles.productImage} resizeMode="cover" />
            ) : null}

            {product.description ? (
              <Text style={[detailStyles.description, { color: colors.textSecondary }]}>
                {product.description}
              </Text>
            ) : null}

            {/* Carte prix — BDD stocke HT, affiché TTC */}
            <View style={[detailStyles.priceCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
              <View style={detailStyles.priceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>{t('stock.salePrice')}</Text>
                  <Text style={[detailStyles.priceValue, { color: colors.text }]}>
                    {formatCurrency(htToTtc(product.salePrice, product.vatRate), currency)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>{t('stock.purchasePrice')}</Text>
                  <Text style={[detailStyles.priceValue, { color: colors.text }]}>
                    {formatCurrency(product.purchasePrice, currency)}
                  </Text>
                </View>
                {margin && (
                  <View style={{ flex: 1 }}>
                    <Text style={[detailStyles.priceLabel, { color: colors.textTertiary }]}>{t('stock.margin')}</Text>
                    <Text style={[detailStyles.priceValue, { color: colors.success }]}>{margin.percent}%</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Infos diverses */}
            <View style={[detailStyles.infoSection, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
              {renderInfoRow(t('stock.productBrand'), product.brand)}
              {renderInfoRow(t('stock.productUnit'), product.unit)}
              {renderInfoRow(t('stock.vatRate'), `${String(product.vatRate).replace('.', ',')}%`)}
              {isStockableType(product.type) && (
                <>
                  <View style={detailStyles.infoRow}>
                    <Text style={[detailStyles.infoLabel, { color: colors.textTertiary }]}>{t('stock.currentStock')}</Text>
                    <View style={[detailStyles.stockBadge, { backgroundColor: isLowStock ? colors.dangerLight : colors.successLight }]}>
                      <Text style={[detailStyles.stockText, { color: isLowStock ? colors.danger : colors.success }]}>
                        {totalStock}
                      </Text>
                    </View>
                  </View>
                  {renderInfoRow(t('stock.lowStockAlert'), String(product.lowStockThreshold))}
                </>
              )}
            </View>

            {/* Variantes */}
            <View style={[detailStyles.variantsSection, { borderColor: colors.cardBorder }]}>
              <View style={detailStyles.variantsHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Layers size={16} color={colors.primary} />
                  <Text style={[detailStyles.variantsTitle, { color: colors.text }]}>
                    {t('stock.variants', { count: userVariants.length })}
                  </Text>
                  {userVariants.length > 0 && (
                    <View style={[detailStyles.variantCountBadge, { backgroundColor: `${colors.primary}15` }]}>
                      <Text style={[detailStyles.variantCountText, { color: colors.primary }]}>
                        {userVariants.length}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={onAddVariant}
                  style={[detailStyles.addVariantBtn, { backgroundColor: colors.primaryLight }]}
                >
                  <Plus size={14} color={colors.primary} />
                  <Text style={[detailStyles.addVariantText, { color: colors.primary }]}>{t('stock.addVariant')}</Text>
                </TouchableOpacity>
              </View>

              {userVariants.length === 0 ? (
                <View style={detailStyles.emptyVariants}>
                  <Layers size={28} color={colors.textTertiary} />
                  <Text style={[detailStyles.emptyVariantsText, { color: colors.textTertiary }]}>
                    {t('stock.noVariants')}
                  </Text>
                  <Text style={[detailStyles.emptyVariantsHint, { color: colors.textTertiary }]}>
                    {t('stock.noVariantsHint')}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 1 }}>
                  {!isMobile && (
                    <View style={[detailStyles.variantTableHeader, { backgroundColor: colors.surfaceHover }]}>
                      <Text style={[detailStyles.variantHeaderCell, { flex: 1 }]}>{t('stock.attributes')}</Text>
                      <Text style={[detailStyles.variantHeaderCell, { flex: 1, textAlign: 'right' }]}>{t('stock.purchasePrice').toUpperCase()}</Text>
                      <Text style={[detailStyles.variantHeaderCell, { flex: 1, textAlign: 'right' }]}>{t('stock.salePrice').toUpperCase()}</Text>
                      <Text style={[detailStyles.variantHeaderCell, { flex: 0.6, textAlign: 'center' }]}>{t('stock.currentStock').toUpperCase()}</Text>
                      <Text style={[detailStyles.variantHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('stock.actions').toUpperCase()}</Text>
                    </View>
                  )}
                  {getOrderedVariants(userVariants).map((v) => {
                    const hasAttrs = Object.keys(v.attributes).length > 0;
                    const attrLabel = hasAttrs
                      ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' — ')
                      : 'Variante par défaut';
                    const variantLowStock = v.stockQuantity <= (v.minStock || product.lowStockThreshold);
                    const variantSaleTTC = htToTtc(v.salePrice, product.vatRate);
                    const hasRecipe = !!getRecipeForProduct(product.id, v.id);
                    return (
                      <View key={v.id} style={[detailStyles.variantRow, { borderBottomColor: colors.borderLight }]}>
                        {isMobile ? (
                          <View style={{ flex: 1, gap: 4 }}>
                            {!hasAttrs && <Text style={[detailStyles.variantAttrText, { color: colors.text }]}>{attrLabel}</Text>}
                            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                                Achat HT: {formatCurrency(v.purchasePrice, currency)}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.text, fontWeight: '600' }}>
                                Vente TTC: {formatCurrency(variantSaleTTC, currency)}
                              </Text>
                              <View style={[styles.stockBadge, { backgroundColor: variantLowStock ? colors.dangerLight : colors.successLight }]}>
                                <Text style={[styles.stockText, { color: variantLowStock ? colors.danger : colors.success }]}>
                                  {v.stockQuantity}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ) : (
                          <>
                            <Text style={[detailStyles.variantAttrText, { flex: 1, color: colors.text }]} numberOfLines={1}>
                              {attrLabel}
                            </Text>
                            <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'right' }}>
                              {formatCurrency(v.purchasePrice, currency)}
                            </Text>
                            <Text style={{ flex: 1, fontSize: 12, color: colors.text, fontWeight: '600', textAlign: 'right' }}>
                              {formatCurrency(variantSaleTTC, currency)}
                            </Text>
                            <View style={{ flex: 0.6, alignItems: 'center' }}>
                              <View style={[styles.stockBadge, { backgroundColor: variantLowStock ? colors.dangerLight : colors.successLight }]}>
                                <Text style={[styles.stockText, { color: variantLowStock ? colors.danger : colors.success }]}>
                                  {v.stockQuantity}
                                </Text>
                              </View>
                            </View>
                          </>
                        )}
                        <View style={{ flex: isMobile ? undefined : 0.6, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
                          {isTransformed && hasAttrs && (
                            <TouchableOpacity
                              onPress={() => onOpenRecipeEditor(product.id, product.name, v.id, attrLabel)}
                              style={[styles.iconBtn, { backgroundColor: hasRecipe ? '#ECFDF5' : `${colors.primary}10` }]}
                            >
                              <ChefHat size={11} color={hasRecipe ? '#059669' : colors.primary} />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity onPress={() => onEditVariant(v)} style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}>
                            <Pencil size={11} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => onDeleteVariant(v.id)} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}>
                            <Trash2 size={11} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Recette produit sans variante */}
            {isTransformed && userVariants.length === 0 && (
              <View style={[detailStyles.variantsSection, { borderColor: colors.cardBorder, marginTop: 12 }]}>
                <View style={detailStyles.variantsHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ChefHat size={16} color={colors.primary} />
                    <Text style={[detailStyles.variantsTitle, { color: colors.text }]}>{t('recipe.title')}</Text>
                  </View>
                </View>
                {(() => {
                  const productRecipe = getRecipeForProduct(product.id);
                  return (
                    <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                      {productRecipe && productRecipe.items.length > 0 ? (
                        <View style={{ gap: 6 }}>
                          {productRecipe.items.map((item: any) => (
                            <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                              <Package size={12} color={colors.textTertiary} />
                              <Text style={{ flex: 1, fontSize: 12, color: colors.text }} numberOfLines={1}>
                                {item.ingredientProductName}
                                {item.ingredientVariantLabel ? ` (${item.ingredientVariantLabel})` : ''}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                                {item.quantity} {item.unit}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('recipe.noRecipe')}</Text>
                      )}
                      <TouchableOpacity
                        style={[styles.iconBtn, {
                          backgroundColor: productRecipe ? '#ECFDF5' : colors.primaryLight,
                          flexDirection: 'row', gap: 6, paddingHorizontal: 10, width: 'auto' as any,
                        }]}
                        onPress={() => onOpenRecipeEditor(product.id, product.name)}
                      >
                        <ChefHat size={13} color={productRecipe ? '#059669' : colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: productRecipe ? '#059669' : colors.primary }}>
                          {productRecipe ? t('recipe.editRecipe') : t('recipe.addRecipe')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}