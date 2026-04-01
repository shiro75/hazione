/**
 * @fileoverview Horizontal scrollable filter and sort chip components.
 * FilterChips renders selectable pill buttons for status/category filtering.
 * SortChips renders sort options with an arrow icon prefix.
 */
import React from 'react';
import { Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowUpDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface FilterOption<T extends string> {
  label: string;
  value: T;
}

interface FilterChipsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  style?: object;
}

export function FilterChips<T extends string>({
  options,
  value,
  onSelect,
  style,
}: FilterChipsProps<T>) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, style]}
      contentContainerStyle={styles.content}
    >
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.chip,
            {
              backgroundColor: value === opt.value ? colors.primary : colors.card,
              borderColor: value === opt.value ? colors.primary : colors.cardBorder,
            },
          ]}
          onPress={() => onSelect(opt.value)}
        >
          <Text
            style={[
              styles.chipText,
              { color: value === opt.value ? '#FFF' : colors.textSecondary },
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

interface SortChipsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  style?: object;
}

export function SortChips<T extends string>({
  options,
  value,
  onSelect,
  style,
}: SortChipsProps<T>) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.sortContent, style]}
    >
      <ArrowUpDown size={13} color={colors.textTertiary} />
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.chip,
            {
              backgroundColor: value === opt.value ? colors.primary : colors.card,
              borderColor: value === opt.value ? colors.primary : colors.cardBorder,
            },
          ]}
          onPress={() => onSelect(opt.value)}
        >
          <Text
            style={[
              styles.chipText,
              { color: value === opt.value ? '#FFF' : colors.textSecondary },
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: { gap: 8 },
  sortContent: { gap: 8, alignItems: 'center' as const },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});
