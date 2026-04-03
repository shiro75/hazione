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

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
  TouchableOpacity, Platform, Share, LayoutAnimation,
} from 'react-native';
import {
  FileText, Clock, ArrowUpRight, ArrowDownRight,
  Wallet, Target, AlertTriangle, Package, Truck,
  TrendingUp, BarChart3, Inbox, Download,
  ShoppingCart, PieChart, CheckCircle, ChevronRight, CloudOff, RefreshCw,
  MessageSquare, CreditCard, Banknote, Smartphone, Users,
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
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import SectionTabBar from '@/components/SectionTabBar';
import SparklineChart from '@/components/charts/SparklineChart';
import DonutChart from '@/components/charts/DonutChart';
import type { DonutSegment } from '@/components/charts/DonutChart';
import {
  AreaChart, HorizontalBarChart, WeekHeatmap,
  TreasuryLineChart, ProjectionBars, ClientDonut,
  ProgressGauge, LegendRow,
} from '@/components/charts/DashboardCharts';
import { useI18n } from '@/contexts/I18nContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS, SEMANTIC_COLORS } from '@/constants/theme';
import { useConfirm } from '@/contexts/ConfirmContext';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES ET CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

type DashboardTab = 'overview' | 'analysis' | 'treasury';
type PeriodFilter = 'today' | 'week' | 'month' | 'quarter' | 'year';
type MovementFilter = 'all' | 'income' | 'expense';

interface RealMovement {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  source: string;
}

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

// Objectif CA mensuel par defaut — peut etre rendu configurable via les settings
const DEFAULT_MONTHLY_TARGET = 1_000_000;

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [donutCollapseFlag, setDonutCollapseFlag] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { simplifiedDashboard } = useRole();

  const periodStart = useMemo(() => getPeriodStart(now, period).toISOString(), [now, period]);
  const prevPeriod = useMemo(() => getPreviousPeriodRange(now, period), [now, period]);

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULS COMMUNS — revenues, depenses, marges
  // ─────────────────────────────────────────────────────────────────────────

  const paidInvoiceIds = useMemo(() =>
    new Set(invoices.filter(i => i.status === 'paid').map(i => i.id)), [invoices]
  );

  const todayStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.toISOString();
  }, [now]);

  const todayRevenue = useMemo(() => {
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= todayStart).reduce((s, i) => s + i.totalTTC, 0);
    const saleRev = sales.filter(s => s.status === 'paid' && s.createdAt >= todayStart && (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))).reduce((s2, sale) => s2 + sale.totalTTC, 0);
    return invRev + saleRev;
  }, [invoices, sales, todayStart, paidInvoiceIds]);

  const todaySalesCount = useMemo(() =>
    sales.filter(s => s.status === 'paid' && s.createdAt >= todayStart).length +
    invoices.filter(i => i.status === 'paid' && i.issueDate >= todayStart).length,
    [sales, invoices, todayStart]
  );

  const paidSalesNotInvoiced = useMemo(() =>
    sales.filter(s =>
      s.status === 'paid' && s.createdAt >= periodStart &&
      (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))
    ), [sales, paidInvoiceIds, periodStart]
  );

  const monthlyRevenue = useMemo(() => {
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= periodStart).reduce((s, i) => s + i.totalTTC, 0);
    const salesRev = paidSalesNotInvoiced.reduce((s, sale) => s + sale.totalTTC, 0);
    return invRev + salesRev;
  }, [invoices, periodStart, paidSalesNotInvoiced]);

  const prevRevenue = useMemo(() => {
    const pStart = prevPeriod.start.toISOString();
    const pEnd = prevPeriod.end.toISOString();
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= pStart && i.issueDate < pEnd).reduce((s, i) => s + i.totalTTC, 0);
    const sRev = sales.filter(s => s.status === 'paid' && s.createdAt >= pStart && s.createdAt < pEnd && (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))).reduce((s, sale) => s + sale.totalTTC, 0);
    return invRev + sRev;
  }, [invoices, sales, prevPeriod, paidInvoiceIds]);

  const revenueChange = useMemo(() => {
    if (prevRevenue === 0) return monthlyRevenue > 0 ? 100 : 0;
    return ((monthlyRevenue - prevRevenue) / prevRevenue) * 100;
  }, [monthlyRevenue, prevRevenue]);

  const monthlyExpenses = useMemo(() => {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const supplierExp = activeSupplierInvoices.filter(si => si.date >= periodStart && si.date < end).reduce((s, si) => s + (si.total || 0), 0);
    const cashExp = cashMovements.filter(cm => cm.type === 'expense' && cm.date >= periodStart && cm.date < end && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
    return supplierExp + cashExp;
  }, [activeSupplierInvoices, cashMovements, now, periodStart]);

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
    return supplierExp + cashExp;
  }, [activeSupplierInvoices, cashMovements, prevPeriod]);

  const prevGrossMargin = prevRevenue - prevExpenses;

  const salesCountChange = useMemo(() => {
    if (prevSalesCount === 0) return paidSalesCount > 0 ? 100 : 0;
    return ((paidSalesCount - prevSalesCount) / prevSalesCount) * 100;
  }, [paidSalesCount, prevSalesCount]);

  const marginChange = useMemo(() => {
    if (prevGrossMargin === 0) return grossMargin > 0 ? 100 : grossMargin < 0 ? -100 : 0;
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

  const periodChartMax = useMemo(() => Math.max(...periodChartData.map(w => w.revenue), 1), [periodChartData]);
  const hasPeriodChartData = periodChartData.some(w => w.revenue > 0);

  const periodChartTitle = useMemo(() => {
    const base = period === 'today' ? t('dashboard.todayRevenue')
      : period === 'week' ? t('dashboard.thisWeek')
      : period === 'month' ? t('dashboard.weeklyRevenue')
      : period === 'quarter' ? t('dashboard.thisQuarter')
      : t('dashboard.thisYear');
    if (selectedCategory) return `${base} — ${selectedCategory}`;
    return base;
  }, [period, t, selectedCategory]);

  const periodChartSubtitle = useMemo(() => {
    if (period === 'today') return t('dashboard.periodDaily');
    if (period === 'week') return t('dashboard.periodDaily');
    if (period === 'month') return t('dashboard.periodWeekly');
    if (period === 'quarter') return t('dashboard.periodMonthly');
    return t('dashboard.periodMonthly');
  }, [period, t]);

  /** 5 dernieres ventes toutes sources confondues */
  const recentSales = useMemo(() => {
    const allSales = [
      ...sales.map(s => ({
        id: s.id, date: s.createdAt, client: s.clientName || 'Client comptoir', amount: s.totalTTC, status: s.status as string, paymentMethod: s.paymentMethod,
        items: s.items, totalHT: s.totalHT, totalTVA: s.totalTVA, clientId: s.clientId,
      })),
      ...invoices.filter(i => i.status === 'paid').map(i => ({
        id: i.id, date: i.issueDate, client: i.clientName, amount: i.totalTTC, status: 'paid', paymentMethod: 'transfer' as const,
        items: i.items, totalHT: i.totalHT, totalTVA: i.totalTVA, clientId: i.clientId,
      })),
    ];
    return allSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [sales, invoices]);

  const recentSalesMax = useMemo(() =>
    recentSales.length === 0 ? 1 : Math.max(...recentSales.map(s => s.amount), 1),
    [recentSales]
  );

  /** Donut repartition ventes par categorie produit */
  const categoryBreakdown = useMemo((): DonutSegment[] => {
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

    /** Détail des ventes par catégorie - pour l'expansion dans la légende */
  interface VariantDetail {
    variantId: string;
    attributes: Record<string, string>;
    attributeLabel: string;
  }

  interface VariantSaleDetail {
    variantId: string;
    attributeLabel: string;
    quantity: number;
    totalTTC: number;
    unitPrice?: number;
  }

  interface ProductSaleDetail {
    productId: string;
    productName: string;
    quantity: number;
    totalTTC: number;
    attributes: string;
    unitPrice?: number;
    totalHT?: number;
    totalTVA?: number;
    variants: VariantDetail[];
    variantSales: VariantSaleDetail[];
  }

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

const salesDetailsByCategory = useMemo(() => {
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
      return { label, revenue: invRev + saleRev, expenses: exp + cashExp, margin: invRev + saleRev - exp - cashExp };
    });
  }, [invoices, sales, activeSupplierInvoices, cashMovements, now]);

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
    return Array.from(catMap.entries())
      .map(([label, { revenue, cost }], idx) => ({ label, value: revenue - cost, color: DONUT_PALETTE[idx % DONUT_PALETTE.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sales, invoices, activeProducts, periodStart]);

  /** Heatmap activite par jour de semaine — nombre de ventes par tranche horaire */
  const weekHeatmapData = useMemo(() => {
    // 7 jours x 4 tranches : matin (6-12h), midi (12-14h), apres-midi (14-18h), soir (18-24h)
    const matrix: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    const allSalesItems = [
      ...sales.filter(s => s.status === 'paid').map(s => s.createdAt),
      ...invoices.filter(i => i.status === 'paid').map(i => i.issueDate),
    ];
    for (const dateStr of allSalesItems) {
      const d = new Date(dateStr);
      const dayIdx = (d.getDay() + 6) % 7; // Lundi = 0
      const h = d.getHours();
      const slotIdx = h < 12 ? 0 : h < 14 ? 1 : h < 18 ? 2 : 3;
      matrix[dayIdx][slotIdx]++;
    }
    return matrix;
  }, [sales, invoices]);

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
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; qty: number; ca: number }>();
    const record = (id: string, name: string, qty: number, total: number) => {
      const ex = productMap.get(id) || { name, qty: 0, ca: 0 };
      ex.qty += qty; ex.ca += total;
      productMap.set(id, ex);
    };
    sales.filter(s => s.status === 'paid').forEach(s => s.items.forEach(i => record(i.productId, i.productName, i.quantity, i.totalTTC)));
    invoices.filter(i => i.status === 'paid').forEach(inv => inv.items.forEach(i => record(i.productId, i.productName, i.quantity, i.totalTTC)));
    return Array.from(productMap.values()).sort((a, b) => b.ca - a.ca).slice(0, 5);
  }, [sales, invoices]);

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
  const totalDecaissements = useMemo(() =>
    paidSupplierInvoicesTreasury.reduce((s, si) => s + (si.total || 0), 0) + refundedSalesTreasury.reduce((s, sale) => s + sale.totalTTC, 0),
    [paidSupplierInvoicesTreasury, refundedSalesTreasury]
  );

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
      runningBalance += (enc + saleEnc) - dec;
      return runningBalance;
    });
  }, [invoices, sales, activeSupplierInvoices, now]);

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
      return { month: label, enc: enc + saleEnc, dec: dec + refDec };
    });
  }, [invoices, activeSupplierInvoices, sales, now]);

  const treasuryMax = useMemo(() =>
    Math.max(...treasuryMonthlyData.flatMap(m => [m.enc, m.dec]), 1),
    [treasuryMonthlyData]
  );

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

  const allMovements = useMemo((): RealMovement[] => {
    const moves: RealMovement[] = [];
    for (const inv of paidInvoicesTreasury) moves.push({ id: `inv-${inv.id}`, type: 'income', amount: inv.totalTTC, description: `Facture ${inv.invoiceNumber} \u2014 ${clientMap[inv.clientId] || inv.clientName}`, date: inv.issueDate, source: 'Facture client' });
    for (const sale of salesNotFromInvoicesTreasury) moves.push({ id: `sale-${sale.id}`, type: 'income', amount: sale.totalTTC, description: `Vente ${sale.saleNumber}${sale.clientName ? ` \u2014 ${sale.clientName}` : ''}`, date: sale.createdAt, source: 'Vente comptoir' });
    for (const sale of refundedSalesTreasury) moves.push({ id: `refund-${sale.id}`, type: 'expense', amount: sale.totalTTC, description: `Remboursement ${sale.saleNumber}`, date: sale.refundedAt || sale.createdAt, source: 'Remboursement' });
    for (const si of paidSupplierInvoicesTreasury) moves.push({ id: `si-${si.id}`, type: 'expense', amount: si.total || 0, description: `Facture ${si.number} \u2014 ${si.supplierName || 'Fournisseur'}`, date: si.date, source: 'Facture fournisseur' });
    moves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return moves;
  }, [paidInvoicesTreasury, paidSupplierInvoicesTreasury, clientMap, salesNotFromInvoicesTreasury, refundedSalesTreasury]);

  const filteredMovements = useMemo(() =>
    movementFilter === 'all' ? allMovements : allMovements.filter(m => m.type === movementFilter),
    [allMovements, movementFilter]
  );

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

  const handleExportSalesReport = useCallback(async () => {
    const periodLabels: Record<PeriodFilter, string> = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette annee' };
    const html = generateSalesReportHTML({ company, sales, invoices, clients, periodLabel: periodLabels[period], currency: cur });
    await generateAndSharePDF(html, `Rapport_Ventes_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, sales, invoices, clients, period, cur]);

  const handleExportStockReport = useCallback(async () => {
    const html = generateStockReportHTML({ company, products: activeProducts, currency: cur });
    await generateAndSharePDF(html, `Rapport_Stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, cur, activeProducts]);

  const handleExportFinancialReport = useCallback(async () => {
    const periodLabels: Record<PeriodFilter, string> = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette annee' };
    const html = generateFinancialReportHTML({ company, revenue: monthlyRevenue, expenses: monthlyExpenses, unpaidAmount, periodLabel: periodLabels[period], currency: cur });
    await generateAndSharePDF(html, `Rapport_Financier_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, monthlyRevenue, monthlyExpenses, unpaidAmount, period, cur]);

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
  const renderActionCards = () => {
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
      <View style={styles.emptyChart}>
        <FileText size={28} color={colors.textTertiary} />
        <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.noSalesYet')}</Text>
        <Text style={[styles.emptyChartHint, { color: colors.textTertiary }]}>Les ventes apparaitront ici des que vous aurez enregistre une transaction.</Text>
      </View>
    ) : (
      <View style={styles.recentSalesList}>
        {recentSales.map((sale, idx) => {
          const progress = recentSalesMax > 0 ? sale.amount / recentSalesMax : 0;
          const PaymentIcon = PAYMENT_ICONS[sale.paymentMethod] || CreditCard;
          const isExpanded = expandedSaleId === sale.id;
          const clientData = sale.clientId ? clients.find(c => c.id === sale.clientId) : null;

          return (
            <View key={sale.id + idx}>
              <TouchableOpacity
                onPress={() => toggleSaleExpand(sale.id)}
                activeOpacity={0.7}
                style={[styles.saleRow, !isExpanded && idx < recentSales.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
              >
                <View style={[styles.saleProgressStrip, { backgroundColor: colors.primary + '08' }]}>
                  <View style={[styles.saleProgressFill, { backgroundColor: colors.primary + '30', width: `${progress * 100}%` as `${number}%` }]} />
                </View>
                <View style={styles.saleRowContent}>
                  <View style={styles.saleRowLeft}>
                    <ClientAvatar name={sale.client} size={32} />
                    <View style={styles.saleInfo}>
                      <Text style={[styles.saleClient, { color: colors.text }]} numberOfLines={1}>{sale.client}</Text>
                      <View style={styles.saleMeta}>
                        <Text style={[styles.saleDate, { color: colors.textTertiary }]}>{formatDate(sale.date)}</Text>
                        <StatusBadge status={sale.status} />
                        <View style={[styles.paymentIconWrap, { backgroundColor: colors.primaryLight }]}>
                          <PaymentIcon size={11} color={colors.primary} />
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.SM }}>
                    <Text style={[styles.saleAmount, { color: colors.primary }]}>{formatCurrency(sale.amount, cur)}</Text>
                    <ChevronRight size={14} color={colors.textTertiary} style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }} />
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
                      <Text style={[styles.saleDetailTotalValue, { color: colors.primary }]}>{formatCurrency(sale.amount, cur)}</Text>
                    </View>
                  </View>
                </View>
              )}
              {isExpanded && idx < recentSales.length - 1 && (
                <View style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }} />
              )}
            </View>
          );
        })}
      </View>
    )
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET VUE D'ENSEMBLE
  // ─────────────────────────────────────────────────────────────────────────

  const renderOverviewTab = () => (
    <>
      {/* Today banner + Objectif CA side by side */}
      <View style={[styles.todayAndTargetRow, isMobile && styles.todayAndTargetRowMobile && styles.kpiRowCompact]}>
        {renderTodayBanner()}
        <View style={[styles.card, styles.targetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <ProgressGauge
            current={monthlyRevenue}
            target={DEFAULT_MONTHLY_TARGET}
            color={colors.primary}
            bgColor={colors.borderLight}
            label="Objectif CA mensuel"
            formatValue={(v) => formatCurrencyInteger(v, cur)}
            textColor={colors.text}
            subtextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.kpiRowCompact}>
        <KPICard
          title={t('dashboard.monthlyRevenue')}
          value={formatCurrencyInteger(monthlyRevenue, cur)}
          change={Math.round(revenueChange * 10) / 10}
          icon={<TrendingUp size={15} color={colors.primary} />}
          onPress={() => router.push('/ventes')}
          sparklineData={revenueSparkline}
          sparklineColor={colors.primary}
        />
        <KPICard
          title={t('dashboard.grossProfit')}
          value={formatCurrencyInteger(grossMargin, cur)}
          icon={<Target size={15} color={grossMargin >= 0 ? '#059669' : '#DC2626'} />}
          accentColor={grossMargin >= 0 ? '#059669' : '#DC2626'}
          sparklineData={marginEvolution.map(m => m.margin)}
          sparklineColor={grossMargin >= 0 ? '#059669' : '#DC2626'}
        />
        <KPICard
          title={t('dashboard.salesNumber')}
          value={String(paidSalesCount)}
          icon={<ShoppingCart size={15} color="#7C3AED" />}
          accentColor="#7C3AED"
          onPress={() => router.push('/ventes')}
          sparklineData={salesSparkline}
          sparklineColor="#7C3AED"
        />
        <KPICard
          title={t('dashboard.unpaidAmount')}
          value={formatCurrencyInteger(unpaidAmount, cur)}
          icon={<Clock size={15} color="#D97706" />}
          accentColor="#D97706"
          onPress={() => router.push('/ventes')}
        />
      </View>
      </View>
      
      {renderActionCards()}



      {selectedCategory && (
        <TouchableOpacity
          style={[styles.categoryFilterBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
          onPress={() => { setSelectedCategory(null); setDonutCollapseFlag(prev => !prev); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.categoryFilterText, { color: colors.primary }]}>
            {t('dashboard.filterByCategory', { category: selectedCategory })}
          </Text>
          <Text style={[styles.categoryFilterClear, { color: colors.primary }]}>{t('dashboard.clearFilter')}</Text>
        </TouchableOpacity>
      )}

      {/* Graphique CA adaptatif + Donut categories */}
      <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{periodChartTitle}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>{periodChartSubtitle}</Text>
            </View>
          </View>
          {!hasPeriodChartData ? (
            <View style={styles.emptyChart}>
              <BarChart3 size={28} color={colors.textTertiary} />
              <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.dataAfterSales')}</Text>
            </View>
          ) : (
            <ScrollView horizontal={periodChartData.length > 8} showsHorizontalScrollIndicator={false}>
              <View style={[styles.barChartArea, periodChartData.length > 8 && { minWidth: periodChartData.length * 52 }]}>
                <View style={styles.barChartBars}>
                  {periodChartData.map((w: { label: string; revenue: number; isCurrent: boolean }, idx: number) => {
                    const h = periodChartMax > 0 ? Math.max((w.revenue / periodChartMax) * 140, w.revenue > 0 ? 8 : 0) : 0;
                    return (
                      <View key={idx} style={styles.barCol}>
                        <View style={styles.barValueWrap}>
                          {w.revenue > 0 && <Text style={[styles.barValueText, { color: colors.primary }]}>{formatCurrencyInteger(w.revenue, cur)}</Text>}
                        </View>
                        {w.revenue > 0 ? (
                          <View style={[styles.bar, { height: h, backgroundColor: colors.primary, opacity: w.isCurrent ? 1 : 0.55, borderRadius: RADIUS.XS }]} />
                        ) : (
                          <View style={[styles.barDashed, { borderColor: colors.borderLight }]} />
                        )}
                        <Text style={[styles.barXLabel, { color: w.isCurrent ? colors.primary : colors.textTertiary, fontWeight: w.isCurrent ? '700' : '500' as const }]}>
                          {w.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        {/* Donut repartition par categorie */}
        {categoryBreakdown.length > 0 ? (
          <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.salesByCategory')}</Text>
            <DonutChart
              key={`donut-${period}`}
              segments={categoryBreakdown}
              size={isMobile ? 160 : 180}
              strokeWidth={isMobile ? 24 : 30}
              showLegend={true}
              legendPosition="right"
              centerValue={formatCurrencyInteger(categoryBreakdown.reduce((s, seg) => s + seg.value, 0), cur)}
              centerLabel={cur}
              currency={cur}
              selectedSegmentLabel={selectedCategory}
              collapseAll={donutCollapseFlag}
              onSegmentPress={(segment) => {
                setSelectedCategory(prev => prev === segment.label ? null : segment.label);
              }}
              renderExpandedContent={(segment) => {
                const products: ProductSaleDetail[] = salesDetailsByCategory.get(segment.label) || [];
                if (products.length === 0) {
                  return (
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                      {t('dashboard.noCategoryProducts')}
                    </Text>
                  );
                }
                return (
                  <View style={styles.categoryDetailList}>
                    {products.map((product, pIdx) => (
                      <View key={product.productId || pIdx}>
                        <View style={styles.categoryDetailRow}>
                          <View style={styles.categoryDetailLeft}>
                            <Text style={[styles.categoryDetailName, { color: colors.text }]} numberOfLines={1}>
                              {product.productName}
                            </Text>
                            <Text style={[styles.categoryDetailQty, { color: colors.textTertiary }]}>
                              {t('dashboard.units', { count: product.quantity })}
                            </Text>
                          </View>
                          <Text style={[styles.categoryDetailAmount, { color: segment.color, fontWeight: 'bold' as const }]}>
                            {formatCurrency(product.totalTTC, cur)}
                          </Text>
                        </View>
                        {product.variantSales.length > 0 && (
                          <View style={styles.variantSalesList}>
                            {product.variantSales.sort((a, b) => b.totalTTC - a.totalTTC).map((vs) => (
                              <View key={vs.variantId} style={styles.variantSaleRow}>
                                <View style={[styles.variantSaleDot, { backgroundColor: segment.color + '40' }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.variantSaleLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {vs.attributeLabel || 'Variante'}
                                  </Text>
                                  <Text style={[styles.variantSaleQty, { color: colors.textTertiary }]}>
                                    {t('dashboard.units', { count: vs.quantity })}
                                  </Text>
                                </View>
                                <Text style={[styles.variantSaleAmount, { color: segment.color }]}>
                                  {formatCurrency(vs.totalTTC, cur)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                );
              }}
            />
          </View>
        ) : (
          <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.salesByCategory')}</Text>
            <View style={styles.emptyChart}>
              <PieChart size={28} color={colors.textTertiary} />
              <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.dataAfterSales')}</Text>
            </View>
          </View>
        )}
      </View>

      {/* 5 dernieres ventes */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.recentSales')}</Text>
          <TouchableOpacity onPress={() => router.push('/ventes')} activeOpacity={0.7}>
            <Text style={[styles.viewAllLink, { color: colors.primary }]}>{t('dashboard.viewAll')}</Text>
          </TouchableOpacity>
        </View>
        {renderRecentSalesList(true)}
      </View>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET ANALYSE
  // ─────────────────────────────────────────────────────────────────────────

  const renderAnalysisTab = () => (
    <>
      {/* Exports PDF */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('reports.exportPDF')}</Text>
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

      {/* Comparaison avec periode precedente */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.comparisonPrevious')}</Text>
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
              <View style={[styles.comparisonBadge, { backgroundColor: change >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
                {change >= 0 ? <ArrowUpRight size={12} color="#059669" /> : <ArrowDownRight size={12} color="#DC2626" />}
                <Text style={{ fontSize: 11, fontWeight: '700', color: change >= 0 ? '#059669' : '#DC2626' }}>{change >= 0 ? '+' : ''}{Math.round(change)}%</Text>
              </View>
              <View style={styles.comparisonSparkline}>
                <SparklineChart data={sparkline} color={change >= 0 ? '#059669' : '#DC2626'} width={90} height={22} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Area chart CA vs Depenses 6 mois */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>CA vs Depenses</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>{t('dashboard.last6Months')}</Text>
          </View>
          <LegendRow
            items={[
              { color: '#6366F1', label: 'CA' },
              { color: '#EF4444', label: 'Depenses' },
            ]}
            textColor={colors.textSecondary}
          />
        </View>
        {sixMonthsData.every(m => m.revenue === 0 && m.expenses === 0) ? (
          <View style={styles.emptyChart}>
            <TrendingUp size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>Aucune donnee disponible pour cette periode.</Text>
          </View>
        ) : (
          <AreaChart
            revenueData={sixMonthsData.map(m => m.revenue)}
            expensesData={sixMonthsData.map(m => m.expenses)}
            labels={sixMonthsData.map(m => m.label)}
            width={isMobile ? width - 80 : 460}
            height={180}
            colorRevenue="#6366F1"
            colorExpenses="#EF4444"
            textColor={colors.textTertiary}
          />
        )}
      </View>

      {/* Bar chart horizontal Marge par categorie + Donut clients */}
      <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Marge par categorie</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Periode selectionnee</Text>
          <View style={{ marginTop: SPACING.LG }}>
            {marginByCategory.length === 0 ? (
              <View style={styles.emptyChart}>
                <BarChart3 size={24} color={colors.textTertiary} />
                <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>Aucune donnee</Text>
              </View>
            ) : (
              <HorizontalBarChart
                data={marginByCategory}
                width={isMobile ? width - 80 : 220}
                textColor={colors.textSecondary}
                valueColor={colors.text}
              />
            )}
          </View>
        </View>

        {/* Donut Nouveaux vs Recurrents */}
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.LG }}>
            <Users size={16} color="#6366F1" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Clients</Text>
          </View>
          {clientRecurrence.newCount === 0 && clientRecurrence.recurringCount === 0 ? (
            <View style={styles.emptyChart}>
              <Users size={28} color={colors.textTertiary} />
              <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>Aucun client enregistre</Text>
            </View>
          ) : (
            <ClientDonut
              newCount={clientRecurrence.newCount}
              recurringCount={clientRecurrence.recurringCount}
              colorNew="#6366F1"
              colorRecurring="#10B981"
              textColor={colors.text}
              labelColor={colors.textSecondary}
            />
          )}
        </View>
      </View>

      {/* Heatmap jours de la semaine */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Activite par jour</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Jours les plus actifs en ventes</Text>
          </View>
        </View>
        {weekHeatmapData.every(row => row.every(v => v === 0)) ? (
          <View style={styles.emptyChart}>
            <BarChart3 size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>Aucune vente enregistree</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <WeekHeatmap
              data={weekHeatmapData}
              primaryColor={colors.primary}
              textColor={colors.textSecondary}
              bgColor={colors.borderLight}
            />
          </ScrollView>
        )}
      </View>

      {/* Top 5 produits */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.topProducts')}</Text>
        {topProducts.length === 0 ? (
          <View style={styles.emptyChart}>
            <Package size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.noSalesRecorded')}</Text>
          </View>
        ) : (
          <View style={styles.tableContent}>
            <View style={[styles.tableRowHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 2 }]}>{t('dashboard.product')}</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.7, textAlign: 'center' }]}>{t('dashboard.qty')}</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1.2, textAlign: 'right' }]}>{t('dashboard.revenueGenerated')}</Text>
            </View>
            {topProducts.map((p, idx) => (
              <View key={idx} style={[styles.tableRow, idx < topProducts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? '#FEF3C7' : idx === 1 ? '#F3F4F6' : idx === 2 ? '#FDE68A' : colors.borderLight }]}>
                    <Text style={[styles.rankText, { color: idx < 3 ? '#92400E' : colors.textTertiary }]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.cellBold, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                </View>
                <Text style={[styles.cellText, { color: colors.textSecondary, flex: 0.7, textAlign: 'center' }]}>{p.qty}</Text>
                <Text style={[styles.cellBold, { color: colors.primary, flex: 1.2, textAlign: 'right' }]}>{formatCurrencyInteger(p.ca, cur)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET TRESORERIE
  // ─────────────────────────────────────────────────────────────────────────

  const renderTreasuryTab = () => (
    <>
      {/* KPIs tresorerie */}
      <View style={[styles.kpiRow, isMobile && styles.kpiRowMobile]}>
        <KPICard
          title={t('dashboard.balance')}
          value={formatCurrencyInteger(cashBalance, cur)}
          icon={<Wallet size={16} color={cashBalance >= 0 ? colors.success : colors.danger} />}
          accentColor={cashBalance >= 0 ? '#059669' : '#DC2626'}
          sparklineData={treasurySparkline}
          sparklineColor={cashBalance >= 0 ? '#059669' : '#DC2626'}
        />
        <KPICard
          title={t('dashboard.collections')}
          value={formatCurrencyInteger(totalEncaissements, cur)}
          icon={<ArrowUpRight size={16} color={colors.success} />}
          accentColor="#059669"
        />
        <KPICard
          title={t('dashboard.disbursements')}
          value={formatCurrencyInteger(totalDecaissements, cur)}
          icon={<ArrowDownRight size={16} color={colors.danger} />}
          accentColor="#DC2626"
        />
      </View>

      {/* Line chart evolution du solde + Donut ratio encaissements/decaissements */}
      <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
        {/* Line chart solde 6 mois */}
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Evolution du solde</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>{t('dashboard.last6Months')}</Text>
          {treasurySparkline.every(v => v === 0) ? (
            <View style={styles.emptyChart}>
              <TrendingUp size={28} color={colors.textTertiary} />
              <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>Aucun mouvement enregistre</Text>
            </View>
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

        {/* Donut ratio encaissements / decaissements */}
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Ratio flux</Text>
          {totalEncaissements === 0 && totalDecaissements === 0 ? (
            <View style={styles.emptyChart}>
              <PieChart size={28} color={colors.textTertiary} />
              <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>Aucun flux sur la periode</Text>
            </View>
          ) : (
            <>
              <View style={styles.donutContainer}>
                <DonutChart
                  segments={[
                    { label: t('dashboard.income'), value: totalEncaissements, color: '#059669' },
                    { label: t('dashboard.expenses'), value: totalDecaissements, color: '#EF4444' },
                  ]}
                  size={isMobile ? 100 : 120}
                  strokeWidth={18}
                  showLegend={true}
                  centerValue={`${Math.round(totalEncaissements / (totalEncaissements + totalDecaissements || 1) * 100)}%`}
                  centerLabel="entrees"
                />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Graphique entrees/sorties mensuelles stacked bars */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.cashFlow')}</Text>
          <LegendRow
            items={[
              { color: '#059669', label: t('dashboard.income') },
              { color: '#E84D3D', label: t('dashboard.expenses') },
            ]}
            textColor={colors.textSecondary}
          />
        </View>
        <View style={styles.stackedBarArea}>
          {treasuryMonthlyData.map((item, idx) => {
            const encH = treasuryMax > 0 ? Math.max((item.enc / treasuryMax) * 120, item.enc > 0 ? 6 : 0) : 0;
            const decH = treasuryMax > 0 ? Math.max((item.dec / treasuryMax) * 120, item.dec > 0 ? 6 : 0) : 0;
            return (
              <View key={idx} style={styles.stackedBarCol}>
                <View style={styles.stackedBarPair}>
                  <View style={[styles.stackedBar, { height: encH, backgroundColor: '#059669' }]} />
                  <View style={[styles.stackedBar, { height: decH, backgroundColor: '#E84D3D' }]} />
                </View>
                <Text style={[styles.barXLabel, { color: colors.textTertiary }]}>{item.month}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Projection tresorerie basee sur factures en attente */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Projection tresorerie</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Base sur factures en attente</Text>
          </View>
          <LegendRow
            items={[
              { color: '#059669', label: 'Reel' },
              { color: '#6366F1', label: 'Projete' },
            ]}
            textColor={colors.textSecondary}
          />
        </View>
        <ProjectionBars
          data={projectionData}
          width={isMobile ? width - 80 : 460}
          height={140}
          colorActual="#059669"
          colorProjected="#6366F1"
          textColor={colors.textSecondary}
        />
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
              <View style={styles.emptyChart}>
                <Inbox size={28} color={colors.textTertiary} />
                <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.noMovements')}</Text>
              </View>
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
        <KPICard title={t('dashboard.monthlyRevenue')} value={formatCurrencyInteger(monthlyRevenue, cur)} change={Math.round(revenueChange * 10) / 10} icon={<TrendingUp size={16} color={colors.primary} />} sparklineData={revenueSparkline} sparklineColor={colors.primary} />
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
      <PageHeader title={t('dashboard.title')} />
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
  targetCard: { flex: 1 },
  todayBanner: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XL, position: 'relative', overflow: 'hidden', flex: 1 },
  todayAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: RADIUS.XL, borderBottomLeftRadius: RADIUS.XL },
  todayBannerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayLabel: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM, marginBottom: SPACING.XXS },
  todayAmount: { fontSize: 26, fontWeight: '800', letterSpacing: TYPOGRAPHY.LETTER_SPACING.TIGHT },
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
});
