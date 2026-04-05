/**
 * components/dashboard/OverviewTab.tsx
 *
 * Onglet "Vue d'ensemble" du tableau de bord.
 * Affiche dans l'ordre :
 *   1. Score de santé financière
 *   2. Alertes contextuelles (SmartAlerts)
 *   3. Clients prioritaires à relancer
 *   4. À faire aujourd'hui (TodoToday)
 *   5. KPI primaire CA du mois + sparkline
 *   6. Objectif CA mensuel (GoalCard)
 *   7. KPIs secondaires : marge brute, nombre de ventes
 *   8. KPIs tertiaires : impayés, pouls du jour
 *   9. Dernières ventes (RecentSalesList)
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import {
  Target, TrendingUp, ShoppingCart, Clock, ArrowUpRight, ArrowDownRight, ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatCurrencyInteger } from '@/utils/format';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';
import SparklineChart from '@/components/dashboard/charts/SparklineChart';
import FinancialHealthScore from '@/components/dashboard/charts/FinancialHealthScore';
import SmartAlerts from '@/components/SmartAlerts';
import TodoToday from '@/components/TodoToday';
import { GoalCard, PriorityClientsCard } from './DashboardCards';
import RecentSalesList from './RecentSalesList';
import type { useDashboardData } from '@/hooks/useDashboardData';

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardData = ReturnType<typeof useDashboardData>;

interface OverviewTabProps {
  data: DashboardData;
  goalTarget: number | null;
  recentSales: any[];
  recentSalesMax: number;
  recentSalesTotalCA: number;
  currency: string;
  clients: any[];
  now: Date;
  locale: string;
  isMobile: boolean;
  width: number;
  pendingSalesCount: number;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function OverviewTab({
  data, goalTarget, recentSales, recentSalesMax, recentSalesTotalCA,
  currency, clients, now, locale, isMobile, width, pendingSalesCount,
}: OverviewTabProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const {
    healthScoreProps, unpaidInvoices, lowStockProducts: _lowStockProducts,
    totalEncaissements, totalDecaissements, expenseBreakdownSegments: _exp,
    clientsToRemindCount, priorityClientsToRemind,
    monthlyRevenue, revenueMonthlyTrend, revenueSparkline,
    grossMargin, marginChange, paidSalesCount, salesCountChange,
    unpaidAmount, todayRevenue, todaySalesCount, yesterdayRevenue,
    getVariantLabel,
  } = data;

  /** 4 dernières semaines pour le sparkline du KPI primaire */
  const last4WeeksSparkline = revenueSparkline.slice(-4);

  /** Label de tendance affiché sous le KPI */
  const trendSign = revenueMonthlyTrend >= 0 ? '+' : '';
  const trendLabel = `${revenueMonthlyTrend >= 0 ? '↗' : '↘'} ${trendSign}${formatCurrencyInteger(Math.abs(revenueMonthlyTrend), currency)}/sem`;

  const hasAlerts = unpaidInvoices.length > 0 || clientsToRemindCount > 0;

  return (
    <>
      {/* ══ 1. Score santé financière ══ */}
      <FinancialHealthScore
        coverageRatio={healthScoreProps.coverageRatio}
        runwayMonths={healthScoreProps.runwayMonths}
        unpaidRate={healthScoreProps.unpaidRate}
        revenueTrend={healthScoreProps.revenueTrend}
        grossMarginPositive={healthScoreProps.grossMarginPositive}
      />

      {/* ══ 2. Alertes contextuelles ══ */}
      <SmartAlerts
        unpaidInvoices={unpaidInvoices as any}
        lowStockProducts={data.pendingPurchaseOrders as any}
        totalEncaissements={totalEncaissements}
        totalDecaissements={totalDecaissements}
        expenseBreakdownSegments={[]}
        currency={currency}
        formatCurrency={(v, c) => formatCurrencyInteger(v, c)}
        now={now}
        onNavigateInvoices={() => router.push('/ventes?tab=factures' as never)}
        onNavigateStock={() => router.push('/stock?tab=inventaire' as never)}
        onNavigateExpenses={() => router.push('/achats')}
      />

      {/* ══ 3. Clients prioritaires à relancer ══ */}
      <PriorityClientsCard
        alertClientsCount={clientsToRemindCount}
        priorityClientsToRemind={priorityClientsToRemind}
        now={now}
        currency={currency}
        hasAlerts={hasAlerts}
      />

      {/* ══ 4. À faire aujourd'hui ══ */}
      <TodoToday
        invoices={unpaidInvoices as any}
        lowStockProducts={data.pendingPurchaseOrders as any}
        sales={recentSales as any}
        todaySalesCount={todaySalesCount}
        monthlyRevenue={monthlyRevenue}
        explicitMonthlyGoal={goalTarget}
        coverageRatio={healthScoreProps.coverageRatio}
        currency={currency}
        now={now}
      />

      {/* ══ 5. KPI primaire — CA du mois avec sparkline ══ */}
      <View style={[overviewStyles.kpiPrimaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={overviewStyles.kpiPrimaryHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[overviewStyles.kpiPrimaryLabel, { color: colors.textTertiary }]}>CA du mois</Text>
            <Text style={[overviewStyles.kpiPrimaryValue, { color: colors.text }]}>
              {formatCurrencyInteger(monthlyRevenue, currency)}
            </Text>
          </View>
          <View style={[overviewStyles.kpiPrimaryTrendBadge, {
            backgroundColor: revenueMonthlyTrend >= 0 ? '#ECFDF5' : '#FEF2F2',
          }]}>
            <Text style={[overviewStyles.kpiPrimaryTrendText, {
              color: revenueMonthlyTrend >= 0 ? '#059669' : '#DC2626',
            }]}>
              {trendLabel}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: SPACING.LG, marginBottom: SPACING.MD }}>
          <SparklineChart
            data={last4WeeksSparkline}
            color={colors.primary}
            width={isMobile ? width - 80 : 400}
            height={40}
          />
        </View>
      </View>

      {/* ══ 6. Objectif CA mensuel ══ */}
      <GoalCard monthlyRevenue={monthlyRevenue} goalTarget={goalTarget} currency={currency} now={now} />

      {/* ══ 7. KPIs secondaires — marge brute + nombre de ventes ══ */}
      <View style={overviewStyles.kpiGrid2}>
        {/* Marge brute */}
        <TouchableOpacity
          style={[overviewStyles.kpiGridCard, {
            backgroundColor: grossMargin < 0 ? 'rgba(220,38,38,0.06)' : grossMargin > 0 ? 'rgba(5,150,105,0.05)' : colors.card,
            borderColor: grossMargin < 0 ? 'rgba(220,38,38,0.2)' : grossMargin > 0 ? 'rgba(5,150,105,0.15)' : colors.cardBorder,
          }]}
          onPress={grossMargin < 0 ? () => router.push('/achats') : undefined}
          activeOpacity={grossMargin < 0 ? 0.7 : 1}
          testID="kpi-gross-profit"
        >
          <View style={overviewStyles.kpiGridIconRow}>
            <Target size={16} color={grossMargin >= 0 ? '#059669' : '#DC2626'} />
            <Text style={[overviewStyles.kpiGridLabel, { color: grossMargin < 0 ? '#991B1B' : colors.textSecondary }]}>
              Bénéfice brut
            </Text>
          </View>
          <Text style={[overviewStyles.kpiGridValue, { color: grossMargin >= 0 ? '#059669' : '#DC2626' }]}>
            {formatCurrencyInteger(grossMargin, currency)}
          </Text>
          {marginChange !== undefined && (
            <View style={[overviewStyles.kpiGridChangeBadge, { backgroundColor: marginChange >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
              {marginChange >= 0 ? <ArrowUpRight size={10} color="#059669" /> : <ArrowDownRight size={10} color="#DC2626" />}
              <Text style={{ fontSize: 10, fontWeight: '700', color: marginChange >= 0 ? '#059669' : '#DC2626' }}>
                {marginChange >= 0 ? '+' : ''}{Math.round(marginChange)}%
              </Text>
            </View>
          )}
          {grossMargin < 0 && (
            <Text style={[overviewStyles.kpiGridLink, { color: '#DC2626' }]}>Voir dépenses →</Text>
          )}
        </TouchableOpacity>

        {/* Nombre de ventes */}
        <View
          style={[overviewStyles.kpiGridCard, {
            backgroundColor: paidSalesCount > 0 ? 'rgba(5,150,105,0.05)' : colors.card,
            borderColor: paidSalesCount > 0 ? 'rgba(5,150,105,0.15)' : colors.cardBorder,
          }]}
          testID="kpi-sales-count"
        >
          <View style={overviewStyles.kpiGridIconRow}>
            <ShoppingCart size={16} color="#7C3AED" />
            <Text style={[overviewStyles.kpiGridLabel, { color: colors.textSecondary }]}>Nombre de ventes</Text>
          </View>
          <Text style={[overviewStyles.kpiGridValue, { color: colors.text }]}>{paidSalesCount}</Text>
          <Text style={[overviewStyles.kpiGridSub, { color: colors.textTertiary }]}>
            Ticket moyen : {formatCurrencyInteger(paidSalesCount > 0 ? monthlyRevenue / paidSalesCount : 0, currency)}
          </Text>
          {salesCountChange !== undefined && (
            <View style={[overviewStyles.kpiGridChangeBadge, { backgroundColor: salesCountChange >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
              {salesCountChange >= 0 ? <ArrowUpRight size={10} color="#059669" /> : <ArrowDownRight size={10} color="#DC2626" />}
              <Text style={{ fontSize: 10, fontWeight: '700', color: salesCountChange >= 0 ? '#059669' : '#DC2626' }}>
                {salesCountChange >= 0 ? '+' : ''}{Math.round(salesCountChange)}%
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ══ 8. KPIs tertiaires — impayés + pouls du jour ══ */}
      <View style={overviewStyles.kpiGrid2}>
        {/* Impayés */}
        <TouchableOpacity
          style={[overviewStyles.kpiGridCard, {
            backgroundColor: unpaidAmount > 0 ? 'rgba(217,119,6,0.06)' : 'rgba(5,150,105,0.05)',
            borderColor: unpaidAmount > 0 ? 'rgba(217,119,6,0.2)' : 'rgba(5,150,105,0.15)',
          }]}
          onPress={() => router.push('/ventes?tab=factures' as never)}
          activeOpacity={0.7}
          testID="kpi-unpaid"
        >
          <View style={overviewStyles.kpiGridIconRow}>
            <Clock size={16} color={unpaidAmount > 0 ? '#D97706' : '#059669'} />
            <Text style={[overviewStyles.kpiGridLabel, { color: unpaidAmount > 0 ? '#92400E' : colors.textSecondary }]}>
              Impayés en cours
            </Text>
          </View>
          <Text style={[overviewStyles.kpiGridValue, { color: unpaidAmount > 0 ? '#D97706' : '#059669' }]}>
            {formatCurrencyInteger(unpaidAmount, currency)}
          </Text>
          <Text style={[overviewStyles.kpiGridSub, { color: unpaidAmount > 0 ? '#92400E' : colors.textTertiary }]}>
            {unpaidInvoices.length} facture{unpaidInvoices.length !== 1 ? 's' : ''}
          </Text>
          {unpaidAmount > 0 && (
            <Text style={[overviewStyles.kpiGridLink, { color: '#D97706' }]}>Envoyer rappels →</Text>
          )}
        </TouchableOpacity>

        {/* Pouls du jour */}
        <View style={[overviewStyles.kpiGridCard, {
          backgroundColor: todayRevenue > 0 ? 'rgba(5,150,105,0.05)' : colors.card,
          borderColor: todayRevenue > 0 ? 'rgba(5,150,105,0.15)' : colors.cardBorder,
        }]} testID="kpi-daily-pulse">
          <View style={overviewStyles.kpiGridIconRow}>
            <TrendingUp size={16} color={colors.primary} />
            <Text style={[overviewStyles.kpiGridLabel, { color: colors.textSecondary }]}>Pouls du jour</Text>
          </View>
          <Text style={[overviewStyles.kpiGridValue, { color: colors.text }]}>
            {formatCurrencyInteger(todayRevenue, currency)}
          </Text>
          <Text style={[overviewStyles.kpiGridSub, { color: colors.textTertiary }]}>
            {todaySalesCount} vente{todaySalesCount !== 1 ? 's' : ''} aujourd'hui
          </Text>
          {yesterdayRevenue > 0 && (
            <View style={[overviewStyles.kpiGridChangeBadge, {
              backgroundColor: todayRevenue >= yesterdayRevenue ? '#ECFDF5' : '#FEF2F2',
            }]}>
              {todayRevenue >= yesterdayRevenue
                ? <ArrowUpRight size={10} color="#059669" />
                : <ArrowDownRight size={10} color="#DC2626" />}
              <Text style={{ fontSize: 10, fontWeight: '700', color: todayRevenue >= yesterdayRevenue ? '#059669' : '#DC2626' }}>
                vs hier {formatCurrencyInteger(yesterdayRevenue, currency)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ══ 9. Dernières ventes ══ */}
      <View style={[overviewStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={overviewStyles.cardHeaderRow}>
          <Text style={[overviewStyles.cardTitle, { color: colors.text }]}>{t('dashboard.recentSales')}</Text>
          <TouchableOpacity onPress={() => router.push('/ventes')} activeOpacity={0.7}>
            <Text style={[overviewStyles.viewAllLink, { color: colors.primary }]}>{t('dashboard.viewAll')} →</Text>
          </TouchableOpacity>
        </View>
        <RecentSalesList
          recentSales={recentSales}
          recentSalesMax={recentSalesMax}
          recentSalesTotalCA={recentSalesTotalCA}
          currency={currency}
          clients={clients}
          now={now}
          locale={locale}
          getVariantLabel={getVariantLabel}
        />
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const overviewStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XL },
  cardTitle: { fontSize: TYPOGRAPHY.SIZE.BODY_LARGE, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  viewAllLink: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  kpiPrimaryCard: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM },
  kpiPrimaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kpiPrimaryLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.XXS },
  kpiPrimaryValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  kpiPrimaryTrendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND },
  kpiPrimaryTrendText: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },

  kpiGrid2: { flexDirection: 'row', gap: SPACING.MD },
  kpiGridCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM, gap: SPACING.XS },
  kpiGridIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, marginBottom: SPACING.SM },
  kpiGridLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiGridValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiGridSub: { fontSize: TYPOGRAPHY.SIZE.CAPTION },
  kpiGridChangeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, paddingHorizontal: SPACING.MD, paddingVertical: 2, borderRadius: RADIUS.ROUND, marginTop: SPACING.XXS },
  kpiGridLink: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, marginTop: SPACING.SM },
});