/**
 * @fileoverview SaaS module definitions, plan mappings, and route configuration.
 * Each module has a key, label, description, and associated subscription plans.
 * MODULE_ROUTE_MAP maps module keys to their Expo Router paths.
 * Note: 'shop' module routes to '/boutique' (admin page), NOT '/shop' (public storefront).
 */
import type { ModuleConfig, SubscriptionPlan } from '@/types';

export const MODULE_CONFIGS: ModuleConfig[] = [
  {
    key: 'dashboard',
    label: 'Tableau de bord',
    description: 'Vue d\'ensemble de votre activité avec KPIs et graphiques',
    alwaysEnabled: true,
    plans: ['starter', 'pro', 'business'],
  },
  {
    key: 'ventes',
    label: 'Ventes',
    description: 'Clients, devis, factures émises, avoirs et relances',
    alwaysEnabled: false,
    plans: ['starter', 'pro', 'business'],
  },
  {
    key: 'achats',
    label: 'Achats',
    description: 'Fournisseurs, commandes fournisseur et factures reçues',
    alwaysEnabled: false,
    plans: ['starter', 'pro', 'business'],
  },
  {
    key: 'stock',
    label: 'Produits & Stock',
    description: 'Catalogue, inventaire et mouvements de stock',
    alwaysEnabled: false,
    plans: ['starter', 'pro', 'business'],
  },
  {
    key: 'sales',
    label: 'Caisse (POS)',
    description: 'Point de vente pour les encaissements directs',
    alwaysEnabled: false,
    plans: ['pro', 'business'],
  },
  {
    key: 'shop',
    label: 'Boutique en ligne',
    description: 'Vitrine publique, commandes en ligne et gestion boutique',
    alwaysEnabled: false,
    plans: ['starter', 'pro', 'business'],
  },
  {
    key: 'payments',
    label: 'Paiements',
    description: 'Paiements en ligne via Stripe et CinetPay (Wave, Orange Money, CB)',
    alwaysEnabled: false,
    plans: ['pro', 'business'],
  },
  {
    key: 'staff',
    label: 'Équipe',
    description: 'Gestion des employés, plannings et fiches de paie',
    alwaysEnabled: false,
    plans: ['pro', 'business'],
  },
  {
    key: 'settings',
    label: 'Paramètres',
    description: 'Configuration de l\'entreprise et préférences',
    alwaysEnabled: true,
    plans: ['starter', 'pro', 'business'],
  },
  {
    key: 'admin',
    label: 'Administration',
    description: 'Journaux d\'audit, utilisateurs et abonnement',
    alwaysEnabled: false,
    plans: ['business'],
  },
];

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

export const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  starter: '#6B7280',
  pro: '#2563EB',
  business: '#7C3AED',
};

export const MODULE_ROUTE_MAP: Record<string, string> = {
  dashboard: '/',
  ventes: '/ventes',
  achats: '/achats',
  stock: '/stock',
  sales: '/sales',
  clients: '/clients',
  products: '/products',
  quotes: '/quotes',
  invoices: '/invoices',
  cashflow: '/cashflow',
  shop: '/boutique',
  payments: '/payments',
  staff: '/staff',
  settings: '/settings',
  admin: '/admin',
};

export function getModuleForRoute(route: string): string | undefined {
  for (const [moduleKey, moduleRoute] of Object.entries(MODULE_ROUTE_MAP)) {
    if (route === moduleRoute || (moduleRoute !== '/' && route.startsWith(moduleRoute))) {
      return moduleKey;
    }
  }
  if (route === '/' || route === '') return 'dashboard';
  return undefined;
}

export function isModuleAvailableForPlan(moduleKey: string, plan: SubscriptionPlan): boolean {
  const config = MODULE_CONFIGS.find((m) => m.key === moduleKey);
  if (!config) return false;
  return config.plans.includes(plan);
}
