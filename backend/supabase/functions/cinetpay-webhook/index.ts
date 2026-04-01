/**
 * @fileoverview Supabase Edge Function: cinetpay-webhook
 * Receives CinetPay payment notifications and verifies payment status.
 * Updates both the new `payments` table and legacy `payment_transactions` table.
 *
 * Deploy: supabase functions deploy cinetpay-webhook
 * Required secrets: CINETPAY_API_KEY, CINETPAY_SITE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

// @ts-nocheck — Edge Function runtime (Deno)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const METHOD_MAPPING: Record<string, string> = {
  'WAVE': 'wave',
  'OM': 'orange_money',
  'MOMO': 'mtn',
  'MTN': 'mtn',
  'MOOV': 'moov',
  'CB': 'card',
  'VISA': 'card',
  'MASTERCARD': 'card',
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

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    let transactionId: string | null = null;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      transactionId = body.cpm_trans_id || body.transaction_id;
    } else {
      const formData = await req.formData();
      transactionId = formData.get('cpm_trans_id') as string;
    }

    if (!transactionId) {
      console.error('[cinetpay-webhook] No transaction_id received');
      return new Response(
        JSON.stringify({ error: 'Missing transaction_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[cinetpay-webhook] Checking transaction:', transactionId);

    const checkRes = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: CINETPAY_API_KEY,
        site_id: CINETPAY_SITE_ID,
        transaction_id: transactionId,
      }),
    });

    const checkData = await checkRes.json();
    console.log('[cinetpay-webhook] CinetPay check response:', JSON.stringify(checkData));

    const cinetpayCode = checkData.code;
    const cinetpayStatus = checkData.data?.status;
    const paymentMethod = checkData.data?.payment_method || 'other';
    const mappedMethod = METHOD_MAPPING[paymentMethod?.toUpperCase()] || 'other';

    let dbStatus: string;
    if (cinetpayCode === '00' && cinetpayStatus === 'ACCEPTED') {
      dbStatus = 'completed';
    } else if (cinetpayCode === '627' || cinetpayStatus === 'CANCELLED') {
      dbStatus = 'cancelled';
    } else if (cinetpayCode === '623' || cinetpayStatus === 'REFUSED') {
      dbStatus = 'failed';
    } else {
      dbStatus = 'pending';
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: dbStatus,
        payment_method_type: mappedMethod,
        metadata: {
          cinetpay_response: checkData.data,
          cinetpay_code: cinetpayCode,
          operator_id: checkData.data?.operator_id,
          payment_date: checkData.data?.payment_date,
        },
      })
      .eq('provider_transaction_id', transactionId);

    if (updateError) {
      console.error('[cinetpay-webhook] Payments table update error:', updateError);
    }

    const { error: legacyUpdateError } = await supabase
      .from('payment_transactions')
      .update({
        status: dbStatus,
        payment_method: mappedMethod,
        metadata: {
          cinetpay_response: checkData.data,
          cinetpay_code: cinetpayCode,
          operator_id: checkData.data?.operator_id,
          payment_date: checkData.data?.payment_date,
        },
      })
      .eq('cinetpay_payment_id', transactionId);

    if (legacyUpdateError) {
      console.error('[cinetpay-webhook] Legacy table update error:', legacyUpdateError);
    }

    if (dbStatus === 'completed') {
      const { data: txn } = await supabase
        .from('payments')
        .select('sale_id, company_id')
        .eq('provider_transaction_id', transactionId)
        .single();

      if (txn?.sale_id) {
        const { error: saleError } = await supabase
          .from('sales')
          .update({ status: 'paid', payment_method: `mobile_${mappedMethod}` })
          .eq('id', txn.sale_id);

        if (saleError) {
          console.error('[cinetpay-webhook] Sale update error:', saleError);
        } else {
          console.log('[cinetpay-webhook] Sale updated to paid:', txn.sale_id);
        }
      }
    }

    console.log('[cinetpay-webhook] Transaction updated:', transactionId, '→', dbStatus);

    return new Response(
      JSON.stringify({ success: true, status: dbStatus }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[cinetpay-webhook] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
