/**
 * TFIT - Sistema de Notificações PWA + Supabase
 * Gerencia permissões, tokens de dispositivo e sincronização em tempo real.
 */

window.setupPushNotifications = async () => {
    console.log("🚀 Iniciando sistema de Push Notifications (Supabase)...");

    const user = auth.getCurrentUser();
    if (!user) {
        console.warn("[Push] Usuário não logado. Abortando configuração.");
        return;
    }

    // 1. Verificar suporte do navegador
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.warn("❌ Notificações não são suportadas neste navegador.");
        return;
    }

    try {
        // 2. Solicitar Permissão
        const permission = await Notification.requestPermission();
        console.log(`[Push] Permissão: ${permission}`);

        if (permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;

            // Substituir pela sua VAPID PUBLIC KEY do Supabase/Edge Function
            const VAPID_PUBLIC_KEY = "BEA1kG-S3QgzG2fU67FbBC_AOYI4xtyvQqowttpORFSNn-1XA6M8rOmjBA_9c03Q0wi-AVRrmf59Jx5QyxDOIGQ";

            // 3. Obter Assinatura de Push (Substitui o Token FCM)
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            console.log("✅ PWA Subscription gerada.");

            // 4. Salvar no Supabase
            await saveTokenToSupabase(user.id, subscription);

            // 5. Configurar Listener Realtime para Badge
            setupRealtimeNotifications(user.id);
        }

    } catch (error) {
        console.error("❌ Erro ao configurar Push Notifications:", error);
    }
};

/**
 * Salva a assinatura do dispositivo na tabela device_tokens
 */
async function saveTokenToSupabase(userId, subscription) {
    try {
        const { error } = await supabase
            .from('device_tokens')
            .upsert({
                user_id: userId,
                token: JSON.stringify(subscription),
                device_type: 'pwa'
            }, { onConflict: 'user_id, token' });

        if (error) throw error;
        console.log("✅ Token de dispositivo sincronizado com Supabase.");
    } catch (err) {
        console.error("[Push] Falha ao salvar token:", err.message);
    }
}

/**
 * Escuta mudanças na tabela notifications e atualiza a UI
 */
function setupRealtimeNotifications(userId) {
    if (!window.supabase) return;

    console.log(`[Push] Ativando Realtime para usuário: ${userId}`);

    // Inscrever para novas notificações
    supabase
        .channel(`notifications-${userId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            console.log("🔔 Nova notificação recebida em tempo real:", payload.new);

            // Atualizar badge no cabeçalho ou menu
            updateNotificationBadge();

            // Mostrar notificação In-App se o app estiver aberto
            if (window.UI && UI.showNotification) {
                UI.showNotification(payload.new.title, payload.new.message, 'info');
            }
        })
        .subscribe();
}

/**
 * Atualiza o contador de notificações não lidas na interface
 */
window.updateNotificationBadge = async () => {
    const user = auth.getCurrentUser();
    if (!user) return;

    try {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false);

        if (error) throw error;

        const badgeElements = document.querySelectorAll('.notification-badge');
        badgeElements.forEach(el => {
            if (count > 0) {
                el.innerText = count > 9 ? '9+' : count;
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    } catch (err) {
        console.warn("[Push] Erro ao buscar contagem de notificações:", err.message);
    }
};

/**
 * Marca uma notificação individual ou todas como lidas
 */
window.markNotificationsAsRead = async (notificationId = null) => {
    const user = auth.getCurrentUser();
    if (!user) return;

    let query = supabase.from('notifications').update({ read: true }).eq('user_id', user.id);

    if (notificationId) {
        query = query.eq('id', notificationId);
    } else {
        query = query.eq('read', false);
    }

    const { error } = await query;
    if (!error) {
        updateNotificationBadge();
        // Se estiver na tela de notificações, recarregar a lista
        if (window.router?.currentRoute === '/notifications') {
            renderNotificationsPage();
        }
    }
};

// Helper function
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
