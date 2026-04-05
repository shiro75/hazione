import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { Shield, AlertTriangle, CheckCircle, Info, X } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';

interface ScoreComponent {
  label: string;
  points: number;
  maxPoints: number;
  status: 'good' | 'warning' | 'danger';
  description: string;
  currentValue: string;
}

export interface FinancialHealthScoreProps {
  coverageRatio: number;
  runwayMonths: number;
  unpaidRate: number;
  revenueTrend: 'up' | 'stable' | 'down';
  grossMarginPositive: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#059669';
  if (score >= 40) return '#D97706';
  return '#DC2626';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellente';
  if (score >= 70) return 'Bonne';
  if (score >= 40) return 'À surveiller';
  return 'Critique';
}

function getScoreBg(score: number): string {
  if (score >= 70) return 'rgba(5,150,105,0.08)';
  if (score >= 40) return 'rgba(217,119,6,0.08)';
  return 'rgba(220,38,38,0.08)';
}

function getScoreBorder(score: number): string {
  if (score >= 70) return 'rgba(5,150,105,0.2)';
  if (score >= 40) return 'rgba(217,119,6,0.2)';
  return 'rgba(220,38,38,0.2)';
}

function getStatusColor(status: 'good' | 'warning' | 'danger'): string {
  if (status === 'good') return '#059669';
  if (status === 'warning') return '#D97706';
  return '#DC2626';
}

function getStatusBg(status: 'good' | 'warning' | 'danger'): string {
  if (status === 'good') return 'rgba(5,150,105,0.08)';
  if (status === 'warning') return 'rgba(217,119,6,0.08)';
  return 'rgba(220,38,38,0.08)';
}

