/**
 * components/products/steps/Step1General.tsx
 * Étape 1 du formulaire produit : type, nom, description, SKU, codes, catégorie,
 * marque, unité, TVA, prix d'achat HT, prix de vente TTC, images.
 * Affiche en temps réel le prix HT calculé et la marge.
 */

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Upload, X, Image as ImageIcon, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatCurrency } from '@/utils/format';
import { htToTtc, ttcToHt, calcMargin } from '@/utils/price';
import FormField from '@/components/FormField';
import DropdownPicker from '@/components/DropdownPicker';
import { getProductTypeOptions } from '@/constants/productTypes';
import { styles } from '@/components/stock/products/productsStyles';
import type { ProductType, VATRate } from '@/types';
import type { EMPTY_FORM } from '@/types/product.types';
import type { Product } from '@/types';

interface Step1GeneralProps {
  form: typeof EMPTY_FORM;
  updateField: <K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) => void;
  duplicateProduct: Product | null;
  onOpenEdit: (id: string) => void;
  currency: string;
  // Options de selects
  categoryOptions: { label: string; value: string }[];
  brandOptions: { label: string; value: string }[];
  unitOptions: { label: string; value: string }[];
  vatOptions: { label: string; value: string }[];
  products: Product[];
  // Callbacks de gestion des listes
  addProductCategory: (v: string) => void;
  removeProductCategory: (v: string) => void;
  renameProductCategory: (oldVal: string, newVal: string) => void;
  addProductBrand: (v: string) => void;
  removeProductBrand: (v: string) => void;
  renameProductBrand: (oldVal: string, newVal: string) => void;
  addProductUnit: (v: string) => void;
}

