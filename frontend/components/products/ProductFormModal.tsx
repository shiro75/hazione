/**
 * components/products/ProductFormModal.tsx
 * Modale multi-étapes de création / édition produit.
 * Orchestre les 4 étapes (Step1–Step4) et la barre de navigation.
 * Ne contient aucune logique métier : tout transite par les props.
 */

import React from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import {
  ChevronLeft, ChevronRight, Check, X, Archive, Trash2, Eye, EyeOff, Copy,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { stepStyles, detailStyles, styles } from '@/components/products/productsStyles';
import Step1General from './steps/Step1General';
import Step2Attributes from './steps/Step2Attributes';
import Step3Variants from './steps/Step3Variants';
import Step4Recipe from './steps/Step4Recipe';
import type { FormStep, VariantDraft } from '@/types/product.types';
import type { Product, ProductVariant } from '@/types';
import type { EMPTY_FORM } from '@/types/product.types';

const modalOverlay = {
  flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center' as const, alignItems: 'center' as const,
};

interface ProductFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingId: string | null;
  form: typeof EMPTY_FORM;
  updateField: <K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) => void;
  formError: string;
  formStep: FormStep;
  isTransformedType: boolean;
  duplicateProduct: Product | null;
  onOpenEdit: (id: string) => void;
  // Step nav
  handleNextStep: (isTransformedType: boolean) => void;
  handlePrevStep: () => void;
  handleFinalSubmit: () => void;
  handleQuickSave: () => void;
  handleDuplicateProduct: () => void;
  // Step2
  selectedAttrIds: string[];
  setSelectedAttrIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedAttrValues: Record<string, string[]>;
  setSelectedAttrValues: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  productAttributes: { id: string; name: string; values: string[] }[];
  addProductAttribute: (name: string, values: string[]) => void;
  addAttributeValue: (attrId: string, value: string) => void;
  // Step3
  variantDrafts: VariantDraft[];
  setVariantDrafts: React.Dispatch<React.SetStateAction<VariantDraft[]>>;
  bulkPurchasePrice: string;
  setBulkPurchasePrice: (v: string) => void;
  bulkSalePrice: string;
  setBulkSalePrice: (v: string) => void;
  applyBulkPrices: () => void;
  // Step4
  getVariantsForProduct: (id: string) => ProductVariant[];
  getRecipeForProduct: (id: string, variantId?: string) => any;
  saveRecipe: (productId: string, items: any[], variantId?: string) => void;
  openRecipeEditor: (productId: string, name: string, variantId?: string, label?: string) => void;
  getOrderedVariants: (variants: ProductVariant[]) => ProductVariant[];
  showToast: (msg: string) => void;
  // Step1 selects
  categoryOptions: { label: string; value: string }[];
  brandOptions: { label: string; value: string }[];
  unitOptions: { label: string; value: string }[];
  vatOptions: { label: string; value: string }[];
  products: Product[];
  currency: string;
  addProductCategory: (v: string) => void;
  removeProductCategory: (v: string) => void;
  renameProductCategory: (o: string, n: string) => void;
  addProductBrand: (v: string) => void;
  removeProductBrand: (v: string) => void;
  renameProductBrand: (o: string, n: string) => void;
  addProductUnit: (v: string) => void;
  // Actions produit (header)
  archiveProduct: (id: string) => void;
  unarchiveProduct: (id: string) => void;
  deleteProduct: (id: string) => void;
  updateProduct: (id: string, data: Partial<Product>) => { success: boolean };
}