export default function FinancialHealthScore({
  coverageRatio,
  runwayMonths,
  unpaidRate,
  revenueTrend,
  grossMarginPositive,
}: FinancialHealthScoreProps) {
  const { colors } = useTheme();
  const [showDetail, setShowDetail] = useState(false);

  const { score, components } = useMemo(() => {
    const comps: ScoreComponent[] = [];

    let coveragePoints = 0;
    if (coverageRatio >= 1.5) coveragePoints = 30;
    else if (coverageRatio >= 1) coveragePoints = 20;
    else if (coverageRatio >= 0.5) coveragePoints = 10;
    comps.push({
      label: 'Ratio de couverture',
      points: coveragePoints,
      maxPoints: 30,
      status: coveragePoints >= 20 ? 'good' : coveragePoints >= 10 ? 'warning' : 'danger',
      description: 'Rapport entre vos encaissements et vos décaissements.',
      currentValue: `${coverageRatio.toFixed(2)}×`,
    });

    let runwayPoints = 0;
    if (runwayMonths >= 6) runwayPoints = 25;
    else if (runwayMonths >= 3) runwayPoints = 15;
    else if (runwayMonths >= 1) runwayPoints = 8;
    comps.push({
      label: 'Runway',
      points: runwayPoints,
      maxPoints: 25,
      status: runwayPoints >= 15 ? 'good' : runwayPoints >= 8 ? 'warning' : 'danger',
      description: 'Nombre de mois que votre solde peut couvrir.',
      currentValue: `${Math.round(runwayMonths)} mois`,
    });

    let unpaidPoints = 0;
    if (unpaidRate < 0.1) unpaidPoints = 20;
    else if (unpaidRate < 0.3) unpaidPoints = 10;
    else if (unpaidRate < 0.6) unpaidPoints = 5;
    comps.push({
      label: 'Taux d\'impayés',
      points: unpaidPoints,
      maxPoints: 20,
      status: unpaidPoints >= 10 ? 'good' : unpaidPoints >= 5 ? 'warning' : 'danger',
      description: 'Part des impayés dans votre CA mensuel.',
      currentValue: `${Math.round(unpaidRate * 100)}%`,
    });

    let trendPoints = 0;
    if (revenueTrend === 'up') trendPoints = 15;
    else if (revenueTrend === 'stable') trendPoints = 10;
    const trendLabels = { up: 'haussière', stable: 'stable', down: 'baissière' };
    comps.push({
      label: 'Tendance CA',
      points: trendPoints,
      maxPoints: 15,
      status: trendPoints >= 10 ? 'good' : trendPoints > 0 ? 'warning' : 'danger',
      description: 'Évolution de votre chiffre d\'affaires sur 12 mois.',
      currentValue: trendLabels[revenueTrend],
    });

    const marginPoints = grossMarginPositive ? 10 : 0;
    comps.push({
      label: 'Marge brute positive',
      points: marginPoints,
      maxPoints: 10,
      status: marginPoints > 0 ? 'good' : 'danger',
      description: 'Votre bénéfice brut est-il positif ce mois ?',
      currentValue: grossMarginPositive ? 'oui' : 'non',
    });

    const total = comps.reduce((s, c) => s + c.points, 0);
    return { score: total, components: comps };
  }, [coverageRatio, runwayMonths, unpaidRate, revenueTrend, grossMarginPositive]);

  const strengths = useMemo(
    () => components.filter(c => c.status === 'good').sort((a, b) => b.points - a.points).slice(0, 2),
    [components],
  );
  const weaknesses = useMemo(
    () => components.filter(c => c.status === 'danger').sort((a, b) => a.points - b.points).slice(0, 1),
    [components],
  );
  const warnings = useMemo(
    () => weaknesses.length === 0
      ? components.filter(c => c.status === 'warning').sort((a, b) => a.points - b.points).slice(0, 1)
      : weaknesses,
    [components, weaknesses],
  );

  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  const gaugeSize = 80;
  const strokeWidth = 7;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / 100, 1);
  const strokeDashoffset = circumference * (1 - progress);

  const openDetail = useCallback(() => setShowDetail(true), []);
  const closeDetail = useCallback(() => setShowDetail(false), []);

  return (
    <>
      <View style={[
        styles.container,
        {
          backgroundColor: getScoreBg(score),
          borderColor: getScoreBorder(score),
        },
      ]}>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={openDetail}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="health-score-info-btn"
        >
          <Info size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.topRow}>
          <View style={styles.gaugeWrap}>
            <Svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
              <Circle
                cx={gaugeSize / 2}
                cy={gaugeSize / 2}
                r={radius}
                stroke={colors.borderLight}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                transform={`rotate(-90 ${gaugeSize / 2} ${gaugeSize / 2})`}
              />
              <Circle
                cx={gaugeSize / 2}
                cy={gaugeSize / 2}
                r={radius}
                stroke={scoreColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(-90 ${gaugeSize / 2} ${gaugeSize / 2})`}
              />
            </Svg>
            <View style={styles.gaugeCenter}>
              <Text style={[styles.gaugeScore, { color: scoreColor }]}>{score}</Text>
            </View>
          </View>

          <View style={styles.infoCol}>
            <View style={styles.labelRow}>
              <Shield size={14} color={scoreColor} />
              <Text style={[styles.labelTitle, { color: colors.textTertiary }]}>Santé financière</Text>
            </View>
            <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
            <Text style={[styles.scoreSubtext, { color: colors.textTertiary }]}>{score} / 100</Text>
          </View>
        </View>

        <View style={styles.progressBarSection}>
          <View style={[styles.progressBarTrack, { backgroundColor: colors.borderLight }]}>
            <View style={[styles.progressBarFill, { width: `${Math.min(score, 100)}%` as `${number}%`, backgroundColor: scoreColor }]} />
          </View>
          <View style={styles.progressBarLabels}>
            <Text style={[styles.progressBarPct, { color: scoreColor }]}>{score}%</Text>
            <Text style={[styles.progressBarMax, { color: colors.textTertiary }]}>100</Text>
          </View>
        </View>

        {(strengths.length > 0 || warnings.length > 0) && (
          <View style={[styles.insightsRow, { borderTopColor: getScoreBorder(score) }]}>
            {strengths.map((s, i) => (
              <View key={`s-${i}`} style={styles.insightItem}>
                <CheckCircle size={12} color="#059669" />
                <Text style={[styles.insightText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {s.label} ({s.points}/{s.maxPoints})
                </Text>
              </View>
            ))}
            {warnings.map((w, i) => (
              <View key={`w-${i}`} style={styles.insightItem}>
                <AlertTriangle size={12} color={w.status === 'danger' ? '#DC2626' : '#D97706'} />
                <Text style={[styles.insightText, { color: w.status === 'danger' ? '#DC2626' : '#D97706' }]} numberOfLines={1}>
                  {w.label} ({w.points}/{w.maxPoints})
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal
        visible={showDetail}
        animationType="slide"
        transparent
        onRequestClose={closeDetail}
      >
        <Pressable style={styles.modalOverlay} onPress={closeDetail}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Comment est calculé votre score ?</Text>
              <TouchableOpacity onPress={closeDetail} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modalScoreSummary, { backgroundColor: getScoreBg(score), borderColor: getScoreBorder(score) }]}>
              <Text style={[styles.modalScoreValue, { color: scoreColor }]}>{score} / 100</Text>
              <Text style={[styles.modalScoreLabel, { color: scoreColor }]}>Santé financière : {scoreLabel}</Text>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {components.map((comp, idx) => (
                <View key={idx} style={[styles.compRow, { borderColor: colors.borderLight }]}>
                  <View style={styles.compHeader}>
                    <View style={[styles.compDot, { backgroundColor: getStatusColor(comp.status) }]} />
                    <Text style={[styles.compLabel, { color: colors.text }]}>{comp.label}</Text>
                    <View style={[styles.compPointsBadge, { backgroundColor: getStatusBg(comp.status) }]}>
                      <Text style={[styles.compPointsText, { color: getStatusColor(comp.status) }]}>
                        {comp.points} / {comp.maxPoints} pts
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.compBarTrack, { backgroundColor: colors.borderLight }]}>
                    <View style={[
                      styles.compBarFill,
                      {
                        width: `${Math.round((comp.points / comp.maxPoints) * 100)}%` as `${number}%`,
                        backgroundColor: getStatusColor(comp.status),
                      },
                    ]} />
                  </View>
                  <Text style={[styles.compDesc, { color: colors.textTertiary }]}>
                    {comp.description} Actuellement : {comp.currentValue} → {comp.points} pt{comp.points > 1 ? 's' : ''}
                  </Text>
                </View>
              ))}

              <View style={[styles.modalFooter, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                <Info size={14} color="#0284C7" />
                <Text style={styles.modalFooterText}>
                  Améliorez votre score en encaissant vos factures impayées et en réduisant vos dépenses.
                </Text>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    ...SHADOWS.SM,
  },
  infoButton: {
    position: 'absolute',
    top: SPACING.XL,
    right: SPACING.XL,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XXXL,
  },
  gaugeWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  infoCol: {
    flex: 1,
    gap: SPACING.XXS,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  labelTitle: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE,
  },
  scoreLabel: {
    fontSize: TYPOGRAPHY.SIZE.TITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.SNUG,
  },
  scoreSubtext: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  progressBarSection: {
    marginTop: SPACING.XL,
    gap: SPACING.XS,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressBarLabels: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 2,
  },
  progressBarPct: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  progressBarMax: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  insightsRow: {
    marginTop: SPACING.XL,
    paddingTop: SPACING.XL,
    borderTopWidth: 1,
    gap: SPACING.MD,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  insightText: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    flex: 1,
    marginRight: 12,
  },
  modalScoreSummary: {
    borderWidth: 1,
    borderRadius: RADIUS.LG,
    padding: SPACING.XXXL,
    alignItems: 'center',
    marginBottom: 16,
    gap: SPACING.XS,
  },
  modalScoreValue: {
    fontSize: TYPOGRAPHY.SIZE.DISPLAY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.EXTRABOLD,
    letterSpacing: -0.5,
  },
  modalScoreLabel: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  modalContent: {
    flexGrow: 0,
  },
  compRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: SPACING.MD,
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
  },
  compDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compLabel: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    flex: 1,
  },
  compPointsBadge: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.XS,
    borderRadius: RADIUS.ROUND,
  },
  compPointsText: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  compBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  compBarFill: {
    height: 5,
    borderRadius: 3,
  },
  compDesc: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    lineHeight: 17,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.MD,
    padding: SPACING.XXXL,
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  modalFooterText: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    color: '#0284C7',
    flex: 1,
    lineHeight: 18,
  },
});
