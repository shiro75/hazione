/**
 * @fileoverview Supabase Edge Function: get-payment-status
 * Returns the current status of a payment by its ID.
 *
 * Receives: { payment_id }
 * Returns: { success, payment }
 *
 * Deploy: supabase functions deploy get-payment-status
 * Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { payment_id } = await req.json();

    if (!payment_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing payment_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-payment-status] Fetching payment:', payment_id);

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (error || !data) {
      console.error('[get-payment-status] Not found:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, payment: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[get-payment-status] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
