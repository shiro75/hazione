import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Target, Calendar, Zap, TrendingUp } from 'lucide-react-native';
import ProgressBar from '@/components/charts/ProgressBar';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';

interface RevenueGoalProgressProps {
  currentRevenue: number;
  explicitTarget?: number;
  last3MonthsRevenues: number[];
  daysElapsed: number;
  daysInMonth: number;
  formatCurrency: (v: number) => string;
  primaryColor: string;
  textColor: string;
  textSecondary: string;
  textTertiary: string;
  cardBg: string;
  cardBorder: string;
  successColor?: string;
  warningColor?: string;
  dangerColor?: string;
}

function RevenueGoalProgress({
  currentRevenue,
  explicitTarget,
  last3MonthsRevenues,
  daysElapsed,
  daysInMonth,
  formatCurrency,
  primaryColor,
  textColor,
  textSecondary,
  textTertiary,
  cardBg,
  cardBorder,
  successColor = '#059669',
  warningColor = '#F59E0B',
  dangerColor = '#EF4444',
}: RevenueGoalProgressProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const target = useMemo(() => {
    if (explicitTarget && explicitTarget > 0) return explicitTarget;
    const validMonths = last3MonthsRevenues.filter(v => v > 0);
    if (validMonths.length === 0) return 0;
    const avg = validMonths.reduce((s, v) => s + v, 0) / validMonths.length;
    return Math.round(avg * 1.1);
  }, [explicitTarget, last3MonthsRevenues]);

  const isAutoTarget = !explicitTarget || explicitTarget <= 0;

  const progress = useMemo(() => {
    if (target <= 0) return 0;
    return Math.min(currentRevenue / target, 1.5);
  }, [currentRevenue, target]);

  const progressPct = Math.round(Math.min(progress, 1) * 100);
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
  const isAchieved = progress >= 1;

  const projectedRevenue = useMemo(() => {
    if (daysElapsed <= 0) return 0;
    return (currentRevenue / daysElapsed) * daysInMonth;
  }, [currentRevenue, daysElapsed, daysInMonth]);

  const willReachTarget = projectedRevenue >= target;

  const dailyNeeded = useMemo(() => {
    if (daysRemaining <= 0 || isAchieved) return 0;
    return (target - currentRevenue) / daysRemaining;
  }, [target, currentRevenue, daysRemaining, isAchieved]);

  const statusColor = useMemo(() => {
    if (isAchieved) return successColor;
    if (progress >= 0.7) return primaryColor;
    if (progress >= 0.4) return warningColor;
    return dangerColor;
  }, [isAchieved, progress, primaryColor, successColor, warningColor, dangerColor]);

  const dynamicMessage = useMemo(() => {
    if (target <= 0) return "Définissez un objectif pour suivre votre progression";
    if (isAchieved) return "Objectif atteint ! Continuez sur cette lancée.";
    if (daysRemaining === 0) return `Objectif non atteint — ${formatCurrency(target - currentRevenue)} manquants`;
    if (willReachTarget) return `Au rythme actuel, vous atteindrez ${formatCurrency(Math.round(projectedRevenue))} ce mois`;
    return `Il faut ${formatCurrency(Math.round(dailyNeeded))}/jour pour atteindre l'objectif`;
  }, [target, isAchieved, daysRemaining, willReachTarget, projectedRevenue, dailyNeeded, currentRevenue, formatCurrency]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: Math.min(progress, 1), duration: 800, useNativeDriver: false }),
    ]).start();
  }, [fadeAnim, progressAnim, progress]);

  if (target <= 0) {
    return (
      <View style={[goalStyles.container, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={goalStyles.headerRow}>
          <View style={[goalStyles.iconWrap, { backgroundColor: primaryColor + '15' }]}>
            <Target size={14} color={primaryColor} strokeWidth={2.5} />
          </View>
          <Text style={[goalStyles.title, { color: textColor }]}>Objectif CA mensuel</Text>
        </View>
        <Text style={[goalStyles.emptyMessage, { color: textTertiary }]}>
          Pas assez de données pour calculer un objectif automatique. Enregistrez des ventes pour commencer.
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[goalStyles.container, { backgroundColor: cardBg, borderColor: cardBorder, opacity: fadeAnim }]}>
      <View style={goalStyles.headerRow}>
        <View style={goalStyles.headerLeft}>
          <View style={[goalStyles.iconWrap, { backgroundColor: statusColor + '15' }]}>
            <Target size={14} color={statusColor} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={[goalStyles.title, { color: textColor }]}>Objectif CA mensuel</Text>
            {isAutoTarget && (
              <Text style={[goalStyles.autoLabel, { color: textTertiary }]}>Calculé automatiquement (moy. 3 mois × 1.1)</Text>
            )}
          </View>
        </View>
        {isAchieved && (
          <View style={[goalStyles.achievedBadge, { backgroundColor: successColor + '15' }]}>
            <Zap size={11} color={successColor} />
            <Text style={[goalStyles.achievedText, { color: successColor }]}>Atteint !</Text>
          </View>
        )}
      </View>

      <View style={goalStyles.amountRow}>
        <Text style={[goalStyles.currentAmount, { color: textColor }]}>{formatCurrency(currentRevenue)}</Text>
        <Text style={[goalStyles.separator, { color: textTertiary }]}>/</Text>
        <Text style={[goalStyles.targetAmount, { color: textSecondary }]}>{formatCurrency(target)}</Text>
      </View>

      <View style={goalStyles.progressSection}>
        <View style={[goalStyles.progressTrack, { backgroundColor: cardBorder }]}>
          <ProgressBar
            progress={Math.min(progress, 1)}
            color={statusColor}
            backgroundColor="transparent"
            height={8}
          />
        </View>
        <View style={goalStyles.progressLabels}>
          <Text style={[goalStyles.progressPct, { color: statusColor }]}>{progressPct}%</Text>
          <View style={goalStyles.daysRow}>
            <Calendar size={10} color={textTertiary} />
            <Text style={[goalStyles.daysText, { color: textTertiary }]}>
              {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={[goalStyles.messageBox, { backgroundColor: statusColor + '08', borderColor: statusColor + '20' }]}>
        <TrendingUp size={12} color={statusColor} />
        <Text style={[goalStyles.messageText, { color: statusColor }]}>{dynamicMessage}</Text>
      </View>
    </Animated.View>
  );
}

export default React.memo(RevenueGoalProgress);

const goalStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    ...SHADOWS.SM,
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
    flex: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.MD,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  autoLabel: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    marginTop: 1,
  },
  achievedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.XS,
    borderRadius: RADIUS.ROUND,
  },
  achievedText: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  amountRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: SPACING.SM,
    marginBottom: SPACING.XL,
  },
  currentAmount: {
    fontSize: TYPOGRAPHY.SIZE.HEADING,
    fontWeight: TYPOGRAPHY.WEIGHT.EXTRABOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.TIGHT,
  },
  separator: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.REGULAR,
  },
  targetAmount: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  progressSection: {
    gap: SPACING.SM,
    marginBottom: SPACING.XL,
  },
  progressTrack: {
    borderRadius: RADIUS.ROUND,
    overflow: 'hidden' as const,
  },
  progressLabels: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  progressPct: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  daysRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  daysText: {
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  messageBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.SM,
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.LG,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
  },
  messageText: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    flex: 1,
  },
  emptyMessage: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    textAlign: 'center' as const,
    paddingVertical: SPACING.XL,
  },
});
