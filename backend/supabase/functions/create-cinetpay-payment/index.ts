/**
 * @fileoverview Supabase Edge Function: create-cinetpay-payment
 * Initializes a CinetPay payment for mobile money (Wave, Orange Money, MTN, etc.).
 *
 * Receives: { company_id, sale_id?, amount, currency, description?, customer_* }
 * Returns: { success, payment_url, payment_token, transaction_id }
 *
 * Deploy: supabase functions deploy create-cinetpay-payment
 * Required secrets: CINETPAY_API_KEY, CINETPAY_SITE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

// @ts-nocheck — Edge Function runtime (Deno)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const CINETPAY_API_KEY = Deno.env.get('CINETPAY_API_KEY');
    const CINETPAY_SITE_ID = Deno.env.get('CINETPAY_SITE_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
      return new Response(
        JSON.stringify({ success: false, error: 'CinetPay credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const {
      company_id,
      sale_id,
      amount,
      currency,
      description,
      customer_name,
      customer_surname,
      customer_email,
      customer_phone_number,
      return_url,
      notify_url,
    } = await req.json();

    if (!amount || !currency || !company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: amount, currency, company_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transactionId = `txn_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`;
    const webhookUrl = notify_url || `${SUPABASE_URL}/functions/v1/cinetpay-webhook`;

    const cinetpayPayload = {
      apikey: CINETPAY_API_KEY,
      site_id: CINETPAY_SITE_ID,
      transaction_id: transactionId,
      amount: Number(amount),
      currency,
      description: description || `Paiement ${transactionId}`,
      return_url: return_url || 'https://rork.app',
      notify_url: webhookUrl,
      channels: 'ALL',
      lang: 'FR',
      metadata: JSON.stringify({ company_id, sale_id }),
      ...(customer_name ? { customer_name } : {}),
      ...(customer_surname ? { customer_surname } : {}),
      ...(customer_email ? { customer_email } : {}),
      ...(customer_phone_number ? { customer_phone_number } : {}),
    };

    console.log('[create-cinetpay-payment] Calling CinetPay API for:', transactionId);

    const cinetpayRes = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cinetpayPayload),
    });

    const cinetpayData = await cinetpayRes.json();
    console.log('[create-cinetpay-payment] CinetPay response:', JSON.stringify(cinetpayData));

    if (cinetpayData.code !== '201') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CinetPay initialization failed',
          details: cinetpayData.message || cinetpayData.description,
          cinetpay_code: cinetpayData.code,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentUrl = cinetpayData.data?.payment_url;
    const paymentToken = cinetpayData.data?.payment_token;

    const paymentId = `pay_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`;

    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        company_id,
        sale_id: sale_id || null,
        amount: Number(amount),
        currency: currency.toUpperCase(),
        provider: 'cinetpay',
        provider_transaction_id: transactionId,
        provider_payment_url: paymentUrl,
        payment_method_type: 'other',
        status: 'pending',
        metadata: {
          cinetpay_token: paymentToken,
          description,
          customer_name,
          customer_phone_number,
        },
      });

    if (insertError) {
      console.error('[create-cinetpay-payment] DB insert error:', insertError);
    }

    const { error: legacyInsertError } = await supabase
      .from('payment_transactions')
      .insert({
        id: transactionId,
        company_id,
        sale_id: sale_id || null,
        amount: Number(amount),
        currency,
        payment_method: 'other',
        cinetpay_payment_id: transactionId,
        cinetpay_payment_url: paymentUrl,
        cinetpay_token: paymentToken,
        status: 'pending',
        metadata: { description, customer_name, customer_phone_number },
      });

    if (legacyInsertError) {
      console.error('[create-cinetpay-payment] Legacy DB insert error:', legacyInsertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        payment_token: paymentToken,
        transaction_id: transactionId,
        payment_id: paymentId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[create-cinetpay-payment] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
