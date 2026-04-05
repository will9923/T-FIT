// ================================================================
// SUPABASE EDGE FUNCTION: send-push-notification
// Usa Firebase Cloud Messaging API V1 (atual, recomendada)
//
// SETUP:
// 1. Firebase Console > Configurações > Contas de serviço
// 2. Clique em "Gerar nova chave privada" -> baixe o JSON
// 3. supabase secrets set FIREBASE_SERVICE_ACCOUNT='CONTEUDO_DO_JSON_AQUI'
// 4. supabase functions deploy send-push-notification
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configurações serão extraídas da Service Account dinamicamente

// Gera Access Token OAuth2 a partir da Service Account
async function getAccessToken(serviceAccount: any): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    }));

    const signingInput = `${header}.${payload}`;

    // Importa a chave privada da Service Account
    const privateKey = serviceAccount.private_key;
    const pemContents = privateKey
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\n/g, "");

    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8", binaryKey.buffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false, ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        new TextEncoder().encode(signingInput)
    );

    const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

    // Troca JWT pelo Access Token do Google
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenRes.json();
    return tokenData.access_token;
}

serve(async (req) => {
    try {
        const { user_id, title, body, data = {} } = await req.json();

        if (!user_id || !title || !body) {
            return new Response(
                JSON.stringify({ error: "user_id, title e body são obrigatórios" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Carrega Service Account do secret
        const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
        if (!serviceAccountStr) {
            return new Response(
                JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT não configurado. Veja as instruções." }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
        const serviceAccount = JSON.parse(serviceAccountStr);
        const projectId = serviceAccount.project_id;
        if (!projectId) {
            throw new Error("Project ID não encontrado no JSON da Service Account.");
        }
        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

        // Busca token FCM do usuário no Supabase
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: tokenData, error } = await supabase
            .from("user_push_tokens")
            .select("token")
            .eq("user_id", user_id)
            .maybeSingle();

        if (error || !tokenData?.token) {
            return new Response(
                JSON.stringify({ error: "Token FCM não encontrado para este usuário" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // Gera o Access Token OAuth2
        const accessToken = await getAccessToken(serviceAccount);

        // Payload FCM V1
        const fcmPayload = {
            message: {
                token: tokenData.token,
                notification: { title, body },
                android: {
                    priority: "HIGH",
                    notification: {
                        sound: "default",
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                        notification_count: 1
                    }
                },
                apns: {
                    payload: {
                        aps: { sound: "default", badge: 1 }
                    }
                },
                data: Object.fromEntries(
                    Object.entries({ ...data, title, body }).map(([k, v]) => [k, String(v)])
                )
            }
        };

        // Envia para FCM V1
        const fcmRes = await fetch(fcmUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify(fcmPayload),
        });

        const fcmResult = await fcmRes.json();

        if (!fcmRes.ok) {
            console.error("[FCM V1] Erro:", fcmResult);
            return new Response(
                JSON.stringify({ error: "FCM rejeitou", detail: fcmResult }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, message_id: fcmResult.name }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    } catch (err: any) {
        console.error("[Edge Function] Erro:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
