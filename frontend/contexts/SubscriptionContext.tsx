import { useState, useCallback, useEffect, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Linking, Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  PLANS, TRIAL_DAYS, DEFAULT_TRIAL_PLAN,
  isFeatureAvailable, getRequiredPlanForFeature, canAccessWithPlan,
  type PlanId, type BillingInterval, type SubscriptionStatus,
} from '@/config/plans';


const STORAGE_KEY = '@hazione_subscription';

interface SubscriptionRecord {
  userId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  stripeSubscriptionId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  licenseCode: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionState {
  plan: PlanId;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
  licenseCode: string | null;
  isLoading: boolean;
  trialDaysRemaining: number;
  isTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
  hasFeature: (featureKey: string) => boolean;
  canAccess: (requiredPlan: PlanId) => boolean;
  getRequiredPlan: (featureKey: string) => PlanId | null;
  checkLimit: (type: 'clients' | 'invoices' | 'users', currentCount: number) => { allowed: boolean; limit: number | null };
  startTrial: () => Promise<void>;
  selectPlan: (planId: PlanId, interval: BillingInterval) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  activateLicense: (code: string) => Promise<{ success: boolean; error?: string }>;
  showUpgradeRequired: boolean;
  setShowUpgradeRequired: (show: boolean) => void;
  requiredPlanForUpgrade: PlanId | null;
  setRequiredPlanForUpgrade: (plan: PlanId | null) => void;
  requireUpgrade: (featureKey: string) => boolean;
}

function calculateTrialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export const [SubscriptionProvider, useSubscription] = createContextHook((): SubscriptionState => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  const [_paymentError, setPaymentError] = useState<string | null>(null);

  const [plan, setPlan] = useState<PlanId>(DEFAULT_TRIAL_PLAN);
  const [status, setStatus] = useState<SubscriptionStatus>('trial');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [licenseCode, setLicenseCode] = useState<string | null>(null);
  const [showUpgradeRequired, setShowUpgradeRequired] = useState<boolean>(false);
  const [requiredPlanForUpgrade, setRequiredPlanForUpgrade] = useState<PlanId | null>(null);

  const subscriptionQuery = useQuery({
    queryKey: ['subscription', userId],
    queryFn: async (): Promise<SubscriptionRecord | null> => {
      if (!isSupabaseConfigured || !userId) {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            return JSON.parse(stored) as SubscriptionRecord;
          } catch {
            return null;
          }
        }
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) return JSON.parse(stored) as SubscriptionRecord;
          return null;
        }

        if (data) {
          const record: SubscriptionRecord = {
            userId: data.user_id,
            plan: data.plan as PlanId,
            status: data.status as SubscriptionStatus,
            stripeSubscriptionId: data.stripe_subscription_id,
            trialEndsAt: data.trial_ends_at,
            currentPeriodEnd: data.current_period_end,
            licenseCode: data.license_code,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
          return record;
        }
      } catch {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored) as SubscriptionRecord;
      }

