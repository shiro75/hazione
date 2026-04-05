/**
 * components/dashboard/AnalysisTab.tsx
 *
 * Onglet "Analyse" du tableau de bord.
 * Sections :
 *   1. CA vs Dépenses 6 mois (RevenueVsExpensesChart)
 *   2. Tendance CA 12 mois avec régression linéaire
 *   3. Classement ABC des produits avec sparklines 7j et variantes
 *   4. Marge par catégorie (HorizontalBarChart)
 *   5. Fidélité & rétention clients (ClientDonut)
 *   6. Heure de pointe (HourlyBarChart)
 *   7. Panier moyen (AverageBasketCard)
 *   8. Exports PDF
 *   9. Comparaison avec la période précédente
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, LayoutAnimation,
} from 'react-native';
import {
  Users, Download, ArrowUpRight, ArrowDownRight, ChevronDown, Lightbulb,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatCurrencyInteger } from '@/utils/format';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS, SEMANTIC_COLORS } from '@/constants/theme';
import SparklineChart from '@/components/dashboard/charts/SparklineChart';
import RevenueTrendChart from '@/components/dashboard/charts/RevenueTrendChart';
import RevenueVsExpensesChart from '@/components/dashboard/charts/RevenueVsExpensesChart';
import AverageBasketCard from '@/components/dashboard/charts/AverageBasketCard';
import {
  HorizontalBarChart, ClientDonut, LegendRow, HourlyBarChart,
} from '@/components/dashboard/charts/DashboardCharts';
import ActionableEmptyState from '@/components/ActionableEmptyState';
import CompactSummaryCard from '@/components/CompactSummaryCard';
import useChartState from '@/hooks/useChartState';
import type { useDashboardData } from '@/hooks/useDashboardData';
import type { PeriodFilter } from '@/types/dashboard.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardData = ReturnType<typeof useDashboardData>;

interface AnalysisTabProps {
  data: DashboardData;
  currency: string;
  isMobile: boolean;
  width: number;
  locale: string;
  now: Date;
  invoices: any[];
  sales: any[];
  period: PeriodFilter;
  periodStart: string;
  onExportSales: () => void;
  onExportStock: () => void;
  onExportFinancial: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return '#059669';
  if (trend === 'down') return '#DC2626';
  return '#9CA3AF';
}

function getTrendArrow(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return '↗';
  if (trend === 'down') return '↘';
  return '→';
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function AnalysisTab({
  data, currency, isMobile, width, locale, now,
  invoices, sales, period,
  onExportSales, onExportStock, onExportFinancial,
}: AnalysisTabProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const {
    abcClassification, productSparklines7d, variantAbcMap,
    marginByCategory, clientRecurrence, loyaltyRate,
    avgBasketEvolution, revenueSparkline, salesSparkline,
    sixMonthsData, monthlyRevenue, prevRevenue, revenueChange,
    paidSalesCount, prevSalesCount, salesCountChange,
    grossMargin, prevGrossMargin, marginChange,
  } = data;

  // État d'expansion des lignes ABC par produit
  const [expandedAbcProductId, setExpandedAbcProductId] = useState<string | null>(null);

  // Filtre jour pour le graphique heure de pointe
  const [hourlyDayFilter, setHourlyDayFilter] = useState<number | null>(null);

  /** Données horaires calculées selon le filtre jour sélectionné */
  const hourlyBarData = React.useMemo(() => {
    const hourCounts: number[] = Array(24).fill(0);
    const allDates = [
      ...sales.filter((s) => s.status === 'paid').map((s) => s.createdAt),
      ...invoices.filter((i) => i.status === 'paid').map((i) => i.issueDate),
    ];
    for (const dateStr of allDates) {
      const d = new Date(dateStr);
      const dayIdx = (d.getDay() + 6) % 7;
      if (hourlyDayFilter !== null && dayIdx !== hourlyDayFilter) continue;
      hourCounts[d.getHours()]++;
    }
    return hourCounts;
  }, [sales, invoices, hourlyDayFilter]);

  /** Panier moyen courant et précédent pour AverageBasketCard */
  const currentAvgBasket = React.useMemo(() => {
    const vals = avgBasketEvolution.filter((v) => v.value > 0);
    return vals.length > 0 ? vals[vals.length - 1].value : 0;
  }, [avgBasketEvolution]);

  const prevAvgBasket = React.useMemo(() => {
    const vals = avgBasketEvolution.filter((v) => v.value > 0);
    return vals.length > 1 ? vals[vals.length - 2].value : 0;
  }, [avgBasketEvolution]);

  /** Évolution de la marge nette sur 12 mois (pour RevenueTrendChart) */
  const netMarginEvolution = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (11 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const dISO = d.toISOString();
      const eISO = end.toISOString();
      const invRev = invoices.filter((inv) => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < eISO).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleRev = sales.filter((s2) => s2.status === 'paid' && s2.createdAt >= dISO && s2.createdAt < eISO && !s2.convertedToInvoiceId).reduce((s, sale) => s + sale.totalTTC, 0);
      return { label, value: invRev + saleRev };
    });
  }, [invoices, sales, now]);

  const marginCategoryChartState = useChartState(marginByCategory);
  const hourlyChartState = useChartState(hourlyBarData.map((v) => ({ value: v })));

  const marginEvolution = sixMonthsData.map((m) => ({ label: m.label, margin: m.margin }));

  const peakHourIdx = hourlyBarData.reduce((maxI, v, i, arr) => v > arr[maxI] ? i : maxI, 0);
  const peakHourValue = hourlyBarData[peakHourIdx];

  const dayLabels = locale === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <>
      {/* ══ 1. CA vs Dépenses 6 mois ══ */}
      <RevenueVsExpensesChart currency={currency} />

      {/* ══ 2. Tendance CA 12 mois ══ */}
      <View style={[analysisStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={analysisStyles.cardHeaderRow}>
          <View>
            <Text style={[analysisStyles.cardTitle, { color: colors.text }]}>Tendance CA — 12 mois</Text>
            <Text style={[analysisStyles.cardSubtitle, { color: colors.textTertiary }]}>
              Évolution avec ligne de tendance
            </Text>
          </View>
        </View>
        {netMarginEvolution.every((m) => m.value === 0) ? (
          <ActionableEmptyState
            icon="trending"
            message="La tendance CA apparaîtra après vos premières ventes mensuelles"
            ctaLabel="Enregistrer une vente"
            onCtaPress={() => router.push('/ventes')}
          />
        ) : (
          <RevenueTrendChart
            data={netMarginEvolution}
            width={isMobile ? width - 80 : 460}
            height={200}
            color={colors.primary}
            regressionColor="#F59E0B"
            textColor={colors.textTertiary}
            unit={currency}
          />
        )}
      </View>

      {/* ══ 3. Classement ABC des produits ══ */}
      <View style={[analysisStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={{ marginBottom: SPACING.MD }}>
          <Text style={[analysisStyles.cardTitle, { color: colors.text }]}>Classement ABC des produits</Text>
          <Text style={[analysisStyles.cardSubtitle, { color: colors.textTertiary }]}>
            A = 80% du CA · B = intermédiaires · C = à revoir
          </Text>
        </View>

        {abcClassification.length === 0 ? (
          <ActionableEmptyState
            icon="package"
            message="Vendez vos premiers produits pour voir le classement ABC"
            ctaLabel="Enregistrer une vente"
            onCtaPress={() => router.push('/ventes')}
          />
        ) : (
          <View>
            {/* En-tête du tableau */}
            <View style={[analysisStyles.tableRowHeader, { borderBottomColor: colors.border }]}>
              <Text style={[analysisStyles.thCell, { color: colors.textTertiary, flex: 0.4, textAlign: 'center' }]}>ABC</Text>
              <Text style={[analysisStyles.thCell, { color: colors.textTertiary, flex: 1.8 }]}>Produit</Text>
              <Text style={[analysisStyles.thCell, { color: colors.textTertiary, flex: 0.9, textAlign: 'right' }]}>CA</Text>
              <Text style={[analysisStyles.thCell, { color: colors.textTertiary, flex: 0.5, textAlign: 'right' }]}>%</Text>
              <Text style={[analysisStyles.thCell, { color: colors.textTertiary, flex: 0.9, textAlign: 'right' }]}>Marge</Text>
              <Text style={[analysisStyles.thCell, { color: colors.textTertiary, flex: 0.8, textAlign: 'right' }]}>7j</Text>
            </View>

            {abcClassification.map((p, idx) => {
              const abcColor = p.abc === 'A' ? '#059669' : p.abc === 'B' ? '#F59E0B' : '#EF4444';
              const sparkData = productSparklines7d.get(p.name) || Array(7).fill(0);
              const hasSparkData = sparkData.some((v: number) => v > 0);
              const productVariants = variantAbcMap.get(p.id) || [];
              const hasVariants = productVariants.length > 0;
              const isExpanded = expandedAbcProductId === p.id;

              // Calcul de la tendance du produit
              const daysWithData = sparkData.filter((v: number) => v > 0).length;
              const hasSufficientData = daysWithData >= 3;
              let productTrend: 'up' | 'down' | 'stable' = 'stable';
              if (hasSufficientData) {
                const f3 = (sparkData[0] + sparkData[1] + sparkData[2]) / 3;
                const l3 = (sparkData[4] + sparkData[5] + sparkData[6]) / 3;
                const avg = (f3 + l3) / 2 || 1;
                const chg = ((l3 - f3) / avg) * 100;
                if (chg > 5) productTrend = 'up';
                else if (chg < -5) productTrend = 'down';
              }
              const trendColor = getTrendColor(productTrend);

              return (
                <View key={idx}>
                  <TouchableOpacity
                    activeOpacity={hasVariants ? 0.6 : 1}
                    onPress={() => {
                      if (!hasVariants) return;
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpandedAbcProductId(isExpanded ? null : p.id);
                    }}
                    style={[
                      analysisStyles.tableRow,
                      idx < abcClassification.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                    ]}
                  >
                    <View style={{ flex: 0.4, alignItems: 'center' }}>
                      <View style={[analysisStyles.abcBadge, { backgroundColor: abcColor + '18' }]}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: abcColor }}>{p.abc}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1.8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {hasVariants && (
                        <ChevronDown size={12} color={colors.textTertiary} style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }} />
                      )}
                      <Text style={[analysisStyles.cellBold, { color: colors.text, flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                    </View>
                    <View style={{ flex: 0.9, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                      <Text style={[analysisStyles.cellText, { color: colors.text, textAlign: 'right' }]}>
                        {formatCurrencyInteger(p.ca, currency)}
                      </Text>
                      {hasSufficientData
                        ? <Text style={{ fontSize: 11, color: trendColor, fontWeight: '700' }}>{getTrendArrow(productTrend)}</Text>
                        : <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' }}>—</Text>}
                    </View>
                    <Text style={[analysisStyles.cellText, { color: colors.textTertiary, flex: 0.5, textAlign: 'right' }]}>
                      {Math.round(p.pctCA)}%
                    </Text>
                    <Text style={[analysisStyles.cellBold, { color: p.margin >= 0 ? '#059669' : '#DC2626', flex: 0.9, textAlign: 'right' }]}>
                      {formatCurrencyInteger(p.margin, currency)}
                    </Text>
                    <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
                      {hasSparkData ? (
                        <SparklineChart data={sparkData} color={hasSufficientData ? trendColor : abcColor} width={56} height={18} strokeWidth={1.2} />
                      ) : (
                        <View style={{ width: 56, height: 18, backgroundColor: colors.borderLight, borderRadius: 3, opacity: 0.4 }} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Variantes expandées */}
                  {isExpanded && hasVariants && (
                    <View style={[analysisStyles.variantExpandPanel, {
                      backgroundColor: colors.card === '#FFFFFF' ? '#F8FAFC' : colors.inputBg,
                      borderColor: colors.borderLight,
                    }]}>
                      {productVariants.map((v: any, vIdx: number) => {
                        const vSparkHasData = v.sparkline.some((val: number) => val > 0);
                        const vTrendColor = getTrendColor(v.trend);
                        return (
                          <View key={v.variantId} style={[
                            analysisStyles.variantRow,
                            vIdx < productVariants.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                          ]}>
                            <View style={[analysisStyles.variantDot, { backgroundColor: vTrendColor }]} />
                            <Text style={{ flex: 1.6, fontSize: 11, fontWeight: '500', color: colors.textSecondary }} numberOfLines={1}>
                              {v.label}
                            </Text>
                            <View style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>
                                {formatCurrencyInteger(v.ca, currency)}
                              </Text>
                              {v.hasSufficientData
                                ? <Text style={{ fontSize: 10, color: vTrendColor, fontWeight: '700' }}>{getTrendArrow(v.trend)}</Text>
                                : <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '500' }}>—</Text>}
                            </View>
                            <Text style={{ flex: 0.7, fontSize: 11, fontWeight: '600', color: v.margin >= 0 ? '#059669' : '#DC2626', textAlign: 'right' }}>
                              {formatCurrencyInteger(v.margin, currency)}
                            </Text>
                            <View style={{ flex: 0.7, alignItems: 'flex-end' }}>
                              {vSparkHasData ? (
                                <SparklineChart data={v.sparkline} color={v.hasSufficientData ? vTrendColor : '#9CA3AF'} width={56} height={18} strokeWidth={1} />
                              ) : (
                                <View style={{ width: 56, height: 18, backgroundColor: colors.borderLight, borderRadius: 3, opacity: 0.3 }} />
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  {idx < abcClassification.length - 1 && isExpanded && (
                    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }} />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ══ 4. Marge par catégorie ══ */}
      <View style={[analysisStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[analysisStyles.cardTitle, { color: colors.text }]}>Marge par catégorie</Text>
        <Text style={[analysisStyles.cardSubtitle, { color: colors.textTertiary }]}>Rentabilité de chaque catégorie</Text>
        <View style={{ marginTop: SPACING.LG }}>
          {marginCategoryChartState.isEmpty ? (
            <ActionableEmptyState
              icon="chart"
              message="Les marges par catégorie apparaîtront après vos premières ventes"
              ctaLabel="Enregistrer une vente"
              onCtaPress={() => router.push('/ventes')}
            />
          ) : marginCategoryChartState.isSparse ? (
            <CompactSummaryCard
              total={marginByCategory.reduce((s, d) => s + d.value, 0)}
              totalLabel="Marge totale"
              unit={currency}
              message={`${marginCategoryChartState.nonEmptyCount} catégorie${marginCategoryChartState.nonEmptyCount > 1 ? 's' : ''} — enrichissez le catalogue pour voir plus`}
              insight={`${marginCategoryChartState.nonEmptyCount} catégorie${marginCategoryChartState.nonEmptyCount > 1 ? 's' : ''} avec de la marge`}
            />
          ) : (
            <HorizontalBarChart data={marginByCategory} width={isMobile ? width - 80 : 460} textColor={colors.textSecondary} valueColor={colors.text} />
          )}
        </View>
      </View>

      {/* ══ 5 & 6. Fidélité + Heure de pointe (côte à côte sur desktop) ══ */}
      <View style={[analysisStyles.chartsRow, isMobile && { flexDirection: 'column' }]}>
        {/* Fidélité */}
        <View style={[analysisStyles.card, analysisStyles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <View style={analysisStyles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="#6366F1" />
                <Text style={[analysisStyles.cardTitle, { color: colors.text }]}>Fidélité & rétention</Text>
              </View>
              <Text style={[analysisStyles.cardSubtitle, { color: colors.textTertiary }]}>Base clients active</Text>
            </View>
            <View style={[analysisStyles.loyaltyBadge, { backgroundColor: loyaltyRate >= 50 ? '#ECFDF5' : '#FEF3C7' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: loyaltyRate >= 50 ? '#059669' : '#D97706' }}>
                {loyaltyRate}%
              </Text>
            </View>
          </View>
          {clientRecurrence.newCount === 0 && clientRecurrence.recurringCount === 0 ? (
            <ActionableEmptyState
              icon="users"
              message="Ajoutez vos premiers clients pour suivre la fidélité"
              ctaLabel="Ajouter un client"
              onCtaPress={() => router.push('/clients')}
            />
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.LG }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>
                    {clientRecurrence.newCount + clientRecurrence.recurringCount}
                  </Text>
                  <Text style={{ fontSize: TYPOGRAPHY.SIZE.CAPTION, color: colors.textTertiary, marginTop: 2 }}>clients actifs</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: loyaltyRate >= 50 ? '#059669' : '#D97706' }}>
                    {loyaltyRate}%
                  </Text>
                  <Text style={{ fontSize: TYPOGRAPHY.SIZE.CAPTION, color: colors.textTertiary, marginTop: 2 }}>taux fidélité</Text>
                </View>
              </View>
              <ClientDonut
                newCount={clientRecurrence.newCount}
                recurringCount={clientRecurrence.recurringCount}
                colorNew="#6366F1"
                colorRecurring="#10B981"
                textColor={colors.text}
                labelColor={colors.textSecondary}
              />
            </>
          )}
        </View>

        {/* Heure de pointe */}
        <View style={[analysisStyles.card, analysisStyles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <View style={analysisStyles.cardHeaderRow}>
            <View>
              <Text style={[analysisStyles.cardTitle, { color: colors.text }]}>Heure de pointe</Text>
              <Text style={[analysisStyles.cardSubtitle, { color: colors.textTertiary }]}>Identifiez vos créneaux les plus actifs</Text>
            </View>
          </View>

          {/* Filtre par jour */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.XS, marginBottom: SPACING.MD }}>
            <TouchableOpacity
              style={[analysisStyles.periodPill, { backgroundColor: hourlyDayFilter === null ? colors.primary : colors.card, borderColor: hourlyDayFilter === null ? colors.primary : colors.cardBorder }]}
              onPress={() => setHourlyDayFilter(null)} activeOpacity={0.7}
            >
              <Text style={[analysisStyles.periodText, { color: hourlyDayFilter === null ? '#fff' : colors.textSecondary }]}>Tous</Text>
            </TouchableOpacity>
            {dayLabels.map((day, idx) => (
              <TouchableOpacity
                key={idx}
                style={[analysisStyles.periodPill, { backgroundColor: hourlyDayFilter === idx ? colors.primary : colors.card, borderColor: hourlyDayFilter === idx ? colors.primary : colors.cardBorder }]}
                onPress={() => setHourlyDayFilter((prev) => prev === idx ? null : idx)} activeOpacity={0.7}
              >
                <Text style={[analysisStyles.periodText, { color: hourlyDayFilter === idx ? '#fff' : colors.textSecondary }]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {hourlyChartState.isEmpty ? (
            <ActionableEmptyState
              icon="clock"
              message="Enregistrez vos premières ventes pour identifier vos heures de pointe"
              ctaLabel="Enregistrer une vente"
              onCtaPress={() => router.push('/ventes')}
            />
          ) : hourlyChartState.isSparse ? (
            <CompactSummaryCard
              total={hourlyBarData.reduce((s, v) => s + v, 0)}
              totalLabel="Ventes"
              unit="ventes"
              message={`Encore ${3 - hourlyChartState.nonEmptyCount} tranche${3 - hourlyChartState.nonEmptyCount > 1 ? 's' : ''} horaire${3 - hourlyChartState.nonEmptyCount > 1 ? 's' : ''} nécessaire${3 - hourlyChartState.nonEmptyCount > 1 ? 's' : ''}`}
              insight={`${hourlyChartState.nonEmptyCount} tranches horaires avec du trafic`}
            />
          ) : (
            <HourlyBarChart
              data={hourlyBarData}
              startHour={6}
              endHour={22}
              primaryColor={colors.primary}
              textColor={colors.textSecondary}
              bgColor={colors.borderLight}
              barMaxHeight={isMobile ? 100 : 120}
            />
          )}

          {/* Recommandation intelligente basée sur le pic */}
          {peakHourValue > 0 && !hourlyChartState.isEmpty && !hourlyChartState.isSparse && (() => {
            const totalHourlySales = hourlyBarData.reduce((s, v) => s + v, 0);
            if (totalHourlySales < 5) return null;
            const nonZeroHours = hourlyBarData.filter((v) => v > 0);
            const avgHourly = nonZeroHours.length > 0 ? totalHourlySales / nonZeroHours.length : 0;
            const sorted = [...hourlyBarData.map((v, i) => ({ hour: i, count: v }))].sort((a, b) => b.count - a.count);
            const peak1 = sorted[0];
            const peak2 = sorted.length > 1 ? sorted[1] : null;
            let recommendation = `Votre pic d'activité est ${peak1.hour}h. Assurez-vous d'être disponible sur ce créneau.`;
            if (peak2 && Math.abs(peak1.count - peak2.count) <= 1 && peak1.count > avgHourly) {
              recommendation = `Deux pics d'activité : ${peak1.hour}h et ${peak2.hour}h. Planifiez vos pauses en dehors.`;
            } else if (peak1.count <= avgHourly * 1.5) {
              recommendation = 'Votre activité est régulière sur la journée. Pas de créneau critique identifié.';
            }
            return (
              <View style={[analysisStyles.recommendationBlock, { backgroundColor: colors.card === '#FFFFFF' ? '#F8FAFC' : colors.inputBg }]}>
                <Lightbulb size={14} color="#D97706" style={{ marginTop: 1 }} />
                <Text style={[analysisStyles.recommendationText, { color: colors.textSecondary }]}>{recommendation}</Text>
              </View>
            );
          })()}
        </View>
      </View>

      {/* ══ 7. Panier moyen ══ */}
      <AverageBasketCard
        data={avgBasketEvolution}
        currentValue={currentAvgBasket}
        previousValue={prevAvgBasket}
        formatCurrency={(v) => formatCurrencyInteger(v, currency)}
        primaryColor={colors.primary}
        textColor={colors.text}
        textSecondary={colors.textSecondary}
        textTertiary={colors.textTertiary}
        cardBg={colors.card}
        cardBorder={colors.cardBorder}
        successColor={colors.success}
        dangerColor={colors.danger}
      />

      {/* ══ 8. Exports PDF ══ */}
      <View style={[analysisStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[analysisStyles.cardTitle, { color: colors.text }]}>{t('reports.exportPDF')}</Text>
        <Text style={[analysisStyles.cardSubtitle, { color: colors.textTertiary }]}>Générez et partagez vos rapports</Text>
        <View style={analysisStyles.exportBtnRow}>
          <TouchableOpacity style={[analysisStyles.exportBtn, { backgroundColor: colors.primary }]} onPress={onExportSales} activeOpacity={0.7}>
            <Download size={14} color={SEMANTIC_COLORS.WHITE} />
            <Text style={analysisStyles.exportBtnText}>{t('reports.salesReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[analysisStyles.exportBtn, { backgroundColor: '#059669' }]} onPress={onExportStock} activeOpacity={0.7}>
            <Download size={14} color={SEMANTIC_COLORS.WHITE} />
            <Text style={analysisStyles.exportBtnText}>{t('reports.stockReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[analysisStyles.exportBtn, { backgroundColor: '#7C3AED' }]} onPress={onExportFinancial} activeOpacity={0.7}>
            <Download size={14} color={SEMANTIC_COLORS.WHITE} />
            <Text style={analysisStyles.exportBtnText}>{t('reports.financialReport')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ 9. Comparaison avec la période précédente ══ */}
      <View style={[analysisStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[analysisStyles.cardTitle, { color: colors.text }]}>Comparaison avec la période précédente</Text>
        <Text style={[analysisStyles.cardSubtitle, { color: colors.textTertiary }]}>Tendances par rapport à la période passée</Text>
        <View style={[analysisStyles.comparisonRow, isMobile && { flexWrap: 'wrap' }]}>
          {[
            { label: t('dashboard.revenue'), value: data.monthlyRevenue, prev: data.prevRevenue, change: data.revenueChange, sparkline: revenueSparkline },
            { label: t('dashboard.sales'), value: data.paidSalesCount, prev: data.prevSalesCount, change: data.salesCountChange, sparkline: salesSparkline, isCount: true },
            { label: t('dashboard.grossProfit'), value: data.grossMargin, prev: data.prevGrossMargin, change: data.marginChange, sparkline: marginEvolution.map((m) => m.margin) },
          ].map(({ label, value, prev, change, sparkline, isCount }) => (
            <View key={label} style={[analysisStyles.comparisonCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
              <Text style={[analysisStyles.comparisonLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[analysisStyles.comparisonValue, { color: colors.text }]}>
                {isCount ? String(value) : formatCurrencyInteger(value as number, currency)}
              </Text>
              <Text style={[analysisStyles.comparisonPrev, { color: colors.textTertiary }]}>
                {t('dashboard.vs')} {isCount ? String(prev) : formatCurrencyInteger(prev as number, currency)}
              </Text>
              {change !== undefined ? (
                <View style={[analysisStyles.comparisonBadge, { backgroundColor: change >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
                  {change >= 0 ? <ArrowUpRight size={12} color="#059669" /> : <ArrowDownRight size={12} color="#DC2626" />}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: change >= 0 ? '#059669' : '#DC2626' }}>
                    {change >= 0 ? '+' : ''}{Math.round(change)}%
                  </Text>
                </View>
              ) : (
                <View style={[analysisStyles.comparisonBadge, { backgroundColor: colors.borderLight }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary }}>En attente de données</Text>
                </View>
              )}
              <View style={{ marginTop: SPACING.SM }}>
                <SparklineChart data={sparkline} color={(change ?? 0) >= 0 ? '#059669' : '#DC2626'} width={90} height={22} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const analysisStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM },
  chartCard: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XL },
  cardTitle: { fontSize: TYPOGRAPHY.SIZE.BODY_LARGE, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  cardSubtitle: { fontSize: TYPOGRAPHY.SIZE.SMALL, marginTop: 1 },
  chartsRow: { flexDirection: 'row', gap: SPACING.XL },

  tableRowHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: SPACING.MD, borderBottomWidth: 1, marginBottom: SPACING.XXS },
  thCell: { fontSize: TYPOGRAPHY.SIZE.TINY, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.LG },
  cellText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL },
  cellBold: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  abcBadge: { width: 26, height: 26, borderRadius: RADIUS.SM, alignItems: 'center', justifyContent: 'center' },

  variantExpandPanel: { borderRadius: RADIUS.MD, marginHorizontal: SPACING.SM, marginBottom: SPACING.MD, paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD, borderWidth: 1 },
  variantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.MD, gap: SPACING.SM },
  variantDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },

  loyaltyBadge: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND },
  periodPill: { paddingHorizontal: SPACING.XXL, paddingVertical: 7, borderRadius: RADIUS.ROUND, borderWidth: 1 },
  periodText: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  recommendationBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.MD, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.LG, borderRadius: RADIUS.MD, marginTop: SPACING.LG },
  recommendationText: { fontSize: 13, fontStyle: 'italic', flex: 1, lineHeight: 18 },

  exportBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.MD, marginTop: SPACING.LG },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, paddingHorizontal: SPACING.XXL, paddingVertical: SPACING.LG, borderRadius: RADIUS.MD },
  exportBtnText: { color: SEMANTIC_COLORS.WHITE, fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  comparisonRow: { flexDirection: 'row', gap: SPACING.LG, marginTop: SPACING.XL },
  comparisonCard: { flex: 1, minWidth: 100, borderWidth: 1, borderRadius: RADIUS.LG, padding: SPACING.XL, alignItems: 'center', gap: SPACING.XS },
  comparisonLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase', letterSpacing: 0.5 },
  comparisonValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  comparisonPrev: { fontSize: TYPOGRAPHY.SIZE.CAPTION },
  comparisonBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.MD, paddingVertical: 3, borderRadius: RADIUS.XL },
});