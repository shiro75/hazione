/**
 * @fileoverview Totals summary card showing HT, TVA, and TTC breakdowns.
 * Used at the bottom of invoice, quote, and order detail panels.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/utils/format';

interface TotalsSummaryProps {
  items: { totalHT: number; totalTVA: number; totalTTC: number }[];
  compact?: boolean;
  currency?: string;
}

export default React.memo(function TotalsSummary({ items, compact = false, currency }: TotalsSummaryProps) {
  const { colors } = useTheme();
  const { company } = useData();
  const cur = currency || company.currency || 'EUR';

  const totals = useMemo(() => ({
    totalHT: items.reduce((s, i) => s + i.totalHT, 0),
    totalTVA: items.reduce((s, i) => s + i.totalTVA, 0),
    totalTTC: items.reduce((s, i) => s + i.totalTTC, 0),
  }), [items]);

  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.surfaceHover }]}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Total HT</Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>{formatCurrency(totals.totalHT, cur)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>TVA</Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>{formatCurrency(totals.totalTVA, cur)}</Text>
      </View>
      <View style={[styles.row, styles.rowMain, { borderTopColor: colors.border }]}>
        <Text style={[compact ? styles.labelBoldCompact : styles.labelBold, { color: colors.text }]}>Total TTC</Text>
        <Text style={[compact ? styles.valueBoldCompact : styles.valueBold, { color: colors.primary }]}>{formatCurrency(totals.totalTTC, cur)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 8, borderWidth: 1, gap: 4 },
  row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  rowMain: { marginTop: 4, paddingTop: 6, borderTopWidth: 1 },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '500' as const },
  labelBold: { fontSize: 16, fontWeight: '700' as const },
  valueBold: { fontSize: 18, fontWeight: '800' as const },
  labelBoldCompact: { fontSize: 14, fontWeight: '700' as const },
  valueBoldCompact: { fontSize: 15, fontWeight: '700' as const },
});
