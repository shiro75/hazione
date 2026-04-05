import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';

type PeriodFilter = 'today' | 'week' | 'month' | 'quarter' | 'year';

interface DashboardKPIs {
  revenue: number;
  salesCount: number;
  avgTicket: number;
  bestSale: { name: string; amount: number } | null;
  revenueSparkline: number[];
  salesSparkline: number[];
  expenses: number;
  grossMargin: number;
  unpaidAmount: number;
  unpaidCount: number;
  todayRevenue: number;
  todaySalesCount: number;
  yesterdayRevenue: number;
  cashBalance: number;
  totalEncaissements: number;
  totalDecaissements: number;
  monthlyExpensesAvg: number;
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

export default function useDashboardData(period: PeriodFilter = 'month'): DashboardKPIs {
  const {
    invoices,
    sales,
    activeSupplierInvoices,
    cashMovements,
    activeExpenses,
  } = useData();

  const now = useMemo(() => new Date(), []);
  const periodStartISO = useMemo(() => getPeriodStart(now, period).toISOString(), [now, period]);

  const paidInvoiceIds = useMemo(
    () => new Set(invoices.filter(i => i.status === 'paid').map(i => i.id)),
    [invoices],
  );

  const convertedIds = useMemo(
    () => new Set(sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!)),
    [sales],
  );

