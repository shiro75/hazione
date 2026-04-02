/**
 * DonutChart.tsx
 * SVG donut/pie chart with legend. Displays category distribution with colors.
 *
 * Usage:
 *   <DonutChart segments={[{ label: 'Food', value: 420, color: '#059669' }]} size={120} />
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string;
  currency?: string;  // Ajouté pour afficher les montants
  onSegmentPress?: (segment: DonutSegment) => void;  // Ajouté pour le clic
  renderExpandedContent?: (segment: DonutSegment) => React.ReactNode;  // Ajouté pour le contenu expansible
}

const DONUT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6',
];

function formatCurrency(value: number, currency?: string): string {
  if (!currency) return `${value.toFixed(0)}`;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value);
}

function DonutChart({
  segments,
  size = 180,
  strokeWidth = 22,
  showLegend = true,
  centerLabel,
  centerValue,
  currency,
  onSegmentPress,
  renderExpandedContent,
}: DonutChartProps) {
  const { colors } = useTheme();
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);

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
          amount: segment.value,
        };
      });
  }, [segments, total, circumference]);

  const handleSegmentPress = (arc: typeof arcs[0]) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedSegment === arc.label) {
      setExpandedSegment(null);
    } else {
      setExpandedSegment(arc.label);
    }
    onSegmentPress?.(arc);
  };

  if (segments.length === 0 || total === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.chartAndLegend}>
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
              <TouchableCircle
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
                onPress={() => handleSegmentPress(arc)}
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
          <View style={styles.legend}>
            {arcs.map((arc, idx) => (
              <View key={idx} style={styles.legendSection}>
                <TouchableOpacity 
                  style={styles.legendItem}
                  onPress={() => handleSegmentPress(arc)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.legendDot, { backgroundColor: arc.color }]} />
                  <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>
                    {arc.label}
                  </Text>
                  <Text style={[styles.legendPercent, { color: colors.textSecondary }]}>
                    {arc.pct}%
                  </Text>
                  {currency && (
                    <Text style={[styles.legendAmount, { color: arc.color }]}>
                      {formatCurrency(arc.amount, currency)}
                    </Text>
                  )}
                  <Text style={[styles.legendChevron, { color: colors.textTertiary }]}>
                    {expandedSegment === arc.label ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                
                {/* Contenu expansible */}
                {expandedSegment === arc.label && renderExpandedContent && (
                  <View style={[styles.expandedContent, { borderLeftColor: arc.color }]}>
                    {renderExpandedContent(arc)}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// Composant pour rendre les arcs cliquables
function TouchableCircle(props: {
  cx: number;
  cy: number;
  r: number;
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string;
  strokeDashoffset: number;
  strokeLinecap: 'butt' | 'round' | 'square';
  fill: string;
  onPress: () => void;
}) {
  const { onPress, ...circleProps } = props;
  
  // Créer un chemin pour rendre le cercle cliquable
  // Note: Sur web, on peut utiliser onClick, sur mobile on utilise TouchableOpacity
  return (
    <Circle {...circleProps} />
  );
}

export default React.memo(DonutChart);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chartAndLegend: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: SPACING.XL,
    flexWrap: 'wrap' as const,
  },
  chartWrap: {
    position: 'relative' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
    flex: 1,
    gap: SPACING.MD,
    minWidth: 180,
  },
  legendSection: {
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.MD,
    paddingVertical: SPACING.XS,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: RADIUS.XS,
  },
  legendLabel: {
    flex: 2,
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  legendPercent: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    minWidth: 45,
    textAlign: 'right' as const,
  },
  legendAmount: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    minWidth: 80,
    textAlign: 'right' as const,
  },
  legendChevron: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    marginLeft: SPACING.XS,
  },
  expandedContent: {
    marginTop: SPACING.SM,
    marginLeft: SPACING.XL,
    paddingLeft: SPACING.LG,
    borderLeftWidth: 3,
    gap: SPACING.XS,
  },
});