import { ThemeColors } from '@/types';

export type KpiStatus = 'good' | 'medium' | 'critical';

export interface KpiColorScheme {
  status: KpiStatus;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  cardBg: string;
  progressColor: string;
  sparklineColor: string;
}

export function getKpiStatus(
  value: number,
  target?: number,
  invertThresholds = false,
): KpiStatus {
  if (target && target > 0) {
    const ratio = value / target;
    if (invertThresholds) {
      if (ratio >= 1) return 'critical';
      if (ratio >= 0.7) return 'medium';
      return 'good';
    }
    if (ratio >= 0.8) return 'good';
    if (ratio >= 0.5) return 'medium';
    return 'critical';
  }

  if (value < 0) return 'critical';
  if (value === 0) return 'medium';
  return 'good';
}

export function getKpiStatusFromChange(change?: number): KpiStatus {
  if (change === undefined) return 'medium';
  if (change >= 5) return 'good';
  if (change >= -5) return 'medium';
  return 'critical';
}

export function getKpiColorScheme(
  status: KpiStatus,
  colors: ThemeColors,
): KpiColorScheme {
  switch (status) {
    case 'good':
      return {
        status,
        textColor: colors.success,
        badgeBg: colors.successLight,
        badgeText: colors.success,
        borderColor: colors.cardBorder,
        cardBg: colors.card,
        progressColor: colors.success,
        sparklineColor: colors.success,
      };
    case 'medium':
      return {
        status,
        textColor: colors.warning,
        badgeBg: colors.warningLight,
        badgeText: colors.warning,
        borderColor: colors.cardBorder,
        cardBg: colors.card,
        progressColor: colors.warning,
        sparklineColor: colors.warning,
      };
    case 'critical':
      return {
        status,
        textColor: colors.danger,
        badgeBg: colors.dangerLight,
        badgeText: colors.danger,
        borderColor: `${colors.danger}40`,
        cardBg: `${colors.danger}08`,
        progressColor: colors.danger,
        sparklineColor: colors.danger,
      };
  }
}
