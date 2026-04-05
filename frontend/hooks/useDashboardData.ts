/**
 * hooks/useDashboardData.ts
 *
 * Centralise TOUS les calculs du tableau de bord.
 * Ce hook ne contient aucun JSX — uniquement des useMemo et useCallback.
 *
 * SECTIONS :
 *   1. Revenus et dépenses (période courante + précédente)
 *   2. Sparklines et tendances
 *   3. Clients et relances
 *   4. Analyse produits (ABC, variantes)
 *   5. Trésorerie (solde, projections, mouvements)
 *   6. Données graphiques (charts)
 *   7. Score de santé financière
 */

import { useMemo, useCallback } from 'react';
import type { PeriodFilter } from '@/types/dashboard.types';
import type { VariantDetail, VariantSaleDetail, ProductSaleDetail, VariantAbcData } from '@/types/dashboard.types';
import { calcPeriodRevenue } from '@/utils/dashboardHelpers';

// ─── Types des paramètres ─────────────────────────────────────────────────────

interface UseDashboardDataParams {
  now: Date;
  period: PeriodFilter;
  periodStart: string;
  prevPeriod: { start: Date; end: Date };
  invoices: any[];
  sales: any[];
  quotes: any[];
  activeProducts: any[];
  activeSupplierInvoices: any[];
  cashMovements: any[];
  activeExpenses: any[];
  activePurchaseOrders: any[];
  clients: any[];
  lowStockProducts: any[];
  locale: string;
  getVariantsForProduct: (id: string) => any[];
  productAttributes: any[];
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useDashboardData({
  now, period, periodStart, prevPeriod,
  invoices, sales, quotes, activeProducts,
  activeSupplierInvoices, cashMovements, activeExpenses, activePurchaseOrders,
  clients, lowStockProducts, locale,
  getVariantsForProduct, productAttributes,
}: UseDashboardDataParams) {

  // ══════════════════════════════════════════════════════════════════
  // SECTION 1 — REVENUS ET DÉPENSES
  // ══════════════════════════════════════════════════════════════════

  /** Set des IDs de factures payées — utilisé pour dédupliquer les ventes converties */
  const paidInvoiceIds = useMemo(
    () => new Set(invoices.filter((i) => i.status === 'paid').map((i) => i.id)),
    [invoices],
  );

  /** Devis acceptés non encore convertis en facture */
  const acceptedQuotesNotConverted = useMemo(
    () => quotes.filter((q) => q.status === 'accepted' && !q.convertedToInvoiceId),
    [quotes],
  );

  /** CA du jour (factures + ventes + devis acceptés) */
  const todayStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.toISOString();
  }, [now]);

  const todayRevenue = useMemo(() => {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    return calcPeriodRevenue(invoices, sales, paidInvoiceIds, todayStart, end, acceptedQuotesNotConverted);
  }, [invoices, sales, paidInvoiceIds, todayStart, acceptedQuotesNotConverted, now]);

  const todaySalesCount = useMemo(
    () =>
      sales.filter((s) => s.status === 'paid' && s.createdAt >= todayStart).length +
      invoices.filter((i) => i.status === 'paid' && i.issueDate >= todayStart).length,
    [sales, invoices, todayStart],
  );

  /** CA d'hier pour comparaison "pouls du jour" */
  const yesterdayStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return d.toISOString();
  }, [now]);

  const yesterdayRevenue = useMemo(
    () => calcPeriodRevenue(invoices, sales, paidInvoiceIds, yesterdayStart, todayStart, acceptedQuotesNotConverted),
    [invoices, sales, paidInvoiceIds, yesterdayStart, todayStart, acceptedQuotesNotConverted],
  );

  const yesterdaySalesCount = useMemo(
    () =>
      sales.filter((s) => s.status === 'paid' && s.createdAt >= yesterdayStart && s.createdAt < todayStart).length +
      invoices.filter((i) => i.status === 'paid' && i.issueDate >= yesterdayStart && i.issueDate < todayStart).length,
    [sales, invoices, yesterdayStart, todayStart],
  );

  /** Ventes payées de la période non issues de factures (évite le double-comptage) */
  const paidSalesNotInvoiced = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.status === 'paid' &&
          s.createdAt >= periodStart &&
          (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId)),
      ),
    [sales, paidInvoiceIds, periodStart],
  );

  /** CA total de la période courante */
  const monthlyRevenue = useMemo(() => {
    const invRev = invoices
      .filter((i) => i.status === 'paid' && i.issueDate >= periodStart)
      .reduce((s, i) => s + i.totalTTC, 0);
    const salesRev = paidSalesNotInvoiced.reduce((s, sale) => s + sale.totalTTC, 0);
    const quoteRev = acceptedQuotesNotConverted
      .filter((q) => q.acceptedAt && q.acceptedAt >= periodStart)
      .reduce((s, q) => s + q.totalTTC, 0);
    return invRev + salesRev + quoteRev;
  }, [invoices, periodStart, paidSalesNotInvoiced, acceptedQuotesNotConverted]);

  /** CA de la période précédente (pour calcul de variation) */
  const prevRevenue = useMemo(() => {
    const pStart = prevPeriod.start.toISOString();
    const pEnd = prevPeriod.end.toISOString();
    return calcPeriodRevenue(invoices, sales, paidInvoiceIds, pStart, pEnd, acceptedQuotesNotConverted);
  }, [invoices, sales, prevPeriod, paidInvoiceIds, acceptedQuotesNotConverted]);

  /** Variation du CA en % (undefined si pas de données précédentes) */
  const revenueChange = useMemo((): number | undefined => {
    if (prevRevenue === 0 && monthlyRevenue === 0) return 0;
    if (prevRevenue === 0) return undefined;
    return ((monthlyRevenue - prevRevenue) / prevRevenue) * 100;
  }, [monthlyRevenue, prevRevenue]);

  /** Dépenses totales de la période (fournisseurs + mouvements cash + notes de frais + BdC) */
  const monthlyExpenses = useMemo(() => {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const supplierExp = activeSupplierInvoices
      .filter((si) => si.date >= periodStart && si.date < end)
      .reduce((s, si) => s + (si.total || 0), 0);
    const cashExp = cashMovements
      .filter((cm) => cm.type === 'expense' && cm.date >= periodStart && cm.date < end && !cm.sourceType)
      .reduce((s, cm) => s + cm.amount, 0);
    const companyExp = activeExpenses
      .filter((e) => (e.status === 'approved' || e.status === 'paid') && e.date >= periodStart && e.date < end)
      .reduce((s, e) => s + e.amount, 0);
    const poExp = (activePurchaseOrders ?? [])
      .filter((po) => (po.status === 'received' || po.status === 'partial') && po.createdAt >= periodStart && po.createdAt < end)
      .reduce((s, po) => s + (po.total || 0), 0);
    return supplierExp + cashExp + companyExp + poExp;
  }, [activeSupplierInvoices, cashMovements, activeExpenses, activePurchaseOrders, now, periodStart]);

  /** Marge brute = CA - Dépenses */
  const grossMargin = monthlyRevenue - monthlyExpenses;

  /** Nombre de ventes payées sur la période */
  const paidSalesCount = useMemo(
    () =>
      sales.filter((s) => s.status === 'paid' && s.createdAt >= periodStart).length +
      invoices.filter((i) => i.status === 'paid' && i.issueDate >= periodStart).length,
    [sales, invoices, periodStart],
  );

  const prevSalesCount = useMemo(() => {
    const pStart = prevPeriod.start.toISOString();
    const pEnd = prevPeriod.end.toISOString();
    return (
      sales.filter((s) => s.status === 'paid' && s.createdAt >= pStart && s.createdAt < pEnd).length +
      invoices.filter((i) => i.status === 'paid' && i.issueDate >= pStart && i.issueDate < pEnd).length
    );
  }, [sales, invoices, prevPeriod]);

  const prevExpenses = useMemo(() => {
    const pStart = prevPeriod.start.toISOString();
    const pEnd = prevPeriod.end.toISOString();
    const supplierExp = activeSupplierInvoices
      .filter((si) => si.date >= pStart && si.date < pEnd)
      .reduce((s, si) => s + (si.total || 0), 0);
    const cashExp = cashMovements
      .filter((cm) => cm.type === 'expense' && cm.date >= pStart && cm.date < pEnd && !cm.sourceType)
      .reduce((s, cm) => s + cm.amount, 0);
    const companyExp = activeExpenses
      .filter((e) => (e.status === 'approved' || e.status === 'paid') && e.date >= pStart && e.date < pEnd)
      .reduce((s, e) => s + e.amount, 0);
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

  /** Factures impayées (hors brouillons et annulées) */
  const unpaidInvoices = useMemo(
    () => invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft'),
    [invoices],
  );

  const unpaidAmount = useMemo(
    () => unpaidInvoices.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0),
    [unpaidInvoices],
  );

  /** Commandes fournisseurs en attente (brouillon ou envoyées) */
  const pendingPurchaseOrders = useMemo(
    () => activePurchaseOrders?.filter((po) => po.status === 'draft' || po.status === 'sent') ?? [],
    [activePurchaseOrders],
  );

  // ══════════════════════════════════════════════════════════════════
  // SECTION 2 — SPARKLINES ET TENDANCES
  // ══════════════════════════════════════════════════════════════════

  /**
   * Sparkline de CA sur 7 semaines glissantes.
   * Utilisé dans le KPI primaire et le calcul de tendance linéaire.
   */
  const revenueSparkline = useMemo(() => {
    const convertedIds = new Set(sales.filter((s) => s.convertedToInvoiceId).map((s) => s.convertedToInvoiceId!));
    return Array.from({ length: 7 }, (_, i) => {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (6 - i) * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      return calcPeriodRevenue(invoices, sales, convertedIds, weekStart.toISOString(), weekEnd.toISOString());
    });
  }, [invoices, sales, now]);

  /**
   * Tendance linéaire (régression) du CA hebdomadaire.
   * Valeur positive = CA en croissance, négative = en baisse.
   */
  const revenueMonthlyTrend = useMemo(() => {
    const pts = revenueSparkline.filter((v) => v > 0);
    if (pts.length < 2) return 0;
    const n = revenueSparkline.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i; sumY += revenueSparkline[i];
      sumXY += i * revenueSparkline[i]; sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }, [revenueSparkline]);

  /** Sparkline du nombre de ventes sur 7 semaines */
  const salesSparkline = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (6 - i) * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const sISO = weekStart.toISOString();
      const eISO = weekEnd.toISOString();
      return (
        sales.filter((s) => s.status === 'paid' && s.createdAt >= sISO && s.createdAt < eISO).length +
        invoices.filter((i) => i.status === 'paid' && i.issueDate >= sISO && i.issueDate < eISO).length
      );
    });
  }, [sales, invoices, now]);

  // ══════════════════════════════════════════════════════════════════
  // SECTION 3 — CLIENTS ET RELANCES
  // ══════════════════════════════════════════════════════════════════

  const clientsToRemindCount = useMemo(
    () => new Set(unpaidInvoices.map((i) => i.clientId)).size,
    [unpaidInvoices],
  );

  /**
   * Top 3 clients à relancer en priorité, scorés selon :
   * - montant impayé (> 500 = +1)
   * - factures en retard (+2 par facture)
   * - dernière commande > 30j (+1)
   */
  const priorityClientsToRemind = useMemo(() => {
    const clientScores = new Map<string, {
      clientId: string; name: string; unpaidCount: number;
      totalUnpaid: number; lastPurchaseDate: string; score: number;
    }>();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString();

    for (const inv of unpaidInvoices) {
      const key = inv.clientId;
      const existing = clientScores.get(key) || {
        clientId: key, name: inv.clientName || 'Client',
        unpaidCount: 0, totalUnpaid: 0, lastPurchaseDate: '', score: 0,
      };
      existing.unpaidCount += 1;
      existing.totalUnpaid += inv.totalTTC - inv.paidAmount;
      if (new Date(inv.dueDate) < now) existing.score += 2;
      clientScores.set(key, existing);
    }

    const allClientSales = [
      ...sales.filter((s) => s.status === 'paid').map((s) => ({ clientId: s.clientId, date: s.createdAt })),
      ...invoices.filter((i) => i.status === 'paid').map((i) => ({ clientId: i.clientId, date: i.issueDate })),
    ];

    for (const [key, data] of clientScores) {
      const clientSales = allClientSales.filter((s) => s.clientId === key);
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

  /** Répartition nouveaux clients / clients récurrents */
  const clientRecurrence = useMemo(() => {
    const clientPurchaseDates: Record<string, string[]> = {};
    const record = (clientId: string | undefined, clientName: string | undefined, date: string) => {
      const key = clientId || clientName || 'inconnu';
      if (!clientPurchaseDates[key]) clientPurchaseDates[key] = [];
      clientPurchaseDates[key].push(date);
    };
    sales.filter((s) => s.status === 'paid').forEach((s) => record(s.clientId, s.clientName, s.createdAt));
    invoices.filter((i) => i.status === 'paid').forEach((i) => record(i.clientId, i.clientName, i.issueDate));

    let newCount = 0;
    let recurringCount = 0;
    for (const dates of Object.values(clientPurchaseDates)) {
      if (dates.length === 1) newCount++;
      else recurringCount++;
    }
    return { newCount, recurringCount };
  }, [sales, invoices]);

  const loyaltyRate = useMemo(() => {
    const total = clientRecurrence.newCount + clientRecurrence.recurringCount;
    return total > 0 ? Math.round((clientRecurrence.recurringCount / total) * 100) : 0;
  }, [clientRecurrence]);

  // ══════════════════════════════════════════════════════════════════
  // SECTION 4 — ANALYSE PRODUITS (ABC + VARIANTES)
  // ══════════════════════════════════════════════════════════════════

  /** Label d'une variante à partir de ses attributs, triés selon l'ordre des attributs globaux */
  const getVariantLabel = useCallback((productId: string, variantId: string): string => {
    const allVariants = getVariantsForProduct(productId);
    const variant = allVariants.find((v) => v.id === variantId);
    if (!variant) return '';
    const sortedAttrs = [...productAttributes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const parts: string[] = [];
    for (const attr of sortedAttrs) {
      const val = variant.attributes[attr.name];
      if (val) parts.push(`${attr.name}: ${val}`);
    }
    const extraKeys = Object.keys(variant.attributes).filter((k) => !sortedAttrs.some((a) => a.name === k));
    for (const k of extraKeys) parts.push(`${k}: ${variant.attributes[k]}`);
    return parts.join(', ');
  }, [getVariantsForProduct, productAttributes]);

  /** Détails des variantes d'un produit (pour l'affichage dans le classement ABC) */
  const getProductVariantDetails = useCallback((productId: string): VariantDetail[] => {
    const variants = getVariantsForProduct(productId);
    if (variants.length === 0) return [];
    const sortedAttrs = [...productAttributes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return variants.map((v) => {
      const parts: string[] = [];
      for (const attr of sortedAttrs) {
        const val = v.attributes[attr.name];
        if (val) parts.push(`${attr.name}: ${val}`);
      }
      const extraKeys = Object.keys(v.attributes).filter((k) => !sortedAttrs.some((a) => a.name === k));
      for (const k of extraKeys) parts.push(`${k}: ${v.attributes[k]}`);
      return { variantId: v.id, attributes: v.attributes, attributeLabel: parts.join(', ') };
    });
  }, [getVariantsForProduct, productAttributes]);

  /** Tous les produits vendus avec leur CA, coût et catégorie */
  const allProducts = useMemo(() => {
    const productMap = new Map<string, { id: string; name: string; qty: number; ca: number; cost: number; category: string }>();
    const record = (id: string, name: string, qty: number, total: number) => {
      const ex = productMap.get(id) || { id, name, qty: 0, ca: 0, cost: 0, category: '' };
      ex.qty += qty; ex.ca += total;
      const product = activeProducts.find((p) => p.id === id);
      ex.cost += (product?.purchasePrice || 0) * qty;
      ex.category = product?.categoryName || 'Autres';
      productMap.set(id, ex);
    };
    sales.filter((s) => s.status === 'paid').forEach((s) => s.items.forEach((i: any) => record(i.productId, i.productName, i.quantity, i.totalTTC)));
    invoices.filter((i) => i.status === 'paid').forEach((inv) => inv.items.forEach((i: any) => record(i.productId, i.productName, i.quantity, i.totalTTC)));
    return Array.from(productMap.values()).sort((a, b) => b.ca - a.ca);
  }, [sales, invoices, activeProducts]);

  /**
   * Classement ABC : A = 80% du CA cumulé, B = jusqu'à 95%, C = reste.
   * Chaque produit porte son % de CA, son classement et sa marge.
   */
  const abcClassification = useMemo(() => {
    const totalCA = allProducts.reduce((s, p) => s + p.ca, 0);
    if (totalCA === 0) return [];
    let cumulative = 0;
    return allProducts.map((p) => {
      cumulative += p.ca;
      const pctCA = (p.ca / totalCA) * 100;
      const cumulPct = (cumulative / totalCA) * 100;
      const abc: 'A' | 'B' | 'C' = cumulPct <= 80 ? 'A' : cumulPct <= 95 ? 'B' : 'C';
      return { ...p, pctCA, abc, margin: p.ca - p.cost };
    });
  }, [allProducts]);

  /** Sparklines 7 jours par nom de produit */
  const productSparklines7d = useMemo(() => {
    const sparkMap = new Map<string, number[]>();
    const allItems: { productName: string; date: string; qty: number }[] = [];
    sales.filter((s) => s.status === 'paid').forEach((s) =>
      s.items.forEach((i: any) => allItems.push({ productName: i.productName, date: s.createdAt, qty: i.quantity })),
    );
    invoices.filter((i) => i.status === 'paid').forEach((inv) =>
      inv.items.forEach((i: any) => allItems.push({ productName: i.productName, date: inv.issueDate, qty: i.quantity })),
    );
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
    }
    return sparkMap;
  }, [sales, invoices, now]);

  /** Données ABC par variante, avec sparkline 7j et tendance */
  const variantAbcMap = useMemo(() => {
    const map = new Map<string, VariantAbcData[]>();
    const variantRevMap = new Map<string, { ca: number; cost: number; daily: number[] }>();

    const collectItems = (items: any[], date: string) => {
      for (const item of items) {
        const vid = item.variantId;
        if (!vid) continue;
        const key = `${item.productId}::${vid}`;
        const ex = variantRevMap.get(key) || { ca: 0, cost: 0, daily: Array(7).fill(0) };
        ex.ca += item.totalTTC;
        const variant = getVariantsForProduct(item.productId).find((v) => v.id === vid);
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

    sales.filter((s) => s.status === 'paid').forEach((s) => collectItems(s.items, s.createdAt));
    invoices.filter((i) => i.status === 'paid').forEach((inv) => collectItems(inv.items, inv.issueDate));

    for (const [compositeKey, data] of variantRevMap) {
      const [productId, variantId] = compositeKey.split('::');
      const label = getVariantLabel(productId, variantId);
      const daysWithData = data.daily.filter((v) => v > 0).length;
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
      existing.push({ variantId, label: label || variantId.slice(0, 8), ca: data.ca, margin: data.ca - data.cost, sparkline: data.daily, trend, hasSufficientData });
      map.set(productId, existing);
    }

    for (const [pid, variants] of map) {
      map.set(pid, variants.sort((a, b) => b.ca - a.ca));
    }
    return map;
  }, [sales, invoices, now, getVariantsForProduct, getVariantLabel]);

  // ══════════════════════════════════════════════════════════════════
  // SECTION 5 — TRÉSORERIE
  // ══════════════════════════════════════════════════════════════════

  /** Solde de trésorerie = somme de tous les mouvements cash */
  const cashBalance = useMemo(
    () =>
      cashMovements.length === 0
        ? 0
        : cashMovements.reduce((bal, cm) => (cm.type === 'income' ? bal + cm.amount : bal - cm.amount), 0),
    [cashMovements],
  );

  const treasuryPeriodStart = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 6);
    return d;
  }, [now]);

  const paidInvoicesTreasury = useMemo(
    () => invoices.filter((i) => i.status === 'paid' && new Date(i.issueDate) >= treasuryPeriodStart),
    [invoices, treasuryPeriodStart],
  );

  const paidSupplierInvoicesTreasury = useMemo(
    () => activeSupplierInvoices.filter((si) => si.status === 'paid' && new Date(si.date) >= treasuryPeriodStart),
    [activeSupplierInvoices, treasuryPeriodStart],
  );

  const paidSalesTreasury = useMemo(
    () => sales.filter((s) => s.status === 'paid' && new Date(s.createdAt) >= treasuryPeriodStart),
    [sales, treasuryPeriodStart],
  );

  const refundedSalesTreasury = useMemo(
    () => sales.filter((s) => s.status === 'refunded' && s.refundedAt && new Date(s.refundedAt) >= treasuryPeriodStart),
    [sales, treasuryPeriodStart],
  );

  const paidInvoiceIdsTreasury = useMemo(
    () => new Set(paidInvoicesTreasury.map((i) => i.id)),
    [paidInvoicesTreasury],
  );

  const salesNotFromInvoicesTreasury = useMemo(
    () => paidSalesTreasury.filter((s) => !s.convertedToInvoiceId || !paidInvoiceIdsTreasury.has(s.convertedToInvoiceId)),
    [paidSalesTreasury, paidInvoiceIdsTreasury],
  );

  const totalEncaissements = useMemo(
    () =>
      paidInvoicesTreasury.reduce((s, i) => s + i.totalTTC, 0) +
      salesNotFromInvoicesTreasury.reduce((s, sale) => s + sale.totalTTC, 0),
    [paidInvoicesTreasury, salesNotFromInvoicesTreasury],
  );

  const expensesTreasuryTotal = useMemo(() => {
    const startISO = treasuryPeriodStart.toISOString();
    return activeExpenses
      .filter((e) => (e.status === 'approved' || e.status === 'paid') && e.date >= startISO)
      .reduce((s, e) => s + e.amount, 0);
  }, [activeExpenses, treasuryPeriodStart]);

  const totalDecaissements = useMemo(
    () =>
      paidSupplierInvoicesTreasury.reduce((s, si) => s + (si.total || 0), 0) +
      refundedSalesTreasury.reduce((s, sale) => s + sale.totalTTC, 0) +
      expensesTreasuryTotal,
    [paidSupplierInvoicesTreasury, refundedSalesTreasury, expensesTreasuryTotal],
  );

  const supplierInvoicesToPayTreasury = useMemo(
    () => activeSupplierInvoices.filter((si) => si.status === 'to_pay' || si.status === 'received' || si.status === 'late'),
    [activeSupplierInvoices],
  );

  const totalSupplierToPay = useMemo(
    () => supplierInvoicesToPayTreasury.reduce((s, si) => s + (si.total || 0), 0),
    [supplierInvoicesToPayTreasury],
  );

  const totalDecaissementsWithPlanned = totalDecaissements + totalSupplierToPay;
  const netCashflow = totalEncaissements - totalDecaissements;

  /** Dépenses moyennes mensuelles sur 6 mois (pour calcul du runway) */
  const monthlyExpensesAvg = useMemo(() => {
    const months = 6;
    let total = 0;
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const dISO = d.toISOString();
      const eISO = end.toISOString();
      const supplierExp = activeSupplierInvoices.filter((si) => si.date >= dISO && si.date < eISO).reduce((s, si) => s + (si.total || 0), 0);
      const cashExp = cashMovements.filter((cm) => cm.type === 'expense' && cm.date >= dISO && cm.date < eISO && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
      const compExp = activeExpenses.filter((e) => (e.status === 'approved' || e.status === 'paid') && e.date >= dISO && e.date < eISO).reduce((s, e) => s + e.amount, 0);
      total += supplierExp + cashExp + compExp;
    }
    return total / months;
  }, [activeSupplierInvoices, cashMovements, activeExpenses, now]);

  /** Données attendues de recouvrement (factures impayées) */
  const expectedCollections = useMemo(() => {
    const unpaidInvs = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft');
    const totalUnpaid = unpaidInvs.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0);
    const weekFromNow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
    const todayISO = now.toISOString();
    const thisWeek = unpaidInvs.filter((i) => i.dueDate >= todayISO && i.dueDate <= weekFromNow);
    const thisWeekAmount = thisWeek.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0);
    const overdue = unpaidInvs.filter((i) => i.dueDate < todayISO);
    const overdueAmount = overdue.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const collectedThisMonth = invoices.filter((i) => i.status === 'paid' && i.issueDate >= monthStart).reduce((s, i) => s + i.totalTTC, 0);
    const clientUnpaidMap = new Map<string, { name: string; amount: number }>();
    for (const inv of unpaidInvs) {
      const existing = clientUnpaidMap.get(inv.clientId) || { name: inv.clientName || 'Client', amount: 0 };
      existing.amount += inv.totalTTC - inv.paidAmount;
      clientUnpaidMap.set(inv.clientId, existing);
    }
    let topClient: { name: string; amount: number } | null = null;
    for (const val of clientUnpaidMap.values()) {
      if (!topClient || val.amount > topClient.amount) topClient = val;
    }
    return { totalUnpaid, thisWeekAmount, overdueAmount, overdueCount: overdue.length, collectedThisMonth, unpaidCount: unpaidInvs.length, topClient };
  }, [invoices, now]);

  // ══════════════════════════════════════════════════════════════════
  // SECTION 6 — DONNÉES GRAPHIQUES
  // ══════════════════════════════════════════════════════════════════

  /** Évolution CA vs Dépenses sur 6 mois (pour AreaChart / RevenueVsExpenses) */
  const sixMonthsData = useMemo(() => {
    const convertedIds = new Set(sales.filter((s) => s.convertedToInvoiceId).map((s) => s.convertedToInvoiceId!));
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const dISO = d.toISOString();
      const eISO = end.toISOString();
      const revenue = calcPeriodRevenue(invoices, sales, convertedIds, dISO, eISO);
      const exp = activeSupplierInvoices.filter((si) => si.date >= dISO && si.date < eISO).reduce((s, si) => s + (si.total || 0), 0);
      const cashExp = cashMovements.filter((cm) => cm.type === 'expense' && cm.date >= dISO && cm.date < eISO && !cm.sourceType).reduce((s, cm) => s + cm.amount, 0);
      const compExp = activeExpenses.filter((e) => (e.status === 'approved' || e.status === 'paid') && e.date >= dISO && e.date < eISO).reduce((s, e) => s + e.amount, 0);
      const expenses = exp + cashExp + compExp;
      return { label, revenue, expenses, margin: revenue - expenses };
    });
  }, [invoices, sales, activeSupplierInvoices, cashMovements, activeExpenses, now]);

  /** Marge par catégorie produit (pour HorizontalBarChart) */
  const marginByCategory = useMemo(() => {
    const DONUT_PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16', '#F97316'];
    const catMap = new Map<string, { revenue: number; cost: number }>();
    const processSale = (items: { productId?: string; totalTTC: number; quantity?: number }[]) => {
      for (const item of items) {
        const product = activeProducts.find((p) => p.id === item.productId);
        const catName = product?.categoryName || 'Autres';
        const existing = catMap.get(catName) || { revenue: 0, cost: 0 };
        existing.revenue += item.totalTTC;
        existing.cost += (product?.purchasePrice || 0) * (item.quantity || 1);
        catMap.set(catName, existing);
      }
    };
    sales.filter((s) => s.status === 'paid' && s.createdAt >= periodStart).forEach((s) => processSale(s.items));
    invoices.filter((i) => i.status === 'paid' && i.issueDate >= periodStart).forEach((i) => processSale(i.items));
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

  /** Panier moyen sur 6 périodes glissantes */
  const avgBasketEvolution = useMemo(() => {
    const convertedIds = new Set(sales.filter((s) => s.convertedToInvoiceId).map((s) => s.convertedToInvoiceId!));
    const loc = locale === 'en' ? 'en-US' : 'fr-FR';
    const useWeeks = period === 'month' || period === 'week';
    const nbPeriods = 6;
    return Array.from({ length: nbPeriods }, (_, i) => {
      let start: Date, end: Date, label: string;
      if (useWeeks) {
        end = new Date(now);
        end.setDate(end.getDate() - (nbPeriods - 1 - i) * 7);
        start = new Date(end);
        start.setDate(start.getDate() - 7);
        label = `S${Math.ceil((end.getTime() - new Date(end.getFullYear(), 0, 1).getTime()) / (7 * 86400000))}`;
      } else {
        start = new Date(now.getFullYear(), now.getMonth() - (nbPeriods - 1 - i), 1);
        end = new Date(now.getFullYear(), now.getMonth() - (nbPeriods - 1 - i) + 1, 1);
        label = start.toLocaleDateString(loc, { month: 'short' }).replace('.', '');
      }
      const sISO = start.toISOString();
      const eISO = end.toISOString();
      const invRev = invoices.filter((inv) => inv.status === 'paid' && inv.issueDate >= sISO && inv.issueDate < eISO).reduce((s, inv) => s + inv.totalTTC, 0);
      const saleRev = sales.filter((s2) => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO && (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId))).reduce((s, sale) => s + sale.totalTTC, 0);
      const invCount = invoices.filter((inv) => inv.status === 'paid' && inv.issueDate >= sISO && inv.issueDate < eISO).length;
      const saleCount = sales.filter((s2) => s2.status === 'paid' && s2.createdAt >= sISO && s2.createdAt < eISO).length;
      const totalCount = invCount + saleCount;
      return { label, value: totalCount > 0 ? (invRev + saleRev) / totalCount : 0 };
    });
  }, [invoices, sales, now, period, locale]);

  /** Sparkline du solde de trésorerie cumulé sur 6 mois */
  const treasurySparkline = useMemo(() => {
    const convertedIds = new Set(sales.filter((s) => s.convertedToInvoiceId).map((s) => s.convertedToInvoiceId!));
    let runningBalance = 0;
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const dISO = d.toISOString();
      const eISO = end.toISOString();
      const enc = calcPeriodRevenue(invoices, sales, convertedIds, dISO, eISO);
      const dec = activeSupplierInvoices.filter((si) => si.status === 'paid' && si.date >= dISO && si.date < eISO).reduce((s, si) => s + (si.total || 0), 0);
      const compExp = activeExpenses.filter((e) => (e.status === 'approved' || e.status === 'paid') && e.date >= dISO && e.date < eISO).reduce((s, e) => s + e.amount, 0);
      runningBalance += enc - dec - compExp;
      return runningBalance;
    });
  }, [invoices, sales, activeSupplierInvoices, activeExpenses, now]);

  /** Flux mensuels enc/dec sur 6 mois (pour barres stacked trésorerie) */
  const treasuryMonthlyData = useMemo(() => {
    const convertedIds = new Set(sales.filter((s) => s.convertedToInvoiceId).map((s) => s.convertedToInvoiceId!));
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const enc = calcPeriodRevenue(invoices, sales, convertedIds, d.toISOString(), end.toISOString());
      const dec = activeSupplierInvoices.filter((si) => si.status === 'paid' && new Date(si.date) >= d && new Date(si.date) < end).reduce((s, si) => s + (si.total || 0), 0);
      const refDec = sales.filter((s2) => s2.status === 'refunded' && s2.refundedAt && new Date(s2.refundedAt) >= d && new Date(s2.refundedAt) < end).reduce((s, sale) => s + sale.totalTTC, 0);
      const compExp = activeExpenses.filter((e) => (e.status === 'approved' || e.status === 'paid') && new Date(e.date) >= d && new Date(e.date) < end).reduce((s, e) => s + e.amount, 0);
      return { month: label, enc, dec: dec + refDec + compExp };
    });
  }, [invoices, activeSupplierInvoices, sales, activeExpenses, now]);

  const netCashflowSparkline = useMemo(
    () => treasuryMonthlyData.map((d) => d.enc - d.dec),
    [treasuryMonthlyData],
  );

  /** Délai moyen de paiement client sur 6 mois */
  const paymentDelayData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const paidInMonth = invoices.filter((inv) => inv.status === 'paid' && new Date(inv.issueDate) >= d && new Date(inv.issueDate) < end);
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
    const vals = paymentDelayData.filter((d) => d.value > 0);
    return vals.length > 0 ? Math.round(vals.reduce((s, d) => s + d.value, 0) / vals.length) : 0;
  }, [paymentDelayData]);

  // ══════════════════════════════════════════════════════════════════
  // SECTION 7 — SCORE DE SANTÉ FINANCIÈRE
  // ══════════════════════════════════════════════════════════════════

  /** Props pour le composant FinancialHealthScore */
  const healthScoreProps = useMemo(() => {
    const ratio = totalDecaissements > 0 ? totalEncaissements / totalDecaissements : totalEncaissements > 0 ? 10 : 0;
    const runway = monthlyExpensesAvg > 0 ? cashBalance / monthlyExpensesAvg : cashBalance > 0 ? 99 : 0;
    const unpaidRateVal = monthlyRevenue > 0 ? unpaidAmount / monthlyRevenue : unpaidAmount > 0 ? 1 : 0;
    const trend: 'up' | 'stable' | 'down' =
      revenueMonthlyTrend > 0.05 ? 'up' : revenueMonthlyTrend < -0.05 ? 'down' : 'stable';
    return {
      coverageRatio: ratio,
      runwayMonths: Math.max(0, runway),
      unpaidRate: unpaidRateVal,
      revenueTrend: trend,
      grossMarginPositive: grossMargin > 0,
    };
  }, [totalEncaissements, totalDecaissements, monthlyExpensesAvg, cashBalance, monthlyRevenue, unpaidAmount, revenueMonthlyTrend, grossMargin]);

  /** Statut global de santé (vert / orange / rouge) pour le badge header */
  const globalHealthStatus = useMemo((): 'green' | 'orange' | 'red' => {
    if (cashBalance < 0) return 'red';
    const veryLateInvoices = invoices.filter((i) => {
      if (i.status !== 'sent' && i.status !== 'late') return false;
      const daysLate = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
      return daysLate > 30;
    });
    if (veryLateInvoices.length > 0) return 'red';
    if (lowStockProducts.length > 0 || unpaidInvoices.length > 0) return 'orange';
    return 'green';
  }, [cashBalance, invoices, now, lowStockProducts, unpaidInvoices]);

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

  // ─── Retour du hook ───────────────────────────────────────────────────────

  return {
    // Revenus
    paidInvoiceIds,
    acceptedQuotesNotConverted,
    todayStart,
    todayRevenue,
    todaySalesCount,
    yesterdayRevenue,
    yesterdaySalesCount,
    paidSalesNotInvoiced,
    monthlyRevenue,
    prevRevenue,
    revenueChange,
    monthlyExpenses,
    grossMargin,
    paidSalesCount,
    prevSalesCount,
    prevExpenses,
    prevGrossMargin,
    salesCountChange,
    marginChange,
    unpaidInvoices,
    unpaidAmount,
    pendingPurchaseOrders,
    // Sparklines
    revenueSparkline,
    revenueMonthlyTrend,
    salesSparkline,
    // Clients
    clientsToRemindCount,
    priorityClientsToRemind,
    clientRecurrence,
    loyaltyRate,
    // Produits ABC
    getVariantLabel,
    getProductVariantDetails,
    allProducts,
    abcClassification,
    productSparklines7d,
    variantAbcMap,
    lowStockProducts,
    // Trésorerie
    cashBalance,
    treasuryPeriodStart,
    paidInvoicesTreasury,
    paidSupplierInvoicesTreasury,
    salesNotFromInvoicesTreasury,
    refundedSalesTreasury,
    totalEncaissements,
    totalDecaissements,
    totalDecaissementsWithPlanned,
    supplierInvoicesToPayTreasury,
    netCashflow,
    monthlyExpensesAvg,
    expectedCollections,
    // Charts
    sixMonthsData,
    marginByCategory,
    avgBasketEvolution,
    treasurySparkline,
    treasuryMonthlyData,
    netCashflowSparkline,
    paymentDelayData,
    avgPaymentDelay,
    expenseBreakdownSegments,
    // Santé
    healthScoreProps,
    globalHealthStatus,
  };
}