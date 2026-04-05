import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Clock, AlertTriangle, ShieldCheck, TrendingDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';

interface RunwayCardProps {
  solde: number;
  monthlyExpenses: number;
  formatCurrency: (v: number) => string;
}

function RunwayCard({
  solde,
  monthlyExpenses,
  formatCurrency: fmt,
}: RunwayCardProps) {
  useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const monthsRemaining = useMemo(() => {
    if (monthlyExpenses <= 0) return solde > 0 ? 999 : 0;
    if (solde <= 0) return 0;
    return solde / monthlyExpenses;
  }, [solde, monthlyExpenses]);

  const status = useMemo((): {
    label: string;
    color: string;
    bg: string;
    borderColor: string;
    icon: typeof ShieldCheck;
    message: string;
  } => {
    if (monthsRemaining >= 6) {
      return {
        label: 'Confortable',
        color: '#059669',
        bg: '#052E16',
        borderColor: '#065F46',
        icon: ShieldCheck,
        message: 'Votre trésorerie couvre plus de 6 mois de dépenses.',
      };
    }
    if (monthsRemaining >= 3) {
      return {
        label: 'Correct',
        color: '#F59E0B',
        bg: '#451A03',
        borderColor: '#78350F',
        icon: Clock,
        message: 'Trésorerie suffisante à court terme. Surveillez vos encaissements.',
      };
    }
    if (monthsRemaining > 0) {
      return {
        label: 'Critique',
        color: '#EF4444',
        bg: '#450A0A',
        borderColor: '#7F1D1D',
        icon: AlertTriangle,
        message: 'Runway très court. Action urgente recommandée.',
      };
    }
    return {
      label: 'Épuisé',
      color: '#EF4444',
      bg: '#450A0A',
      borderColor: '#7F1D1D',
      icon: TrendingDown,
      message: 'Votre solde ne couvre pas les dépenses du mois. Voir les postes de dépenses →',
    };
  }, [monthsRemaining]);

  useEffect(() => {
    if (monthsRemaining < 3 && monthsRemaining > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [monthsRemaining, pulseAnim]);

  const monthsDisplay = useMemo(() => {
    if (monthsRemaining >= 999) return '∞';
    if (monthsRemaining <= 0) return '0';
    if (monthsRemaining < 1) return `${Math.round(monthsRemaining * 30)}j`;
    return monthsRemaining.toFixed(1);
  }, [monthsRemaining]);

  const barPct = useMemo(() => {
    const maxMonths = 12;
    return Math.max(0, Math.min(100, (Math.min(monthsRemaining, maxMonths) / maxMonths) * 100));
  }, [monthsRemaining]);

  const StatusIcon = status.icon;

  return (
    <View style={[styles.container, { backgroundColor: status.bg, borderColor: status.borderColor }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Animated.View style={{ opacity: monthsRemaining < 3 ? pulseAnim : 1 }}>
            <StatusIcon size={20} color={status.color} />
          </Animated.View>
          <Text style={[styles.title, { color: status.color + 'CC' }]}>RUNWAY</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.color + '25' }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <Text style={[styles.monthsValue, { color: status.color }]}>{monthsDisplay}</Text>
        <Text style={[styles.monthsUnit, { color: status.color + '90' }]}>
          {monthsRemaining < 1 && monthsRemaining > 0 ? '' : 'mois'}
        </Text>
      </View>

      <View style={styles.barSection}>
        <View style={[styles.barTrack, { backgroundColor: status.color + '15' }]}>
          <View
            style={[
              styles.barFill,
              {
                width: `${barPct}%` as `${number}%`,
                backgroundColor: status.color,
              },
            ]}
          />
          {[3, 6].map(threshold => {
            const pos = (threshold / 12) * 100;
            return (
              <View
                key={threshold}
                style={[
                  styles.barMarker,
                  { left: `${pos}%` as `${number}%`, backgroundColor: status.color + '40' },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.barMarkerLabels}>
          <Text style={[styles.barMarkerLabel, { color: status.color + '60' }]}>0</Text>
          <Text style={[styles.barMarkerLabel, { color: status.color + '60', left: '25%' as `${number}%` }]}>3m</Text>
          <Text style={[styles.barMarkerLabel, { color: status.color + '60', left: '50%' as `${number}%` }]}>6m</Text>
          <Text style={[styles.barMarkerLabel, { color: status.color + '60', left: '100%' as `${number}%` }]}>12m</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: status.color + '80' }]}>Solde actuel</Text>
          <Text style={[styles.detailValue, { color: status.color }]}>{fmt(solde)}</Text>
        </View>
        <View style={[styles.detailDivider, { backgroundColor: status.color + '20' }]} />
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: status.color + '80' }]}>Dép. mensuelles</Text>
          <Text style={[styles.detailValue, { color: status.color }]}>{fmt(monthlyExpenses)}</Text>
        </View>
      </View>

      <Text style={[styles.message, { color: status.color + 'AA' }]}>{status.message}</Text>
    </View>
  );
}

export default React.memo(RunwayCard);

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    gap: SPACING.LG,
  },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.MD,
  },
  title: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    letterSpacing: 1.5,
  },
  statusBadge: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.ROUND,
  },
  statusText: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  mainRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: SPACING.MD,
  },
  monthsValue: {
    fontSize: 48,
    fontWeight: '800' as const,
    letterSpacing: -2,
  },
  monthsUnit: {
    fontSize: TYPOGRAPHY.SIZE.TITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  barSection: {
    gap: SPACING.SM,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'visible' as const,
    position: 'relative' as const,
  },
  barFill: {
    height: '100%' as const,
    borderRadius: 4,
    opacity: 0.85,
  },
  barMarker: {
    position: 'absolute' as const,
    top: -2,
    width: 1.5,
    height: 12,
    borderRadius: 1,
  },
  barMarkerLabels: {
    position: 'relative' as const,
    height: 14,
  },
  barMarkerLabel: {
    position: 'absolute' as const,
    fontSize: 8,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    transform: [{ translateX: -6 }],
  },
  detailsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.LG,
  },
  detailItem: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  detailDivider: {
    width: 1,
    height: 28,
    borderRadius: 1,
  },
  message: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    lineHeight: 17,
  },
});
