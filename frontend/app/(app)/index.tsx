/**
 * dashboard.tsx
 *
 * Orchestrateur principal du tableau de bord
 * Ce fichier ne contient que :
 *   - l'initialisation des hooks
 *   - la gestion des états UI (onglet actif, période, filtres)
 *   - le rendu structurel (header, tabs, scroll)
 *   - la délégation aux composants de chaque onglet
 *
 * STRUCTURE :
 *   utils/dashboardHelpers.ts          — fonctions pures (périodes, CA)
 *   hooks/useDashboardData.ts          — tous les calculs métier (useMemo)
 *   hooks/useDashboardExports.ts       — export PDF et FEC
 *   components/dashboard/
 *     DashboardCards.tsx               — ClientAvatar, TodayBanner, GoalCard, PriorityClientsCard
 *     RecentSalesList.tsx              — liste ventes expandable
 *     OverviewTab.tsx                  — onglet Vue d'ensemble
 *     AnalysisTab.tsx                  — onglet Analyse
 *     TreasuryTab.tsx                  — onglet Trésorerie
 *     SimplifiedDashboard.tsx          — mode simplifié (rôle restreint)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import {
  BarChart3, PieChart, Wallet, RefreshCw,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { extractFirstName, getPeriodStart, getPreviousPeriodRange } from '@/utils/dashboardHelpers';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardExports } from '@/hooks/useDashboardExports';
import PageHeader from '@/components/PageHeader';
import SectionTabBar from '@/components/SectionTabBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING, TYPOGRAPHY, RADIUS, SEMANTIC_COLORS } from '@/constants/theme';
import type { DashboardTab, PeriodFilter, SalesObjectives } from '@/types/dashboard.types';

// Onglets
import OverviewTab from '@/components/dashboard/OverviewTab';
import AnalysisTab from '@/components/dashboard/AnalysisTab';
import TreasuryTab from '@/components/dashboard/TreasuryTab';
import SimplifiedDashboard from '@/components/dashboard/SimplifiedDashboard';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DASHBOARD_TAB_KEYS: { key: DashboardTab; labelKey: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { key: 'overview', labelKey: 'dashboard.overview', icon: BarChart3 },
  { key: 'analysis', labelKey: 'dashboard.analysis', icon: PieChart },
  { key: 'treasury', labelKey: 'dashboard.treasury', icon: Wallet },
];

const PERIOD_OPTION_KEYS: { key: PeriodFilter; labelKey: string }[] = [
  { key: 'today', labelKey: 'dashboard.today' },
  { key: 'week', labelKey: 'dashboard.thisWeek' },
  { key: 'month', labelKey: 'dashboard.thisMonth' },
  { key: 'quarter', labelKey: 'dashboard.thisQuarter' },
  { key: 'year', labelKey: 'dashboard.thisYear' },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { successAlert, errorAlert } = useConfirm();
  const scrollRef = useRef<ScrollView>(null);
  const { simplifiedDashboard } = useRole();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const {
    invoices, lowStockProducts, activeProducts,
    activeSupplierInvoices, cashMovements, sales, company, clients,
    activePurchaseOrders, getVariantsForProduct, productAttributes,
    activeExpenses, quotes,
  } = useData();

  const cur = company.currency || 'XOF';
  const now = useMemo(() => new Date(), []);
  const firstName = useMemo(() => extractFirstName(user), [user]);

  // ── Salutation et date formatée ───────────────────────────────────────────
  const greeting = firstName ? `${t('dashboard.greeting')} ${firstName}` : t('dashboard.greeting');

  const todayStr = useMemo(() => {
    const loc = locale === 'en' ? 'en-US' : 'fr-FR';
    return now
      .toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .replace(/^\w/, (c) => c.toUpperCase());
  }, [now, locale]);

  // ── États UI ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  const refreshMinutesAgo = useMemo(
    () => Math.floor((now.getTime() - lastRefreshTime.getTime()) / 60000),
    [now, lastRefreshTime],
  );

  // ── Objectif CA mensuel (persisté dans AsyncStorage) ──────────────────────
  const COMPANY_ID = user?.id ?? 'anonymous';
  const [salesObjectives, setSalesObjectives] = useState<SalesObjectives | null>(null);
  const [explicitMonthlyGoal, setExplicitMonthlyGoal] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(`sales-objectives-${COMPANY_ID}`).then((stored) => {
      if (stored) {
        try { setSalesObjectives(JSON.parse(stored) as SalesObjectives); } catch { /* ignore */ }
      }
    }).catch(() => {});
    AsyncStorage.getItem(`monthly-ca-goal-${COMPANY_ID}`).then((stored) => {
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val > 0) setExplicitMonthlyGoal(val);
      }
    }).catch(() => {});
  }, [COMPANY_ID]);

  // ── Calcul des périodes ───────────────────────────────────────────────────
  const periodStart = useMemo(() => getPeriodStart(now, period).toISOString(), [now, period]);
  const prevPeriod = useMemo(() => getPreviousPeriodRange(now, period), [now, period]);

  // ── Hook de calcul métier ─────────────────────────────────────────────────
  const data = useDashboardData({
    now, period, periodStart, prevPeriod,
    invoices, sales, quotes, activeProducts,
    activeSupplierInvoices, cashMovements, activeExpenses,
    activePurchaseOrders, clients, lowStockProducts, locale,
    getVariantsForProduct, productAttributes,
  });

  // ── Données de projection (trésorerie) ───────────────────────────────────
  const projectionData = useMemo(() => {
    const projMap = new Map<string, number>();
    for (const inv of invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled')) {
      const d = new Date(inv.dueDate || inv.issueDate);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      projMap.set(label, (projMap.get(label) || 0) + (inv.totalTTC - inv.paidAmount));
    }
    const labels = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    });
    return labels.map((label) => ({
      label,
      actual: data.treasuryMonthlyData.find((m) => m.month === label)?.enc,
      projected: projMap.get(label),
    }));
  }, [invoices, data.treasuryMonthlyData, now]);

  // ── Répartition des dépenses (pour donut trésorerie) ─────────────────────
  const expenseBreakdownSegments = useMemo(() => {
    const supplierTotal = activeSupplierInvoices
      .filter((si) => si.date >= periodStart)
      .reduce((s, si) => s + (si.total || 0), 0);
    const fixedCharges = cashMovements
      .filter((cm) => cm.type === 'expense' && !cm.sourceType && cm.date >= periodStart)
      .reduce((s, cm) => s + cm.amount, 0);
    const segments = [];
    if (supplierTotal > 0) segments.push({ label: 'Matières premières', value: supplierTotal, color: '#6366F1' });
    if (fixedCharges > 0) segments.push({ label: 'Charges fixes', value: fixedCharges, color: '#F59E0B' });
    return segments;
  }, [activeSupplierInvoices, cashMovements, periodStart]);

  // ── Mouvements de trésorerie (pour liste + export FEC) ───────────────────
  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clients) map[c.id] = c.companyName || `${c.firstName} ${c.lastName}`;
    return map;
  }, [clients]);

  const allMovements = useMemo(() => {
    const moves: any[] = [];
    const startISO = data.treasuryPeriodStart.toISOString();

    for (const inv of data.paidInvoicesTreasury)
      moves.push({ id: `inv-${inv.id}`, type: 'income', amount: inv.totalTTC, description: `Facture ${inv.invoiceNumber} — ${clientMap[inv.clientId] || inv.clientName}`, date: inv.issueDate, source: 'Facture client' });

    for (const sale of data.salesNotFromInvoicesTreasury)
      moves.push({ id: `sale-${sale.id}`, type: 'income', amount: sale.totalTTC, description: `Vente ${sale.saleNumber}${sale.clientName ? ` — ${sale.clientName}` : ''}`, date: sale.createdAt, source: 'Vente comptoir' });

    for (const sale of data.refundedSalesTreasury)
      moves.push({ id: `refund-${sale.id}`, type: 'expense', amount: sale.totalTTC, description: `Remboursement ${sale.saleNumber}`, date: sale.refundedAt || sale.createdAt, source: 'Remboursement' });

    for (const si of data.paidSupplierInvoicesTreasury)
      moves.push({ id: `si-${si.id}`, type: 'expense', amount: si.total || 0, description: `Facture ${si.number} — ${si.supplierName || 'Fournisseur'}`, date: si.date, source: 'Facture fournisseur' });

    for (const exp of activeExpenses.filter((e) => (e.status === 'approved' || e.status === 'paid') && e.date >= startISO))
      moves.push({ id: `exp-${exp.id}`, type: 'expense', amount: exp.amount, description: `${exp.description || exp.expenseType}${exp.supplierName ? ` — ${exp.supplierName}` : ''}`, date: exp.date, source: 'Dépense' });

    return moves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.paidInvoicesTreasury, data.paidSupplierInvoicesTreasury, clientMap, data.salesNotFromInvoicesTreasury, data.refundedSalesTreasury, activeExpenses, data.treasuryPeriodStart]);

  // ── Hook d'exports ────────────────────────────────────────────────────────
  const exports = useDashboardExports({
    company, currency: cur, now, period,
    sales, invoices, clients, activeProducts, allMovements,
    treasuryPeriodStart: data.treasuryPeriodStart,
    monthlyRevenue: data.monthlyRevenue,
    monthlyExpenses: data.monthlyExpenses,
    unpaidAmount: data.unpaidAmount,
    netCashflow: data.netCashflow,
    cashBalance: data.cashBalance,
    abcClassification: data.abcClassification,
    unpaidInvoices: data.unpaidInvoices,
    expenseBreakdownSegments,
    projectionData,
    healthScoreProps: data.healthScoreProps,
    successAlert, errorAlert,
  });

  // ── Objectif mensuel calculé ──────────────────────────────────────────────
  const goalTarget = useMemo(() => {
    if (explicitMonthlyGoal && explicitMonthlyGoal > 0) return explicitMonthlyGoal;
    if (!salesObjectives) return null;
    if (salesObjectives.mode === 'yearly') {
      return salesObjectives.yearlyTarget > 0 ? salesObjectives.yearlyTarget / 12 : null;
    }
    const currentMonthKey = String(now.getMonth() + 1).padStart(2, '0');
    const monthVal = salesObjectives.monthlyTargets[currentMonthKey];
    if (monthVal && monthVal > 0) return monthVal;
    const total = Object.values(salesObjectives.monthlyTargets).reduce((s, v) => s + v, 0);
    return total > 0 ? total / 12 : null;
  }, [salesObjectives, explicitMonthlyGoal, now]);

  // ── Données récentes vendues (5 dernières toutes sources) ─────────────────
  const recentSales = useMemo(() => {
    const allSales = [
      ...sales.map((s) => ({
        id: s.id, date: s.createdAt, client: s.clientName || 'Client comptoir',
        amount: s.totalTTC, status: s.status, paymentMethod: s.paymentMethod,
        items: s.items, totalHT: s.totalHT, totalTVA: s.totalTVA, clientId: s.clientId,
        saleType: 'comptoir' as const,
      })),
      ...invoices
        .filter((i) => i.status !== 'cancelled' && i.status !== 'draft')
        .map((i) => ({
          id: i.id, date: i.issueDate, client: i.clientName,
          amount: i.totalTTC, status: i.status === 'paid' ? 'paid' : 'unpaid',
          paymentMethod: 'transfer' as const,
          items: i.items, totalHT: i.totalHT, totalTVA: i.totalTVA, clientId: i.clientId,
          saleType: 'facture' as const,
        })),
    ];
    return allSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [sales, invoices]);

  const recentSalesMax = useMemo(
    () => (recentSales.length === 0 ? 1 : Math.max(...recentSales.map((s) => s.amount), 1)),
    [recentSales],
  );

  const recentSalesTotalCA = useMemo(
    () => recentSales.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.amount, 0),
    [recentSales],
  );

  // ── Factures en retard et fournisseurs à payer (trésorerie) ──────────────
  const lateClientInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.status === 'late' || (i.status === 'sent' && new Date(i.dueDate) < now))
        .map((i) => ({
          id: i.id, client: i.clientName,
          amount: i.totalTTC - i.paidAmount,
          daysLate: Math.max(0, Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000)),
        }))
        .sort((a, b) => b.daysLate - a.daysLate)
        .slice(0, 5),
    [invoices, now],
  );

  const suppliersDue = useMemo(
    () =>
      data.supplierInvoicesToPayTreasury
        .map((si) => ({ id: si.id, supplier: si.supplierName || 'Fournisseur', amount: si.total || 0, dueDate: si.dueDate }))
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5),
    [data.supplierInvoicesToPayTreasury],
  );

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header avec badge de santé globale */}
      <PageHeader
        title={t('dashboard.title')}
        rightContent={
          <View style={[styles.healthBadge, {
            backgroundColor: data.globalHealthStatus === 'green' ? '#059669'
              : data.globalHealthStatus === 'orange' ? '#F59E0B' : '#DC2626',
          }]} />
        }
      />

      {/* Barre d'onglets (masquée en mode simplifié) */}
      {!simplifiedDashboard && (
        <SectionTabBar
          tabs={DASHBOARD_TAB_KEYS.map((tab) => ({ ...tab, label: t(tab.labelKey) }))}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        />
      )}

      {/* Sélecteur de période */}
      {!simplifiedDashboard && (
        <View style={[styles.stickyPeriodRow, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
            {PERIOD_OPTION_KEYS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.periodPill, {
                  backgroundColor: period === opt.key ? colors.primary : colors.card,
                  borderColor: period === opt.key ? colors.primary : colors.cardBorder,
                }]}
                onPress={() => setPeriod(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodText, { color: period === opt.key ? SEMANTIC_COLORS.WHITE : colors.textSecondary }]}>
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Contenu principal */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Salutation + date + indicateur de fraîcheur */}
        <View style={styles.welcomeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingText, { color: colors.text }]}>{greeting}</Text>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>{todayStr}</Text>
          </View>
          <View style={styles.freshnessRow}>
            <Text style={[styles.freshnessText, { color: colors.textTertiary }]}>
              {refreshMinutesAgo < 1 ? "Mis à jour à l'instant" : `Mis à jour il y a ${refreshMinutesAgo} min`}
            </Text>
            <TouchableOpacity onPress={() => setLastRefreshTime(new Date())} activeOpacity={0.7}>
              <RefreshCw size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rendu conditionnel selon le mode et l'onglet actif */}
        {simplifiedDashboard ? (
          <SimplifiedDashboard
            todayRevenue={data.todayRevenue}
            todaySalesCount={data.todaySalesCount}
            monthlyRevenue={data.monthlyRevenue}
            revenueChange={data.revenueChange}
            paidSalesCount={data.paidSalesCount}
            revenueSparkline={data.revenueSparkline}
            salesSparkline={data.salesSparkline}
            recentSales={recentSales}
            recentSalesMax={recentSalesMax}
            recentSalesTotalCA={recentSalesTotalCA}
            currency={cur}
            clients={clients}
            now={now}
            locale={locale}
            getVariantLabel={data.getVariantLabel}
          />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                data={data}
                goalTarget={goalTarget}
                recentSales={recentSales}
                recentSalesMax={recentSalesMax}
                recentSalesTotalCA={recentSalesTotalCA}
                currency={cur}
                clients={clients}
                now={now}
                locale={locale}
                isMobile={isMobile}
                width={width}
                pendingSalesCount={0}
              />
            )}
            {activeTab === 'analysis' && (
              <AnalysisTab
                data={data}
                currency={cur}
                isMobile={isMobile}
                width={width}
                locale={locale}
                now={now}
                invoices={invoices}
                sales={sales}
                period={period}
                periodStart={periodStart}
                onExportSales={exports.handleExportSalesReport}
                onExportStock={exports.handleExportStockReport}
                onExportFinancial={exports.handleExportFinancialReport}
              />
            )}
            {activeTab === 'treasury' && (
              <TreasuryTab
                data={data}
                currency={cur}
                isMobile={isMobile}
                width={width}
                allMovements={allMovements}
                lateClientInvoices={lateClientInvoices}
                suppliersDue={suppliersDue}
                projectionData={projectionData}
                expenseBreakdownSegments={expenseBreakdownSegments}
                onExportFEC={exports.handleExportFEC}
                now={now}
              />
            )}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.XXXL, gap: SPACING.XL },

  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.XS },
  greetingText: { fontSize: TYPOGRAPHY.SIZE.HEADING, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, letterSpacing: -0.5 },
  dateText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, marginTop: SPACING.XXS },

  stickyPeriodRow: { paddingHorizontal: SPACING.XXXL, paddingVertical: SPACING.MD, borderBottomWidth: 1 },
  periodRow: { flexDirection: 'row', gap: SPACING.SM },
  periodPill: { paddingHorizontal: SPACING.XXL, paddingVertical: 7, borderRadius: RADIUS.ROUND, borderWidth: 1 },
  periodText: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  freshnessRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM },
  freshnessText: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  healthBadge: { width: 10, height: 10, borderRadius: 5, marginLeft: SPACING.SM },
});