export default function ProductFormModal({
  visible, onClose, editingId, form, updateField, formError, formStep,
  isTransformedType, duplicateProduct, onOpenEdit,
  handleNextStep, handlePrevStep, handleFinalSubmit, handleQuickSave, handleDuplicateProduct,
  selectedAttrIds, setSelectedAttrIds, selectedAttrValues, setSelectedAttrValues,
  productAttributes, addProductAttribute, addAttributeValue,
  variantDrafts, setVariantDrafts,
  bulkPurchasePrice, setBulkPurchasePrice, bulkSalePrice, setBulkSalePrice, applyBulkPrices,
  getVariantsForProduct, getRecipeForProduct, saveRecipe, openRecipeEditor, getOrderedVariants, showToast,
  categoryOptions, brandOptions, unitOptions, vatOptions, products, currency,
  addProductCategory, removeProductCategory, renameProductCategory,
  addProductBrand, removeProductBrand, renameProductBrand, addProductUnit,
  archiveProduct, unarchiveProduct, deleteProduct, updateProduct,
}: ProductFormModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (!visible) return null;

  const stepsToShow = isTransformedType ? [1, 2, 3, 4] : [1, 2, 3];
  const stepLabels: Record<number, string> = {
    1: 'Infos', 2: 'Attributs', 3: 'Variantes', 4: t('recipe.title'),
  };
  const isLastStep = isTransformedType ? formStep === 4 : formStep === 3;
  const editProduct = editingId ? products.find((p) => p.id === editingId) : null;
  const isAvailable = editProduct?.isAvailableForSale !== false;

  const stepTitle =
    formStep === 1 ? t('stock.step1Title')
    : formStep === 2 ? t('stock.step2Title')
    : formStep === 3 ? t('stock.step3Title')
    : t('recipe.step4Title');

  const productVariantsForRecipe = editingId ? getVariantsForProduct(editingId) : [];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalOverlay} onPress={onClose}>
        <Pressable
          style={[detailStyles.modal, {
            backgroundColor: colors.card,
            width: isMobile ? width - 16 : 540,
            maxHeight: isMobile ? '95%' as any : '90%' as any,
          }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
            <Text style={[detailStyles.headerTitle, { color: colors.text, flex: 1 }]}>
              {stepTitle}
            </Text>
            {editProduct && (
              <>
                <TouchableOpacity
                  onPress={handleDuplicateProduct}
                  style={[detailStyles.editBtn, { backgroundColor: '#E8F5E9' }]}
                  hitSlop={8}
                >
                  <Copy size={14} color="#2E7D32" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateProduct(editingId!, { isAvailableForSale: !isAvailable } as any)}
                  style={[detailStyles.editBtn, { backgroundColor: isAvailable ? colors.successLight : colors.dangerLight }]}
                  hitSlop={8}
                >
                  {isAvailable ? <Eye size={14} color={colors.success} /> : <EyeOff size={14} color={colors.danger} />}
                </TouchableOpacity>
                {editProduct.isArchived || !editProduct.isActive ? (
                  <TouchableOpacity
                    onPress={() => { unarchiveProduct(editingId!); onClose(); }}
                    style={[detailStyles.editBtn, { backgroundColor: colors.successLight }]}
                    hitSlop={8}
                  >
                    <Archive size={14} color={colors.success} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => { archiveProduct(editingId!); onClose(); }}
                    style={[detailStyles.editBtn, { backgroundColor: colors.warningLight || '#FEF3C7' }]}
                    hitSlop={8}
                  >
                    <Archive size={14} color={colors.warning || '#D97706'} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    confirm('Supprimer', `Supprimer définitivement « ${editProduct.name} » et toutes ses variantes ?`, [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: () => { deleteProduct(editingId!); onClose(); } },
                    ]);
                  }}
                  style={[detailStyles.editBtn, { backgroundColor: colors.dangerLight }]}
                  hitSlop={8}
                >
                  <Trash2 size={14} color={colors.danger} />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={stepStyles.container}>
            {stepsToShow.map((step) => (
              <View key={step} style={stepStyles.stepRow}>
                <View style={[stepStyles.stepCircle, {
                  backgroundColor: formStep >= step ? colors.primary : colors.surfaceHover,
                  borderColor: formStep >= step ? colors.primary : colors.border,
                }]}>
                  {formStep > step
                    ? <Check size={12} color="#FFF" />
                    : <Text style={[stepStyles.stepNumber, { color: formStep >= step ? '#FFF' : colors.textTertiary }]}>{step}</Text>
                  }
                </View>
                <Text style={[stepStyles.stepLabel, { color: formStep >= step ? colors.text : colors.textTertiary }]}>
                  {stepLabels[step]}
                </Text>
                {step < stepsToShow[stepsToShow.length - 1] && (
                  <View style={[stepStyles.stepLine, { backgroundColor: formStep > step ? colors.primary : colors.border }]} />
                )}
              </View>
            ))}
          </View>

          {formError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight, marginHorizontal: 16, marginTop: 8 }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
            </View>
          ) : null}

          {/* Steps */}
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, minHeight: 0 }}>
            {formStep === 1 && (
              <Step1General
                form={form} updateField={updateField}
                duplicateProduct={duplicateProduct} onOpenEdit={onOpenEdit}
                currency={currency} categoryOptions={categoryOptions}
                brandOptions={brandOptions} unitOptions={unitOptions}
                vatOptions={vatOptions} products={products}
                addProductCategory={addProductCategory} removeProductCategory={removeProductCategory}
                renameProductCategory={renameProductCategory} addProductBrand={addProductBrand}
                removeProductBrand={removeProductBrand} renameProductBrand={renameProductBrand}
                addProductUnit={addProductUnit}
              />
            )}
            {formStep === 2 && (
              <Step2Attributes
                productAttributes={productAttributes}
                selectedAttrIds={selectedAttrIds} setSelectedAttrIds={setSelectedAttrIds}
                selectedAttrValues={selectedAttrValues} setSelectedAttrValues={setSelectedAttrValues}
                addProductAttribute={addProductAttribute} addAttributeValue={addAttributeValue}
              />
            )}
            {formStep === 3 && (
              <Step3Variants
                form={form} updateField={updateField}
                variantDrafts={variantDrafts} setVariantDrafts={setVariantDrafts}
                bulkPurchasePrice={bulkPurchasePrice} setBulkPurchasePrice={setBulkPurchasePrice}
                bulkSalePrice={bulkSalePrice} setBulkSalePrice={setBulkSalePrice}
                applyBulkPrices={applyBulkPrices} currency={currency}
              />
            )}
            {formStep === 4 && (
              <Step4Recipe
                productId={editingId} productName={form.name}
                productVariants={productVariantsForRecipe}
                getRecipeForProduct={getRecipeForProduct} saveRecipe={saveRecipe}
                openRecipeEditor={openRecipeEditor} getOrderedVariants={getOrderedVariants}
                showToast={showToast}
              />
            )}
          </View>

          {/* Footer navigation */}
          <View style={[stepStyles.formFooter, { borderTopColor: colors.border }]}>
            {formStep > 1 ? (
              <TouchableOpacity style={[stepStyles.cancelBtn, { borderColor: colors.border }]} onPress={handlePrevStep}>
                <ChevronLeft size={14} color={colors.textSecondary} />
                <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>{t('stock.back')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[stepStyles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
                <Text style={[stepStyles.cancelBtnText, { color: colors.textSecondary }]}>{t('stock.cancel')}</Text>
              </TouchableOpacity>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(formStep === 1 || formStep === 2) && (
                <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.success }]} onPress={handleQuickSave}>
                  <Check size={14} color="#FFF" />
                  <Text style={stepStyles.nextBtnText}>{t('stock.save')}</Text>
                </TouchableOpacity>
              )}
              {isLastStep ? (
                <TouchableOpacity style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleFinalSubmit}>
                  <Check size={14} color="#FFF" />
                  <Text style={stepStyles.nextBtnText}>{editingId ? t('stock.update') : t('stock.create')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[stepStyles.nextBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleNextStep(isTransformedType)}
                >
                  <Text style={stepStyles.nextBtnText}>{t('stock.next')}</Text>
                  <ChevronRight size={14} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}