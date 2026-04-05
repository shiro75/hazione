/**
 * components/products/steps/Step4Recipe.tsx
 * Étape 4 : gestion des recettes pour les produits transformés et finis.
 * Permet de définir la recette du produit générique et de la répliquer
 * à toutes les variantes, ou de personnaliser par variante.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ChefHat, Package, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { stepStyles } from '@/components/stock/products/productsStyles';
import { styles } from '@/components/stock/products/productsStyles';
import type { ProductVariant } from '@/types';

interface RecipeItem {
  id: string;
  ingredientProductName: string;
  ingredientVariantLabel?: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  items: RecipeItem[];
  variantId?: string;
}

interface Step4RecipeProps {
  productId: string | null;
  productName: string;
  productVariants: ProductVariant[];
  getRecipeForProduct: (productId: string, variantId?: string) => Recipe | null | undefined;
  saveRecipe: (productId: string, items: RecipeItem[], variantId?: string) => void;
  openRecipeEditor: (productId: string, productName: string, variantId?: string, variantLabel?: string) => void;
  getOrderedVariants: (variants: ProductVariant[]) => ProductVariant[];
  showToast: (msg: string) => void;
}

export default function Step4Recipe({
  productId, productName, productVariants,
  getRecipeForProduct, saveRecipe, openRecipeEditor, getOrderedVariants, showToast,
}: Step4RecipeProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const hasMultipleVariants =
    productVariants.length > 1 ||
    (productVariants.length === 1 && Object.keys(productVariants[0]?.attributes ?? {}).length > 0);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
      <View style={{
        backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}20`,
        borderWidth: 1, borderRadius: 10, padding: 12,
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <ChefHat size={16} color={colors.primary} />
        <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>
          {t('recipe.step4Hint')}
        </Text>
      </View>

      {!productId ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>{t('recipe.noRecipeHint')}</Text>
        </View>
      ) : hasMultipleVariants ? (
        <MultiVariantRecipes
          productId={productId} productName={productName}
          productVariants={productVariants} getRecipeForProduct={getRecipeForProduct}
          saveRecipe={saveRecipe} openRecipeEditor={openRecipeEditor}
          getOrderedVariants={getOrderedVariants} showToast={showToast}
          colors={colors} t={t}
        />
      ) : (
        <SingleRecipe
          productId={productId} productName={productName}
          getRecipeForProduct={getRecipeForProduct} openRecipeEditor={openRecipeEditor}
          colors={colors} t={t}
        />
      )}
    </ScrollView>
  );
}

// --- sous-composants internes ---

function RecipeItemsList({ items, colors }: { items: RecipeItem[]; colors: any }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((item) => (
        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Package size={10} color={colors.textTertiary} />
          <Text style={{ flex: 1, fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
            {item.ingredientProductName}
            {item.ingredientVariantLabel ? ` (${item.ingredientVariantLabel})` : ''}
          </Text>
          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
            {item.quantity} {item.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EditRecipeButton({
  hasRecipe, onPress, colors, t,
}: { hasRecipe: boolean; onPress: () => void; colors: any; t: any }) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed',
        borderColor: hasRecipe ? '#059669' : colors.primary,
      }}
      onPress={onPress}
    >
      <ChefHat size={14} color={hasRecipe ? '#059669' : colors.primary} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: hasRecipe ? '#059669' : colors.primary }}>
        {hasRecipe ? t('recipe.editRecipe') : t('recipe.addRecipe')}
      </Text>
    </TouchableOpacity>
  );
}

function SingleRecipe({ productId, productName, getRecipeForProduct, openRecipeEditor, colors, t }: any) {
  const recipe = getRecipeForProduct(productId);
  const hasRecipe = !!recipe && recipe.items.length > 0;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('recipe.productRecipe')}</Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('recipe.stockDeduction')}</Text>
      <View style={{ backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 }}>
        {hasRecipe && <RecipeItemsList items={recipe.items} colors={colors} />}
        <EditRecipeButton hasRecipe={hasRecipe} onPress={() => openRecipeEditor(productId, productName)} colors={colors} t={t} />
      </View>
    </View>
  );
}

function MultiVariantRecipes({
  productId, productName, productVariants, getRecipeForProduct, saveRecipe,
  openRecipeEditor, getOrderedVariants, showToast, colors, t,
}: any) {
  const genericRecipe = getRecipeForProduct(productId);
  const hasGenericRecipe = !!genericRecipe && genericRecipe.items.length > 0;

  return (
    <View style={{ gap: 12 }}>
      {/* Recette générique */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Recette du produit générique</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
          Définissez la recette de base. Vous pourrez ensuite la répliquer à toutes les variantes.
        </Text>
        <View style={{
          backgroundColor: colors.card,
          borderColor: hasGenericRecipe ? '#059669' + '40' : colors.cardBorder,
          borderWidth: 1, borderRadius: 10, padding: 12, gap: 8,
        }}>
          {hasGenericRecipe && <RecipeItemsList items={genericRecipe.items} colors={colors} />}
          <EditRecipeButton hasRecipe={hasGenericRecipe} onPress={() => openRecipeEditor(productId, productName)} colors={colors} t={t} />
        </View>

        {hasGenericRecipe && (
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10,
              backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F620',
            }}
            onPress={() => {
              productVariants.forEach((v: ProductVariant) => {
                const copiedItems = genericRecipe.items.map((item: RecipeItem) => ({
                  ...item,
                  id: `ri_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                }));
                saveRecipe(productId, copiedItems, v.id);
              });
              showToast(`Recette répliquée à ${productVariants.length} variante(s)`);
            }}
            activeOpacity={0.7}
          >
            <Copy size={14} color="#3B82F6" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E40AF' }}>
              Répliquer la recette à toutes les variantes
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

      {/* Recettes par variante */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('recipe.variantRecipe')}</Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
        Personnalisez la recette pour chaque variante si nécessaire.
      </Text>
      {getOrderedVariants(productVariants).map((v: ProductVariant) => {
        const hasAttrs = Object.keys(v.attributes).length > 0;
        const attrLabel = hasAttrs
          ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' / ')
          : t('recipe.defaultVariant');
        const recipe = getRecipeForProduct(productId, v.id);
        const hasRecipe = !!recipe && recipe.items.length > 0;
        return (
          <View key={v.id} style={{ backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 }} numberOfLines={1}>
                {attrLabel}
              </Text>
              <TouchableOpacity
                style={[styles.iconBtn, {
                  backgroundColor: hasRecipe ? '#ECFDF5' : colors.primaryLight,
                  flexDirection: 'row', gap: 4, paddingHorizontal: 8, width: 'auto' as any,
                }]}
                onPress={() => openRecipeEditor(productId, productName, v.id, attrLabel)}
              >
                <ChefHat size={12} color={hasRecipe ? '#059669' : colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: hasRecipe ? '#059669' : colors.primary }}>
                  {hasRecipe ? t('recipe.editRecipe') : t('recipe.addRecipe')}
                </Text>
              </TouchableOpacity>
            </View>
            {hasRecipe && <RecipeItemsList items={recipe.items} colors={colors} />}
          </View>
        );
      })}
    </View>
  );
}