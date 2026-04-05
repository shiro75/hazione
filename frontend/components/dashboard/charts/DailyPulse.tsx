import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TrendingUp, TrendingDown, ShoppingCart, Star, Clock } from 'lucide-react-native';
import SparklineChart from '@/components/dashboard/charts/SparklineChart';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';

interface DailyPulseProps {
  todayRevenue: number;
  yesterdayRevenue: number;
  todaySalesCount: number;
  yesterdaySalesCount: number;
  avgTicket: number;
  yesterdayAvgTicket: number;
  bestSale: { name: string; amount: number } | null;
  hourlyData: number[];
  formatCurrency: (v: number) => string;
  primaryColor: string;
  textColor: string;
  textSecondary: string;
  textTertiary: string;
  cardBg: string;
  cardBorder: string;
  successColor?: string;
  dangerColor?: string;
}

function DeltaBadge({ current, previous, suffix, successColor, dangerColor }: {
  current: number;
  previous: number;
  suffix?: string;
  successColor: string;
  dangerColor: string;
}) {
  if (previous === 0 && current === 0) return null;
  const diff = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
  const isUp = diff >= 0;
  const color = isUp ? successColor : dangerColor;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const label = previous === 0 ? 'Nouveau' : `${isUp ? '+' : ''}${Math.round(diff)}%${suffix || ''}`;

  return (
    <View style={[pulseStyles.deltaBadge, { backgroundColor: color + '12' }]}>
      <Icon size={10} color={color} strokeWidth={2.5} />
      <Text style={[pulseStyles.deltaText, { color }]}>{label}</Text>
    </View>
  );
}

