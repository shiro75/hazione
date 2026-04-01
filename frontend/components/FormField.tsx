/**
 * @fileoverview Reusable form field components: text input with label/validation,
 * and pill-style select field. Used in all form modals across the app.
 *
 * NOTE: Error display uses ternary (error ? <Text> : null) to avoid
 * React Native Web "Unexpected text node" errors with empty strings.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'decimal-pad';
  editable?: boolean;
  numberOfLines?: number;
  testID?: string;
}

export default React.memo(function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required = false,
  multiline = false,
  keyboardType = 'default',
  editable = true,
  numberOfLines = 1,
  testID,
}: FormFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        {required && <Text style={[styles.required, { color: colors.danger }]}>*</Text>}
      </View>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: editable ? colors.inputBg : colors.surfaceHover,
            borderColor: error ? colors.danger : colors.inputBorder,
            color: colors.text,
          },
          multiline && { height: numberOfLines * 22 + 24, textAlignVertical: 'top' as const },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : undefined}
        keyboardType={keyboardType}
        editable={editable}
        testID={testID}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
});

interface SelectFieldProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  required?: boolean;
}

export const SelectField = React.memo(function SelectField({
  label,
  value,
  options,
  onSelect,
  required = false,
}: SelectFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        {required && <Text style={[styles.required, { color: colors.danger }]}>*</Text>}
      </View>
      <View style={styles.selectRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.selectOption,
              {
                backgroundColor: value === opt.value ? colors.primary : colors.inputBg,
                borderColor: value === opt.value ? colors.primary : colors.inputBorder,
              },
            ]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[styles.selectText, { color: value === opt.value ? '#FFF' : colors.text }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: 'row' as const, gap: 4, alignItems: 'center' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  required: { fontSize: 13, fontWeight: '600' as const },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  error: { fontSize: 12 },
  selectRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  selectOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectText: { fontSize: 13, fontWeight: '500' as const },
});
