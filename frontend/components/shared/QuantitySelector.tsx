/**
 * @fileoverview Quantity selector with +/- buttons and editable input.
 * Used in POS, shop cart, and product forms.
 */

import React, { useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for QuantitySelector.
 * @property value - Current quantity
 * @property onChange - Callback when quantity changes
 * @property min - Minimum allowed value (default: 0)
 * @property max - Maximum allowed value (default: 99999)
 * @property step - Increment/decrement step (default: 1)
 * @property disabled - Whether the selector is disabled
 * @property compact - Compact mode with smaller buttons
 */
interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  compact?: boolean;
  testID?: string;
}

/**
 * +/- stepper with an editable numeric input field.
 *
 * @example
 * <QuantitySelector value={qty} onChange={setQty} min={1} max={100} />
 */
export default React.memo(function QuantitySelector({
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 1,
  disabled = false,
  compact = false,
  testID,
}: QuantitySelectorProps) {
  const { colors } = useTheme();

  const handleDecrement = useCallback(() => {
    const next = Math.max(min, value - step);
    onChange(next);
  }, [value, min, step, onChange]);

  const handleIncrement = useCallback(() => {
    const next = Math.min(max, value + step);
    onChange(next);
  }, [value, max, step, onChange]);

  const handleTextChange = useCallback(
    (text: string) => {
      const num = parseInt(text, 10);
      if (isNaN(num)) {
        onChange(min);
      } else {
        onChange(Math.max(min, Math.min(max, num)));
      }
    },
    [min, max, onChange]
  );

  const btnSize = compact ? 28 : 34;
  const iconSize = compact ? 14 : 16;

  return (
    <View style={[styles.container, disabled && styles.disabled]} testID={testID}>
      <TouchableOpacity
        style={[
          styles.btn,
          { width: btnSize, height: btnSize, backgroundColor: colors.surfaceHover, borderColor: colors.border },
          value <= min && styles.btnDisabled,
        ]}
        onPress={handleDecrement}
        disabled={disabled || value <= min}
        activeOpacity={0.6}
      >
        <Minus size={iconSize} color={value <= min ? colors.textTertiary : colors.text} />
      </TouchableOpacity>
      <TextInput
        style={[
          styles.input,
          compact && styles.inputCompact,
          { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
        ]}
        value={String(value)}
        onChangeText={handleTextChange}
        keyboardType="numeric"
        editable={!disabled}
        selectTextOnFocus
      />
      <TouchableOpacity
        style={[
          styles.btn,
          { width: btnSize, height: btnSize, backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' },
          value >= max && styles.btnDisabled,
        ]}
        onPress={handleIncrement}
        disabled={disabled || value >= max}
        activeOpacity={0.6}
      >
        <Plus size={iconSize} color={value >= max ? colors.textTertiary : colors.primary} />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  btn: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  input: {
    width: 56,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center' as const,
    fontSize: 15,
    fontWeight: '600' as const,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  inputCompact: {
    width: 44,
    fontSize: 13,
    paddingVertical: 4,
  },
});
