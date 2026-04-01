/**
 * @fileoverview Generic DataTable component for rendering sorted, filterable
 * lists with alternating row backgrounds. Used in ventes, achats, produits, commandes.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Column definition for the DataTable.
 * @property key - Unique column identifier
 * @property label - Header label
 * @property flex - Flex ratio for column width
 * @property align - Text alignment ('left' | 'center' | 'right')
 * @property render - Custom render function for cell content
 */
export interface DataTableColumn<T> {
  key: string;
  label: string;
  flex?: number;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
}

/**
 * Props for the DataTable component.
 * @property columns - Array of column definitions (desktop only)
 * @property data - Array of data items to display
 * @property keyExtractor - Function to extract unique key from each item
 * @property renderRow - Render function for each row (mobile-friendly)
 * @property onRowPress - Optional callback when a row is pressed
 * @property emptyComponent - Component to show when data is empty
 * @property alternateRows - Whether to alternate row background colors
 */
interface DataTableProps<T> {
  columns?: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  renderRow: (item: T, index: number) => React.ReactNode;
  renderDesktopRow?: (item: T, index: number) => React.ReactNode;
  onRowPress?: (item: T) => void;
  emptyComponent?: React.ReactNode;
  alternateRows?: boolean;
  showHeader?: boolean;
}

/**
 * Renders a data table with optional column headers, alternating row colors,
 * and responsive mobile/desktop layouts.
 */
function DataTableInner<T>({
  columns,
  data,
  keyExtractor,
  renderRow,
  renderDesktopRow,
  onRowPress,
  emptyComponent,
  alternateRows = true,
  showHeader = true,
}: DataTableProps<T>) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (data.length === 0 && emptyComponent) {
    return <>{emptyComponent}</>;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      {!isMobile && showHeader && columns && columns.length > 0 && (
        <View
          style={[
            styles.headerRow,
            { borderBottomColor: colors.border },
          ]}
        >
          {columns.map((col) => (
            <Text
              key={col.key}
              style={[
                styles.headerText,
                { color: colors.textTertiary, flex: col.flex ?? 1 },
                col.align === 'right' && styles.alignRight,
                col.align === 'center' && styles.alignCenter,
              ]}
            >
              {col.label}
            </Text>
          ))}
        </View>
      )}
      {data.map((item, index) => {
        const isAlt = alternateRows && index % 2 === 1;
        const rowContent = isMobile || !renderDesktopRow
          ? renderRow(item, index)
          : renderDesktopRow(item, index);

        const row = (
          <View
            key={keyExtractor(item)}
            style={[
              styles.row,
              isAlt && { backgroundColor: colors.background + '60' },
              index < data.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: colors.borderLight,
              },
            ]}
          >
            {rowContent}
          </View>
        );

        if (onRowPress) {
          return (
            <TouchableOpacity
              key={keyExtractor(item)}
              onPress={() => onRowPress(item)}
              activeOpacity={0.7}
            >
              {row}
            </TouchableOpacity>
          );
        }

        return row;
      })}
    </View>
  );
}

const DataTable = React.memo(DataTableInner) as typeof DataTableInner;
export default DataTable;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  alignRight: {
    textAlign: 'right' as const,
  },
  alignCenter: {
    textAlign: 'center' as const,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
