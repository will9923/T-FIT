/**
 * TFIT FIREBASE PUSH ENGINE v2.0
 * - Registra token FCM no banco (user_push_tokens)
 * - Dispara push via Supabase Edge Function
 * - Gerencia deep links ao clicar na notificação
 */
class PushService {

    // ============================================
    // INICIALIZAÇÃO (chamado no login / app boot)
    // ============================================
    static async init() {
        const user = auth.getCurrentUser();
        if (!user) return;

        console.log('[Push] Inicializando para:', user.name || user.email);

        // Ambiente nativo Capacitor (Android/iOS)
        if (window.Capacitor && window.PushNotifications) {
            await this.setupNativePush(user.id);
        }
        // Ambiente Web (PWA) — usa Firebase Messaging diretamente
        else if (typeof firebase !== 'undefined' && firebase.messaging) {
            await this.setupWebPush(user.id);
        } else {
            console.warn('[Push] Nenhum canal de push disponível neste ambiente.');
        }
    }

    // ============================================
    // PUSH NATIVO (Capacitor — Android / iOS)
    // ============================================
    static async setupNativePush(userId) {
        try {
            const perm = await PushNotifications.requestPermissions();
            if (perm.receive !== 'granted') {
                console.warn('[Push] Permissão negada pelo usuário.');
                return;
            }

            await PushNotifications.register();

            // Token FCM gerado pelo sistema
            PushNotifications.addListener('registration', async (token) => {
                console.log('[Push] ✅ Token FCM:', token.value);
                await this.saveToken(userId, token.value, 'android');
            });

            PushNotifications.addListener('registrationError', (err) => {
                console.error('[Push] Erro no registro:', err);
            });

            // Notificação recebida COM o app ABERTO (foreground)
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('[Push] Foreground:', notification);
                UI.showNotification(
                    notification.title || 'T-FIT',
                    notification.body || '',
                    'info'
                );
                // Vibração especial para mensagens
                if (notification.data?.type === 'message' && window.navigator.vibrate) {
                    window.navigator.vibrate([100, 50, 100]);
                }
            });

            // Usuário CLICOU na notificação
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('[Push] Clicou na notificação:', action.notification.data);
                this.handleDeepLink(action.notification.data);
            });

        } catch (err) {
            console.error('[Push] Falha no setup nativo:', err);
        }
    }

    // ============================================
    // PUSH WEB (Firebase Messaging — PWA / Browser)
    // ============================================
    static async setupWebPush(userId) {
        try {
            if (!firebase.apps.length) return;
            const messaging = firebase.messaging();

            // Solicita permissão e pega o token
            const token = await messaging.getToken({
                vapidKey: 'BEA1kG-S3QgzG2fU67FbBC_AOYI4xtyvQqowttpORFSNn-1XA6M8rOmjBA_9c03Q0wi-AVRrmf59Jx5QyxDOIGQ'
            });

            if (token) {
                console.log('[Push Web] ✅ Token FCM:', token);
                await this.saveToken(userId, token, 'web');
            }

            // Foreground message handler (app aberto no browser)
            messaging.onMessage((payload) => {
                console.log('[Push Web] Mensagem recebida:', payload);
                UI.showNotification(
                    payload.notification?.title || 'T-FIT',
                    payload.notification?.body || '',
                    'info'
                );
            });
        } catch (err) {
            console.error('[Push Web] Falha:', err);
        }
    }

    // ============================================
    // SALVAR TOKEN NO BANCO (Supabase)
    // ============================================
    static async saveToken(userId, token, platform) {
        const { error } = await supabase.from('user_push_tokens').upsert({
            user_id: userId,
            token: token,
            platform: platform,
            updated_at: new Date().toISOString()
        });
        if (error) {
            console.error('[Push] Erro ao salvar token no banco:', error.message);
        } else {
            console.log('[Push] Token salvo no banco com sucesso.');
        }
    }

    // ============================================
    // ENVIAR NOTIFICAÇÃO (Via Supabase Edge Function)
    // ============================================
    static async send(targetUserId, title, body, data = {}) {
        if (!targetUserId) return;
        try {
            const { error } = await supabase.functions.invoke('send-push-notification', {
                body: { user_id: targetUserId, title, body, data }
            });
            if (error) console.error('[Push] Falha ao enviar via Edge Function:', error);
        } catch (err) {
            console.error('[Push] Erro ao chamar Edge Function:', err.message);
        }
    }

    // ============================================
    // DEEP LINK (Abre a tela correta ao clicar)
    // ============================================
    static handleDeepLink(data) {
        if (!data?.type) return;
        console.log('[Push] Deep Link:', data.type, data);

        const routes = {
            'message': () => {
                // Abre o Direct na conversa correta
                if (window.tfeed && data.conversation_id) {
                    router.navigate('/student/feed');
                    setTimeout(() => tfeed.renderView('direct'), 300);
                }
            },
            'like':    () => router.navigate('/student/feed'),
            'comment': () => router.navigate('/student/feed'),
            'follow':  () => router.navigate('/student/feed'),
            'call':    () => {
                if (window.tfeed && data.call_id) {
                    router.navigate('/student/feed');
                }
            }
        };

        if (routes[data.type]) routes[data.type]();
    }

    // ============================================
    // NOTIFICAÇÕES PRÉ-DEFINIDAS (Helpers)
    // ============================================

    // Chame isso quando alguém enviar uma mensagem
    static async notifyMessage(targetUserId, senderName, text, conversationId) {
        await this.send(
            targetUserId,
            `💬 ${senderName}`,
            text.length > 50 ? text.substring(0, 50) + '...' : text,
            { type: 'message', conversation_id: conversationId }
        );
    }

    // Chame quando alguém curtir um post
    static async notifyLike(targetUserId, senderName, postId) {
        await this.send(
            targetUserId,
            '❤️ Nova curtida',
            `${senderName} curtiu sua publicação.`,
            { type: 'like', post_id: postId }
        );
    }

    // Chame quando alguém seguir o usuário
    static async notifyFollow(targetUserId, senderName) {
        await this.send(
            targetUserId,
            '👤 Novo seguidor',
            `${senderName} começou a te seguir.`,
            { type: 'follow' }
        );
    }

    // Chame quando uma chamada for iniciada
    static async notifyCall(targetUserId, senderName, callId, callType) {
        await this.send(
            targetUserId,
            `📞 ${callType === 'video' ? 'Chamada de vídeo' : 'Chamada de voz'}`,
            `${senderName} está te chamando...`,
            { type: 'call', call_id: callId }
        );
    }
}
