import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TrendingUp, TrendingDown, ShoppingBag } from 'lucide-react-native';
import SparklineChart from '@/components/charts/SparklineChart';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';

interface AverageBasketCardProps {
  data: { label: string; value: number }[];
  currentValue: number;
  previousValue: number;
  formatCurrency: (v: number) => string;
  primaryColor?: string;
  textColor: string;
  textSecondary: string;
  textTertiary: string;
  cardBg: string;
  cardBorder: string;
  successColor?: string;
  dangerColor?: string;
}

function AverageBasketCard({
  data,
  currentValue,
  previousValue,
  formatCurrency,
  primaryColor: _primaryColor,
  textColor,
  textSecondary,
  textTertiary,
  cardBg,
  cardBorder,
  successColor = '#059669',
  dangerColor = '#EF4444',
}: AverageBasketCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const variation = useMemo(() => {
    if (previousValue === 0 && currentValue === 0) return 0;
    if (previousValue === 0) return 100;
    return ((currentValue - previousValue) / previousValue) * 100;
  }, [currentValue, previousValue]);

  const isUp = variation >= 0;
  const accentColor = isUp ? successColor : dangerColor;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  const sparklineData = useMemo(() => data.map(d => d.value), [data]);
  const sparklineLabels = useMemo(() => {
    if (data.length <= 2) return data.map(d => d.label);
    return [data[0].label, data[Math.floor(data.length / 2)].label, data[data.length - 1].label];
  }, [data]);

  const minVal = useMemo(() => {
    const vals = data.filter(d => d.value > 0).map(d => d.value);
    return vals.length > 0 ? Math.min(...vals) : 0;
  }, [data]);

  const maxVal = useMemo(() => {
    const vals = data.filter(d => d.value > 0).map(d => d.value);
    return vals.length > 0 ? Math.max(...vals) : 0;
  }, [data]);

  return (
    <Animated.View style={[s.container, { backgroundColor: cardBg, borderColor: cardBorder, opacity: fadeAnim }]}>
      <View style={s.headerRow}>
        <View style={[s.iconWrap, { backgroundColor: '#7C3AED' + '15' }]}>
          <ShoppingBag size={16} color="#7C3AED" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: textColor }]}>Panier moyen</Text>
          <Text style={[s.subtitle, { color: textTertiary }]}>Évolution sur les dernières périodes</Text>
        </View>
      </View>

      <View style={s.valueRow}>
        <View>
          <Text style={[s.mainValue, { color: textColor }]}>{formatCurrency(currentValue)}</Text>
          <Text style={[s.periodLabel, { color: textTertiary }]}>Période actuelle</Text>
        </View>
        {(currentValue > 0 || previousValue > 0) && (
          <View style={[s.variationBadge, { backgroundColor: accentColor + '12' }]}>
            <TrendIcon size={12} color={accentColor} strokeWidth={2.5} />
            <Text style={[s.variationText, { color: accentColor }]}>
              {previousValue === 0 ? 'Nouveau' : `${isUp ? '+' : ''}${Math.round(variation)}%`}
            </Text>
          </View>
        )}
      </View>

      {sparklineData.some(v => v > 0) && (
        <View style={s.sparklineSection}>
          <SparklineChart
            data={sparklineData}
            color="#7C3AED"
            width={240}
            height={44}
            strokeWidth={2}
            showArea={true}
            smooth={true}
            showEndDot={true}
          />
          <View style={s.sparklineLabels}>
            {sparklineLabels.map((label, i) => (
              <Text key={i} style={[s.sparklineLabelText, { color: textTertiary }]}>{label}</Text>
            ))}
          </View>
        </View>
      )}

      {(minVal > 0 || maxVal > 0) && (
        <View style={[s.rangeRow, { borderTopColor: cardBorder }]}>
          <View style={s.rangeItem}>
            <Text style={[s.rangeLabel, { color: textTertiary }]}>Min</Text>
            <Text style={[s.rangeValue, { color: textSecondary }]}>{formatCurrency(minVal)}</Text>
          </View>
          <View style={[s.rangeDivider, { backgroundColor: cardBorder }]} />
          <View style={s.rangeItem}>
            <Text style={[s.rangeLabel, { color: textTertiary }]}>Max</Text>
            <Text style={[s.rangeValue, { color: textSecondary }]}>{formatCurrency(maxVal)}</Text>
          </View>
          <View style={[s.rangeDivider, { backgroundColor: cardBorder }]} />
          <View style={s.rangeItem}>
            <Text style={[s.rangeLabel, { color: textTertiary }]}>Variation</Text>
            <Text style={[s.rangeValue, { color: accentColor }]}>
              {previousValue === 0 ? '—' : `${isUp ? '+' : ''}${Math.round(variation)}%`}
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

export default React.memo(AverageBasketCard);

const s = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    ...SHADOWS.SM,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.LG,
    marginBottom: SPACING.XL,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.MD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    marginTop: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.XL,
  },
  mainValue: {
    fontSize: TYPOGRAPHY.SIZE.DISPLAY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.EXTRABOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.TIGHT,
  },
  periodLabel: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    marginTop: 2,
  },
  variationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.ROUND,
  },
  variationText: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  sparklineSection: {
    marginBottom: SPACING.XL,
  },
  sparklineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 240,
    marginTop: 3,
  },
  sparklineLabelText: {
    fontSize: 8,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  rangeRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: SPACING.XL,
  },
  rangeItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  rangeDivider: {
    width: 1,
    height: '100%',
  },
  rangeLabel: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  rangeValue: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
});
