/**
 * DonutChart.tsx
 * SVG donut/pie chart with legend. Displays category distribution with colors.
 *
 * Usage:
 *   <DonutChart segments={[{ label: 'Food', value: 420, color: '#059669' }]} size={120} />
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string;
}

const DONUT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6',
];

function DonutChart({
  segments,
  size = 180,
  strokeWidth = 22,
  showLegend = true,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const { colors } = useTheme();

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

  if (segments.length === 0 || total === 0) return null;

  return (
    <View style={[styles.container, { flexDirection: 'row', alignItems: 'center' }]}> 
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
          {arcs.map((arc, idx) => (
            <Circle
              key={idx}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
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
        <View style={[styles.legend, { marginTop: 0, flex: 1 }]}>
          {arcs.map((arc, idx) => (
            <View key={idx} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: arc.color }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {arc.label}
              </Text>
              <Text style={[styles.legendPct, { color: colors.text }]}>{arc.pct}%</Text>
            </View>
          ))}
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
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.SNUG,
  },
  centerLabel: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    marginTop: 1,
  },
  legend: {
    gap: SPACING.SM,
    width: '100%' as const,
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.MD,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.XS,
  },
  legendLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  legendPct: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
});
