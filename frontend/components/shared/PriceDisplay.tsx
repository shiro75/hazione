/**
 * @fileoverview Formatted price display component with optional HT/TTC label.
 * Renders currency amounts consistently across the app.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/utils/format';

/**
 * Props for PriceDisplay.
 * @property amount - Numeric amount to display
 * @property currency - ISO currency code (default: 'EUR')
 * @property label - Optional label like 'HT' or 'TTC'
 * @property size - Font size variant
 * @property color - Override text color
 * @property bold - Whether to render bold
 * @property prefix - Optional prefix like '+' or '-'
 */
interface PriceDisplayProps {
  amount: number;
  currency?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  bold?: boolean;
  prefix?: string;
  style?: object;
}

const SIZES = {
  sm: { amount: 12, label: 10 },
  md: { amount: 14, label: 11 },
  lg: { amount: 20, label: 12 },
} as const;

/**
 * Displays a formatted price with optional HT/TTC suffix.
 *
 * @example
 * <PriceDisplay amount={1250} currency="EUR" label="TTC" size="lg" bold />
 */
export default React.memo(function PriceDisplay({
  amount,
  currency = 'EUR',
  label,
  size = 'md',
  color,
  bold = false,
  prefix,
  style,
}: PriceDisplayProps) {
  const { colors } = useTheme();
  const textColor = color ?? colors.text;
  const fontSize = SIZES[size];
  const fontWeight = bold ? ('700' as const) : ('500' as const);

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          { color: textColor, fontSize: fontSize.amount, fontWeight },
        ]}
      >
        {prefix}{formatCurrency(amount, currency)}
      </Text>
      {label ? (
        <Text style={[styles.label, { color: colors.textTertiary, fontSize: fontSize.label }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 4,
  },
  label: {
    fontWeight: '500' as const,
  },
});
