/**
 * @fileoverview Supabase Edge Function: create-stripe-payment
 * Creates a Stripe PaymentIntent for card payments.
 * 
 * Receives: { company_id, sale_id?, amount, currency, description?, customer_email? }
 * Returns: { success, client_secret, payment_id }
 * 
 * Deploy: supabase functions deploy create-stripe-payment
 * Required secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stripe credentials not configured' }),
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
      customer_email,
    } = await req.json();

    if (!amount || !currency || !company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: amount, currency, company_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountInCents = Math.round(Number(amount) * 100);

    console.log('[create-stripe-payment] Creating PaymentIntent:', amountInCents, currency);

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(amountInCents),
        currency: currency.toLowerCase(),
        ...(description ? { description } : {}),
        ...(customer_email ? { receipt_email: customer_email } : {}),
        'metadata[company_id]': company_id,
        ...(sale_id ? { 'metadata[sale_id]': sale_id } : {}),
        'automatic_payment_methods[enabled]': 'true',
      }).toString(),
    });

    const stripeData = await stripeRes.json();
    console.log('[create-stripe-payment] Stripe response status:', stripeRes.status);

    if (!stripeRes.ok || stripeData.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: stripeData.error?.message || 'Stripe PaymentIntent creation failed',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentId = `pay_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`;

    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        company_id,
        sale_id: sale_id || null,
        amount: Number(amount),
        currency: currency.toUpperCase(),
        provider: 'stripe',
        provider_transaction_id: stripeData.id,
        provider_client_secret: stripeData.client_secret,
        payment_method_type: 'card',
        status: 'pending',
        metadata: {
          stripe_payment_intent_id: stripeData.id,
          description,
          customer_email,
        },
      });

    if (insertError) {
      console.error('[create-stripe-payment] DB insert error:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        client_secret: stripeData.client_secret,
        payment_id: paymentId,
        stripe_payment_intent_id: stripeData.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[create-stripe-payment] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
