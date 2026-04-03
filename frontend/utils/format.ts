/**
 * Utilitaires de formatage : téléphone, devises, dates, statuts, export FEC.
 * Tous les formateurs utilisent la locale française par défaut.
 */

import { COUNTRY_CODES } from '@/constants/countryCodes';

function getFlagForDialCode(dialCode: string): string {
  const cc = COUNTRY_CODES.find(c => c.dialCode === dialCode);
  return cc?.flag ?? '';
}

export function formatPhone(phone: string): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\s/g, '');
  const match = cleaned.match(/^(\+\d{1,4})(\d+)$/);
  if (!match) return phone;
  const prefix = match[1];
  const digits = match[2];
  const flag = getFlagForDialCode(prefix);
  const groups: string[] = [];
  let start = 0;
  if (digits.length % 2 === 1) {
    groups.push(digits.slice(0, 1));
    start = 1;
  }
  for (let i = start; i < digits.length; i += 2) {
    groups.push(digits.slice(i, i + 2));
  }
  return `${flag ? flag + ' ' : ''}${prefix} ${groups.join(' ')}`;
}

export function formatCurrency(amount: number, currency: string = 'EUR', appLocale?: string): string {
  const locale = appLocale === 'en' ? (currency === 'CHF' ? 'en-CH' : 'en-US') : (currency === 'CHF' ? 'fr-CH' : 'fr-FR');
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyInteger(amount: number, currency: string = 'EUR', appLocale?: string): string {
  const locale = appLocale === 'en' ? (currency === 'CHF' ? 'en-CH' : 'en-US') : (currency === 'CHF' ? 'fr-CH' : 'fr-FR');
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatDate(dateString: string, appLocale?: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(appLocale === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateLong(dateString: string, appLocale?: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(appLocale === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string, appLocale?: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(appLocale === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(num: number, appLocale?: string): string {
  return new Intl.NumberFormat(appLocale === 'en' ? 'en-US' : 'fr-FR').format(num);
}

export function formatIntegerAmount(amount: number, appLocale?: string): string {
  return new Intl.NumberFormat(appLocale === 'en' ? 'en-US' : 'fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Retourne le symbole court d'une devise ISO 4217.
 * Exemples : EUR -> €, USD -> $, XOF -> FCFA
 */
export function getCurrencySymbol(currency: string = 'EUR'): string {
  const knownSymbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: 'CHF',
    XOF: 'FCFA',
    XAF: 'FCFA',
    CAD: 'CA$',
    MAD: 'MAD',
    TND: 'TND',
  };
  if (knownSymbols[currency]) return knownSymbols[currency];
  try {
    const parts = new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).formatToParts(0);
    const sym = parts.find(p => p.type === 'currency');
    return sym?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatPercent(num: number): string {
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
}

export function formatVATRate(rate: number): string {
  return `${rate.toString().replace('.', ',')}%`;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Brouillon',
    sent: 'Envoyée',
    paid: 'Payée',
    late: 'En retard',
    cancelled: 'Annulée',
    validated: 'Validée',
    active: 'Actif',
    inactive: 'Inactif',
    accepted: 'Accepté',
    refused: 'Refusé',
    expired: 'Expiré',
    trialing: 'Essai',
    past_due: 'Impayé',
    refunded: 'Remboursée',
    received: 'Reçue',
    to_pay: 'À payer',
    partial: 'Partielle',
    partially_paid: 'Paiement partiel',
  };
  return labels[status] || status;
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Espèces',
    card: 'Carte bancaire',
    transfer: 'Virement',
    twint: 'TWINT',
    bank_transfer: 'Virement',
    check: 'Chèque',
    mobile: 'Mobile Money',
    mobile_wave: 'Wave',
    mobile_om: 'Orange Money',
    mixed: 'Paiement mixte',
    stripe: 'Stripe',
  };
  return labels[method] || method;
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Propriétaire',
    manager: 'Gérant',
    employee: 'Caissier',
    accountant: 'Comptable',
  };
  return labels[role] || role;
}

export function getExpenseCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    office: 'Bureau',
    travel: 'Déplacements',
    marketing: 'Marketing',
    software: 'Logiciels',
    salary: 'Salaires',
    rent: 'Loyer',
    insurance: 'Assurance',
    taxes: 'Taxes',
    other: 'Autre',
  };
  return labels[category] || category;
}

export function getReminderTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    payment_due: 'Échéance proche',
    payment_overdue_7: 'Retard 7 jours',
    payment_overdue_14: 'Retard 14 jours',
    payment_overdue_30: 'Retard 30 jours',
  };
  return labels[type] || type;
}

export function getPaymentConditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    immediate: 'Comptant',
    net_15: '15 jours net',
    net_30: '30 jours net',
    net_45: '45 jours net',
    net_60: '60 jours net',
    net_90: '90 jours net',
    end_of_month: 'Fin de mois',
    end_of_month_30: 'Fin de mois + 30j',
  };
  return labels[condition] || condition;
}

export function daysUntil(dateString: string): number {
  const now = new Date();
  const target = new Date(dateString);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateString: string): boolean {
  return daysUntil(dateString) < 0;
}

/**
 * Génère un export FEC (Fichier des Écritures Comptables) au format CSV.
 * Requis par l'administration fiscale française.
 */
export function generateFECExport(data: {
  movements: Array<{
    id: string;
    date: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    reference?: string;
  }>;
  companyName: string;
  siret: string;
  startDate: string;
  endDate: string;
  currency?: string;
}): string {
  const SEP = ';';
  const cur = data.currency || 'EUR';
  const headers = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
    'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
    'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
    'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
  ];

  const rows: string[] = [];
  data.movements.forEach((m, idx) => {
    const date = new Date(m.date);
    const fmtDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const ecritureNum = String(idx + 1).padStart(6, '0');
    const desc = m.description.replace(/;/g, ',');
    const montant = m.amount.toFixed(2).replace('.', ',');

    if (m.type === 'income') {
      rows.push([
        'VE', 'Ventes', ecritureNum, fmtDate,
        '411000', 'Clients', '', '',
        m.reference || m.id, fmtDate, desc, montant, '0,00',
        '', '', fmtDate, montant, cur,
      ].join(SEP));
      rows.push([
        'VE', 'Ventes', ecritureNum, fmtDate,
        '701000', 'Ventes de produits finis', '', '',
        m.reference || m.id, fmtDate, desc, '0,00', montant,
        '', '', fmtDate, montant, cur,
      ].join(SEP));
    } else {
      rows.push([
        'AC', 'Achats', ecritureNum, fmtDate,
        '607000', 'Achats de marchandises', '', '',
        m.reference || m.id, fmtDate, desc, montant, '0,00',
        '', '', fmtDate, montant, cur,
      ].join(SEP));
      rows.push([
        'AC', 'Achats', ecritureNum, fmtDate,
        '401000', 'Fournisseurs', '', '',
        m.reference || m.id, fmtDate, desc, '0,00', montant,
        '', '', fmtDate, montant, cur,
      ].join(SEP));
    }
  });

  return [headers.join(SEP), ...rows].join('\n');
}
