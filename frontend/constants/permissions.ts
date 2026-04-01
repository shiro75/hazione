import type { UserRole, ModuleKey } from '@/types';

export interface RolePermissions {
  label: string;
  description: string;
  allowedModules: ModuleKey[];
  canDeleteCompany: boolean;
  canManageSubscription: boolean;
  canManageEmployees: boolean;
  canSeePurchasePrice: boolean;
  canSeeMargin: boolean;
  canExportReports: boolean;
  canEditData: boolean;
  simplifiedDashboard: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    label: 'Propriétaire',
    description: 'Accès complet à toutes les fonctionnalités',
    allowedModules: ['dashboard', 'clients', 'products', 'sales', 'quotes', 'invoices', 'cashflow', 'settings', 'admin', 'ventes', 'achats', 'stock', 'shop'],
    canDeleteCompany: true,
    canManageSubscription: true,
    canManageEmployees: true,
    canSeePurchasePrice: true,
    canSeeMargin: true,
    canExportReports: true,
    canEditData: true,
    simplifiedDashboard: false,
  },
  manager: {
    label: 'Gérant',
    description: 'Accès à tout sauf suppression entreprise et abonnement',
    allowedModules: ['dashboard', 'clients', 'products', 'sales', 'quotes', 'invoices', 'cashflow', 'settings', 'admin', 'ventes', 'achats', 'stock', 'shop'],
    canDeleteCompany: false,
    canManageSubscription: false,
    canManageEmployees: true,
    canSeePurchasePrice: true,
    canSeeMargin: true,
    canExportReports: true,
    canEditData: true,
    simplifiedDashboard: false,
  },
  employee: {
    label: 'Caissier',
    description: 'Caisse, ventes, catalogue produits, clients, dashboard simplifié',
    allowedModules: ['dashboard', 'sales', 'ventes', 'stock', 'clients'],
    canDeleteCompany: false,
    canManageSubscription: false,
    canManageEmployees: false,
    canSeePurchasePrice: false,
    canSeeMargin: false,
    canExportReports: false,
    canEditData: true,
    simplifiedDashboard: true,
  },
  accountant: {
    label: 'Comptable',
    description: 'Ventes, achats, trésorerie (lecture seule), dashboard complet, exports',
    allowedModules: ['dashboard', 'ventes', 'achats', 'cashflow'],
    canDeleteCompany: false,
    canManageSubscription: false,
    canManageEmployees: false,
    canSeePurchasePrice: true,
    canSeeMargin: true,
    canExportReports: true,
    canEditData: false,
    simplifiedDashboard: false,
  },
};

export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.admin;
}

export function canAccessModule(role: UserRole, moduleKey: ModuleKey): boolean {
  const perms = getRolePermissions(role);
  return perms.allowedModules.includes(moduleKey);
}

export function canAccessRoute(role: UserRole, route: string): boolean {
  const routeToModule: Record<string, ModuleKey> = {
    '/': 'dashboard',
    '/ventes': 'ventes',
    '/achats': 'achats',
    '/stock': 'stock',
    '/sales': 'sales',
    '/clients': 'clients',
    '/products': 'products',
    '/quotes': 'quotes',
    '/invoices': 'invoices',
    '/cashflow': 'cashflow',
    '/boutique': 'shop',
    '/settings': 'settings',
    '/admin': 'admin',
  };

  const moduleKey = routeToModule[route];
  if (!moduleKey) return true;
  return canAccessModule(role, moduleKey);
}
