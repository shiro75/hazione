import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface CompactSummaryCardProps {
  total: number;
  totalLabel?: string;
  unit?: string;
  message?: string;
  insight?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: LucideIcon;
  sparklineData?: number[];
  sparklineColor?: string;
}

function buildSparklinePath(data: number[], w: number, h: number): { line: string; area: string } {
  if (data.length < 2) return { line: '', area: '' };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => ({ x: i * stepX, y: h - ((v - min) / range) * h * 0.85 - h * 0.05 }));

  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = (pts[i - 1].x + pts[i].x) / 2;
    line += ` C ${cpX} ${pts[i - 1].y} ${cpX} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  const area = `${line} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`;
  return { line, area };
}

export default React.memo(function CompactSummaryCard({
  total,
  totalLabel,
  unit = '€',
  message = 'Pas assez de données pour afficher un graphique',
  insight,
  trend,
  trendValue,
  icon: IconProp,
  sparklineData,
  sparklineColor,
}: CompactSummaryCardProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const formattedTotal = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(total);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? colors.success : trend === 'down' ? colors.danger : colors.textTertiary;
  const lineColor = sparklineColor || colors.primary;

  const sparkW = 120;
  const sparkH = 36;
  const sparkPaths = sparklineData && sparklineData.length >= 2
    ? buildSparklinePath(sparklineData, sparkW, sparkH)
    : null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.totalBlock}>
          {totalLabel ? (
            <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>{totalLabel}</Text>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={[styles.totalValue, { color: colors.text }]}>{formattedTotal}</Text>
            <Text style={[styles.totalUnit, { color: colors.textSecondary }]}>{unit}</Text>
          </View>
          {trend && trendValue ? (
            <View style={[styles.trendBadge, { backgroundColor: `${trendColor}15` }]}>
              <TrendIcon size={11} color={trendColor} strokeWidth={2.5} />
              <Text style={[styles.trendText, { color: trendColor }]}>{trendValue}</Text>
            </View>
          ) : null}
        </View>

        {sparkPaths ? (
          <View style={styles.sparkContainer}>
            <Svg width={sparkW} height={sparkH}>
              <Defs>
                <LinearGradient id="compactSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={lineColor} stopOpacity="0.18" />
                  <Stop offset="1" stopColor={lineColor} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
              <Path d={sparkPaths.area} fill="url(#compactSparkGrad)" />
              <Path d={sparkPaths.line} stroke={lineColor} strokeWidth={1.8} fill="none" strokeLinecap="round" />
            </Svg>
          </View>
        ) : IconProp ? (
          <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
            <IconProp size={20} color={colors.primary} strokeWidth={1.5} />
          </View>
        ) : null}
      </View>

      <View style={[styles.messageRow, { backgroundColor: colors.borderLight }]}>
        <View style={[styles.messageDot, { backgroundColor: colors.textTertiary }]} />
        <Text style={[styles.message, { color: colors.textTertiary }]}>{message}</Text>
      </View>

      {insight ? (
        <View style={[styles.insightRow, { backgroundColor: colors.primaryLight }]}>
          <View style={[styles.insightDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>{insight}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  totalBlock: {
    gap: 2,
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  totalRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 4,
  },
  totalValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  totalUnit: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  trendBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
    marginTop: 4,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  sparkContainer: {
    marginLeft: 8,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  messageRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  messageDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.5,
  },
  message: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    flex: 1,
  },
  insightRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  insightDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  insightText: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
    flex: 1,
  },
});
