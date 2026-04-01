/**
 * @fileoverview International phone number input field with country code picker.
 * Shows a dropdown of country codes with flags and auto-formats the phone number.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '@/constants/countryCodes';
import type { CountryCode } from '@/constants/countryCodes';

interface PhoneFormat {
  pattern: number[];
  totalDigits: number;
  leadingZero?: boolean;
}

const PHONE_FORMATS: Record<string, PhoneFormat> = {
  FR: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  RE: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  GP: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  MQ: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  GF: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  YT: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  BE: { pattern: [3, 2, 2, 2], totalDigits: 9, leadingZero: true },
  CH: { pattern: [2, 3, 2, 2], totalDigits: 9, leadingZero: true },
  LU: { pattern: [3, 3, 3], totalDigits: 9 },
  DE: { pattern: [4, 3, 3], totalDigits: 10, leadingZero: true },
  IT: { pattern: [3, 3, 4], totalDigits: 10 },
  ES: { pattern: [3, 2, 2, 2], totalDigits: 9 },
  PT: { pattern: [3, 3, 3], totalDigits: 9 },
  GB: { pattern: [4, 3, 3], totalDigits: 10, leadingZero: true },
  NL: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  US: { pattern: [3, 3, 4], totalDigits: 10 },
  CA: { pattern: [3, 3, 4], totalDigits: 10 },
  MA: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  TN: { pattern: [2, 3, 3], totalDigits: 8 },
  DZ: { pattern: [1, 2, 2, 2, 2], totalDigits: 9, leadingZero: true },
  SN: { pattern: [2, 3, 2, 2], totalDigits: 9 },
  CI: { pattern: [2, 2, 2, 2, 2], totalDigits: 10 },
  CM: { pattern: [1, 2, 2, 2, 2], totalDigits: 9 },
  AU: { pattern: [3, 3, 3], totalDigits: 9, leadingZero: true },
  JP: { pattern: [2, 4, 4], totalDigits: 10, leadingZero: true },
  IN: { pattern: [5, 5], totalDigits: 10 },
};

const DEFAULT_FORMAT: PhoneFormat = { pattern: [2, 2, 2, 2, 2], totalDigits: 10 };

function formatPhoneNumber(digits: string, countryCode: string): string {
  const fmt = PHONE_FORMATS[countryCode] || DEFAULT_FORMAT;
  const clean = digits.replace(/\D/g, '');
  const parts: string[] = [];
  let idx = 0;
  for (const len of fmt.pattern) {
    if (idx >= clean.length) break;
    parts.push(clean.slice(idx, idx + len));
    idx += len;
  }
  if (idx < clean.length) {
    const remaining = clean.slice(idx);
    for (let i = 0; i < remaining.length; i += 2) {
      parts.push(remaining.slice(i, i + 2));
    }
  }
  return parts.join(' ');
}

function getPlaceholder(countryCode: string): string {
  const fmt = PHONE_FORMATS[countryCode] || DEFAULT_FORMAT;
  let digits = '';
  let d = 1;
  for (const len of fmt.pattern) {
    for (let i = 0; i < len; i++) {
      digits += String(d % 10);
      d++;
    }
    digits += ' ';
  }
  return digits.trim();
}

interface PhoneFieldProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  testID?: string;
}

export default React.memo(function PhoneField({
  label = 'Téléphone',
  value,
  onChangeText,
  required = false,
  testID,
}: PhoneFieldProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCode = useMemo(() => {
    for (const cc of COUNTRY_CODES) {
      if (value.startsWith(cc.dialCode + ' ') || value.startsWith(cc.dialCode)) {
        return cc;
      }
    }
    return DEFAULT_COUNTRY_CODE;
  }, [value]);

  const phoneWithoutCode = useMemo(() => {
    if (value.startsWith(selectedCode.dialCode + ' ')) {
      return value.slice(selectedCode.dialCode.length + 1);
    }
    if (value.startsWith(selectedCode.dialCode)) {
      return value.slice(selectedCode.dialCode.length);
    }
    return value;
  }, [value, selectedCode]);

  const filteredCodes = useMemo(() => {
    if (!searchQuery) return COUNTRY_CODES;
    const q = searchQuery.toLowerCase();
    return COUNTRY_CODES.filter(
      (cc) =>
        cc.name.toLowerCase().includes(q) ||
        cc.dialCode.includes(q) ||
        cc.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectCode = useCallback((cc: CountryCode) => {
    const phone = phoneWithoutCode.trim();
    onChangeText(phone ? `${cc.dialCode} ${phone}` : cc.dialCode + ' ');
    setShowPicker(false);
    setSearchQuery('');
  }, [phoneWithoutCode, onChangeText]);

  const handlePhoneChange = useCallback((text: string) => {
    const digitsOnly = text.replace(/\D/g, '');
    const formatted = formatPhoneNumber(digitsOnly, selectedCode.code);
    onChangeText(`${selectedCode.dialCode} ${formatted}`);
  }, [selectedCode, onChangeText]);

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          {required && <Text style={[styles.required, { color: colors.danger }]}>*</Text>}
        </View>
      ) : null}
      <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
        <TouchableOpacity
          style={[styles.codeSelector, { borderRightColor: colors.inputBorder }]}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{selectedCode.flag}</Text>
          <Text style={[styles.dialCode, { color: colors.text }]}>{selectedCode.dialCode}</Text>
          <ChevronDown size={12} color={colors.textTertiary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.phoneInput, { color: colors.text }]}
          value={phoneWithoutCode}
          onChangeText={handlePhoneChange}
          placeholder={getPlaceholder(selectedCode.code)}
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
          testID={testID}
        />
      </View>

      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => { setShowPicker(false); setSearchQuery(''); }}
        >
          <View style={[styles.pickerContainer, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Indicatif pays</Text>
              <TouchableOpacity onPress={() => { setShowPicker(false); setSearchQuery(''); }} hitSlop={8}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Rechercher un pays..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                  <X size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.codeList} showsVerticalScrollIndicator={false}>
              {filteredCodes.map((cc) => (
                <TouchableOpacity
                  key={`${cc.code}-${cc.dialCode}`}
                  style={[
                    styles.codeItem,
                    { borderBottomColor: colors.borderLight },
                    selectedCode.code === cc.code && selectedCode.dialCode === cc.dialCode && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => handleSelectCode(cc)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.codeFlag}>{cc.flag}</Text>
                  <Text style={[styles.codeName, { color: colors.text }]} numberOfLines={1}>{cc.name}</Text>
                  <Text style={[styles.codeDialCode, { color: colors.textSecondary }]}>{cc.dialCode}</Text>
                </TouchableOpacity>
              ))}
              {filteredCodes.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Aucun résultat</Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: 'row' as const, gap: 4, alignItems: 'center' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  required: { fontSize: 13, fontWeight: '600' as const },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  codeSelector: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
  },
  flag: { fontSize: 16 },
  dialCode: { fontSize: 13, fontWeight: '500' as const },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },
  pickerContainer: {
    width: '100%' as const,
    maxWidth: 400,
    maxHeight: 500,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  pickerHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  pickerTitle: { fontSize: 16, fontWeight: '600' as const },
  searchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  codeList: { maxHeight: 360 },
  codeItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  codeFlag: { fontSize: 18 },
  codeName: { flex: 1, fontSize: 14 },
  codeDialCode: { fontSize: 13, fontWeight: '500' as const },
  emptyText: { padding: 20, textAlign: 'center' as const, fontSize: 14 },
});
