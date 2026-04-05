import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TrendingUp, TrendingDown, Minus, BarChart3, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface SparseDataFallbackProps {
  total: number;
  totalLabel?: string;
  unit?: string;
  message?: string;
  insight?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: LucideIcon;
}

export default React.memo(function SparseDataFallback({
  total,
  totalLabel,
  unit = '€',
  message = 'Pas assez de données pour afficher un graphique',
  insight,
  trend,
  trendValue,
  icon: IconProp,
}: SparseDataFallbackProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, pulseAnim]);

  const formattedTotal = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(total);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? colors.success : trend === 'down' ? colors.danger : colors.textTertiary;
  const ChartIcon = IconProp ?? BarChart3;

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
            <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>
              {totalLabel}
            </Text>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formattedTotal}
            </Text>
            <Text style={[styles.totalUnit, { color: colors.textSecondary }]}>
              {unit}
            </Text>
          </View>
          {trend && trendValue ? (
            <View style={[styles.trendBadge, { backgroundColor: `${trendColor}15` }]}>
              <TrendIcon size={12} color={trendColor} strokeWidth={2.5} />
              <Text style={[styles.trendText, { color: trendColor }]}>
                {trendValue}
              </Text>
            </View>
          ) : null}
        </View>

        <Animated.View
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.primaryLight,
              opacity: pulseAnim,
            },
          ]}
        >
          <ChartIcon size={22} color={colors.primary} strokeWidth={1.5} />
        </Animated.View>
      </View>

      <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />

      <View style={styles.placeholderBars}>
        {[0.35, 0.6, 0.45, 0.8, 0.5, 0.3, 0.65].map((h, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: `${h * 100}%` as unknown as number,
                flex: 1,
                backgroundColor: colors.border,
                opacity: pulseAnim,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.message, { color: colors.textTertiary }]}>
        {message}
      </Text>

      {insight ? (
        <View style={[styles.insightRow, { backgroundColor: colors.primaryLight }]}>
          <View style={[styles.insightDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            {insight}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  totalBlock: {
    gap: 2,
  },
  totalLabel: {
    fontSize: 12,
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
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  totalUnit: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  trendBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
    marginTop: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  separator: {
    height: 1,
  },
  placeholderBars: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 6,
    height: 48,
  },
  bar: {
    borderRadius: 3,
    minHeight: 6,
  },
  message: {
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  insightRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  insightText: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 17,
    flex: 1,
  },
});