  const revenue = useMemo(() => {
    const invRev = invoices
      .filter(i => i.status === 'paid' && i.issueDate >= periodStartISO)
      .reduce((s, i) => s + i.totalTTC, 0);
    const saleRev = sales
      .filter(s => s.status === 'paid' && s.createdAt >= periodStartISO && (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId)))
      .reduce((s, sale) => s + sale.totalTTC, 0);
    return invRev + saleRev;
  }, [invoices, sales, periodStartISO, paidInvoiceIds]);

  const salesCount = useMemo(
    () =>
      sales.filter(s => s.status === 'paid' && s.createdAt >= periodStartISO).length +
      invoices.filter(i => i.status === 'paid' && i.issueDate >= periodStartISO).length,
    [sales, invoices, periodStartISO],
  );

  const avgTicket = useMemo(
    () => (salesCount > 0 ? revenue / salesCount : 0),
    [revenue, salesCount],
  );

  const bestSale = useMemo(() => {
    const allSales = [
      ...sales.filter(s => s.status === 'paid' && s.createdAt >= periodStartISO).map(s => ({ name: s.clientName || 'Client comptoir', amount: s.totalTTC })),
      ...invoices.filter(i => i.status === 'paid' && i.issueDate >= periodStartISO).map(i => ({ name: i.clientName, amount: i.totalTTC })),
    ];
    if (allSales.length === 0) return null;
    return allSales.reduce((best, s) => (s.amount > best.amount ? s : best), allSales[0]);
  }, [sales, invoices, periodStartISO]);

  const revenueSparkline = useMemo(() => {
    const points: number[] = [];
    for (let w = 6; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const sISO = weekStart.toISOString();
      const eISO = weekEnd.toISOString();
      const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= sISO && i.issueDate < eISO).reduce((s, i) => s + i.totalTTC, 0);
      const saleRev = sales.filter(s2 => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s3, sale) => s3 + sale.totalTTC, 0);
      points.push(invRev + saleRev);
    }
    return points;
  }, [invoices, sales, now, convertedIds]);

  const salesSparkline = useMemo(() => {
    const points: number[] = [];
    for (let w = 6; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const sISO = weekStart.toISOString();
      const eISO = weekEnd.toISOString();
      points.push(
        sales.filter(s => s.status === 'paid' && s.createdAt >= sISO && s.createdAt < eISO).length +
        invoices.filter(i => i.status === 'paid' && i.issueDate >= sISO && i.issueDate < eISO).length,
      );
    }
    return points;
  }, [sales, invoices, now]);

  const expenses = useMemo(() => {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const supplierExp = activeSupplierInvoices.filter(si => si.date >= periodStartISO && si.date < end).reduce((s, si) => s + (si.total || 0), 0);
    const cashExp = cashMovements.filter(cm => cm.type === 'expense' && cm.date >= periodStartISO && cm.date < end && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
    const companyExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= periodStartISO && e.date < end).reduce((s, e) => s + e.amount, 0);
    return supplierExp + cashExp + companyExp;
  }, [activeSupplierInvoices, cashMovements, activeExpenses, now, periodStartISO]);

  const grossMargin = revenue - expenses;

  const unpaidInvoices = useMemo(
    () => invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft'),
    [invoices],
  );
  const unpaidAmount = useMemo(() => unpaidInvoices.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0), [unpaidInvoices]);

  const todayStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.toISOString();
  }, [now]);

  const yesterdayStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return d.toISOString();
  }, [now]);

  const todayRevenue = useMemo(() => {
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= todayStart).reduce((s, i) => s + i.totalTTC, 0);
    const saleRev = sales.filter(s => s.status === 'paid' && s.createdAt >= todayStart && (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))).reduce((s2, sale) => s2 + sale.totalTTC, 0);
    return invRev + saleRev;
  }, [invoices, sales, todayStart, paidInvoiceIds]);

  const todaySalesCount = useMemo(
    () =>
      sales.filter(s => s.status === 'paid' && s.createdAt >= todayStart).length +
      invoices.filter(i => i.status === 'paid' && i.issueDate >= todayStart).length,
    [sales, invoices, todayStart],
  );

  const yesterdayRevenue = useMemo(() => {
    const invRev = invoices.filter(i => i.status === 'paid' && i.issueDate >= yesterdayStart && i.issueDate < todayStart).reduce((s, i) => s + i.totalTTC, 0);
    const saleRev = sales.filter(s => s.status === 'paid' && s.createdAt >= yesterdayStart && s.createdAt < todayStart && (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId))).reduce((s2, sale) => s2 + sale.totalTTC, 0);
    return invRev + saleRev;
  }, [invoices, sales, yesterdayStart, todayStart, paidInvoiceIds]);

  const cashBalance = useMemo(
    () => cashMovements.length === 0 ? 0 : cashMovements.reduce((bal, cm) => cm.type === 'income' ? bal + cm.amount : bal - cm.amount, 0),
    [cashMovements],
  );

  const sixMonthStart = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 6);
    return d;
  }, [now]);

  const totalEncaissements = useMemo(() => {
    const paidInv = invoices.filter(i => i.status === 'paid' && new Date(i.issueDate) >= sixMonthStart);
    const paidSales = sales.filter(s => s.status === 'paid' && new Date(s.createdAt) >= sixMonthStart);
    const paidInvIds = new Set(paidInv.map(i => i.id));
    const salesNotFromInv = paidSales.filter(s => !s.convertedToInvoiceId || !paidInvIds.has(s.convertedToInvoiceId));
    return paidInv.reduce((s, i) => s + i.totalTTC, 0) + salesNotFromInv.reduce((s, sale) => s + sale.totalTTC, 0);
  }, [invoices, sales, sixMonthStart]);

  const totalDecaissements = useMemo(() => {
    const paidSI = activeSupplierInvoices.filter(si => si.status === 'paid' && new Date(si.date) >= sixMonthStart);
    const refunded = sales.filter(s => s.status === 'refunded' && s.refundedAt && new Date(s.refundedAt) >= sixMonthStart);
    const startISO = sixMonthStart.toISOString();
    const compExp = activeExpenses.filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= startISO).reduce((s, e) => s + e.amount, 0);
    return paidSI.reduce((s, si) => s + (si.total || 0), 0) + refunded.reduce((s, sale) => s + sale.totalTTC, 0) + compExp;
  }, [activeSupplierInvoices, sales, activeExpenses, sixMonthStart]);

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

  return {
    revenue,
    salesCount,
    avgTicket,
    bestSale,
    revenueSparkline,
    salesSparkline,
    expenses,
    grossMargin,
    unpaidAmount,
    unpaidCount: unpaidInvoices.length,
    todayRevenue,
    todaySalesCount,
    yesterdayRevenue,
    cashBalance,
    totalEncaissements,
    totalDecaissements,
    monthlyExpensesAvg,
  };
}
