/**
 * dashboard.tsx — Tableau de bord principal HaziOne.
 *
 * Structure en 3 onglets : Vue d'ensemble, Analyse, Tresorerie.
 * Donnees reelles issues du DataContext (invoices, sales, cashMovements, etc.).
 *
 * CONVENTION PRIX : toutes les valeurs affichees sont en devise locale (cur).
 *
 * GRAPHES UTILISES (tous dans DashboardCharts.tsx, sans dependance externe) :
 *   - SparklineChart    : mini tendance dans les KPI cards (existant)
 *   - DonutChart        : repartition categories (existant)
 *   - AreaChart         : CA vs Depenses 6 mois (nouveau)
 *   - HorizontalBarChart: Marge par categorie (nouveau)
 *   - WeekHeatmap       : activite jours / heures (nouveau)
 *   - TreasuryLineChart : evolution solde tresorerie (nouveau)
 *   - ProjectionBars    : projections mois a venir (nouveau)
 *   - ClientDonut       : nouveaux vs recurrents (nouveau)
 *   - ProgressGauge     : objectif CA mensuel (nouveau)
 *
 * PACKAGES REQUIS (tous deja disponibles dans Expo) :
 *   - react-native-svg  : pour les composants SVG dans DashboardCharts
 *     => expo install react-native-svg
 *   Aucune autre dependance externe necessaire.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
  TouchableOpacity, Platform, Share, LayoutAnimation,
} from 'react-native';
import {
  FileText, Clock, ArrowUpRight, ArrowDownRight,
  Wallet, Target, AlertTriangle, Truck,
  TrendingUp, BarChart3, Download,
  ShoppingCart, PieChart, CheckCircle, ChevronRight, ChevronDown, CloudOff, RefreshCw,
  MessageSquare, CreditCard, Banknote, Smartphone, Users, Lightbulb, Send, Mail,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { useOffline } from '@/contexts/OfflineContext';
import { formatCurrency, formatCurrencyInteger, formatDate, generateFECExport } from '@/utils/format';
import { generateSalesReportHTML, generateStockReportHTML, generateFinancialReportHTML, generateAndSharePDF } from '@/services/pdfService';
import KPICard from '@/components/KPICard';
import _StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import SectionTabBar from '@/components/SectionTabBar';
import SparklineChart from '@/components/charts/SparklineChart';
import type { DonutSegment } from '@/components/charts/DonutChart';
import {
  HorizontalBarChart,
  TreasuryLineChart, ProjectionBars, ClientDonut,
  LegendRow, HourlyBarChart,
  SimpleLineChart as _SimpleLineChart, StackedBarChart as _StackedBarChart, WaterfallChart as _WaterfallChart,
  GroupedBarChart as _GroupedBarChart, HorizontalRefBarChart,
} from '@/components/charts/DashboardCharts';
import type { StackedBarItem, GroupedBarItem, WaterfallItem } from '@/components/charts/DashboardCharts';
import _MiniAreaChart from '@/components/charts/MiniAreaChart';
import _DailyPulse from '@/components/charts/DailyPulse';
import _RevenueGoalProgress from '@/components/charts/RevenueGoalProgress';
import AverageBasketCard from '@/components/charts/AverageBasketCard';
import RevenueTrendChart from '@/components/charts/RevenueTrendChart';
import _SalesHeatmap from '@/components/charts/SalesHeatmap';
import SmartDonut from '@/components/charts/SmartDonut';
import CashflowRatio from '@/components/charts/CashflowRatio';
import RunwayCard from '@/components/charts/RunwayCard';
import FinancialHealthScore from '@/components/charts/FinancialHealthScore';
import RevenueVsExpensesChart from '@/components/charts/RevenueVsExpensesChart';

import SmartAlerts from '@/components/SmartAlerts';
import ActionableEmptyState from '@/components/ActionableEmptyState';
import TodoToday from '@/components/TodoToday';
import _MonthlyGoalModal from '@/components/MonthlyGoalModal';
import CompactSummaryCard from '@/components/CompactSummaryCard';
import useChartState from '@/hooks/useChartState';
import { useI18n } from '@/contexts/I18nContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS, SEMANTIC_COLORS } from '@/constants/theme';
import { useConfirm } from '@/contexts/ConfirmContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES ET CONSTANTES (types extraits dans types/dashboard.types.ts)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DashboardTab, PeriodFilter, MovementFilter, RealMovement,
  SalesObjectives, VariantDetail, VariantSaleDetail, ProductSaleDetail, VariantAbcData,
} from '@/types/dashboard.types';

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

const DONUT_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316',
];

const PAYMENT_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  cash: Banknote,
  card: CreditCard,
  mobile: Smartphone,
  mobile_wave: Smartphone,
  mobile_om: Smartphone,
  mixed: CreditCard,
  transfer: ArrowUpRight,
  check: FileText,
  twint: Smartphone,
};

const DEFAULT_MONTHLY_TARGET = 100_000;



// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

function extractFirstName(user: { user_metadata?: Record<string, unknown>; email?: string } | null): string | null {
  if (!user) return null;
  const fullName = user.user_metadata?.full_name as string | undefined;
  if (fullName && fullName.trim()) return fullName.trim();
  return null;
}

function getPeriodStart(now: Date, period: PeriodFilter): Date {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'today') return new Date(y, m, now.getDate());
  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return new Date(y, m, now.getDate() - mondayOffset);
  }
  if (period === 'month') return new Date(y, m, 1);
  if (period === 'quarter') return new Date(y, Math.floor(m / 3) * 3, 1);
  return new Date(y, 0, 1);
}

function getPreviousPeriodRange(now: Date, period: PeriodFilter): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'today') {
    const yesterday = new Date(y, m, now.getDate() - 1);
    return { start: yesterday, end: new Date(y, m, now.getDate()) };
  }
  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(y, m, now.getDate() - mondayOffset);
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    return { start: prevMonday, end: thisMonday };
  }
  if (period === 'month') return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
  if (period === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    return { start: new Date(y, qStart - 3, 1), end: new Date(y, qStart, 1) };
  }
  return { start: new Date(y - 1, 0, 1), end: new Date(y, 0, 1) };
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT AVATAR CLIENT (initiales sur fond colore)
// ─────────────────────────────────────────────────────────────────────────────

function ClientAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase();

  // Couleur deterministe basee sur le premier caractere
  const colors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];
  const colorIndex = (name.charCodeAt(0) || 0) % colors.length;
  const bg = colors[colorIndex];

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg + '20',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: bg + '40',
    }}>
      <Text style={{ fontSize: size * 0.34, fontWeight: '700', color: bg }}>{initials}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { successAlert, errorAlert } = useConfirm();

  const {
    invoices, lowStockProducts, activeProducts,
    activeSupplierInvoices, cashMovements, sales, company, clients,
    activePurchaseOrders, getVariantsForProduct, productAttributes,
    activeExpenses, quotes,
  } = useData();

  const cur = company.currency || 'XOF';
  const { pendingSalesCount, isOnline: _isOnline, isSyncing } = useOffline();

  const now = useMemo(() => new Date(), []);
  const firstName = useMemo(() => extractFirstName(user), [user]);
  const greeting = firstName ? `${t('dashboard.greeting')} ${firstName}` : t('dashboard.greeting');

  const todayStr = useMemo(() => {
    const loc = locale === 'en' ? 'en-US' : 'fr-FR';
    return now.toLocaleDateString(loc, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).replace(/^\w/, (c) => c.toUpperCase());
  }, [now, locale]);

  // ─── ETATS DE L'INTERFACE ───
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');
  const [showMovements, setShowMovements] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [expandedAbcProductId, setExpandedAbcProductId] = useState<string | null>(null);
  const [selectedCategory, _setSelectedCategory] = useState<string | null>(null);
  const [_donutCollapseFlag, _setDonutCollapseFlag] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { simplifiedDashboard } = useRole();

  const [salesObjectives, setSalesObjectives] = useState<SalesObjectives | null>(null);
  const [explicitMonthlyGoal, setExplicitMonthlyGoal] = useState<number | null>(null);
  const [_goalModalVisible, _setGoalModalVisible] = useState(false);
  const COMPANY_ID = user?.id ?? 'anonymous';

  useEffect(() => {
    AsyncStorage.getItem(`sales-objectives-${COMPANY_ID}`).then((stored) => {
      if (stored) {
        try {
          setSalesObjectives(JSON.parse(stored) as SalesObjectives);
        } catch { /* ignore */ }
      }
    }).catch(() => {});
    AsyncStorage.getItem(`monthly-ca-goal-${COMPANY_ID}`).then((stored) => {
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val > 0) setExplicitMonthlyGoal(val);
      }
    }).catch(() => {});
  }, [COMPANY_ID]);

  const _handleSaveGoal = useCallback((amount: number) => {
    if (amount <= 0) {
      setExplicitMonthlyGoal(null);
      AsyncStorage.removeItem(`monthly-ca-goal-${COMPANY_ID}`).catch(() => {});
    } else {
      setExplicitMonthlyGoal(amount);
      AsyncStorage.setItem(`monthly-ca-goal-${COMPANY_ID}`, String(amount)).catch(() => {});
    }
  }, [COMPANY_ID]);

  const _monthlyTarget = useMemo(() => {
    if (!salesObjectives) return DEFAULT_MONTHLY_TARGET;
    if (salesObjectives.mode === 'yearly') {
      return salesObjectives.yearlyTarget > 0 ? salesObjectives.yearlyTarget / 12 : DEFAULT_MONTHLY_TARGET;
    }
    const currentMonthKey = String(now.getMonth() + 1).padStart(2, '0');
    const monthVal = salesObjectives.monthlyTargets[currentMonthKey];
    if (monthVal && monthVal > 0) return monthVal;
    const total = Object.values(salesObjectives.monthlyTargets).reduce((s, v) => s + v, 0);
    if (total > 0) return total / 12;
    return DEFAULT_MONTHLY_TARGET;
  }, [salesObjectives, now]);

  const periodStart = useMemo(() => getPeriodStart(now, period).toISOString(), [now, period]);
  const prevPeriod = useMemo(() => getPreviousPeriodRange(now, period), [now, period]);

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULS COMMUNS — revenues, depenses, marges
  // ─────────────────────────────────────────────────────────────────────────

  const paidInvoiceIds = useMemo(() =>
    new Set(invoices.filter(i => i.status === 'paid').map(i => i.id)), [invoices]
  );

  const acceptedQuotesNotConverted = useMemo(() =>
    quotes.filter(q => q.status === 'accepted' && !q.convertedToInvoiceId),
    [quotes]
  );

  const todayStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.toISOString();
  }, [now]);

  const todayRevenue = useMemo(() => {
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= todayStart).reduce((s, i) => s + i.totalTTC, 0);
    const saleRev = sales.filter(s => s.status === 'paid' && s.createdAt >= todayStart && (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))).reduce((s2, sale) => s2 + sale.totalTTC, 0);
    const quoteRev = acceptedQuotesNotConverted.filter(q => q.acceptedAt && q.acceptedAt >= todayStart).reduce((s, q) => s + q.totalTTC, 0);
    return invRev + saleRev + quoteRev;
  }, [invoices, sales, todayStart, paidInvoiceIds, acceptedQuotesNotConverted]);

  const todaySalesCount = useMemo(() =>
    sales.filter(s => s.status === 'paid' && s.createdAt >= todayStart).length +
    invoices.filter(i => i.status === 'paid' && i.issueDate >= todayStart).length,
    [sales, invoices, todayStart]
  );

  const yesterdayStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return d.toISOString();
  }, [now]);

  const yesterdayRevenue = useMemo(() => {
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= yesterdayStart && i.issueDate < todayStart).reduce((s, i) => s + i.totalTTC, 0);
    const saleRev = sales.filter(s => s.status === 'paid' && s.createdAt >= yesterdayStart && s.createdAt < todayStart && (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))).reduce((s2, sale) => s2 + sale.totalTTC, 0);
    const quoteRev = acceptedQuotesNotConverted.filter(q => q.acceptedAt && q.acceptedAt >= yesterdayStart && q.acceptedAt < todayStart).reduce((s, q) => s + q.totalTTC, 0);
    return invRev + saleRev + quoteRev;
  }, [invoices, sales, yesterdayStart, todayStart, paidInvoiceIds, acceptedQuotesNotConverted]);

  const yesterdaySalesCount = useMemo(() =>
    sales.filter(s => s.status === 'paid' && s.createdAt >= yesterdayStart && s.createdAt < todayStart).length +
    invoices.filter(i => i.status === 'paid' && i.issueDate >= yesterdayStart && i.issueDate < todayStart).length,
    [sales, invoices, yesterdayStart, todayStart]
  );

  const _todayAvgTicket = useMemo(() => todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0, [todayRevenue, todaySalesCount]);
  const _yesterdayAvgTicket = useMemo(() => yesterdaySalesCount > 0 ? yesterdayRevenue / yesterdaySalesCount : 0, [yesterdayRevenue, yesterdaySalesCount]);

  const _todayBestSale = useMemo(() => {
    const todaySales = [
      ...sales.filter(s => s.status === 'paid' && s.createdAt >= todayStart).map(s => ({ name: s.clientName || 'Client comptoir', amount: s.totalTTC })),
      ...invoices.filter(i => i.status === 'paid' && i.issueDate >= todayStart).map(i => ({ name: i.clientName, amount: i.totalTTC })),
    ];
    if (todaySales.length === 0) return null;
    return todaySales.reduce((best, s) => s.amount > best.amount ? s : best, todaySales[0]);
  }, [sales, invoices, todayStart]);

  const _todayHourlyData = useMemo(() => {
    const hourCounts: number[] = Array(24).fill(0);
    const allDates = [
      ...sales.filter(s => s.status === 'paid' && s.createdAt >= todayStart).map(s => s.createdAt),
      ...invoices.filter(i => i.status === 'paid' && i.issueDate >= todayStart).map(i => i.issueDate),
    ];
    for (const dateStr of allDates) {
      const d = new Date(dateStr);
      hourCounts[d.getHours()]++;
    }
    return hourCounts;
  }, [sales, invoices, todayStart]);

  const _last3MonthsRevenues = useMemo(() => {
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (3 - i) + 1, 1);
      const dISO = d.toISOString(); const eISO = end.toISOString();
      const invRev = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < eISO).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= dISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      return invRev + saleRev;
    });
  }, [invoices, sales, now]);

  const _daysElapsedInMonth = useMemo(() => now.getDate(), [now]);
  const _daysInCurrentMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), [now]);

  const _currentMonthRevenue = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= monthStart).reduce((s, i) => s + i.totalTTC, 0);
    const saleRev = sales.filter(s => s.status === 'paid' && s.createdAt >= monthStart && (!s.convertedToInvoiceId || !convertedIds.has(s.convertedToInvoiceId))).reduce((s2, sale) => s2 + sale.totalTTC, 0);
    return invRev + saleRev;
  }, [invoices, sales, now]);

  const paidSalesNotInvoiced = useMemo(() =>
    sales.filter(s =>
      s.status === 'paid' && s.createdAt >= periodStart &&
      (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))
    ), [sales, paidInvoiceIds, periodStart]
  );

  const monthlyRevenue = useMemo(() => {
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= periodStart).reduce((s, i) => s + i.totalTTC, 0);
    const salesRev = paidSalesNotInvoiced.reduce((s, sale) => s + sale.totalTTC, 0);
    const quoteRev = acceptedQuotesNotConverted.filter(q => q.acceptedAt && q.acceptedAt >= periodStart).reduce((s, q) => s + q.totalTTC, 0);
    return invRev + salesRev + quoteRev;
  }, [invoices, periodStart, paidSalesNotInvoiced, acceptedQuotesNotConverted]);

  const prevRevenue = useMemo(() => {
    const pStart = prevPeriod.start.toISOString();
    const pEnd = prevPeriod.end.toISOString();
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= pStart && i.issueDate < pEnd).reduce((s, i) => s + i.totalTTC, 0);
    const sRev = sales.filter(s => s.status === 'paid' && s.createdAt >= pStart && s.createdAt < pEnd && (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))).reduce((s, sale) => s + sale.totalTTC, 0);
    const qRev = acceptedQuotesNotConverted.filter(q => q.acceptedAt && q.acceptedAt >= pStart && q.acceptedAt < pEnd).reduce((s, q) => s + q.totalTTC, 0);
    return invRev + sRev + qRev;
  }, [invoices, sales, prevPeriod, paidInvoiceIds, acceptedQuotesNotConverted]);

  const revenueChange = useMemo((): number | undefined => {
    if (prevRevenue === 0 && monthlyRevenue === 0) return 0;
    if (prevRevenue === 0) return undefined;
    return ((monthlyRevenue - prevRevenue) / prevRevenue) * 100;
  }, [monthlyRevenue, prevRevenue]);

  const monthlyExpenses = useMemo(() => {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const supplierExp = activeSupplierInvoices.filter(si => si.date >= periodStart && si.date < end).reduce((s, si) => s + (si.total || 0), 0);
    const cashExp = cashMovements.filter(cm => cm.type === 'expense' && cm.date >= periodStart && cm.date < end && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
    const companyExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= periodStart && e.date < end).reduce((s, e) => s + e.amount, 0);
    const poExp = (activePurchaseOrders ?? []).filter(po => (po.status === 'received' || po.status === 'partial') && po.createdAt >= periodStart && po.createdAt < end).reduce((s, po) => s + (po.total || 0), 0);
    return supplierExp + cashExp + companyExp + poExp;
  }, [activeSupplierInvoices, cashMovements, activeExpenses, activePurchaseOrders, now, periodStart]);

  const grossMargin = monthlyRevenue - monthlyExpenses;

  const paidSalesCount = useMemo(() =>
    sales.filter(s => s.status === 'paid' && s.createdAt >= periodStart).length +
    invoices.filter(i => i.status === 'paid' && i.issueDate >= periodStart).length,
    [sales, invoices, periodStart]
  );

  const pendingPurchaseOrders = useMemo(() =>
    activePurchaseOrders?.filter(po => po.status === 'draft' || po.status === 'sent') ?? [],
    [activePurchaseOrders]
  );

  const prevSalesCount = useMemo(() => {
    const pStart = prevPeriod.start.toISOString();
    const pEnd = prevPeriod.end.toISOString();
    return sales.filter(s => s.status === 'paid' && s.createdAt >= pStart && s.createdAt < pEnd).length +
      invoices.filter(i => i.status === 'paid' && i.issueDate >= pStart && i.issueDate < pEnd).length;
  }, [sales, invoices, prevPeriod]);

  const prevExpenses = useMemo(() => {
    const pStart = prevPeriod.start.toISOString();
    const pEnd = prevPeriod.end.toISOString();
    const supplierExp = activeSupplierInvoices.filter(si => si.date >= pStart && si.date < pEnd).reduce((s, si) => s + (si.total || 0), 0);
    const cashExp = cashMovements.filter(cm => cm.type === 'expense' && cm.date >= pStart && cm.date < pEnd && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
    const companyExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= pStart && e.date < pEnd).reduce((s, e) => s + e.amount, 0);
    return supplierExp + cashExp + companyExp;
  }, [activeSupplierInvoices, cashMovements, activeExpenses, prevPeriod]);

  const prevGrossMargin = prevRevenue - prevExpenses;

  const salesCountChange = useMemo((): number | undefined => {
    if (prevSalesCount === 0 && paidSalesCount === 0) return 0;
    if (prevSalesCount === 0) return undefined;
    return ((paidSalesCount - prevSalesCount) / prevSalesCount) * 100;
  }, [paidSalesCount, prevSalesCount]);

  const marginChange = useMemo((): number | undefined => {
    if (prevGrossMargin === 0 && grossMargin === 0) return 0;
    if (prevGrossMargin === 0) return undefined;
    return ((grossMargin - prevGrossMargin) / Math.abs(prevGrossMargin)) * 100;
  }, [grossMargin, prevGrossMargin]);

  const unpaidInvoices = useMemo(() =>
    invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft'), [invoices]
  );
  const unpaidAmount = useMemo(() =>
    unpaidInvoices.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0), [unpaidInvoices]
  );

  const supplierInvoicesToPay = useMemo(() =>
    activeSupplierInvoices.filter(si => si.status === 'to_pay' || si.status === 'received' || si.status === 'late'), [activeSupplierInvoices]
  );

  const clientsToRemindCount = useMemo(() => new Set(unpaidInvoices.map(i => i.clientId)).size, [unpaidInvoices]);

  const priorityClientsToRemind = useMemo(() => {
    const clientScores = new Map<string, { clientId: string; name: string; unpaidCount: number; totalUnpaid: number; lastPurchaseDate: string; score: number }>();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString();
    for (const inv of unpaidInvoices) {
      const key = inv.clientId;
      const existing = clientScores.get(key) || { clientId: key, name: inv.clientName || 'Client', unpaidCount: 0, totalUnpaid: 0, lastPurchaseDate: '', score: 0 };
      existing.unpaidCount += 1;
      existing.totalUnpaid += inv.totalTTC - inv.paidAmount;
      const isOverdue = new Date(inv.dueDate) < now;
      if (isOverdue) existing.score += 2;
      clientScores.set(key, existing);
    }
    const allClientSales = [
      ...sales.filter(s => s.status === 'paid').map(s => ({ clientId: s.clientId, date: s.createdAt })),
      ...invoices.filter(i => i.status === 'paid').map(i => ({ clientId: i.clientId, date: i.issueDate })),
    ];
    for (const [key, data] of clientScores) {
      const clientSales = allClientSales.filter(s => s.clientId === key);
      const lastSale = clientSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (lastSale) {
        data.lastPurchaseDate = lastSale.date;
        if (lastSale.date < thirtyDaysAgo) data.score += 1;
      }
      if (data.totalUnpaid > 500) data.score += 1;
    }
    return Array.from(clientScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [unpaidInvoices, sales, invoices, now]);

  // ─────────────────────────────────────────────────────────────────────────
  // DONNEES SPARKLINES — tendances hebdomadaires
  // ─────────────────────────────────────────────────────────────────────────

  const revenueSparkline = useMemo(() => {
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    const points: number[] = [];
    for (let w = 6; w >= 0; w--) {
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - (w * 7));
      const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
      const sISO = weekStart.toISOString(); const eISO = weekEnd.toISOString();
      const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= sISO && i.issueDate < eISO).reduce((s2, i) => s2 + i.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      points.push(invRev + saleRev);
    }
    return points;
  }, [invoices, sales, now]);

  const revenueMonthlyTrend = useMemo(() => {
    const pts = revenueSparkline.filter(v => v > 0);
    if (pts.length < 2) return 0;
    const n = revenueSparkline.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) { sumX += i; sumY += revenueSparkline[i]; sumXY += i * revenueSparkline[i]; sumXX += i * i; }
    const denom = n * sumXX - sumX * sumX;
    return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }, [revenueSparkline]);

  const salesSparkline = useMemo(() => {
    const points: number[] = [];
    for (let w = 6; w >= 0; w--) {
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - (w * 7));
      const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
      const sISO = weekStart.toISOString(); const eISO = weekEnd.toISOString();
      points.push(
        sales.filter(s => s.status === 'paid' && s.createdAt >= sISO && s.createdAt < eISO).length +
        invoices.filter(i => i.status === 'paid' && i.issueDate >= sISO && i.issueDate < eISO).length
      );
    }
    return points;
  }, [sales, invoices, now]);

  // ─────────────────────────────────────────────────────────────────────────
  // DONNEES VUE D'ENSEMBLE
  // ─────────────────────────────────────────────────────────────────────────

  const periodChartData = useMemo(() => {
    const bars: { label: string; revenue: number; isCurrent: boolean }[] = [];
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));

    const calcRevenue = (sISO: string, eISO: string) => {
      if (selectedCategory) {
        const getItemRevForCategory = (items: { productId?: string; totalTTC: number }[]) => {
          return items.reduce((sum, item) => {
            const product = activeProducts.find(p => p.id === item.productId);
            const catName = product?.categoryName || 'Autres';
            if (catName === selectedCategory) return sum + item.totalTTC;
            return sum;
          }, 0);
        };
        const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= sISO && i.issueDate < eISO).reduce((s2, i) => s2 + getItemRevForCategory(i.items), 0);
        const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + getItemRevForCategory(sale.items), 0);
        return invRev + saleRev;
      }
      const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= sISO && i.issueDate < eISO).reduce((s2, i) => s2 + i.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      return invRev + saleRev;
    };

    const loc = locale === 'en' ? 'en-US' : 'fr-FR';

    if (period === 'today') {
      for (let h = 0; h < 24; h += 3) {
        const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h);
        const slotEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h + 3);
        const label = `${h}h`;
        bars.push({ label, revenue: calcRevenue(slotStart.toISOString(), slotEnd.toISOString()), isCurrent: now.getHours() >= h && now.getHours() < h + 3 });
      }
    } else if (period === 'week') {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
      const dayNames = locale === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      for (let d = 0; d < 7; d++) {
        const dayStart = new Date(monday); dayStart.setDate(monday.getDate() + d);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
        bars.push({ label: dayNames[d], revenue: calcRevenue(dayStart.toISOString(), dayEnd.toISOString()), isCurrent: dayStart.getDate() === now.getDate() && dayStart.getMonth() === now.getMonth() });
      }
    } else if (period === 'month') {
      for (let w = 4; w >= 0; w--) {
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - (w * 7));
        const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
        const label = `S${Math.ceil((weekEnd.getTime() - new Date(weekEnd.getFullYear(), 0, 1).getTime()) / (7 * 86400000))}`;
        bars.push({ label, revenue: calcRevenue(weekStart.toISOString(), weekEnd.toISOString()), isCurrent: w === 0 });
      }
    } else if (period === 'quarter') {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      for (let m = 0; m < 3; m++) {
        const mStart = new Date(now.getFullYear(), qStart + m, 1);
        const mEnd = new Date(now.getFullYear(), qStart + m + 1, 1);
        const label = mStart.toLocaleDateString(loc, { month: 'short' }).replace('.', '');
        bars.push({ label, revenue: calcRevenue(mStart.toISOString(), mEnd.toISOString()), isCurrent: mStart.getMonth() === now.getMonth() });
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(now.getFullYear(), m, 1);
        const mEnd = new Date(now.getFullYear(), m + 1, 1);
        const label = mStart.toLocaleDateString(loc, { month: 'short' }).replace('.', '');
        bars.push({ label, revenue: calcRevenue(mStart.toISOString(), mEnd.toISOString()), isCurrent: mStart.getMonth() === now.getMonth() });
      }
    }
    return bars;
  }, [invoices, sales, now, period, locale, selectedCategory, activeProducts]);

  const periodChartMax = useMemo(() => Math.max(...periodChartData.map(w => w.revenue), 1) * 1.2, [periodChartData]);
  const _hasPeriodChartData = periodChartData.some(w => w.revenue > 0);
  const _isShortPeriod = period === 'today' || period === 'week';
  const periodChartAsValues = useMemo(() => periodChartData.map(w => ({ value: w.revenue })), [periodChartData]);
  const _periodChartState = useChartState(periodChartAsValues);

  const periodAvg = useMemo(() => {
    const nonZero = periodChartData.filter(w => w.revenue > 0);
    return nonZero.length > 0 ? nonZero.reduce((s, w) => s + w.revenue, 0) / nonZero.length : 0;
  }, [periodChartData]);
  const _periodAvgH = periodChartMax > 0 && periodAvg > 0 ? (periodAvg / periodChartMax) * 140 : 0;

  const _periodChartTitle = useMemo(() => {
    const base = period === 'today' ? t('dashboard.todayRevenue')
      : period === 'week' ? t('dashboard.thisWeek')
      : period === 'month' ? t('dashboard.weeklyRevenue')
      : period === 'quarter' ? t('dashboard.thisQuarter')
      : t('dashboard.thisYear');
    if (selectedCategory) return `${base} — ${selectedCategory}`;
    return base;
  }, [period, t, selectedCategory]);

  const _periodChartSubtitle = useMemo(() => {
    if (period === 'today') return t('dashboard.periodDaily');
    if (period === 'week') return t('dashboard.periodDaily');
    if (period === 'month') return t('dashboard.periodWeekly');
    if (period === 'quarter') return t('dashboard.periodMonthly');
    return t('dashboard.periodMonthly');
  }, [period, t]);

  /** 5 dernieres ventes toutes sources confondues, groupees par jour */
  const recentSales = useMemo(() => {
    const allSales = [
      ...sales.map(s => ({
        id: s.id, date: s.createdAt, client: s.clientName || 'Client comptoir', amount: s.totalTTC, status: s.status as string, paymentMethod: s.paymentMethod,
        items: s.items, totalHT: s.totalHT, totalTVA: s.totalTVA, clientId: s.clientId,
        saleType: 'comptoir' as const,
      })),
      ...invoices.filter(i => i.status !== 'cancelled' && i.status !== 'draft').map(i => ({
        id: i.id, date: i.issueDate, client: i.clientName, amount: i.totalTTC, status: i.status === 'paid' ? 'paid' : 'unpaid', paymentMethod: 'transfer' as const,
        items: i.items, totalHT: i.totalHT, totalTVA: i.totalTVA, clientId: i.clientId,
        saleType: 'facture' as const,
      })),
    ];
    return allSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [sales, invoices]);

  const recentSalesMax = useMemo(() =>
    recentSales.length === 0 ? 1 : Math.max(...recentSales.map(s => s.amount), 1),
    [recentSales]
  );

  const recentSalesTotalCA = useMemo(() =>
    recentSales.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.amount, 0),
    [recentSales]
  );

  const recentSalesGrouped = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; sales: typeof recentSales }[] = [];
    const loc = locale === 'en' ? 'en-US' : 'fr-FR';
    for (const sale of recentSales) {
      const d = new Date(sale.date);
      const dateKey = d.toISOString().slice(0, 10);
      const isToday = dateKey === now.toISOString().slice(0, 10);
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = dateKey === yesterday.toISOString().slice(0, 10);
      const dateLabel = isToday ? "Aujourd'hui" : isYesterday ? 'Hier' : d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/^\w/, c => c.toUpperCase());
      const existing = groups.find(g => g.dateKey === dateKey);
      if (existing) {
        existing.sales.push(sale);
      } else {
        groups.push({ dateKey, dateLabel, sales: [sale] });
      }
    }
    return groups;
  }, [recentSales, now, locale]);

  /** Donut repartition ventes par categorie produit */
  const _categoryBreakdown = useMemo((): DonutSegment[] => {
    const catMap = new Map<string, { label: string; value: number; quantity: number }>();
    const processSaleItems = (items: { productId?: string; totalTTC: number; quantity?: number }[]) => {
        for (const item of items) {
          const product = activeProducts.find(p => p.id === item.productId);
          const catName = product?.categoryName || 'Autres';
          const existing = catMap.get(catName) || { label: catName, value: 0, quantity: 0 };
          existing.value += item.totalTTC;
          existing.quantity += (item.quantity || 1);
          catMap.set(catName, existing);
        }
      };
    sales.filter(s => s.status === 'paid' && s.createdAt >= periodStart).forEach(s => processSaleItems(s.items));
    invoices.filter(i => i.status === 'paid' && i.issueDate >= periodStart).forEach(i => processSaleItems(i.items));
    return Array.from(catMap.values()).sort((a, b) => b.value - a.value).slice(0, 7)
        .map((item, idx) => ({ ...item, color: DONUT_PALETTE[idx % DONUT_PALETTE.length] }));
    }, [sales, invoices, activeProducts, periodStart]);

    /** Détail des ventes par catégorie - types importés depuis types/dashboard.types.ts */

  const getProductVariantDetails = useCallback((productId: string): VariantDetail[] => {
    const variants = getVariantsForProduct(productId);
    if (variants.length === 0) return [];
    const sortedAttrs = [...productAttributes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return variants.map(v => {
      const parts: string[] = [];
      for (const attr of sortedAttrs) {
        const val = v.attributes[attr.name];
        if (val) parts.push(`${attr.name}: ${val}`);
      }
      const extraKeys = Object.keys(v.attributes).filter(k => !sortedAttrs.some(a => a.name === k));
      for (const k of extraKeys) {
        parts.push(`${k}: ${v.attributes[k]}`);
      }
      return {
        variantId: v.id,
        attributes: v.attributes,
        attributeLabel: parts.join(', '),
      };
    });
  }, [getVariantsForProduct, productAttributes]);

const getVariantLabel = useCallback((productId: string, variantId: string): string => {
    const allVariants = getVariantsForProduct(productId);
    const variant = allVariants.find(v => v.id === variantId);
    if (!variant) return '';
    const sortedAttrs = [...productAttributes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const parts: string[] = [];
    for (const attr of sortedAttrs) {
      const val = variant.attributes[attr.name];
      if (val) parts.push(`${attr.name}: ${val}`);
    }
    const extraKeys = Object.keys(variant.attributes).filter(k => !sortedAttrs.some(a => a.name === k));
    for (const k of extraKeys) {
      parts.push(`${k}: ${variant.attributes[k]}`);
    }
    return parts.join(', ');
  }, [getVariantsForProduct, productAttributes]);

const _salesDetailsByCategory = useMemo(() => {
  const detailsMap = new Map<string, Array<ProductSaleDetail>>();

  const processItems = (items: Array<{ productId: string; productName: string; quantity: number; totalTTC: number; unitPrice: number; totalHT: number; totalTVA: number; [key: string]: unknown }>) => {
    for (const item of items) {
      const product = activeProducts.find(p => p.id === item.productId);
      const catName = product?.categoryName || 'Autres';
      if (!detailsMap.has(catName)) {
        detailsMap.set(catName, []);
      }
      const existing = detailsMap.get(catName)!;
      const existingProduct = existing.find(p => p.productId === item.productId);
      const itemVariantId = (item as { variantId?: string }).variantId;
      if (existingProduct) {
        existingProduct.quantity += item.quantity;
        existingProduct.totalTTC += item.totalTTC;
        if (item.totalHT) existingProduct.totalHT = (existingProduct.totalHT || 0) + item.totalHT;
        if (item.totalTVA) existingProduct.totalTVA = (existingProduct.totalTVA || 0) + item.totalTVA;
        if (itemVariantId) {
          const existingVarSale = existingProduct.variantSales.find(vs => vs.variantId === itemVariantId);
          if (existingVarSale) {
            existingVarSale.quantity += item.quantity;
            existingVarSale.totalTTC += item.totalTTC;
          } else {
            existingProduct.variantSales.push({
              variantId: itemVariantId,
              attributeLabel: getVariantLabel(item.productId, itemVariantId),
              quantity: item.quantity,
              totalTTC: item.totalTTC,
              unitPrice: item.unitPrice,
            });
          }
        }
      } else {
        const variantSales: VariantSaleDetail[] = [];
        if (itemVariantId) {
          variantSales.push({
            variantId: itemVariantId,
            attributeLabel: getVariantLabel(item.productId, itemVariantId),
            quantity: item.quantity,
            totalTTC: item.totalTTC,
            unitPrice: item.unitPrice,
          });
        }
        existing.push({
          productId: item.productId || '',
          productName: item.productName,
          quantity: item.quantity,
          totalTTC: item.totalTTC,
          attributes: '',
          unitPrice: item.unitPrice,
          totalHT: item.totalHT,
          totalTVA: item.totalTVA,
          variants: getProductVariantDetails(item.productId),
          variantSales,
        });
      }
    }
  };

  sales.filter(s => s.status === 'paid' && s.createdAt >= periodStart).forEach(sale => {
    processItems(sale.items as any);
  });

  invoices.filter(i => i.status === 'paid' && i.issueDate >= periodStart).forEach(invoice => {
    processItems(invoice.items as any);
  });

  const result = new Map<string, Array<ProductSaleDetail>>();
  for (const [catName, products] of detailsMap) {
    result.set(catName, products.sort((a, b) => b.totalTTC - a.totalTTC));
  }
  return result;
}, [sales, invoices, activeProducts, periodStart, getProductVariantDetails, getVariantLabel]);

  // ─────────────────────────────────────────────────────────────────────────
  // DONNEES ONGLET ANALYSE
  // ─────────────────────────────────────────────────────────────────────────

  /** Evolution CA vs Depenses sur les 6 derniers mois — pour l'area chart */
  const sixMonthsData = useMemo(() => {
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const dISO = d.toISOString(); const eISO = end.toISOString();
      const invRev = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < eISO).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= dISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      const exp = activeSupplierInvoices.filter(si => si.date >= dISO && si.date < eISO).reduce((s, si) => s + (si.total || 0), 0);
      const cashExp = cashMovements.filter(cm => cm.type === 'expense' && cm.date >= dISO && cm.date < eISO && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
      const compExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= dISO && e.date < eISO).reduce((s, e) => s + e.amount, 0);
      return { label, revenue: invRev + saleRev, expenses: exp + cashExp + compExp, margin: invRev + saleRev - exp - cashExp - compExp };
    });
  }, [invoices, sales, activeSupplierInvoices, cashMovements, activeExpenses, now]);

  const marginEvolution = useMemo(() => sixMonthsData.map(m => ({ label: m.label, margin: m.margin })), [sixMonthsData]);
  const _marginMax = useMemo(() => Math.max(...marginEvolution.map(m => Math.abs(m.margin)), 1), [marginEvolution]);

  /** Marge par categorie produit — pour le bar chart horizontal */
  const marginByCategory = useMemo(() => {
    const catMap = new Map<string, { revenue: number; cost: number }>();
    const processSale = (items: { productId?: string; totalTTC: number; quantity?: number }[], _isInvoice = false) => {
      for (const item of items) {
        const product = activeProducts.find(p => p.id === item.productId);
        const catName = product?.categoryName || 'Autres';
        const existing = catMap.get(catName) || { revenue: 0, cost: 0 };
        existing.revenue += item.totalTTC;
        existing.cost += (product?.purchasePrice || 0) * (item.quantity || 1);
        catMap.set(catName, existing);
      }
    };
    sales.filter(s => s.status === 'paid' && s.createdAt >= periodStart).forEach(s => processSale(s.items));
    invoices.filter(i => i.status === 'paid' && i.issueDate >= periodStart).forEach(i => processSale(i.items, true));
    const catEntries = Array.from(catMap.entries());
    const totalCatRev = catEntries.reduce((s, [, { revenue }]) => s + revenue, 0);
    return catEntries
      .map(([label, { revenue, cost }], idx) => {
        const pct = totalCatRev > 0 ? Math.round((revenue / totalCatRev) * 100) : 0;
        return { label: `${label} · ${pct}%`, value: revenue - cost, color: DONUT_PALETTE[idx % DONUT_PALETTE.length] };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sales, invoices, activeProducts, periodStart]);

  const marginCategoryChartState = useChartState(marginByCategory);

  const heatmapHours = useMemo(() => {
    const arr: number[] = [];
    for (let h = 6; h <= 22; h++) arr.push(h);
    return arr;
  }, []);

  const fullHeatmapData = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(heatmapHours.length).fill(0));
    const allSalesItems = [
      ...sales.filter(s => s.status === 'paid').map(s => s.createdAt),
      ...invoices.filter(i => i.status === 'paid').map(i => i.issueDate),
    ];
    for (const dateStr of allSalesItems) {
      const d = new Date(dateStr);
      const dayIdx = (d.getDay() + 6) % 7;
      const h = d.getHours();
      const hIdx = heatmapHours.indexOf(h);
      if (hIdx >= 0) matrix[dayIdx][hIdx]++;
    }
    return matrix;
  }, [sales, invoices, heatmapHours]);

  const _totalHeatmapSales = useMemo(() => fullHeatmapData.flat().reduce((s, v) => s + v, 0), [fullHeatmapData]);
  const _heatmapReady = _totalHeatmapSales >= 30;

  const [hourlyDayFilter, setHourlyDayFilter] = useState<number | null>(null);

  const hourlyBarData = useMemo(() => {
    const hourCounts: number[] = Array(24).fill(0);
    const allDates = [
      ...sales.filter(s => s.status === 'paid').map(s => s.createdAt),
      ...invoices.filter(i => i.status === 'paid').map(i => i.issueDate),
    ];
    for (const dateStr of allDates) {
      const d = new Date(dateStr);
      const dayIdx = (d.getDay() + 6) % 7;
      if (hourlyDayFilter !== null && dayIdx !== hourlyDayFilter) continue;
      hourCounts[d.getHours()]++;
    }
    return hourCounts;
  }, [sales, invoices, hourlyDayFilter]);

  const hourlyChartValues = useMemo(() => hourlyBarData.map(v => ({ value: v })), [hourlyBarData]);
  const hourlyChartState = useChartState(hourlyChartValues);

  /** Repartition clients nouveaux vs recurrents */
  const clientRecurrence = useMemo(() => {
    const _sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
    const clientPurchaseDates: Record<string, string[]> = {};

    const recordClient = (clientId: string | undefined, clientName: string | undefined, date: string) => {
      const key = clientId || clientName || 'inconnu';
      if (!clientPurchaseDates[key]) clientPurchaseDates[key] = [];
      clientPurchaseDates[key].push(date);
    };

    sales.filter(s => s.status === 'paid').forEach(s => recordClient(s.clientId, s.clientName, s.createdAt));
    invoices.filter(i => i.status === 'paid').forEach(i => recordClient(i.clientId, i.clientName, i.issueDate));

    let newCount = 0;
    let recurringCount = 0;
    for (const dates of Object.values(clientPurchaseDates)) {
      const sorted = dates.sort();
      if (sorted.length === 1) newCount++;
      else recurringCount++;
    }
    return { newCount, recurringCount };
  }, [sales, invoices, now]);

  /** Top 5 produits */
  const _topProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; qty: number; ca: number; cost: number }>();
    const record = (id: string, name: string, qty: number, total: number) => {
      const ex = productMap.get(id) || { name, qty: 0, ca: 0, cost: 0 };
      ex.qty += qty; ex.ca += total;
      const product = activeProducts.find(p => p.id === id);
      ex.cost += (product?.purchasePrice || 0) * qty;
      productMap.set(id, ex);
    };
    sales.filter(s => s.status === 'paid').forEach(s => s.items.forEach(i => record(i.productId, i.productName, i.quantity, i.totalTTC)));
    invoices.filter(i => i.status === 'paid').forEach(inv => inv.items.forEach(i => record(i.productId, i.productName, i.quantity, i.totalTTC)));
    return Array.from(productMap.values()).sort((a, b) => b.ca - a.ca).slice(0, 5);
  }, [sales, invoices, activeProducts]);

  const allProducts = useMemo(() => {
    const productMap = new Map<string, { id: string; name: string; qty: number; ca: number; cost: number; category: string }>();
    const record = (id: string, name: string, qty: number, total: number) => {
      const ex = productMap.get(id) || { id, name, qty: 0, ca: 0, cost: 0, category: '' };
      ex.qty += qty; ex.ca += total;
      const product = activeProducts.find(p => p.id === id);
      ex.cost += (product?.purchasePrice || 0) * qty;
      ex.category = product?.categoryName || 'Autres';
      productMap.set(id, ex);
    };
    sales.filter(s => s.status === 'paid').forEach(s => s.items.forEach(i => record(i.productId, i.productName, i.quantity, i.totalTTC)));
    invoices.filter(i => i.status === 'paid').forEach(inv => inv.items.forEach(i => record(i.productId, i.productName, i.quantity, i.totalTTC)));
    return Array.from(productMap.values()).sort((a, b) => b.ca - a.ca);
  }, [sales, invoices, activeProducts]);

  const abcClassification = useMemo(() => {
    const totalCA = allProducts.reduce((s, p) => s + p.ca, 0);
    if (totalCA === 0) return [];
    let cumulative = 0;
    return allProducts.map(p => {
      cumulative += p.ca;
      const pctCA = (p.ca / totalCA) * 100;
      const cumulPct = (cumulative / totalCA) * 100;
      const abc: 'A' | 'B' | 'C' = cumulPct <= 80 ? 'A' : cumulPct <= 95 ? 'B' : 'C';
      const margin = p.ca - p.cost;
      return { ...p, pctCA, abc, margin };
    });
  }, [allProducts]);

  const productSparklines7d = useMemo(() => {
    const sparkMap = new Map<string, number[]>();
    const allItems: { productName: string; date: string; qty: number }[] = [];
    sales.filter(s => s.status === 'paid').forEach(s => s.items.forEach(i => allItems.push({ productName: i.productName, date: s.createdAt, qty: i.quantity })));
    invoices.filter(i => i.status === 'paid').forEach(inv => inv.items.forEach(i => allItems.push({ productName: i.productName, date: inv.issueDate, qty: i.quantity })));
    for (let d = 6; d >= 0; d--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d + 1);
      const dISO = dayStart.toISOString();
      const eISO = dayEnd.toISOString();
      for (const item of allItems) {
        if (item.date >= dISO && item.date < eISO) {
          const existing = sparkMap.get(item.productName) || Array(7).fill(0);
          existing[6 - d] += item.qty;
          sparkMap.set(item.productName, existing);
        }
      }
      for (const [key, arr] of sparkMap) {
        if (arr.length < 7) sparkMap.set(key, [...Array(7 - arr.length).fill(0), ...arr]);
      }
    }
    return sparkMap;
  }, [sales, invoices, now]);

  const variantAbcMap = useMemo(() => {
    const map = new Map<string, VariantAbcData[]>();
    const variantRevMap = new Map<string, { ca: number; cost: number; daily: number[] }>();

    const collectItems = (items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalTTC: number; [key: string]: unknown }>, date: string) => {
      for (const item of items) {
        const vid = (item as { variantId?: string }).variantId;
        if (!vid) continue;
        const key = `${item.productId}::${vid}`;
        const ex = variantRevMap.get(key) || { ca: 0, cost: 0, daily: Array(7).fill(0) };
        ex.ca += item.totalTTC;
        const variant = getVariantsForProduct(item.productId).find(v => v.id === vid);
        ex.cost += (variant?.purchasePrice || 0) * item.quantity;
        for (let d = 6; d >= 0; d--) {
          const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
          const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d + 1);
          if (date >= dayStart.toISOString() && date < dayEnd.toISOString()) {
            ex.daily[6 - d] += item.quantity * item.unitPrice;
          }
        }
        variantRevMap.set(key, ex);
      }
    };

    sales.filter(s => s.status === 'paid').forEach(s => collectItems(s.items as any, s.createdAt));
    invoices.filter(i => i.status === 'paid').forEach(inv => collectItems(inv.items as any, inv.issueDate));

    for (const [compositeKey, data] of variantRevMap) {
      const [productId, variantId] = compositeKey.split('::');
      const label = getVariantLabel(productId, variantId);
      const daysWithData = data.daily.filter(v => v > 0).length;
      const hasSufficientData = daysWithData >= 3;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (hasSufficientData) {
        const first3 = (data.daily[0] + data.daily[1] + data.daily[2]) / 3;
        const last3 = (data.daily[4] + data.daily[5] + data.daily[6]) / 3;
        const avg = (first3 + last3) / 2 || 1;
        const change = ((last3 - first3) / avg) * 100;
        if (change > 5) trend = 'up';
        else if (change < -5) trend = 'down';
      }
      const existing = map.get(productId) || [];
      existing.push({
        variantId,
        label: label || variantId.slice(0, 8),
        ca: data.ca,
        margin: data.ca - data.cost,
        sparkline: data.daily,
        trend,
        hasSufficientData,
      });
      map.set(productId, existing);
    }

    for (const [pid, variants] of map) {
      map.set(pid, variants.sort((a, b) => b.ca - a.ca));
    }
    return map;
  }, [sales, invoices, now, getVariantsForProduct, getVariantLabel]);

  const getTrendColor = useCallback((trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return '#059669';
    if (trend === 'down') return '#DC2626';
    return '#9CA3AF';
  }, []);

  const getTrendArrow = useCallback((trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return '\u2197';
    if (trend === 'down') return '\u2198';
    return '\u2192';
  }, []);

  const avgBasketEvolution = useMemo(() => {
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    const loc = locale === 'en' ? 'en-US' : 'fr-FR';
    const useWeeks = period === 'month' || period === 'week';
    const nbPeriods = useWeeks ? 6 : 6;
    return Array.from({ length: nbPeriods }, (_, i) => {
      let start: Date, end: Date, label: string;
      if (useWeeks) {
        end = new Date(now); end.setDate(end.getDate() - ((nbPeriods - 1 - i) * 7));
        start = new Date(end); start.setDate(start.getDate() - 7);
        label = `S${Math.ceil((end.getTime() - new Date(end.getFullYear(), 0, 1).getTime()) / (7 * 86400000))}`;
      } else {
        start = new Date(now.getFullYear(), now.getMonth() - (nbPeriods - 1 - i), 1);
        end = new Date(now.getFullYear(), now.getMonth() - (nbPeriods - 1 - i) + 1, 1);
        label = start.toLocaleDateString(loc, { month: 'short' }).replace('.', '');
      }
      const sISO = start.toISOString(); const eISO = end.toISOString();
      const invRev = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= sISO && inv.issueDate < eISO).reduce((s2, inv) => s2 + inv.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      const invCount = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= sISO && inv.issueDate < eISO).length;
      const saleCount = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO).length;
      const totalRev = invRev + saleRev;
      const totalCount = invCount + saleCount;
      return { label, value: totalCount > 0 ? totalRev / totalCount : 0 };
    });
  }, [invoices, sales, now, period, locale]);

  const currentAvgBasket = useMemo(() => {
    const vals = avgBasketEvolution.filter(v => v.value > 0);
    return vals.length > 0 ? vals[vals.length - 1].value : 0;
  }, [avgBasketEvolution]);

  const prevAvgBasket = useMemo(() => {
    const vals = avgBasketEvolution.filter(v => v.value > 0);
    return vals.length > 1 ? vals[vals.length - 2].value : 0;
  }, [avgBasketEvolution]);

  const _avgBasketChange = useMemo((): number | undefined => {
    if (prevAvgBasket === 0 && currentAvgBasket === 0) return 0;
    if (prevAvgBasket === 0) return undefined;
    return ((currentAvgBasket - prevAvgBasket) / prevAvgBasket) * 100;
  }, [currentAvgBasket, prevAvgBasket]);

  const netMarginEvolution = useMemo(() => {
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    const nbMonths = 12;
    return Array.from({ length: nbMonths }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (nbMonths - 1 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (nbMonths - 1 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const dISO = d.toISOString(); const eISO = end.toISOString();
      const invRev = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < eISO).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= dISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      const exp = activeSupplierInvoices.filter(si => si.date >= dISO && si.date < eISO).reduce((s, si) => s + (si.total || 0), 0);
      const cashExp = cashMovements.filter(cm => cm.type === 'expense' && cm.date >= dISO && cm.date < eISO && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
      const compExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= dISO && e.date < eISO).reduce((s, e) => s + e.amount, 0);
      return { label, value: invRev + saleRev - exp - cashExp - compExp };
    });
  }, [invoices, sales, activeSupplierInvoices, cashMovements, activeExpenses, now]);

  const clientLoyaltyData = useMemo((): StackedBarItem[] => {
    const nbMonths = 6;
    const clientFirstPurchase: Record<string, string> = {};
    const clientLastPurchase: Record<string, string> = {};
    const allTransactions: { clientKey: string; date: string }[] = [];
    sales.filter(s => s.status === 'paid').forEach(s => {
      const key = s.clientId || s.clientName || 'inconnu';
      allTransactions.push({ clientKey: key, date: s.createdAt });
    });
    invoices.filter(i => i.status === 'paid').forEach(i => {
      const key = i.clientId || i.clientName || 'inconnu';
      allTransactions.push({ clientKey: key, date: i.issueDate });
    });
    for (const tx of allTransactions) {
      if (!clientFirstPurchase[tx.clientKey] || tx.date < clientFirstPurchase[tx.clientKey]) {
        clientFirstPurchase[tx.clientKey] = tx.date;
      }
      if (!clientLastPurchase[tx.clientKey] || tx.date > clientLastPurchase[tx.clientKey]) {
        clientLastPurchase[tx.clientKey] = tx.date;
      }
    }

    return Array.from({ length: nbMonths }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (nbMonths - 1 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (nbMonths - 1 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const dISO = d.toISOString(); const eISO = end.toISOString();
      const thirtyDaysBefore = new Date(d); thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);
      const thirtyISO = thirtyDaysBefore.toISOString();

      let newClients = 0;
      let recurringClients = 0;
      let inactiveClients = 0;
      const activeThisMonth = new Set<string>();

      for (const tx of allTransactions) {
        if (tx.date >= dISO && tx.date < eISO) {
          activeThisMonth.add(tx.clientKey);
        }
      }

      for (const key of activeThisMonth) {
        const firstDate = clientFirstPurchase[key];
        if (firstDate >= dISO && firstDate < eISO) {
          newClients++;
        } else {
          recurringClients++;
        }
      }

      for (const key of Object.keys(clientLastPurchase)) {
        if (!activeThisMonth.has(key) && clientLastPurchase[key] < dISO && clientLastPurchase[key] >= thirtyISO) {
          inactiveClients++;
        }
      }

      return {
        label,
        segments: [
          { value: newClients, color: '#6366F1', label: 'Nouveaux' },
          { value: recurringClients, color: '#10B981', label: 'Récurrents' },
          { value: inactiveClients, color: '#9CA3AF', label: 'Inactifs' },
        ],
      };
    });
  }, [sales, invoices, now]);

  const loyaltyChartValues = useMemo(() => clientLoyaltyData.map(d => ({ value: d.segments.reduce((s, seg) => s + seg.value, 0) })), [clientLoyaltyData]);
  const _loyaltyChartState = useChartState(loyaltyChartValues);

  const loyaltyRate = useMemo(() => {
    const total = clientRecurrence.newCount + clientRecurrence.recurringCount;
    return total > 0 ? Math.round((clientRecurrence.recurringCount / total) * 100) : 0;
  }, [clientRecurrence]);

  const nVsN1Data = useMemo((): GroupedBarItem[] => {
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    const thisYear = now.getFullYear();
    const calcRevForMonth = (year: number, month: number) => {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 1);
      const sISO = start.toISOString(); const eISO = end.toISOString();
      const invRev = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= sISO && inv.issueDate < eISO).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      return invRev + saleRev;
    };
    return Array.from({ length: 12 }, (_, m) => {
      const label = new Date(thisYear, m, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const valueA = calcRevForMonth(thisYear, m);
      const valueB = calcRevForMonth(thisYear - 1, m);
      const change = valueB > 0 ? ((valueA - valueB) / valueB) * 100 : undefined;
      return { label, valueA, valueB, change };
    });
  }, [invoices, sales, now]);

  const _hasN1Data = useMemo(() => nVsN1Data.some(d => d.valueB > 0), [nVsN1Data]);

  const nVsN1ChartValues = useMemo(() => nVsN1Data.map(d => ({ value: d.valueA + d.valueB })), [nVsN1Data]);
  const _nVsN1ChartState = useChartState(nVsN1ChartValues);

  const _breakEvenLine = useMemo(() => {
    const totalFixedCosts = cashMovements.filter(cm => cm.type === 'expense' && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0) / Math.max(1, 6);
    const totalRevenue = sixMonthsData.reduce((s, m) => s + m.revenue, 0);
    const totalExpenses = sixMonthsData.reduce((s, m) => s + m.expenses, 0);
    const marginRate = totalRevenue > 0 ? (totalRevenue - totalExpenses) / totalRevenue : 0;
    return marginRate > 0 ? totalFixedCosts / marginRate : 0;
  }, [cashMovements, sixMonthsData]);

  const _waterfallData = useMemo((): WaterfallItem[] => {
    const supplierCosts = activeSupplierInvoices
      .filter(si => si.date >= periodStart)
      .reduce((s, si) => s + (si.total || 0), 0);
    const fixedCharges = cashMovements
      .filter(cm => cm.type === 'expense' && !cm.sourceType && cm.date >= periodStart)
      .reduce((s, cm) => s + cm.amount, 0);
    const netResult = monthlyRevenue - supplierCosts - fixedCharges;
    return [
      { label: 'CA encaissé', value: monthlyRevenue, type: 'positive' as const },
      { label: 'Fournisseurs', value: supplierCosts, type: 'negative' as const },
      { label: 'Charges fixes', value: fixedCharges, type: 'negative' as const },
      { label: 'Résultat', value: netResult, type: 'total' as const },
    ];
  }, [monthlyRevenue, activeSupplierInvoices, cashMovements, periodStart]);

  const paymentDelayData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const dISO = d.toISOString();
      const eISO = end.toISOString();
      const paidInMonth = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < eISO);
      if (paidInMonth.length === 0) return { label, value: 0 };
      const totalDays = paidInMonth.reduce((sum, inv) => {
        const issued = new Date(inv.issueDate).getTime();
        const due = new Date(inv.dueDate).getTime();
        return sum + Math.max(0, (due - issued) / 86400000);
      }, 0);
      return { label, value: totalDays / paidInMonth.length };
    });
  }, [invoices, now]);

  const avgPaymentDelay = useMemo(() => {
    const vals = paymentDelayData.filter(d => d.value > 0);
    return vals.length > 0 ? Math.round(vals.reduce((s, d) => s + d.value, 0) / vals.length) : 0;
  }, [paymentDelayData]);

  const expenseBreakdownSegments = useMemo((): DonutSegment[] => {
    const supplierTotal = activeSupplierInvoices
      .filter(si => si.date >= periodStart)
      .reduce((s, si) => s + (si.total || 0), 0);
    const fixedCharges = cashMovements
      .filter(cm => cm.type === 'expense' && !cm.sourceType && cm.date >= periodStart)
      .reduce((s, cm) => s + cm.amount, 0);
    const segments: DonutSegment[] = [];
    if (supplierTotal > 0) segments.push({ label: 'Matières premières', value: supplierTotal, color: '#6366F1' });
    if (fixedCharges > 0) segments.push({ label: 'Charges fixes', value: fixedCharges, color: '#F59E0B' });
    return segments;
  }, [activeSupplierInvoices, cashMovements, periodStart]);

  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const refreshMinutesAgo = useMemo(() => {
    return Math.floor((now.getTime() - lastRefreshTime.getTime()) / 60000);
  }, [now, lastRefreshTime]);

  const globalHealthStatus = useMemo((): 'green' | 'orange' | 'red' => {
    const bal = cashMovements.length === 0 ? 0 : cashMovements.reduce((b, cm) => cm.type === 'income' ? b + cm.amount : b - cm.amount, 0);
    if (bal < 0) return 'red';
    const veryLateInvoices = invoices.filter(i => {
      if (i.status !== 'sent' && i.status !== 'late') return false;
      const daysLate = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
      return daysLate > 30;
    });
    if (veryLateInvoices.length > 0) return 'red';
    if (lowStockProducts.length > 0 || unpaidInvoices.length > 0) return 'orange';
    return 'green';
  }, [cashMovements, invoices, now, lowStockProducts, unpaidInvoices]);

  // ─────────────────────────────────────────────────────────────────────────
  // DONNEES ONGLET TRESORERIE
  // ─────────────────────────────────────────────────────────────────────────

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clients) map[c.id] = c.companyName || `${c.firstName} ${c.lastName}`;
    return map;
  }, [clients]);

  const treasuryPeriodStart = useMemo(() => {
    const d = new Date(now); d.setMonth(d.getMonth() - 6); return d;
  }, [now]);

  const cashBalance = useMemo(() =>
    cashMovements.length === 0 ? 0 : cashMovements.reduce((bal, cm) => cm.type === 'income' ? bal + cm.amount : bal - cm.amount, 0),
    [cashMovements]
  );

  const paidInvoicesTreasury = useMemo(() =>
    invoices.filter(i => i.status === 'paid' && new Date(i.issueDate) >= treasuryPeriodStart), [invoices, treasuryPeriodStart]
  );
  const paidSupplierInvoicesTreasury = useMemo(() =>
    activeSupplierInvoices.filter(si => si.status === 'paid' && new Date(si.date) >= treasuryPeriodStart), [activeSupplierInvoices, treasuryPeriodStart]
  );
  const paidSalesTreasury = useMemo(() =>
    sales.filter(s => s.status === 'paid' && new Date(s.createdAt) >= treasuryPeriodStart), [sales, treasuryPeriodStart]
  );
  const refundedSalesTreasury = useMemo(() =>
    sales.filter(s => s.status === 'refunded' && s.refundedAt && new Date(s.refundedAt) >= treasuryPeriodStart), [sales, treasuryPeriodStart]
  );
  const paidInvoiceIdsTreasury = useMemo(() => new Set(paidInvoicesTreasury.map(i => i.id)), [paidInvoicesTreasury]);
  const salesNotFromInvoicesTreasury = useMemo(() =>
    paidSalesTreasury.filter(s => !s.convertedToInvoiceId || !paidInvoiceIdsTreasury.has(s.convertedToInvoiceId)), [paidSalesTreasury, paidInvoiceIdsTreasury]
  );

  const totalEncaissements = useMemo(() =>
    paidInvoicesTreasury.reduce((s, i) => s + i.totalTTC, 0) + salesNotFromInvoicesTreasury.reduce((s, sale) => s + sale.totalTTC, 0),
    [paidInvoicesTreasury, salesNotFromInvoicesTreasury]
  );
  const expensesTreasuryTotal = useMemo(() => {
    const startISO = treasuryPeriodStart.toISOString();
    return activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= startISO).reduce((s, e) => s + e.amount, 0);
  }, [activeExpenses, treasuryPeriodStart]);
  const totalDecaissements = useMemo(() =>
    paidSupplierInvoicesTreasury.reduce((s, si) => s + (si.total || 0), 0) + refundedSalesTreasury.reduce((s, sale) => s + sale.totalTTC, 0) + expensesTreasuryTotal,
    [paidSupplierInvoicesTreasury, refundedSalesTreasury, expensesTreasuryTotal]
  );

  const supplierInvoicesToPayTreasury = useMemo(() =>
    activeSupplierInvoices.filter(si => si.status === 'to_pay' || si.status === 'received' || si.status === 'late'),
    [activeSupplierInvoices]
  );
  const totalSupplierToPay = useMemo(() =>
    supplierInvoicesToPayTreasury.reduce((s, si) => s + (si.total || 0), 0),
    [supplierInvoicesToPayTreasury]
  );
  const totalDecaissementsWithPlanned = totalDecaissements + totalSupplierToPay;

  const monthlyExpensesAvg = useMemo(() => {
    const months = 6;
    let total = 0;
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const dISO = d.toISOString();
      const eISO = end.toISOString();
      const supplierExp = activeSupplierInvoices.filter(si => si.date >= dISO && si.date < eISO).reduce((s, si) => s + (si.total || 0), 0);
      const cashExp = cashMovements.filter(cm => cm.type === 'expense' && cm.date >= dISO && cm.date < eISO && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
      const compExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= dISO && e.date < eISO).reduce((s, e) => s + e.amount, 0);
      total += supplierExp + cashExp + compExp;
    }
    return total / months;
  }, [activeSupplierInvoices, cashMovements, activeExpenses, now]);

  /** Sparkline solde cumule sur 6 mois */
  const treasurySparkline = useMemo(() => {
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    let runningBalance = 0;
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const dISO = d.toISOString(); const eISO = end.toISOString();
      const enc = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < eISO).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleEnc = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= dISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      const dec = activeSupplierInvoices.filter(si => si.status === 'paid' && si.date >= dISO && si.date < eISO).reduce((s, si) => s + (si.total || 0), 0);
      const compExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= dISO && e.date < eISO).reduce((s, e) => s + e.amount, 0);
      runningBalance += (enc + saleEnc) - dec - compExp;
      return runningBalance;
    });
  }, [invoices, sales, activeSupplierInvoices, activeExpenses, now]);

  /** Flux entrees / sorties sur 6 mois pour les barres stacked */
  const treasuryMonthlyData = useMemo(() => {
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const enc = invoices.filter(inv => inv.status === 'paid' && new Date(inv.issueDate) >= d && new Date(inv.issueDate) < end).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleEnc = sales.filter(s2 => s2.status === 'paid' && new Date(s2.createdAt) >= d && new Date(s2.createdAt) < end && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      const dec = activeSupplierInvoices.filter(si => si.status === 'paid' && new Date(si.date) >= d && new Date(si.date) < end).reduce((s, si) => s + (si.total || 0), 0);
      const refDec = sales.filter(s2 => s2.status === 'refunded' && s2.refundedAt && new Date(s2.refundedAt) >= d && new Date(s2.refundedAt) < end).reduce((s, sale) => s + sale.totalTTC, 0);
      const compExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && new Date(e.date) >= d && new Date(e.date) < end).reduce((s, e) => s + e.amount, 0);
      return { month: label, enc: enc + saleEnc, dec: dec + refDec + compExp };
    });
  }, [invoices, activeSupplierInvoices, sales, activeExpenses, now]);

  const treasuryMax = useMemo(() =>
    Math.max(...treasuryMonthlyData.flatMap(m => [m.enc, m.dec]), 1) * 1.2,
    [treasuryMonthlyData]
  );

  const treasuryBarChartValues = useMemo(() => treasuryMonthlyData.map(d => ({ value: d.enc + d.dec })), [treasuryMonthlyData]);
  const _treasuryBarChartState = useChartState(treasuryBarChartValues);
  const treasuryAvg = useMemo(() => {
    const nonZero = treasuryMonthlyData.filter(d => d.enc + d.dec > 0);
    return nonZero.length > 0 ? nonZero.reduce((s, d) => s + d.enc + d.dec, 0) / nonZero.length / 2 : 0;
  }, [treasuryMonthlyData]);
  const _treasuryAvgH = treasuryMax > 0 && treasuryAvg > 0 ? (treasuryAvg / treasuryMax) * 120 : 0;

  const netCashflow = totalEncaissements - totalDecaissements;
  const netCashflowSparkline = useMemo(() => treasuryMonthlyData.map(d => d.enc - d.dec), [treasuryMonthlyData]);

  /** Projections de tresorerie : factures en attente par mois */
  const projectionData = useMemo(() => {
    const projMap = new Map<string, number>();
    for (const inv of invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')) {
      const d = new Date(inv.dueDate || inv.issueDate);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      projMap.set(label, (projMap.get(label) || 0) + (inv.totalTTC - inv.paidAmount));
    }
    const labels = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    });
    return labels.map(label => ({
      label,
      actual: treasuryMonthlyData.find(m => m.month === label)?.enc,
      projected: projMap.get(label),
    }));
  }, [invoices, treasuryMonthlyData, now]);

  const projectionChartValues = useMemo(() => projectionData.map(d => ({ value: (d.actual || 0) + (d.projected || 0) })), [projectionData]);
  const projectionChartState = useChartState(projectionChartValues);

  const paymentDelayChartState = useChartState(paymentDelayData);

  const lateClientInvoices = useMemo(() =>
    invoices.filter(i => i.status === 'late' || (i.status === 'sent' && new Date(i.dueDate) < now))
      .map(i => {
        const daysLate = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
        return { id: i.id, client: i.clientName, amount: i.totalTTC - i.paidAmount, daysLate: Math.max(0, daysLate) };
      })
      .sort((a, b) => b.daysLate - a.daysLate).slice(0, 5),
    [invoices, now]
  );

  const suppliersDue = useMemo(() =>
    supplierInvoicesToPay.map(si => ({
      id: si.id, supplier: si.supplierName || 'Fournisseur',
      amount: si.total || si.subtotal || 0, dueDate: si.dueDate,
    })).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 5),
    [supplierInvoicesToPay]
  );

  const expectedCollections = useMemo(() => {
    const unpaidInvs = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft');
    const totalUnpaid = unpaidInvs.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0);
    const weekFromNow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
    const todayISO = now.toISOString();
    const thisWeek = unpaidInvs.filter(i => i.dueDate >= todayISO && i.dueDate <= weekFromNow);
    const thisWeekAmount = thisWeek.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0);
    const overdue = unpaidInvs.filter(i => i.dueDate < todayISO);
    const overdueAmount = overdue.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const collectedThisMonth = invoices.filter(i => i.status === 'paid' && i.issueDate >= monthStart).reduce((s, i) => s + i.totalTTC, 0);
    let topClient: { name: string; amount: number } | null = null;
    const clientUnpaidMap = new Map<string, { name: string; amount: number }>();
    for (const inv of unpaidInvs) {
      const existing = clientUnpaidMap.get(inv.clientId) || { name: inv.clientName || 'Client', amount: 0 };
      existing.amount += inv.totalTTC - inv.paidAmount;
      clientUnpaidMap.set(inv.clientId, existing);
    }
    for (const val of clientUnpaidMap.values()) {
      if (!topClient || val.amount > topClient.amount) topClient = val;
    }
    return {
      totalUnpaid,
      thisWeekAmount,
      overdueAmount,
      overdueCount: overdue.length,
      collectedThisMonth,
      unpaidCount: unpaidInvs.length,
      topClient,
    };
  }, [invoices, now]);

  const allMovements = useMemo((): RealMovement[] => {
    const moves: RealMovement[] = [];
    for (const inv of paidInvoicesTreasury) moves.push({ id: `inv-${inv.id}`, type: 'income', amount: inv.totalTTC, description: `Facture ${inv.invoiceNumber} — ${clientMap[inv.clientId] || inv.clientName}`, date: inv.issueDate, source: 'Facture client' });
    for (const sale of salesNotFromInvoicesTreasury) moves.push({ id: `sale-${sale.id}`, type: 'income', amount: sale.totalTTC, description: `Vente ${sale.saleNumber}${sale.clientName ? ` — ${sale.clientName}` : ''}`, date: sale.createdAt, source: 'Vente comptoir' });
    for (const sale of refundedSalesTreasury) moves.push({ id: `refund-${sale.id}`, type: 'expense', amount: sale.totalTTC, description: `Remboursement ${sale.saleNumber}`, date: sale.refundedAt || sale.createdAt, source: 'Remboursement' });
    for (const si of paidSupplierInvoicesTreasury) moves.push({ id: `si-${si.id}`, type: 'expense', amount: si.total || 0, description: `Facture ${si.number} — ${si.supplierName || 'Fournisseur'}`, date: si.date, source: 'Facture fournisseur' });
    const startISO = treasuryPeriodStart.toISOString();
    for (const exp of activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= startISO)) {
      moves.push({ id: `exp-${exp.id}`, type: 'expense', amount: exp.amount, description: `${exp.description || exp.expenseType}${exp.supplierName ? ` — ${exp.supplierName}` : ''}`, date: exp.date, source: 'Depense' });
    }
    moves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return moves;
  }, [paidInvoicesTreasury, paidSupplierInvoicesTreasury, clientMap, salesNotFromInvoicesTreasury, refundedSalesTreasury, activeExpenses, treasuryPeriodStart]);

  const filteredMovements = useMemo(() =>
    movementFilter === 'all' ? allMovements : allMovements.filter(m => m.type === movementFilter),
    [allMovements, movementFilter]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH SCORE (needed by exports)
  // ─────────────────────────────────────────────────────────────────────────

  const healthScoreProps = useMemo(() => {
    const enc = totalEncaissements;
    const dec = totalDecaissements;
    const ratio = dec > 0 ? enc / dec : enc > 0 ? 10 : 0;
    const runway = monthlyExpensesAvg > 0 ? cashBalance / monthlyExpensesAvg : cashBalance > 0 ? 99 : 0;
    const unpaidRateVal = monthlyRevenue > 0 ? unpaidAmount / monthlyRevenue : unpaidAmount > 0 ? 1 : 0;
    const trend: 'up' | 'stable' | 'down' = revenueMonthlyTrend > 0.05 ? 'up' : revenueMonthlyTrend < -0.05 ? 'down' : 'stable';
    return {
      coverageRatio: ratio,
      runwayMonths: Math.max(0, runway),
      unpaidRate: unpaidRateVal,
      revenueTrend: trend,
      grossMarginPositive: grossMargin > 0,
    };
  }, [totalEncaissements, totalDecaissements, monthlyExpensesAvg, cashBalance, monthlyRevenue, unpaidAmount, revenueMonthlyTrend, grossMargin]);

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORTS
  // ─────────────────────────────────────────────────────────────────────────

  const handleExportFEC = useCallback(async () => {
    try {
      const movements = allMovements.map(m => ({ id: m.id, date: m.date, type: m.type, amount: m.amount, description: m.description, reference: m.source }));
      const fecContent = generateFECExport({ movements, companyName: company.name || 'Mon entreprise', siret: company.siret || '', startDate: treasuryPeriodStart.toISOString(), endDate: now.toISOString(), currency: cur });
      if (Platform.OS === 'web') {
        const blob = new Blob([fecContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `FEC_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        URL.revokeObjectURL(url);
        successAlert('Export FEC', 'Fichier FEC telecharge');
      } else {
        await Share.share({ message: fecContent, title: 'Export FEC' });
      }
    } catch { errorAlert('Erreur', "Impossible de generer l'export FEC"); }
  }, [allMovements, company, treasuryPeriodStart, now, cur, successAlert, errorAlert]);

  const computeHealthScore = useCallback(() => {
    const hp = healthScoreProps;
    let s = 0;
    if (hp.coverageRatio >= 1.5) s += 30; else if (hp.coverageRatio >= 1) s += 20; else if (hp.coverageRatio >= 0.5) s += 10;
    const rw = hp.runwayMonths;
    if (rw >= 6) s += 25; else if (rw >= 3) s += 15; else if (rw >= 1) s += 8;
    if (hp.unpaidRate < 0.1) s += 20; else if (hp.unpaidRate < 0.3) s += 10; else if (hp.unpaidRate < 0.6) s += 5;
    if (hp.revenueTrend === 'up') s += 15; else if (hp.revenueTrend === 'stable') s += 10;
    if (hp.grossMarginPositive) s += 10;
    return s;
  }, [healthScoreProps]);

  const unpaidInvoicesForPdf = useMemo(() =>
    unpaidInvoices.map(i => ({ clientName: i.clientName || 'Client', amount: i.totalTTC - i.paidAmount, dueDate: i.dueDate })),
    [unpaidInvoices]
  );

  const handleExportSalesReport = useCallback(async () => {
    const periodLabels: Record<PeriodFilter, string> = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette annee' };
    const html = generateSalesReportHTML({
      company, sales, invoices, clients, periodLabel: periodLabels[period], currency: cur,
      healthScore: computeHealthScore(),
      coverageRatio: healthScoreProps.coverageRatio,
      unpaidAmount,
      expenses: monthlyExpenses,
      abcProducts: abcClassification.map(p => ({ name: p.name, ca: p.ca, abc: p.abc, margin: p.margin })),
      unpaidInvoicesList: unpaidInvoicesForPdf,
    });
    await generateAndSharePDF(html, `Rapport_Ventes_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, sales, invoices, clients, period, cur, computeHealthScore, healthScoreProps, unpaidAmount, monthlyExpenses, abcClassification, unpaidInvoicesForPdf]);

  const handleExportStockReport = useCallback(async () => {
    const html = generateStockReportHTML({ company, products: activeProducts, currency: cur });
    await generateAndSharePDF(html, `Rapport_Stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, cur, activeProducts]);

  const handleExportFinancialReport = useCallback(async () => {
    const periodLabels: Record<PeriodFilter, string> = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette annee' };
    const html = generateFinancialReportHTML({
      company, revenue: monthlyRevenue, expenses: monthlyExpenses, unpaidAmount,
      periodLabel: periodLabels[period], currency: cur,
      healthScore: computeHealthScore(),
      coverageRatio: healthScoreProps.coverageRatio,
      netCashflow: netCashflow,
      cashBalance: cashBalance,
      runwayMonths: healthScoreProps.runwayMonths,
      expenseBreakdown: expenseBreakdownSegments.map(s => ({ label: s.label, value: s.value })),
      unpaidInvoicesList: unpaidInvoicesForPdf,
      projectionData: projectionData.map(d => ({ label: d.label, projected: d.projected })),
    });
    await generateAndSharePDF(html, `Rapport_Financier_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, monthlyRevenue, monthlyExpenses, unpaidAmount, period, cur, computeHealthScore, healthScoreProps, netCashflow, cashBalance, expenseBreakdownSegments, unpaidInvoicesForPdf, projectionData]);

  // ─────────────────────────────────────────────────────────────────────────
  // SOUS-RENDUS COMMUNS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Banniere CA du jour avec badge nombre de ventes.
   * Couleur principale de l'application avec bande d'accentuation gauche.
   */
  const renderTodayBanner = () => (
    <View style={[styles.todayBanner, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
      <View style={[styles.todayAccent, { backgroundColor: colors.primary }]} />
      <View style={styles.todayBannerContent}>
        <View>
          <Text style={[styles.todayLabel, { color: colors.textTertiary }]}>{t('dashboard.todayRevenue')}</Text>
          <Text style={[styles.todayAmount, { color: colors.text }]}>{formatCurrencyInteger(todayRevenue, cur)}</Text>
        </View>
        <View style={[styles.todaySalesBadge, { backgroundColor: colors.primary + '12' }]}>
          <ShoppingCart size={14} color={colors.primary} />
          <Text style={[styles.todaySalesText, { color: colors.primary }]}>{t('dashboard.salesCount', { count: todaySalesCount })}</Text>
        </View>
      </View>
    </View>
  );

  /**
   * Cartes d'actions urgentes horizontalement scrollables.
   * Chaque carte represente une alerte : stock critique, factures impayees, etc.
   */
  const _renderActionCards = () => {
    const criticalStock = lowStockProducts.length;
    const unpaidCount = unpaidInvoices.length;
    const pendingOrders = pendingPurchaseOrders.length;
    const clientsToRemindCount = new Set(unpaidInvoices.map(i => i.clientId)).size;
    const allGood = criticalStock === 0 && unpaidCount === 0 && pendingOrders === 0 && pendingSalesCount === 0;

    if (allGood) {
      return (
        <View style={[styles.actionCard, { backgroundColor: '#F0FFF4', borderColor: '#C6F6D5' }]}>
          <View style={styles.actionCardInner}>
            <CheckCircle size={18} color="#38A169" />
            <Text style={[styles.actionCardText, { color: '#38A169' }]}>{t('dashboard.allGood')}</Text>
          </View>
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionRow} contentContainerStyle={styles.actionRowContent}>
        {criticalStock > 0 && (
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} onPress={() => router.push('/stock?tab=inventaire' as never)} activeOpacity={0.7}>
            <View style={styles.actionCardInner}>
              <AlertTriangle size={16} color="#DC2626" />
              <Text style={[styles.actionCardText, { color: '#DC2626' }]} numberOfLines={2}>{t('dashboard.criticalStock', { count: criticalStock })}</Text>
              <ChevronRight size={14} color="#DC2626" />
            </View>
          </TouchableOpacity>
        )}
        {unpaidCount > 0 && (
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]} onPress={() => router.push('/ventes')} activeOpacity={0.7}>
            <View style={styles.actionCardInner}>
              <Clock size={16} color="#D97706" />
              <Text style={[styles.actionCardText, { color: '#D97706' }]} numberOfLines={2}>{t('dashboard.unpaidInvoices', { count: unpaidCount })} ({formatCurrencyInteger(unpaidAmount, cur)})</Text>
              <ChevronRight size={14} color="#D97706" />
            </View>
          </TouchableOpacity>
        )}
        {pendingOrders > 0 && (
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]} onPress={() => router.push('/achats')} activeOpacity={0.7}>
            <View style={styles.actionCardInner}>
              <Truck size={16} color="#2563EB" />
              <Text style={[styles.actionCardText, { color: '#2563EB' }]} numberOfLines={2}>{t('dashboard.pendingOrders', { count: pendingOrders })}</Text>
              <ChevronRight size={14} color="#2563EB" />
            </View>
          </TouchableOpacity>
        )}
        {clientsToRemindCount > 0 && (
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#FDF2F8', borderColor: '#FBCFE8' }]} onPress={() => router.push('/ventes?tab=factures' as never)} activeOpacity={0.7}>
            <View style={styles.actionCardInner}>
              <MessageSquare size={16} color="#BE185D" />
              <Text style={[styles.actionCardText, { color: '#BE185D' }]} numberOfLines={2}>{t('dashboard.clientsToRemind', { count: clientsToRemindCount })}</Text>
              <ChevronRight size={14} color="#BE185D" />
            </View>
          </TouchableOpacity>
        )}
        {pendingSalesCount > 0 && (
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: isSyncing ? '#EFF6FF' : '#FEF3C7', borderColor: isSyncing ? '#BFDBFE' : '#FCD34D' }]} onPress={() => router.push('/sales')} activeOpacity={0.7}>
            <View style={styles.actionCardInner}>
              {isSyncing ? <RefreshCw size={16} color="#2563EB" /> : <CloudOff size={16} color="#92400E" />}
              <Text style={[styles.actionCardText, { color: isSyncing ? '#2563EB' : '#92400E' }]} numberOfLines={2}>
                {isSyncing ? t('dashboard.syncing') : t('dashboard.pendingSync', { count: pendingSalesCount })}
              </Text>
              <ChevronRight size={14} color={isSyncing ? '#2563EB' : '#92400E'} />
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const toggleSaleExpand = useCallback((saleId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSaleId(prev => prev === saleId ? null : saleId);
  }, []);

  const renderRecentSalesList = (_pressable = true) => (
    recentSales.length === 0 ? (
      <ActionableEmptyState
        icon="cart"
        message="Enregistrez votre première vente pour voir l'historique ici"
        ctaLabel="Enregistrer une vente"
        onCtaPress={() => router.push('/ventes')}
      />
    ) : (
      <View style={styles.recentSalesList}>
        {recentSalesGrouped.map((group, gIdx) => (
          <View key={group.dateKey}>
            <View style={[styles.dayGroupHeader, gIdx > 0 && { marginTop: SPACING.XL }]}>
              <View style={[styles.dayGroupDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.dayGroupLabel, { color: colors.textSecondary }]}>{group.dateLabel}</Text>
              <View style={[styles.dayGroupLine, { backgroundColor: colors.borderLight }]} />
            </View>
            {group.sales.map((sale, idx) => {
              const progress = recentSalesMax > 0 ? sale.amount / recentSalesMax : 0;
              const PaymentIcon = PAYMENT_ICONS[sale.paymentMethod] || CreditCard;
              const isExpanded = expandedSaleId === sale.id;
              const clientData = sale.clientId ? clients.find(c => c.id === sale.clientId) : null;
              const isUnpaid = sale.status === 'unpaid';
              const caPct = recentSalesTotalCA > 0 ? Math.round((sale.amount / recentSalesTotalCA) * 100) : 0;

              return (
                <View key={sale.id + idx}>
                  <TouchableOpacity
                    onPress={() => toggleSaleExpand(sale.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.saleRow,
                      !isExpanded && idx < group.sales.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                    ]}
                  >
                    <View style={[styles.saleProgressStrip, { backgroundColor: colors.primary + '08' }]}>
                      <View style={[styles.saleProgressFill, { backgroundColor: colors.primary + '30', width: `${progress * 100}%` as `${number}%` }]} />
                    </View>
                    <View style={styles.saleRowContent}>
                      <View style={styles.saleRowLeft}>
                        <ClientAvatar name={sale.client} size={32} />
                        <View style={styles.saleInfo}>
                          <Text style={[styles.saleClient, { color: isUnpaid ? colors.danger : colors.text }]} numberOfLines={1}>{sale.client}</Text>
                          <View style={styles.saleMeta}>
                            <Text style={[styles.saleDate, { color: colors.textTertiary }]}>{formatDate(sale.date)}</Text>
                            {sale.saleType === 'facture' ? (
                              <View style={[styles.saleTypeBadge, { backgroundColor: isUnpaid ? '#FEF2F2' : '#ECFDF5', borderColor: isUnpaid ? '#FECACA' : '#A7F3D0' }]}>
                                <Text style={{ fontSize: 9, fontWeight: '700' as const, color: isUnpaid ? '#DC2626' : '#059669' }}>{isUnpaid ? 'Facture' : 'Facture payée'}</Text>
                              </View>
                            ) : (
                              <View style={[styles.saleTypeBadge, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                                <Text style={{ fontSize: 9, fontWeight: '700' as const, color: '#6B7280' }}>Comptoir</Text>
                              </View>
                            )}
                            <View style={[styles.paymentIconWrap, { backgroundColor: colors.primaryLight }]}>
                              <PaymentIcon size={11} color={colors.primary} />
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' as const, gap: 2 }}>
                        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.SM }}>
                          <Text style={[styles.saleAmount, { color: colors.primary }]}>{formatCurrency(sale.amount, cur)}</Text>
                          <ChevronRight size={14} color={colors.textTertiary} style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }} />
                        </View>
                        {caPct > 0 && sale.status === 'paid' && (
                          <Text style={[styles.caPctText, { color: colors.textTertiary }]}>{caPct}% du CA</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={[styles.saleDetailPanel, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
                      {clientData && (
                        <View style={styles.saleDetailSection}>
                          <Text style={[styles.saleDetailLabel, { color: colors.textTertiary }]}>Client</Text>
                          <Text style={[styles.saleDetailValue, { color: colors.text }]}>
                            {clientData.companyName || `${clientData.firstName} ${clientData.lastName}`}
                          </Text>
                          {clientData.email && <Text style={[styles.saleDetailSub, { color: colors.textSecondary }]}>{clientData.email}</Text>}
                        </View>
                      )}
                      <View style={styles.saleDetailSection}>
                        <Text style={[styles.saleDetailLabel, { color: colors.textTertiary }]}>Articles</Text>
                        {sale.items.map((item, i) => {
                          const itemVariantId = (item as { variantId?: string }).variantId;
                          const variantLabel = itemVariantId ? getVariantLabel(item.productId, itemVariantId) : '';
                          return (
                            <View key={item.id || i} style={[styles.saleDetailItem, i < sale.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.saleDetailItemName, { color: colors.text }]} numberOfLines={1}>{item.productName}</Text>
                                {variantLabel ? (
                                  <View style={[styles.variantAttrList, { paddingLeft: 0, marginTop: 3, paddingBottom: 2 }]}>
                                    <View style={[styles.variantAttrChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
                                      <Text style={[styles.variantAttrText, { color: colors.primary }]} numberOfLines={1}>{variantLabel}</Text>
                                    </View>
                                  </View>
                                ) : null}
                                <Text style={[styles.saleDetailSub, { color: colors.textTertiary }]}>{item.quantity} x {formatCurrency(item.unitPrice, cur)}</Text>
                              </View>
                              <Text style={[styles.saleDetailItemTotal, { color: colors.text }]}>{formatCurrency(item.totalTTC, cur)}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={[styles.saleDetailTotals, { borderTopColor: colors.border }]}>
                        <View style={styles.saleDetailTotalRow}>
                          <Text style={[styles.saleDetailSub, { color: colors.textSecondary }]}>Total HT</Text>
                          <Text style={[styles.saleDetailSub, { color: colors.textSecondary }]}>{formatCurrency(sale.totalHT, cur)}</Text>
                        </View>
                        <View style={styles.saleDetailTotalRow}>
                          <Text style={[styles.saleDetailSub, { color: colors.textSecondary }]}>TVA</Text>
                          <Text style={[styles.saleDetailSub, { color: colors.textSecondary }]}>{formatCurrency(sale.totalTVA, cur)}</Text>
                        </View>
                        <View style={styles.saleDetailTotalRow}>
                          <Text style={[styles.saleDetailTotalLabel, { color: colors.text }]}>Total TTC</Text>
                          <Text style={[styles.saleDetailTotalValue, { color: isUnpaid ? colors.danger : colors.primary }]}>{formatCurrency(sale.amount, cur)}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  {isExpanded && idx < group.sales.length - 1 && (
                    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }} />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    )
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET VUE D'ENSEMBLE
  // ─────────────────────────────────────────────────────────────────────────

  const last4WeeksSparkline = useMemo(() => revenueSparkline.slice(-4), [revenueSparkline]);

  const renderOverviewTab = () => {
    const alertUnpaidCount = unpaidInvoices.length;
    const alertStockCount = lowStockProducts.length;
    const alertClientsCount = clientsToRemindCount;
    const hasAlerts = alertUnpaidCount > 0 || alertStockCount > 0 || alertClientsCount > 0;
    const trendSign = revenueMonthlyTrend >= 0 ? '+' : '';
    const trendLabel = `${revenueMonthlyTrend >= 0 ? '↗' : '↘'} ${trendSign}${formatCurrencyInteger(Math.abs(revenueMonthlyTrend), cur)}/sem`;
    const goalTarget = explicitMonthlyGoal && explicitMonthlyGoal > 0 ? explicitMonthlyGoal : null;
    const goalProgress = goalTarget ? Math.min(monthlyRevenue / goalTarget, 1.5) : 0;
    const goalProgressPct = Math.round(Math.min(goalProgress, 1) * 100);
    const goalDaysElapsed = now.getDate();
    const goalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const goalDaysRemaining = Math.max(0, goalDaysInMonth - goalDaysElapsed);
    const goalProjectedRevenue = goalDaysElapsed > 0 ? (monthlyRevenue / goalDaysElapsed) * goalDaysInMonth : 0;
    const goalIsAchieved = goalTarget ? monthlyRevenue >= goalTarget : false;
    const goalDailyNeeded = goalTarget && goalDaysRemaining > 0 && !goalIsAchieved
      ? (goalTarget - monthlyRevenue) / goalDaysRemaining : 0;

    const goalStatusColor = goalTarget
      ? goalIsAchieved ? '#059669'
        : goalProgress >= 0.7 ? colors.primary
        : goalProgress >= 0.4 ? '#F59E0B'
        : '#DC2626'
      : colors.primary;

    const goalProjectionMessage = (() => {
      if (!goalTarget) return null;
      if (goalIsAchieved) return { text: 'Objectif atteint ! Continuez sur cette lancée.', positive: true };
      if (goalDaysElapsed === 0) return { text: 'Début du mois, revenez demain pour voir votre projection.', positive: false };
      if (goalDaysRemaining === 0) return { text: `Objectif non atteint — ${formatCurrencyInteger(goalTarget - monthlyRevenue, cur)} manquants.`, positive: false };
      if (goalProjectedRevenue >= goalTarget) {
        return { text: `À ce rythme, vous atteindrez ${formatCurrencyInteger(Math.round(goalProjectedRevenue), cur)} sur ${formatCurrencyInteger(goalTarget, cur)} visés.`, positive: true };
      }
      if (goalProjectedRevenue < goalTarget * 0.7) {
        return { text: `Attention : projection à ${formatCurrencyInteger(Math.round(goalProjectedRevenue), cur)} — il faut ${formatCurrencyInteger(Math.round(goalDailyNeeded), cur)}/jour pour atteindre l'objectif.`, positive: false };
      }
      return { text: `À ce rythme, vous atteindrez ${formatCurrencyInteger(Math.round(goalProjectedRevenue), cur)} sur ${formatCurrencyInteger(goalTarget, cur)} visés.`, positive: true };
    })();

    return (
      <>
        {/* ═══ 0. SCORE SANTÉ FINANCIÈRE ═══ */}
        <FinancialHealthScore
          coverageRatio={healthScoreProps.coverageRatio}
          runwayMonths={healthScoreProps.runwayMonths}
          unpaidRate={healthScoreProps.unpaidRate}
          revenueTrend={healthScoreProps.revenueTrend}
          grossMarginPositive={healthScoreProps.grossMarginPositive}
        />

        {/* ═══ 1. ALERTES CONTEXTUELLES ═══ */}
        <SmartAlerts
          unpaidInvoices={unpaidInvoices as any}
          lowStockProducts={lowStockProducts as any}
          totalEncaissements={totalEncaissements}
          totalDecaissements={totalDecaissements}
          expenseBreakdownSegments={expenseBreakdownSegments}
          currency={cur}
          formatCurrency={(v, c) => formatCurrencyInteger(v, c)}
          now={now}
          onNavigateInvoices={() => router.push('/ventes?tab=factures' as never)}
          onNavigateStock={() => router.push('/stock?tab=inventaire' as never)}
          onNavigateExpenses={() => router.push('/achats')}
        />

        {/* ═══ 1b. CLIENTS PRIORITAIRES À RELANCER ═══ */}
        {alertClientsCount > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.MD }}>
                <Mail size={16} color="#2563EB" />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Clients à relancer</Text>
              </View>
              <View style={[styles.alertBadge, { backgroundColor: '#2563EB' }]}>
                <Text style={styles.alertBadgeText}>{alertClientsCount}</Text>
              </View>
            </View>
            {priorityClientsToRemind.length === 0 ? (
              <Text style={{ fontSize: TYPOGRAPHY.SIZE.SMALL, color: colors.textTertiary, textAlign: 'center' as const, paddingVertical: SPACING.XL }}>Aucun client prioritaire identifié</Text>
            ) : (
              <View style={{ gap: SPACING.SM }}>
                {priorityClientsToRemind.map((client, idx) => {
                  const daysSinceLastPurchase = client.lastPurchaseDate
                    ? Math.floor((now.getTime() - new Date(client.lastPurchaseDate).getTime()) / 86400000)
                    : null;
                  return (
                    <View
                      key={client.clientId + idx}
                      style={[
                        styles.priorityClientRow,
                        { borderColor: colors.borderLight },
                        idx < priorityClientsToRemind.length - 1 && { borderBottomWidth: 1 },
                      ]}
                    >
                      <ClientAvatar name={client.name} size={36} />
                      <View style={{ flex: 1, marginLeft: SPACING.LG }}>
                        <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: colors.text }} numberOfLines={1}>
                          {client.name}
                        </Text>
                        <Text style={{ fontSize: TYPOGRAPHY.SIZE.CAPTION, color: colors.textTertiary, marginTop: 1 }}>
                          {formatCurrencyInteger(client.totalUnpaid, cur)} impayés{daysSinceLastPurchase !== null ? ` · Dernière commande il y a ${daysSinceLastPurchase}j` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.remindBtn, { backgroundColor: '#2563EB' }]}
                        onPress={() => router.push(`/clients` as never)}
                        activeOpacity={0.7}
                      >
                        <Send size={12} color="#fff" />
                        <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' as const }}>Relancer</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              onPress={() => router.push('/ventes?tab=factures' as never)}
              activeOpacity={0.7}
              style={{ marginTop: SPACING.LG }}
            >
              <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: '#2563EB' }}>
                Voir tous les {alertClientsCount} →
              </Text>
            </TouchableOpacity>
          </View>
        ) : alertClientsCount === 0 && !hasAlerts ? null : alertClientsCount === 0 ? (
          <View style={[styles.card, { backgroundColor: '#F0FFF4', borderColor: '#C6F6D5' }]}>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.MD }}>
              <CheckCircle size={18} color="#38A169" />
              <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: '#38A169' }}>Tous vos clients sont à jour 🎉</Text>
            </View>
          </View>
        ) : null}

        {/* ═══ 1c. À FAIRE AUJOURD'HUI ═══ */}
        <TodoToday
          invoices={invoices as any}
          lowStockProducts={lowStockProducts as any}
          sales={sales as any}
          todaySalesCount={todaySalesCount}
          monthlyRevenue={monthlyRevenue}
          explicitMonthlyGoal={explicitMonthlyGoal}
          coverageRatio={healthScoreProps.coverageRatio}
          currency={cur}
          now={now}
        />

        {/* ═══ 2. KPI PRIMAIRE — CA du mois ═══ */}
        <View style={[styles.kpiPrimaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.kpiPrimaryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kpiPrimaryLabel, { color: colors.textTertiary }]}>CA du mois</Text>
              <Text style={[styles.kpiPrimaryValue, { color: colors.text }]}>{formatCurrencyInteger(monthlyRevenue, cur)}</Text>
            </View>
            <View style={[styles.kpiPrimaryTrendBadge, { backgroundColor: revenueMonthlyTrend >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
              <Text style={[styles.kpiPrimaryTrendText, { color: revenueMonthlyTrend >= 0 ? '#059669' : '#DC2626' }]}>
                {trendLabel}
              </Text>
            </View>
          </View>
          <View style={styles.kpiPrimarySparkline}>
            <SparklineChart data={last4WeeksSparkline} color={colors.primary} width={isMobile ? width - 80 : 400} height={40} />
          </View>
        </View>

        {/* ═══ 2b. OBJECTIF CA MENSUEL ═══ */}
        {goalTarget ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.MD, flex: 1 }}>
                <View style={[styles.goalIconCircle, { backgroundColor: goalStatusColor + '15' }]}>
                  <Target size={15} color={goalStatusColor} strokeWidth={2.5} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Objectif CA mensuel</Text>
              </View>
              {goalIsAchieved && (
                <View style={[styles.goalAchievedBadge, { backgroundColor: '#059669' + '15' }]}>
                  <Text style={{ fontSize: TYPOGRAPHY.SIZE.TINY, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, color: '#059669' }}>Atteint !</Text>
                </View>
              )}
            </View>
            <View style={styles.goalAmountRow}>
              <Text style={[styles.goalCurrentAmount, { color: colors.text }]}>{formatCurrencyInteger(monthlyRevenue, cur)}</Text>
              <Text style={[styles.goalSeparator, { color: colors.textTertiary }]}> / </Text>
              <Text style={[styles.goalTargetAmount, { color: colors.textSecondary }]}>{formatCurrencyInteger(goalTarget, cur)}</Text>
            </View>
            <View style={styles.goalProgressSection}>
              <View style={[styles.goalProgressTrack, { backgroundColor: colors.borderLight }]}>
                <View style={[styles.goalProgressFill, { width: `${goalProgressPct}%` as `${number}%`, backgroundColor: goalStatusColor }]} />
              </View>
              <View style={styles.goalProgressLabels}>
                <Text style={[styles.goalProgressPct, { color: goalStatusColor }]}>{goalProgressPct}%</Text>
                <Text style={{ fontSize: TYPOGRAPHY.SIZE.CAPTION, color: colors.textTertiary }}>
                  {goalDaysRemaining} jour{goalDaysRemaining > 1 ? 's' : ''} restant{goalDaysRemaining > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            {goalProjectionMessage ? (
              <View style={[
                styles.goalProjectionBox,
                {
                  backgroundColor: goalProjectionMessage.positive ? '#05966908' : '#F59E0B08',
                  borderColor: goalProjectionMessage.positive ? '#05966920' : '#F59E0B20',
                },
              ]}>
                <TrendingUp size={13} color={goalProjectionMessage.positive ? '#059669' : '#F59E0B'} />
                <Text style={[
                  styles.goalProjectionText,
                  { color: goalProjectionMessage.positive ? '#059669' : '#D97706' },
                ]}>
                  {goalProjectionMessage.text}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.goalEditRow}
              onPress={() => router.push('/settings?tab=objectives' as never)}
              activeOpacity={0.7}
              testID="goal-edit-btn"
            >
              <Text style={{ fontSize: TYPOGRAPHY.SIZE.SMALL, color: colors.primary, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD }}>Modifier l'objectif</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.goalEmptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderStyle: 'dashed' as const }]}
            onPress={() => router.push('/settings?tab=objectives' as never)}
            activeOpacity={0.7}
            testID="goal-define-btn"
          >
            <View style={[styles.goalIconCircle, { backgroundColor: colors.primary + '12' }]}>
              <Target size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalEmptyTitle, { color: colors.text }]}>Objectif CA mensuel</Text>
              <Text style={[styles.goalEmptySubtitle, { color: colors.textTertiary }]}>Définissez un objectif pour suivre votre progression</Text>
            </View>
            <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, color: colors.primary, fontWeight: TYPOGRAPHY.WEIGHT.BOLD }}>Définir →</Text>
          </TouchableOpacity>
        )}

        {/* ═══ 3. KPIs SECONDAIRES — 2 colonnes ═══ */}
        <View style={styles.kpiGrid2}>
          <TouchableOpacity
            style={[
              styles.kpiGridCard,
              {
                backgroundColor: grossMargin < 0 ? 'rgba(220,38,38,0.06)' : grossMargin > 0 ? 'rgba(5,150,105,0.05)' : colors.card,
                borderColor: grossMargin < 0 ? 'rgba(220,38,38,0.2)' : grossMargin > 0 ? 'rgba(5,150,105,0.15)' : colors.cardBorder,
              },
            ]}
            onPress={grossMargin < 0 ? () => router.push('/achats') : undefined}
            activeOpacity={grossMargin < 0 ? 0.7 : 1}
            testID="kpi-gross-profit"
          >
            <View style={styles.kpiGridIconRow}>
              <Target size={16} color={grossMargin >= 0 ? '#059669' : '#DC2626'} />
              <Text style={[styles.kpiGridLabel, { color: grossMargin < 0 ? '#991B1B' : colors.textSecondary }]}>Bénéfice brut</Text>
            </View>
            <Text style={[styles.kpiGridValue, { color: grossMargin >= 0 ? '#059669' : '#DC2626' }]}>
              {formatCurrencyInteger(grossMargin, cur)}
            </Text>
            {marginChange !== undefined && (
              <View style={[styles.kpiGridChangeBadge, { backgroundColor: marginChange >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
                {marginChange >= 0 ? <ArrowUpRight size={10} color="#059669" /> : <ArrowDownRight size={10} color="#DC2626" />}
                <Text style={{ fontSize: 10, fontWeight: '700' as const, color: marginChange >= 0 ? '#059669' : '#DC2626' }}>
                  {marginChange >= 0 ? '+' : ''}{Math.round(marginChange)}%
                </Text>
              </View>
            )}
            {grossMargin < 0 && (
              <Text style={styles.kpiGridLink}>Voir dépenses →</Text>
            )}
          </TouchableOpacity>

          <View style={[styles.kpiGridCard, { backgroundColor: paidSalesCount > 0 ? 'rgba(5,150,105,0.05)' : colors.card, borderColor: paidSalesCount > 0 ? 'rgba(5,150,105,0.15)' : colors.cardBorder }]} testID="kpi-sales-count">
            <View style={styles.kpiGridIconRow}>
              <ShoppingCart size={16} color="#7C3AED" />
              <Text style={[styles.kpiGridLabel, { color: colors.textSecondary }]}>Nombre de ventes</Text>
            </View>
            <Text style={[styles.kpiGridValue, { color: colors.text }]}>{paidSalesCount}</Text>
            <Text style={[styles.kpiGridSub, { color: colors.textTertiary }]}>
              Ticket moyen : {formatCurrencyInteger(paidSalesCount > 0 ? monthlyRevenue / paidSalesCount : 0, cur)}
            </Text>
            {salesCountChange !== undefined && (
              <View style={[styles.kpiGridChangeBadge, { backgroundColor: salesCountChange >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
                {salesCountChange >= 0 ? <ArrowUpRight size={10} color="#059669" /> : <ArrowDownRight size={10} color="#DC2626" />}
                <Text style={{ fontSize: 10, fontWeight: '700' as const, color: salesCountChange >= 0 ? '#059669' : '#DC2626' }}>
                  {salesCountChange >= 0 ? '+' : ''}{Math.round(salesCountChange)}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ═══ 4. KPIs TERTIAIRES — 2 colonnes ═══ */}
        <View style={styles.kpiGrid2}>
          <TouchableOpacity
            style={[
              styles.kpiGridCard,
              {
                backgroundColor: unpaidAmount > 0 ? 'rgba(217,119,6,0.06)' : 'rgba(5,150,105,0.05)',
                borderColor: unpaidAmount > 0 ? 'rgba(217,119,6,0.2)' : 'rgba(5,150,105,0.15)',
              },
            ]}
            onPress={() => router.push('/ventes?tab=factures' as never)}
            activeOpacity={0.7}
            testID="kpi-unpaid"
          >
            <View style={styles.kpiGridIconRow}>
              <Clock size={16} color={unpaidAmount > 0 ? '#D97706' : '#059669'} />
              <Text style={[styles.kpiGridLabel, { color: unpaidAmount > 0 ? '#92400E' : colors.textSecondary }]}>Impayés en cours</Text>
            </View>
            <Text style={[styles.kpiGridValue, { color: unpaidAmount > 0 ? '#D97706' : '#059669' }]}>
              {formatCurrencyInteger(unpaidAmount, cur)}
            </Text>
            <Text style={[styles.kpiGridSub, { color: unpaidAmount > 0 ? '#92400E' : colors.textTertiary }]}>
              {unpaidInvoices.length} facture{unpaidInvoices.length !== 1 ? 's' : ''}
            </Text>
            {unpaidAmount > 0 && (
              <Text style={[styles.kpiGridLink, { color: '#D97706' }]}>Envoyer rappels →</Text>
            )}
          </TouchableOpacity>

          <View style={[styles.kpiGridCard, { backgroundColor: todayRevenue > 0 ? 'rgba(5,150,105,0.05)' : colors.card, borderColor: todayRevenue > 0 ? 'rgba(5,150,105,0.15)' : colors.cardBorder }]} testID="kpi-daily-pulse">
            <View style={styles.kpiGridIconRow}>
              <TrendingUp size={16} color={colors.primary} />
              <Text style={[styles.kpiGridLabel, { color: colors.textSecondary }]}>Pouls du jour</Text>
            </View>
            <Text style={[styles.kpiGridValue, { color: colors.text }]}>
              {formatCurrencyInteger(todayRevenue, cur)}
            </Text>
            <Text style={[styles.kpiGridSub, { color: colors.textTertiary }]}>
              {todaySalesCount} vente{todaySalesCount !== 1 ? 's' : ''} aujourd'hui
            </Text>
            {yesterdayRevenue > 0 && (
              <View style={[styles.kpiGridChangeBadge, { backgroundColor: todayRevenue >= yesterdayRevenue ? '#ECFDF5' : '#FEF2F2' }]}>
                {todayRevenue >= yesterdayRevenue ? <ArrowUpRight size={10} color="#059669" /> : <ArrowDownRight size={10} color="#DC2626" />}
                <Text style={{ fontSize: 10, fontWeight: '700' as const, color: todayRevenue >= yesterdayRevenue ? '#059669' : '#DC2626' }}>
                  vs hier {formatCurrencyInteger(yesterdayRevenue, cur)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ═══ 5. DERNIÈRES VENTES ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.recentSales')}</Text>
            <TouchableOpacity onPress={() => router.push('/ventes')} activeOpacity={0.7}>
              <Text style={[styles.viewAllLink, { color: colors.primary }]}>{t('dashboard.viewAll')} →</Text>
            </TouchableOpacity>
          </View>
          {renderRecentSalesList(true)}
        </View>
      </>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET ANALYSE
  // ─────────────────────────────────────────────────────────────────────────

  const renderAnalysisTab = () => {
    const peakHourIdx = hourlyBarData.reduce((maxI, v, i, arr) => v > arr[maxI] ? i : maxI, 0);
    const peakHourValue = hourlyBarData[peakHourIdx];

    return (
    <>
      {/* ═══ SECTION 1 — VUE GLOBALE ═══ */}

      {/* CA vs Dépenses 6 mois — premier graphique visible */}
      <RevenueVsExpensesChart currency={cur} />

      {/* Tendance CA 12 mois avec régression */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Tendance CA — 12 mois</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Évolution du chiffre d'affaires avec ligne de tendance</Text>
          </View>
        </View>
        {netMarginEvolution.every(m => m.value === 0) ? (
          <ActionableEmptyState
            icon="trending"
            message="La tendance CA apparaîtra après vos premières ventes mensuelles"
            ctaLabel="Enregistrer une vente"
            onCtaPress={() => router.push('/ventes')}
          />
        ) : (
          <RevenueTrendChart
            data={netMarginEvolution.map((m, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
              const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
              const dISO = d.toISOString();
              const end = new Date(now.getFullYear(), now.getMonth() - (11 - i) + 1, 1).toISOString();
              const invRev = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < end).reduce((s, inv) => s + inv.totalTTC, 0);
              const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= dISO && s2.createdAt < end && (!s2.convertedToInvoiceId)).reduce((s3, sale) => s3 + sale.totalTTC, 0);
              return { label, value: invRev + saleRev };
            })}
            width={isMobile ? width - 80 : 460}
            height={200}
            color={colors.primary}
            regressionColor="#F59E0B"
            textColor={colors.textTertiary}
            unit={cur}
          />
        )}
      </View>

      {/* ═══ SECTION 2 — PERFORMANCE PRODUITS ═══ */}

      {/* Classement ABC des produits avec sparkline 7j */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={{ marginBottom: SPACING.MD }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Classement ABC des produits</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>A = produits générant 80% du CA · B = intermédiaires · C = à revoir</Text>
        </View>
        {abcClassification.length === 0 ? (
          <ActionableEmptyState
            icon="package"
            message="Vendez vos premiers produits pour voir le classement ABC"
            ctaLabel="Enregistrer une vente"
            onCtaPress={() => router.push('/ventes')}
          />
        ) : (
          <View style={styles.tableContent}>
            <View style={[styles.tableRowHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.4, textAlign: 'center' }]}>ABC</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1.8 }]}>Produit</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.9, textAlign: 'right' }]}>CA</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.5, textAlign: 'right' }]}>%</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.9, textAlign: 'right' }]}>Marge</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.8, textAlign: 'right' }]}>7j</Text>
            </View>
            {abcClassification.map((p, idx) => {
              const abcColor = p.abc === 'A' ? '#059669' : p.abc === 'B' ? '#F59E0B' : '#EF4444';
              const sparkData = productSparklines7d.get(p.name) || Array(7).fill(0);
              const hasSparkData = sparkData.some(v => v > 0);
              const productVariants = variantAbcMap.get(p.id) || [];
              const hasVariants = productVariants.length > 0;
              const isExpanded = expandedAbcProductId === p.id;
              const productSparkDaysWithData = sparkData.filter(v => v > 0).length;
              const productHasSufficientData = productSparkDaysWithData >= 3;
              let productTrend: 'up' | 'down' | 'stable' = 'stable';
              if (productHasSufficientData) {
                const f3 = (sparkData[0] + sparkData[1] + sparkData[2]) / 3;
                const l3 = (sparkData[4] + sparkData[5] + sparkData[6]) / 3;
                const avgVal = (f3 + l3) / 2 || 1;
                const chg = ((l3 - f3) / avgVal) * 100;
                if (chg > 5) productTrend = 'up';
                else if (chg < -5) productTrend = 'down';
              }
              const trendColor = getTrendColor(productTrend);
              return (
                <View key={idx}>
                  <TouchableOpacity
                    activeOpacity={hasVariants ? 0.6 : 1}
                    onPress={() => {
                      if (hasVariants) {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedAbcProductId(isExpanded ? null : p.id);
                      }
                    }}
                    style={[styles.tableRow, idx < abcClassification.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                  >
                    <View style={{ flex: 0.4, alignItems: 'center' as const }}>
                      <View style={[styles.abcBadge, { backgroundColor: abcColor + '18' }]}>
                        <Text style={{ fontSize: 11, fontWeight: '800' as const, color: abcColor }}>{p.abc}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1.8, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
                      {hasVariants && (
                        <ChevronDown
                          size={12}
                          color={colors.textTertiary}
                          style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
                        />
                      )}
                      <Text style={[styles.cellBold, { color: colors.text, flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                    </View>
                    <View style={{ flex: 0.9, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'flex-end' as const, gap: 2 }}>
                      <Text style={[styles.cellText, { color: colors.text, textAlign: 'right' }]}>{formatCurrencyInteger(p.ca, cur)}</Text>
                      {productHasSufficientData ? (
                        <Text style={{ fontSize: 11, color: trendColor, fontWeight: '700' as const }}>{getTrendArrow(productTrend)}</Text>
                      ) : (
                        <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' as const }}>—</Text>
                      )}
                    </View>
                    <Text style={[styles.cellText, { color: colors.textTertiary, flex: 0.5, textAlign: 'right' }]}>{Math.round(p.pctCA)}%</Text>
                    <Text style={[styles.cellBold, { color: p.margin >= 0 ? '#059669' : '#DC2626', flex: 0.9, textAlign: 'right' }]}>{formatCurrencyInteger(p.margin, cur)}</Text>
                    <View style={{ flex: 0.8, alignItems: 'flex-end' as const }}>
                      {hasSparkData ? (
                        <SparklineChart data={sparkData} color={productHasSufficientData ? getTrendColor(productTrend) : abcColor} width={56} height={18} strokeWidth={1.2} />
                      ) : (
                        <View style={{ width: 56, height: 18, backgroundColor: colors.borderLight, borderRadius: 3, opacity: 0.4 }} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && hasVariants && (
                    <View style={{
                      backgroundColor: colors.card === '#FFFFFF' ? '#F8FAFC' : colors.inputBg,
                      borderRadius: RADIUS.MD,
                      marginHorizontal: SPACING.SM,
                      marginBottom: SPACING.MD,
                      paddingVertical: SPACING.SM,
                      paddingHorizontal: SPACING.MD,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                    }}>
                      {productVariants.map((v, vIdx) => {
                        const vSparkHasData = v.sparkline.some(val => val > 0);
                        const vTrendColor = getTrendColor(v.trend);
                        return (
                          <View
                            key={v.variantId}
                            style={{
                              flexDirection: 'row' as const,
                              alignItems: 'center' as const,
                              paddingVertical: SPACING.MD,
                              borderBottomWidth: vIdx < productVariants.length - 1 ? 1 : 0,
                              borderBottomColor: colors.borderLight,
                              gap: SPACING.SM,
                            }}
                          >
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: vTrendColor, marginLeft: 4 }} />
                            <Text style={{ flex: 1.6, fontSize: 11, fontWeight: '500' as const, color: colors.textSecondary }} numberOfLines={1}>
                              {v.label}
                            </Text>
                            <View style={{ flex: 0.8, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'flex-end' as const, gap: 2 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.text }}>
                                {formatCurrencyInteger(v.ca, cur)}
                              </Text>
                              {v.hasSufficientData ? (
                                <Text style={{ fontSize: 10, color: vTrendColor, fontWeight: '700' as const }}>{getTrendArrow(v.trend)}</Text>
                              ) : (
                                <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '500' as const }}>—</Text>
                              )}
                            </View>
                            <Text style={{ flex: 0.7, fontSize: 11, fontWeight: '600' as const, color: v.margin >= 0 ? '#059669' : '#DC2626', textAlign: 'right' as const }}>
                              {formatCurrencyInteger(v.margin, cur)}
                            </Text>
                            <View style={{ flex: 0.7, alignItems: 'flex-end' as const }}>
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

      {/* Marge par catégorie */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Marge par catégorie</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Rentabilité de chaque catégorie de produit</Text>
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
              unit={cur}
              message={`${marginCategoryChartState.nonEmptyCount} catégorie${marginCategoryChartState.nonEmptyCount > 1 ? 's' : ''} — ajoutez des produits dans d'autres catégories pour enrichir le graphique`}
              insight={`${marginCategoryChartState.nonEmptyCount} catégorie${marginCategoryChartState.nonEmptyCount > 1 ? 's' : ''} avec de la marge`}
            />
          ) : (
            <HorizontalBarChart
              data={marginByCategory}
              width={isMobile ? width - 80 : 460}
              textColor={colors.textSecondary}
              valueColor={colors.text}
            />
          )}
        </View>
      </View>

      {/* ═══ SECTION 3 — COMPORTEMENT CLIENTS ═══ */}

      <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
        {/* Gauche : Fidélité & rétention */}
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                <Users size={16} color="#6366F1" />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Fidélité & rétention</Text>
              </View>
              <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Base clients active</Text>
            </View>
            <View style={[styles.loyaltyKpiBadge, { backgroundColor: loyaltyRate >= 50 ? '#ECFDF5' : '#FEF3C7' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700' as const, color: loyaltyRate >= 50 ? '#059669' : '#D97706' }}>
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
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: SPACING.LG }}>
                <View style={{ alignItems: 'center' as const, flex: 1 }}>
                  <Text style={{ fontSize: 28, fontWeight: '800' as const, color: colors.text }}>{clientRecurrence.newCount + clientRecurrence.recurringCount}</Text>
                  <Text style={{ fontSize: TYPOGRAPHY.SIZE.CAPTION, color: colors.textTertiary, marginTop: 2 }}>clients actifs</Text>
                </View>
                <View style={{ alignItems: 'center' as const, flex: 1 }}>
                  <Text style={{ fontSize: 28, fontWeight: '800' as const, color: loyaltyRate >= 50 ? '#059669' : '#D97706' }}>{loyaltyRate}%</Text>
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

        {/* Droite : Heure de pointe */}
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Heure de pointe</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Identifiez vos créneaux les plus actifs</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.XS, marginBottom: SPACING.MD }}>
            <TouchableOpacity
              style={[styles.periodPill, { backgroundColor: hourlyDayFilter === null ? colors.primary : colors.card, borderColor: hourlyDayFilter === null ? colors.primary : colors.cardBorder }]}
              onPress={() => setHourlyDayFilter(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, { color: hourlyDayFilter === null ? '#fff' : colors.textSecondary }]}>Tous</Text>
            </TouchableOpacity>
            {(locale === 'en'
              ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
            ).map((day, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.periodPill, { backgroundColor: hourlyDayFilter === idx ? colors.primary : colors.card, borderColor: hourlyDayFilter === idx ? colors.primary : colors.cardBorder }]}
                onPress={() => setHourlyDayFilter(prev => prev === idx ? null : idx)}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodText, { color: hourlyDayFilter === idx ? '#fff' : colors.textSecondary }]}>{day}</Text>
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
              message={`Encore ${3 - hourlyChartState.nonEmptyCount} tranche${3 - hourlyChartState.nonEmptyCount > 1 ? 's' : ''} horaire${3 - hourlyChartState.nonEmptyCount > 1 ? 's' : ''} nécessaire${3 - hourlyChartState.nonEmptyCount > 1 ? 's' : ''} pour afficher le graphique`}
              insight={`${hourlyChartState.nonEmptyCount} tranche${hourlyChartState.nonEmptyCount > 1 ? 's' : ''} horaire${hourlyChartState.nonEmptyCount > 1 ? 's' : ''} avec du trafic`}
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
          {peakHourValue > 0 && !hourlyChartState.isEmpty && !hourlyChartState.isSparse && (() => {
            const totalHourlySales = hourlyBarData.reduce((s, v) => s + v, 0);
            const nonZeroHours = hourlyBarData.filter(v => v > 0);
            const avgHourly = nonZeroHours.length > 0 ? totalHourlySales / nonZeroHours.length : 0;
            if (totalHourlySales < 5) return null;
            const sorted = [...hourlyBarData.map((v, i) => ({ hour: i, count: v }))].sort((a, b) => b.count - a.count);
            const peak1 = sorted[0];
            const peak2 = sorted.length > 1 ? sorted[1] : null;
            let recommendation = '';
            if (peak1.count > avgHourly * 2) {
              recommendation = `Votre pic d'activité est ${peak1.hour}h avec ${peak1.count} vente${peak1.count > 1 ? 's' : ''}. Assurez-vous d'être disponible sur ce créneau.`;
            } else if (peak2 && Math.abs(peak1.count - peak2.count) <= 1 && peak1.count > avgHourly) {
              recommendation = `Vous avez deux pics d'activité : ${peak1.hour}h et ${peak2.hour}h. Planifiez vos pauses en dehors de ces horaires.`;
            } else if (peak1.count <= avgHourly * 1.5) {
              recommendation = `Votre activité est régulière sur la journée. Pas de créneau critique identifié.`;
            } else {
              recommendation = `Votre pic d'activité est ${peak1.hour}h avec ${peak1.count} vente${peak1.count > 1 ? 's' : ''}. Assurez-vous d'être disponible sur ce créneau.`;
            }
            return (
              <View style={[styles.recommendationBlock, { backgroundColor: colors.card === '#FFFFFF' ? '#F8FAFC' : colors.inputBg }]}>
                <Lightbulb size={14} color="#D97706" style={{ marginTop: 1 }} />
                <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>
                  {recommendation}
                </Text>
              </View>
            );
          })()}
        </View>
      </View>

      {/* ═══ SECTION 4 — OUTILS ═══ */}

      {/* Panier moyen */}
      <AverageBasketCard
        data={avgBasketEvolution}
        currentValue={currentAvgBasket}
        previousValue={prevAvgBasket}
        formatCurrency={(v) => formatCurrencyInteger(v, cur)}
        primaryColor={colors.primary}
        textColor={colors.text}
        textSecondary={colors.textSecondary}
        textTertiary={colors.textTertiary}
        cardBg={colors.card}
        cardBorder={colors.cardBorder}
        successColor={colors.success}
        dangerColor={colors.danger}
      />

      {/* Exporter en PDF */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('reports.exportPDF')}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Générez et partagez vos rapports</Text>
        <View style={styles.exportBtnRow}>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: colors.primary }]} onPress={handleExportSalesReport} activeOpacity={0.7}>
            <Download size={14} color={SEMANTIC_COLORS.WHITE} />
            <Text style={styles.exportBtnText}>{t('reports.salesReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#059669' }]} onPress={handleExportStockReport} activeOpacity={0.7}>
            <Download size={14} color={SEMANTIC_COLORS.WHITE} />
            <Text style={styles.exportBtnText}>{t('reports.stockReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#7C3AED' }]} onPress={handleExportFinancialReport} activeOpacity={0.7}>
            <Download size={14} color={SEMANTIC_COLORS.WHITE} />
            <Text style={styles.exportBtnText}>{t('reports.financialReport')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Comparaison avec la période précédente */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Comparaison avec la période précédente</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Identifiez les tendances par rapport à la période précédente</Text>
        <View style={[styles.comparisonRow, isMobile && styles.comparisonRowMobile]}>
          {[
            { label: t('dashboard.revenue'), value: monthlyRevenue, prev: prevRevenue, change: revenueChange, sparkline: revenueSparkline },
            { label: t('dashboard.sales'), value: paidSalesCount, prev: prevSalesCount, change: salesCountChange, sparkline: salesSparkline, isCount: true },
            { label: t('dashboard.grossProfit'), value: grossMargin, prev: prevGrossMargin, change: marginChange, sparkline: marginEvolution.map(m => m.margin) },
          ].map(({ label, value, prev, change, sparkline, isCount }) => (
            <View key={label} style={[styles.comparisonCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
              <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[styles.comparisonValue, { color: colors.text }]}>{isCount ? String(value) : formatCurrencyInteger(value as number, cur)}</Text>
              <Text style={[styles.comparisonPrev, { color: colors.textTertiary }]}>{t('dashboard.vs')} {isCount ? String(prev) : formatCurrencyInteger(prev as number, cur)}</Text>
              {change !== undefined ? (
                <View style={[styles.comparisonBadge, { backgroundColor: change >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
                  {change >= 0 ? <ArrowUpRight size={12} color="#059669" /> : <ArrowDownRight size={12} color="#DC2626" />}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: change >= 0 ? '#059669' : '#DC2626' }}>{change >= 0 ? '+' : ''}{Math.round(change)}%</Text>
                </View>
              ) : (
                <View style={[styles.comparisonBadge, { backgroundColor: colors.borderLight }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.textTertiary }}>En attente de données</Text>
                </View>
              )}
              <View style={styles.comparisonSparkline}>
                <SparklineChart data={sparkline} color={(change ?? 0) >= 0 ? '#059669' : '#DC2626'} width={90} height={22} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET TRESORERIE
  // ─────────────────────────────────────────────────────────────────────────

  const renderTreasuryTab = () => (
    <>
      {/* 1. RUNWAY — en premier, pleine largeur */}
      <RunwayCard
        solde={cashBalance}
        monthlyExpenses={monthlyExpensesAvg}
        formatCurrency={(v) => formatCurrencyInteger(v, cur)}
      />

      {/* 2. KPIs 3 colonnes */}
      <View style={[styles.kpiRow, isMobile && styles.kpiRowMobile]}>
        <KPICard
          title={t('dashboard.balance')}
          value={formatCurrencyInteger(cashBalance, cur)}
          icon={<Wallet size={16} color={cashBalance >= 0 ? colors.success : colors.danger} />}
          accentColor={cashBalance >= 0 ? '#059669' : '#DC2626'}
        />
        <KPICard
          title={t('dashboard.collections')}
          value={formatCurrencyInteger(totalEncaissements, cur)}
          icon={<ArrowUpRight size={16} color="#059669" />}
          accentColor="#059669"
        />
        <KPICard
          title={t('dashboard.disbursements')}
          value={formatCurrencyInteger(totalDecaissementsWithPlanned, cur)}
          icon={<ArrowDownRight size={16} color="#F59E0B" />}
          accentColor="#F59E0B"
        />
      </View>

      {/* 3. RATIO DE COUVERTURE */}
      <CashflowRatio
        encaissements={totalEncaissements}
        decaissements={totalDecaissements}
        formatCurrency={(v) => formatCurrencyInteger(v, cur)}
      />

      {/* 3.5. ENCAISSEMENTS ATTENDUS */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Encaissements attendus</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Suivi des factures en attente de paiement</Text>
          </View>
          {expectedCollections.overdueAmount > 0 && (
            <View style={[styles.loyaltyKpiBadge, { backgroundColor: '#FEF2F2' }]}>
              <Text style={{ fontSize: 10, fontWeight: '700' as const, color: '#DC2626' }}>Retard</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 28, fontWeight: '800' as const, color: expectedCollections.thisWeekAmount > 0 ? colors.text : colors.textTertiary, letterSpacing: -1, marginBottom: SPACING.MD }}>
          {expectedCollections.thisWeekAmount > 0 ? formatCurrencyInteger(expectedCollections.thisWeekAmount, cur) : 'Aucun encaissement prévu cette semaine'}
        </Text>

        {expectedCollections.totalUnpaid > 0 && (
          <View style={{ marginBottom: SPACING.LG }}>
            <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: SPACING.SM }}>
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '500' as const }}>Encaissé ce mois</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' as const }}>
                {Math.min(Math.round((expectedCollections.collectedThisMonth / (expectedCollections.collectedThisMonth + expectedCollections.totalUnpaid)) * 100), 100)}%
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' as const }}>
              <View style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#059669',
                width: `${Math.min(Math.round((expectedCollections.collectedThisMonth / (expectedCollections.collectedThisMonth + expectedCollections.totalUnpaid)) * 100), 100)}%` as `${number}%`,
              }} />
            </View>
            <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: SPACING.SM }}>
              <Text style={{ fontSize: 10, color: colors.textTertiary }}>{formatCurrencyInteger(expectedCollections.collectedThisMonth, cur)} encaissé</Text>
              <Text style={{ fontSize: 10, color: colors.textTertiary }}>{formatCurrencyInteger(expectedCollections.totalUnpaid, cur)} restant</Text>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row' as const, gap: SPACING.MD, marginBottom: SPACING.LG }}>
          <View style={[styles.expectedMetric, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Text style={{ fontSize: 10, color: '#1E40AF', fontWeight: '600' as const }}>Cette semaine</Text>
            <Text style={{ fontSize: 14, color: '#1E40AF', fontWeight: '800' as const }}>{formatCurrencyInteger(expectedCollections.thisWeekAmount, cur)}</Text>
          </View>
          <View style={[styles.expectedMetric, { backgroundColor: expectedCollections.overdueAmount > 0 ? '#FEF2F2' : '#F9FAFB', borderColor: expectedCollections.overdueAmount > 0 ? '#FECACA' : '#E5E7EB' }]}>
            <Text style={{ fontSize: 10, color: expectedCollections.overdueAmount > 0 ? '#991B1B' : colors.textTertiary, fontWeight: '600' as const }}>En retard</Text>
            <Text style={{ fontSize: 14, color: expectedCollections.overdueAmount > 0 ? '#DC2626' : colors.textTertiary, fontWeight: '800' as const }}>{formatCurrencyInteger(expectedCollections.overdueAmount, cur)}</Text>
          </View>
          <View style={[styles.expectedMetric, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }]}>
            <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: '600' as const }}>Total</Text>
            <Text style={{ fontSize: 14, color: colors.text, fontWeight: '800' as const }}>{formatCurrencyInteger(expectedCollections.totalUnpaid, cur)}</Text>
          </View>
        </View>

        {expectedCollections.topClient && (
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.MD, marginBottom: SPACING.LG, backgroundColor: '#FEF3C7', paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD }}>
            <AlertTriangle size={13} color="#D97706" />
            <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '500' as const, flex: 1 }} numberOfLines={1}>
              Plus gros impayé : {expectedCollections.topClient.name} · {formatCurrencyInteger(expectedCollections.topClient.amount, cur)}
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={() => router.push('/ventes?tab=factures' as never)} activeOpacity={0.7}>
          <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: colors.primary }}>
            Voir les {expectedCollections.unpaidCount} facture{expectedCollections.unpaidCount > 1 ? 's' : ''} →
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. FLUX DE TRÉSORERIE NET */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.cashFlow')}</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Encaissements − Décaissements sur la période</Text>
          </View>
          <View style={[styles.netBadge, { backgroundColor: netCashflow >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700' as const, color: netCashflow >= 0 ? '#059669' : '#DC2626' }}>
              {netCashflow >= 0 ? '+' : ''}{formatCurrencyInteger(netCashflow, cur)}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 32, fontWeight: '800' as const, color: netCashflow >= 0 ? '#059669' : '#DC2626', letterSpacing: -1, marginBottom: SPACING.SM }}>
          {netCashflow >= 0 ? '+' : ''}{formatCurrencyInteger(netCashflow, cur)}
        </Text>
        {netCashflowSparkline.some(v => v !== 0) ? (
          <SparklineChart
            data={netCashflowSparkline}
            color={netCashflow >= 0 ? '#059669' : '#EF4444'}
            width={isMobile ? width - 80 : 460}
            height={48}
          />
        ) : (
          <ActionableEmptyState
            icon="wallet"
            message="Enregistrez un mouvement pour voir le flux de trésorerie"
            ctaLabel="Ajouter un mouvement"
            onCtaPress={() => router.push('/cashflow')}
          />
        )}
        <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: SPACING.MD }}>
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.XS }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' }} />
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>Entrées {formatCurrencyInteger(totalEncaissements, cur)}</Text>
          </View>
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.XS }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>Sorties {formatCurrencyInteger(totalDecaissements, cur)}</Text>
          </View>
        </View>
      </View>

      {/* Projection tresorerie basee sur factures en attente */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Projection de trésorerie</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Estimation basée sur les factures en attente</Text>
          </View>
          <LegendRow
            items={[
              { color: '#059669', label: 'Réel' },
              { color: '#6366F1', label: 'Projeté' },
            ]}
            textColor={colors.textSecondary}
          />
        </View>
        {projectionChartState.isEmpty ? (
          <ActionableEmptyState
            icon="file"
            message="Créez des factures avec des dates d'échéance pour voir les projections"
            ctaLabel="Créer une facture"
            onCtaPress={() => router.push('/ventes')}
          />
        ) : projectionChartState.isSparse ? (
          <CompactSummaryCard
            total={projectionData.reduce((s, d) => s + (d.projected || 0), 0)}
            totalLabel="Montant projeté"
            unit={cur}
            message={`Créez plus de factures avec échéances pour enrichir les projections`}
            insight={`${projectionChartState.nonEmptyCount} mois avec des projections`}
          />
        ) : (
          <ProjectionBars
            data={projectionData}
            width={isMobile ? width - 80 : 460}
            height={140}
            colorActual="#059669"
            colorProjected="#6366F1"
            textColor={colors.textSecondary}
          />
        )}
      </View>

      {/* Évolution du solde + Répartition dépenses */}
      <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Évolution du solde</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Suivez la santé de votre trésorerie sur 6 mois</Text>
          {treasurySparkline.every(v => v === 0) ? (
            <ActionableEmptyState
              icon="wallet"
              message="Enregistrez un mouvement pour suivre l'évolution du solde"
              ctaLabel="Ajouter un mouvement"
              onCtaPress={() => router.push('/cashflow')}
            />
          ) : (
            <TreasuryLineChart
              data={treasurySparkline}
              labels={sixMonthsData.map(m => m.label)}
              width={isMobile ? width - 80 : 280}
              height={160}
              color={cashBalance >= 0 ? '#059669' : '#EF4444'}
              textColor={colors.textTertiary}
            />
          )}
        </View>

        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Répartition des dépenses</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Où va votre argent ?</Text>
          {expenseBreakdownSegments.length === 0 ? (
            <ActionableEmptyState
              icon="pie"
              message="Enregistrez vos dépenses pour voir leur répartition"
              ctaLabel="Ajouter une dépense"
              onCtaPress={() => router.push('/achats')}
            />
          ) : (
            <>
              <Text style={[styles.cardSubtitle, { color: colors.textTertiary, marginBottom: 4 }]}>Période sélectionnée</Text>
              <View style={styles.donutContainer}>
                <SmartDonut
                  segments={expenseBreakdownSegments}
                  size={isMobile ? 100 : 120}
                  strokeWidth={18}
                  centerValue={formatCurrencyInteger(expenseBreakdownSegments.reduce((s, seg) => s + seg.value, 0), cur)}
                  centerLabel="total"
                  currency={cur}
                />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Délai moyen de paiement clients */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Délai moyen de paiement</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Surveillez les délais de règlement de vos clients</Text>
          </View>
          <View style={[styles.loyaltyKpiBadge, { backgroundColor: avgPaymentDelay <= 30 ? '#ECFDF5' : '#FEF2F2' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700' as const, color: avgPaymentDelay <= 30 ? '#059669' : '#DC2626' }}>
              Actuel : {avgPaymentDelay}j
            </Text>
          </View>
        </View>
        {paymentDelayChartState.isEmpty ? (
          <ActionableEmptyState
            icon="clock"
            message="Les délais de paiement apparaîtront après vos premières factures réglées"
            ctaLabel="Créer une facture"
            onCtaPress={() => router.push('/ventes')}
          />
        ) : paymentDelayChartState.isSparse ? (
          <CompactSummaryCard
            total={avgPaymentDelay}
            totalLabel="Délai moyen"
            unit="jours"
            message={`Encore ${3 - paymentDelayChartState.nonEmptyCount} mois de données nécessaires pour afficher le graphique`}
            insight={`${paymentDelayChartState.nonEmptyCount} mois avec des données de paiement`}
          />
        ) : (
          <>
            <HorizontalRefBarChart
              data={paymentDelayData.map(d => ({ ...d, value: d.value > 0 ? d.value : 0 }))}
              width={isMobile ? width - 80 : 460}
              referenceLine={30}
              referenceLabel="30j (délai légal)"
              goodColor="#059669"
              badColor="#EF4444"
              textColor={colors.textSecondary}
            />
            {paymentDelayData.some(d => d.value === 0) && (
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.SM, marginTop: SPACING.MD, backgroundColor: colors.borderLight, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD }}>
                <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                  Mois grisés = aucune facture émise ou paiement immédiat
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Mini-tableaux factures en retard + fournisseurs a payer */}
      <View style={[styles.miniTablesRow, isMobile && { flexDirection: 'column' }]}>
        <View style={[styles.miniTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.miniTableHeader}>
            <Clock size={14} color="#D97706" />
            <Text style={[styles.miniTableTitle, { color: colors.text }]}>{t('dashboard.lateInvoices')}</Text>
          </View>
          {lateClientInvoices.length === 0 ? (
            <Text style={[styles.miniTableEmpty, { color: colors.textTertiary }]}>{t('dashboard.noLateInvoices')}</Text>
          ) : (
            lateClientInvoices.map((inv, idx) => (
              <View key={inv.id} style={[styles.miniTableRow, idx < lateClientInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cellBold, { color: colors.text }]} numberOfLines={1}>{inv.client}</Text>
                  <Text style={[styles.cellSub, { color: colors.danger }]}>{t('dashboard.daysLate', { count: inv.daysLate })}</Text>
                </View>
                <Text style={[styles.cellBold, { color: colors.danger }]}>{formatCurrencyInteger(inv.amount, cur)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.miniTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.miniTableHeader}>
            <Truck size={14} color="#7C3AED" />
            <Text style={[styles.miniTableTitle, { color: colors.text }]}>{t('dashboard.suppliersDue')}</Text>
          </View>
          {suppliersDue.length === 0 ? (
            <Text style={[styles.miniTableEmpty, { color: colors.textTertiary }]}>{t('dashboard.noSupplierInvoices')}</Text>
          ) : (
            suppliersDue.map((si, idx) => (
              <View key={si.id} style={[styles.miniTableRow, idx < suppliersDue.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cellBold, { color: colors.text }]} numberOfLines={1}>{si.supplier}</Text>
                  <Text style={[styles.cellSub, { color: colors.textTertiary }]}>{t('dashboard.dueDate', { date: formatDate(si.dueDate) })}</Text>
                </View>
                <Text style={[styles.cellBold, { color: '#7C3AED' }]}>{formatCurrencyInteger(si.amount, cur)}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Mouvements de tresorerie avec filtre et export FEC */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <TouchableOpacity style={styles.movementsToggle} onPress={() => setShowMovements(prev => !prev)} activeOpacity={0.7}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.movements')}</Text>
            <Text style={[styles.toggleText, { color: colors.primary }]}>{showMovements ? t('dashboard.hide') : t('dashboard.showCount', { count: allMovements.length })}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fecBtn, { borderColor: colors.cardBorder }]} onPress={handleExportFEC} activeOpacity={0.7}>
            <Download size={13} color={colors.primary} />
            <Text style={[styles.fecBtnText, { color: colors.primary }]}>FEC</Text>
          </TouchableOpacity>
        </View>

        {showMovements && (
          <>
            <View style={styles.filterRow}>
              {[
                { key: 'all' as MovementFilter, label: t('dashboard.allMovements') },
                { key: 'income' as MovementFilter, label: t('dashboard.income') },
                { key: 'expense' as MovementFilter, label: t('dashboard.expenses') },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterPill, { backgroundColor: movementFilter === f.key ? colors.primary : colors.card, borderColor: movementFilter === f.key ? colors.primary : colors.cardBorder }]}
                  onPress={() => setMovementFilter(f.key)}
                >
                  <Text style={[styles.filterPillText, { color: movementFilter === f.key ? SEMANTIC_COLORS.WHITE : colors.textSecondary }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {filteredMovements.length === 0 ? (
              <ActionableEmptyState
                icon="wallet"
                message="Aucun mouvement trouvé pour ce filtre"
              />
            ) : (
              filteredMovements.slice(0, 20).map((movement, i) => (
                <View key={movement.id} style={[styles.movementRow, i < Math.min(filteredMovements.length, 20) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={[styles.movementIcon, { backgroundColor: movement.type === 'income' ? colors.successLight : colors.dangerLight }]}>
                    {movement.type === 'income' ? <ArrowUpRight size={14} color={colors.success} /> : <ArrowDownRight size={14} color={colors.danger} />}
                  </View>
                  <View style={styles.movementInfo}>
                    <Text style={[styles.cellBold, { color: colors.text }]} numberOfLines={1}>{movement.description}</Text>
                    <View style={styles.movementMeta}>
                      <Text style={[styles.cellSub, { color: colors.textTertiary }]}>{formatDate(movement.date)}</Text>
                      <View style={[styles.sourceBadge, { backgroundColor: movement.type === 'income' ? colors.successLight : colors.dangerLight }]}>
                        <Text style={[styles.sourceText, { color: movement.type === 'income' ? colors.success : colors.danger }]}>{movement.source}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.cellBold, { color: movement.type === 'income' ? colors.success : colors.danger }]}>
                    {movement.type === 'income' ? '+' : '-'}{formatCurrency(movement.amount, cur)}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </View>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MODE SIMPLIFIE (role restreint)
  // ─────────────────────────────────────────────────────────────────────────

  const renderSimplifiedDashboard = () => (
    <>
      {renderTodayBanner()}
      <View style={[styles.kpiRow, isMobile && styles.kpiRowMobile]}>
        <KPICard title={t('dashboard.monthlyRevenue')} value={formatCurrencyInteger(monthlyRevenue, cur)} change={revenueChange !== undefined ? Math.round(revenueChange * 10) / 10 : undefined} icon={<TrendingUp size={16} color={colors.primary} />} sparklineData={revenueSparkline} sparklineColor={colors.primary} />
        <KPICard title={t('dashboard.salesNumber')} value={String(paidSalesCount)} icon={<ShoppingCart size={16} color="#7C3AED" />} accentColor="#7C3AED" sparklineData={salesSparkline} sparklineColor="#7C3AED" />
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.recentSales')}</Text>
        {renderRecentSalesList(false)}
      </View>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title={t('dashboard.title')} rightContent={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.SM }}>
          <View style={[styles.healthBadge, { backgroundColor: globalHealthStatus === 'green' ? '#059669' : globalHealthStatus === 'orange' ? '#F59E0B' : '#DC2626' }]} />
        </View>
      } />
      {!simplifiedDashboard && (
        <SectionTabBar
          tabs={DASHBOARD_TAB_KEYS.map(tab => ({ ...tab, label: t(tab.labelKey) }))}
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
        />
      )}
      {!simplifiedDashboard && (
        <View style={[styles.stickyPeriodRow, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
            {PERIOD_OPTION_KEYS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.periodPill, { backgroundColor: period === opt.key ? colors.primary : colors.card, borderColor: period === opt.key ? colors.primary : colors.cardBorder }]}
                onPress={() => setPeriod(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodText, { color: period === opt.key ? SEMANTIC_COLORS.WHITE : colors.textSecondary }]}>{t(opt.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingText, { color: colors.text }]}>{greeting}</Text>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>{todayStr}</Text>
          </View>
          <View style={styles.freshnessRow}>
            <Text style={[styles.freshnessText, { color: colors.textTertiary }]}>
              {refreshMinutesAgo < 1 ? 'Mis à jour à l\'instant' : `Mis à jour il y a ${refreshMinutesAgo} min`}
            </Text>
            <TouchableOpacity onPress={() => setLastRefreshTime(new Date())} activeOpacity={0.7}>
              <RefreshCw size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {simplifiedDashboard ? renderSimplifiedDashboard() : (
          <>
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'analysis' && renderAnalysisTab()}
            {activeTab === 'treasury' && renderTreasuryTab()}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.XXXL, gap: SPACING.XL },

  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.XS },
  greetingText: { fontSize: TYPOGRAPHY.SIZE.HEADING, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, letterSpacing: TYPOGRAPHY.LETTER_SPACING.SNUG },
  dateText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, marginTop: SPACING.XXS },

  periodRow: { flexDirection: 'row', gap: SPACING.SM, marginBottom: SPACING.XS },
  periodPill: { paddingHorizontal: SPACING.XXL, paddingVertical: 7, borderRadius: RADIUS.ROUND, borderWidth: 1 },
  periodText: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  kpiRow: { flexDirection: 'row', gap: SPACING.MD },
  kpiRowMobile: { flexWrap: 'wrap' },
  kpiRowCompact: { flexDirection: 'row' as const, gap: SPACING.SM, flexWrap: 'wrap' as const },

  // Carte de base pour tous les blocs de contenu
  card: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM },
  chartCard: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XL },
  cardTitle: { fontSize: TYPOGRAPHY.SIZE.BODY_LARGE, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  cardSubtitle: { fontSize: TYPOGRAPHY.SIZE.SMALL, marginTop: 1 },

  chartsRow: { flexDirection: 'row', gap: SPACING.XL },
  chartsRowMobile: { flexDirection: 'column' },

  // Etat vide : icone + texte centre
  emptyChart: { alignItems: 'center', paddingVertical: 32, gap: SPACING.MD },
  emptyChartText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, textAlign: 'center', maxWidth: 260, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  emptyChartHint: { fontSize: TYPOGRAPHY.SIZE.SMALL, textAlign: 'center', maxWidth: 260, lineHeight: 18, opacity: 0.7 },

  emptyHint: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD, marginTop: SPACING.XL },
  emptyHintText: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },

  // Bar chart vertical
  barChartArea: { marginTop: SPACING.XS },
  barChartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.XS, height: 180 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValueWrap: { marginBottom: 3, minHeight: 14 },
  barValueText: { fontSize: 9, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, textAlign: 'center' },
  bar: { width: '65%', borderRadius: RADIUS.XS },
  barDashed: { width: '65%', height: 1, borderWidth: 1, borderStyle: 'dashed' },
  barXLabel: { fontSize: TYPOGRAPHY.SIZE.MICRO, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM, marginTop: SPACING.SM, textTransform: 'capitalize' },

  lineChartArea: { marginTop: SPACING.XL },
  lineChartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.SM, height: 140 },
  lineBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },

  donutContainer: { paddingVertical: SPACING.XL, alignItems: 'center' },

  viewAllLink: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  // Lignes de ventes recentes avec barre de fond proportionnelle
  recentSalesList: { marginTop: SPACING.XS },
  saleRow: { position: 'relative', overflow: 'hidden' },
  saleProgressStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: RADIUS.XS },
  saleProgressFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  saleRowContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.LG, paddingHorizontal: SPACING.XS },
  saleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.LG, flex: 1 },
  paymentIconWrap: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saleInfo: { flex: 1 },
  saleClient: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  saleMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD, marginTop: 2 },
  saleDate: { fontSize: TYPOGRAPHY.SIZE.CAPTION },
  saleAmount: { fontSize: TYPOGRAPHY.SIZE.BODY, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },

  // Tableau produits
  tableContent: { marginTop: SPACING.MD },
  tableRowHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: SPACING.MD, borderBottomWidth: 1, marginBottom: SPACING.XXS },
  thCell: { fontSize: TYPOGRAPHY.SIZE.TINY, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase', letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.LG },
  cellText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL },
  cellBold: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  cellSub: { fontSize: TYPOGRAPHY.SIZE.CAPTION, marginTop: 1 },

  rankBadge: { width: 24, height: 24, borderRadius: RADIUS.SM, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },

  // Banniere CA du jour
  todayAndTargetRow: { flexDirection: 'row' as const, gap: SPACING.SM, alignItems: 'stretch' as const },
  todayAndTargetRowMobile: { flexDirection: 'column' as const },
  targetCard: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
  todayBanner: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.LG, position: 'relative', overflow: 'hidden', flex: 1 },
  todayAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: RADIUS.XL, borderBottomLeftRadius: RADIUS.XL },
  todayBannerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM, marginBottom: SPACING.XXS },
  todayAmount: { fontSize: TYPOGRAPHY.SIZE.BODY_LARGE, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, letterSpacing: TYPOGRAPHY.LETTER_SPACING.SNUG },
  todaySalesBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.ROUND },
  todaySalesText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  // Cartes d'actions urgentes
  actionRow: { marginBottom: 0 },
  actionRowContent: { gap: SPACING.MD, paddingRight: SPACING.XS },
  actionCard: { borderWidth: 1, borderRadius: RADIUS.LG, paddingHorizontal: SPACING.XXL, paddingVertical: SPACING.LG, minWidth: 200 },
  actionCardInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD },
  actionCardText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, flexShrink: 1 },

  // Cards de comparaison periode precedente
  comparisonRow: { flexDirection: 'row', gap: SPACING.LG, marginTop: SPACING.XL },
  comparisonRowMobile: { flexWrap: 'wrap' },
  comparisonCard: { flex: 1, minWidth: 100, borderWidth: 1, borderRadius: RADIUS.LG, padding: SPACING.XL, alignItems: 'center', gap: SPACING.XS },
  comparisonLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase', letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE },
  comparisonValue: { fontSize: TYPOGRAPHY.SIZE.TITLE, fontWeight: '800', letterSpacing: TYPOGRAPHY.LETTER_SPACING.SNUG },
  comparisonPrev: { fontSize: TYPOGRAPHY.SIZE.CAPTION },
  comparisonBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.MD, paddingVertical: 3, borderRadius: RADIUS.XL, marginTop: SPACING.XXS },
  comparisonSparkline: { marginTop: SPACING.SM },

  // Legende inline graphes
  legendInline: { flexDirection: 'row', gap: SPACING.XL },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: RADIUS.XS },
  legendText: { fontSize: TYPOGRAPHY.SIZE.CAPTION },

  // Barres stacked tresorerie
  stackedBarArea: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: SPACING.SM, marginTop: SPACING.MD },
  stackedBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  stackedBarPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, width: '80%' },
  stackedBar: { flex: 1, borderRadius: 3, minHeight: 2 },

  // Mini-tableaux factures en retard et fournisseurs
  miniTablesRow: { flexDirection: 'row', gap: SPACING.LG },
  miniTable: { flex: 1, borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXL, ...SHADOWS.SM },
  miniTableHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, marginBottom: SPACING.LG },
  miniTableTitle: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  miniTableEmpty: { fontSize: TYPOGRAPHY.SIZE.SMALL, paddingVertical: SPACING.XL, textAlign: 'center' },
  miniTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.MD, gap: SPACING.MD },

  // Mouvements de tresorerie
  movementsToggle: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  fecBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.XS, paddingHorizontal: SPACING.LG, paddingVertical: 5, borderRadius: RADIUS.SM, borderWidth: 1 },
  fecBtnText: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  filterRow: { flexDirection: 'row', gap: SPACING.SM, marginTop: SPACING.XL, marginBottom: SPACING.MD },
  filterPill: { paddingHorizontal: SPACING.XL, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND, borderWidth: 1 },
  filterPillText: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  movementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.LG, gap: SPACING.LG },
  movementIcon: { width: 32, height: 32, borderRadius: RADIUS.MD, alignItems: 'center', justifyContent: 'center' },
  movementInfo: { flex: 1 },
  movementMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, marginTop: SPACING.XXS, flexWrap: 'wrap' },
  sourceBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: RADIUS.XS },
  sourceText: { fontSize: 9, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  saleDetailPanel: { marginHorizontal: SPACING.SM, marginBottom: SPACING.SM, borderWidth: 1, borderRadius: RADIUS.LG, padding: SPACING.XL, gap: SPACING.LG },
  saleDetailSection: { gap: SPACING.SM },
  saleDetailLabel: { fontSize: TYPOGRAPHY.SIZE.TINY, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase' as const, letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE },
  saleDetailValue: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  saleDetailSub: { fontSize: TYPOGRAPHY.SIZE.CAPTION },
  saleDetailItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: SPACING.SM },
  saleDetailItemName: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  saleDetailItemTotal: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  saleDetailTotals: { borderTopWidth: 1, paddingTop: SPACING.LG, gap: SPACING.XS },
  saleDetailTotalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  saleDetailTotalLabel: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },
  saleDetailTotalValue: { fontSize: TYPOGRAPHY.SIZE.BODY, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },

  // Boutons export PDF
  exportBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.MD, marginTop: SPACING.LG },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, paddingHorizontal: SPACING.XXL, paddingVertical: SPACING.LG, borderRadius: RADIUS.MD },
  exportBtnText: { color: SEMANTIC_COLORS.WHITE, fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  emptyText: {fontSize: TYPOGRAPHY.SIZE.SMALL, textAlign: 'center', paddingVertical: SPACING.MD,},
  categoryDetailList: {gap: SPACING.SM, marginTop: SPACING.XS,},
  categoryDetailHeader: {fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase' as const, letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE, marginBottom: SPACING.XXS,},
  categoryDetailRow: {flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: SPACING.XXS,},
  categoryDetailLeft: {flex: 2,},
  categoryDetailName: {fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,},
  categoryDetailQty: {fontSize: TYPOGRAPHY.SIZE.CAPTION, marginTop: 1,},
  categoryDetailAmount: {fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,},

  categoryFilterBanner: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingHorizontal: SPACING.XXXL, paddingVertical: SPACING.LG, borderRadius: RADIUS.LG, borderWidth: 1 },
  categoryFilterText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  categoryFilterClear: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM, textDecorationLine: 'underline' as const },

  stickyPeriodRow: { paddingHorizontal: SPACING.XXXL, paddingVertical: SPACING.MD, borderBottomWidth: 1 },

  variantAttrList: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4, paddingLeft: 8, paddingBottom: 6, marginTop: -2 },
  variantAttrChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  variantAttrText: { fontSize: 10, fontWeight: '500' as const },
  saleItemAttrText: { fontSize: 11, marginTop: 1 },

  variantSalesList: { marginLeft: 12, marginTop: 4, gap: 3 },
  variantSaleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 2 },
  variantSaleDot: { width: 6, height: 6, borderRadius: 3 },
  variantSaleLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  variantSaleQty: { fontSize: 10 },
  variantSaleAmount: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  emptyActionBtn: { paddingHorizontal: SPACING.XXL, paddingVertical: SPACING.LG, borderRadius: RADIUS.MD, marginTop: SPACING.SM },
  emptyActionBtnText: { color: '#fff', fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textAlign: 'center' as const },
  breakEvenNote: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD, borderWidth: 1, marginTop: SPACING.MD },
  loyaltyKpiBadge: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND },
  abcTooltip: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.SM },
  abcBadge: { width: 26, height: 26, borderRadius: RADIUS.SM, alignItems: 'center' as const, justifyContent: 'center' as const },
  analysisAnnotation: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD, borderWidth: 1, marginTop: SPACING.MD },
  noteBar: { paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD, borderWidth: 1, marginBottom: SPACING.MD },
  healthBadge: { width: 10, height: 10, borderRadius: 5, marginLeft: SPACING.SM },

  recommendationBlock: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: SPACING.MD, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.LG, borderRadius: RADIUS.MD, marginTop: SPACING.LG },
  recommendationText: { fontSize: 13, fontStyle: 'italic' as const, flex: 1, lineHeight: 18 },

  expectedMetric: { flex: 1, borderWidth: 1, borderRadius: RADIUS.LG, padding: SPACING.LG, alignItems: 'center' as const, gap: SPACING.XS },

  priorityClientRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: SPACING.LG },
  remindBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.XS, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD },

  alertPillsRow: { flexDirection: 'row' as const, gap: SPACING.MD, paddingRight: SPACING.XS },
  alertPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.MD, borderWidth: 1, borderRadius: RADIUS.ROUND, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.LG },
  alertBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  alertBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' as const },
  alertPillText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, flexShrink: 1 },

  netBadge: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND },

  kpiPrimaryCard: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM },
  kpiPrimaryHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const },
  kpiPrimaryLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase' as const, letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE, marginBottom: SPACING.XXS },
  kpiPrimaryValue: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -1 },
  kpiPrimaryTrendBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND },
  kpiPrimaryTrendText: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },
  kpiPrimarySparkline: { marginTop: SPACING.LG, marginBottom: SPACING.MD },
  kpiPrimaryTargetRow: { gap: SPACING.SM },
  kpiPrimaryProgressTrack: { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden' as const },
  kpiPrimaryProgressFill: { height: 6, borderRadius: 3 },
  kpiPrimaryTargetText: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  kpiPrimaryDefineRow: { marginTop: SPACING.SM },
  kpiPrimaryDefineText: { fontSize: TYPOGRAPHY.SIZE.SMALL },

  kpiGrid2: { flexDirection: 'row' as const, gap: SPACING.MD },
  kpiGridCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM, gap: SPACING.XS },
  kpiGridIconRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.SM, marginBottom: SPACING.SM },
  kpiGridLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase' as const, letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE },
  kpiGridValue: { fontSize: TYPOGRAPHY.SIZE.TITLE, fontWeight: '800' as const, letterSpacing: -0.5 },
  kpiGridSub: { fontSize: TYPOGRAPHY.SIZE.CAPTION },
  kpiGridChangeBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, alignSelf: 'flex-start' as const, gap: 2, paddingHorizontal: SPACING.MD, paddingVertical: 2, borderRadius: RADIUS.ROUND, marginTop: SPACING.XXS },
  kpiGridLink: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: '#DC2626', marginTop: SPACING.SM },
  freshnessRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.SM },
  freshnessText: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },

  dayGroupHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.MD, paddingVertical: SPACING.SM, paddingHorizontal: SPACING.XS },
  dayGroupDot: { width: 6, height: 6, borderRadius: 3 },
  dayGroupLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, textTransform: 'uppercase' as const, letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE },
  dayGroupLine: { flex: 1, height: 1 },
  saleRowUnpaid: { borderLeftWidth: 3, borderRadius: RADIUS.SM },
  saleTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  caPctText: { fontSize: 9, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },

  goalIconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
  goalAchievedBadge: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND },
  goalAmountRow: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: SPACING.XS, marginBottom: SPACING.XL },
  goalCurrentAmount: { fontSize: TYPOGRAPHY.SIZE.DISPLAY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.EXTRABOLD, letterSpacing: TYPOGRAPHY.LETTER_SPACING.TIGHT },
  goalSeparator: { fontSize: TYPOGRAPHY.SIZE.SUBTITLE, fontWeight: TYPOGRAPHY.WEIGHT.REGULAR },
  goalTargetAmount: { fontSize: TYPOGRAPHY.SIZE.SUBTITLE, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  goalProgressSection: { gap: SPACING.SM, marginBottom: SPACING.XL },
  goalProgressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' as const },
  goalProgressFill: { height: 8, borderRadius: 4, position: 'absolute' as const, left: 0, top: 0 },
  goalProgressLabels: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginTop: SPACING.XS },
  goalProgressPct: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },
  goalProjectionBox: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.SM, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.LG, borderRadius: RADIUS.MD, borderWidth: 1 },
  goalProjectionText: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, flex: 1 },
  goalEditRow: { alignSelf: 'flex-end' as const, marginTop: SPACING.LG },
  goalEmptyCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.XL, borderWidth: 1.5, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM },
  goalEmptyTitle: { fontSize: TYPOGRAPHY.SIZE.BODY, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  goalEmptySubtitle: { fontSize: TYPOGRAPHY.SIZE.SMALL, marginTop: 2 },
});
