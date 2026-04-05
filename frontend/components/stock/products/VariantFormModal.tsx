/**
 * components/products/VariantFormModal.tsx
 * Formulaire d'ajout ou d'édition d'une variante individuelle.
 * Le prix de vente est saisi en TTC, converti en HT dans le handler parent.
 */

import React from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity, ScrollView, useWindowDimensions,
} from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { detailStyles, stepStyles, variantStyles, styles } from '@/components/stock/products/productsStyles';
import FormField from '@/components/FormField';
import DropdownPicker from '@/components/DropdownPicker';

const modalOverlay = {
  flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center' as const, alignItems: 'center' as const,
};

interface AttributeRow {
  key: string;
  value: string;
}

export interface VariantFormState {
  attributes: AttributeRow[];
  sku: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
}

interface VariantFormModalProps {
  visible: boolean;
  editingVariantId: string | null;
  variantForm: VariantFormState;
  setVariantForm: React.Dispatch<React.SetStateAction<VariantFormState>>;
  existingAttributeKeys: string[];
  onClose: () => void;
  onSave: () => void;
}

export default function VariantFormModal({
  visible, editingVariantId, variantForm, setVariantForm,
  existingAttributeKeys, onClose, onSave,
}: VariantFormModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (!visible) return null;

  const updateAttr = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...variantForm.attributes];
    updated[idx] = { ...updated[idx], [field]: val };
    setVariantForm((f) => ({ ...f, attributes: updated }));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalOverlay} onPress={onClose}>
        <Pressable
          style={[detailStyles.modal, {
            backgroundColor: colors.card,
            width: isMobile ? width - 32 : 460,
            maxHeight: '85%' as any,
          }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
            <Text style={[detailStyles.headerTitle, { color: colors.text, flex: 1 }]}>
              {editingVariantId ? t('stock.editVariant') : t('stock.addVariant')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
            <Text style={[variantStyles.sectionLabel, { color: colors.textSecondary }]}>
              {t('stock.attributes')}
            </Text>

            {variantForm.attributes.map((attr, idx) => (
              <View key={idx} style={variantStyles.attrRow}>
                <View style={{ flex: 1 }}>
                  <DropdownPicker
                    label={t('stock.selectAttribute')}
                    value={attr.key}
                    options={existingAttributeKeys.map((k) => ({ label: k, value: k }))}
                    onSelect={(val) => updateAttr(idx, 'key', val)}
                    onAddNew={(val) => updateAttr(idx, 'key', val)}
                    addLabel="Nouvel attribut"
                    placeholder="Ex: Taille"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField
                    label={t('stock.selectValue')}
                    value={attr.value}
                    onChangeText={(val) => updateAttr(idx, 'value', val)}
                    placeholder={t('stock.selectValue')}
                  />
                </View>
                {variantForm.attributes.length > 1 && (
                  <TouchableOpacity
                    onPress={() => setVariantForm((f) => ({ ...f, attributes: f.attributes.filter((_, i) => i !== idx) }))}
                    style={{ justifyContent: 'center', paddingTop: 22 }}
                  >
                    <X size={16} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              onPress={() => setVariantForm((f) => ({ ...f, attributes: [...f.attributes, { key: '', value: '' }] }))}
              style={[variantStyles.addAttrBtn, { borderColor: colors.primary }]}
            >
              <Plus size={14} color={colors.primary} />
              <Text style={[variantStyles.addAttrText, { color: colors.primary }]}>{t('stock.addAttribute')}</Text>
            </TouchableOpacity>

            <FormField
              label={t('stock.variantSku')}
              value={variantForm.sku}
              onChangeText={(v) => setVariantForm((f) => ({ ...f, sku: v }))}
              placeholder="SKU-001-XL"
            />

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <FormField
                  label={t('stock.variantPurchasePrice')}
                  value={variantForm.purchasePrice}
                  onChangeText={(v) => setVariantForm((f) => ({ ...f, purchasePrice: v }))}
                  placeholder="0.00" keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formCol}>
                {/* Prix TTC — converti en HT à l'enregistrement */}
                <FormField
                  label={t('stock.variantSalePrice')}
                  value={variantForm.salePrice}
                  onChangeText={(v) => setVariantForm((f) => ({ ...f, salePrice: v }))}
                  placeholder="0.00" keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <FormField
                  label={t('stock.variantStock')}
                  value={variantForm.stock}
                  onChangeText={(v) => setVariantForm((f) => ({ ...f, stock: v }))}
                  placeholder="0" keyboardType="numeric"
                />
              </View>
              <View style={styles.formCol}>
                <FormField
                  label={t('stock.variantMinStock')}
                  value={variantForm.minStock}
                  onChangeText={(v) => setVariantForm((f) => ({ ...f, minStock: v }))}
                  placeholder="0" keyboardType="numeric"
                />
              </View>
            </View>
          </ScrollView>

          <View style={[stepStyles.formFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[stepStyles.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>
                {t('stock.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]}
              onPress={onSave}
            >
              <Text style={stepStyles.nextBtnText}>
                {editingVariantId ? t('stock.update') : t('stock.addVariant')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}