      return null;
    },
    enabled: !!userId,
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const record = subscriptionQuery.data;
    if (record) {
      setPlan(record.plan);
      setStatus(record.status);
      setTrialEndsAt(record.trialEndsAt);
      setCurrentPeriodEnd(record.currentPeriodEnd);
      setStripeSubscriptionId(record.stripeSubscriptionId);
      setLicenseCode(record.licenseCode);

      if (record.status === 'trial' && record.trialEndsAt) {
        const remaining = calculateTrialDaysRemaining(record.trialEndsAt);
        if (remaining <= 0) {
          setPlan('solo');
          setStatus('expired');
        }
      }
    } else if (subscriptionQuery.isFetched && userId) {
      setPlan(DEFAULT_TRIAL_PLAN);
      setStatus('trial');
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
      setTrialEndsAt(trialEnd.toISOString());
    }
  }, [subscriptionQuery.data, subscriptionQuery.isFetched, userId]);

  const persistLocally = useCallback(async (record: SubscriptionRecord) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (e) {

    }
  }, []);

  const upsertToSupabase = useCallback(async (record: SubscriptionRecord) => {
    if (!isSupabaseConfigured || !userId) return;
    try {
      await supabase.from('subscriptions').upsert({
        user_id: record.userId,
        plan: record.plan,
        status: record.status,
        stripe_subscription_id: record.stripeSubscriptionId,
        trial_ends_at: record.trialEndsAt,
        current_period_end: record.currentPeriodEnd,
        license_code: record.licenseCode,
        created_at: record.createdAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (e) {

    }
  }, [userId]);

  const startTrial = useCallback(async () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const now = new Date().toISOString();
    const record: SubscriptionRecord = {
      userId,
      plan: DEFAULT_TRIAL_PLAN,
      status: 'trial',
      stripeSubscriptionId: null,
      trialEndsAt: trialEnd.toISOString(),
      currentPeriodEnd: null,
      licenseCode: null,
      createdAt: now,
      updatedAt: now,
    };
    setPlan(DEFAULT_TRIAL_PLAN);
    setStatus('trial');
    setTrialEndsAt(trialEnd.toISOString());
    await persistLocally(record);
    await upsertToSupabase(record);
    void queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
  }, [userId, persistLocally, upsertToSupabase, queryClient]);

  const selectPlan = useCallback(async (planId: PlanId, interval: BillingInterval) => {
    const planConfig = PLANS[planId];
    const priceId = interval === 'monthly' ? planConfig.stripeMonthlyPriceId : planConfig.stripeAnnualPriceId;


    const checkoutUrl = `https://checkout.stripe.com/pay/${priceId}?client_reference_id=${userId}`;
    
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(checkoutUrl, '_blank');
      }
    } else {
      try {
        await Linking.openURL(checkoutUrl);
      } catch {
        setPaymentError('Impossible d\'ouvrir la page de paiement.');
      }
    }
  }, [userId]);

  const cancelSubscription = useCallback(async () => {
    const now = new Date().toISOString();
    const record: SubscriptionRecord = {
      userId,
      plan,
      status: 'canceled',
      stripeSubscriptionId,
      trialEndsAt,
      currentPeriodEnd,
      licenseCode,
      createdAt: now,
      updatedAt: now,
    };
    setStatus('canceled');
    await persistLocally(record);
    await upsertToSupabase(record);
    void queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
  }, [userId, plan, stripeSubscriptionId, trialEndsAt, currentPeriodEnd, licenseCode, persistLocally, upsertToSupabase, queryClient]);

  const activateLicense = useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!code.trim()) {
      return { success: false, error: 'Code requis' };
    }

    if (isSupabaseConfigured) {
      try {
        const { data: licenseData, error: fetchError } = await supabase
          .from('licenses')
          .select('*')
          .eq('code', code.trim())
          .maybeSingle();

        if (fetchError || !licenseData) {
          return { success: false, error: 'Code licence invalide' };
        }

        if (licenseData.used_by) {
          return { success: false, error: 'Ce code a déjà été utilisé' };
        }

        const { error: updateError } = await supabase
          .from('licenses')
          .update({
            used_by: userId,
            activated_at: new Date().toISOString(),
          })
          .eq('id', licenseData.id);

        if (updateError) {
          return { success: false, error: 'Erreur lors de l\'activation' };
        }

        const licensePlan = licenseData.plan as PlanId;
        const now = new Date().toISOString();
        let periodEnd: string | null = null;

        if (licenseData.duration === '1year') {
          const end = new Date();
          end.setFullYear(end.getFullYear() + 1);
          periodEnd = end.toISOString();
        }

        const record: SubscriptionRecord = {
          userId,
          plan: licensePlan,
          status: 'active',
          stripeSubscriptionId: null,
          trialEndsAt: null,
          currentPeriodEnd: periodEnd,
          licenseCode: code.trim(),
          createdAt: now,
          updatedAt: now,
        };

        setPlan(licensePlan);
        setStatus('active');
        setTrialEndsAt(null);
        setCurrentPeriodEnd(periodEnd);
        setLicenseCode(code.trim());

        await persistLocally(record);
        await upsertToSupabase(record);
        void queryClient.invalidateQueries({ queryKey: ['subscription', userId] });

        return { success: true };
      } catch {
        return { success: false, error: 'Erreur de connexion' };
      }
    }

    const licensePlan: PlanId = 'business';
    const now = new Date().toISOString();
    const record: SubscriptionRecord = {
      userId,
      plan: licensePlan,
      status: 'active',
      stripeSubscriptionId: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      licenseCode: code.trim(),
      createdAt: now,
      updatedAt: now,
    };

    setPlan(licensePlan);
    setStatus('active');
    setTrialEndsAt(null);
    setLicenseCode(code.trim());

    await persistLocally(record);
    void queryClient.invalidateQueries({ queryKey: ['subscription', userId] });

    return { success: true };
  }, [userId, persistLocally, upsertToSupabase, queryClient]);

  const trialDaysRemaining = useMemo(
    () => calculateTrialDaysRemaining(trialEndsAt),
    [trialEndsAt]
  );

  const isTrial = status === 'trial';
  const isActive = status === 'active' || (status === 'trial' && trialDaysRemaining > 0);
  const isExpired = status === 'expired' || (status === 'trial' && trialDaysRemaining <= 0);

  const effectivePlan = useMemo((): PlanId => {
    if (isExpired) return 'solo';
    return plan;
  }, [plan, isExpired]);

  const hasFeature = useCallback((featureKey: string): boolean => {
    return isFeatureAvailable(effectivePlan, featureKey);
  }, [effectivePlan]);

  const canAccess = useCallback((requiredPlan: PlanId): boolean => {
    return canAccessWithPlan(effectivePlan, requiredPlan);
  }, [effectivePlan]);

  const getRequiredPlan = useCallback((featureKey: string): PlanId | null => {
    return getRequiredPlanForFeature(featureKey);
  }, []);

  const checkLimit = useCallback((type: 'clients' | 'invoices' | 'users', currentCount: number): { allowed: boolean; limit: number | null } => {
    const planConfig = PLANS[effectivePlan];
    let limit: number | null = null;

    switch (type) {
      case 'clients':
        limit = planConfig.limits.maxClients;
        break;
      case 'invoices':
        limit = planConfig.limits.maxInvoicesPerMonth;
        break;
      case 'users':
        limit = planConfig.limits.maxUsers;
        break;
    }

    if (limit === null) return { allowed: true, limit: null };
    return { allowed: currentCount < limit, limit };
  }, [effectivePlan]);

  const requireUpgrade = useCallback((featureKey: string): boolean => {
    if (hasFeature(featureKey)) return false;
    const required = getRequiredPlanForFeature(featureKey);
    setRequiredPlanForUpgrade(required);
    setShowUpgradeRequired(true);
    return true;
  }, [hasFeature]);

  return useMemo(() => ({
    plan: effectivePlan,
    status,
    trialEndsAt,
    currentPeriodEnd,
    stripeSubscriptionId,
    licenseCode,
    isLoading: subscriptionQuery.isLoading,
    trialDaysRemaining,
    isTrial,
    isActive,
    isExpired,
    hasFeature,
    canAccess,
    getRequiredPlan,
    checkLimit,
    startTrial,
    selectPlan,
    cancelSubscription,
    activateLicense,
    showUpgradeRequired,
    setShowUpgradeRequired,
    requiredPlanForUpgrade,
    setRequiredPlanForUpgrade,
    requireUpgrade,
  }), [
    effectivePlan, status, trialEndsAt, currentPeriodEnd, stripeSubscriptionId,
    licenseCode, subscriptionQuery.isLoading, trialDaysRemaining, isTrial,
    isActive, isExpired, hasFeature, canAccess, getRequiredPlan, checkLimit,
    startTrial, selectPlan, cancelSubscription, activateLicense,
    showUpgradeRequired, requiredPlanForUpgrade, requireUpgrade,
  ]);
});
