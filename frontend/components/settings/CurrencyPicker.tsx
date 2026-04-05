/**
 * components/settings/CurrencyPicker.tsx
 * Dropdown de sélection de devise.
 * Réutilisable dans l'onglet Facturation des paramètres.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const CURRENCY_OPTIONS = [
  { label: 'EUR (€)', value: 'EUR' },
  { label: 'CHF (CHF)', value: 'CHF' },
  { label: 'USD ($)', value: 'USD' },
  { label: 'GBP (£)', value: 'GBP' },
  { label: 'CAD (CA$)', value: 'CAD' },
  { label: 'XOF (CFA)', value: 'XOF' },
];

interface CurrencyPickerProps {
  value: string;
  onSelect: (val: string) => void;
}

export default function CurrencyPicker({ value, onSelect }: CurrencyPickerProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const selected = CURRENCY_OPTIONS.find((o) => o.value === value);

  return (
    <View style={[pickerStyles.container, { zIndex: 10 }]}>
      <Text style={[pickerStyles.label, { color: colors.textSecondary }]}>Devise</Text>
      <TouchableOpacity
        style={[pickerStyles.selector, { backgroundColor: colors.inputBg, borderColor: visible ? colors.primary : colors.inputBorder }]}
        onPress={() => setVisible((p) => !p)}
        activeOpacity={0.7}
      >
        <Text style={[pickerStyles.selectorText, { color: colors.text }]}>
          {selected ? selected.label : value}
        </Text>
        <ChevronDown size={16} color={visible ? colors.primary : colors.textTertiary} />
      </TouchableOpacity>

      {visible && (
        <View style={[pickerStyles.dropdown, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
          {CURRENCY_OPTIONS.map((opt) => {
            const isActive = opt.value === value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  pickerStyles.option,
                  { borderBottomColor: colors.borderLight },
                  isActive && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => { onSelect(opt.value); setVisible(false); }}
                activeOpacity={0.7}
              >
                <Text style={[pickerStyles.optionText, { color: isActive ? colors.primary : colors.text }]}>
                  {opt.label}
                </Text>
                {isActive && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  container: { gap: 6, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500' },
  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
  },
  selectorText: { fontSize: 14, fontWeight: '500' },
  dropdown: {
    borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1,
  },
  optionText: { fontSize: 14, fontWeight: '500' },
});