/**
 * T-FEED V2: PREMIUM SOCIAL & CHAT CORE
 * Integrado com Supabase + Algoritmo de Engajamento
 */
class TFeedV2 {
    constructor() {
        this.posts = [];
        this.currentUser = auth.getCurrentUser();
        this.activeChat = null;
        this.currentView = 'home';
        this.isLoading = false;
        this.isInitialized = false;
        
        if (document.readyState === 'complete') this.init();
        else window.addEventListener('load', () => this.init());
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        window.tfeed = this;
        
        await this.loadFeed();
        this.setupRealtime();
        this.trackActivity('view_feed');
    }

    // ============================================
    // ALGORITMO DE FEED (SMART ENGAJAMENTO)
    // ============================================
    async loadFeed() {
        this.isLoading = true;
        try {
            // Algoritmo: Prioriza Highlights (Premium) -> Seguidores -> Recentes
            const { data } = await supabase
                .from('posts')
                .select('*, profiles!user_id(name, photo_url, is_verified)')
                .order('is_highlighted', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(50);
            
            this.posts = data || [];
            this.render();
        } catch (err) { console.error(err); }
        this.isLoading = false;
    }

    // ============================================
    // CHAT PREMIUM (TEMPO REAL + REAÇÕES)
    // ============================================
    async sendMessage(convId, text, metadata = {}) {
        if (!text && !metadata.media) return;
        
        const msgData = {
            conversation_id: convId,
            sender_id: this.currentUser.id,
            content: text,
            metadata: metadata
        };

        // Feedback Otimista (UX Instantânea)
        this.appendMessageToUI(msgData, true);

        const { error } = await supabase.from('messages').insert([msgData]);
        if (error) UI.showNotification('Erro', 'Falha ao enviar mensagem.', 'error');
        
        this.trackActivity('send_message');
    }

    async reactToMessage(msgId, emoji) {
        const { data: msg } = await supabase.from('messages').select('metadata').eq('id', msgId).single();
        const meta = msg?.metadata || {};
        meta.reactions = meta.reactions || {};
        
        if (!meta.reactions[emoji]) meta.reactions[emoji] = [];
        meta.reactions[emoji].push(this.currentUser.id);

        await supabase.from('messages').update({ metadata: meta }).eq('id', msgId);
    }

    // ============================================
    // ENGAJAMENTO & MÉTRICAS
    // ============================================
    async trackActivity(type) {
        if (!this.currentUser) return;
        await supabase.from('user_activity').upsert({
            user_id: this.currentUser.id,
            last_activity: new Date().toISOString(),
            activity_type: type
        });
    }

    setupRealtime() {
        supabase.channel('tfeed_premium')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => this.handleNewMessage(p))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_status' }, p => this.handleStatusChange(p))
            .subscribe();
    }

    handleNewMessage(payload) {
        if (this.activeChat === payload.new.conversation_id && payload.new.sender_id !== this.currentUser.id) {
            this.appendMessageToUI(payload.new, false);
            if (window.navigator.vibrate) window.navigator.vibrate(100);
        }
    }

    // Helper de Renderização Instantânea
    appendMessageToUI(msg, isSent) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        
        const div = document.createElement('div');
        div.className = `msg-wrapper ${isSent ? 'sent' : 'received'}`;
        div.innerHTML = `
            <div class="tf-v2-message ${isSent ? 'sent' : 'received'}">
                ${msg.content}
                ${msg.metadata?.media ? `<img src="${msg.metadata.media.url}" class="msg-img">` : ''}
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
}
