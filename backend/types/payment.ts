/**
 * @fileoverview Shared payment type definitions used by both backend Edge Functions
 * and frontend services. Covers Stripe and CinetPay providers.
 */

export type PaymentProvider = 'stripe' | 'cinetpay';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export type PaymentMethodType = 'card' | 'wave' | 'orange_money' | 'mtn' | 'moov' | 'bank_transfer' | 'other';

export interface PaymentRecord {
  id: string;
  sale_id?: string;
  company_id: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  provider_transaction_id?: string;
  provider_payment_url?: string;
  provider_client_secret?: string;
  payment_method_type: PaymentMethodType;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodRecord {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  type: PaymentMethodType;
  last_four?: string;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateStripePaymentRequest {
  order_id?: string;
  sale_id?: string;
  company_id: string;
  amount: number;
  currency: string;
  description?: string;
  customer_email?: string;
}

export interface CreateStripePaymentResponse {
  success: boolean;
  client_secret?: string;
  payment_id?: string;
  error?: string;
}

export interface CreateCinetPayPaymentRequest {
  order_id?: string;
  sale_id?: string;
  company_id: string;
  amount: number;
  currency: string;
  description?: string;
  customer_name?: string;
  customer_surname?: string;
  customer_email?: string;
  customer_phone_number?: string;
  return_url?: string;
  notify_url?: string;
}

export interface CreateCinetPayPaymentResponse {
  success: boolean;
  payment_url?: string;
  payment_token?: string;
  transaction_id?: string;
  error?: string;
}

export interface GetPaymentStatusRequest {
  payment_id: string;
}

export interface GetPaymentStatusResponse {
  success: boolean;
  payment?: PaymentRecord;
  error?: string;
}
