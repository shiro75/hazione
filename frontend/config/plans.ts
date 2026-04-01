export type PlanId = 'solo' | 'pro' | 'business';

export type BillingInterval = 'monthly' | 'annual';

export type SubscriptionStatus = 'trial' | 'active' | 'canceled' | 'expired';

export interface PlanFeature {
  key: string;
  labelFr: string;
  labelEn: string;
  included: boolean;
}

export interface PlanLimits {
  maxClients: number | null;
  maxInvoicesPerMonth: number | null;
  maxUsers: number | null;
}

export interface PlanConfig {
  id: PlanId;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  monthlyPrice: number;
  annualPricePerMonth: number;
  stripeMonthlyPriceId: string;
  stripeAnnualPriceId: string;
  popular: boolean;
  limits: PlanLimits;
  features: PlanFeature[];
  color: string;
  iconBg: string;
}

export const TRIAL_DAYS = 14;
export const DEFAULT_TRIAL_PLAN: PlanId = 'pro';

export const PLANS: Record<PlanId, PlanConfig> = {
  solo: {
    id: 'solo',
    nameFr: 'Solo',
    nameEn: 'Solo',
    descriptionFr: 'Pour démarrer votre activité',
    descriptionEn: 'To start your business',
    monthlyPrice: 9,
    annualPricePerMonth: 7,
    stripeMonthlyPriceId: 'price_solo_monthly',
    stripeAnnualPriceId: 'price_solo_annual',
    popular: false,
    limits: {
      maxClients: 50,
      maxInvoicesPerMonth: 30,
      maxUsers: 1,
    },
    features: [
      { key: 'clients', labelFr: '50 clients max', labelEn: '50 clients max', included: true },
      { key: 'invoices', labelFr: '30 factures/mois', labelEn: '30 invoices/month', included: true },
      { key: 'quotes', labelFr: 'Devis', labelEn: 'Quotes', included: true },
      { key: 'export_pdf', labelFr: 'Export PDF', labelEn: 'PDF export', included: true },
      { key: 'stripe_payment', labelFr: 'Paiement Stripe', labelEn: 'Stripe payment', included: false },
      { key: 'auto_reminders', labelFr: 'Relances automatiques', labelEn: 'Auto reminders', included: false },
      { key: 'quote_signature', labelFr: 'Signature devis', labelEn: 'Quote signature', included: false },
      { key: 'advanced_dashboard', labelFr: 'Dashboard avancé', labelEn: 'Advanced dashboard', included: false },
      { key: 'recurring_invoices', labelFr: 'Factures récurrentes', labelEn: 'Recurring invoices', included: false },
      { key: 'multi_users', labelFr: 'Multi-utilisateurs', labelEn: 'Multi-users', included: false },
    ],
    color: '#6B7280',
    iconBg: '#F3F4F6',
  },
  pro: {
    id: 'pro',
    nameFr: 'Pro',
    nameEn: 'Pro',
    descriptionFr: 'Pour les professionnels exigeants',
    descriptionEn: 'For demanding professionals',
    monthlyPrice: 19,
    annualPricePerMonth: 15,
    stripeMonthlyPriceId: 'price_pro_monthly',
    stripeAnnualPriceId: 'price_pro_annual',
    popular: true,
    limits: {
      maxClients: null,
      maxInvoicesPerMonth: null,
      maxUsers: 1,
    },
    features: [
      { key: 'clients', labelFr: 'Clients illimités', labelEn: 'Unlimited clients', included: true },
      { key: 'invoices', labelFr: 'Factures illimitées', labelEn: 'Unlimited invoices', included: true },
      { key: 'quotes', labelFr: 'Devis', labelEn: 'Quotes', included: true },
      { key: 'export_pdf', labelFr: 'Export PDF', labelEn: 'PDF export', included: true },
      { key: 'stripe_payment', labelFr: 'Paiement Stripe', labelEn: 'Stripe payment', included: true },
      { key: 'auto_reminders', labelFr: 'Relances automatiques', labelEn: 'Auto reminders', included: true },
      { key: 'quote_signature', labelFr: 'Signature devis', labelEn: 'Quote signature', included: true },
      { key: 'advanced_dashboard', labelFr: 'Dashboard avancé', labelEn: 'Advanced dashboard', included: true },
      { key: 'recurring_invoices', labelFr: 'Factures récurrentes', labelEn: 'Recurring invoices', included: false },
      { key: 'multi_users', labelFr: 'Multi-utilisateurs', labelEn: 'Multi-users', included: false },
    ],
    color: '#2563EB',
    iconBg: '#DBEAFE',
  },
  business: {
    id: 'business',
    nameFr: 'Business',
    nameEn: 'Business',
    descriptionFr: 'Pour les équipes et la croissance',
    descriptionEn: 'For teams and growth',
    monthlyPrice: 39,
    annualPricePerMonth: 29,
    stripeMonthlyPriceId: 'price_business_monthly',
    stripeAnnualPriceId: 'price_business_annual',
    popular: false,
    limits: {
      maxClients: null,
      maxInvoicesPerMonth: null,
      maxUsers: 3,
    },
    features: [
      { key: 'clients', labelFr: 'Clients illimités', labelEn: 'Unlimited clients', included: true },
      { key: 'invoices', labelFr: 'Factures illimitées', labelEn: 'Unlimited invoices', included: true },
      { key: 'quotes', labelFr: 'Devis', labelEn: 'Quotes', included: true },
      { key: 'export_pdf', labelFr: 'Export PDF', labelEn: 'PDF export', included: true },
      { key: 'stripe_payment', labelFr: 'Paiement Stripe', labelEn: 'Stripe payment', included: true },
      { key: 'auto_reminders', labelFr: 'Relances automatiques', labelEn: 'Auto reminders', included: true },
      { key: 'quote_signature', labelFr: 'Signature devis', labelEn: 'Quote signature', included: true },
      { key: 'advanced_dashboard', labelFr: 'Dashboard avancé', labelEn: 'Advanced dashboard', included: true },
      { key: 'recurring_invoices', labelFr: 'Factures récurrentes', labelEn: 'Recurring invoices', included: true },
      { key: 'multi_users', labelFr: 'Multi-utilisateurs (3 max)', labelEn: 'Multi-users (3 max)', included: true },
    ],
    color: '#7C3AED',
    iconBg: '#EDE9FE',
  },
};

export const PLAN_ORDER: PlanId[] = ['solo', 'pro', 'business'];

export function getPlanConfig(planId: PlanId): PlanConfig {
  return PLANS[planId];
}

export function isFeatureAvailable(planId: PlanId, featureKey: string): boolean {
  const plan = PLANS[planId];
  if (!plan) return false;
  const feature = plan.features.find((f) => f.key === featureKey);
  return feature?.included ?? false;
}

export function getRequiredPlanForFeature(featureKey: string): PlanId | null {
  for (const id of PLAN_ORDER) {
    const plan = PLANS[id];
    const feature = plan.features.find((f) => f.key === featureKey);
    if (feature?.included) return id;
  }
  return null;
}

export function getPlanPrice(planId: PlanId, interval: BillingInterval): number {
  const plan = PLANS[planId];
  return interval === 'monthly' ? plan.monthlyPrice : plan.annualPricePerMonth;
}

export function getAnnualSavings(planId: PlanId): number {
  const plan = PLANS[planId];
  return (plan.monthlyPrice - plan.annualPricePerMonth) * 12;
}

export function canAccessWithPlan(currentPlan: PlanId, requiredPlan: PlanId): boolean {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const requiredIndex = PLAN_ORDER.indexOf(requiredPlan);
  return currentIndex >= requiredIndex;
}
