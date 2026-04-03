import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Modal, Pressable, useWindowDimensions,
} from 'react-native';
import {
  X, Plus, Search, Trash2, ChefHat, Package, Layers, Check, AlertTriangle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatCurrency } from '@/utils/format';
import type { RecipeItem, Product, ProductVariant } from '@/types';

interface RecipeEditorProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  variantId?: string;
  productName: string;
  variantLabel?: string;
  onRecipeSaved?: (totalCost: number) => void;
}

function generateItemId(): string {
  return `ri_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default function RecipeEditor({
  visible,
  onClose,
  productId,
  variantId,
  productName,
  variantLabel,
  onRecipeSaved,
}: RecipeEditorProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { t } = useI18n();
  const {
    products, activeProducts, variants, getVariantsForProduct,
    getRecipeForProduct, saveRecipe, deleteRecipe, company,
  } = useData();

  const cur = company.currency || 'EUR';

  const existingRecipe = useMemo(() => {
    return getRecipeForProduct(productId, variantId);
  }, [getRecipeForProduct, productId, variantId]);

  const [items, setItems] = useState<RecipeItem[]>(existingRecipe?.items ?? []);
  const [qtyTexts, setQtyTexts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    (existingRecipe?.items ?? []).forEach(i => { map[i.id] = String(i.quantity); });
    return map;
  });
  const [search, setSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      const recipe = getRecipeForProduct(productId, variantId);
      const recipeItems = recipe?.items ?? [];
      setItems(recipeItems);
      const map: Record<string, string> = {};
      recipeItems.forEach(i => { map[i.id] = String(i.quantity); });
      setQtyTexts(map);
      setSearch('');
      setShowProductPicker(false);
      setError('');
    }
  }, [visible, productId, variantId, getRecipeForProduct]);

  const resetState = useCallback(() => {
    const recipe = getRecipeForProduct(productId, variantId);
    const recipeItems = recipe?.items ?? [];
    setItems(recipeItems);
    const map: Record<string, string> = {};
    recipeItems.forEach(i => { map[i.id] = String(i.quantity); });
    setQtyTexts(map);
    setSearch('');
    setShowProductPicker(false);
    setError('');
  }, [getRecipeForProduct, productId, variantId]);

  const availableProducts = useMemo(() => {
    return activeProducts.filter(p => {
      if (p.id === productId) return false;
      if (p.type === 'service') return false;
      return true;
    });
  }, [activeProducts, productId]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return availableProducts;
    const q = search.toLowerCase();
    return availableProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.categoryName || '').toLowerCase().includes(q)
    );
  }, [availableProducts, search]);

  const handleAddIngredient = useCallback((product: Product, variant?: ProductVariant) => {
    const alreadyExists = items.some(i =>
      i.ingredientProductId === product.id &&
      (variant ? i.ingredientVariantId === variant.id : !i.ingredientVariantId)
    );
    if (alreadyExists) {
      setError('Cet ingredient est deja dans la recette');
      return;
    }

    const variantLabel2 = variant
      ? Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(' / ')
      : undefined;

    const newItem: RecipeItem = {
      id: generateItemId(),
      ingredientProductId: product.id,
      ingredientProductName: product.name,
      ingredientVariantId: variant?.id,
      ingredientVariantLabel: variantLabel2,
      quantity: 1,
      unit: product.unit || 'unite',
    };
    setItems(prev => [...prev, newItem]);
    setQtyTexts(prev => ({ ...prev, [newItem.id]: '1' }));
    setShowProductPicker(false);
    setSearch('');
    setError('');
  }, [items]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
    setQtyTexts(prev => { const next = { ...prev }; delete next[itemId]; return next; });
  }, []);

  const handleUpdateQuantity = useCallback((itemId: string, qty: string) => {
    const normalized = qty.replace(',', '.');
    setQtyTexts(prev => ({ ...prev, [itemId]: qty }));
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, quantity: parsed } : i
      ));
    }
  }, []);

  const handleSave = useCallback(() => {
    if (items.length === 0) {
      setError(t('recipe.ingredientRequired'));
      return;
    }
    const invalidItem = items.find(i => i.quantity <= 0);
    if (invalidItem) {
      setError(t('recipe.quantityRequired'));
      return;
    }
    const result = saveRecipe(productId, items, variantId);
    if (result.success) {
      if (onRecipeSaved) {
        let totalCost = 0;
        items.forEach(item => {
          const ingredientProduct = products.find(p => p.id === item.ingredientProductId);
          if (ingredientProduct) {
            let unitCost = ingredientProduct.purchasePrice;
            if (item.ingredientVariantId) {
              const ingredientVariant = variants.find(v => v.id === item.ingredientVariantId);
              if (ingredientVariant) unitCost = ingredientVariant.purchasePrice;
            }
            totalCost += unitCost * item.quantity;
          }
        });
        onRecipeSaved(Math.round(totalCost * 100) / 100);
      }
      onClose();
    } else {
      setError(result.error || '');
    }
  }, [items, saveRecipe, productId, variantId, onClose, t, onRecipeSaved, products, variants]);

  const handleDelete = useCallback(() => {
    deleteRecipe(productId, variantId);
    setItems([]);
    onClose();
  }, [deleteRecipe, productId, variantId, onClose]);

  const renderProductPickerItem = useCallback((product: Product) => {
    const productVariants = getVariantsForProduct(product.id);
    const hasMultipleVariants = productVariants.length > 1 ||
      (productVariants.length === 1 && Object.keys(productVariants[0].attributes).length > 0);

    if (!hasMultipleVariants) {
      return (
        <TouchableOpacity
          key={product.id}
          style={[pickerStyles.item, { borderBottomColor: colors.borderLight }]}
          onPress={() => handleAddIngredient(product)}
          activeOpacity={0.7}
        >
          <View style={[pickerStyles.itemIcon, { backgroundColor: colors.primaryLight }]}>
            <Package size={14} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[pickerStyles.itemName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
            <Text style={[pickerStyles.itemMeta, { color: colors.textTertiary }]}>
              {product.unit} - {formatCurrency(product.purchasePrice, cur)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    const totalStock = productVariants.reduce((s, v) => s + v.stockQuantity, 0);
    return (
      <View key={product.id}>
        <TouchableOpacity
          style={[pickerStyles.item, { borderBottomColor: colors.borderLight, backgroundColor: colors.surfaceHover }]}
          onPress={() => handleAddIngredient(product)}
          activeOpacity={0.7}
        >
          <View style={[pickerStyles.itemIcon, { backgroundColor: colors.primaryLight }]}>
            <Layers size={14} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pickerStyles.itemName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
            <Text style={[pickerStyles.itemMeta, { color: colors.textTertiary }]}>
              Tout le produit - Stock: {totalStock} {product.unit}
            </Text>
          </View>
          <View style={[pickerStyles.genericBadge, { backgroundColor: `${colors.primary}15` }]}>
            <Text style={{ fontSize: 9, fontWeight: '600' as const, color: colors.primary }}>GENERIQUE</Text>
          </View>
        </TouchableOpacity>
        {productVariants.map(v => {
          const attrLabel = Object.keys(v.attributes).length > 0
            ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' / ')
            : t('recipe.defaultVariant');
          return (
            <TouchableOpacity
              key={v.id}
              style={[pickerStyles.variantItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => handleAddIngredient(product, v)}
              activeOpacity={0.7}
            >
              <View style={{ width: 28 }} />
              <Text style={[pickerStyles.variantLabel, { color: colors.text }]} numberOfLines={1}>
                {attrLabel}
              </Text>
              <Text style={[pickerStyles.itemMeta, { color: colors.textTertiary }]}>
                Stock: {v.stockQuantity}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [getVariantsForProduct, handleAddIngredient, colors, cur, t]);

  if (!visible) return null;

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={() => { resetState(); onClose(); }}>
      <Pressable style={modalStyles.overlay} onPress={() => { resetState(); onClose(); }}>
        <Pressable
          style={[modalStyles.container, {
            backgroundColor: colors.card,
            width: isMobile ? width - 16 : 560,
            maxHeight: isMobile ? '95%' as unknown as number : '85%' as unknown as number,
          }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
            <View style={[modalStyles.headerIcon, { backgroundColor: `${colors.primary}15` }]}>
              <ChefHat size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[modalStyles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {existingRecipe ? t('recipe.editRecipe') : t('recipe.addRecipe')}
              </Text>
              <Text style={[modalStyles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {productName}{variantLabel ? ` - ${variantLabel}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { resetState(); onClose(); }} hitSlop={8}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[modalStyles.errorBanner, { backgroundColor: colors.dangerLight }]}>
              <AlertTriangle size={14} color={colors.danger} />
              <Text style={[modalStyles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={[modalStyles.infoCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}20` }]}>
              <ChefHat size={14} color={colors.primary} />
              <Text style={[modalStyles.infoText, { color: colors.textSecondary }]}>
                {t('recipe.stockDeduction')}
              </Text>
            </View>

            <Text style={[modalStyles.sectionTitle, { color: colors.text }]}>
              {t('recipe.ingredients')} ({items.length})
            </Text>

            {items.length === 0 ? (
              <View style={[modalStyles.emptyState, { backgroundColor: colors.surfaceHover }]}>
                <Package size={24} color={colors.textTertiary} />
                <Text style={[modalStyles.emptyText, { color: colors.textTertiary }]}>
                  {t('recipe.noRecipeHint')}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {items.map((item) => {
                  const ingredientProduct = products.find(p => p.id === item.ingredientProductId);
                  const currentStock = item.ingredientVariantId
                    ? variants.find(v => v.id === item.ingredientVariantId)?.stockQuantity ?? 0
                    : ingredientProduct?.stockQuantity ?? 0;

                  return (
                    <View
                      key={item.id}
                      style={[ingredientStyles.card, {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                      }]}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[ingredientStyles.name, { color: colors.text }]} numberOfLines={1}>
                          {item.ingredientProductName}
                        </Text>
                        {item.ingredientVariantLabel ? (
                          <Text style={[ingredientStyles.variant, { color: colors.textTertiary }]} numberOfLines={1}>
                            {item.ingredientVariantLabel}
                          </Text>
                        ) : null}
                        <Text style={[ingredientStyles.stockInfo, { color: currentStock <= 0 ? colors.danger : colors.textTertiary }]}>
                          Stock: {currentStock} {item.unit}
                        </Text>
                      </View>
                      <View style={ingredientStyles.qtyContainer}>
                        <TextInput
                          style={[ingredientStyles.qtyInput, {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.inputBorder,
                            color: colors.text,
                          }]}
                          value={qtyTexts[item.id] ?? String(item.quantity)}
                          onChangeText={(v) => handleUpdateQuantity(item.id, v)}
                          keyboardType="decimal-pad"
                          onBlur={() => {
                            const normalized = (qtyTexts[item.id] ?? '').replace(',', '.');
                            const parsed = parseFloat(normalized);
                            if (isNaN(parsed) || parsed <= 0) {
                              setQtyTexts(prev => ({ ...prev, [item.id]: String(item.quantity) }));
                            } else {
                              setQtyTexts(prev => ({ ...prev, [item.id]: String(parsed) }));
                            }
                          }}
                          selectTextOnFocus
                        />
                        <Text style={[ingredientStyles.unitLabel, { color: colors.textTertiary }]}>
                          {item.unit}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(item.id)}
                        style={[ingredientStyles.removeBtn, { backgroundColor: colors.dangerLight }]}
                        hitSlop={6}
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {showProductPicker ? (
              <View style={[pickerStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[pickerStyles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <Search size={14} color={colors.textTertiary} />
                  <TextInput
                    style={[pickerStyles.searchInput, { color: colors.text }]}
                    placeholder={t('recipe.searchIngredient')}
                    placeholderTextColor={colors.textTertiary}
                    value={search}
                    onChangeText={setSearch}
                    autoFocus
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
                      <X size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={pickerStyles.list} nestedScrollEnabled>
                  {filteredProducts.length === 0 ? (
                    <View style={pickerStyles.emptyPicker}>
                      <Text style={[pickerStyles.emptyPickerText, { color: colors.textTertiary }]}>
                        {t('recipe.noIngredientsAvailable')}
                      </Text>
                    </View>
                  ) : (
                    filteredProducts.map(renderProductPickerItem)
                  )}
                </ScrollView>
                <TouchableOpacity
                  style={[pickerStyles.cancelBtn, { borderTopColor: colors.border }]}
                  onPress={() => { setShowProductPicker(false); setSearch(''); }}
                >
                  <Text style={[pickerStyles.cancelText, { color: colors.textSecondary }]}>
                    {t('stock.cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[modalStyles.addBtn, { borderColor: colors.primary }]}
                onPress={() => setShowProductPicker(true)}
                activeOpacity={0.7}
              >
                <Plus size={16} color={colors.primary} />
                <Text style={[modalStyles.addBtnText, { color: colors.primary }]}>
                  {t('recipe.addIngredient')}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={[modalStyles.footer, { borderTopColor: colors.border }]}>
            {existingRecipe ? (
              <TouchableOpacity
                style={[modalStyles.deleteBtn, { backgroundColor: colors.dangerLight }]}
                onPress={handleDelete}
              >
                <Trash2 size={14} color={colors.danger} />
                <Text style={[modalStyles.deleteBtnText, { color: colors.danger }]}>
                  {t('recipe.deleteRecipe')}
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <View style={{ flexDirection: 'row' as const, gap: 8 }}>
              <TouchableOpacity
                style={[modalStyles.cancelFooterBtn, { borderColor: colors.border }]}
                onPress={() => { resetState(); onClose(); }}
              >
                <Text style={[modalStyles.cancelFooterText, { color: colors.textSecondary }]}>
                  {t('stock.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.saveBtn, { backgroundColor: colors.primary, opacity: items.length === 0 ? 0.5 : 1 }]}
                onPress={handleSave}
                disabled={items.length === 0}
              >
                <Check size={14} color="#FFF" />
                <Text style={modalStyles.saveBtnText}>{t('recipe.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
    borderRadius: 10,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cancelFooterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelFooterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
});

const ingredientStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
  },
  variant: {
    fontSize: 11,
  },
  stockInfo: {
    fontSize: 11,
  },
  qtyContainer: {
    alignItems: 'center',
    gap: 2,
  },
  qtyInput: {
    width: 64,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  unitLabel: {
    fontSize: 10,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 300,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    margin: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
    height: 28,
  },
  list: {
    maxHeight: 200,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 11,
  },
  variantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  variantLabel: {
    flex: 1,
    fontSize: 12,
  },
  emptyPicker: {
    padding: 20,
    alignItems: 'center',
  },
  emptyPickerText: {
    fontSize: 13,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '500',
  },
  genericBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
