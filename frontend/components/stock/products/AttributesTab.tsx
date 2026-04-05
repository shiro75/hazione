/**
 * components/products/AttributesTab.tsx
 * Onglet de gestion des groupes d'attributs globaux (Taille, Couleur…).
 * CRUD : création de groupe, renommage, suppression, ajout/suppression/réordonnancement de valeurs.
 * Le réordonnancement utilise des boutons ◀ ▶ (pas de drag-and-drop, incompatible avec ScrollView).
 */

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Tags, Pencil, Trash2, Plus, Check, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { attrMgmtStyles } from '@/components/stock/products/productsStyles';

interface Attribute {
  id: string;
  name: string;
  values: string[];
}

interface AttributesTabProps {
  productAttributes: Attribute[];
  addProductAttribute: (name: string, values: string[]) => void;
  updateProductAttribute: (id: string, data: { name?: string }) => void;
  deleteProductAttribute: (id: string) => void;
  addAttributeValue: (attrId: string, value: string) => void;
  removeAttributeValue: (attrId: string, value: string) => void;
  updateAttributeValuesOrder: (attrId: string, newValues: string[]) => void;
}

export default function AttributesTab({
  productAttributes,
  addProductAttribute, updateProductAttribute, deleteProductAttribute,
  addAttributeValue, removeAttributeValue, updateAttributeValuesOrder,
}: AttributesTabProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { confirm } = useConfirm();

  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValues, setNewValues] = useState('');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [editingValueAttrId, setEditingValueAttrId] = useState<string | null>(null);
  const [newValueInput, setNewValueInput] = useState('');

  const moveLeft = useCallback((attrId: string, index: number) => {
    if (index === 0) return;
    const attr = productAttributes.find((a) => a.id === attrId);
    if (!attr) return;
    const vals = [...attr.values];
    [vals[index - 1], vals[index]] = [vals[index], vals[index - 1]];
    updateAttributeValuesOrder(attrId, vals);
  }, [productAttributes, updateAttributeValuesOrder]);

  const moveRight = useCallback((attrId: string, index: number) => {
    const attr = productAttributes.find((a) => a.id === attrId);
    if (!attr || index >= attr.values.length - 1) return;
    const vals = [...attr.values];
    [vals[index], vals[index + 1]] = [vals[index + 1], vals[index]];
    updateAttributeValuesOrder(attrId, vals);
  }, [productAttributes, updateAttributeValuesOrder]);

  const commitRename = (attrId: string) => {
    if (renameValue.trim()) updateProductAttribute(attrId, { name: renameValue.trim() });
    setRenamingId(null);
    setRenameValue('');
  };

  const commitAddValue = (attrId: string) => {
    if (newValueInput.trim()) addAttributeValue(attrId, newValueInput.trim());
    setNewValueInput('');
    setEditingValueAttrId(null);
  };

  return (
    <View style={{ gap: 16 }}>
      {productAttributes.length === 0 && !showNewForm ? (
        <View style={attrMgmtStyles.empty}>
          <Tags size={32} color={colors.textTertiary} />
          <Text style={[attrMgmtStyles.emptyText, { color: colors.textSecondary }]}>{t('stock.noAttributes')}</Text>
          <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginTop: 4 }}>
            {t('stock.noAttributesHint')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {productAttributes.map((attr) => (
            <View
              key={attr.id}
              style={[attrMgmtStyles.attrCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              {/* En-tête : nom, renommer, supprimer */}
              <View style={attrMgmtStyles.attrHeader}>
                <Tags size={14} color={colors.primary} />

                {renamingId === attr.id ? (
                  <View style={attrMgmtStyles.renameRow}>
                    <TextInput
                      style={[attrMgmtStyles.renameInput, { backgroundColor: colors.inputBg, borderColor: colors.primary, color: colors.text }]}
                      value={renameValue}
                      onChangeText={setRenameValue}
                      autoFocus
                      onSubmitEditing={() => commitRename(attr.id)}
                    />
                    <TouchableOpacity
                      onPress={() => commitRename(attr.id)}
                      style={[attrMgmtStyles.renameConfirmBtn, { backgroundColor: colors.primary }]}
                    >
                      <Check size={12} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setRenamingId(null); setRenameValue(''); }}>
                      <X size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => { setRenamingId(attr.id); setRenameValue(attr.name); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[attrMgmtStyles.attrName, { color: colors.text }]}>{attr.name}</Text>
                  </TouchableOpacity>
                )}

                <Text style={[attrMgmtStyles.attrCount, { color: colors.textTertiary }]}>
                  {attr.values.length} valeur{attr.values.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  onPress={() => { setRenamingId(attr.id); setRenameValue(attr.name); }}
                  style={[attrMgmtStyles.editBtn, { backgroundColor: colors.primaryLight }]}
                  hitSlop={8}
                >
                  <Pencil size={12} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    confirm(
                      t('stock.deleteAttribute'),
                      t('stock.deleteAttributeConfirm', { name: attr.name }),
                      [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Supprimer', style: 'destructive', onPress: () => deleteProductAttribute(attr.id) },
                      ],
                    );
                  }}
                  style={[attrMgmtStyles.deleteBtn, { backgroundColor: colors.dangerLight }]}
                  hitSlop={8}
                >
                  <Trash2 size={12} color={colors.danger} />
                </TouchableOpacity>
              </View>

              {/* Valeurs avec boutons de réordonnancement */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={attrMgmtStyles.valuesRow}>
                {attr.values.map((item, index) => (
                  <View
                    key={`${attr.id}_${item}_${index}`}
                    style={[attrMgmtStyles.valueChip, {
                      backgroundColor: `${colors.primary}10`,
                      borderColor: `${colors.primary}30`,
                    }]}
                  >
                    <TouchableOpacity
                      onPress={() => moveLeft(attr.id, index)}
                      disabled={index === 0}
                      hitSlop={4}
                      style={[attrMgmtStyles.reorderBtn, { opacity: index === 0 ? 0.25 : 1 }]}
                    >
                      <ChevronLeft size={12} color={colors.primary} />
                    </TouchableOpacity>

                    <Text style={[attrMgmtStyles.valueText, { color: colors.text }]}>{item}</Text>

                    <TouchableOpacity
                      onPress={() => moveRight(attr.id, index)}
                      disabled={index === attr.values.length - 1}
                      hitSlop={4}
                      style={[attrMgmtStyles.reorderBtn, { opacity: index === attr.values.length - 1 ? 0.25 : 1 }]}
                    >
                      <ChevronRight size={12} color={colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => removeAttributeValue(attr.id, item)}
                      hitSlop={4}
                      style={attrMgmtStyles.removeBtn}
                    >
                      <X size={11} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              {/* Ajout inline d'une valeur */}
              {editingValueAttrId === attr.id ? (
                <View style={attrMgmtStyles.inlineAddRow}>
                  <TextInput
                    style={[attrMgmtStyles.inlineInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                    value={newValueInput}
                    onChangeText={setNewValueInput}
                    placeholder={t('stock.selectValue')}
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                    onSubmitEditing={() => { addAttributeValue(attr.id, newValueInput.trim()); setNewValueInput(''); }}
                  />
                  <TouchableOpacity
                    onPress={() => commitAddValue(attr.id)}
                    style={[attrMgmtStyles.inlineAddBtnSmall, { backgroundColor: colors.primary }]}
                  >
                    <Check size={12} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditingValueAttrId(null); setNewValueInput(''); }}>
                    <X size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[attrMgmtStyles.addValueBtnSmall, { borderColor: colors.primary }]}
                  onPress={() => { setEditingValueAttrId(attr.id); setNewValueInput(''); }}
                >
                  <Plus size={12} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Formulaire de création d'un nouveau groupe */}
      {showNewForm ? (
        <View style={[attrMgmtStyles.newGroupCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={[attrMgmtStyles.newGroupTitle, { color: colors.text }]}>{t('stock.newAttributeGroup')}</Text>
          <TextInput
            style={[attrMgmtStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={newName}
            onChangeText={setNewName}
            placeholder={t('stock.attributeGroupName')}
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />
          <TextInput
            style={[attrMgmtStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={newValues}
            onChangeText={setNewValues}
            placeholder="Valeurs séparées par des virgules (ex: S, M, L, XL)"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={attrMgmtStyles.newGroupActions}>
            <TouchableOpacity
              style={[attrMgmtStyles.newGroupCancelBtn, { borderColor: colors.border }]}
              onPress={() => { setShowNewForm(false); setNewName(''); setNewValues(''); }}
            >
              <Text style={[attrMgmtStyles.newGroupCancelText, { color: colors.textSecondary }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[attrMgmtStyles.newGroupSubmitBtn, { backgroundColor: colors.primary, opacity: newName.trim() ? 1 : 0.5 }]}
              onPress={() => {
                if (!newName.trim()) return;
                addProductAttribute(newName.trim(), newValues.split(',').map((v) => v.trim()).filter(Boolean));
                setNewName(''); setNewValues(''); setShowNewForm(false);
              }}
              disabled={!newName.trim()}
            >
              <Check size={14} color="#FFF" />
              <Text style={attrMgmtStyles.newGroupSubmitText}>Créer le groupe</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[attrMgmtStyles.addGroupBtn, { borderColor: colors.primary }]}
          onPress={() => setShowNewForm(true)}
          activeOpacity={0.7}
        >
          <Plus size={16} color={colors.primary} />
          <Text style={[attrMgmtStyles.addGroupBtnText, { color: colors.primary }]}>
            Ajouter un groupe d'attributs
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}