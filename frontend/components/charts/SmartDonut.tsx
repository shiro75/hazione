import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DonutChart from '@/components/charts/DonutChart';
import type { DonutSegment } from '@/components/charts/DonutChart';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';

interface SmartDonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  currency?: string;
  title?: string;
  centerValue?: string;
  centerLabel?: string;
  selectedSegmentLabel?: string | null;
  collapseAll?: boolean;
  onSegmentPress?: (segment: DonutSegment) => void;
  renderExpandedContent?: (segment: DonutSegment) => React.ReactNode;
  legendPosition?: 'bottom' | 'right';
}

function SmartDonut({
  segments,
  size = 160,
  strokeWidth = 24,
  currency,
  title,
  centerValue,
  centerLabel,
  selectedSegmentLabel,
  collapseAll,
  onSegmentPress,
  renderExpandedContent,
  legendPosition = 'right',
}: SmartDonutProps) {
  const { colors } = useTheme();

  const nonZeroSegments = useMemo(
    () => segments.filter(s => s.value > 0),
    [segments],
  );

  const total = useMemo(
    () => nonZeroSegments.reduce((sum, s) => sum + s.value, 0),
    [nonZeroSegments],
  );

  if (nonZeroSegments.length === 0 || total === 0) {
    return null;
  }

  if (nonZeroSegments.length === 1) {
    const seg = nonZeroSegments[0];
    const pct = 100;
    return (
      <View style={styles.listContainer}>
        {title ? (
          <Text style={[styles.listTitle, { color: colors.text }]}>{title}</Text>
        ) : null}
        <View
          style={[
            styles.singleCategoryCard,
            { backgroundColor: seg.color + '08', borderColor: seg.color + '25' },
          ]}
        >
          <View style={styles.singleCategoryRow}>
            <View style={[styles.singleDot, { backgroundColor: seg.color }]} />
            <View style={styles.singleInfo}>
              <Text style={[styles.singleLabel, { color: colors.text }]}>
                {seg.label}
              </Text>
              {seg.quantity != null && (
                <Text style={[styles.singleQty, { color: colors.textTertiary }]}>
                  {seg.quantity} unité{seg.quantity > 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <View style={styles.singleValues}>
              {currency ? (
                <Text style={[styles.singleAmount, { color: seg.color }]}>
                  {formatCurrency(seg.value, currency)}
                </Text>
              ) : (
                <Text style={[styles.singleAmount, { color: seg.color }]}>
                  {seg.value}
                </Text>
              )}
              <Text style={[styles.singlePct, { color: colors.textTertiary }]}>
                {pct}%
              </Text>
            </View>
          </View>
          <View style={[styles.singleBar, { backgroundColor: seg.color + '15' }]}>
            <View
              style={[
                styles.singleBarFill,
                { backgroundColor: seg.color, width: '100%' as `${number}%` },
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <DonutChart
      segments={segments}
      size={size}
      strokeWidth={strokeWidth}
      showLegend={true}
      legendPosition={legendPosition}
      centerValue={centerValue}
      centerLabel={centerLabel}
      currency={currency}
      selectedSegmentLabel={selectedSegmentLabel}
      collapseAll={collapseAll}
      onSegmentPress={onSegmentPress}
      renderExpandedContent={renderExpandedContent}
    />
  );
}

export default React.memo(SmartDonut);

const styles = StyleSheet.create({
  listContainer: {
    gap: SPACING.MD,
  },
  listTitle: {
    fontSize: TYPOGRAPHY.SIZE.BODY_LARGE,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    marginBottom: SPACING.XS,
  },
  singleCategoryCard: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    gap: SPACING.LG,
  },
  singleCategoryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.LG,
  },
  singleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  singleInfo: {
    flex: 1,
  },
  singleLabel: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  singleQty: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    marginTop: 1,
  },
  singleValues: {
    alignItems: 'flex-end' as const,
    gap: 2,
  },
  singleAmount: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    letterSpacing: -0.3,
  },
  singlePct: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  singleBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  singleBarFill: {
    height: '100%' as const,
    borderRadius: 3,
  },
});
