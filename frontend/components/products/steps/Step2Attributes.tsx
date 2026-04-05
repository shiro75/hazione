/**
 * components/products/steps/Step2Attributes.tsx
 * Étape 2 : sélection des attributs de variantes (Taille, Couleur…).
 * Permet aussi de créer de nouveaux attributs et d'ajouter des valeurs à la volée.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Check, Plus, X, Tags } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { stepStyles, step2Styles } from '@/components/products/productsStyles';

interface Attribute {
  id: string;
  name: string;
  values: string[];
}

interface Step2AttributesProps {
  productAttributes: Attribute[];
  selectedAttrIds: string[];
  setSelectedAttrIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedAttrValues: Record<string, string[]>;
  setSelectedAttrValues: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  addProductAttribute: (name: string, values: string[]) => void;
  addAttributeValue: (attrId: string, value: string) => void;
}

export default function Step2Attributes({
  productAttributes,
  selectedAttrIds,
  setSelectedAttrIds,
  selectedAttrValues,
  setSelectedAttrValues,
  addProductAttribute,
  addAttributeValue,
}: Step2AttributesProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [newInlineAttrName, setNewInlineAttrName] = useState('');
  const [newInlineAttrValues, setNewInlineAttrValues] = useState('');
  const [showInlineNewAttr, setShowInlineNewAttr] = useState(false);
  const [inlineAddValueAttrId, setInlineAddValueAttrId] = useState<string | null>(null);
  const [inlineNewValue, setInlineNewValue] = useState('');

  const toggleAttr = (attrId: string) => {
    if (selectedAttrIds.includes(attrId)) {
      setSelectedAttrIds((prev) => prev.filter((id) => id !== attrId));
      setSelectedAttrValues((prev) => { const n = { ...prev }; delete n[attrId]; return n; });
    } else {
      setSelectedAttrIds((prev) => [...prev, attrId]);
    }
  };

  const toggleValue = (attrId: string, val: string) => {
    setSelectedAttrValues((prev) => {
      const curr = prev[attrId] || [];
      const next = curr.includes(val) ? curr.filter((v) => v !== val) : [...curr, val];
      return { ...prev, [attrId]: next };
    });
  };

  const commitInlineValue = (attrId: string) => {
    if (inlineNewValue.trim()) {
      addAttributeValue(attrId, inlineNewValue.trim());
      setSelectedAttrValues((prev) => ({
        ...prev,
        [attrId]: [...(prev[attrId] || []), inlineNewValue.trim()],
      }));
      setInlineNewValue('');
    }
    setInlineAddValueAttrId(null);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 16, paddingBottom: 20 }}
    >
      <Text style={[stepStyles.sectionTitle, { color: colors.text }]}>
        {t('stock.selectAttributes')}
      </Text>
      <Text style={[stepStyles.sectionHint, { color: colors.textSecondary }]}>
        {t('stock.attributesStepHint')}
      </Text>

      {productAttributes.map((attr) => {
        const isSelected = selectedAttrIds.includes(attr.id);
        const selectedVals = selectedAttrValues[attr.id] || [];
        return (
          <View
            key={attr.id}
            style={[stepStyles.attrCard, {
              backgroundColor: colors.card,
              borderColor: isSelected ? colors.primary : colors.cardBorder,
            }]}
          >
            <TouchableOpacity
              style={stepStyles.attrHeader}
              onPress={() => toggleAttr(attr.id)}
              activeOpacity={0.7}
            >
              <View style={[stepStyles.checkbox, {
                backgroundColor: isSelected ? colors.primary : 'transparent',
                borderColor: isSelected ? colors.primary : colors.border,
              }]}>
                {isSelected && <Check size={12} color="#FFF" />}
              </View>
              <Text style={[stepStyles.attrName, { color: colors.text }]}>{attr.name}</Text>
              <Text style={[stepStyles.attrCount, { color: colors.textTertiary }]}>
                {attr.values.length} valeurs
              </Text>
            </TouchableOpacity>

            {isSelected && (
              <View style={stepStyles.attrValues}>
                {attr.values.map((val, idx) => {
                  const isValSelected = selectedVals.includes(val);
                  return (
                    <TouchableOpacity
                      key={`${attr.id}_${val}_${idx}`}
                      style={[stepStyles.valueChip, {
                        backgroundColor: isValSelected ? `${colors.primary}15` : colors.surfaceHover,
                        borderColor: isValSelected ? colors.primary : colors.border,
                      }]}
                      onPress={() => toggleValue(attr.id, val)}
                      activeOpacity={0.7}
                    >
                      {isValSelected && <Check size={10} color={colors.primary} />}
                      <Text style={[stepStyles.valueChipText, {
                        color: isValSelected ? colors.primary : colors.textSecondary,
                      }]}>{val}</Text>
                    </TouchableOpacity>
                  );
                })}

                {inlineAddValueAttrId === attr.id ? (
                  <View style={step2Styles.inlineAddRow}>
                    <TextInput
                      style={[step2Styles.inlineInput, {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      }]}
                      value={inlineNewValue}
                      onChangeText={setInlineNewValue}
                      placeholder="Valeur..."
                      placeholderTextColor={colors.textTertiary}
                      autoFocus
                      onSubmitEditing={() => { addAttributeValue(attr.id, inlineNewValue.trim()); setInlineNewValue(''); }}
                    />
                    <TouchableOpacity
                      onPress={() => commitInlineValue(attr.id)}
                      style={[step2Styles.inlineAddBtn, { backgroundColor: colors.primary }]}
                    >
                      <Check size={12} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setInlineAddValueAttrId(null); setInlineNewValue(''); }}>
                      <X size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[step2Styles.addValueBtn, { borderColor: colors.primary }]}
                    onPress={() => { setInlineAddValueAttrId(attr.id); setInlineNewValue(''); }}
                  >
                    <Plus size={10} color={colors.primary} />
                    <Text style={[step2Styles.addValueBtnText, { color: colors.primary }]}>Valeur</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      {showInlineNewAttr ? (
        <View style={[step2Styles.newAttrCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={[step2Styles.newAttrTitle, { color: colors.text }]}>{t('stock.newAttribute')}</Text>
          <TextInput
            style={[step2Styles.newAttrInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={newInlineAttrName}
            onChangeText={setNewInlineAttrName}
            placeholder={t('stock.newAttributeName')}
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />
          <TextInput
            style={[step2Styles.newAttrInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={newInlineAttrValues}
            onChangeText={setNewInlineAttrValues}
            placeholder={t('stock.newAttributeValues')}
            placeholderTextColor={colors.textTertiary}
          />
          <View style={step2Styles.newAttrActions}>
            <TouchableOpacity
              style={[step2Styles.newAttrCancel, { borderColor: colors.border }]}
              onPress={() => { setShowInlineNewAttr(false); setNewInlineAttrName(''); setNewInlineAttrValues(''); }}
            >
              <Text style={[step2Styles.newAttrCancelText, { color: colors.textSecondary }]}>
                {t('stock.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[step2Styles.newAttrSubmit, { backgroundColor: colors.primary, opacity: newInlineAttrName.trim() ? 1 : 0.5 }]}
              onPress={() => {
                if (!newInlineAttrName.trim()) return;
                addProductAttribute(newInlineAttrName.trim(), newInlineAttrValues.split(',').map((v) => v.trim()).filter(Boolean));
                setNewInlineAttrName(''); setNewInlineAttrValues(''); setShowInlineNewAttr(false);
              }}
              disabled={!newInlineAttrName.trim()}
            >
              <Plus size={14} color="#FFF" />
              <Text style={step2Styles.newAttrSubmitText}>{t('stock.createAttribute')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[step2Styles.addAttrBtn, { borderColor: colors.primary }]}
          onPress={() => setShowInlineNewAttr(true)}
          activeOpacity={0.7}
        >
          <Plus size={14} color={colors.primary} />
          <Text style={[step2Styles.addAttrBtnText, { color: colors.primary }]}>{t('stock.newAttribute')}</Text>
        </TouchableOpacity>
      )}

      {productAttributes.length === 0 && !showInlineNewAttr && (
        <View style={[stepStyles.emptyAttrs, { backgroundColor: colors.surfaceHover }]}>
          <Tags size={24} color={colors.textTertiary} />
          <Text style={[stepStyles.emptyText, { color: colors.textSecondary }]}>
            {t('stock.noAttributesHint')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}