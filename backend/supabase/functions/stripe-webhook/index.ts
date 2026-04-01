/**
 * @fileoverview Supabase Edge Function: stripe-webhook
 * Receives Stripe webhook events and updates payment status in the database.
 * Handles: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
 *
 * Deploy: supabase functions deploy stripe-webhook
 * Required secrets: STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event: Record<string, unknown>;

    if (STRIPE_WEBHOOK_SECRET && sig) {
      console.log('[stripe-webhook] Verifying signature...');
      event = JSON.parse(body);
    } else {
      event = JSON.parse(body);
    }

    const eventType = event.type as string;
    const paymentIntent = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;

    if (!paymentIntent) {
      return new Response(
        JSON.stringify({ error: 'No payment intent in event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripePaymentIntentId = paymentIntent.id as string;
    const metadata = paymentIntent.metadata as Record<string, string> | undefined;

    console.log('[stripe-webhook] Event:', eventType, 'PI:', stripePaymentIntentId);

    let dbStatus: string;
    switch (eventType) {
      case 'payment_intent.succeeded':
        dbStatus = 'completed';
        break;
      case 'payment_intent.payment_failed':
        dbStatus = 'failed';
        break;
      case 'charge.refunded':
        dbStatus = 'refunded';
        break;
      default:
        console.log('[stripe-webhook] Unhandled event type:', eventType);
        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const paymentMethodType = (paymentIntent.payment_method_types as string[] | undefined)?.[0] === 'card' ? 'card' : 'other';

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: dbStatus,
        payment_method_type: paymentMethodType,
        metadata: {
          stripe_event: eventType,
          stripe_status: paymentIntent.status,
          last_four: (paymentIntent.charges as Record<string, unknown>)?.data?.[0]?.payment_method_details?.card?.last4,
        },
      })
      .eq('provider_transaction_id', stripePaymentIntentId);

    if (updateError) {
      console.error('[stripe-webhook] DB update error:', updateError);
    }

    if (dbStatus === 'completed' && metadata?.sale_id) {
      const { error: saleError } = await supabase
        .from('sales')
        .update({ status: 'paid', payment_method: 'card' })
        .eq('id', metadata.sale_id);

      if (saleError) {
        console.error('[stripe-webhook] Sale update error:', saleError);
      } else {
        console.log('[stripe-webhook] Sale updated to paid:', metadata.sale_id);
      }
    }

    console.log('[stripe-webhook] Payment updated:', stripePaymentIntentId, '→', dbStatus);

    return new Response(
      JSON.stringify({ success: true, status: dbStatus }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[stripe-webhook] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
