/**
 * hooks/useDashboardExports.ts
 *
 * Centralise les 4 handlers d'export du tableau de bord :
 *   - FEC (fichier comptable CSV)
 *   - Rapport ventes (PDF)
 *   - Rapport stock (PDF)
 *   - Rapport financier (PDF)
 */

import { useCallback } from 'react';
import { Platform, Share } from 'react-native';
import { generateFECExport } from '@/utils/format';
import {
  generateSalesReportHTML,
  generateStockReportHTML,
  generateFinancialReportHTML,
  generateAndSharePDF,
} from '@/services/pdfService';
import type { PeriodFilter } from '@/types/dashboard.types';

interface UseDashboardExportsParams {
  // Contexte entreprise
  company: { name?: string; siret?: string; currency?: string };
  currency: string;
  now: Date;
  period: PeriodFilter;
  // Données
  sales: any[];
  invoices: any[];
  clients: any[];
  activeProducts: any[];
  allMovements: any[];
  treasuryPeriodStart: Date;
  // KPIs
  monthlyRevenue: number;
  monthlyExpenses: number;
  unpaidAmount: number;
  netCashflow: number;
  cashBalance: number;
  abcClassification: { name: string; ca: number; abc: 'A' | 'B' | 'C'; margin: number }[];
  unpaidInvoices: any[];
  expenseBreakdownSegments: { label: string; value: number }[];
  projectionData: { label: string; projected?: number }[];
  healthScoreProps: {
    coverageRatio: number;
    runwayMonths: number;
    unpaidRate: number;
    revenueTrend: 'up' | 'stable' | 'down';
    grossMarginPositive: boolean;
  };
  // Callbacks UI
  successAlert: (title: string, message: string) => void;
  errorAlert: (title: string, message: string) => void;
}

/** Labels des périodes pour les rapports PDF */
const PERIOD_LABELS: Record<PeriodFilter, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  quarter: 'Ce trimestre',
  year: 'Cette année',
};

export function useDashboardExports({
  company, currency, now, period,
  sales, invoices, clients, activeProducts, allMovements, treasuryPeriodStart,
  monthlyRevenue, monthlyExpenses, unpaidAmount, netCashflow, cashBalance,
  abcClassification, unpaidInvoices, expenseBreakdownSegments, projectionData,
  healthScoreProps, successAlert, errorAlert,
}: UseDashboardExportsParams) {

  /**
   * Calcule le score de santé financière (0–100) à partir des KPIs.
   * Utilisé dans les rapports PDF pour donner une note globale.
   */
  const computeHealthScore = useCallback(() => {
    let s = 0;
    const hp = healthScoreProps;

    // Ratio couverture encaissements / décaissements (max 30 pts)
    if (hp.coverageRatio >= 1.5) s += 30;
    else if (hp.coverageRatio >= 1) s += 20;
    else if (hp.coverageRatio >= 0.5) s += 10;

    // Runway en mois (max 25 pts)
    if (hp.runwayMonths >= 6) s += 25;
    else if (hp.runwayMonths >= 3) s += 15;
    else if (hp.runwayMonths >= 1) s += 8;

    // Taux d'impayés (max 20 pts)
    if (hp.unpaidRate < 0.1) s += 20;
    else if (hp.unpaidRate < 0.3) s += 10;
    else if (hp.unpaidRate < 0.6) s += 5;

    // Tendance du CA (max 15 pts)
    if (hp.revenueTrend === 'up') s += 15;
    else if (hp.revenueTrend === 'stable') s += 10;

    // Marge brute positive (max 10 pts)
    if (hp.grossMarginPositive) s += 10;

    return s;
  }, [healthScoreProps]);

  /** Export FEC (Fichier d'Écriture Comptable) au format CSV */
  const handleExportFEC = useCallback(async () => {
    try {
      const movements = allMovements.map((m) => ({
        id: m.id, date: m.date, type: m.type,
        amount: m.amount, description: m.description, reference: m.source,
      }));
      const fecContent = generateFECExport({
        movements,
        companyName: company.name || 'Mon entreprise',
        siret: company.siret || '',
        startDate: treasuryPeriodStart.toISOString(),
        endDate: now.toISOString(),
        currency,
      });

      if (Platform.OS === 'web') {
        const blob = new Blob([fecContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FEC_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        successAlert('Export FEC', 'Fichier FEC téléchargé');
      } else {
        await Share.share({ message: fecContent, title: 'Export FEC' });
      }
    } catch {
      errorAlert('Erreur', "Impossible de générer l'export FEC");
    }
  }, [allMovements, company, treasuryPeriodStart, now, currency, successAlert, errorAlert]);

  /** Rapport de ventes au format PDF */
  const handleExportSalesReport = useCallback(async () => {
    const unpaidInvoicesList = unpaidInvoices.map((i) => ({
      clientName: i.clientName || 'Client',
      amount: i.totalTTC - i.paidAmount,
      dueDate: i.dueDate,
    }));
    const html = generateSalesReportHTML({
      company, sales, invoices, clients,
      periodLabel: PERIOD_LABELS[period],
      currency,
      healthScore: computeHealthScore(),
      coverageRatio: healthScoreProps.coverageRatio,
      unpaidAmount,
      expenses: monthlyExpenses,
      abcProducts: abcClassification.map((p) => ({ name: p.name, ca: p.ca, abc: p.abc, margin: p.margin })),
      unpaidInvoicesList,
    });
    await generateAndSharePDF(html, `Rapport_Ventes_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, sales, invoices, clients, period, currency, computeHealthScore, healthScoreProps, unpaidAmount, monthlyExpenses, abcClassification, unpaidInvoices]);

  /** Rapport de stock au format PDF */
  const handleExportStockReport = useCallback(async () => {
    const html = generateStockReportHTML({ company, products: activeProducts, currency });
    await generateAndSharePDF(html, `Rapport_Stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, activeProducts, currency]);

  /** Rapport financier complet au format PDF */
  const handleExportFinancialReport = useCallback(async () => {
    const unpaidInvoicesList = unpaidInvoices.map((i) => ({
      clientName: i.clientName || 'Client',
      amount: i.totalTTC - i.paidAmount,
      dueDate: i.dueDate,
    }));
    const html = generateFinancialReportHTML({
      company,
      revenue: monthlyRevenue,
      expenses: monthlyExpenses,
      unpaidAmount,
      periodLabel: PERIOD_LABELS[period],
      currency,
      healthScore: computeHealthScore(),
      coverageRatio: healthScoreProps.coverageRatio,
      netCashflow,
      cashBalance,
      runwayMonths: healthScoreProps.runwayMonths,
      expenseBreakdown: expenseBreakdownSegments,
      unpaidInvoicesList,
      projectionData: projectionData.map((d) => ({ label: d.label, projected: d.projected })),
    });
    await generateAndSharePDF(html, `Rapport_Financier_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [company, monthlyRevenue, monthlyExpenses, unpaidAmount, period, currency, computeHealthScore, healthScoreProps, netCashflow, cashBalance, expenseBreakdownSegments, unpaidInvoices, projectionData]);

  return {
    computeHealthScore,
    handleExportFEC,
    handleExportSalesReport,
    handleExportStockReport,
    handleExportFinancialReport,
  };
}