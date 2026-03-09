/**
 * TFIT - Notifications Page
 * Renders the list of notifications for the current user.
 */

window.renderNotificationsPage = async () => {
    const user = auth.getCurrentUser();
    if (!user) return;

    UI.showLoading('Carregando notificações...');

    try {
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        let content = `
            <div class="notifications-page">
                <div class="flex justify-between items-center mb-xl">
                    <h2 class="text-2xl font-bold">🔔 Notificações</h2>
                    <button class="btn btn-ghost btn-sm" onclick="NotificationManager.markAllAsRead()">
                        Limpar todas
                    </button>
                </div>
                
                <div class="notifications-list">
                    ${notifications.length === 0 ? `
                        <div class="text-center p-2xl text-muted">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                            <p>Você ainda não tem nenhuma notificação.</p>
                        </div>
                    ` : notifications.map(notif => renderNotificationItem(notif)).join('')}
                </div>
            </div>
        `;

        UI.renderDashboard('Notificações', content);

        // After rendering, update marks locally
        if (window.updateNotificationBadge) {
            window.updateNotificationBadge();
        }

    } catch (err) {
        console.error('[Notifications] Erro ao carregar:', err);
        UI.renderDashboard('Notificações', '<div class="p-xl text-center text-danger">Erro ao carregar notificações.</div>');
    } finally {
        UI.hideLoading();
    }
};

function renderNotificationItem(notif) {
    const isUnread = !notif.read;
    const date = new Date(notif.created_at).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Determine icon based on type
    let icon = '🔔';
    switch (notif.type) {
        case 'feed_like': icon = '❤️'; break;
        case 'feed_comment': icon = '💬'; break;
        case 'new_follower': icon = '👤'; break;
        case 'direct_message': icon = '✉️'; break;
        case 'app_reminder': icon = '⏰'; break;
        case 'system_alert': icon = '⚠️'; break;
        case 'challenge_invite': icon = '🏆'; break;
    }

    return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" 
             onclick="handleNotificationClick('${notif.id}', '${notif.link || ''}')">
            <div class="notif-icon-container">
                <span class="notif-type-icon">${icon}</span>
            </div>
            <div class="notif-content">
                <div class="notif-header">
                    <span class="notif-title">${notif.title}</span>
                    <span class="notif-date">${date}</span>
                </div>
                <p class="notif-message">${notif.message}</p>
            </div>
            ${isUnread ? '<div class="unread-dot"></div>' : ''}
        </div>
    `;
}

window.handleNotificationClick = async (notifId, link) => {
    // 1. Mark as read in DB
    if (window.markNotificationsAsRead) {
        await window.markNotificationsAsRead(notifId);
    }

    // 2. Navigate if link exists
    if (link && link !== '#') {
        router.navigate(link);
    } else {
        // Just refresh the page to show as read if no link
        renderNotificationsPage();
    }
};