function DailyPulse({
  todayRevenue,
  yesterdayRevenue,
  todaySalesCount,
  yesterdaySalesCount,
  avgTicket,
  yesterdayAvgTicket,
  bestSale,
  hourlyData,
  formatCurrency,
  primaryColor,
  textColor,
  textSecondary,
  textTertiary,
  cardBg,
  cardBorder,
  successColor = '#059669',
  dangerColor = '#EF4444',
}: DailyPulseProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const revenueDelta = useMemo(() => {
    if (yesterdayRevenue === 0 && todayRevenue === 0) return 0;
    if (yesterdayRevenue === 0) return 100;
    return ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  }, [todayRevenue, yesterdayRevenue]);

  const isRevenueUp = revenueDelta >= 0;
  const revenueAccent = isRevenueUp ? successColor : dangerColor;

  const hourlySparkline = useMemo(() => {
    const data: number[] = [];
    for (let h = 6; h <= 22; h++) {
      data.push(hourlyData[h] ?? 0);
    }
    return data;
  }, [hourlyData]);

  const currentHourLabel = useMemo(() => {
    const h = new Date().getHours();
    return `${h}h`;
  }, []);

  return (
    <Animated.View style={[
      pulseStyles.container,
      { backgroundColor: cardBg, borderColor: cardBorder, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
    ]}>
      <View style={[pulseStyles.accentStripe, { backgroundColor: primaryColor }]} />

      <View style={pulseStyles.headerRow}>
        <View style={pulseStyles.headerLeft}>
          <View style={[pulseStyles.pulseIcon, { backgroundColor: primaryColor + '15' }]}>
            <Clock size={14} color={primaryColor} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={[pulseStyles.headerTitle, { color: textColor }]}>Pouls du jour</Text>
            <Text style={[pulseStyles.headerSub, { color: textTertiary }]}>Mis à jour en temps réel · {currentHourLabel}</Text>
          </View>
        </View>
        {yesterdayRevenue > 0 && (
          <View style={[pulseStyles.vsYesterday, { backgroundColor: revenueAccent + '10' }]}>
            <Text style={[pulseStyles.vsText, { color: revenueAccent }]}>
              vs hier {isRevenueUp ? '↑' : '↓'} {Math.abs(Math.round(revenueDelta))}%
            </Text>
          </View>
        )}
      </View>

      <View style={pulseStyles.mainMetric}>
        <Text style={[pulseStyles.mainValue, { color: textColor }]}>{formatCurrency(todayRevenue)}</Text>
        <Text style={[pulseStyles.mainLabel, { color: textTertiary }]}>CA du jour</Text>
      </View>

      {hourlySparkline.some(v => v > 0) && (
        <View style={pulseStyles.sparklineRow}>
          <SparklineChart
            data={hourlySparkline}
            color={primaryColor}
            width={220}
            height={36}
            strokeWidth={1.8}
            showArea={true}
            smooth={true}
            showEndDot={true}
          />
          <View style={pulseStyles.sparklineLabelCol}>
            <Text style={[pulseStyles.sparklineLabel, { color: textTertiary }]}>6h</Text>
            <Text style={[pulseStyles.sparklineLabel, { color: textTertiary }]}>22h</Text>
          </View>
        </View>
      )}

      <View style={[pulseStyles.metricsGrid, { borderTopColor: cardBorder }]}>
        <View style={pulseStyles.metricCell}>
          <View style={pulseStyles.metricHeader}>
            <ShoppingCart size={12} color={primaryColor} />
            <Text style={[pulseStyles.metricLabel, { color: textSecondary }]}>Ventes</Text>
          </View>
          <Text style={[pulseStyles.metricValue, { color: textColor }]}>{todaySalesCount}</Text>
          <DeltaBadge
            current={todaySalesCount}
            previous={yesterdaySalesCount}
            successColor={successColor}
            dangerColor={dangerColor}
          />
        </View>

        <View style={[pulseStyles.metricCell, pulseStyles.metricCellBorder, { borderLeftColor: cardBorder, borderRightColor: cardBorder }]}>
          <View style={pulseStyles.metricHeader}>
            <TrendingUp size={12} color="#7C3AED" />
            <Text style={[pulseStyles.metricLabel, { color: textSecondary }]}>Ticket moyen</Text>
          </View>
          <Text style={[pulseStyles.metricValue, { color: textColor }]}>{formatCurrency(avgTicket)}</Text>
          <DeltaBadge
            current={avgTicket}
            previous={yesterdayAvgTicket}
            successColor={successColor}
            dangerColor={dangerColor}
          />
        </View>

        <View style={pulseStyles.metricCell}>
          <View style={pulseStyles.metricHeader}>
            <Star size={12} color="#F59E0B" />
            <Text style={[pulseStyles.metricLabel, { color: textSecondary }]}>Meilleure vente</Text>
          </View>
          {bestSale ? (
            <>
              <Text style={[pulseStyles.metricValue, { color: textColor }]}>{formatCurrency(bestSale.amount)}</Text>
              <Text style={[pulseStyles.bestSaleName, { color: textTertiary }]} numberOfLines={1}>{bestSale.name}</Text>
            </>
          ) : (
            <Text style={[pulseStyles.metricValueMuted, { color: textTertiary }]}>—</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default React.memo(DailyPulse);

const pulseStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    ...SHADOWS.MD,
  },
  accentStripe: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: RADIUS.XL,
    borderTopRightRadius: RADIUS.XL,
  },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: SPACING.XL,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.MD,
  },
  pulseIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.MD,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  headerSub: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    marginTop: 1,
  },
  vsYesterday: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.XS,
    borderRadius: RADIUS.ROUND,
  },
  vsText: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  mainMetric: {
    marginBottom: SPACING.MD,
  },
  mainValue: {
    fontSize: TYPOGRAPHY.SIZE.DISPLAY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.EXTRABOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.TIGHT,
  },
  mainLabel: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    marginTop: SPACING.XXS,
  },
  sparklineRow: {
    marginBottom: SPACING.XL,
    position: 'relative' as const,
  },
  sparklineLabelCol: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    width: 220,
    marginTop: 2,
  },
  sparklineLabel: {
    fontSize: 8,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  metricsGrid: {
    flexDirection: 'row' as const,
    borderTopWidth: 1,
    paddingTop: SPACING.XL,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center' as const,
    gap: SPACING.XS,
  },
  metricCellBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  metricValueMuted: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  bestSaleName: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    maxWidth: 90,
    textAlign: 'center' as const,
  },
  deltaBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: RADIUS.ROUND,
  },
  deltaText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
});
