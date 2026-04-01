/**
 * @fileoverview Tableau de bord principal de l'application HaziOne.
 * Structure en 3 onglets : Vue d'ensemble, Analyse, Trésorerie.
 * Données mockées réalistes en FCFA. Composants KPI réutilisables.
 * Sélecteur de période en haut à droite.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
  TouchableOpacity, Platform, Share, Alert,
} from 'react-native';
import {
  FileText, Clock, ArrowUpRight, ArrowDownRight,
  Wallet, Target, AlertTriangle, Package, Truck,
  TrendingUp, BarChart3, Inbox, Download,
  ShoppingCart, PieChart, CheckCircle, ChevronRight, CloudOff, RefreshCw,
  MessageSquare,
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
import { useI18n } from '@/contexts/I18nContext';

type DashboardTab = 'overview' | 'analysis' | 'treasury';
type PeriodFilter = 'today' | 'month' | 'quarter' | 'year';
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
  { key: 'month', labelKey: 'dashboard.thisMonth' },
  { key: 'quarter', labelKey: 'dashboard.thisQuarter' },
  { key: 'year', labelKey: 'dashboard.thisYear' },
];

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
  if (period === 'month') return new Date(y, m, 1);
  if (period === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    return new Date(y, qStart, 1);
  }
  return new Date(y, 0, 1);
}

function getPreviousPeriodRange(now: Date, period: PeriodFilter): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'today') {
    const yesterday = new Date(y, m, now.getDate() - 1);
    return { start: yesterday, end: new Date(y, m, now.getDate()) };
  }
  if (period === 'month') {
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
  }
  if (period === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    return { start: new Date(y, qStart - 3, 1), end: new Date(y, qStart, 1) };
  }
  return { start: new Date(y - 1, 0, 1), end: new Date(y, 0, 1) };
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user } = useAuth();
  const { t, locale } = useI18n();

  const {
    invoices, lowStockProducts, activeProducts,
    activeSupplierInvoices, cashMovements, sales, company, clients,
    activePurchaseOrders,
  } = useData();

  const cur = company.currency || 'XOF';
  const { pendingSalesCount, isOnline, isSyncing } = useOffline();

  const now = useMemo(() => new Date(), []);
  const firstName = useMemo(() => extractFirstName(user), [user]);
  const greeting = firstName ? `${t('dashboard.greeting')} ${firstName} 👋` : `${t('dashboard.greeting')} 👋`;
  const todayStr = useMemo(() => {
    const loc = locale === 'en' ? 'en-US' : 'fr-FR';
    return now.toLocaleDateString(loc, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).replace(/^\w/, (c) => c.toUpperCase());
  }, [now, locale]);

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');
  const [showMovements, setShowMovements] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { simplifiedDashboard } = useRole();

  const periodStart = useMemo(() => getPeriodStart(now, period).toISOString(), [now, period]);
  const prevPeriod = useMemo(() => getPreviousPeriodRange(now, period), [now, period]);

  // ====== CALCULS COMMUNS ======

  const paidInvoiceIds = useMemo(() =>
    new Set(invoices.filter(i => i.status === 'paid').map(i => i.id)), [invoices]
  );

  // ====== CA DU JOUR ======
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



  // ====== VUE D'ENSEMBLE : CA par semaine (8 dernières semaines) ======
  const weeklyData = useMemo(() => {
    const weeks: { label: string; revenue: number }[] = [];
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    for (let w = 7; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (w * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const sISO = weekStart.toISOString();
      const eISO = weekEnd.toISOString();
      const label = `S${52 - w <= 0 ? 52 + (52 - w) : Math.ceil((weekEnd.getTime() - new Date(weekEnd.getFullYear(), 0, 1).getTime()) / (7 * 86400000))}`;
      const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= sISO && i.issueDate < eISO).reduce((s2, i) => s2 + i.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      weeks.push({ label, revenue: invRev + saleRev });
    }
    return weeks;
  }, [invoices, sales, now]);

  const weeklyMax = useMemo(() => Math.max(...weeklyData.map(w => w.revenue), 1), [weeklyData]);
  const hasWeeklyData = weeklyData.some(w => w.revenue > 0);

  // 5 dernières ventes
  const recentSales = useMemo(() => {
    const allSales = [
      ...sales.map(s => ({ id: s.id, date: s.createdAt, client: s.clientName || 'Client comptoir', amount: s.totalTTC, status: s.status as string })),
      ...invoices.filter(i => i.status === 'paid').map(i => ({ id: i.id, date: i.issueDate, client: i.clientName, amount: i.totalTTC, status: 'paid' })),
    ];
    return allSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [sales, invoices]);

  // Évolution bénéfice brut 6 derniers mois
  const marginEvolution = useMemo(() => {
    const months: { label: string; margin: number }[] = [];
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const dISO = d.toISOString();
      const eISO = end.toISOString();
      const invRev = invoices.filter(inv => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < eISO).reduce((s2, inv) => s2 + inv.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= dISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      const exp = activeSupplierInvoices.filter(si => si.date >= dISO && si.date < eISO).reduce((s2, si) => s2 + (si.total || 0), 0);
      const cashExp = cashMovements.filter(cm => cm.type === 'expense' && cm.date >= dISO && cm.date < eISO && !cm.sourceType).reduce((s2, cm) => s2 + cm.amount, 0);
      months.push({ label, margin: invRev + saleRev - exp - cashExp });
    }
    return months;
  }, [invoices, sales, activeSupplierInvoices, cashMovements, now]);

  const marginMax = useMemo(() => {
    const vals = marginEvolution.map(m => Math.abs(m.margin));
    return Math.max(...vals, 1);
  }, [marginEvolution]);

  // Top 5 produits vendus
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; qty: number; ca: number }>();
    for (const sale of sales.filter(s => s.status === 'paid')) {
      for (const item of sale.items) {
        const existing = productMap.get(item.productId) || { name: item.productName, qty: 0, ca: 0 };
        existing.qty += item.quantity;
        existing.ca += item.totalTTC;
        productMap.set(item.productId, existing);
      }
    }
    for (const inv of invoices.filter(i => i.status === 'paid')) {
      for (const item of inv.items) {
        const existing = productMap.get(item.productId) || { name: item.productName, qty: 0, ca: 0 };
        existing.qty += item.quantity;
        existing.ca += item.totalTTC;
        productMap.set(item.productId, existing);
      }
    }
    return Array.from(productMap.values()).sort((a, b) => b.ca - a.ca).slice(0, 5);
  }, [sales, invoices]);

  // ====== TRÉSORERIE ======

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clients) map[c.id] = c.companyName || `${c.firstName} ${c.lastName}`;
    return map;
  }, [clients]);

  const treasuryPeriodStart = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 6);
    return d;
  }, [now]);

  const cashBalance = useMemo(() => {
    if (cashMovements.length === 0) return 0;
    return cashMovements.reduce((bal, cm) => cm.type === 'income' ? bal + cm.amount : bal - cm.amount, 0);
  }, [cashMovements]);

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


  // Flux trésorerie 6 mois
  const treasuryMonthlyData = useMemo(() => {
    const months: { month: string; enc: number; dec: number }[] = [];
    const convertedIds = new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!));
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const enc = invoices.filter(inv => inv.status === 'paid' && new Date(inv.issueDate) >= d && new Date(inv.issueDate) < end).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleEnc = sales.filter(s2 => s2.status === 'paid' && new Date(s2.createdAt) >= d && new Date(s2.createdAt) < end && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      const dec = activeSupplierInvoices.filter(si => si.status === 'paid' && new Date(si.date) >= d && new Date(si.date) < end).reduce((s, si) => s + (si.total || 0), 0);
      const refDec = sales.filter(s2 => s2.status === 'refunded' && s2.refundedAt && new Date(s2.refundedAt) >= d && new Date(s2.refundedAt) < end).reduce((s, sale) => s + sale.totalTTC, 0);
      months.push({ month: label, enc: enc + saleEnc, dec: dec + refDec });
    }
    return months;
  }, [invoices, activeSupplierInvoices, sales, now]);

  const treasuryMax = useMemo(() => {
    const all = treasuryMonthlyData.flatMap(m => [m.enc, m.dec]);
    return Math.max(...all, 1);
  }, [treasuryMonthlyData]);

  // Factures clients en retard
  const lateClientInvoices = useMemo(() =>
    invoices.filter(i => i.status === 'late' || (i.status === 'sent' && new Date(i.dueDate) < now))
      .map(i => {
        const daysLate = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
        return { id: i.id, client: i.clientName, amount: i.totalTTC - i.paidAmount, daysLate: Math.max(0, daysLate) };
      })
      .sort((a, b) => b.daysLate - a.daysLate)
      .slice(0, 5),
    [invoices, now]
  );

  // Fournisseurs à payer
  const suppliersDue = useMemo(() =>
    supplierInvoicesToPay.map(si => ({
      id: si.id,
      supplier: si.supplierName || 'Fournisseur',
      amount: si.total || si.subtotal || 0,
      dueDate: si.dueDate,
    })).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 5),
    [supplierInvoicesToPay]
  );

  // Mouvements réels
  const allMovements = useMemo((): RealMovement[] => {
    const moves: RealMovement[] = [];
    for (const inv of paidInvoicesTreasury) {
      moves.push({ id: `inv-${inv.id}`, type: 'income', amount: inv.totalTTC, description: `Facture ${inv.invoiceNumber} \u2014 ${clientMap[inv.clientId] || inv.clientName}`, date: inv.issueDate, source: 'Facture client' });
    }
    for (const sale of salesNotFromInvoicesTreasury) {
      moves.push({ id: `sale-${sale.id}`, type: 'income', amount: sale.totalTTC, description: `Vente ${sale.saleNumber}${sale.clientName ? ` \u2014 ${sale.clientName}` : ''}`, date: sale.createdAt, source: 'Vente comptoir' });
    }
    for (const sale of refundedSalesTreasury) {
      moves.push({ id: `refund-${sale.id}`, type: 'expense', amount: sale.totalTTC, description: `Remboursement ${sale.saleNumber}${sale.clientName ? ` \u2014 ${sale.clientName}` : ''}`, date: sale.refundedAt || sale.createdAt, source: 'Remboursement' });
    }
    for (const si of paidSupplierInvoicesTreasury) {
      moves.push({ id: `si-${si.id}`, type: 'expense', amount: si.total || 0, description: `Facture ${si.number} \u2014 ${si.supplierName || 'Fournisseur'}`, date: si.date, source: 'Facture fournisseur' });
    }
    moves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return moves;
  }, [paidInvoicesTreasury, paidSupplierInvoicesTreasury, clientMap, salesNotFromInvoicesTreasury, refundedSalesTreasury]);

  const filteredMovements = useMemo(() => {
    if (movementFilter === 'all') return allMovements;
    return allMovements.filter(m => m.type === movementFilter);
  }, [allMovements, movementFilter]);

  // Export FEC
  const handleExportFEC = useCallback(async () => {
    try {
      const movements = allMovements.map(m => ({
        id: m.id, date: m.date, type: m.type, amount: m.amount, description: m.description, reference: m.source,
      }));
      const fecContent = generateFECExport({
        movements, companyName: company.name || 'Mon entreprise', siret: company.siret || '',
        startDate: treasuryPeriodStart.toISOString(), endDate: now.toISOString(), currency: cur,
      });
      if (Platform.OS === 'web') {
        const blob = new Blob([fecContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FEC_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('Export FEC', 'Fichier FEC téléchargé');
      } else {
        await Share.share({ message: fecContent, title: 'Export FEC' });
      }
    } catch {
      Alert.alert('Erreur', "Impossible de générer l'export FEC");
    }
  }, [allMovements, company, treasuryPeriodStart, now, cur]);

  const formatCompact = (v: number): string => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return String(Math.round(v));
  };

  // ====== RENDU ======

  const renderPeriodSelector = () => (
    <View style={styles.periodRow}>
      {PERIOD_OPTION_KEYS.map((opt: { key: PeriodFilter; labelKey: string }) => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.periodPill, { backgroundColor: period === opt.key ? colors.primary : colors.card, borderColor: period === opt.key ? colors.primary : colors.cardBorder }]}
          onPress={() => setPeriod(opt.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.periodText, { color: period === opt.key ? '#FFF' : colors.textSecondary }]}>{t(opt.labelKey)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverviewTab = () => (
    <>
      {renderPeriodSelector()}

      {/* Bannière CA du jour */}
      <View style={[styles.todayBanner, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
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

      {/* Bloc À faire */}
      {(() => {
        const criticalStock = lowStockProducts.length;
        const unpaidCount = unpaidInvoices.length;
        const pendingOrders = pendingPurchaseOrders.length;
        const clientsWithUnpaid = new Set(
          unpaidInvoices.map(i => i.clientId)
        );
        const clientsToRemindCount = clientsWithUnpaid.size;
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
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                onPress={() => router.push('/stock')}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardInner}>
                  <AlertTriangle size={16} color="#DC2626" />
                  <Text style={[styles.actionCardText, { color: '#DC2626' }]} numberOfLines={2}>
                    {t('dashboard.criticalStock', { count: criticalStock })}
                  </Text>
                  <ChevronRight size={14} color="#DC2626" />
                </View>
              </TouchableOpacity>
            )}
            {unpaidCount > 0 && (
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}
                onPress={() => router.push('/ventes')}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardInner}>
                  <Clock size={16} color="#D97706" />
                  <Text style={[styles.actionCardText, { color: '#D97706' }]} numberOfLines={2}>
                    {t('dashboard.unpaidInvoices', { count: unpaidCount })} ({formatCurrencyInteger(unpaidAmount, cur)})
                  </Text>
                  <ChevronRight size={14} color="#D97706" />
                </View>
              </TouchableOpacity>
            )}
            {pendingOrders > 0 && (
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                onPress={() => router.push('/achats')}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardInner}>
                  <Truck size={16} color="#2563EB" />
                  <Text style={[styles.actionCardText, { color: '#2563EB' }]} numberOfLines={2}>
                    {t('dashboard.pendingOrders', { count: pendingOrders })}
                  </Text>
                  <ChevronRight size={14} color="#2563EB" />
                </View>
              </TouchableOpacity>
            )}
            {clientsToRemindCount > 0 && (
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: '#FDF2F8', borderColor: '#FBCFE8' }]}
                onPress={() => router.push('/ventes?tab=factures' as never)}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardInner}>
                  <MessageSquare size={16} color="#BE185D" />
                  <Text style={[styles.actionCardText, { color: '#BE185D' }]} numberOfLines={2}>
                    {t('dashboard.clientsToRemind', { count: clientsToRemindCount })} ({formatCurrencyInteger(unpaidAmount, cur)} {t('dashboard.unpaidTotal')})
                  </Text>
                  <ChevronRight size={14} color="#BE185D" />
                </View>
              </TouchableOpacity>
            )}
            {pendingSalesCount > 0 && (
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: isSyncing ? '#EFF6FF' : '#FEF3C7', borderColor: isSyncing ? '#BFDBFE' : '#FCD34D' }]}
                onPress={() => router.push('/sales')}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardInner}>
                  {isSyncing ? (
                    <RefreshCw size={16} color="#2563EB" />
                  ) : isOnline ? (
                    <CloudOff size={16} color="#D97706" />
                  ) : (
                    <CloudOff size={16} color="#92400E" />
                  )}
                  <Text style={[styles.actionCardText, { color: isSyncing ? '#2563EB' : '#92400E' }]} numberOfLines={2}>
                    {isSyncing
                      ? t('dashboard.syncing')
                      : t('dashboard.pendingSync', { count: pendingSalesCount })}
                  </Text>
                  <ChevronRight size={14} color={isSyncing ? '#2563EB' : '#92400E'} />
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>
        );
      })()}

      {/* KPIs principaux */}
      <View style={[styles.kpiRow, isMobile && styles.kpiRowMobile]}>
        <KPICard
          title={t('dashboard.monthlyRevenue')}
          value={formatCurrencyInteger(monthlyRevenue, cur)}
          change={Math.round(revenueChange * 10) / 10}
          icon={<TrendingUp size={16} color={colors.primary} />}
          onPress={() => router.push('/ventes')}
        />
        <KPICard
          title={t('dashboard.grossProfit')}
          value={formatCurrencyInteger(grossMargin, cur)}
          icon={<Target size={16} color={grossMargin >= 0 ? '#059669' : '#DC2626'} />}
          accentColor={grossMargin >= 0 ? '#059669' : '#DC2626'}
        />
      </View>
      <View style={[styles.kpiRow, isMobile && styles.kpiRowMobile]}>
        <KPICard
          title={t('dashboard.salesNumber')}
          value={String(paidSalesCount)}
          icon={<ShoppingCart size={16} color="#7C3AED" />}
          accentColor="#7C3AED"
          onPress={() => router.push('/ventes')}
        />
        <KPICard
          title={t('dashboard.unpaidAmount')}
          value={formatCurrencyInteger(unpaidAmount, cur)}
          icon={<Clock size={16} color="#D97706" />}
          accentColor="#D97706"
          onPress={() => router.push('/ventes')}
        />
        <KPICard
          title={t('dashboard.stockAlerts')}
          value={String(lowStockProducts.length)}
          icon={<AlertTriangle size={16} color="#DC2626" />}
          accentColor="#DC2626"
          onPress={() => router.push('/stock')}
        />
      </View>

      {/* Graphique CA par semaine */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.weeklyRevenue')}</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>{t('dashboard.last8Weeks')}</Text>
          </View>
        </View>
        {!hasWeeklyData ? (
          <View style={styles.emptyChart}>
            <BarChart3 size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.dataAfterSales')}</Text>
          </View>
        ) : (
          <View style={styles.barChartArea}>
            <View style={styles.barChartBars}>
              {weeklyData.map((w, idx) => {
                const h = weeklyMax > 0 ? Math.max((w.revenue / weeklyMax) * 140, w.revenue > 0 ? 8 : 0) : 0;
                return (
                  <View key={idx} style={styles.barCol}>
                    <View style={styles.barValueWrap}>
                      {w.revenue > 0 && (
                        <Text style={[styles.barValueText, { color: colors.primary }]}>{formatCompact(w.revenue)}</Text>
                      )}
                    </View>
                    <View style={[styles.bar, { height: h, backgroundColor: colors.primary, opacity: idx === weeklyData.length - 1 ? 1 : 0.6 }]} />
                    <Text style={[styles.barXLabel, { color: colors.textTertiary }]}>{w.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* 5 dernières ventes */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={() => router.push('/ventes')} activeOpacity={0.7}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.recentSales')}</Text>
        </TouchableOpacity>
        {recentSales.length === 0 ? (
          <View style={styles.emptyChart}>
            <FileText size={24} color={colors.textTertiary} />
            <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.noSalesYet')}</Text>
          </View>
        ) : (
          <View style={styles.tableContent}>
            {!isMobile && (
              <View style={[styles.tableRowHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1 }]}>Date</Text>
                <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1.5 }]}>Client</Text>
                <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1, textAlign: 'right' as const }]}>Montant</Text>
                <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.8, textAlign: 'center' as const }]}>Statut</Text>
              </View>
            )}
            {recentSales.map((sale, idx) => (
              <View key={sale.id + idx} style={[styles.tableRow, idx < recentSales.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                {isMobile ? (
                  <View style={styles.mobileRow}>
                    <View style={styles.mobileRowTop}>
                      <Text style={[styles.cellBold, { color: colors.text }]}>{sale.client}</Text>
                      <Text style={[styles.cellBold, { color: colors.primary }]}>{formatCurrency(sale.amount, cur)}</Text>
                    </View>
                    <View style={styles.mobileRowBottom}>
                      <Text style={[styles.cellSub, { color: colors.textTertiary }]}>{formatDate(sale.date)}</Text>
                      <StatusBadge status={sale.status} />
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.cellText, { color: colors.textSecondary, flex: 1 }]}>{formatDate(sale.date)}</Text>
                    <Text style={[styles.cellBold, { color: colors.text, flex: 1.5 }]} numberOfLines={1}>{sale.client}</Text>
                    <Text style={[styles.cellBold, { color: colors.primary, flex: 1, textAlign: 'right' as const }]}>{formatCurrency(sale.amount, cur)}</Text>
                    <View style={{ flex: 0.8, alignItems: 'center' as const }}><StatusBadge status={sale.status} /></View>
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );

  const handleExportSalesReport = useCallback(async () => {
    const periodLabels: Record<PeriodFilter, string> = { today: "Aujourd'hui", month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette année' };
    const html = generateSalesReportHTML({
      company, sales, invoices, clients, periodLabel: periodLabels[period], currency: cur,
    });
    await generateAndSharePDF(html, `Rapport_Ventes_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, sales, invoices, clients, period, cur]);

  const handleExportStockReport = useCallback(async () => {
    const html = generateStockReportHTML({ company, products: activeProducts, currency: cur });
    await generateAndSharePDF(html, `Rapport_Stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, cur, activeProducts]);

  const handleExportFinancialReport = useCallback(async () => {
    const periodLabels: Record<PeriodFilter, string> = { today: "Aujourd'hui", month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette année' };
    const html = generateFinancialReportHTML({
      company, revenue: monthlyRevenue, expenses: monthlyExpenses, unpaidAmount, periodLabel: periodLabels[period], currency: cur,
    });
    await generateAndSharePDF(html, `Rapport_Financier_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, monthlyRevenue, monthlyExpenses, unpaidAmount, period, cur]);

  const renderAnalysisTab = () => (
    <>
      {renderPeriodSelector()}

      {/* Export PDF buttons */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('reports.exportPDF')}</Text>
        <View style={styles.exportBtnRow}>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: colors.primary }]} onPress={handleExportSalesReport} activeOpacity={0.7}>
            <Download size={14} color="#FFF" />
            <Text style={styles.exportBtnText}>{t('reports.salesReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#059669' }]} onPress={handleExportStockReport} activeOpacity={0.7}>
            <Download size={14} color="#FFF" />
            <Text style={styles.exportBtnText}>{t('reports.stockReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#7C3AED' }]} onPress={handleExportFinancialReport} activeOpacity={0.7}>
            <Download size={14} color="#FFF" />
            <Text style={styles.exportBtnText}>{t('reports.financialReport')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Comparaison avec le mois précédent */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.comparisonPrevious')}</Text>
        <View style={[styles.comparisonRow, isMobile && styles.comparisonRowMobile]}>
          {/* CA */}
          <View style={[styles.comparisonCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
            <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>{t('dashboard.revenue')}</Text>
            <Text style={[styles.comparisonValue, { color: colors.text }]}>{formatCurrencyInteger(monthlyRevenue, cur)}</Text>
            <Text style={[styles.comparisonPrev, { color: colors.textTertiary }]}>{t('dashboard.vs')} {formatCurrencyInteger(prevRevenue, cur)}</Text>
            <View style={[styles.comparisonBadge, { backgroundColor: revenueChange >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
              {revenueChange >= 0 ? <ArrowUpRight size={12} color="#059669" /> : <ArrowDownRight size={12} color="#DC2626" />}
              <Text style={{ fontSize: 11, fontWeight: '700' as const, color: revenueChange >= 0 ? '#059669' : '#DC2626' }}>{revenueChange >= 0 ? '+' : ''}{Math.round(revenueChange)}%</Text>
            </View>
          </View>
          {/* Nombre de ventes */}
          <View style={[styles.comparisonCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
            <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>{t('dashboard.sales')}</Text>
            <Text style={[styles.comparisonValue, { color: colors.text }]}>{paidSalesCount}</Text>
            <Text style={[styles.comparisonPrev, { color: colors.textTertiary }]}>{t('dashboard.vs')} {prevSalesCount}</Text>
            <View style={[styles.comparisonBadge, { backgroundColor: salesCountChange >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
              {salesCountChange >= 0 ? <ArrowUpRight size={12} color="#059669" /> : <ArrowDownRight size={12} color="#DC2626" />}
              <Text style={{ fontSize: 11, fontWeight: '700' as const, color: salesCountChange >= 0 ? '#059669' : '#DC2626' }}>{salesCountChange >= 0 ? '+' : ''}{Math.round(salesCountChange)}%</Text>
            </View>
          </View>
          {/* Bénéfice brut */}
          <View style={[styles.comparisonCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
            <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>{t('dashboard.grossProfit')}</Text>
            <Text style={[styles.comparisonValue, { color: colors.text }]}>{formatCurrencyInteger(grossMargin, cur)}</Text>
            <Text style={[styles.comparisonPrev, { color: colors.textTertiary }]}>{t('dashboard.vs')} {formatCurrencyInteger(prevGrossMargin, cur)}</Text>
            <View style={[styles.comparisonBadge, { backgroundColor: marginChange >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
              {marginChange >= 0 ? <ArrowUpRight size={12} color="#059669" /> : <ArrowDownRight size={12} color="#DC2626" />}
              <Text style={{ fontSize: 11, fontWeight: '700' as const, color: marginChange >= 0 ? '#059669' : '#DC2626' }}>{marginChange >= 0 ? '+' : ''}{Math.round(marginChange)}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Évolution bénéfice brut 6 mois */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.profitEvolution')}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>{t('dashboard.last6Months')}</Text>
        <View style={styles.lineChartArea}>
          <View style={styles.lineChartBars}>
            {marginEvolution.map((m, idx) => {
              const isPositive = m.margin >= 0;
              const h = marginMax > 0 ? Math.max((Math.abs(m.margin) / marginMax) * 100, m.margin !== 0 ? 6 : 0) : 0;
              return (
                <View key={idx} style={styles.lineBarCol}>
                  <View style={styles.barValueWrap}>
                    {m.margin !== 0 && (
                      <Text style={[styles.barValueText, { color: isPositive ? colors.success : colors.danger, fontSize: 9 }]}>{formatCompact(m.margin)}</Text>
                    )}
                  </View>
                  <View style={[styles.bar, { height: h, backgroundColor: isPositive ? colors.success : colors.danger, opacity: 0.8 }]} />
                  <Text style={[styles.barXLabel, { color: colors.textTertiary }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Top 5 produits */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.topProducts')}</Text>
        {topProducts.length === 0 ? (
          <View style={styles.emptyChart}>
            <Package size={24} color={colors.textTertiary} />
            <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.noSalesRecorded')}</Text>
          </View>
        ) : (
          <View style={styles.tableContent}>
            <View style={[styles.tableRowHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 2 }]}>Produit</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.7, textAlign: 'center' as const }]}>Qté</Text>
              <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1.2, textAlign: 'right' as const }]}>CA généré</Text>
            </View>
            {topProducts.map((p, idx) => (
              <View key={idx} style={[styles.tableRow, idx < topProducts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 2, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                  <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? '#FEF3C7' : idx === 1 ? '#F3F4F6' : idx === 2 ? '#FDE68A' : colors.borderLight }]}>
                    <Text style={[styles.rankText, { color: idx < 3 ? '#92400E' : colors.textTertiary }]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.cellBold, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                </View>
                <Text style={[styles.cellText, { color: colors.textSecondary, flex: 0.7, textAlign: 'center' as const }]}>{p.qty}</Text>
                <Text style={[styles.cellBold, { color: colors.primary, flex: 1.2, textAlign: 'right' as const }]}>{formatCurrencyInteger(p.ca, cur)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );

  const renderSimplifiedDashboard = () => (
    <>
      {/* Bannière CA du jour */}
      <View style={[styles.todayBanner, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.todayBannerContent}>
          <View>
            <Text style={[styles.todayLabel, { color: colors.textTertiary }]}>Aujourd'hui</Text>
            <Text style={[styles.todayAmount, { color: colors.text }]}>{formatCurrencyInteger(todayRevenue, cur)}</Text>
          </View>
          <View style={[styles.todaySalesBadge, { backgroundColor: colors.primary + '12' }]}>
            <ShoppingCart size={14} color={colors.primary} />
            <Text style={[styles.todaySalesText, { color: colors.primary }]}>{todaySalesCount} vente{todaySalesCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      </View>

      {/* KPIs simplifiés pour Caissier */}
      <View style={[styles.kpiRow, isMobile && styles.kpiRowMobile]}>
        <KPICard
          title={t('dashboard.monthlyRevenue')}
          value={formatCurrencyInteger(monthlyRevenue, cur)}
          change={Math.round(revenueChange * 10) / 10}
          icon={<TrendingUp size={16} color={colors.primary} />}
        />
        <KPICard
          title={t('dashboard.salesNumber')}
          value={String(paidSalesCount)}
          icon={<ShoppingCart size={16} color="#7C3AED" />}
          accentColor="#7C3AED"
        />
      </View>

      {/* 5 dernières ventes */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>5 dernières ventes</Text>
        {recentSales.length === 0 ? (
          <View style={styles.emptyChart}>
            <FileText size={24} color={colors.textTertiary} />
            <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('dashboard.noSalesYet')}</Text>
          </View>
        ) : (
          <View style={styles.tableContent}>
            {!isMobile && (
              <View style={[styles.tableRowHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1 }]}>Date</Text>
                <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1.5 }]}>Client</Text>
                <Text style={[styles.thCell, { color: colors.textTertiary, flex: 1, textAlign: 'right' as const }]}>Montant</Text>
                <Text style={[styles.thCell, { color: colors.textTertiary, flex: 0.8, textAlign: 'center' as const }]}>Statut</Text>
              </View>
            )}
            {recentSales.map((sale, idx) => (
              <View key={sale.id + idx} style={[styles.tableRow, idx < recentSales.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                {isMobile ? (
                  <View style={styles.mobileRow}>
                    <View style={styles.mobileRowTop}>
                      <Text style={[styles.cellBold, { color: colors.text }]}>{sale.client}</Text>
                      <Text style={[styles.cellBold, { color: colors.primary }]}>{formatCurrency(sale.amount, cur)}</Text>
                    </View>
                    <View style={styles.mobileRowBottom}>
                      <Text style={[styles.cellSub, { color: colors.textTertiary }]}>{formatDate(sale.date)}</Text>
                      <StatusBadge status={sale.status} />
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.cellText, { color: colors.textSecondary, flex: 1 }]}>{formatDate(sale.date)}</Text>
                    <Text style={[styles.cellBold, { color: colors.text, flex: 1.5 }]} numberOfLines={1}>{sale.client}</Text>
                    <Text style={[styles.cellBold, { color: colors.primary, flex: 1, textAlign: 'right' as const }]}>{formatCurrency(sale.amount, cur)}</Text>
                    <View style={{ flex: 0.8, alignItems: 'center' as const }}><StatusBadge status={sale.status} /></View>
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );

  const renderTreasuryTab = () => (
    <>
      {/* KPIs Trésorerie */}
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

      {/* Graphique Flux sur 6 mois (barres côte à côte) */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.cashFlow')}</Text>
          <View style={styles.legendInline}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('dashboard.income')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#E84D3D' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('dashboard.expenses')}</Text>
            </View>
          </View>
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

      {/* Mini-tableaux côte à côte */}
      <View style={[styles.miniTablesRow, isMobile && { flexDirection: 'column' as const }]}>
        {/* Factures clients en retard */}
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

        {/* Fournisseurs à payer */}
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
                  <Text style={[styles.cellSub, { color: colors.textTertiary }]}>Éch. {formatDate(si.dueDate)}</Text>
                </View>
                <Text style={[styles.cellBold, { color: '#7C3AED' }]}>{formatCurrencyInteger(si.amount, cur)}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Export FEC + Mouvements */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <TouchableOpacity
            style={styles.movementsToggle}
            onPress={() => setShowMovements(prev => !prev)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('dashboard.movements')}</Text>
            <Text style={[styles.toggleText, { color: colors.primary }]}>{showMovements ? t('dashboard.hide') : t('dashboard.showCount', { count: allMovements.length })}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fecBtn, { borderColor: colors.cardBorder }]}
            onPress={handleExportFEC}
            activeOpacity={0.7}
          >
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
                  <Text style={[styles.filterPillText, { color: movementFilter === f.key ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredMovements.length === 0 ? (
              <View style={styles.emptyChart}>
                <Inbox size={24} color={colors.textTertiary} />
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title={t('dashboard.title')} />
      {!simplifiedDashboard && (
        <SectionTabBar tabs={DASHBOARD_TAB_KEYS.map(tab => ({ ...tab, label: t(tab.labelKey) }))} activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); scrollRef.current?.scrollTo({ y: 0, animated: true }); }} />
      )}
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Bienvenue */}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  welcomeRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 4 },
  greetingText: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  dateText: { fontSize: 13, marginTop: 2 },

  periodRow: { flexDirection: 'row' as const, gap: 6, marginBottom: 4 },
  periodPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  periodText: { fontSize: 12, fontWeight: '600' as const },

  kpiRow: { flexDirection: 'row' as const, gap: 10 },
  kpiRowMobile: { flexWrap: 'wrap' as const },

  card: { borderWidth: 1, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const },
  cardSubtitle: { fontSize: 12, marginTop: 1 },

  emptyChart: { alignItems: 'center' as const, paddingVertical: 28, gap: 8 },
  emptyChartText: { fontSize: 13, textAlign: 'center' as const, maxWidth: 260 },

  barChartArea: { marginTop: 4 },
  barChartBars: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 4, height: 180 },
  barCol: { flex: 1, alignItems: 'center' as const, justifyContent: 'flex-end' as const },
  barValueWrap: { marginBottom: 3, minHeight: 14 },
  barValueText: { fontSize: 9, fontWeight: '700' as const, textAlign: 'center' as const },
  bar: { width: '70%' as const, borderRadius: 4 },
  barXLabel: { fontSize: 10, fontWeight: '500' as const, marginTop: 6, textTransform: 'capitalize' as const },

  lineChartArea: { marginTop: 12 },
  lineChartBars: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 6, height: 140 },
  lineBarCol: { flex: 1, alignItems: 'center' as const, justifyContent: 'flex-end' as const },

  tableContent: { marginTop: 8 },
  tableRowHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingBottom: 8, borderBottomWidth: 1, marginBottom: 2 },
  thCell: { fontSize: 10, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10 },
  cellText: { fontSize: 13 },
  cellBold: { fontSize: 13, fontWeight: '600' as const },
  cellSub: { fontSize: 11, marginTop: 1 },
  mobileRow: { flex: 1, gap: 4 },
  mobileRowTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  mobileRowBottom: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },

  rankBadge: { width: 24, height: 24, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  rankText: { fontSize: 11, fontWeight: '700' as const },

  todayBanner: { borderWidth: 1, borderRadius: 12, padding: 16 },
  todayBannerContent: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  todayLabel: { fontSize: 12, fontWeight: '500' as const, marginBottom: 2 },
  todayAmount: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  todaySalesBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  todaySalesText: { fontSize: 13, fontWeight: '600' as const },

  actionRow: { marginBottom: 0 },
  actionRowContent: { gap: 8, paddingRight: 4 },
  actionCard: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 200 },
  actionCardInner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  actionCardText: { fontSize: 13, fontWeight: '600' as const, flexShrink: 1 },

  comparisonRow: { flexDirection: 'row' as const, gap: 10, marginTop: 12 },
  comparisonRowMobile: { flexWrap: 'wrap' as const },
  comparisonCard: { flex: 1, minWidth: 100, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' as const, gap: 4 },
  comparisonLabel: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  comparisonValue: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.3 },
  comparisonPrev: { fontSize: 11 },
  comparisonBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 2 },

  legendInline: { flexDirection: 'row' as const, gap: 12 },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },

  stackedBarArea: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, height: 150, gap: 6, marginTop: 8 },
  stackedBarCol: { flex: 1, alignItems: 'center' as const, justifyContent: 'flex-end' as const },
  stackedBarPair: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 3, width: '80%' as const },
  stackedBar: { flex: 1, borderRadius: 3, minHeight: 2 },

  miniTablesRow: { flexDirection: 'row' as const, gap: 10 },
  miniTable: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  miniTableHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 10 },
  miniTableTitle: { fontSize: 13, fontWeight: '600' as const },
  miniTableEmpty: { fontSize: 12, paddingVertical: 12, textAlign: 'center' as const },
  miniTableRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 8, gap: 8 },

  movementsToggle: { flex: 1, flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  toggleText: { fontSize: 13, fontWeight: '500' as const },
  fecBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  fecBtnText: { fontSize: 11, fontWeight: '600' as const },
  filterRow: { flexDirection: 'row' as const, gap: 6, marginTop: 12, marginBottom: 8 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: '500' as const },
  movementRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, gap: 10 },
  movementIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  movementInfo: { flex: 1 },
  movementMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 2, flexWrap: 'wrap' as const },
  sourceBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  sourceText: { fontSize: 9, fontWeight: '600' as const },
  exportBtnRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 10 },
  exportBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  exportBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' as const },
});
