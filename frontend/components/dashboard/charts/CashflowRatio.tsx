import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUpRight, ArrowDownRight, Scale } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';

interface CashflowRatioProps {
  encaissements: number;
  decaissements: number;
  formatCurrency: (v: number) => string;
}

function CashflowRatio({
  encaissements,
  decaissements,
  formatCurrency: fmt,
}: CashflowRatioProps) {
  const { colors } = useTheme();

  const ratio = useMemo(() => {
    if (decaissements === 0) return encaissements > 0 ? 999 : 0;
    return encaissements / decaissements;
  }, [encaissements, decaissements]);

  const pct = useMemo(() => {
    const total = encaissements + decaissements;
    if (total === 0) return 50;
    return Math.max(5, Math.min(95, (encaissements / total) * 100));
  }, [encaissements, decaissements]);

  const status = useMemo((): { label: string; color: string; bg: string } => {
    if (ratio >= 1.5) return { label: 'Excellent', color: '#059669', bg: '#ECFDF5' };
    if (ratio >= 1.1) return { label: 'Bon', color: '#059669', bg: '#ECFDF5' };
    if (ratio >= 0.9) return { label: 'Équilibré', color: '#F59E0B', bg: '#FEF3C7' };
    if (ratio >= 0.7) return { label: 'À surveiller', color: '#F59E0B', bg: '#FEF3C7' };
    return { label: 'Critique', color: '#EF4444', bg: '#FEF2F2' };
  }, [ratio]);

  const ratioDisplay = useMemo(() => {
    if (ratio >= 999) return '∞';
    return ratio.toFixed(2);
  }, [ratio]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
            <Scale size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Ratio de couverture</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
              Encaissements / Décaissements
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.ratioRow}>
        <Text style={[styles.ratioValue, { color: status.color }]}>{ratioDisplay}</Text>
        <Text style={[styles.ratioUnit, { color: colors.textTertiary }]}>×</Text>
      </View>

      <View style={styles.barSection}>
        <View style={[styles.barTrack, { backgroundColor: colors.borderLight }]}>
          <View
            style={[
              styles.barFillLeft,
              {
                width: `${pct}%` as `${number}%`,
                backgroundColor: '#059669',
              },
            ]}
          />
          <View
            style={[
              styles.barFillRight,
              {
                width: `${100 - pct}%` as `${number}%`,
                backgroundColor: '#EF4444',
              },
            ]}
          />
        </View>
        <View style={styles.barLabels}>
          <View style={styles.barLabelRow}>
            <ArrowUpRight size={12} color="#059669" />
            <Text style={[styles.barLabelText, { color: '#059669' }]}>
              {fmt(encaissements)}
            </Text>
          </View>
          <View style={styles.barLabelRow}>
            <ArrowDownRight size={12} color="#EF4444" />
            <Text style={[styles.barLabelText, { color: '#EF4444' }]}>
              {fmt(decaissements)}
            </Text>
          </View>
        </View>
      </View>

      {ratio < 1 && (
        <View style={[styles.alertRow, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
          <Text style={styles.alertText}>
            Vos décaissements dépassent vos encaissements de{' '}
            <Text style={styles.alertBold}>{fmt(decaissements - encaissements)}</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

export default React.memo(CashflowRatio);

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    gap: SPACING.LG,
    ...SHADOWS.SM,
  },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.LG,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.LG,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: TYPOGRAPHY.SIZE.BODY_LARGE,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    marginTop: 1,
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
  ratioRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: SPACING.XS,
  },
  ratioValue: {
    fontSize: 36,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  ratioUnit: {
    fontSize: TYPOGRAPHY.SIZE.TITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  barSection: {
    gap: SPACING.MD,
  },
  barTrack: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row' as const,
    overflow: 'hidden' as const,
  },
  barFillLeft: {
    height: '100%' as const,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    opacity: 0.8,
  },
  barFillRight: {
    height: '100%' as const,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    opacity: 0.5,
  },
  barLabels: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  barLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.XS,
  },
  barLabelText: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  alertRow: {
    borderWidth: 1,
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
  },
  alertText: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    color: '#DC2626',
    lineHeight: 16,
  },
  alertBold: {
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
});
