/**
 * @fileoverview Generic dropdown picker with search, inline editing, and add-new option.
 * Supports single-select with optional item rename/delete for categories, brands, etc.
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, Platform, Alert, Modal, Pressable,
} from 'react-native';
import { ChevronDown, ChevronUp, Check, Plus, Search, Pencil, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface DropdownPickerProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  onAddNew?: (value: string) => void;
  addLabel?: string;
  onRenameItem?: (oldValue: string, newValue: string) => void;
  onDeleteItem?: (value: string) => void;
  getDeleteWarning?: (value: string) => string | null;
  compact?: boolean;
}

export default React.memo(function DropdownPicker({
  label, value, options, onSelect,
  placeholder = 'Sélectionner...', required = false,
  onAddNew, addLabel = 'Ajouter',
  onRenameItem, onDeleteItem, getDeleteWarning,
  compact = false,
}: DropdownPickerProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const triggerRef = useRef<View>(null);
  const [triggerLayout, setTriggerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found ? found.label : '';
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) return options;
    const q = searchText.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, searchText]);

  const showAddNew = useMemo(() => {
    if (!onAddNew || !searchText.trim()) return false;
    const q = searchText.trim().toLowerCase();
    return !options.some((o) => o.label.toLowerCase() === q);
  }, [onAddNew, searchText, options]);

  const handleSelect = useCallback((val: string) => {
    if (editingValue) return;
    onSelect(val);
    setVisible(false);
    setSearchText('');
  }, [onSelect, editingValue]);

  const handleAddNew = useCallback(() => {
    const trimmed = searchText.trim();
    if (!trimmed || !onAddNew) return;
    onAddNew(trimmed);
    onSelect(trimmed);
    setSearchText('');
    setVisible(false);
  }, [searchText, onAddNew, onSelect]);

  const handleToggle = useCallback(() => {
    if (!visible && triggerRef.current) {
      triggerRef.current.measureInWindow((x, y, width, height) => {
        setTriggerLayout({ x, y, width, height });
        setVisible(true);
      });
    } else {
      setVisible(false);
      setSearchText('');
      setEditingValue(null);
    }
  }, [visible]);

  const startRename = useCallback((itemValue: string, itemLabel: string) => {
    setEditingValue(itemValue);
    setEditText(itemLabel);
  }, []);

  const confirmRename = useCallback(() => {
    if (!editingValue || !onRenameItem) return;
    const trimmed = editText.trim();
    if (trimmed && trimmed !== editingValue) {
      onRenameItem(editingValue, trimmed);
      if (value === editingValue) {
        onSelect(trimmed);
      }
    }
    setEditingValue(null);
    setEditText('');
  }, [editingValue, editText, onRenameItem, value, onSelect]);

  const cancelRename = useCallback(() => {
    setEditingValue(null);
    setEditText('');
  }, []);

  const handleDelete = useCallback((itemValue: string) => {
    if (!onDeleteItem) return;
    const warning = getDeleteWarning?.(itemValue);
    if (warning) {
      Alert.alert(
        'Supprimer',
        warning,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer', style: 'destructive', onPress: () => {
              onDeleteItem(itemValue);
              if (value === itemValue) {
                onSelect('');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Supprimer',
        `Supprimer "${itemValue}" ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer', style: 'destructive', onPress: () => {
              onDeleteItem(itemValue);
              if (value === itemValue) {
                onSelect('');
              }
            },
          },
        ]
      );
    }
  }, [onDeleteItem, getDeleteWarning, value, onSelect]);

  const hasActions = !!onRenameItem || !!onDeleteItem;

  return (
    <View style={[styles.wrapper, compact && { gap: 0 }]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}{required ? ' *' : ''}
        </Text>
      ) : null}
      <TouchableOpacity
        ref={triggerRef as React.RefObject<View>}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.inputBg,
            borderColor: visible ? colors.primary : colors.inputBorder,
          },
          compact && styles.triggerCompact,
        ]}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.triggerText, { color: selectedLabel ? colors.text : colors.textTertiary }, compact && { fontSize: 12 }]}
          numberOfLines={1}
        >
          {selectedLabel || placeholder}
        </Text>
        {visible ? (
          <ChevronUp size={compact ? 13 : 16} color={colors.primary} />
        ) : (
          <ChevronDown size={compact ? 13 : 16} color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      {visible && (
        <Modal visible transparent animationType="none" onRequestClose={() => { setVisible(false); setSearchText(''); setEditingValue(null); }}>
          <Pressable style={styles.modalBackdrop} onPress={() => { setVisible(false); setSearchText(''); setEditingValue(null); }}>
            <View
              style={[
                styles.dropdown,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary + '40',
                  ...(Platform.OS === 'web'
                    ? { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }
                    : {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 16,
                        elevation: 8,
                      }),
                  ...(triggerLayout ? {
                    position: 'absolute' as const,
                    top: triggerLayout.y + triggerLayout.height + 4,
                    left: triggerLayout.x,
                    width: Math.max(triggerLayout.width, 200),
                  } : {}),
                },
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View style={[styles.searchRow, { borderBottomColor: colors.borderLight }]}>
                  <Search size={14} color={colors.textTertiary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Rechercher..."
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                  />
                </View>
                <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredOptions.map((item) => {
                    const isSelected = item.value === value;
                    const isEditing = editingValue === item.value;

                    if (isEditing) {
                      return (
                        <View
                          key={item.value}
                          style={[styles.editRow, { borderBottomColor: colors.borderLight, backgroundColor: colors.primaryLight }]}
                        >
                          <TextInput
                            style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.primary }]}
                            value={editText}
                            onChangeText={setEditText}
                            autoFocus
                            onSubmitEditing={confirmRename}
                            selectTextOnFocus
                          />
                          <TouchableOpacity
                            style={[styles.editAction, { backgroundColor: colors.primary }]}
                            onPress={confirmRename}
                            activeOpacity={0.7}
                          >
                            <Check size={12} color="#FFF" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.editAction, { backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.border }]}
                            onPress={cancelRename}
                            activeOpacity={0.7}
                          >
                            <X size={12} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.option,
                          { borderBottomColor: colors.borderLight },
                          isSelected && { backgroundColor: colors.primaryLight },
                        ]}
                        onPress={() => handleSelect(item.value)}
                        activeOpacity={0.6}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            { color: isSelected ? colors.primary : colors.text },
                            isSelected && { fontWeight: '600' as const },
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        <View style={styles.optionActions}>
                          {isSelected && !hasActions && <Check size={14} color={colors.primary} />}
                          {hasActions && (
                            <>
                              {onRenameItem && (
                                <TouchableOpacity
                                  style={styles.actionBtn}
                                  onPress={() => startRename(item.value, item.label)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Pencil size={13} color={colors.textTertiary} />
                                </TouchableOpacity>
                              )}
                              {onDeleteItem && (
                                <TouchableOpacity
                                  style={styles.actionBtn}
                                  onPress={() => handleDelete(item.value)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Trash2 size={13} color={colors.danger} />
                                </TouchableOpacity>
                              )}
                              {isSelected && <Check size={14} color={colors.primary} />}
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {filteredOptions.length === 0 && !showAddNew && (
                    <View style={styles.emptyRow}>
                      <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Aucun résultat</Text>
                    </View>
                  )}
                  {showAddNew && (
                    <TouchableOpacity
                      style={[styles.addOption, { borderTopColor: colors.border }]}
                      onPress={handleAddNew}
                      activeOpacity={0.6}
                    >
                      <Plus size={14} color={colors.primary} />
                      <Text style={[styles.addOptionText, { color: colors.primary }]}>
                        {addLabel} "{searchText.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
                  {onAddNew && !showAddNew && filteredOptions.length > 0 && (
                    <TouchableOpacity
                      style={[styles.addOption, { borderTopColor: colors.border }]}
                      onPress={() => {
                        if (searchText.trim()) {
                          handleAddNew();
                        }
                      }}
                      activeOpacity={0.6}
                    >
                      <Plus size={14} color={colors.textTertiary} />
                      <Text style={[styles.addOptionText, { color: colors.textTertiary }]}>
                        {addLabel}...
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  modalBackdrop: { flex: 1 },
  label: { fontSize: 13, fontWeight: '500' as const },
  trigger: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, gap: 8,
  },
  triggerCompact: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, gap: 4,
  },
  triggerText: { fontSize: 14, flex: 1 },
  dropdown: {
    borderWidth: 1, borderRadius: 10, overflow: 'hidden' as const, maxWidth: 400,
  },
  searchRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1, fontSize: 13, paddingVertical: 2,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}),
  },
  list: { maxHeight: 200 },
  option: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const, paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1,
  },
  optionText: { fontSize: 13, flex: 1 },
  optionActions: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
  },
  actionBtn: {
    padding: 2,
  },
  editRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 10, paddingVertical: 6, gap: 6, borderBottomWidth: 1,
  },
  editInput: {
    flex: 1, fontSize: 13, borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}),
  },
  editAction: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  emptyRow: { padding: 16, alignItems: 'center' as const },
  emptyText: { fontSize: 13 },
  addOption: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1,
  },
  addOptionText: { fontSize: 13, fontWeight: '600' as const },
});
