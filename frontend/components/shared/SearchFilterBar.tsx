/**
 * @fileoverview Compact search bar with integrated filter chips/dropdowns.
 * Combines search input + sort/filter in 1-2 lines max.
 * Used across ventes, achats, produits, commandes screens.
 */

import React from 'react';
import {
  View, TextInput, TouchableOpacity, Text, ScrollView, StyleSheet,
} from 'react-native';
import { Search, X, ArrowUpDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * A sort/filter option chip.
 * @property value - Internal value
 * @property label - Display label
 */
export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Props for SearchFilterBar.
 * @property search - Current search query
 * @property onSearchChange - Callback when search text changes
 * @property placeholder - Search input placeholder
 * @property sortOptions - Optional array of sort chips
 * @property sortValue - Current active sort value
 * @property onSortChange - Callback when sort changes
 * @property filterOptions - Optional array of filter chips
 * @property filterValue - Current active filter value
 * @property onFilterChange - Callback when filter changes
 * @property rightAction - Optional action button on the right
 */
interface SearchFilterBarProps {
  search: string;
  onSearchChange: (text: string) => void;
  placeholder?: string;
  sortOptions?: FilterOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  rightAction?: React.ReactNode;
  testID?: string;
}

/**
 * A compact search bar with optional sort/filter chips rendered inline.
 */
export default React.memo(function SearchFilterBar({
  search,
  onSearchChange,
  placeholder = 'Rechercher...',
  sortOptions,
  sortValue,
  onSortChange,
  filterOptions,
  filterValue,
  onFilterChange,
  rightAction,
  testID,
}: SearchFilterBarProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={onSearchChange}
            testID={testID}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        {rightAction != null && <>{rightAction}</>}
      </View>

      {(sortOptions || filterOptions) && (
        <View style={styles.chipsRow}>
          {filterOptions && onFilterChange && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {filterOptions.map((opt) => {
                const active = filterValue === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => onFilterChange(opt.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? '#FFF' : colors.textSecondary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {sortOptions && onSortChange && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <ArrowUpDown size={13} color={colors.textTertiary} />
              {sortOptions.map((opt) => {
                const active = sortValue === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => onSortChange(opt.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? '#FFF' : colors.textSecondary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  topRow: {
    flexDirection: 'row' as const,
    gap: 10,
    alignItems: 'center' as const,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    outlineStyle: 'none' as never,
  },
  chipsRow: {
    gap: 6,
  },
  chips: {
    flexDirection: 'row' as const,
    gap: 6,
    alignItems: 'center' as const,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
});
