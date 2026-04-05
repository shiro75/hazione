/**
 * utils/dashboardHelpers.ts
 *
 * Fonctions pures utilisées par le Dashboard.
 * Aucune dépendance React — testables unitairement.
 *
 * EXPORTS :
 *   extractFirstName     — extrait le prénom depuis les metadata Supabase
 *   getPeriodStart       — date de début d'une période filtre
 *   getPreviousPeriodRange — plage de la période précédente pour comparaison
 *   calcPeriodRevenue    — CA sur une plage ISO (invoices + sales, dédupliqués)
 */

import type { PeriodFilter } from '@/types/dashboard.types';

// ─── Types locaux ────────────────────────────────────────────────────────────

interface InvoiceLike {
  status: string;
  issueDate: string;
  totalTTC: number;
  items: { productId?: string; totalTTC: number; quantity?: number }[];
}

interface SaleLike {
  status: string;
  createdAt: string;
  totalTTC: number;
  convertedToInvoiceId?: string;
  items: { productId?: string; totalTTC: number; quantity?: number }[];
}

interface QuoteLike {
  status: string;
  acceptedAt?: string;
  convertedToInvoiceId?: string;
  totalTTC: number;
}

// ─── Extraction du prénom ─────────────────────────────────────────────────────

/**
 * Extrait le prénom de l'utilisateur depuis ses métadonnées Supabase.
 * Retourne null si aucun nom n'est disponible.
 */
export function extractFirstName(
  user: { user_metadata?: Record<string, unknown>; email?: string } | null,
): string | null {
  if (!user) return null;
  const fullName = user.user_metadata?.full_name as string | undefined;
  if (fullName?.trim()) return fullName.trim();
  return null;
}

// ─── Calcul des périodes ──────────────────────────────────────────────────────

/**
 * Retourne la date de début ISO de la période sélectionnée.
 * Utilisé pour filtrer les données du tableau de bord.
 */
export function getPeriodStart(now: Date, period: PeriodFilter): Date {
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case 'today':
      return new Date(y, m, now.getDate());
    case 'week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return new Date(y, m, now.getDate() - mondayOffset);
    }
    case 'month':
      return new Date(y, m, 1);
    case 'quarter':
      return new Date(y, Math.floor(m / 3) * 3, 1);
    case 'year':
    default:
      return new Date(y, 0, 1);
  }
}

/**
 * Retourne la plage { start, end } de la période précédente.
 * Utilisé pour calculer les variations (%) entre deux périodes.
 */
export function getPreviousPeriodRange(
  now: Date,
  period: PeriodFilter,
): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case 'today': {
      const yesterday = new Date(y, m, now.getDate() - 1);
      return { start: yesterday, end: new Date(y, m, now.getDate()) };
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(y, m, now.getDate() - mondayOffset);
      const prevMonday = new Date(thisMonday);
      prevMonday.setDate(prevMonday.getDate() - 7);
      return { start: prevMonday, end: thisMonday };
    }
    case 'month':
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
    case 'quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { start: new Date(y, qStart - 3, 1), end: new Date(y, qStart, 1) };
    }
    case 'year':
    default:
      return { start: new Date(y - 1, 0, 1), end: new Date(y, 0, 1) };
  }
}

// ─── Calcul du CA ─────────────────────────────────────────────────────────────

/**
 * Calcule le CA (TTC) sur une plage ISO, en dédupliquant les ventes
 * converties en factures pour éviter le double-comptage.
 *
 * @param invoices       - Toutes les factures
 * @param sales          - Toutes les ventes
 * @param paidInvoiceIds - Set des IDs de factures payées (pour dédup)
 * @param startISO       - Début de la plage (ISO string)
 * @param endISO         - Fin de la plage (ISO string)
 * @param quotes         - Devis acceptés non convertis (optionnel)
 */
export function calcPeriodRevenue(
  invoices: InvoiceLike[],
  sales: SaleLike[],
  paidInvoiceIds: Set<string>,
  startISO: string,
  endISO: string,
  quotes?: QuoteLike[],
): number {
  const invRev = invoices
    .filter((i) => i.status === 'paid' && i.issueDate >= startISO && i.issueDate < endISO)
    .reduce((s, i) => s + i.totalTTC, 0);

  const saleRev = sales
    .filter(
      (s) =>
        s.status === 'paid' &&
        s.createdAt >= startISO &&
        s.createdAt < endISO &&
        (!s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId)),
    )
    .reduce((s, sale) => s + sale.totalTTC, 0);

  const quoteRev = quotes
    ? quotes
        .filter(
          (q) =>
            q.status === 'accepted' &&
            !q.convertedToInvoiceId &&
            q.acceptedAt &&
            q.acceptedAt >= startISO &&
            q.acceptedAt < endISO,
        )
        .reduce((s, q) => s + q.totalTTC, 0)
    : 0;

  return invRev + saleRev + quoteRev;
}

/**
 * Calcule le CA filtré par catégorie produit sur une plage ISO.
 * Utilisé pour le graphique de période quand un filtre catégorie est actif.
 */
export function calcPeriodRevenueByCategory(
  invoices: InvoiceLike[],
  sales: SaleLike[],
  convertedIds: Set<string>,
  startISO: string,
  endISO: string,
  categoryName: string,
  activeProducts: { id: string; categoryName?: string }[],
): number {
  const getItemRevForCategory = (
    items: { productId?: string; totalTTC: number }[],
  ) =>
    items.reduce((sum, item) => {
      const product = activeProducts.find((p) => p.id === item.productId);
      const catName = product?.categoryName || 'Autres';
      return catName === categoryName ? sum + item.totalTTC : sum;
    }, 0);

  const invRev = invoices
    .filter((i) => i.status === 'paid' && i.issueDate >= startISO && i.issueDate < endISO)
    .reduce((s, i) => s + getItemRevForCategory(i.items), 0);

  const saleRev = sales
    .filter(
      (s) =>
        s.status === 'paid' &&
        s.createdAt >= startISO &&
        s.createdAt < endISO &&
        (!s.convertedToInvoiceId || !convertedIds.has(s.convertedToInvoiceId)),
    )
    .reduce((s, sale) => s + getItemRevForCategory(sale.items), 0);

  return invRev + saleRev;
}