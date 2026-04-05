/**
 * DonutChart.tsx
 * SVG donut/pie chart with interactive legend.
 * Supports clickable segments, amounts in legend, and expandable category details.
 *
 * Usage:
 *   <DonutChart segments={[{ label: 'Food', value: 420, color: '#059669' }]} size={120} />
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  quantity?: number;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string;
  currency?: string;
  onSegmentPress?: (segment: DonutSegment) => void;
  renderExpandedContent?: (segment: DonutSegment) => React.ReactNode;
  selectedSegmentLabel?: string | null;
  collapseAll?: boolean;
}

const DONUT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6',
];

interface DonutChartPropsWithLayout extends DonutChartProps {
  legendPosition?: 'bottom' | 'right';
}

function DonutChart({
  segments,
  size = 120,
  strokeWidth = 18,
  showLegend = true,
  centerLabel,
  centerValue,
  currency,
  onSegmentPress,
  renderExpandedContent,
  selectedSegmentLabel,
  collapseAll,
  legendPosition = 'bottom',
}: DonutChartPropsWithLayout) {
  const { colors } = useTheme();
  const [expandedLegend, setExpandedLegend] = useState<string | null>(null);
  const prevCollapseAll = React.useRef(collapseAll);
  React.useEffect(() => {
    if (collapseAll && !prevCollapseAll.current) {
      setExpandedLegend(null);
    }
    prevCollapseAll.current = collapseAll;
  }, [collapseAll]);

  const total = useMemo(() => segments.reduce((sum, s) => sum + s.value, 0), [segments]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const arcs = useMemo(() => {
    if (total === 0) return [];
    let accumulated = 0;
    return segments
      .filter(s => s.value > 0)
      .map((segment, idx) => {
        const pct = segment.value / total;
        const dashLength = pct * circumference;
        const dashGap = circumference - dashLength;
        const offset = -(accumulated * circumference) + circumference * 0.25;
        accumulated += pct;
        return {
          ...segment,
          dashArray: `${dashLength} ${dashGap}`,
          dashOffset: offset,
          color: segment.color || DONUT_COLORS[idx % DONUT_COLORS.length],
          pct: Math.round(pct * 100),
        };
      });
  }, [segments, total, circumference]);

  const handleLegendPress = useCallback((segment: DonutSegment) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedLegend(prev => prev === segment.label ? null : segment.label);
  }, []);

  const handleSegmentPress = useCallback((segment: DonutSegment) => {
    if (onSegmentPress) {
      onSegmentPress(segment);
    }
  }, [onSegmentPress]);

  if (segments.length === 0 || total === 0) return null;

  const isRight = legendPosition === 'right';

  return (
    <View style={[styles.container, isRight && styles.containerRow]}>
      <View style={styles.chartWrap}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={colors.borderLight}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {arcs.map((arc, idx) => {
            const isSelected = selectedSegmentLabel === arc.label;
            const isDeselected = selectedSegmentLabel != null && selectedSegmentLabel !== arc.label;
            return (
              <Circle
                key={idx}
                cx={cx}
                cy={cy}
                r={radius}
                stroke={arc.color}
                strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="butt"
                fill="none"
                opacity={isDeselected ? 0.3 : 1}
              />
            );
          })}
        </Svg>
        {(centerLabel || centerValue) && (
          <View style={[styles.centerOverlay, { width: size, height: size }]}>
            {centerValue && (
              <Text style={[styles.centerValue, { color: colors.text }]}>{centerValue}</Text>
            )}
            {centerLabel && (
              <Text style={[styles.centerLabel, { color: colors.textTertiary }]}>{centerLabel}</Text>
            )}
          </View>
        )}
      </View>
      {showLegend && (
        <View style={[styles.legend, isRight && styles.legendRight]}>
          {arcs.map((arc, idx) => {
            const isExpanded = expandedLegend === arc.label;
            const isActive = selectedSegmentLabel === arc.label;
            return (
              <View key={idx}>
                <TouchableOpacity
                  style={[
                    styles.legendItem,
                    isActive && { backgroundColor: arc.color + '10', borderRadius: RADIUS.MD, paddingHorizontal: SPACING.SM, marginHorizontal: -SPACING.SM },
                  ]}
                  onPress={() => {
                    handleSegmentPress(arc);
                    if (renderExpandedContent) {
                      handleLegendPress(arc);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.legendDot, { backgroundColor: arc.color }]} />
                  <Text
                    style={[styles.legendLabel, { color: isActive ? arc.color : colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {arc.label}
                  </Text>
                  <View style={styles.legendValues}>
                    {arc.quantity != null && (
                      <Text style={[styles.legendQty, { color: colors.textTertiary }]}>
                        {arc.quantity}
                      </Text>
                    )}
                    {currency && (
                      <Text style={[styles.legendAmount, { color: colors.text }]}>
                        {formatCurrency(arc.value, currency)}
                      </Text>
                    )}
                    <Text style={[styles.legendPct, { color: arc.color }]}>{arc.pct}%</Text>
                  </View>
                  {renderExpandedContent && (
                    <ChevronDown
                      size={14}
                      color={colors.textTertiary}
                      style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                    />
                  )}
                </TouchableOpacity>
                {isExpanded && renderExpandedContent && (
                  <View style={[styles.expandedContent, { borderLeftColor: arc.color }]}>
                    {renderExpandedContent(arc)}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default React.memo(DonutChart);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center' as const,
    gap: SPACING.XL,
  },
  containerRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: SPACING.XXL,
  },
  chartWrap: {
    position: 'relative' as const,
  },
  centerOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  centerValue: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.SNUG,
  },
  centerLabel: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    marginTop: 1,
  },
  legend: {
    gap: SPACING.XS,
    width: '100%' as const,
  },
  legendRight: {
    flex: 1,
    width: undefined,
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.MD,
    paddingVertical: SPACING.SM,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  legendValues: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.MD,
  },
  legendAmount: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  legendPct: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    minWidth: 32,
    textAlign: 'right' as const,
  },
  legendQty: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    minWidth: 24,
    textAlign: 'right' as const,
  },
  expandedContent: {
    marginLeft: SPACING.XXL,
    paddingLeft: SPACING.LG,
    borderLeftWidth: 2,
    marginBottom: SPACING.SM,
  },
});
