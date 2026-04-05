import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { TrendingUp, TrendingDown, Minus, Eye } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatPercent } from '@/utils/format';
import { getKpiStatus, getKpiStatusFromChange, getKpiColorScheme, type KpiStatus } from '@/utils/kpiColors';
import SparklineChart from '@/components/dashboard/charts/SparklineChart';
import ProgressBar from '@/components/dashboard/charts/ProgressBar';
import { TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/constants/theme';

interface KpiCardAdvancedProps {
  title: string;
  value: string;
  numericValue?: number;
  change?: number;
  icon: React.ReactNode;
  accentColor?: string;
  onPress?: () => void;
  sparklineData?: number[];
  target?: number;
  targetLabel?: string;
  ctaLabel?: string;
  ctaOnPress?: () => void;
  statusOverride?: KpiStatus;
  invertThresholds?: boolean;
  unit?: string;
}

export default React.memo(function KpiCardAdvanced({
  title,
  value,
  numericValue,
  change,
  icon,
  accentColor,
  onPress,
  sparklineData,
  target,
  targetLabel,
  ctaLabel,
  ctaOnPress,
  statusOverride,
  invertThresholds = false,
  unit,
}: KpiCardAdvancedProps) {
  const { colors } = useTheme();
  const isPositive = (change ?? 0) >= 0;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const status: KpiStatus = useMemo(() => {
    if (statusOverride) return statusOverride;
    if (numericValue !== undefined && target !== undefined) {
      return getKpiStatus(numericValue, target, invertThresholds);
    }
    return getKpiStatusFromChange(change);
  }, [statusOverride, numericValue, target, change, invertThresholds]);

  const colorScheme = useMemo(() => getKpiColorScheme(status, colors), [status, colors]);

  const progress = useMemo(() => {
    if (target && target > 0 && numericValue !== undefined) {
      return Math.min(numericValue / target, 1.2);
    }
    return undefined;
  }, [numericValue, target]);

  const progressPercent = useMemo(() => {
    if (progress !== undefined) return Math.round(progress * 100);
    return undefined;
  }, [progress]);

  const sparkColor = accentColor || colorScheme.sparklineColor;

  const isCriticalNegative = status === 'critical' && (numericValue !== undefined && numericValue < 0);

  const Wrapper: React.ElementType = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  const handleCtaPress = useCallback(() => {
    if (ctaOnPress) ctaOnPress();
  }, [ctaOnPress]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <Wrapper
        {...wrapperProps}
        style={[
          styles.card,
          {
            backgroundColor: isCriticalNegative ? colorScheme.cardBg : colors.card,
            borderColor: isCriticalNegative ? colorScheme.borderColor : colors.cardBorder,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: accentColor ? `${accentColor}18` : colors.primaryLight }]}>
            {icon}
          </View>

          {change !== undefined && (
            <View style={[styles.badge, { backgroundColor: colorScheme.badgeBg }]}>
              {isPositive ? (
                <TrendingUp size={11} color={colorScheme.badgeText} strokeWidth={2.5} />
              ) : change < 0 ? (
                <TrendingDown size={11} color={colorScheme.badgeText} strokeWidth={2.5} />
              ) : (
                <Minus size={11} color={colorScheme.badgeText} strokeWidth={2.5} />
              )}
              <Text style={[styles.badgeText, { color: colorScheme.badgeText }]}>
                {formatPercent(change)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.valueRow}>
          <Text
            style={[
              styles.value,
              { color: isCriticalNegative ? colorScheme.textColor : colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </Text>
          {unit ? (
            <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text>
          ) : null}
        </View>

        <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>

        {target !== undefined && progress !== undefined && progressPercent !== undefined && (
          <View style={styles.targetSection}>
            <View style={styles.targetHeader}>
              <Text style={[styles.targetLabel, { color: colors.textTertiary }]}>
                {targetLabel || 'Objectif'}
              </Text>
              <Text
                style={[
                  styles.targetPercent,
                  { color: colorScheme.textColor },
                ]}
              >
                {progressPercent}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
              <ProgressBar
                progress={Math.min(progress, 1)}
                color={colorScheme.progressColor}
                backgroundColor={colors.borderLight}
                height={4}
              />
            </View>
          </View>
        )}

        {sparklineData && sparklineData.length >= 2 && (
          <View style={styles.sparklineWrap}>
            <SparklineChart
              data={sparklineData}
              color={sparkColor}
              width={120}
              height={28}
              strokeWidth={1.5}
              showArea={true}
            />
          </View>
        )}

        {isCriticalNegative && ctaLabel && ctaOnPress && (
          <TouchableOpacity
            onPress={handleCtaPress}
            activeOpacity={0.7}
            style={[styles.ctaButton, { backgroundColor: `${colors.danger}15` }]}
          >
            <Eye size={12} color={colors.danger} strokeWidth={2} />
            <Text style={[styles.ctaText, { color: colors.danger }]}>{ctaLabel}</Text>
          </TouchableOpacity>
        )}
      </Wrapper>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.LG,
    minWidth: 110,
    flex: 1,
    overflow: 'hidden' as const,
    ...SHADOWS.MD,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: SPACING.SM,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.MD,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XXS,
    borderRadius: RADIUS.ROUND,
    gap: 3,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  valueRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 3,
  },
  value: {
    fontSize: TYPOGRAPHY.SIZE.BODY_LARGE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.SNUG,
    marginBottom: SPACING.XXS,
  },
  unit: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  title: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  targetSection: {
    marginTop: SPACING.MD,
    gap: SPACING.XS,
  },
  targetHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  targetLabel: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE,
  },
  targetPercent: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  progressTrack: {
    borderRadius: RADIUS.ROUND,
    overflow: 'hidden' as const,
  },
  sparklineWrap: {
    marginTop: SPACING.MD,
    alignItems: 'flex-start' as const,
  },
  ctaButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    marginTop: SPACING.MD,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.LG,
    borderRadius: RADIUS.MD,
  },
  ctaText: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
});
