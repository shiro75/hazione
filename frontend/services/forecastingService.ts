/**
 * @fileoverview Revenue forecasting service using moving average projection.
 * Analyzes historical monthly data to project future revenue with confidence levels.
 * Used in the dashboard and trésorerie overview.
 */

import type { MonthlyRevenue, ForecastData, Invoice } from '@/types';

export function projectRevenue(
  monthlyData: MonthlyRevenue[],
  monthsAhead: number = 3
): ForecastData[] {
  if (monthlyData.length < 3) return [];

  const recent = monthlyData.slice(-3);
  const avgRevenue = recent.reduce((s, m) => s + m.revenue, 0) / recent.length;

  const growthRates: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1].revenue > 0) {
      growthRates.push((recent[i].revenue - recent[i - 1].revenue) / recent[i - 1].revenue);
    }
  }
  const avgGrowth = growthRates.length > 0
    ? growthRates.reduce((s, r) => s + r, 0) / growthRates.length
    : 0;

  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const lastMonthIndex = months.indexOf(recent[recent.length - 1].month);

  const forecasts: ForecastData[] = [];
  let projected = avgRevenue;

  for (let i = 1; i <= monthsAhead; i++) {
    projected = projected * (1 + avgGrowth);
    const monthIndex = (lastMonthIndex + i) % 12;
    const confidence = Math.max(0.5, 1 - (i * 0.15));
    forecasts.push({
      month: months[monthIndex],
      projected: Math.round(projected),
      confidence,
    });
  }

  return forecasts;
}

export function calculateGrowthRate(monthlyData: MonthlyRevenue[]): number {
  if (monthlyData.length < 2) return 0;
  const current = monthlyData[monthlyData.length - 1].revenue;
  const previous = monthlyData[monthlyData.length - 2].revenue;
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function projectEndOfYear(monthlyData: MonthlyRevenue[]): number {
  const totalSoFar = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const monthsElapsed = monthlyData.length;
  if (monthsElapsed === 0) return 0;
  const avgMonthly = totalSoFar / monthsElapsed;
  return Math.round(totalSoFar + avgMonthly * (12 - monthsElapsed));
}

export function projectEndOfMonth(
  unpaidInvoices: Invoice[],
  currentCash: number
): number {
  const expectedPayments = unpaidInvoices
    .filter((inv) => {
      const due = new Date(inv.dueDate);
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
      return due <= endOfMonth;
    })
    .reduce((s, inv) => s + (inv.totalTTC - inv.paidAmount), 0);

  return currentCash + expectedPayments;
}

export function detectCashShortageRisk(
  currentCash: number,
  monthlyExpenses: number,
  expectedIncome: number
): boolean {
  const projectedBalance = currentCash + expectedIncome - monthlyExpenses;
  return projectedBalance < monthlyExpenses * 0.5;
}

export function calculateMarginByClient(
  orders: { clientName: string; totalHT: number; items: { unitPrice: number; quantity: number; productName: string }[] }[],
  products: { name: string; purchasePrice: number; salePrice: number }[]
): { name: string; revenue: number; margin: number; marginPercent: number }[] {
  const clientMap: Record<string, { revenue: number; cost: number }> = {};

  orders.forEach((order) => {
    if (!clientMap[order.clientName]) {
      clientMap[order.clientName] = { revenue: 0, cost: 0 };
    }
    clientMap[order.clientName].revenue += order.totalHT;

    order.items.forEach((item) => {
      const product = products.find((p) => p.name === item.productName);
      if (product) {
        clientMap[order.clientName].cost += product.purchasePrice * item.quantity;
      }
    });
  });

  return Object.entries(clientMap)
    .map(([name, data]) => ({
      name,
      revenue: data.revenue,
      margin: data.revenue - data.cost,
      marginPercent: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.margin - a.margin);
}
