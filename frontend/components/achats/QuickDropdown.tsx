/**
 * components/achats/QuickDropdown.tsx
 * Dropdown générique léger utilisé dans CommandesSection
 * pour les sélecteurs type/catégorie/TVA lors de la création rapide de produit.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { ChevronDown, Search, Check } from 'lucide-react-native';
import { styles } from './achatsStyles';

interface QuickDropdownProps {
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  colors: any;
  placeholder?: string;
  allowCustom?: boolean;
  customValue?: string;
  onCustomChange?: (v: string) => void;
}

export default function QuickDropdown({
  options, selectedValue, onSelect, isOpen, onToggle, colors,
  placeholder, allowCustom, customValue, onCustomChange,
}: QuickDropdownProps) {
  const selectedLabel = options.find((o) => o.value === selectedValue)?.label
    || (allowCustom && customValue ? customValue : '');

  return (
    <View style={{ gap: 4 }}>
      <TouchableOpacity
        style={[styles.productSelectBtn, { backgroundColor: colors.inputBg, borderColor: selectedValue ? colors.primary : colors.inputBorder }]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.productSelectText, { color: selectedLabel ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {selectedLabel || placeholder || 'Sélectionner...'}
        </Text>
        <ChevronDown size={14} color={colors.textTertiary} />
      </TouchableOpacity>

      {isOpen ? (
        <View style={[styles.productDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {allowCustom ? (
            <View style={[styles.productDropdownSearch, { borderBottomColor: colors.borderLight }]}>
              <Search size={14} color={colors.textTertiary} />
              <TextInput
                style={[styles.productDropdownSearchInput, { color: colors.text }]}
                placeholder="Saisir ou sélectionner..."
                placeholderTextColor={colors.textTertiary}
                value={customValue || ''}
                onChangeText={onCustomChange}
              />
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.productDropdownItem,
                  { borderBottomColor: colors.borderLight },
                  selectedValue === opt.value && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => onSelect(opt.value)}
              >
                <Text style={[styles.productDropdownName, { color: colors.text }]}>{opt.label}</Text>
                {selectedValue === opt.value ? <Check size={14} color={colors.primary} /> : null}
              </TouchableOpacity>
            ))}
            {options.length === 0 ? (
              <Text style={[styles.productDropdownEmpty, { color: colors.textTertiary }]}>Aucune option</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}