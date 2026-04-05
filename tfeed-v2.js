/**
 * T-FEED V2: PREMIUM INSTAGRAM-STYLE SOCIAL MODULE
 * Fully integrated with T-FIT Ecosystem
 * @version 2.0.0
 */

class TFeedV2 {
    constructor() {
        this.posts = [];
        this.stories = [];
        this.currentUser = auth.getCurrentUser();
        this.currentView = 'home'; // home, reels, search, direct, profile
        this.reelsViewMode = 'grid'; // grid or player
        this.activeReelIndex = 0;
        this.isLoading = false;
        this.isInitialized = false;
        this.realtimeChannel = null;
        this.containerId = 't-feed-container';
        this.userLikes = new Set();
        this.userSaves = new Set();
        this.followingIds = new Set();
        this.activeChat = null;
        this.activeChatTargetId = null;
        this.replyContext = null;
        this.selectedMedia = null;
        this.typingTimeout = null;
        this.userPresenceInterval = null;
        this.viewedStories = new Set(JSON.parse(localStorage.getItem('tf_viewed_stories') || '[]'));

        // Auto-init if DOM is ready
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            this.init();
        } else {
            window.addEventListener('load', () => this.init());
        }
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log('[T-Feed V2] 🚀 Premium Social Engine Iniciado');
        window.tfeed = this;

        // Setup initial local state
        await this.loadInitialData();
        this.setupRealtimeSync();
        this.setupCallListener();
        this.startPresenceHeartbeat();

        // Activity tracking
        this.trackActivity('app_open');

