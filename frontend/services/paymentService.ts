/**
 * paymentService.ts
 * Unified payment service supporting Stripe (card) and CinetPay (mobile money).
 * Handles payment initialization via Supabase Edge Functions,
 * real-time status listening via Supabase Realtime channels,
 * and transaction history fetching for both providers.
 *
 * Usage:
 *   import { createStripePayment, createCinetPayPayment, subscribeToPaymentStatus } from '@/services/paymentService';
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { Linking, Platform } from 'react-native';
import type {
  PaymentTransaction,
  CinetPayTransactionStatus,
  UnifiedPayment,
  UnifiedPaymentStatus,
  PaymentProvider,
  PaymentMethodType,
} from '@/types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function generateTransactionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `txn_${ts}_${rand}`;
}

function mapTransactionFromDB(row: Record<string, unknown>): PaymentTransaction {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    saleId: row.sale_id as string | undefined,
    amount: Number(row.amount),
    currency: row.currency as string,
    paymentMethod: (row.payment_method as PaymentTransaction['paymentMethod']) || 'other',
    cinetpayPaymentId: row.cinetpay_payment_id as string | undefined,
    cinetpayPaymentUrl: row.cinetpay_payment_url as string | undefined,
    cinetpayToken: row.cinetpay_token as string | undefined,
    status: row.status as CinetPayTransactionStatus,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapUnifiedPaymentFromDB(row: Record<string, unknown>): UnifiedPayment {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    saleId: row.sale_id as string | undefined,
    amount: Number(row.amount),
    currency: row.currency as string,
    provider: (row.provider as PaymentProvider) || 'cinetpay',
    providerTransactionId: row.provider_transaction_id as string | undefined,
    providerPaymentUrl: row.provider_payment_url as string | undefined,
    providerClientSecret: row.provider_client_secret as string | undefined,
    paymentMethodType: (row.payment_method_type as PaymentMethodType) || 'other',
    status: row.status as UnifiedPaymentStatus,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function getAccessToken(): Promise<string | undefined> {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.access_token;
}

export interface CreatePaymentParams {
  amount: number;
  currency: string;
  description?: string;
  companyId: string;
  saleId?: string;
  customerName?: string;
  customerSurname?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface CreatePaymentResult {
  success: boolean;
  paymentUrl?: string;
  paymentToken?: string;
  transactionId?: string;
  paymentId?: string;
  clientSecret?: string;
  error?: string;
}

/**
 * Initiates a Stripe payment via the create-stripe-payment Edge Function.
 * Returns a client secret for Stripe Elements or an error message.
 */
export async function createStripePayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase non configure' };
  }

  try {
    const accessToken = await getAccessToken();

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-stripe-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        description: params.description || 'Paiement Stripe',
        company_id: params.companyId,
        sale_id: params.saleId,
        customer_email: params.customerEmail,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Erreur lors de la creation du paiement Stripe',
      };
    }

    return {
      success: true,
      clientSecret: data.client_secret,
      paymentId: data.payment_id,
      transactionId: data.stripe_payment_intent_id,
    };
  } catch {
    return {
      success: false,
      error: 'Erreur reseau lors de la creation du paiement Stripe',
    };
  }
}

/**
 * Initiates a CinetPay payment via the create-cinetpay-payment Edge Function.
 * Returns a payment URL to redirect the customer for mobile money payment.
 */
export async function createCinetPayPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase non configure' };
  }

  const transactionId = generateTransactionId();

  try {
    const accessToken = await getAccessToken();

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-cinetpay-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        description: params.description || 'Paiement POS',
        transaction_id: transactionId,
        company_id: params.companyId,
        sale_id: params.saleId,
        customer_name: params.customerName,
        customer_surname: params.customerSurname,
        customer_email: params.customerEmail,
        customer_phone_number: params.customerPhone,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.details || 'Erreur lors de la creation du paiement',
      };
    }

    return {
      success: true,
      paymentUrl: data.payment_url,
      paymentToken: data.payment_token,
      transactionId: data.transaction_id || transactionId,
      paymentId: data.payment_id,
    };
  } catch {
    return {
      success: false,
      error: 'Erreur reseau lors de la creation du paiement',
    };
  }
}

export function openPaymentUrl(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export type PaymentStatusCallback = (status: CinetPayTransactionStatus, transaction?: PaymentTransaction) => void;

/**
 * Subscribes to real-time payment status updates via Supabase Realtime.
 * Returns an object with an unsubscribe function.
 */
export function subscribeToPaymentStatus(
  transactionId: string,
  callback: PaymentStatusCallback,
): { unsubscribe: () => void } {
  const channel = supabase
    .channel(`payment-${transactionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'payment_transactions',
        filter: `id=eq.${transactionId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        const status = row.status as CinetPayTransactionStatus;
        const transaction = mapTransactionFromDB(row);
        callback(status, transaction);
      },
    )
    .subscribe();

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}

export type UnifiedPaymentStatusCallback = (status: UnifiedPaymentStatus, payment?: UnifiedPayment) => void;

/**
 * Subscribes to real-time unified payment status updates via Supabase Realtime.
 * Supports both Stripe and CinetPay payments stored in the `payments` table.
 */
export function subscribeToUnifiedPaymentStatus(
  paymentId: string,
  callback: UnifiedPaymentStatusCallback,
): { unsubscribe: () => void } {
  const channel = supabase
    .channel(`unified-payment-${paymentId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: `id=eq.${paymentId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        const status = row.status as UnifiedPaymentStatus;
        const payment = mapUnifiedPaymentFromDB(row);
        callback(status, payment);
      },
    )
    .subscribe();

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}

export async function checkPaymentStatus(transactionId: string): Promise<PaymentTransaction | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error || !data) {
      return null;
    }

    return mapTransactionFromDB(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function checkUnifiedPaymentStatus(paymentId: string): Promise<UnifiedPayment | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !data) {
      return null;
    }

    return mapUnifiedPaymentFromDB(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function fetchPaymentTransactions(companyId: string): Promise<PaymentTransaction[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => mapTransactionFromDB(row));
  } catch {
    return [];
  }
}

export async function fetchUnifiedPayments(companyId: string): Promise<UnifiedPayment[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => mapUnifiedPaymentFromDB(row));
  } catch {
    return [];
  }
}

export function getProviderLabel(provider: PaymentProvider): string {
  switch (provider) {
    case 'stripe': return 'Stripe';
    case 'cinetpay': return 'CinetPay';
    default: return provider;
  }
}

export function getMethodLabel(method: PaymentMethodType): string {
  switch (method) {
    case 'card': return 'Carte bancaire';
    case 'wave': return 'Wave';
    case 'orange_money': return 'Orange Money';
    case 'mtn': return 'MTN Money';
    case 'moov': return 'Moov Money';
    case 'bank_transfer': return 'Virement';
    default: return 'Autre';
  }
}

export function getStatusColor(status: UnifiedPaymentStatus): string {
  switch (status) {
    case 'completed': return '#059669';
    case 'pending': return '#D97706';
    case 'processing': return '#2563EB';
    case 'failed': return '#DC2626';
    case 'refunded': return '#7C3AED';
    case 'cancelled': return '#6B7280';
    default: return '#6B7280';
  }
}

export function getSupportedCurrencies(provider: PaymentProvider): string[] {
  switch (provider) {
    case 'cinetpay': return ['XOF', 'XAF'];
    case 'stripe': return ['EUR', 'USD'];
    default: return ['EUR'];
  }
}
