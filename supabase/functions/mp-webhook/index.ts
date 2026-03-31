import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
}

// AES-256 Safe Key Handler
async function getCryptoKey(secret: string) {
    const msgUint8 = new TextEncoder().encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    return await crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(text: string, secret: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getCryptoKey(secret);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv); combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
}

async function decrypt(ciphered: string, secret: string): Promise<string> {
    try {
        const binaryString = atob(ciphered);
        const combined = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) combined[i] = binaryString.charCodeAt(i);
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        const key = await getCryptoKey(secret);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
        return new TextDecoder().decode(decrypted);
    } catch (e) { throw new Error('Falha na descriptografia. Verifique a ENCRYPTION_KEY.'); }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const url = new URL(req.url);
    const queryAction = url.searchParams.get('action');

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const encryptionSecret = Deno.env.get('ENCRYPTION_KEY') || '';
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

        let body: any = {};
        if (req.method === 'POST') body = await req.json().catch(() => ({}));

        const action = queryAction || body.action || (body.type ? 'webhook' : 'unknown');

        // --- ACTION: DIAGNOSTIC (System Health) ---
        if (action === 'diagnostic') {
            const testText = "T-FIT-TEST-123";
            let cryptoTest = "Success";
            try {
                const encrypted = await encrypt(testText, encryptionSecret);
                const decrypted = await decrypt(encrypted, encryptionSecret);
                if (decrypted !== testText) cryptoTest = "Mismatch";
            } catch (e: any) { cryptoTest = e.message; }

            return new Response(JSON.stringify({
                success: true,
                environment: {
                    hasUrl: !!supabaseUrl,
                    hasServiceKey: !!supabaseServiceKey,
                    hasEncryptionKey: !!encryptionSecret,
                    cryptoTest
                }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- ACTION: SAVE_CONFIG (Base Integration) ---
        if (action === 'save_config') {
            const { user_id, access_token, public_key, webhook_secret } = body;
            console.log(`[SaveConfig] Request for user: ${user_id}`);

            const updateObj: any = { user_id, public_key, webhook_secret, updated_at: new Date().toISOString() };

            if (access_token && access_token !== '********') {
                updateObj.access_token = await encrypt(access_token, encryptionSecret);
                console.log(`[SaveConfig] New Access Token encrypted.`);
            }

            const { data: upsertData, error: upsertError } = await supabaseClient
                .from('payment_configs')
                .upsert(updateObj, { onConflict: 'user_id' })
                .select();

            if (upsertError) {
                console.error("[SaveConfig Database Error]", upsertError);
                throw new Error(`Erro no Banco de Dados: ${upsertError.message || 'Falha ao gravar configurações (Conflict)'}`);
            }

            console.log(`[SaveConfig] Success for user: ${user_id}`);
            return new Response(JSON.stringify({
                success: true,
                message: 'Configurações salvas com sucesso'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // --- ACTION: TEST_CONNECTION ---
        if (action === 'test_connection') {
            const { user_id, access_token: rawToken } = body;
            let accessToken = rawToken;

            if (!accessToken) {
                const { data: config } = await supabaseClient.from('payment_configs').select('*').eq('user_id', user_id).maybeSingle();
                if (!config) throw new Error('Credenciais não encontradas. Salve primeiro ou informe o token.');
                accessToken = await decrypt(config.access_token, encryptionSecret);
            }

            console.log(`[TestConnection] Testing for user: ${user_id || 'manual'}`);
            const testResp = await fetch('https://api.mercadopago.com/users/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (testResp.ok) {
                return new Response(JSON.stringify({ success: true, message: 'Conectado!' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } else {
                const errorData = await testResp.json().catch(() => ({}));
                throw new Error(errorData.message || 'Token Inválido ou recusado pelo Mercado Pago.');
            }
        }

        // --- ACTION: CREATE_PREFERENCE (Marketplace & Platform) ---
        if (action === 'create_preference' || action === 'create_subscription') {
            const { plan_id, user_id, personal_owner_id, origin } = body;
            const ref_type = body.ref_type || (action === 'create_subscription' ? 'subscription' : 'marketplace');

            let receiverId = personal_owner_id;
            let planName = 'Plano TFIT';
            let planPrice = body.amount ? Number(body.amount) : 0;

            if (ref_type === 'mensalidade_tfit' || ref_type === 'tpoints') {
                // Platform direct plan (e.g., T-FIT IA) or T-Points
                let basePlan = null;
                if (plan_id && plan_id !== 'undefined' && !plan_id.startsWith('tpoints_')) {
                    const { data } = await supabaseClient.from('plans').select('*').eq('id', plan_id).maybeSingle();
                    basePlan = data;
                }

                if (!basePlan) {
                    if (plan_id === 'plano_ia' || plan_id === 'plano_ia_estudante' || plan_id === 'undefined') {
                        planName = 'Assinatura T-FIT IA';
                        planPrice = 29.90;
                        const { data: adminProfile } = await supabaseClient.from('profiles').select('id').eq('role', 'admin').limit(1).single();
                        receiverId = adminProfile?.id;
                    } else if (ref_type === 'tpoints') {
                        const pts = Number(plan_id.split('_')[1]) || 1000;
                        planName = `${pts} T-Points (Social)`;
                        planPrice = body.amount ? Number(body.amount) : (pts * 0.01);
                        const { data: adminProfile } = await supabaseClient.from('profiles').select('id').eq('role', 'admin').limit(1).single();
                        receiverId = adminProfile?.id;
                    } else {
                        console.error(`[MP Webhook] Plano Base Não Encontrado. Plan ID: ${plan_id}`);
                        throw new Error(`Plano base não encontrado: ${plan_id || 'ID Ausente'}`);
                    }
                } else {
                    planName = basePlan.name;
                    planPrice = Number(basePlan.price || 0);

                    if (basePlan.created_by) {
                        receiverId = basePlan.created_by;
                    } else {
                        const { data: adminProfile } = await supabaseClient.from('profiles').select('id').eq('role', 'admin').limit(1).single();
                        receiverId = adminProfile?.id;
                    }
                }
            } else {
                // Personal Trainer plan
                const { data: plan } = await supabaseClient.from('planos_personal').select('*').eq('id', plan_id).maybeSingle();
                if (!plan) throw new Error('Plano não encontrado.');

                planName = plan.nome;
                planPrice = Number(plan.preco || 0);
                receiverId = receiverId || plan?.personal_id;
            }

            // Enhanced Receiver Strategy (Robust)
            let { data: config } = await supabaseClient.from('payment_configs').select('*').eq('user_id', receiverId || '').maybeSingle();

            if (!config) {
                console.log(`[MP Config] Receiver ${receiverId} lacks config. Searching for ANY admin with config...`);

                // Direct lookup for any config belonging to an admin user
                const { data: adminConfigs } = await supabaseClient
                    .from('payment_configs')
                    .select('*, profiles!inner(role)')
                    .eq('profiles.role', 'admin')
                    .limit(1);

                if (adminConfigs && adminConfigs.length > 0) {
                    config = adminConfigs[0];
                    receiverId = config.user_id;
                    console.log(`[MP Config] Admin Fallback found: ${receiverId}`);
                }
            }

            if (!config) {
                throw new Error(`Configuração de pagamento não localizada. O recebedor (${receiverId || 'indefinido'}) ou um Administrador do sistema precisa vincular o Mercado Pago.`);
            }

            console.log(`[MP Preference] Using receiver: ${receiverId}`);
            const accessToken = await decrypt(config.access_token, encryptionSecret);
            const prefBody = {
                items: [{
                    title: planName,
                    unit_price: planPrice,
                    quantity: 1, currency_id: 'BRL'
                }],
                external_reference: JSON.stringify({ user_id, plan_id, receiver_id: receiverId, type: ref_type }),
                notification_url: `${supabaseUrl}/functions/v1/mp-webhook?action=webhook&receiver_id=${receiverId}`,
                back_urls: { success: `${origin}/?status=success`, failure: `${origin}/?status=failure`, pending: `${origin}/?status=pending` },
                auto_return: 'approved',
                payment_methods: {
                    excluded_payment_types: [
                        { id: 'atm' },
                        { id: 'ticket' }
                    ],
                    installments: 12
                }
            };

            const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(prefBody)
            });

            const preference = await mpResp.json();

            if (!mpResp.ok) {
                console.error("[MP Error]", preference);
                throw new Error(preference.message || preference.error || 'Erro ao gerar preferência no Mercado Pago');
            }

            if (!preference.init_point) {
                console.error("[MP Missing Link]", preference);
                throw new Error('O Mercado Pago não retornou um link de pagamento (init_point).');
            }

            return new Response(JSON.stringify({
                success: true,
                init_point: preference.init_point,
                preferenceId: preference.id
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- ACTION: CREATE_PIX (Transparent Checkout) ---
        if (action === 'create_pix') {
            const { plan_id, user_id, personal_owner_id, payer_email } = body;
            const ref_type = body.ref_type || 'marketplace';

            let receiverId = personal_owner_id;
            let planName = 'Plano TFIT';
            let planPrice = body.amount ? Number(body.amount) : 0;

            if (ref_type === 'mensalidade_tfit' || ref_type === 'tpoints') {
                let basePlan = null;
                if (plan_id && plan_id !== 'undefined' && !plan_id.startsWith('tpoints_')) {
                    const { data } = await supabaseClient.from('plans').select('*').eq('id', plan_id).maybeSingle();
                    basePlan = data;
                }

                if (!basePlan) {
                    if (plan_id === 'plano_ia' || plan_id === 'plano_ia_estudante' || plan_id === 'undefined') {
                        planName = 'Assinatura T-FIT IA';
                        planPrice = 29.90;
                        const { data: adminProfile } = await supabaseClient.from('profiles').select('id').eq('role', 'admin').limit(1).single();
                        receiverId = adminProfile?.id;
                    } else if (ref_type === 'tpoints') {
                        const pts = Number(plan_id.split('_')[1]) || 1000;
                        planName = `${pts} T-Points (Social)`;
                        planPrice = body.amount ? Number(body.amount) : (pts * 0.01);
                        const { data: adminProfile } = await supabaseClient.from('profiles').select('id').eq('role', 'admin').limit(1).single();
                        receiverId = adminProfile?.id;
                    } else {
                        throw new Error(`Plano base não encontrado: ${plan_id}`);
                    }
                } else {
                    planName = basePlan.name;
                    planPrice = Number(basePlan.price || 0);

                    if (basePlan.created_by) {
                        receiverId = basePlan.created_by;
                    } else {
                        const { data: adminProfile } = await supabaseClient.from('profiles').select('id').eq('role', 'admin').limit(1).single();
                        receiverId = adminProfile?.id;
                    }
                }
            } else {
                const { data: plan } = await supabaseClient.from('planos_personal').select('*').eq('id', plan_id).maybeSingle();
                if (!plan) throw new Error('Plano não encontrado.');

                planName = plan.nome;
                planPrice = Number(plan.preco || 0);
                receiverId = receiverId || plan.personal_id;
            }

            // Enhanced Receiver Strategy (Robust)
            let { data: config } = await supabaseClient.from('payment_configs').select('*').eq('user_id', receiverId || '').maybeSingle();

            if (!config) {
                console.log(`[MP Pix Config] Receiver ${receiverId} lacks config. Searching for ANY admin with config...`);

                const { data: adminConfigs } = await supabaseClient
                    .from('payment_configs')
                    .select('*, profiles!inner(role)')
                    .eq('profiles.role', 'admin')
                    .limit(1);

                if (adminConfigs && adminConfigs.length > 0) {
                    config = adminConfigs[0];
                    receiverId = config.user_id;
                    console.log(`[MP Pix Config] Admin Fallback found: ${receiverId}`);
                }
            }

            if (!config) {
                throw new Error(`Configuração de pagamento não localizada. O recebedor (${receiverId || 'indefinido'}) ou um Administrador do sistema precisa vincular o Mercado Pago.`);
            }

            console.log(`[MP Pix] Using receiver: ${receiverId}`);
            const accessToken = await decrypt(config.access_token, encryptionSecret);

            const pixResp = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction_amount: planPrice,
                    description: `T-FIT: ${planName}`, payment_method_id: 'pix',
                    external_reference: JSON.stringify({ user_id, plan_id, receiver_id: receiverId, type: ref_type }),
                    notification_url: `${supabaseUrl}/functions/v1/mp-webhook?action=webhook&receiver_id=${receiverId}`,
                    payer: { email: payer_email || 'contato@tfit.com' }
                })
            });
            const pixData = await pixResp.json();

            if (!pixResp.ok) {
                console.error("[MP Pix Error]", pixData);
                throw new Error(pixData.message || pixData.error || 'Erro ao gerar Pix no Mercado Pago');
            }

            if (!pixData.point_of_interaction?.transaction_data?.qr_code) {
                console.error("[MP Pix Missing Data]", pixData);
                throw new Error('O Mercado Pago não retornou os dados do QR Code Pix.');
            }

            return new Response(JSON.stringify({
                success: true,
                payment_id: pixData.id,
                qr_code: pixData.point_of_interaction.transaction_data.qr_code,
                qr_code_base64: pixData.point_of_interaction.transaction_data.qr_code_base64
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- ACTION: WEBHOOK (The "Clean Slate" Heart) ---
        if (action === 'webhook') {
            const topic = url.searchParams.get('topic') || body.type || (body.action?.includes('payment') ? 'payment' : null);
            const resourceId = url.searchParams.get('id') || (body.data && body.data.id);
            const receiverId = url.searchParams.get('receiver_id');

            console.log(`[Webhook] Topic: ${topic}, ID: ${resourceId}, Receiver: ${receiverId}`);

            if (topic === 'payment' && resourceId) {
                const { data: config } = await supabaseClient.from('payment_configs').select('*').eq('user_id', receiverId).maybeSingle();
                if (!config) return new Response('Config not found', { status: 200 });

                const accessToken = await decrypt(config.access_token, encryptionSecret);
                const mpPay = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (mpPay.ok) {
                    const payment = await mpPay.json();
                    if (payment.status === 'approved') {
                        const ext = JSON.parse(payment.external_reference);
                        const { user_id, plan_id, type, receiver_id } = ext;

                        if (type === 'mensalidade_tfit' || type === 'tpoints') {
                            if (type === 'tpoints') {
                                // Add points to profile
                                const pointsAmount = Number(plan_id.split('_')[1]) || 0;
                                console.log(`[Webhook] Adding ${pointsAmount} T-Points to user ${user_id}`);
                                await supabaseClient.rpc('add_tpoints', {
                                    user_id_param: user_id,
                                    amount_param: pointsAmount
                                });
                            } else {
                                // Fetch plan to get duration if available
                                const { data: basePlan } = await supabaseClient.from('plans').select('billing_cycle').eq('id', plan_id).maybeSingle();
                                let days = 30;
                                if (basePlan?.billing_cycle === 'Anual' || basePlan?.billing_cycle === 'Yearly') days = 365;
                                else if (basePlan?.billing_cycle === 'Semestral') days = 180;

                                const venc = new Date(); venc.setDate(venc.getDate() + days);

                                console.log(`[Webhook] Activating Platform Plan: ${plan_id} for user ${user_id}. Expiry: ${venc.toISOString()}`);

                                const updateData: any = {
                                    data_vencimento: venc.toISOString(),
                                    plan_expiry: venc.toISOString(),
                                    status: 'active',
                                    plano_ativo: true,
                                    plan_id: plan_id,
                                    status_pagamento: 'pago'
                                };

                                // If it's an IA plan, also flag ai_active
                                if (plan_id && (plan_id.toLowerCase().includes('ia') || plan_id.toLowerCase().includes('pro'))) {
                                    updateData.ai_active = true;
                                }

                                const { error: profError } = await supabaseClient.from('profiles').update(updateData).eq('id', user_id);
                                if (profError) {
                                    console.error("[Webhook Error] Profile Update Failed:", profError);
                                }
                            }
                        } else {
                            const { data: plan } = await supabaseClient.from('planos_personal').select('duracao_dias').eq('id', plan_id).maybeSingle();
                            const venc = new Date(); venc.setDate(venc.getDate() + (plan?.duracao_dias || 30));

                            // Log Payment
                            await supabaseClient.from('pagamentos').upsert({
                                aluno_id: user_id, personal_id: receiver_id, plano_id: plan_id, mercado_pago_id: String(payment.id),
                                valor: payment.transaction_amount, valor_liquido: payment.transaction_details?.net_received_amount || payment.transaction_amount, status: 'aprovado'
                            });

                            // Activate Link
                            await supabaseClient.from('alunos_planos').upsert({
                                aluno_id: user_id, personal_id: receiver_id, plano_id: plan_id, data_proxima_cobranca: venc.toISOString(), status: 'ativo'
                            }, { onConflict: 'aluno_id,personal_id' });

                            // Update Profile status
                            await supabaseClient.from('profiles').update({ status: 'active', assigned_personal_id: receiver_id }).eq('id', user_id);
                        }
                    }
                }
            }
            return new Response('ok', { status: 200 });
        }

        return new Response('Unknown action', { status: 400, headers: corsHeaders });
    } catch (e: any) {
        const errorMsg = e.message || e.toString() || 'Erro desconhecido no servidor';
        console.error("[FATAL ERROR]", errorMsg);
        return new Response(JSON.stringify({
            success: false,
            error: errorMsg
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }
});
