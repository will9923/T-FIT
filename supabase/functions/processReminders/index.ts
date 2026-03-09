// Setup type definitions for built-in Supabase runtime
import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        const now = new Date().toISOString()

        // 1. Get pending reminders
        const { data: reminders, error } = await supabaseClient
            .from('app_reminders')
            .select('*')
            .eq('sent', false)
            .lte('send_at', now)

        if (error) throw error

        if (!reminders || reminders.length === 0) {
            return new Response(JSON.stringify({ message: 'No reminders to send' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const results = []

        // 2. Process each reminder
        for (const reminder of reminders) {
            try {
                // Call the main push function or just use its logic here
                // Usually it's better to just use the logic directly for speed

                // Mark as sent first to avoid double-processing
                await supabaseClient.from('app_reminders').update({ sent: true }).eq('id', reminder.id)

                // Trigger notification record (which triggers realtime and subsequently the push via DB trigger/EF)
                const { error: notifErr } = await supabaseClient
                    .from('notifications')
                    .insert({
                        user_id: reminder.user_id,
                        type: 'app_reminder',
                        title: reminder.title,
                        message: reminder.message,
                        link: '/dashboard'
                    })

                if (notifErr) throw notifErr

                results.push({ id: reminder.id, status: 'sent' })
            } catch (err) {
                results.push({ id: reminder.id, status: 'error', error: err.message })
            }
        }

        return new Response(JSON.stringify({ processed: results.length, details: results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