export default function Step1General({
  form, updateField, duplicateProduct, onOpenEdit, currency,
  categoryOptions, brandOptions, unitOptions, vatOptions, products,
  addProductCategory, removeProductCategory, renameProductCategory,
  addProductBrand, removeProductBrand, renameProductBrand, addProductUnit,
}: Step1GeneralProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const TYPE_OPTIONS = getProductTypeOptions(t);

  const isRawMaterial = form.type === 'matiere_premiere';
  const salePriceTTC = parseFloat(form.salePrice) || 0;
  const purchasePriceHT = parseFloat(form.purchasePrice) || 0;
  const vatRate = parseFloat(form.vatRate) || 20;
  const salePriceHT = salePriceTTC > 0 ? ttcToHt(salePriceTTC, vatRate) : 0;
  const margin = calcMargin(purchasePriceHT, salePriceHT);

  const pickImages = async (append: boolean) => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = (e: any) => {
          const files = e.target?.files;
          if (!files) return;
          const uris = Array.from(files as FileList).map((f: File) =>
            URL.createObjectURL(f),
          );
          updateField('imageUrls', append ? [...form.imageUrls, ...uris] : uris);
        };
        input.click();
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const uris = result.assets.map((a) => a.uri);
        updateField('imageUrls', append ? [...form.imageUrls, ...uris] : uris);
      }
    } catch {}
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
    >
      <DropdownPicker
        label={t('stock.productType')}
        value={form.type}
        options={TYPE_OPTIONS}
        onSelect={(v) => updateField('type', v as ProductType)}
        required
        placeholder={t('stock.selectProductType')}
      />

      <FormField
        label={t('stock.productName')}
        value={form.name}
        onChangeText={(v) => updateField('name', v)}
        placeholder={t('stock.productName')}
        required
        testID="product-name"
      />

      {duplicateProduct && (
        <View style={[styles.dupWarning, { backgroundColor: '#FEF3C7', borderColor: '#D97706' }]}>
          <AlertTriangle size={14} color="#B45309" />
          <View style={{ flex: 1 }}>
            <Text style={styles.dupWarningText}>
              Un produit « {duplicateProduct.name} » existe déjà
              {duplicateProduct.categoryName
                ? ` dans la catégorie "${duplicateProduct.categoryName}"`
                : ' dans cette catégorie'}.
            </Text>
            <TouchableOpacity
              onPress={() => onOpenEdit(duplicateProduct.id)}
              activeOpacity={0.7}
              style={styles.dupWarningLink}
            >
              <Text style={styles.dupWarningLinkText}>Voir le produit existant</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FormField
        label="Description"
        value={form.description}
        onChangeText={(v) => updateField('description', v)}
        placeholder={t('stock.productDescription')}
        multiline
        numberOfLines={2}
      />

      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <FormField
            label={t('stock.productBarcode')}
            value={form.barcode}
            onChangeText={(v) => updateField('barcode', v)}
            placeholder={t('stock.barcodePlaceholder')}
          />
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <DropdownPicker
            label={t('stock.productCategory')}
            value={form.category}
            options={categoryOptions}
            onSelect={(v) => updateField('category', v)}
            onAddNew={(v) => { void addProductCategory(v); updateField('category', v); }}
            addLabel={t('stock.newCategory')}
            onRenameItem={(oldVal, newVal) => {
              void renameProductCategory(oldVal, newVal);
              if (form.category === oldVal) updateField('category', newVal);
            }}
            onDeleteItem={(val) => {
              void removeProductCategory(val);
              if (form.category === val) updateField('category', '');
            }}
            getDeleteWarning={(val) => {
              const count = products.filter((p) => p.categoryName === val && !p.isArchived).length;
              return count > 0 ? `${count} produit(s) utilisent cette catégorie. Supprimer quand même ?` : null;
            }}
          />
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <DropdownPicker
            label="Marque"
            value={form.brand}
            options={brandOptions}
            onSelect={(v) => updateField('brand', v)}
            onAddNew={(v) => { void addProductBrand(v); updateField('brand', v); }}
            addLabel={t('stock.newBrand')}
            placeholder={t('stock.brandPlaceholder')}
            onRenameItem={(oldVal, newVal) => {
              void renameProductBrand(oldVal, newVal);
              if (form.brand === oldVal) updateField('brand', newVal);
            }}
            onDeleteItem={(val) => {
              void removeProductBrand(val);
              if (form.brand === val) updateField('brand', '');
            }}
            getDeleteWarning={(val) => {
              const count = products.filter((p) => p.brand === val && !p.isArchived).length;
              return count > 0 ? `${count} produit(s) utilisent cette marque. Supprimer quand même ?` : null;
            }}
          />
        </View>
        <View style={styles.formCol}>
          <DropdownPicker
            label={t('stock.productUnit')}
            value={form.unit}
            options={unitOptions}
            onSelect={(v) => updateField('unit', v)}
            onAddNew={(v) => { addProductUnit(v); updateField('unit', v); }}
            addLabel={t('stock.newUnit')}
            required
            placeholder={t('stock.unitPlaceholder')}
          />
        </View>
      </View>

      {/* Prix */}
      <DropdownPicker
        label={t('stock.vatRate')}
        value={form.vatRate}
        options={vatOptions}
        onSelect={(v) => updateField('vatRate', v)}
        required
        placeholder={t('stock.vatPlaceholder')}
      />

      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <FormField
            label={t('stock.purchasePrice')}
            value={form.purchasePrice}
            onChangeText={(v) => updateField('purchasePrice', v)}
            placeholder={t('stock.purchasePricePlaceholder')}
            keyboardType="decimal-pad"
            required={isRawMaterial}
          />
        </View>
        <View style={styles.formCol}>
          <FormField
            label={t('stock.salePrice')}
            value={form.salePrice}
            onChangeText={(v) => updateField('salePrice', v)}
            placeholder={t('stock.salePricePlaceholder')}
            keyboardType="decimal-pad"
            required={!isRawMaterial}
          />
        </View>
      </View>

      {salePriceTTC > 0 && (
        <View style={[styles.marginInfo, { backgroundColor: '#EFF6FF' }]}>
          <Text style={[styles.marginInfoText, { color: '#1E40AF' }]}>
            {t('stock.priceExcludingVat')} : {formatCurrency(salePriceHT, currency)} ({t('stock.vatRate')} {form.vatRate.replace('.', ',')}%)
          </Text>
        </View>
      )}

      {margin && (
        <View style={[styles.marginInfo, { backgroundColor: colors.successLight }]}>
          <Text style={[styles.marginInfoText, { color: colors.success }]}>
            {t('stock.margin')} : {formatCurrency(margin.amount, currency)} ({margin.percent}%)
          </Text>
        </View>
      )}

      <FormField
        label={t('stock.lowStockAlert')}
        value={form.lowStockThreshold}
        onChangeText={(v) => updateField('lowStockThreshold', v)}
        placeholder={t('stock.lowStockPlaceholder')}
        keyboardType="numeric"
      />

      {/* Images */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ImageIcon size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>
              {t('stock.productImages')}
            </Text>
          </View>
          {(form.imageUrls.length > 0 || form.photoUrl.trim()) && (
            <TouchableOpacity
              onPress={() => pickImages(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primaryLight }}
            >
              <Upload size={12} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>
                {t('stock.importImages')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {form.imageUrls.length === 0 && !form.photoUrl.trim() ? (
          <TouchableOpacity
            onPress={() => pickImages(false)}
            style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 10, paddingVertical: 20, alignItems: 'center', gap: 6 }}
          >
            <Upload size={24} color={colors.textTertiary} />
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('stock.importFromDevice')}</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(form.imageUrls.length > 0 ? form.imageUrls : [form.photoUrl]).map((uri, idx) => (
              <View key={`img_${idx}`} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 8 }} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => {
                    if (form.imageUrls.length > 0) {
                      updateField('imageUrls', form.imageUrls.filter((_, i) => i !== idx));
                    } else {
                      updateField('photoUrl', '');
                    }
                  }}
                  style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
                  hitSlop={6}
                >
                  <X size={10} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}