        // Refresh periodically for stories expiry
        setInterval(() => this.cleanupExpiredStories(), 60000);
    }

    startPresenceHeartbeat() {
        if (!this.currentUser) return;
        const update = async (online) => {
            try {
                await window.supabase.from('user_status').upsert({ user_id: this.currentUser.id, is_online: online, last_seen: new Date().toISOString() });
            } catch (e) { /* silent */ }
        };
        update(true);
        this.userPresenceInterval = setInterval(() => update(true), 60000);
        window.addEventListener('beforeunload', () => update(false));
    }

    async trackActivity(type) {
        if (!this.currentUser) return;
        try {
            await window.supabase.from('user_activity').upsert({ user_id: this.currentUser.id, last_active_at: new Date().toISOString() });
        } catch (e) { /* silent — table might not exist yet */ }
    }

    async loadInitialData() {
        if (!this.currentUser) return;
        this.isLoading = true;

        try {
            const [postsRes, storiesRes, likesRes, savesRes, profileRes] = await Promise.all([
                window.supabase.from('posts')
                    .select('*, profiles!user_id(name, photo, photo_url, is_verified)')
                    .order('created_at', { ascending: false })
                    .limit(30),
                window.supabase.from('stories')
                    .select('*, profiles!user_id(name, photo, photo_url, is_verified)')
                    .gt('expires_at', new Date().toISOString())
                    .order('created_at', { ascending: true }),
                window.supabase.from('likes').select('post_id').eq('user_id', this.currentUser.id),
                window.supabase.from('saves').select('post_id').eq('user_id', this.currentUser.id),
                window.supabase.from('profiles').select('following, followers, t_points, is_verified').eq('id', this.currentUser.id).single()
            ]);

            // Optimized Boost Logic: Fetch active boosts first
            const { data: activeBoosts } = await window.supabase.from('t_boosts').select('item_id').gt('expires_at', new Date().toISOString());
            const boostedIds = new Set(activeBoosts?.map(b => b.item_id) || []);

            if (postsRes.data) {
                this.posts = postsRes.data.map(p => ({
                    ...p,
                    is_boosted: boostedIds.has(p.id)
                }));
                // Sort: Boosted first, then by date
                this.posts.sort((a, b) => {
                    if (a.is_boosted && !b.is_boosted) return -1;
                    if (!a.is_boosted && b.is_boosted) return 1;
                    return new Date(b.created_at) - new Date(a.created_at);
                });
            }
            if (storiesRes.data) this.stories = this.groupStories(storiesRes.data);
            if (likesRes.data) this.userLikes = new Set(likesRes.data.map(l => l.post_id));
            if (savesRes.data) this.userSaves = new Set(savesRes.data.map(s => s.post_id));

            if (profileRes.data) {
                this.currentUser.t_points = profileRes.data.t_points;
                this.currentUser.is_verified = profileRes.data.is_verified;
                this.followingIds = new Set(profileRes.data.following || []);
            }

            this.isLoading = false;
            this.render();
        } catch (err) {
            console.error('[T-Feed V2] Data Fetch Error:', err);
            this.isLoading = false;
            this.render();
        }
    }

    groupStories(stories) {
        const grouped = {};
        stories.forEach(s => {
            const uid = s.user_id;
            if (!grouped[uid]) {
                grouped[uid] = {
                    user: s.profiles || { name: 'Usuário', photo: './logo.png' },
                    items: []
                };
            }
            grouped[uid].items.push(s);
        });
        return grouped;
    }

    setupRealtimeSync() {
        this.realtimeChannel = window.supabase.channel('tfeed_premium_v2')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => this.handleNewMessage(p))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => this.handleMessageUpdate(p))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_status' }, (p) => this.handlePresenceChange(p))
            .on('broadcast', { event: 'typing' }, (p) => this.handleTypingEvent(p))
            .subscribe();
    }

    setupCallListener() {
        if (!this.currentUser || !window.supabase) return;
        
        const channel = window.window.supabase.channel('tfeed_calls_realtime');
        
        channel
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'calls',
                filter: `target_id=eq.${this.currentUser.id}`
            }, (payload) => {
                if (payload.new.status === 'calling') {
                    this.handleIncomingCall(payload.new);
                }
            })
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'calls'
            }, (payload) => {
                const call = payload.new;
                // Se a chamada ativa mudou de status para encerrada ou rejeitada, fecha a tela
                if (this.activeCall && this.activeCall.id === call.id) {
                    if (call.status === 'ended' || call.status === 'rejected') {
                        console.log('[Calls] Chamada finalizada remotamente.');
                        this.endCall(true); // true = skipUpdate
                    }
                }
            })
            .subscribe();
    }

    handlePresenceChange(payload) {
        // Atualiza silenciosamente as bolinhas de status no DOM, sem renderizar a tela toda
        const { user_id, status } = payload.new;
        const statusDots = document.querySelectorAll(`.status-dot[data-user-id="${user_id}"]`);
        statusDots.forEach(dot => {
            dot.className = `status-dot ${status === 'online' ? 'online' : 'offline'}`;
        });
        
        // Se estiver no chat com essa pessoa, atualiza o cabeçalho do chat
        if (this.activeChat === user_id) {
            const subtitle = document.querySelector('.tf-v2-chat-subtitle');
            if (subtitle) subtitle.innerText = status === 'online' ? 'Online agora' : 'Offline';
        }
    }

    async refreshPosts() {
        const { data } = await window.supabase.from('posts').select('*, profiles!user_id(name, photo, photo_url, is_verified)').order('created_at', { ascending: false }).limit(30);
        if (data) {
            this.posts = data;
            // Só re-renderiza se o usuário estiver na tela home E não tiver nada carregado ainda
            if (this.currentView === 'home') {
                const feed = document.querySelector('.tf-v2-feed-stream');
                if (!feed) this.renderView(); // primeira vez
                // caso contrário, atualiza silenciosamente o array e não pisca
            }
        }
    }

    // ============================================
    // MAIN RENDERING ENGINE
    // ============================================

    render(containerId = this.containerId, view = this.currentView) {
        this.containerId = containerId;

        // Se o T-Feed já está renderizado nesse container, apenas troca a view sem piscar
        const existingWrapper = document.getElementById('tfeed-v2-wrapper');
        if (existingWrapper && this.isInitialized) {
            this.renderView(view);
            return;
        }

        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div id="tfeed-v2-wrapper" style="position: fixed; inset: 0; z-index: 99999; background: #000; overflow-y: auto;">
                ${this.renderHeader()}
                <main id="tfeed-v2-content" style="min-height: 80vh; padding-bottom: 90px; transition: opacity 0.15s ease;">
                    ${this.renderLoadingState()}
                </main>
                ${this.renderBottomNav()}
            </div>
        `;

        // Inject CSS if not already there
        if (!document.getElementById('tfeed-v2-css')) {
            const link = document.createElement('link');
            link.id = 'tfeed-v2-css';
            link.rel = 'stylesheet';
            link.href = 'tfeed-v2.css?v=2';
            document.head.appendChild(link);
        }

        this.renderView();
    }

    renderHeader() {
        if (['reels', 'profile'].includes(this.currentView)) return '';

        const backBtn = this.currentView === 'post_detail' ? `<button class="tf-v2-icon-btn" onclick="tfeed.renderView('profile')"><i class="bi bi-chevron-left"></i> Voltar</button>` : '';

        return `
            <header class="tf-v2-header">
                ${backBtn || `<button class="tf-v2-icon-btn" onclick="tfeed.openMainMenu()"><i class="bi bi-list" style="font-size:26px;"></i></button>`}
                <div class="tf-v2-logo-container">
                    <div class="logo-tfit-v2"><span class="white">T-</span><span class="blue">FEED</span></div>
                    <span class="logo-social-v2">social</span>
                </div>
                <div class="tf-v2-header-actions" style="display:flex; align-items:center; gap: 10px;">
                    <button class="tf-v2-icon-btn" onclick="spotifyUI.toggleFullPlayer(true)" id="btn-t-music-header">
                         <i class="bi bi-music-note-beamed" style="color:#1DB954; font-size:22px;"></i>
                    </button>
                    <button class="tf-v2-icon-btn" onclick="tfeed.openActivityLog()"><i class="bi bi-heart" style="font-size:22px;"></i></button>
                    <button class="tf-v2-icon-btn" onclick="tfeed.renderView('direct')"><i class="bi bi-chat-text" style="font-size:22px;"></i></button>
                </div>
            </header>
        `;
    }

    renderBottomNav() {
        const items = [
            { id: 'home', icon: 'house-door', active: 'house-door-fill', label: 'Home' },
            { id: 'reels', icon: 'play-btn', active: 'play-btn-fill', label: 'Reels' },
            { id: 'add', icon: 'plus-square', active: 'plus-square-fill', label: 'Add', special: true },
            { id: 'direct', icon: 'chat-dots', active: 'chat-dots-fill', label: 'Direct' },
            { id: 'profile', icon: 'person', active: 'person-fill', label: 'Perfil' }
        ];

        return `
            <nav class="tf-v2-bottom-nav">
                ${items.map(item => `
                    <div class="tf-v2-nav-btn ${this.currentView === item.id ? 'active' : ''}" 
                         onclick="${item.id === 'add' ? 'tfeed.openAddOptions()' : `tfeed.renderView('${item.id}')`}"
                         style="transition: transform 0.2s;">
                        <i class="bi bi-${this.currentView === item.id ? item.active : item.icon}"></i>
                        <span>${item.label}</span>
                    </div>
                `).join('')}
            </nav>
        `;
    }

    renderLoadingState() {
        return `
            <div class="tf-v2-loading p-xl text-center">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-md text-muted">Sincronizando feed...</p>
            </div>
        `;
    }

    async renderView(view = this.currentView, targetId = null) {
        // GUARD ABSOLUTO: se o chat estiver visível no DOM, NADA pode destruir
        const chatVisible = !!document.getElementById('chat-messages');
        if (chatVisible) {
            // Só permite sair do chat explicitamente via closeActiveChat()
            this.currentView = view;
            return;
        }

        this.currentView = view;
        this.activeChat = null;

        const main = document.getElementById('tfeed-v2-content');
        if (!main) return;

        // Atualiza o nav sem piscar
        document.querySelectorAll('.tf-v2-nav-btn').forEach(el => el.classList.remove('active'));
        const activeNav = document.querySelector(`.tf-v2-nav-btn[onclick*="'${view}'"]`);
        if (activeNav) activeNav.classList.add('active');

        // REMOVIDO FADE-OUT (CAUSADOR DE FLICKER)

        switch (view) {
            case 'home':
                main.innerHTML = this.renderHomeFeed();
                break;
            case 'reels':
                main.innerHTML = this.renderReels();
                break;
            case 'search':
                main.innerHTML = this.renderSearch();
                break;
            case 'profile':
                main.innerHTML = await this.renderProfile(targetId || this.currentUser.id);
                break;
            case 'direct':
                await this.renderDirect();
                break;
            case 'post_detail':
                main.innerHTML = await this.renderPostDetail(targetId);
                break;
            default:
                main.innerHTML = this.renderHomeFeed();
        }

        main.style.opacity = '1';
        this.initAutoPlay();
    }

    // ============================================
    // VIEW: HOME FEED
    // ============================================

    renderHomeFeed() {
        if (this.isLoading && this.posts.length === 0) return this.renderLoadingState();

        const spotifyBtn = !spotifyManager.accessToken 
            ? `<div class="p-md bg-dark border-radius-lg mb-lg flex justify-between items-center" style="background:#1DB954; color:white">
                <div class="flex items-center gap-md">
                    <i class="bi bi-spotify text-2xl"></i>
                    <div>
                        <div class="font-bold">Spotify Desconectado</div>
                        <div class="text-xs">Conecte para música nos treinos</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-white" onclick="spotifyManager.login()">Conectar</button>
               </div>`
            : '';

        return `
            ${spotifyBtn}
            <h3 class="tf-v2-section-title">Stories</h3>
            <div class="tf-v2-stories-bar">
                ${this.renderStoriesBar()}
            </div>
            <div class="tf-v2-feed-stream">
                ${this.posts.length > 0
                ? this.posts.map(p => this.renderPostCard(p)).join('')
                : `<div class="p-xl text-center text-muted">Compartilhe seu primeiro treino!</div>`
            }
            </div>
        `;
    }

    renderStoriesBar() {
        // Find current user's stories
        const myStories = this.stories[this.currentUser.id];
        const hasMyStories = myStories && myStories.items.length > 0;
        const isMyStoryWatched = hasMyStories && myStories.items.every(item => this.viewedStories.has(item.id));

        let html = `
            <div class="tf-v2-story-item">
                <div class="tf-v2-story-ring ${hasMyStories ? (isMyStoryWatched ? 'watched' : 'has-stories') : ''}" 
                     onclick="${hasMyStories ? `tfeed.viewStories('${this.currentUser.id}')` : 'storyEditor.open()'}">
                    <img src="${this.currentUser.photo_url || this.currentUser.photo || './logo.png'}" class="tf-v2-story-avatar">
                    <div class="tf-v2-story-plus-badge" onclick="event.stopPropagation(); storyEditor.open()">+</div>
                </div>
                <span class="tf-v2-story-name">Seu Story</span>
            </div>
        `;

        Object.entries(this.stories).forEach(([uid, data]) => {
            if (uid === this.currentUser.id) return; 
            const profile = data.user;
            const avatar = profile.photo_url || profile.photo || './logo.png';
            const isWatched = data.items.every(item => this.viewedStories.has(item.id));
            
            html += `
                <div class="tf-v2-story-item" onclick="tfeed.viewStories('${uid}')">
                    <div class="tf-v2-story-ring ${isWatched ? 'watched' : 'has-stories'}">
                        <img src="${avatar}" class="tf-v2-story-avatar">
                    </div>
                    <span class="tf-v2-story-name">${profile.name || 'Usuário'}</span>
                </div>
            `;
        });

        return html;
    }

    triggerStoryUpload() {
        const input = document.getElementById('direct-story-input');
        if (input) input.click();
    }

    async handleDirectStoryUpload(input) {
        const file = input.files[0];
        if (!file) return;

        UI.showLoading('Publicando story...');
        try {
            const fileName = `story_${Date.now()}_${file.name}`;
            const { data, error } = await window.supabase.storage.from('stories_media').upload(`${this.currentUser.id}/${fileName}`, file);
            if (error) throw error;

            const { data: { publicUrl } } = window.supabase.storage.from('stories_media').getPublicUrl(`${this.currentUser.id}/${fileName}`);

            await window.supabase.from('stories').insert({
                user_id: this.currentUser.id,
                media_url: publicUrl
            });

            this.awardPoints('Story criado', 2);
            UI.hideLoading();
            UI.showNotification('Sucesso', 'Story publicado!', 'success');
            this.loadInitialData(); // Refresh to show new story
        } catch (err) {
            UI.hideLoading();
            UI.showNotification('Erro', err.message, 'error');
        }
    }

    renderPostCard(post) {
        const profile = post.profiles || {};
        const name = profile.name || 'Usuário';
        const avatar = profile.photo_url || profile.photo || './logo.png';
        const isLiked = this.userLikes.has(post.id);
        const isSaved = this.userSaves.has(post.id);
        const isVerified = profile.is_verified;
        const isOwner = post.user_id === this.currentUser.id;

        let musicHtml = '';
        try {
            if (post.caption && post.caption.trim().startsWith('{')) {
                const metadata = JSON.parse(post.caption);
                if (metadata && metadata.uri) {
                    musicHtml = `
                        <div class="px-md py-sm mb-md flex justify-between items-center" 
                             style="background:rgba(29, 185, 84, 0.1); border:1px solid rgba(29, 185, 84, 0.2); margin: 0 12px 12px; border-radius: 12px;">
                            <div class="flex items-center gap-sm overflow-hidden" style="flex:1">
                                <i class="bi bi-spotify" style="color:#1DB954; font-size: 18px;"></i>
                                <div class="text-xs text-ellipsis" style="color:rgba(255,255,255,0.9)"><b>Tocando:</b> ${metadata.music}</div>
                            </div>
                            <button class="btn btn-ghost btn-sm p-0 ml-md" onclick="spotifyManager.play('${metadata.uri}')">
                                <i class="bi bi-play-circle-fill text-2xl" style="color:#1DB954"></i>
                            </button>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.warn('Metadata parse error', e);
        }

        return `
            <article class="tf-v2-post" data-post-id="${post.id}">
                <div class="tf-v2-post-header">
                    <div class="tf-v2-post-user">
                        <img src="${avatar}" class="tf-v2-post-avatar" onclick="tfeed.viewStories('${post.user_id}')" style="cursor: pointer;">
                        <div onclick="tfeed.renderViewProfile('${post.user_id}')" style="cursor: pointer;">
                            <span class="tf-v2-post-username">${name} ${isVerified ? '<i class="bi bi-patch-check-fill tf-v2-verified-badge"></i>' : ''}</span>
                            <div class="text-xs text-muted">@${name.toLowerCase().replace(/\s+/g, '')} ${post.is_boosted ? '<span class="badge-boost ml-xs">🚀 Patrocinado</span>' : ''}</div>
                        </div>
                    </div>
                    <button class="tf-v2-icon-btn" onclick="tfeed.openPostMenu('${post.id}', '${post.user_id}')"><i class="bi bi-three-dots"></i></button>
                </div>

                <div class="tf-v2-post-media-container" ondblclick="tfeed.handlePostLike('${post.id}', true)">
                    ${post.media_type === 'video'
                ? `<video src="${post.media_url}" class="tf-v2-post-media" loop muted playsinline 
                           onclick="tfeed.handleVideoInteraction(this, 'click')"
                           onpointerdown="tfeed.handleVideoInteraction(this, 'press')"
                           onpointerup="tfeed.handleVideoInteraction(this, 'release')"
                           onpointercancel="tfeed.handleVideoInteraction(this, 'release')"></video>`
                : `<img src="${post.media_url}" class="tf-v2-post-media" loading="lazy">`
            }
                </div>

                <div class="tf-v2-post-actions">
                    <div class="tf-v2-actions-left" style="display:flex; gap:20px; align-items: center;">
                        <i class="bi bi-heart${isLiked ? '-fill liked' : ''} tf-v2-action-icon" 
                           id="like-icon-${post.id}"
                           onclick="tfeed.handlePostLike('${post.id}')"
                           style="${isLiked ? 'color: #fe2c55;' : ''}"></i>
                        <i class="bi bi-chat tf-v2-action-icon" onclick="tfeed.openComments('${post.id}')"></i>
                        <i class="bi bi-send tf-v2-action-icon" onclick="tfeed.sharePost('${post.id}')"></i>
                        ${isOwner ? `<button class="btn btn-xs btn-outline-cyan" onclick="tfeed.handleBoost('${post.id}')" style="font-size: 10px; border-radius: 10px; padding: 2px 8px;">IMPULSIONAR</button>` : ''}
                    </div>
                    <i class="bi bi-bookmark${isSaved ? '-fill' : ''} tf-v2-action-icon" 
                       id="save-icon-${post.id}"
                       onclick="tfeed.handlePostSave('${post.id}')"
                       style="${isSaved ? 'color: var(--tf-accent);' : ''}"></i>
                </div>

                <div class="tf-v2-likes-count">
                    <i class="bi bi-star-fill"></i> <span id="likes-count-${post.id}">${post.likes_count || 0}</span> curtidas
                </div>

                <div class="tf-v2-post-body">
                    ${musicHtml}
                    <div class="tf-v2-post-caption">
                        <strong>${name}</strong> ${post.caption && !post.caption.trim().startsWith('{') ? post.caption : ''}
                        <div id="comments-count-${post.id}" class="text-xs text-muted mt-sm" style="opacity: 0.6; cursor: pointer;" onclick="tfeed.openComments('${post.id}')">Ver todos os ${post.comments_count || 0} comentários</div>
                    </div>
                    <div class="tf-v2-post-time">${this.timeAgo(post.created_at)}</div>
                </div>
            </article>
        `;
    }

    renderReels() {
        const reels = this.posts.filter(p => p.media_type === 'video');
        if (reels.length === 0) return `<div class="p-xl text-center text-muted">Nenhum Reels disponível.</div>`;

        if (this.reelsViewMode === 'player') {
            return this.renderReelsPlayer(reels);
        }

        return `
            <div class="tf-v2-reels-explorer-header">
                <div class="flex items-center gap-sm">
                    <i class="bi bi-play-circle-fill text-cyan"></i>
                    <h3 class="m-0 font-black">Explorar Reels</h3>
                </div>
            </div>
            <div class="tf-v2-reels-grid">
                ${reels.map((reel, idx) => `
                    <div class="tf-v2-reels-grid-item" onclick="tfeed.openReelsPlayer(${idx})">
                        <video src="${reel.media_url}" muted playsinline preload="metadata"></video>
                        <div class="tf-v2-reels-grid-stats">
                            <i class="bi bi-play-fill"></i> ${reel.likes_count || 0}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderReelsPlayer(reels) {
        return `
            <div class="tf-v2-reels-player-container">
                <button class="tf-v2-reels-back-btn" onclick="tfeed.reelsViewMode='grid'; tfeed.renderView('reels')">
                    <i class="bi bi-arrow-left"></i>
                </button>
                <div class="tf-v2-reels-vertical-scroll" id="reels-scroller">
                    ${reels.map((reel, idx) => `
                        <div class="tf-v2-reel-item" id="reel-item-${idx}">
                            <video src="${reel.media_url}" class="tf-v2-reel-video" loop playsinline 
                                   ${idx === this.activeReelIndex ? 'autoplay' : ''} 
                                   muted
                                   onclick="tfeed.handleVideoInteraction(this, 'click')"
                                   onpointerdown="tfeed.handleVideoInteraction(this, 'press')"
                                   onpointerup="tfeed.handleVideoInteraction(this, 'release')"
                                   onpointercancel="tfeed.handleVideoInteraction(this, 'release')"></video>
                            
                            <div class="tf-v2-reel-info">
                                <div class="flex items-center gap-sm mb-md">
                                    <img src="${reel.profiles.photo_url || './logo.png'}" style="width:32px; height:32px; border-radius:50%; border:1px solid #fff;">
                                    <strong onclick="tfeed.renderViewProfile('${reel.user_id}')">${reel.profiles.name}</strong>
                                    <button class="btn btn-xs btn-outline" style="border-radius:20px; color:#fff; border-color:#fff; padding: 2px 10px;">Seguir</button>
                                </div>
                                <p class="text-sm">${reel.caption || ''}</p>
                            </div>

                            <div class="tf-v2-reel-actions">
                                <div class="tf-v2-reel-action" onclick="tfeed.handlePostLike('${reel.id}')">
                                    <i class="bi bi-heart${this.userLikes.has(reel.id) ? '-fill liked' : ''}" style="${this.userLikes.has(reel.id) ? 'color:#fe2c55;' : ''}"></i>
                                    <span>${reel.likes_count || 0}</span>
                                </div>
                                <div class="tf-v2-reel-action" onclick="tfeed.openComments('${reel.id}')">
                                    <i class="bi bi-chat-fill"></i>
                                    <span>${reel.comments_count || 0}</span>
                                </div>
                                <div class="tf-v2-reel-action" onclick="tfeed.sharePost('${reel.id}')">
                                    <i class="bi bi-send-fill"></i>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    openReelsPlayer(index) {
        this.reelsViewMode = 'player';
        this.activeReelIndex = index;
        this.renderView('reels');
        
        // Scroll to active index
        setTimeout(() => {
            const item = document.getElementById(`reel-item-${index}`);
            if (item) item.scrollIntoView();
            
            // Observer to play/pause on scroll
            this.setupReelsObserver();
        }, 100);
    }

    setupReelsObserver() {
        const scroller = document.getElementById('reels-scroller');
        if (!scroller) return;

        const options = { threshold: 0.8 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                if (entry.isIntersecting) {
                    if (video) video.play();
                } else {
                    if (video) { video.pause(); video.currentTime = 0; }
                }
            });
        }, options);

        document.querySelectorAll('.tf-v2-reel-item').forEach(el => observer.observe(el));
    }

    // ============================================
    // HEADER ACTIONS: MENU & NOTIFICATIONS
    // ============================================

    openMainMenu() {
        const modalContent = `
            <div class="p-lg" style="display: flex; flex-direction: column; gap: 10px;">
                <button class="btn btn-ghost w-100 text-left py-md px-lg" onclick="UI.closeModal(); tfeed.renderView('profile')">
                    <i class="bi bi-person mr-md"></i> Ver Meu Perfil
                </button>
                <button class="btn btn-ghost w-100 text-left py-md px-lg" onclick="UI.closeModal(); tfeed.showPointsStore('${this.currentUser.t_points || 0}')">
                    <i class="bi bi-lightning-fill text-warning mr-md"></i> Meu Saldo T-PONTOS
                </button>
                <button class="btn btn-ghost w-100 text-left py-md px-lg" onclick="UI.closeModal(); tfeed.renderSavedPosts()">
                    <i class="bi bi-bookmark mr-md"></i> Itens Salvos
                </button>
                <div style="border-top:1px solid var(--tf-border); margin:10px 0;"></div>
                <button class="btn btn-ghost w-100 text-left py-md px-lg" onclick="UI.closeModal(); tfeed.openEditProfile()">
                    <i class="bi bi-gear mr-md"></i> Configurações
                </button>
                <button class="btn btn-ghost w-100 text-left py-md px-lg text-danger" onclick="auth.logout()">
                    <i class="bi bi-box-arrow-right mr-md"></i> Sair do T-FIT
                </button>
            </div>
        `;
        UI.showModal('Menu T-FEED', modalContent);
    }

    async openActivityLog() {
        UI.showLoading('Carregando notificações...');
        try {
            // Fetch notifications (likes, follows, etc.)
            const { data: notifications } = await window.supabase.from('notifications')
                .select('*, actor:profiles!actor_id(name, photo_url, is_verified)')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(20);

            // Fetch suggestions (users not followed yet)
            let suggestions = [];
            const { data: profiles } = await window.supabase.from('profiles')
                .select('id, name, photo_url, is_verified')
                .neq('id', this.currentUser.id)
                .limit(30);
            
            if (profiles) {
                suggestions = profiles.filter(p => !this.followingIds.has(p.id)).slice(0, 10);
            }

            UI.hideLoading();

            const modalContent = `
                <div class="p-md">
                    <div id="activity-list" class="mb-xl" style="max-height: 400px; overflow-y: auto;">
                        ${notifications && notifications.length > 0 ? 
                            notifications.map(n => `
                                <div class="flex items-center gap-md mb-lg">
                                    <img src="${n.actor.photo_url || './logo.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" onclick="UI.closeModal(); tfeed.renderView('profile', '${n.actor_id}')">
                                    <div class="flex-1 text-sm">
                                        <b>${n.actor.name}</b> 
                                        ${n.type === 'like' ? 'curtiu sua publicação.' : 
                                          n.type === 'follow' ? 'começou a te seguir.' : 
                                          n.type === 'comment' ? 'comentou no seu post.' : 'interagiu com você.'}
                                        <span class="text-xs text-muted ml-sm">${this.timeAgo(n.created_at)}</span>
                                    </div>
                                </div>
                            `).join('') :
                            '<p class="text-center text-muted p-xl">Nenhuma atividade recente.</p>'
                        }
                    </div>

                    <div style="border-top: 1px solid var(--tf-border); padding-top: 15px;">
                        <h3 class="text-sm font-black mb-lg" style="letter-spacing:1px; text-transform:uppercase; color:var(--tf-accent);">Sugestões para você</h3>
                        <div id="suggestions-list">
                            ${suggestions.map(p => `
                                <div class="flex items-center justify-between mb-lg">
                                    <div class="flex items-center gap-md" onclick="UI.closeModal(); tfeed.renderView('profile', '${p.id}')" style="cursor: pointer;">
                                        <img src="${p.photo_url || './logo.png'}" style="width:42px; height:42px; border-radius:50%; object-fit:cover;">
                                        <div class="flex flex-col">
                                            <b class="text-sm">${p.name} ${p.is_verified ? '<i class="bi bi-patch-check-fill text-primary"></i>' : ''}</b>
                                            <span class="text-[10px] text-muted">Sugestão T-FIT</span>
                                        </div>
                                    </div>
                                    <button class="btn btn-xs btn-primary" style="border-radius:20px; padding: 4px 15px; font-size:10px;" 
                                            onclick="tfeed.toggleFollow('${p.id}', false); this.innerText='Seguindo'; this.disabled=true; this.style.opacity='0.6';">Seguir</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

            UI.showModal('Atividade', modalContent);

        } catch (err) {
            UI.hideLoading();
            console.error(err);
            UI.showNotification('Erro', 'Não foi possível carregar as atividades.', 'error');
        }
    }

    // ============================================
    // VIDEO INTERACTION LOGIC (Instagram-like)
    // ============================================

    handleVideoInteraction(el, action) {
        if (!el) return;

        switch (action) {
            case 'click':
                if (!el._isLongPress) {
                    el.muted = !el.muted;
                    UI.showNotification('Áudio', el.muted ? '🔇 Som Desativado' : '🔊 Som Ativado', 'info');
                }
                el._isLongPress = false;
                break;

            case 'press':
                el._isLongPress = false;
                el._pressTimer = setTimeout(() => {
                    if (!el.paused) {
                        el.pause();
                        el._isLongPress = true;
                        el.style.transform = 'scale(0.98)';
                        el.style.transition = '0.2s';
                    }
                }, 300);
                break;

            case 'release':
                if (el._pressTimer) clearTimeout(el._pressTimer);
                if (el._isLongPress) {
                    el.play();
                    el.style.transform = 'scale(1)';
                }
                break;
        }
    }

    // ============================================
    // SOCIAL ACTIONS
    // ============================================

    async handlePostLike(postId, doubleTap = false) {
        if (!this.currentUser) return;
        const isLiked = this.userLikes.has(postId);
        const icon = document.getElementById(`like-icon-${postId}`);
        const countSpan = document.getElementById(`likes-count-${postId}`);

        try {
            if (isLiked && !doubleTap) {
                // Unlike
                await window.supabase.from('likes').delete().eq('post_id', postId).eq('user_id', this.currentUser.id);
                this.userLikes.delete(postId);
                if (icon) {
                    icon.className = 'bi bi-heart tf-v2-action-icon';
                    icon.style.color = '#fff';
                }
                const newCount = Math.max(0, parseInt(countSpan.innerText) - 1);
                if (countSpan) countSpan.innerText = newCount;
            } else if (!isLiked) {
                // Like
                await window.supabase.from('likes').insert({ post_id: postId, user_id: this.currentUser.id });
                this.userLikes.add(postId);
                if (icon) {
                    icon.className = 'bi bi-heart-fill liked tf-v2-action-icon';
                    icon.style.color = '#fe2c55';
                    icon.style.transform = 'scale(1.2)';
                    setTimeout(() => icon.style.transform = 'scale(1)', 200);
                }
                const newCount = parseInt(countSpan.innerText) + 1;
                if (countSpan) countSpan.innerText = newCount;

                // 🔥 DISPARA PUSH DE CURTIDA
                const post = this.posts.find(p => p.id === postId);
                if (post && post.user_id !== this.currentUser.id) {
                    if (typeof PushService !== 'undefined') {
                        PushService.notifyLike(post.user_id, this.currentUser.name || 'Alguém', postId);
                    }
                    // Também insere na tabela de notificações legacy/db
                    window.supabase.from('notifications').insert({
                        user_id: post.user_id,
                        actor_id: this.currentUser.id,
                        type: 'like',
                        post_id: postId
                    }).then();
                }
                
                this.awardPoints('Curtiu post', 1);
            }
        } catch (err) { console.error('[Like Error]', err); }
    }

    async toggleFollow(targetUid, isCurrentlyFollowing) {
        if (!this.currentUser || targetUid === this.currentUser.id) return;

        try {
            if (isCurrentlyFollowing) {
                await window.supabase.from('followers').delete().eq('follower_id', this.currentUser.id).eq('following_id', targetUid);
                this.followingIds.delete(targetUid);
            } else {
                await window.supabase.from('followers').insert({ follower_id: this.currentUser.id, following_id: targetUid });
                this.followingIds.add(targetUid);

                // 🔥 DISPARA PUSH DE SEGUIDOR
                if (typeof PushService !== 'undefined') {
                    PushService.notifyFollow(targetUid, this.currentUser.name || 'Alguém');
                }
                
                window.supabase.from('notifications').insert({
                    user_id: targetUid,
                    actor_id: this.currentUser.id,
                    type: 'follow'
                }).then();
            }
            
            // Re-render profile if we are viewing it
            if (this.currentView === 'profile') this.renderView('profile', targetUid);
            else this.render();

        } catch (err) { console.error('[Follow Error]', err); }
    }

    renderSearch() {
        return `
            <div class="p-md">
                <div class="auth-search-bar tf-v2-glass-pill mb-md">
                    <i class="bi bi-search mr-sm"></i>
                    <input type="text" placeholder="Pesquisar usuários, posts..." class="flex-1" style="background:none; border:none; color:#fff; outline:none;" oninput="tfeed.handleSearch(this.value)">
                </div>
                <div class="tf-v2-profile-grid" id="search-grid">
                    ${this.posts.slice(0, 15).map(p => {
                        const isVideo = p.media_type === 'video';
                        return `
                            <div class="tf-v2-grid-item" onclick="tfeed.openPostDetail('${p.id}')" style="position:relative;">
                                ${isVideo 
                                    ? `<video src="${p.media_url}#t=0.1" preload="metadata" muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>
                                       <i class="bi bi-play-fill" style="position:absolute; top:5px; right:5px; color:#fff; font-size:14px; text-shadow:0 0 5px #000;"></i>`
                                    : `<img src="${p.media_url}" loading="lazy">`
                                }
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // ============================================
    // VIEW: PROFILE
    // ============================================

    async renderProfile(uid) {
        const { data: profile } = await window.supabase.from('profiles').select('*').eq('id', uid).single();
        if (!profile) return '';

        const userPosts = this.posts.filter(p => p.user_id === uid);
        const isMe = uid === this.currentUser.id;
        const isFollowing = this.followingIds.has(uid);
        const avatar = profile.photo_url || profile.photo || './logo.png';

        // Fetch counts from followers table for accuracy
        const [fols, fwing] = await Promise.all([
            window.supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', uid),
            window.supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', uid)
        ]);

        return `
            <div class="tf-v2-profile-wrap fade-in">
                <div class="tf-v2-profile-header-full">
                    <div class="tf-v2-profile-info-center">
                        <div class="tf-v2-profile-pic-large" onclick="tfeed.viewStories('${uid}')" style="cursor: pointer;">
                            <img src="${avatar}">
                        </div>
                        <h2 class="tf-v2-profile-name">
                            ${profile.name} ${profile.is_verified ? '<i class="bi bi-patch-check-fill tf-v2-verified-badge" style="font-size:18px;"></i>' : ''}
                        </h2>
                        <span class="tf-v2-profile-username">@${profile.name.toLowerCase().replace(/\s+/g, '')}</span>
                        
                        ${isMe ? `
                            <button class="tf-v2-tpoints-badge mb-md" onclick="tfeed.showPointsStore('${profile.t_points || 0}')">
                                <i class="bi bi-lightning-fill"></i> ${profile.t_points || 0} T-PONTOS
                            </button>
                        ` : `
                            <div class="tf-v2-tpoints-badge" style="margin-bottom: 15px; cursor: default; opacity: 0.7;">
                                <i class="bi bi-lightning-fill"></i> ${profile.t_points || 0} T-PONTOS
                            </div>
                        `}

                        <p class="text-sm px-xl mb-md" style="opacity:0.8;">${profile.bio || 'Explorando novos limites com o T-FIT 🚀'}</p>
                    </div>

                    <div class="tf-v2-profile-stats-grid">
                        <div class="tf-v2-stat-row" style="cursor: pointer;">
                            <b>${userPosts.length}</b>
                            <span>Posts</span>
                        </div>
                        <div style="width:1px; background:var(--tf-border);"></div>
                        <div class="tf-v2-stat-row" style="cursor: pointer;" onclick="tfeed.openFollowsList('${uid}', 'following')">
                            <b>${fwing.count || 0}</b>
                            <span>Seguindo</span>
                        </div>
                        <div style="width:1px; background:var(--tf-border);"></div>
                        <div class="tf-v2-stat-row" style="cursor: pointer;" onclick="tfeed.openFollowsList('${uid}', 'followers')">
                            <b>${fols.count || 0}</b>
                            <span>Seguidores</span>
                        </div>
                    </div>

                    <div class="tf-v2-profile-actions">
                        ${isMe
                ? `
                            <button class="tf-v2-btn-secondary" onclick="tfeed.openEditProfile()">Editar Perfil</button>
                            <button class="tf-v2-btn-secondary" onclick="tfeed.renderSavedPosts()">
                                <i class="bi bi-bookmark"></i> Salvos
                            </button>
                          `
                : `
                            <button class="${isFollowing ? 'tf-v2-btn-secondary' : 'tf-v2-btn-primary'}" 
                                    onclick="tfeed.toggleFollow('${uid}', ${isFollowing})">
                                ${isFollowing ? 'Seguindo' : 'Seguir'}
                            </button>
                            <button class="tf-v2-btn-secondary" onclick="tfeed.openDirectChat('${uid}')">Mensagem</button>
                          `
            }
                    </div>
                </div>

                <div class="tf-v2-profile-grid" id="profile-posts-grid">
                    ${userPosts.length > 0
                        ? userPosts.map(p => {
                            const isVideo = p.media_type === 'video';
                            return `
                                <div class="tf-v2-grid-item" onclick="tfeed.renderView('post_detail', '${p.id}')" style="position:relative;">
                                    ${isVideo 
                                        ? `<video src="${p.media_url}#t=0.1" preload="metadata" muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>
                                           <i class="bi bi-play-fill" style="position:absolute; top:5px; right:5px; color:#fff; font-size:14px; text-shadow:0 0 5px #000;"></i>`
                                        : `<img src="${p.media_url}" loading="lazy">`
                                    }
                                </div>
                            `;
                        }).join('')
                        : `<div class="col-span-3 p-xl text-center text-muted">Nenhuma foto publicada ainda.</div>`
                    }
                </div>
            </div>
        `;
    }

    async renderPostDetail(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return '<div class="p-xl text-center">Publicação não encontrada.</div>';
        return `
            <div class="fade-in">
                ${this.renderPostCard(post)}
            </div>
        `;
    }

    async renderDirect() {
        // GUARD ABSOLUTO: usa apenas a presença do DOM, não confia em this.activeChat
        if (document.getElementById('chat-messages')) return;

        const main = document.getElementById('tfeed-v2-content');
        if (!main) return;

        // Mantém o conteúdo atual visível enquanto carrega (sem spinner piscante)
        const existingContent = main.innerHTML;

        try {
            const { data: participations } = await window.supabase.from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', this.currentUser.id);

            const convIds = participations?.map(p => p.conversation_id) || [];

            if (convIds.length === 0) {
                main.innerHTML = `
                    <div class="tf-v2-direct-title">
                        <span>Mensagens</span>
                        <i class="bi bi-pencil-square" style="cursor: pointer;" onclick="tfeed.openNewChat()"></i>
                    </div>
                    <div class="p-xl text-center fade-in">
                        <i class="bi bi-chat-heart" style="font-size: 60px; color: var(--tf-accent);"></i>
                        <h2 class="mt-md">Mensagens Diretas</h2>
                        <p class="text-muted">Inicie uma conversa com seus amigos.</p>
                        <button class="btn btn-primary mt-lg" onclick="tfeed.openNewChat()">NOVA CONVERSA</button>
                    </div>
                `;
                return;
            }

            const { data: conversations } = await window.supabase.from('conversation_participants')
                .select('conversation_id, user_id, profiles(name, photo, photo_url, is_verified)')
                .in('conversation_id', convIds)
                .neq('user_id', this.currentUser.id);

            main.innerHTML = `
                <div class="tf-v2-direct-title">
                    <span>Mensagens</span>
                    <i class="bi bi-pencil-square" style="cursor: pointer;" onclick="tfeed.openNewChat()"></i>
                </div>
                <div class="tf-v2-conv-list">
                    ${conversations.map(c => `
                        <div class="tf-v2-conv-item" onclick="tfeed.openChatRoom('${c.conversation_id}', '${c.user_id}')">
                            <img src="${c.profiles.photo_url || c.profiles.photo || './logo.png'}" class="tf-v2-conv-avatar">
                            <div class="tf-v2-conv-info">
                                <div class="tf-v2-conv-name">${c.profiles.name} ${c.profiles.is_verified ? '<i class="bi bi-patch-check-fill text-primary"></i>' : ''}</div>
                                <div class="tf-v2-conv-last">Tocar para conversar</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (err) {
            console.error(err);
            main.innerHTML = '<div class="p-xl text-center">Falha ao carregar as mensagens.</div>';
        }
    }

    async openNewChat() {
        UI.showModal('Nova Mensagem', `
            <div class="p-md">
                <div class="auth-search-bar tf-v2-glass-pill mb-md">
                    <i class="bi bi-search mr-sm"></i>
                    <input type="text" id="chat-user-search" placeholder="Pesquisar..." class="flex-1" style="background:none; border:none; color:#fff; outline:none;" oninput="tfeed.searchChatUsers(this.value)">
                </div>
                <div id="chat-search-results" style="max-height: 400px; overflow-y: auto;">
                    <div class="text-center p-md text-muted">Aguardando pesquisa...</div>
                </div>
            </div>
        `);
    }

    async searchChatUsers(query) {
        if (!query || query.length < 2) return;
        try {
            const { data: users } = await window.supabase.from('profiles')
                .select('id, name, photo_url, photo, is_verified')
                .ilike('name', `%${query}%`)
                .neq('id', this.currentUser.id)
                .limit(10);

            const results = document.getElementById('chat-search-results');
            if (!results) return;

            if (!users?.length) {
                results.innerHTML = '<div class="text-center p-md text-muted">Nenhum usuário encontrado.</div>';
                return;
            }

            results.innerHTML = users.map(u => `
                <div class="tf-v2-conv-item" onclick="UI.closeModal(); tfeed.openDirectChat('${u.id}')">
                    <img src="${u.photo_url || u.photo || './logo.png'}" style="width: 44px; height: 44px; border-radius: 50%;">
                    <div class="tf-v2-conv-info">
                        <div class="tf-v2-conv-name">${u.name} ${u.is_verified ? '<i class="bi bi-patch-check-fill text-primary"></i>' : ''}</div>
                    </div>
                </div>
            `).join('');
        } catch (err) { console.error(err); }
    }

    async openDirectChat(targetId) {
        if (!this.currentUser || !targetId) return;
        UI.showLoading('Iniciando chat...');
        try {
            const { data: myConvs, error: e1 } = await window.supabase.from('conversation_participants').select('conversation_id').eq('user_id', this.currentUser.id);
            const { data: theirConvs, error: e2 } = await window.supabase.from('conversation_participants').select('conversation_id').eq('user_id', targetId);
            if (e1) throw e1;
            if (e2) throw e2;

            const myConvIds = myConvs?.map(c => c.conversation_id) || [];
            let conversationId = theirConvs?.find(c => myConvIds.includes(c.conversation_id))?.conversation_id;

            if (!conversationId) {
                const { data: newConv, error: ce } = await window.supabase.from('conversations').insert([{ last_message_at: new Date().toISOString() }]).select().single();
                if (ce) throw ce;
                conversationId = newConv.id;
                const { error: pe } = await window.supabase.from('conversation_participants').insert([
                    { conversation_id: conversationId, user_id: this.currentUser.id },
                    { conversation_id: conversationId, user_id: targetId }
                ]);
                if (pe) throw pe;
            }

            UI.hideLoading();
            this.openChatRoom(conversationId, targetId);
        } catch (err) {
            UI.hideLoading();
            console.error('[DM Error]', err);
            UI.showNotification('Erro', 'Não foi possível iniciar o chat.', 'error');
        }
    }

    async openChatRoom(conversationId, targetId) {
        if (!conversationId || !targetId) return;
        this.activeChat = conversationId;
        this.activeChatTargetId = targetId;
        window.tfeedActiveChat = true;
        window.ignoreFeedRefresh = true;

        const main = document.getElementById('tfeed-v2-content');
        if (!main) return;

        try {
            const [profileRes, statusRes] = await Promise.all([
                window.supabase.from('profiles').select('name, photo_url, photo, is_verified').eq('id', targetId).maybeSingle(),
                window.supabase.from('user_status').select('is_online, last_seen').eq('user_id', targetId).maybeSingle()
            ]);

            const p = profileRes.data || { name: 'Usuário' };
            const s = statusRes.data || { is_online: false };
            const avatar = p.photo_url || p.photo || './logo.png';
            const lastTime = s.last_seen ? new Date(s.last_seen).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
            const statusTxt = s.is_online ? '<span style="color:#22c55e">Online agora</span>' : (lastTime ? 'Visto às ' + lastTime : 'Offline');

            main.innerHTML = `
                <div class="tf-v2-chat-room">
                    <div class="tf-v2-chat-header">
                        <div class="flex items-center gap-md">
                            <i class="bi bi-arrow-left tf-v2-chat-back" onclick="tfeed.closeActiveChat()"></i>
                            <div class="relative" onclick="tfeed.renderView('profile', '${targetId}')" style="cursor:pointer">
                                <img src="${avatar}" class="tf-v2-chat-avatar">
                                ${s.is_online ? '<div style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:#22c55e;border-radius:50%;border:2px solid #000"></div>' : ''}
                            </div>
                            <div class="flex flex-col" style="cursor:pointer">
                                <b class="text-sm">${p.name} ${p.is_verified ? '<i class="bi bi-patch-check-fill tf-v2-verified-badge"></i>' : ''}</b>
                                <span class="text-[10px] text-muted" id="chat-header-status">${statusTxt}</span>
                            </div>
                            <div class="flex ml-auto gap-lg mr-sm">
                                <i class="bi bi-telephone text-xl cursor-pointer" onclick="tfeed.initiateCall('${targetId}', 'audio')"></i>
                                <i class="bi bi-camera-video text-xl cursor-pointer" onclick="tfeed.initiateCall('${targetId}', 'video')"></i>
                            </div>
                        </div>
                    </div>
                    <div id="chat-messages" class="tf-v2-chat-messages">
                        <div class="text-center p-xl opacity-30"><div class="spinner-border spinner-border-sm"></div></div>
                    </div>
                    <div id="typing-indicator-container"></div>
                    <div id="reply-context-bar"></div>
                    <div class="tf-v2-chat-input-area">
                        <div class="tf-v2-input-main-wrap">
                            <label class="tf-v2-input-camera cursor-pointer" for="chat-media-upload">
                                <i class="bi bi-camera-fill"></i>
                                <input type="file" id="chat-media-upload" class="hidden" accept="image/*,video/*,audio/*" onchange="tfeed.handleMediaSelect(this)">
                            </label>
                            <input type="text" id="chat-msg-input" class="tf-v2-chat-input" placeholder="Mensagem..."
                                   onkeypress="tfeed.handleChatKeyPress(event,'${conversationId}','${targetId}')"
                                   oninput="tfeed.handleChatInput(this.value,'${conversationId}')">
                            <div class="tf-v2-input-utils" id="chat-input-utils">
                                <i class="bi bi-image text-lg cursor-pointer" onclick="document.getElementById('chat-media-upload').click()"></i>
                            </div>
                            <button type="button" class="tf-v2-input-send-btn hidden" id="chat-send-btn" onclick="tfeed.sendMessageDirect('${conversationId}','${targetId}')">Enviar</button>
                        </div>
                    </div>
                </div>
            `;
            await this.loadMessages(conversationId);
        } catch (err) {
            console.error('[Chat] Open Error:', err);
            UI.showNotification('Erro', 'Não foi possível abrir a conversa.', 'error');
            this.closeActiveChat();
        }
    }

    closeActiveChat() {
        this.activeChat = null;
        this.activeChatTargetId = null;
        window.tfeedActiveChat = false;
        window.ignoreFeedRefresh = false;
        this.renderView('direct');
    }

    async loadMessages(conversationId) {
        try {
            const { data: messages } = await window.supabase.from('messages')
                .select('*').eq('conversation_id', conversationId)
                .order('created_at', { ascending: true }).limit(60);

            const container = document.getElementById('chat-messages');
            if (!container) return;

            if (!messages?.length) {
                container.innerHTML = '<div class="text-center p-xl text-muted text-xs">Comece a conversa com um "Oi!" 👋</div>';
                return;
            }

            container.innerHTML = messages.map(m => this.renderMsgHTML(m)).join('');
            container.scrollTop = container.scrollHeight;

            const unseen = messages.filter(m => !m.seen && m.sender_id !== this.currentUser.id);
            if (unseen.length) window.supabase.from('messages').update({ seen: true }).in('id', unseen.map(m => m.id)).then();
        } catch (err) { console.error('[Chat] Load Error:', err); }
    }

    renderMsgHTML(m) {
        const isSent = m.sender_id === this.currentUser.id;
        const meta = (typeof m.metadata === 'string') ? JSON.parse(m.metadata || '{}') : (m.metadata || {});
        let replyHtml = meta.reply_to ? `<div class="reply-preview"><b>${meta.reply_to.name}:</b> ${meta.reply_to.text}</div>` : '';
        let mediaHtml = '';
        if (meta.media) {
            if (meta.media.type === 'image') mediaHtml = `<div class="tf-v2-chat-media"><img src="${meta.media.url}"></div>`;
            else if (meta.media.type === 'video') mediaHtml = `<div class="tf-v2-chat-media"><video src="${meta.media.url}" controls></video></div>`;
            else mediaHtml = `<audio src="${meta.media.url}" controls class="w-full"></audio>`;
        }
        let reactHtml = '';
        if (meta.reactions) {
            const r = Object.entries(meta.reactions).map(([e, u]) => `<span>${e}${u.length > 1 ? ' ' + u.length : ''}</span>`).join('');
            if (r) reactHtml = `<div class="msg-reactions">${r}</div>`;
        }
        return `<div class="msg-wrapper ${isSent ? 'sent' : 'received'}" id="msg-${m.id}" ondblclick="tfeed.reactToMessage('${m.id}','❤️')" oncontextmenu="event.preventDefault();tfeed.setReplyContext('${m.id}')">${replyHtml}${mediaHtml}<div class="tf-v2-message ${isSent ? 'sent' : 'received'}" style="position:relative">${m.content || ''}${isSent ? `<span style="font-size:8px;opacity:.5;position:absolute;bottom:2px;right:6px">${m.seen ? '✔✔' : '✔'}</span>` : ''}</div>${reactHtml}</div>`;
    }

    scrollToMessage(id) {
        const el = document.getElementById(`msg-${id}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.outline = '2px solid #3797f0'; setTimeout(() => el.style.outline = '', 2000); }
    }

    handleChatKeyPress(e, convId, targetId) {
        if (e.key === 'Enter') { e.preventDefault(); this.sendMessageDirect(convId, targetId); }
    }

    handleChatInput(val, convId) {
        this.toggleSendBtn(val);
        if (!this.realtimeChannel) return;
        this.realtimeChannel.send({ type: 'broadcast', event: 'typing', payload: { user_id: this.currentUser.id, conversation_id: convId, is_typing: val.length > 0 } });
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        if (val.length > 0) this.typingTimeout = setTimeout(() => { this.realtimeChannel.send({ type: 'broadcast', event: 'typing', payload: { user_id: this.currentUser.id, conversation_id: convId, is_typing: false } }); }, 2500);
    }

    toggleSendBtn(val) {
        const btn = document.getElementById('chat-send-btn'), utils = document.getElementById('chat-input-utils');
        if (!btn) return;
        if ((val || '').trim().length > 0) { btn.classList.remove('hidden'); if (utils) utils.classList.add('hidden'); }
        else { btn.classList.add('hidden'); if (utils) utils.classList.remove('hidden'); }
    }

    handleTypingEvent(p) {
        if (!p?.payload) return;
        const { conversation_id, user_id, is_typing } = p.payload;
        if (conversation_id !== this.activeChat || user_id === this.currentUser.id) return;
        const el = document.getElementById('typing-indicator-container');
        if (el) el.innerHTML = is_typing ? `<div class="typing-indicator"><div class="typing-dots"><div></div><div></div><div></div></div><span>digitando...</span></div>` : '';
    }

    handlePresenceChange(p) {
        if (!p?.new || p.new.user_id !== this.activeChatTargetId) return;
        const el = document.getElementById('chat-header-status');
        if (el) el.innerHTML = p.new.is_online ? '<span style="color:#22c55e">Online agora</span>' : 'Offline';
    }

    async sendMessageDirect(conversationId, targetId) {
        const input = document.getElementById('chat-msg-input');
        const text = input?.value?.trim();
        if (!text && !this.selectedMedia) return;
        input.value = '';
        this.toggleSendBtn('');

        const meta = {};
        if (this.replyContext) { meta.reply_to = this.replyContext; this.replyContext = null; const rb = document.getElementById('reply-context-bar'); if (rb) rb.innerHTML = ''; }
        if (this.selectedMedia) { meta.media = this.selectedMedia; this.selectedMedia = null; }

        const msgData = { conversation_id: conversationId, sender_id: this.currentUser.id, content: text || '', metadata: meta };

        // Optimistic UI
        const container = document.getElementById('chat-messages');
        if (container) {
            const el = document.createElement('div');
            el.innerHTML = this.renderMsgHTML({ ...msgData, id: 'tmp_' + Date.now(), created_at: new Date().toISOString() });
            if (el.firstElementChild) container.appendChild(el.firstElementChild);
            container.scrollTop = container.scrollHeight;
        }

        try {
            await window.supabase.from('messages').insert([msgData]);
            
            // 🔥 DISPARA NOTIFICAÇÃO PUSH (NOVO)
            if (typeof PushService !== 'undefined') {
                PushService.notifyMessage(targetId, this.currentUser.name || 'Alguém', text || 'Enviou uma mídia', conversationId);
            }

            window.supabase.from('notifications').insert({ user_id: targetId, actor_id: this.currentUser.id, type: 'message', content: text || '📸 Mídia' }).then();
            window.supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId).then();
        } catch (err) { console.error('[DM Send]', err); }
    }

    async handleNewMessage(payload) {
        if (!payload?.new) return;
        if (payload.new.sender_id === this.currentUser?.id) return;
        if (this.activeChat === payload.new.conversation_id) {
            const container = document.getElementById('chat-messages');
            if (container) {
                const el = document.createElement('div');
                el.innerHTML = this.renderMsgHTML(payload.new);
                if (el.firstElementChild) container.appendChild(el.firstElementChild);
                container.scrollTop = container.scrollHeight;
                if (window.navigator.vibrate) window.navigator.vibrate(80);
            }
        } else if (this.currentView === 'direct' && !this.activeChat) {
            this.renderDirect();
        }
    }

    handleMessageUpdate(payload) {
        if (!payload?.new?.id) return;
        const el = document.getElementById(`msg-${payload.new.id}`);
        if (el) { const d = document.createElement('div'); d.innerHTML = this.renderMsgHTML(payload.new); if (d.firstElementChild) el.replaceWith(d.firstElementChild); }
    }

    async handleMediaSelect(input) {
        const file = input.files[0]; if (!file) return;
        UI.showLoading('Subindo mídia...');
        try {
            const ext = file.name.split('.').pop();
            const path = `${this.currentUser.id}/${Date.now()}.${ext}`;
            const { error } = await window.supabase.storage.from('chat-media').upload(path, file);
            if (error) throw error;
            const { data: { publicUrl } } = window.supabase.storage.from('chat-media').getPublicUrl(path);
            this.selectedMedia = { type: file.type.startsWith('image') ? 'image' : (file.type.startsWith('video') ? 'video' : 'audio'), url: publicUrl };
            UI.hideLoading();
            UI.showNotification('Mídia Pronta', 'Clique Enviar para compartilhar.', 'success');
        } catch (err) { UI.hideLoading(); UI.showNotification('Erro', 'Falha no upload.', 'error'); }
    }

    async reactToMessage(msgId, emoji) {
        try {
            const { data: msg } = await window.supabase.from('messages').select('metadata').eq('id', msgId).maybeSingle();
            if (!msg) return;
            const meta = msg.metadata || {};
            if (!meta.reactions) meta.reactions = {};
            if (!meta.reactions[emoji]) meta.reactions[emoji] = [];
            const idx = meta.reactions[emoji].indexOf(this.currentUser.id);
            if (idx > -1) meta.reactions[emoji].splice(idx, 1); else meta.reactions[emoji].push(this.currentUser.id);
            await window.supabase.from('messages').update({ metadata: meta }).eq('id', msgId);
        } catch (e) { console.error(e); }
    }

    async setReplyContext(msgId) {
        try {
            const { data: msg } = await window.supabase.from('messages').select('content, profiles(name)').eq('id', msgId).maybeSingle();
            if (!msg) return;
            this.replyContext = { id: msgId, text: (msg.content || '').substring(0, 50), name: msg.profiles?.name || 'Usuário' };
            const rb = document.getElementById('reply-context-bar');
            if (rb) rb.innerHTML = `<div style="padding:6px 12px;background:rgba(255,255,255,.05);border-left:3px solid #3797f0;display:flex;justify-content:space-between;align-items:center;font-size:11px"><div><b style="opacity:.6">Respondendo a ${this.replyContext.name}</b><br><span>${this.replyContext.text}</span></div><i class="bi bi-x" style="cursor:pointer" onclick="tfeed.replyContext=null;this.parentElement.remove()"></i></div>`;
        } catch (e) { console.error(e); }
    }

    // CALLS (WebRTC Signaling)
    async initiateCall(targetId, type) {
        if (!targetId) return;
        UI.showLoading('Chamando...');
        try {
            const { data: call } = await window.supabase.from('calls').insert({ sender_id: this.currentUser.id, target_id: targetId, type: type, status: 'calling' }).select().single();
            this.activeCall = call;
            const { data: tp } = await window.supabase.from('profiles').select('name, photo_url, photo').eq('id', targetId).maybeSingle();
            UI.hideLoading();
            this.showCallScreen('outgoing', { name: tp?.name || 'Usuário', photo: tp?.photo_url || tp?.photo || '' });
        } catch (err) { UI.hideLoading(); console.error(err); }
    }

    handleIncomingCall(call) {
        this.activeCall = call;
        window.supabase.from('profiles').select('name, photo_url, photo').eq('id', call.sender_id).maybeSingle().then(({ data: tp }) => {
            this.showCallScreen('incoming', { name: tp?.name || 'Chamando...', photo: tp?.photo_url || tp?.photo || '' });
            try { const a = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-waiting-ringtone-1354.mp3'); a.loop = true; a.play(); this._callAudio = a; } catch (e) {}
        });
    }

    showCallScreen(direction, peer) {
        const existing = document.getElementById('call-screen'); if (existing) existing.remove();
        const div = document.createElement('div'); div.className = 'tf-v2-call-screen'; div.id = 'call-screen';
        const avatarHTML = peer.photo ? `<img src="${peer.photo}" class="call-avatar">` : `<div class="call-avatar" style="background:#3797f0;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:900">${(peer.name||'?')[0]}</div>`;
        div.innerHTML = `<div class="call-avatar-wrap"><div class="call-pulse"></div>${avatarHTML}</div><h2 style="font-size:22px;font-weight:700;margin:0">${peer.name}</h2><p style="opacity:.6;margin:8px 0 0">${direction === 'incoming' ? (this.activeCall?.type === 'video' ? 'Chamada de vídeo' : 'Chamada de voz') : 'Chamando...'}</p><div class="call-actions">${direction === 'incoming' ? `<button class="call-btn accept" onclick="tfeed.answerCall()"><i class="bi bi-telephone-fill"></i></button><button class="call-btn reject" onclick="tfeed.endCall()"><i class="bi bi-telephone-x-fill"></i></button>` : `<button class="call-btn reject" onclick="tfeed.endCall()"><i class="bi bi-telephone-x-fill"></i></button>`}</div>`;
        document.body.appendChild(div);
    }

    async answerCall() {
        if (this._callAudio) this._callAudio.pause();
        if (this.activeCall) await window.supabase.from('calls').update({ status: 'accepted' }).eq('id', this.activeCall.id).catch(() => {});
        const screen = document.getElementById('call-screen');
        if (screen) screen.innerHTML = `<div class="video-call-wrap"><video id="remote-video" autoplay playsinline></video><video id="local-video" autoplay playsinline muted></video><div style="position:absolute;bottom:40px;left:0;right:0;display:flex;justify-content:center"><button class="call-btn reject" onclick="tfeed.endCall()"><i class="bi bi-telephone-x-fill"></i></button></div></div>`;
        this.startWebRTC();
    }

    async endCall(skipUpdate = false) {
        if (this._callAudio) {
            try { this._callAudio.pause(); } catch (e) {}
        }
        
        if (this.activeCall && !skipUpdate) {
            await window.window.supabase.from('calls').update({ status: 'ended' }).eq('id', this.activeCall.id).catch(() => {});
        }
        
        const s = document.getElementById('call-screen'); 
        if (s) s.remove();
        
        if (this._localStream) {
            this._localStream.getTracks().forEach(t => t.stop());
            this._localStream = null;
        }

        this.activeCall = null;
        console.log('[Calls] Chamada encerrada.');
    }

    async startWebRTC() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: this.activeCall?.type === 'video', audio: true });
            this._localStream = stream;
            const local = document.getElementById('local-video');
            if (local) local.srcObject = stream;
        } catch (e) { console.warn('[WebRTC] Acesso negado:', e.message); }
    }

    renderViewProfile(uid) {
        this.renderView('profile', uid);
    }

    // ============================================
    // SOCIAL ACTIONS
    // ============================================

    async handlePostLike(postId, doubleTap = false) {
        if (!this.currentUser) return;

        const icon = document.getElementById(`like-icon-${postId}`);
        const countSpan = document.getElementById(`likes-count-${postId}`);
        const liked = this.userLikes.has(postId);

        // Atualiza a UI imediatamente (sem re-render, sem pisca)
        if (liked && !doubleTap) {
            this.userLikes.delete(postId);
            if (icon) { icon.className = 'bi bi-heart tf-v2-action-icon'; icon.style.color = ''; }
            if (countSpan) countSpan.textContent = Math.max(0, parseInt(countSpan.textContent || 0) - 1);
        } else if (!liked) {
            this.userLikes.add(postId);
            if (icon) { icon.className = 'bi bi-heart-fill liked tf-v2-action-icon'; icon.style.color = '#fe2c55'; }
            if (countSpan) countSpan.textContent = parseInt(countSpan.textContent || 0) + 1;
        } else {
            return; // double tap numa foto já curtida - não faz nada
        }

        // Salva no banco em segundo plano (sem bloquear a UI)
        try {
            if (liked && !doubleTap) {
                const { error } = await window.supabase.from('likes').delete().eq('post_id', postId).eq('user_id', this.currentUser.id);
                if (error) throw error;
            } else if (!liked) {
                const { error } = await window.supabase.from('likes').insert({ post_id: postId, user_id: this.currentUser.id });
                if (error) throw error;
                this.awardPoints('Curtiu post', 1);
            }
        } catch (err) {
            console.error('[T-Feed Like Error]', err);
            // Rollback silencioso: desfaz a mudança visual sem re-render
            if (liked && !doubleTap) {
                this.userLikes.add(postId);
                if (icon) { icon.className = 'bi bi-heart-fill liked tf-v2-action-icon'; icon.style.color = '#fe2c55'; }
                if (countSpan) countSpan.textContent = parseInt(countSpan.textContent || 0) + 1;
            } else {
                this.userLikes.delete(postId);
                if (icon) { icon.className = 'bi bi-heart tf-v2-action-icon'; icon.style.color = ''; }
                if (countSpan) countSpan.textContent = Math.max(0, parseInt(countSpan.textContent || 0) - 1);
            }
            UI.showNotification('Erro', 'Não foi possível salvar a curtida.', 'error');
        }
    }

    async toggleFollow(targetUid, isFollowing) {
        if (!this.currentUser) return;

        // Atualiza o botão na tela imediatamente (sem re-render da página)
        const followBtn = document.querySelector(`button[onclick*="toggleFollow('${targetUid}'"]`);
        if (followBtn) {
            if (isFollowing) {
                followBtn.textContent = 'Seguir';
                followBtn.className = 'tf-v2-btn-primary';
                followBtn.setAttribute('onclick', `tfeed.toggleFollow('${targetUid}', false)`);
            } else {
                followBtn.textContent = 'Deixar de seguir';
                followBtn.className = 'tf-v2-btn-secondary';
                followBtn.setAttribute('onclick', `tfeed.toggleFollow('${targetUid}', true)`);
            }
        }

        try {
            if (isFollowing) {
                const { error } = await window.supabase.from('followers').delete().eq('follower_id', this.currentUser.id).eq('following_id', targetUid);
                if (error) throw error;
                this.followingIds.delete(targetUid);
            } else {
                const { error } = await window.supabase.from('followers').insert({ follower_id: this.currentUser.id, following_id: targetUid });
                if (error) throw error;
                this.followingIds.add(targetUid);
                this.awardPoints('Seguiu alguém', 1);
            }
        } catch (err) {
            console.error('[T-Feed Follow Error]', err);
            UI.showNotification('Erro', 'Não foi possível realizar a ação.', 'error');
        }
    }

    async awardPoints(action, amount) {
        try {
            // T-FIT Point logic (existing function integration)
            const user = auth.getCurrentUser();
            if (!user) return;

            const { data, error } = await window.supabase.rpc('add_tpoints', {
                user_id_param: user.id,
                amount_param: amount
            });

            console.log(`[T-Points] Awarded ${amount} for: ${action}`);
        } catch (err) {
            console.warn('[T-Points] Point award failed, falling back to profile update...');
            // Fallback: direct update if RPC fails
            const u = auth.getCurrentUser();
            const curr = Number(u.t_points) || 0;
            await window.supabase.from('profiles').update({ t_points: curr + amount }).eq('id', u.id);
            u.t_points = curr + amount;
        }
    }

    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "A";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "M";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "D";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "H";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "MIN";
        return "AGORA";
    }

    initAutoPlay() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const vid = entry.target;
                if (entry.isIntersecting) vid.play().catch(() => { });
                else vid.pause();
            });
        }, { threshold: 0.7 });

        document.querySelectorAll('video').forEach(v => observer.observe(v));
    }

    // Modal Operations
    openAddOptions() {
        UI.showModal('O que deseja criar?', `
            <div class="p-lg grid grid-cols-2 gap-md">
                <div class="card p-md text-center bg-black border-none hover-glow" onclick="UI.closeModal(); tfeed.openCreatePost()" style="cursor:pointer; border: 1px solid var(--tf-border);">
                    <i class="bi bi-grid-3x3-gap" style="font-size: 32px; color: var(--tf-accent);"></i>
                    <div class="mt-sm font-bold">Publicação</div>
                </div>
                <div class="card p-md text-center bg-black border-none hover-glow" onclick="UI.closeModal(); storyEditor.open()" style="cursor:pointer; border: 1px solid var(--tf-border);">
                    <i class="bi bi-plus-circle" style="font-size: 32px; color: var(--tf-accent);"></i>
                    <div class="mt-sm font-bold">Story</div>
                </div>
                <div class="card p-md text-center bg-black border-none hover-glow" onclick="UI.closeModal(); tfeed.openCreatePost()" style="cursor:pointer; border: 1px solid var(--tf-border);">
                    <i class="bi bi-play-btn" style="font-size: 32px; color: var(--tf-accent);"></i>
                    <div class="mt-sm font-bold">Reel</div>
                </div>
                <div class="card p-md text-center bg-black border-none hover-glow" onclick="UI.closeModal(); router.navigate('/student/workouts')" style="cursor:pointer; border: 1px solid var(--tf-border);">
                    <i class="bi bi-lightning-charge" style="font-size: 32px; color: var(--tf-accent);"></i>
                    <div class="mt-sm font-bold">Treino</div>
                </div>
            </div>
        `, true);
    }

    openCreatePost() {
        UI.showModal('Nova Publicação', `
            <div class="p-lg">
                <input type="file" id="v2-post-file" accept="image/*,video/*" class="form-input mb-md">
                <textarea id="v2-post-caption" class="form-input mb-md" placeholder="Diga algo sobre sua postagem..."></textarea>
                <div class="flex gap-md">
                    <button class="btn btn-ghost flex-1" onclick="UI.closeModal()">Cancelar</button>
                    <button class="btn btn-primary flex-1" onclick="tfeed.submitPost()">Publicar</button>
                </div>
            </div>
        `);
    }

    async submitPost() {
        const file = document.getElementById('v2-post-file').files[0];
        const caption = document.getElementById('v2-post-caption').value;
        if (!file) { UI.showNotification('Erro', 'Selecione uma mídia', 'warning'); return; }

        UI.showLoading('Fazendo upload...');
        try {
            const fileName = `post_${Date.now()}.${file.name.split('.').pop()}`;
            const { data: up, error: upErr } = await window.supabase.storage.from('posts_media').upload(`${this.currentUser.id}/${fileName}`, file);
            if (upErr) throw upErr;

            const { data: { publicUrl } } = window.supabase.storage.from('posts_media').getPublicUrl(`${this.currentUser.id}/${fileName}`);

            await window.supabase.from('posts').insert({
                user_id: this.currentUser.id,
                media_url: publicUrl,
                media_type: file.type.startsWith('video') ? 'video' : 'image',
                caption: caption
            });

            this.awardPoints('Publicação criada', 4);
            UI.hideLoading();
            UI.closeModal();
            this.refreshPosts();
            UI.showNotification('Sucesso!', 'Seu post está no ar!', 'success');
        } catch (err) {
            UI.hideLoading();
            UI.showNotification('Erro', err.message, 'error');
        }
    }

    openWorkoutShareModal(config) {
        if (!config.capturedImg) {
            UI.showNotification('Aviso', 'Você precisa tirar uma foto primeiro! Clique em "📸 Tirar Foto".', 'warning');
            return;
        }

        const prefilledCaption = `Finalizei o treino: ${config.title} (${config.duration}). Mais um check-in pago! 💪🔥`;
        window._tempWorkoutImage = config.capturedImg;

        UI.showModal('Compartilhar Treino', `
            <div class="p-md text-center">
                <img src="${config.capturedImg}" style="max-width: 100%; max-height: 250px; border-radius: 12px; margin-bottom: 15px; border: 1px solid var(--tf-border); object-fit: contain;">
                <textarea id="v2-post-caption" class="form-input mb-md" style="min-height: 80px;" placeholder="Escreva uma legenda...">${prefilledCaption}</textarea>
                <div class="flex gap-md mt-md">
                    <button class="btn btn-ghost flex-1" onclick="UI.closeModal()">Cancelar</button>
                    <button class="btn btn-primary flex-1" onclick="tfeed.submitWorkoutPost()">Publicar no Feed</button>
                </div>
            </div>
        `);
    }

    async submitWorkoutPost() {
        const base64Img = window._tempWorkoutImage;
        const caption = document.getElementById('v2-post-caption')?.value || '';

        if (!base64Img) return;

        UI.showLoading('Publicando...');

        try {
            // Conversão de base64 data URL para Blob e File
            const res = await fetch(base64Img);
            const blob = await res.blob();
            const file = new File([blob], `workout_${Date.now()}.jpg`, { type: 'image/jpeg' });

            const fileName = `post_${Date.now()}.jpg`;

            const { data: up, error: upErr } = await window.supabase.storage.from('posts_media').upload(`${this.currentUser.id}/${fileName}`, file);
            if (upErr) throw upErr;

            const { data: { publicUrl } } = window.supabase.storage.from('posts_media').getPublicUrl(`${this.currentUser.id}/${fileName}`);

            await window.supabase.from('posts').insert({
                user_id: this.currentUser.id,
                media_url: publicUrl,
                media_type: 'image',
                caption: caption
            });

            this.awardPoints('Concluir Treino', 20); // Adds TPoints for completing workout, if not done previously
            this.awardPoints('Publicação criada', 4); // Gives pts for post

            UI.hideLoading();
            UI.closeModal();
            this.refreshPosts();

            setTimeout(() => {
                UI.showNotification('Sucesso!', 'Seu treino foi publicado no T-FEED!', 'success');
                if (window.router) {
                    router.navigate('/student/feed');
                } else if (typeof tfeed !== 'undefined') {
                    tfeed.renderView('home');
                }
            }, 500);

        } catch (err) {
            UI.hideLoading();
            console.error('Erro ao postar treino:', err);
            UI.showNotification('Erro', err.message, 'error');
        }
    }

    async handlePostSave(postId) {
        if (!this.currentUser) return;
        const icon = document.getElementById(`save-icon-${postId}`);
        const isSaved = this.userSaves.has(postId);

        try {
            if (isSaved) {
                await window.supabase.from('saves').delete().eq('post_id', postId).eq('user_id', this.currentUser.id);
                this.userSaves.delete(postId);
                if (icon) {
                    icon.className = 'bi bi-bookmark tf-v2-action-icon';
                    icon.style.color = '#fff';
                }
                UI.showNotification('Salvos', 'Removido dos itens salvos.', 'info');
            } else {
                await window.supabase.from('saves').insert({ post_id: postId, user_id: this.currentUser.id });
                this.userSaves.add(postId);
                if (icon) {
                    icon.className = 'bi bi-bookmark-fill tf-v2-action-icon';
                    icon.style.color = 'var(--tf-accent)';
                }
                UI.showNotification('Salvos', 'Publicação salva com sucesso!', 'success');
            }
        } catch (err) { console.error(err); }
    }

    async renderSavedPosts() {
        UI.showLoading();
        try {
            const { data: saves } = await window.supabase.from('saves')
                .select('post_id, posts(*, profiles(name, photo_url))')
                .eq('user_id', this.currentUser.id);

            UI.hideLoading();
            if (!saves || saves.length === 0) {
                UI.showNotification('Aviso', 'Você ainda não salvou nenhuma publicação.', 'info');
                return;
            }

            const posts = saves.map(s => s.posts).filter(p => p !== null);
            this.currentView = 'profile_saves';
            const grid = document.getElementById('profile-posts-grid');
            if (grid) {
                grid.innerHTML = posts.map(p => {
                    const isVideo = p.media_type === 'video';
                    return `
                        <div class="tf-v2-grid-item" onclick="tfeed.renderView('post_detail', '${p.id}')" style="position:relative;">
                            ${isVideo 
                                ? `<video src="${p.media_url}#t=0.1" preload="metadata" muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>
                                   <i class="bi bi-play-fill" style="position:absolute; top:5px; right:5px; color:#fff; font-size:14px; text-shadow:0 0 5px #000;"></i>`
                                : `<img src="${p.media_url}" loading="lazy">`
                            }
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            UI.hideLoading();
            console.error(err);
        }
    }

    async openFollowsList(uid, type) {
        UI.showLoading();
        try {
            let res;
            if (type === 'followers') {
                // Busca quem segue este perfil
                res = await window.supabase.from('followers').select('follower_id, profiles!follower_id(id, name, photo_url)').eq('following_id', uid);
            } else {
                // Busca quem este perfil segue
                res = await window.supabase.from('followers').select('following_id, profiles!following_id(id, name, photo_url)').eq('follower_id', uid);
            }
            
            // Busca sugestões de forma MAIS ABERTA
            let discoveryList = [];
            try {
                // Tenta buscar qualquer perfil (exceto o meu) para garantir que apareça algo
                const { data: suggestions } = await window.supabase.from('profiles')
                    .select('id, name, photo_url')
                    .neq('id', this.currentUser.id)
                    .limit(20);
                
                if (suggestions && suggestions.length > 0) {
                    // Filtra os que eu JÁ sigo para sobrar apenas novos
                    discoveryList = suggestions.filter(s => !this.followingIds.has(s.id)).slice(0, 8);
                }
            } catch (e) { console.warn('Erro ao buscar sugestões', e); }

            UI.hideLoading();

            const fullList = res.data || [];
            window._tempFollowsList = fullList;

            const modalContent = `
                <div class="p-md" style="display: flex; flex-direction: column; gap: 15px;">
                    <!-- Barra de Busca -->
                    <div class="auth-search-bar tf-v2-glass-pill" style="margin-bottom: 5px;">
                        <i class="bi bi-search mr-sm"></i>
                        <input type="text" placeholder="Pesquisar..." class="flex-1" 
                               style="background:none; border:none; color:#fff; outline:none; font-size: 14px;" 
                               oninput="tfeed.filterFollowsList(this.value, '${type}')">
                    </div>

                    <!-- Lista Principal -->
                    <div id="follows-list-container" style="max-height: 250px; min-height: 50px; overflow-y: auto; padding-right: 5px;">
                        ${this.renderFollowsListItems(fullList)}
                    </div>

                    <!-- Seção de Sugestões -->
                    ${discoveryList.length > 0 ? `
                        <div style="border-top: 1px solid var(--tf-border); padding-top: 15px; margin-top: 5px;">
                            <h6 class="text-xs font-bold text-muted mb-md" style="letter-spacing: 1px; text-transform: uppercase;">Sugestões para você</h6>
                            <div id="discovery-list-container">
                                ${discoveryList.map(p => `
                                    <div class="flex items-center justify-between mb-md">
                                        <div class="flex items-center gap-md" onclick="UI.closeModal(); tfeed.renderView('profile', '${p.id}')" style="cursor: pointer;">
                                            <img src="${p.photo_url || './logo.png'}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover;">
                                            <div>
                                                <b class="text-sm" style="display: block;">${p.name}</b>
                                                <small class="text-xs text-muted">Sugestão T-FIT</small>
                                            </div>
                                        </div>
                                        <button class="btn btn-xs btn-primary" style="border-radius: 15px; padding: 5px 0; width: 110px; text-align: center; font-size: 10px;" onclick="tfeed.toggleFollow('${p.id}', false); this.innerText='Deixar de seguir'; this.disabled=true; this.style.opacity='0.6';">Seguir</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;

            UI.showModal(type === 'followers' ? 'Seguidores' : 'Seguindo', modalContent);

        } catch (err) {
            UI.hideLoading();
            console.error('Erro no modal de seguidores:', err);
            UI.showNotification('Erro', 'Não foi possível carregar a lista agora.', 'error');
        }
    }

    renderFollowsListItems(list) {
        if (list.length === 0) return '<p class="text-center text-muted p-md text-sm">Nenhum resultado encontrado.</p>';
        return list.map(item => {
            const p = item.profiles;
            if (!p) return '';
            return `
                <div class="flex items-center justify-between mb-md">
                    <div class="flex items-center gap-md" onclick="UI.closeModal(); tfeed.renderView('profile', '${p.id}')" style="cursor: pointer;">
                        <img src="${p.photo_url || './logo.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                        <b class="text-sm">${p.name}</b>
                    </div>
                    ${p.id !== this.currentUser.id ? `
                        <button class="btn btn-xs btn-outline" style="border-radius: 15px; padding: 5px 0; width: 110px; text-align: center; font-size: 10px;" onclick="tfeed.toggleFollow('${p.id}', ${this.followingIds.has(p.id)})">
                            ${this.followingIds.has(p.id) ? 'Deixar de seguir' : 'Seguir'}
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    filterFollowsList(query, type) {
        const list = window._tempFollowsList || [];
        const filtered = list.filter(item => 
            item.profiles?.name?.toLowerCase().includes(query.toLowerCase())
        );
        const container = document.getElementById('follows-list-container');
        if (container) container.innerHTML = this.renderFollowsListItems(filtered);
    }

    sharePost(postId) {
        const url = `${window.location.origin}/post/${postId}`;
        if (navigator.share) {
            navigator.share({ title: 'T-FIT Social', text: 'Olha que post legal!', url }).catch(() => { });
        } else {
            UI.copyToClipboard(url);
            UI.showNotification('Link Copiado', 'O link da publicação foi copiado!', 'success');
        }
    }

    async openComments(postId) {
        UI.showModal('Comentários', `
            <div class="p-lg" style="min-height: 400px; display: flex; flex-direction: column;">
                <div id="comments-list" class="mb-md" style="flex: 1; overflow-y: auto;">
                    <div class="text-center p-xl"><div class="spinner-border spinner-border-sm"></div> Carregando...</div>
                </div>
                <div class="flex gap-sm mt-auto pt-md" style="border-top: 1px solid var(--tf-border);">
                    <input type="text" id="new-comment-text" class="form-input" placeholder="Adicione um comentário...">
                    <button class="btn btn-primary" onclick="tfeed.submitComment('${postId}')">Postar</button>
                </div>
            </div>
        `);
        this.loadComments(postId);
    }

    // Story Viewing Logic
    viewStories(uid) {
        const userStories = this.stories[uid];
        if (!userStories || userStories.items.length === 0) return;

        let currentIndex = 0;
        const items = userStories.items;

        const showStory = (index) => {
            const story = items[index];
            if (!story) {
                UI.closeStoryViewer();
                return;
            }

            // Mark as viewed
            this.viewedStories.add(story.id);
            localStorage.setItem('tf_viewed_stories', JSON.stringify(Array.from(this.viewedStories)));

            const isVideo = story.media_url?.toLowerCase().match(/\.(mp4|mov|webm)$/) || story.media_url?.includes('video');

            const viewer = document.createElement('div');
            viewer.id = 'tf-v2-story-overlay';
            viewer.className = 'tf-v2-story-viewer'; // Removido fade-in para evitar sobreposição
            viewer.innerHTML = `
                <div class="tf-v2-story-progress-bar">
                    ${items.map((_, i) => `<div class="tf-v2-story-progress-seg"><div class="tf-v2-story-progress-fill" style="width: ${i < index ? '100' : '0'}%"></div></div>`).join('')}
                </div>
                <div class="tf-v2-story-header">
                    <div class="tf-v2-story-user" onclick="UI.closeStoryViewer(); tfeed.renderView('profile', '${uid}')" style="cursor: pointer;">
                        <img src="${userStories.user.photo_url || userStories.user.photo || './logo.png'}" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #fff;">
                        <b>${userStories.user.name}</b>
                        <span class="text-xs opacity-70 ml-2">${this.timeAgo(story.created_at)}</span>
                    </div>
                    <button class="tf-v2-icon-btn" onclick="UI.closeStoryViewer()"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="tf-v2-story-content">
                    ${isVideo
                    ? `<video src="${story.media_url}" autoplay playsinline style="width: 100%; height: 100%; object-fit: contain;"></video>`
                    : `<img src="${story.media_url}" style="width: 100%; height: 100%; object-fit: contain;">`
                }
                    <div class="story-nav-left" style="position: absolute; left: 0; top: 0; width: 30%; height: 100%; z-index: 10;" onclick="tfeed.prevStory()"></div>
                    <div class="story-nav-right" style="position: absolute; right: 0; top: 0; width: 70%; height: 100%; z-index: 5;" onclick="tfeed.nextStory()"></div>
                </div>
                <div class="tf-v2-story-footer p-md">
                     <div class="flex gap-md items-center">
                        <input type="text" class="form-input flex-1" placeholder="Enviar mensagem..." style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; color: #fff;">
                        <i class="bi bi-heart" style="font-size: 24px; cursor: pointer;"></i>
                        <i class="bi bi-send" style="font-size: 24px; cursor: pointer;"></i>
                     </div>
                </div>
            `;

            const existing = document.getElementById('tf-v2-story-overlay');
            if (existing) existing.remove();
            document.body.appendChild(viewer);

            // Animate progress
            const progressFill = viewer.querySelectorAll('.tf-v2-story-progress-fill')[index];
            const duration = isVideo ? 15000 : 5000;

            let start = null;
            const animate = (timestamp) => {
                if (!start) start = timestamp;
                const progress = timestamp - start;
                const percent = Math.min((progress / duration) * 100, 100);
                if (progressFill) progressFill.style.width = percent + '%';

                if (progress < duration) {
                    this.storyAnimRef = requestAnimationFrame(animate);
                } else {
                    this.nextStory();
                }
            };
            this.storyAnimRef = requestAnimationFrame(animate);

            this.currentStoryContext = { uid, index, total: items.length };
        };

        UI.closeStoryViewer = () => {
            const viewer = document.getElementById('tf-v2-story-overlay');
            if (viewer) viewer.remove();
            if (this.storyAnimRef) cancelAnimationFrame(this.storyAnimRef);
            this.currentStoryContext = null;

            // Refresh bar to update ring colors (non-intrusive)
            const bar = document.querySelector('.tf-v2-stories-bar');
            if (bar) bar.innerHTML = this.renderStoriesBar();
        };

        this.nextStory = () => {
            const ctx = this.currentStoryContext;
            if (!ctx) return;
            if (ctx.index + 1 < ctx.total) {
                if (this.storyAnimRef) cancelAnimationFrame(this.storyAnimRef);
                showStory(ctx.index + 1);
            } else {
                UI.closeStoryViewer();
                const userIds = Object.keys(this.stories);
                const nextUserIdx = userIds.indexOf(ctx.uid) + 1;
                if (nextUserIdx < userIds.length) {
                    this.viewStories(userIds[nextUserIdx]);
                }
            }
        };

        this.prevStory = () => {
            const ctx = this.currentStoryContext;
            if (!ctx) return;
            if (ctx.index > 0) {
                if (this.storyAnimRef) cancelAnimationFrame(this.storyAnimRef);
                showStory(ctx.index - 1);
            } else {
                UI.closeStoryViewer();
            }
        };

        showStory(0);
    }

    async loadComments(postId) {
        try {
            const { data: comments, error } = await window.supabase.from('comments')
                .select('*, profiles(name, photo, photo_url, avatar_url)')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const list = document.getElementById('comments-list');
            if (!list) return;

            if (!comments || comments.length === 0) {
                list.innerHTML = '<div class="text-muted text-center p-xl">Nenhum comentário ainda. Seja o primeiro!</div>';
                return;
            }

            list.innerHTML = comments.map(c => {
                const p = c.profiles || {};
                const name = p.name || 'Usuário';
                const avatar = p.photo_url || p.avatar_url || p.photo || './logo.png';
                const commentText = c.comment_text || c.text || '';

                return `
                    <div class="mb-md flex gap-sm">
                        <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <div class="flex items-center gap-xs">
                                <b class="text-sm">${name}</b>
                                <small class="text-xs text-muted" style="font-size: 10px;">• ${this.timeAgo(c.created_at)}</small>
                            </div>
                            <p class="text-sm mb-0" style="color: rgba(255,255,255,0.9);">${commentText}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('[T-Feed] Error loading comments:', err);
            const list = document.getElementById('comments-list');
            if (list) list.innerHTML = '<div class="text-danger text-center p-xl text-xs">Erro ao carregar comentários.</div>';
        }
    }

    async submitComment(postId) {
        const input = document.getElementById('new-comment-text');
        const text = input?.value?.trim();
        if (!text) return;

        try {
            // Tentamos inserir usando o nome 'comment_text' (v2) mas fallamos se for 'text' (legacy)
            // Para ser 100% seguro contra inconsistência de schema sem saber qual rodou:
            const payload = {
                post_id: postId,
                user_id: this.currentUser.id,
                comment_text: text, // Prioridade V2
                text: text          // Fallback legacy (se a coluna existir)
            };

            // Remove campos que não existem para evitar erro de 'column does not exist' se o supabase for estrito
            // Porém o Supabase costuma ignorar campos extras se usar RPC ou se a política permitir.
            // Mas aqui vamos simplesmente tentar o insert e capturar o erro.
            const { error } = await window.supabase.from('comments').insert({
                post_id: postId,
                user_id: this.currentUser.id,
                comment_text: text
            });

            if (error) {
                // Tenta fallback para coluna 'text' se 'comment_text' falhar
                if (error.message.includes('comment_text')) {
                    const { error: error2 } = await window.supabase.from('comments').insert({
                        post_id: postId,
                        user_id: this.currentUser.id,
                        text: text
                    });
                    if (error2) throw error2;
                } else {
                    throw error;
                }
            }

            input.value = '';

            // Optimistic UI update for the count in the main feed
            const countSpan = document.getElementById(`comments-count-${postId}`);
            let newCommentsCount = 1;
            if (countSpan) {
                const match = countSpan.innerText.match(/\d+/);
                const current = match ? parseInt(match[0]) : 0;
                countSpan.innerText = `Ver todos os ${current + 1} comentários`;
            }

            this.loadComments(postId);
            this.awardPoints('Comentou post', 2);
            UI.showNotification('Sucesso', 'Comentário postado!', 'success');
        } catch (err) {
            console.error('[T-Feed] Submit Comment Error:', err);
            UI.showNotification('Erro ao comentar', 'Sua mensagem não pôde ser salva. Verifique sua conexão.', 'error');
        }
    }

    handleBoost(postId) {
        UI.showModal('Impulsionar Publicação', `
            <div class="p-lg text-center">
                <i class="bi bi-graph-up-arrow" style="font-size: 40px; color: var(--tf-accent);"></i>
                <h3 class="mt-md">Alcance mais pessoas!</h3>
                <p class="text-muted">Aumente o engajamento do seu post por apenas 50 T-PONTOS ou use saldo T-FIT.</p>
                <div class="flex flex-col gap-sm mt-xl">
                    <button class="btn btn-primary btn-block">IMPULSIONAR AGORA</button>
                    <button class="btn btn-ghost" onclick="UI.closeModal()">DEPOIS</button>
                </div>
            </div>
        `);
    }

    openPostMenu(postId, ownerId) {
        const isOwner = ownerId === this.currentUser.id;
        UI.showModal('Opções', `
            <div class="flex flex-col">
                ${isOwner ? `<button class="btn btn-ghost text-danger border-none py-lg" onclick="tfeed.deletePost('${postId}')">Excluir Publicação</button>` : ''}
                <button class="btn btn-ghost border-none py-lg" onclick="tfeed.reportPost('${postId}')">Reportar / Denunciar</button>
                <button class="btn btn-ghost border-none py-lg" onclick="UI.closeModal()">Cancelar</button>
            </div>
        `, true);
    }

    async deletePost(postId) {
        if (!confirm('Tem certeza que deseja excluir esta publicação?')) return;
        try {
            await window.supabase.from('posts').delete().eq('id', postId);
            UI.closeModal();
            this.refreshPosts();
            UI.showNotification('Sucesso', 'Publicação excluída.', 'success');
        } catch (err) { console.error(err); }
    }

    reportPost(postId) {
        UI.showNotification('Relatório Enviado', 'Obrigado por ajudar a manter nossa comunidade segura!', 'success');
        UI.closeModal();
    }

    openEditProfile() {
        UI.showModal('Editar Perfil', `
            <div class="p-lg">
                <div class="text-center mb-lg">
                    <img src="${this.currentUser.photo || './logo.png'}" style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--tf-accent);">
                    <button class="btn btn-xs mt-sm" onclick="UI.showNotification('Foto', 'Escolha uma nova foto de perfil na galeria.', 'info')">Alterar Foto</button>
                </div>
                <input type="text" id="edit-name" class="form-input mb-md" value="${this.currentUser.name}" placeholder="Nome">
                <textarea id="edit-bio" class="form-input mb-md" placeholder="Bio">${this.currentUser.bio || ''}</textarea>
                <button class="btn btn-primary btn-block" onclick="tfeed.saveProfileEdits()">Salvar Alterações</button>
            </div>
        `);
    }

    async saveProfileEdits() {
        const name = document.getElementById('edit-name').value;
        const bio = document.getElementById('edit-bio').value;
        UI.showLoading();
        try {
            await window.supabase.from('profiles').update({ name, bio }).eq('id', this.currentUser.id);
            UI.hideLoading();
            UI.closeModal();
            this.loadInitialData();
            UI.showNotification('Sucesso', 'Perfil atualizado!', 'success');
        } catch (err) { UI.hideLoading(); console.error(err); }
    }

    showPointsHistory() {
        UI.showModal('Meu Saldo T-PONTOS', `
            <div class="p-lg text-center">
                <div style="font-size: 48px; font-weight: 900; color: var(--tf-accent);">${this.currentUser.t_points || 0}</div>
                <span class="text-muted">PONTOS DISPONÍVEIS</span>
                <div class="mt-xl text-left">
                    <div class="text-sm font-bold mb-md">Como ganhar mais:</div>
                    <ul class="text-xs opacity-70">
                        <li>Concluir Treino (>30min): +20pts</li>
                        <li>Postar no Feed: +4pts</li>
                        <li>Novo Story: +2pts</li>
                        <li>Curtidas: +1pt</li>
                    </ul>
                </div>
            </div>
        `);
    }

    // Story Logic
    openCreateStory() {
        UI.showModal('Novo Story', `
            <div class="p-lg text-center">
                <p class="mb-md text-muted">Os stories somem em 24h.</p>
                <input type="file" id="v2-story-file" accept="image/*,video/*" class="form-input mb-md">
                <button class="btn btn-primary btn-block" onclick="tfeed.submitStory()">Enviar Story ✨</button>
            </div>
        `);
    }

    async submitStory() {
        const file = document.getElementById('v2-story-file').files[0];
        if (!file) return;

        UI.showLoading();
        try {
            const fileName = `story_${Date.now()}`;
            await window.supabase.storage.from('stories_media').upload(`${this.currentUser.id}/${fileName}`, file);
            const { data: { publicUrl } } = window.supabase.storage.from('stories_media').getPublicUrl(`${this.currentUser.id}/${fileName}`);

            await window.supabase.from('stories').insert({
                user_id: this.currentUser.id,
                media_url: publicUrl
            });

            this.awardPoints('Story criado', 2);
            UI.hideLoading();
            UI.closeModal();
            this.loadInitialData(); // Reload stories
        } catch (err) { UI.hideLoading(); console.error(err); }
    }


    cleanupExpiredStories() {
        const now = new Date().toISOString();
        // Frontend logic to filter out locally
        Object.keys(this.stories).forEach(uid => {
            this.stories[uid].items = this.stories[uid].items.filter(s => s.expires_at > now);
            if (this.stories[uid].items.length === 0) delete this.stories[uid];
        });
        if (this.currentView === 'home') this.renderView();
    }

    // ============================================
    // LOJA DE T-PONTOS E PAGAMENTO
    // ============================================
    showPointsStore(currentPoints) {
        const modalContent = `
        <div class="tf-v2-store-wrapper">
            <!-- Header with Balance -->
            <div class="tf-v2-store-header">
                <div class="tf-v2-store-title">
                    <i class="bi bi-bag-heart-fill"></i>
                    <span>T-STORE</span>
                </div>
                <div class="tf-v2-store-balance">
                    <small>SALDO ATUAL</small>
                    <div class="balance-amount">
                        <i class="bi bi-gem"></i>
                        <span>${currentPoints} TP</span>
                    </div>
                </div>
            </div>

            <!-- Buy Points Slider Section -->
            <div class="tf-v2-store-section">
                <div class="section-tag">RECARGA</div>
                <h4 class="section-title">Adquirir T-Points</h4>
                
                <div class="tf-v2-points-card">
                    <div class="slider-container">
                        <input type="range" id="points-slider" min="100" max="10000" step="100" value="1000" 
                               oninput="tfeed.updatePriceDisplay(this.value)">
                    </div>
                    
                    <div class="purchase-info">
                        <div class="info-block">
                            <span id="points-value" class="value-main">1000 TP</span>
                            <span class="value-sub">PONTOS</span>
                        </div>
                        <div class="info-divider"><i class="bi bi-arrow-right"></i></div>
                        <div class="info-block">
                            <span id="price-value" class="value-main">R$ 10,00</span>
                            <span class="value-sub">INVESTIMENTO</span>
                        </div>
                    </div>
                    
                    <button class="tf-v2-store-main-btn" onclick="tfeed.handlePurchaseFromStore()">
                        COMPRAR PONTOS AGORA
                    </button>
                    <p class="rate-hint">Taxa de conversão: 100 TP = R$ 1,00</p>
                </div>
            </div>

            <!-- Shop Items Section -->
            <div class="tf-v2-store-section">
                <div class="section-tag">EXCLUSIVOS</div>
                <h4 class="section-title">Itens da Comunidade</h4>
                
                <div class="tf-v2-store-item premium-item">
                    <div class="item-preview">
                        <div class="verified-hex">
                            <i class="bi bi-patch-check-fill"></i>
                        </div>
                    </div>
                    <div class="item-info">
                        <h5>Selo de Verificado</h5>
                        <p>Destaque-se na rede com o selo oficial de elite.</p>
                        <div class="item-benefits">
                            <span><i class="bi bi-check2"></i> Status Vitalício</span>
                            <span><i class="bi bi-check2"></i> Destaque no Perfil</span>
                        </div>
                    </div>
                    <div class="item-purchase-options">
                        <button class="buy-option-tp" onclick="tfeed.buyVerificationWithPoints()">
                            <i class="bi bi-gem"></i> 2000 TP
                        </button>
                        <div class="or-divider">OU</div>
                        <button class="buy-option-cash" onclick="tfeed.openPointsCheckout(1, 49.90, 'Selo Verificado T-FIT (Vitalício)')">
                            R$ 49,90
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;

        UI.showModal('Loja Social T-FIT', modalContent);
    }

    updatePriceDisplay(val) {
        const pointsEl = document.getElementById('points-value');
        const priceEl = document.getElementById('price-value');
        if (pointsEl) pointsEl.innerText = `${val} TP`;
        if (priceEl) priceEl.innerText = `R$ ${(val * 0.01).toFixed(2).replace('.', ',')}`;
    }

    handlePurchaseFromStore() {
        const val = document.getElementById('points-slider').value;
        const price = (val * 0.01).toFixed(2);
        this.openPointsCheckout(val, price, `Pacote de ${val} T-Pontos`);
    }

    async buyVerificationWithPoints() {
        const cost = 2000;
        const currentPoints = Number(this.currentUser.t_points) || 0;

        if (currentPoints < cost) {
            UI.confirmDialog('Saldo Insuficiente', `Você precisa de ${cost} T-Points para comprar a verificação. Deseja comprar mais pontos agora?`, () => {
                this.showPointsStore(currentPoints);
            });
            return;
        }

        UI.confirmDialog('Confirmar Compra', `Deseja usar ${cost} T-Points para adquirir o Selo de Verificado vitalício?`, async () => {
            UI.showLoading('Processando...');
            try {
                // Deduct points using RPC if available, else update
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        t_points: currentPoints - cost,
                        is_verified: true
                    })
                    .eq('id', this.currentUser.id);

                if (updateError) throw updateError;

                this.currentUser.t_points -= cost;
                this.currentUser.is_verified = true;

                UI.hideLoading();
                UI.closeModal();
                UI.showNotification('Sucesso! ✔️', 'Você agora é um usuário verificado!', 'success');
                this.render(); // Refresh UI
            } catch (err) {
                UI.hideLoading();
                UI.showNotification('Erro', 'Não foi possível completar a compra.', 'error');
            }
        });
    }

    handleBoost(postId) {
        UI.showModal('Impulsionar Publicação', `
            <div class="p-md text-center">
                <i class="bi bi-rocket-takeoff-fill" style="font-size: 48px; color: var(--tf-accent);"></i>
                <h3 class="mt-md font-bold text-white">DECOLAR POST 🚀</h3>
                <p class="text-sm text-muted mb-lg">Apareça no topo do feed de todos os usuários pelo tempo que escolher!</p>
                
                <div class="mb-lg px-md text-left">
                    <label class="block text-xs font-bold mb-md uppercase tracking-widest text-muted">Duração do Impulso</label>
                    <input type="range" id="boost-slider" min="5" max="1440" step="5" value="60" class="w-100" style="accent-color: var(--tf-accent);" oninput="tfeed.updateBoostPrice(this.value)">
                    <div class="flex justify-between mt-sm">
                        <span id="boost-time" class="font-bold" style="color: #fff;">01h 00min</span>
                        <span id="boost-cost" class="font-bold" style="color: var(--tf-accent);">10 TP</span>
                    </div>
                </div>

                <div class="flex gap-md">
                    <button class="btn btn-ghost flex-1" onclick="UI.closeModal()">Cancelar</button>
                    <button class="btn btn-primary flex-1" onclick="tfeed.confirmBoost('${postId}')">PAGAR E IMPULSIONAR</button>
                </div>
            </div>
        `);
    }

    updateBoostPrice(min) {
        const hours = Math.floor(min / 60);
        const mins = min % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}min`;
        const cost = Math.ceil(min / 6);
        const timeEl = document.getElementById('boost-time');
        const costEl = document.getElementById('boost-cost');
        if (timeEl) timeEl.innerText = timeStr;
        if (costEl) costEl.innerText = `${cost} TP`;
    }

    async confirmBoost(postId) {
        const min = document.getElementById('boost-slider').value;
        const cost = Math.ceil(min / 6);
        if (this.currentUser.t_points < cost) {
            UI.showNotification('Saldo Insuficiente', 'Você não tem T-Pontos suficientes.', 'warning');
            return;
        }
        UI.showLoading('Decolando...');
        try {
            await window.supabase.from('t_boosts').insert({
                user_id: this.currentUser.id,
                item_id: postId,
                item_type: 'post',
                points_spent: cost,
                duration_minutes: min,
                expires_at: new Date(Date.now() + min * 60000).toISOString()
            });
            await window.supabase.rpc('add_tpoints', { user_id_param: this.currentUser.id, amount_param: -cost });
            this.currentUser.t_points -= cost;
            UI.hideLoading();
            UI.closeModal();
            UI.showNotification('🚀 DECOLOU!', 'Sua publicação está em destaque!', 'success');
            this.loadInitialData();
        } catch (err) { UI.hideLoading(); console.error(err); }
    }

    openPointsCheckout(points, price, description) {
        const priceFmt = parseFloat(price).toFixed(2).replace('.', ',');
        const modalContent = `
            <div class="p-md text-left tf-v2-checkout-container">
                <div class="checkout-header">
                    <h4 class="font-bold mb-xs" style="color:var(--tf-accent);">${description}</h4>
                    <p class="text-2xl font-black text-white">R$ ${priceFmt}</p>
                </div>

                <div class="payment-methods-grid">
                    <!-- Automated PIX -->
                    <div class="payment-option automated" onclick="tfeed.buyPointsPix(${points}, ${price})">
                        <div class="option-icon">
                            <img src="https://logospng.org/download/pix/logo-pix-icone-1024.png" width="32">
                        </div>
                        <div class="option-text">
                            <h5>Pix Automático</h5>
                            <p>Liberação instantânea via QR Code</p>
                        </div>
                        <div class="option-arrow"><i class="bi bi-chevron-right"></i></div>
                    </div>

                    <!-- Mercado Pago -->
                    <div class="payment-option automated" onclick="tfeed.buyPointsMercadoPago(${points}, ${price}, '${description}')">
                        <div class="option-icon">
                            <img src="https://logospng.org/download/mercado-pago/logo-mercado-pago-icone-1024.png" width="32">
                        </div>
                        <div class="option-text">
                            <h5>Cartão de Crédito</h5>
                            <p>Pague com segurança via Mercado Pago</p>
                        </div>
                        <div class="option-arrow"><i class="bi bi-chevron-right"></i></div>
                    </div>

                    <!-- Manual PIX (Fallback) -->
                    <div class="manual-pix-collapsible">
                        <button class="btn-manual-pix" onclick="document.getElementById('manual-pix-details').classList.toggle('hidden')">
                            Deseja pagar via pix manual? Clique aqui
                        </button>
                        <div id="manual-pix-details" class="hidden p-md mt-sm bg-black/40 rounded border border-white/5">
                            <p class="text-xs text-muted mb-sm">Envie o comprovante para análise manual:</p>
                            <div class="flex gap-sm mb-md p-sm bg-black rounded items-center">
                                <span class="text-xs truncate font-mono flex-1 text-white">willcardosooficial@gmail.com</span>
                                <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText('willcardosooficial@gmail.com'); UI.showNotification('Copiado', 'Chave PIX copiada', 'success');">📋</button>
                            </div>
                            <input type="file" class="form-input text-xs" accept="image/*" id="pix-receipt-upload">
                            <button class="btn btn-primary btn-xs mt-sm w-100" onclick="tfeed.submitManualPixPurchase(${points}, '${description}')">Enviar Comprovante</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        UI.showModal('Finalizar Pagamento', modalContent);
    }

    async buyPointsMercadoPago(points, price, description) {
        UI.showLoading('Iniciando Checkout...');
        try {
            if (window.startMercadoPagoCheckout) {
                // Using refType 'tpoints' as implemented in the edge function
                await window.startMercadoPagoCheckout(price, `tpoints_${points}`, null, 'tpoints');
                UI.hideLoading();
            } else {
                throw new Error('PaymentHelper não carregado');
            }
        } catch (e) {
            UI.hideLoading();
            UI.showNotification('Erro', 'Não foi possível iniciar o pagamento.', 'error');
        }
    }

    async buyPointsPix(points, price) {
        UI.showLoading('Gerando QR Code...');
        try {
            if (window.startPixDirectCheckout) {
                await window.startPixDirectCheckout(price, `tpoints_${points}`, null, 'tpoints');
                UI.hideLoading();
            } else {
                throw new Error('PaymentHelper não carregado');
            }
        } catch (err) {
            UI.hideLoading();
            UI.showNotification('Erro', 'Falha ao gerar Pix.', 'error');
        }
    }

    async submitManualPixPurchase(points, desc) {
        const file = document.getElementById('pix-receipt-upload')?.files[0];
        if (!file) return UI.showNotification('Aviso', 'Anexe o comprovante.', 'warning');
        UI.showLoading('Enviando...');
        try {
            await new Promise(res => setTimeout(res, 1000));
            UI.hideLoading();
            UI.closeModal();
            UI.showNotification('Sucesso', 'Comprovante em análise!', 'success');
        } catch (e) { UI.hideLoading(); }
    }

    timeAgo(dateStr) {
        const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
        if (seconds < 60) return 'agora';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    }
}

function renderTFeed() {
    if (!window.tfeed) window.tfeed = new TFeedV2();
    window.tfeed.render('t-feed-container');
}
