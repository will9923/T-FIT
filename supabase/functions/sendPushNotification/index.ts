// Setup type definitions for built-in Supabase runtime
import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.6"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // VAPID Configuration
        const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
        const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
        const VAPID_SUBJECT = "mailto:contato@tfit.com.br"

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            throw new Error('VAPID keys not configured in Edge Function Env Vars')
        }

        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

        // Get Request Body
        const { user_id, title, message, link, type } = await req.json()

        if (!user_id || !title || !message) {
            return new Response(JSON.stringify({ error: 'Missing parameters' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        // 1. Get Tokens for User
        const { data: tokens, error: tokenError } = await supabaseClient
            .from('device_tokens')
            .select('token')
            .eq('user_id', user_id)

        if (tokenError) throw tokenError

        // 2. Insert into notifications history (if not already done by DB trigger)
        // Note: If calling this function from App code, we want it here.
        // If calling from DB trigger, the trigger already inserted it.
        // We add a check or just assume it's a "send" request.
        const { error: notifError } = await supabaseClient
            .from('notifications')
            .insert({
                user_id,
                type: type || 'system_alert',
                title,
                message,
                link: link || '/'
            })

        if (notifError) console.error('History logging error:', notifError)

        // 3. Send Push to each token
        const results = []
        if (tokens && tokens.length > 0) {
            for (const t of tokens) {
                try {
                    const subscription = JSON.parse(t.token)
                    const payload = JSON.stringify({ title, message, link, type })

                    await webpush.sendNotification(subscription, payload)
                    results.push({ success: true })
                } catch (pushErr) {
                    console.error('Push error for token:', pushErr)
                    // If token is expired or unauthorized, cleanup
                    if (pushErr.statusCode === 410 || pushErr.statusCode === 401) {
                        await supabaseClient.from('device_tokens').delete().eq('token', t.token)
                    }
                    results.push({ success: false, error: pushErr.message })
                }
            }
        }

        return new Response(JSON.stringify({ success: true, delivered: results.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
