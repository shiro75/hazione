/**
 * components/products/steps/Step3Variants.tsx
 * Étape 3 : configuration des prix et stocks par variante.
 * Si aucune variante : formulaire simple.
 * Sinon : tableau de brouillons avec application de prix en masse.
 * Les prix affichés sont en TTC, convertis en HT à la soumission finale.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { calcMargin, ttcToHt } from '@/utils/price';
import { formatCurrency } from '@/utils/format';
import FormField from '@/components/FormField';
import { styles, stepStyles, step3Styles } from '@/components/products/productsStyles';
import type { VariantDraft } from '@/types/product.types';
import type { EMPTY_FORM } from '@/types/product.types';

interface Step3VariantsProps {
  form: typeof EMPTY_FORM;
  updateField: <K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) => void;
  variantDrafts: VariantDraft[];
  setVariantDrafts: React.Dispatch<React.SetStateAction<VariantDraft[]>>;
  bulkPurchasePrice: string;
  setBulkPurchasePrice: (v: string) => void;
  bulkSalePrice: string;
  setBulkSalePrice: (v: string) => void;
  applyBulkPrices: () => void;
  currency: string;
}

export default function Step3Variants({
  form, updateField,
  variantDrafts, setVariantDrafts,
  bulkPurchasePrice, setBulkPurchasePrice,
  bulkSalePrice, setBulkSalePrice,
  applyBulkPrices,
  currency,
}: Step3VariantsProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const hasVariants = variantDrafts.length > 0;
  const includedCount = variantDrafts.filter((d) => d.included).length;
  const vatRate = parseFloat(form.vatRate) || 20;

  const updateDraft = (index: number, field: keyof VariantDraft, value: string | boolean) => {
    setVariantDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  if (!hasVariants) {
    const salePriceHT = (parseFloat(form.salePrice) || 0) > 0
      ? ttcToHt(parseFloat(form.salePrice), vatRate)
      : 0;
    const margin = calcMargin(parseFloat(form.purchasePrice) || 0, salePriceHT);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
        <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>{t('stock.productSimple')}</Text>
        <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
          {t('stock.noAttributesSelected')}
        </Text>
        <View style={[step3Styles.simpleCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <FormField
                label={t('stock.purchasePrice')} value={form.purchasePrice}
                onChangeText={(v) => updateField('purchasePrice', v)}
                placeholder="0.00" keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.formCol}>
              <FormField
                label={t('stock.salePrice')} value={form.salePrice}
                onChangeText={(v) => updateField('salePrice', v)}
                placeholder="0.00" keyboardType="decimal-pad" required
              />
            </View>
          </View>
          <FormField
            label={t('stock.stockInitial')} value={form.lowStockThreshold}
            onChangeText={(v) => updateField('lowStockThreshold', v)}
            placeholder="0" keyboardType="numeric"
          />
          {margin && (
            <View style={[styles.marginInfo, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.marginInfoText, { color: colors.success }]}>
                {t('stock.margin')} : {formatCurrency(margin.amount, currency)} ({margin.percent}%)
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
      <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>
        {variantDrafts.length === 1
          ? t('stock.variantsCount', { count: 1 })
          : t('stock.variantsCount', { count: variantDrafts.length })}
      </Text>
      <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
        {t('stock.variantIncluded')} {includedCount} — {t('stock.variantsHint')}
      </Text>

      {/* Bulk pricing */}
      <View style={[stepStyles.bulkRow, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
        <Text style={[stepStyles.bulkLabel, { color: colors.textSecondary }]}>{t('stock.applyToAll')}</Text>
        <View style={{ flex: 1 }}>
          <TextInput
            style={[stepStyles.bulkInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={bulkPurchasePrice} onChangeText={setBulkPurchasePrice}
            placeholder={t('stock.bulkPurchasePrice')} placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
            style={[stepStyles.bulkInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={bulkSalePrice} onChangeText={setBulkSalePrice}
            placeholder={t('stock.bulkSalePrice')} placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>
        <TouchableOpacity style={[stepStyles.bulkBtn, { backgroundColor: colors.primary }]} onPress={applyBulkPrices}>
          <Check size={14} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={stepStyles.draftHeaderRow}>
        <View style={{ width: 28 }} />
        <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, flex: 1 }]}>
          {t('stock.purchasePrice').toUpperCase()}
        </Text>
        <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, flex: 1 }]}>
          {t('stock.salePrice').toUpperCase()}
        </Text>
        <Text style={[stepStyles.draftHeaderText, { color: colors.textTertiary, width: 60 }]}>
          {t('stock.currentStock').toUpperCase()}
        </Text>
        <View style={{ width: 14 }} />
      </View>

      {variantDrafts.map((draft, idx) => {
        const attrLabel = Object.entries(draft.attributes).map(([k, v]) => `${k}: ${v}`).join(' / ');
        return (
          <View
            key={idx}
            style={[stepStyles.draftCard, {
              backgroundColor: draft.included ? colors.card : colors.surfaceHover,
              borderColor: draft.included ? colors.cardBorder : colors.border,
              opacity: draft.included ? 1 : 0.5,
            }]}
          >
            <View style={stepStyles.draftHeader}>
              <TouchableOpacity
                onPress={() => updateDraft(idx, 'included', !draft.included)}
                style={[stepStyles.checkbox, {
                  backgroundColor: draft.included ? colors.primary : 'transparent',
                  borderColor: draft.included ? colors.primary : colors.border,
                }]}
              >
                {draft.included && <Check size={12} color="#FFF" />}
              </TouchableOpacity>
              <Text style={[stepStyles.draftAttrLabel, { color: colors.text }]} numberOfLines={1}>
                {attrLabel}
              </Text>
              <TouchableOpacity onPress={() => setVariantDrafts((prev) => prev.filter((_, i) => i !== idx))}>
                <X size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>

            {draft.included && (
              <View style={stepStyles.draftFields}>
                <TextInput
                  style={[stepStyles.draftInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  value={draft.sku} placeholder="SKU" placeholderTextColor={colors.textTertiary}
                  onChangeText={(v) => updateDraft(idx, 'sku', v)}
                />
                <TextInput
                  style={[stepStyles.draftInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, flex: 1 }]}
                  value={draft.purchasePrice} placeholder="Achat HT" placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => updateDraft(idx, 'purchasePrice', v)}
                />
                <TextInput
                  style={[stepStyles.draftInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, flex: 1 }]}
                  value={draft.salePrice} placeholder="Vente TTC" placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => updateDraft(idx, 'salePrice', v)}
                />
                <TextInput
                  style={[stepStyles.draftInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, width: 60 }]}
                  value={draft.stockQuantity} placeholder="Stock" placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  onChangeText={(v) => updateDraft(idx, 'stockQuantity', v)}
                />
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}