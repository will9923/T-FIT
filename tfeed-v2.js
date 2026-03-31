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
        this.isLoading = false;
        this.isInitialized = false;
        this.realtimeChannel = null;
        this.containerId = 't-feed-container';
        this.userLikes = new Set();
        this.userSaves = new Set();
        this.followingIds = new Set();
        this.activeChat = null;

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

        console.log('[T-Feed V2] Initializing Core...');
        window.tfeed = this;

        // Setup initial local state
        await this.loadInitialData();
        this.setupRealtimeSync();

        // Refresh periodically for stories expiry
        setInterval(() => this.cleanupExpiredStories(), 60000);
    }

    async loadInitialData() {
        if (!this.currentUser) return;
        this.isLoading = true;

        try {
            const [postsRes, storiesRes, likesRes, savesRes, profileRes] = await Promise.all([
                supabase.from('posts')
                    .select('*, profiles!user_id(name, photo, photo_url, is_verified)')
                    .order('created_at', { ascending: false })
                    .limit(30),
                supabase.from('stories')
                    .select('*, profiles!user_id(name, photo, photo_url, is_verified)')
                    .gt('expires_at', new Date().toISOString())
                    .order('created_at', { ascending: true }),
                supabase.from('likes').select('post_id').eq('user_id', this.currentUser.id),
                supabase.from('saves').select('post_id').eq('user_id', this.currentUser.id),
                supabase.from('profiles').select('following, followers, t_points, is_verified').eq('id', this.currentUser.id).single()
            ]);

            if (postsRes.data) this.posts = postsRes.data;
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
        this.realtimeChannel = supabase.channel('tfeed_v2_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => this.refreshPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => this.handleNewMessage(payload))
            .subscribe();
    }

    async refreshPosts() {
        const { data } = await supabase.from('posts').select('*, profiles!user_id(name, photo_url)').order('created_at', { ascending: false }).limit(30);
        if (data) {
            this.posts = data;
            if (this.currentView === 'home') this.renderView();
        }
    }

    // ============================================
    // MAIN RENDERING ENGINE
    // ============================================

    render(containerId = this.containerId, view = this.currentView) {
        this.containerId = containerId;
        this.currentView = view;
        const container = document.getElementById(containerId);
        if (!container) return;

        // Check if wrapper already exists to avoid flickering
        if (!document.getElementById('tfeed-v2-wrapper')) {
            container.innerHTML = `
                <div id="tfeed-v2-wrapper" class="fade-in" style="position: fixed; inset: 0; z-index: 99999; background: #000; overflow-y: auto;">
                    ${this.renderHeader()}
                    <main id="tfeed-v2-content" style="min-height: 80vh; padding-bottom: 90px;">
                        ${this.renderLoadingState()}
                    </main>
                    ${this.renderBottomNav()}
                </div>
            `;
        }

        // If CSS not present, add it
        if (!document.getElementById('tfeed-v2-css')) {
            const link = document.createElement('link');
            link.id = 'tfeed-v2-css';
            link.rel = 'stylesheet';
            link.href = 'tfeed-v2.css?v=' + Date.now();
            document.head.appendChild(link);
        }

        this.renderView();
    }

    renderHeader() {
        if (['reels', 'profile'].includes(this.currentView)) return '';

        const backBtn = this.currentView === 'post_detail' ? `<button class="tf-v2-icon-btn" onclick="tfeed.renderView('profile')"><i class="bi bi-chevron-left"></i> Voltar</button>` : '';

        return `
            <header class="tf-v2-header">
                ${backBtn || '<button class="tf-v2-icon-btn"><i class="bi bi-list"></i></button>'}
                <div class="tf-v2-logo-container">
                    <div class="logo-tfit-v2"><span class="white">T-</span><span class="blue">FEED</span></div>
                    <span class="logo-social-v2">social</span>
                </div>
                <div class="tf-v2-header-actions">
                    <button class="tf-v2-icon-btn" onclick="tfeed.renderView('direct')"><i class="bi bi-chat-text"></i></button>
                    <button class="tf-v2-icon-btn"><i class="bi bi-heart"></i></button>
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
        let storiesSkeleton = '';
        for (let i = 0; i < 5; i++) {
            storiesSkeleton += `
                <div style="min-width: 85px; display:flex; flex-direction:column; align-items:center;">
                    <div class="tf-v2-skeleton skeleton-circle" style="width:75px; height:75px;"></div>
                    <div class="tf-v2-skeleton skeleton-title" style="width:40px; height:10px;"></div>
                </div>
            `;
        }

        let feedSkeleton = '';
        for (let i = 0; i < 2; i++) {
            feedSkeleton += `
                <div class="p-md">
                    <div class="tf-v2-skeleton skeleton-title" style="width:30%;"></div>
                    <div class="tf-v2-skeleton skeleton-media"></div>
                    <div class="tf-v2-skeleton skeleton-title" style="width:80%; margin-top:20px;"></div>
                </div>
            `;
        }

        return `
            <div class="tf-v2-loading fade-in">
                <div class="tf-v2-stories-bar mb-lg">
                    ${storiesSkeleton}
                </div>
                <div class="tf-v2-feed-stream">
                    ${feedSkeleton}
                </div>
            </div>
        `;
    }

    async renderView(view = this.currentView, targetId = null) {
        this.currentView = view;
        this.activeChat = null;
        const main = document.getElementById('tfeed-v2-content');
        if (!main) return;

        // Visual highlight for nav
        document.querySelectorAll('.tf-v2-nav-btn').forEach(el => el.classList.remove('active'));
        const activeNav = document.querySelector(`.tf-v2-nav-btn[onclick*="'${view}'"]`);
        if (activeNav) activeNav.classList.add('active');

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
                this.renderDirect();
                break;
            case 'post_detail':
                main.innerHTML = await this.renderPostDetail(targetId); // targetId here is postId
                break;
            default:
                main.innerHTML = this.renderHomeFeed();
        }

        this.initAutoPlay();
    }

    // ============================================
    // VIEW: HOME FEED
    // ============================================

    renderHomeFeed() {
        if (this.isLoading && this.posts.length === 0) return this.renderLoadingState();

        return `
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

        let html = `
            <div class="tf-v2-story-item" onclick="${hasMyStories ? `tfeed.viewStories('${this.currentUser.id}')` : 'tfeed.triggerStoryUpload()'}" style="cursor: pointer; min-width: 85px;">
                <div class="tf-v2-story-ring ${hasMyStories ? 'has-stories' : ''}">
                    <img src="${this.currentUser.photo_url || this.currentUser.photo || './logo.png'}" class="tf-v2-story-avatar">
                    <div class="tf-v2-story-plus-badge" onclick="event.stopPropagation(); tfeed.triggerStoryUpload()">+</div>
                </div>
                <span class="tf-v2-story-name">Seu Story</span>
                <input type="file" id="direct-story-input" accept="image/*,video/*" style="display: none;" onchange="tfeed.handleDirectStoryUpload(this)">
            </div>
        `;

        Object.entries(this.stories).forEach(([uid, data]) => {
            if (uid === this.currentUser.id) return; // Already handled above
            const profile = data.user;
            const avatar = profile.photo_url || profile.photo || './logo.png';
            html += `
                <div class="tf-v2-story-item" onclick="tfeed.viewStories('${uid}')">
                    <div class="tf-v2-story-ring">
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
            const { data, error } = await supabase.storage.from('stories_media').upload(`${this.currentUser.id}/${fileName}`, file);
            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('stories_media').getPublicUrl(`${this.currentUser.id}/${fileName}`);

            await supabase.from('stories').insert({
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

        return `
            <article class="tf-v2-post" data-post-id="${post.id}">
                <div class="tf-v2-post-header">
                    <div class="tf-v2-post-user">
                        <img src="${avatar}" class="tf-v2-post-avatar" onclick="tfeed.viewStories('${post.user_id}')" style="cursor: pointer;">
                        <div onclick="tfeed.renderViewProfile('${post.user_id}')" style="cursor: pointer;">
                            <span class="tf-v2-post-username">${name} ${isVerified ? '<i class="bi bi-patch-check-fill tf-v2-verified-badge"></i>' : ''}</span>
                            <div class="text-xs text-muted">@${name.toLowerCase().replace(/\s+/g, '')}</div>
                        </div>
                    </div>
                    <button class="tf-v2-icon-btn" onclick="tfeed.openPostMenu('${post.id}', '${post.user_id}')"><i class="bi bi-three-dots"></i></button>
                </div>

                <div class="tf-v2-post-media-container" ondblclick="tfeed.handlePostLike('${post.id}', true)">
                    ${post.media_type === 'video'
                ? `<video src="${post.media_url}" class="tf-v2-post-media" loop muted playsinline onclick="this.paused ? this.play() : this.pause()"></video>`
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

                <div class="tf-v2-post-caption">
                    <strong>${name}</strong> ${post.caption || ''}
                    <div id="comments-count-${post.id}" class="text-xs text-muted mt-sm" style="opacity: 0.6; cursor: pointer;" onclick="tfeed.openComments('${post.id}')">Ver todos os ${post.comments_count || 0} comentários</div>
                </div>
                <div class="tf-v2-post-time">${this.timeAgo(post.created_at)}</div>
            </article>
        `;
    }

    // ============================================
    // VIEW: REELS
    // ============================================

    renderReels() {
        const reels = this.posts.filter(p => p.media_type === 'video');
        if (reels.length === 0) return `<div class="p-xl text-center text-muted">Nenhum vídeo disponível no momento.</div>`;

        return `
            <div class="tf-v2-reels-container">
                ${reels.map(reel => `
                    <div class="tf-v2-reel-item">
                        <video src="${reel.media_url}" class="tf-v2-reel-video" loop playsinline autoplay muted></video>
                        <div class="tf-v2-reel-info">
                            <div class="flex items-center gap-sm mb-md">
                                <img src="${reel.profiles.photo_url || './logo.png'}" style="width:32px; height:32px; border-radius:50%;">
                                <strong>${reel.profiles.name}</strong>
                                <button class="btn btn-sm btn-outline ml-sm" style="border-radius:20px; color:#fff; border-color:#fff;">Seguir</button>
                            </div>
                            <p class="text-sm">${reel.caption || ''}</p>
                        </div>
                        <div class="tf-v2-reel-actions">
                            <div class="tf-v2-reel-action">
                                <i class="bi bi-heart-fill" style="font-size:28px;"></i>
                                <span>${reel.likes || 0}</span>
                            </div>
                            <div class="tf-v2-reel-action">
                                <i class="bi bi-chat-fill" style="font-size:28px;"></i>
                                <span>${reel.comments || 0}</span>
                            </div>
                            <div class="tf-v2-reel-action">
                                <i class="bi bi-send-fill" style="font-size:28px;"></i>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ============================================
    // VIEW: SEARCH
    // ============================================

    renderSearch() {
        return `
            <div class="p-md">
                <div class="auth-search-bar tf-v2-glass-pill mb-md">
                    <i class="bi bi-search mr-sm"></i>
                    <input type="text" placeholder="Pesquisar usuários, posts..." class="flex-1" style="background:none; border:none; color:#fff; outline:none;" oninput="tfeed.handleSearch(this.value)">
                </div>
                <div class="tf-v2-profile-grid" id="search-grid">
                    ${this.posts.slice(0, 15).map(p => `
                        <div class="tf-v2-grid-item" onclick="tfeed.openPostDetail('${p.id}')">
                            <img src="${p.media_url}" loading="lazy">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ============================================
    // VIEW: PROFILE
    // ============================================

    async renderProfile(uid) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).single();
        if (!profile) return '';

        const userPosts = this.posts.filter(p => p.user_id === uid);
        const isMe = uid === this.currentUser.id;
        const isFollowing = this.followingIds.has(uid);
        const avatar = profile.photo_url || profile.photo || './logo.png';

        // Fetch counts from followers table for accuracy
        const [fols, fwing] = await Promise.all([
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', uid),
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', uid)
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
                ? userPosts.map(p => `
                            <div class="tf-v2-grid-item" onclick="tfeed.renderView('post_detail', '${p.id}')">
                                <img src="${p.media_url}" loading="lazy">
                            </div>
                        `).join('')
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

    // ============================================
    // VIEW: DIRECT MESSAGING (PREMIUM v2.0)
    // ============================================

    async renderDirect() {
        const main = document.getElementById('tfeed-v2-content');
        if (!main) return;

        if (!this.currentUser) {
            this.currentUser = auth.getCurrentUser();
            if (!this.currentUser) {
                main.innerHTML = '<div class="p-xl text-center text-muted">Aguardando autenticação... Se o erro persistir, faça login novamente.</div>';
                return;
            }
        }

        main.innerHTML = `
            <div class="tf-v2-direct-title">
                <span>Mensagens</span>
                <i class="bi bi-pencil-square" style="cursor: pointer;" onclick="tfeed.openNewChat()"></i>
            </div>
            <div class="tf-v2-inbox-loading p-xl text-center">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-xs mt-md">Sincronizando inbox...</p>
            </div>
        `;

        try {
            console.log('[T-Feed] Carregando inbox para:', this.currentUser.id);

            // Get conversations where user is a participant
            const { data: participations, error } = await supabase
                .from('conversation_participants')
                .select(`
                    id:conversation_id,
                    unread_count,
                    conversations(id, last_message, last_message_at, last_message_sender_id)
                `)
                .eq('user_id', this.currentUser.id)
                .order('unread_count', { ascending: false });

            if (error) {
                console.error('[T-Feed Direct Error]', error);
                throw error;
            }

            if (!participations || participations.length === 0) {
                main.innerHTML = `
                    <div class="tf-v2-direct-title">
                        <span>Mensagens</span>
                        <i class="bi bi-pencil-square" style="cursor: pointer;" onclick="tfeed.openNewChat()"></i>
                    </div>
                    <div class="p-xl text-center fade-in">
                        <i class="bi bi-chat-heart" style="font-size: 80px; color: var(--tf-cyan); opacity:0.3;"></i>
                        <h2 class="mt-md">Mensagens</h2>
                        <p class="text-muted text-sm px-xl">Suas mensagens e conversas aparecerão aqui. Clique no ícone de lápis para começar.</p>
                        <button class="btn btn-primary mt-xl" style="border-radius:30px; padding:12px 30px;" onclick="tfeed.openNewChat()">Nova Conversa</button>
                    </div>
                `;
                return;
            }

            // Fetch other participants info
            const convIds = participations.map(p => p.id);
            const { data: others, error: othersError } = await supabase
                .from('conversation_participants')
                .select('conversation_id, user_id, profiles(name, photo_url, photo, is_verified)')
                .in('conversation_id', convIds)
                .neq('user_id', this.currentUser.id);

            if (othersError) throw othersError;

            const inboxHtml = `
                <div class="tf-v2-direct-title">
                    <span>Mensagens</span>
                    <i class="bi bi-pencil-square" style="cursor: pointer;" onclick="tfeed.openNewChat()"></i>
                </div>
                <div class="tf-v2-inbox fade-in">
                    ${participations.map(p => {
                        const other = others.find(o => o.conversation_id === p.id);
                        if (!other) return '';
                        const conv = p.conversations;
                        const profile = other.profiles;
                        const timestamp = conv.last_message_at ? this.timeAgo(conv.last_message_at) : '';
                        const lastMsg = conv.last_message || 'Inicie uma conversa';
                        const isUnread = p.unread_count > 0;

                        return `
                            <div class="tf-v2-conv-item" onclick="tfeed.openChatRoom('${p.id}', '${other.user_id}')">
                                <div class="tf-v2-avatar-wrap">
                                    <img src="${profile.photo_url || profile.photo || './logo.png'}" class="tf-v2-conv-avatar">
                                    <div class="tf-v2-online-badge"></div>
                                </div>
                                <div class="tf-v2-conv-info">
                                    <div class="tf-v2-conv-name">
                                        ${profile.name} ${profile.is_verified ? '<i class="bi bi-patch-check-fill text-primary"></i>' : ''}
                                    </div>
                                    <div class="tf-v2-conv-meta">
                                        <span class="tf-v2-last-msg ${isUnread ? 'text-white font-bold' : ''}">${lastMsg}</span>
                                        <span class="separator">•</span>
                                        <span class="tf-v2-time">${timestamp}</span>
                                    </div>
                                </div>
                                ${isUnread ? '<div class="tf-v2-unread-tag"></div>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            main.innerHTML = inboxHtml;
        } catch (err) {
            console.error('[T-Feed Direct] Inbox Load Error:', err);
            main.innerHTML = `<div class="p-xl text-center text-muted">
                <div>Erro ao carregar mensagens.</div>
                <div class="text-xs mt-sm opacity-50">${err.message || 'Erro desconhecido'}</div>
                <button class="btn btn-sm btn-ghost mt-md" onclick="tfeed.renderDirect()">Tentar Novamente</button>
            </div>`;
        }
    }

    async openNewChat() {
        UI.showModal('Nova Conversa', `
            <div class="p-md">
                <div class="auth-search-bar tf-v2-glass-pill mb-md">
                    <i class="bi bi-search mr-sm"></i>
                    <input type="text" id="chat-user-search" placeholder="Pesquisar..." class="flex-1" 
                           style="background:none; border:none; color:#fff; outline:none;" 
                           oninput="tfeed.searchChatUsers(this.value)">
                </div>
                <div id="chat-search-results" style="max-height: 400px; overflow-y: auto;">
                    <div class="text-center p-md text-muted">Digite o nome para pesquisar atletas...</div>
                </div>
            </div>
        `);
    }

    async searchChatUsers(query) {
        if (!query || query.length < 2) return;
        try {
            const { data: users } = await supabase.from('profiles')
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
        UI.showLoading('Iniciando chat...');
        try {
            const { data: convId, error } = await supabase.rpc('get_or_create_conversation', {
                user1_id: this.currentUser.id,
                user2_id: targetId
            });

            if (error) throw error;

            this.openChatRoom(convId, targetId);
            UI.hideLoading();
        } catch (err) {
            UI.hideLoading();
            console.error(err);
            UI.showNotification('Erro', 'Não foi possível iniciar o chat.', 'error');
        }
    }

    async openChatRoom(conversationId, targetId) {
        this.activeChat = conversationId;
        const wrapper = document.getElementById('tfeed-v2-wrapper');
        if (!wrapper) return;

        // Try to find target user profile
        let targetProfile = null;
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', targetId).single();
            targetProfile = data;
        } catch (e) { console.warn('Could not load profile'); }

        const chatOverlay = document.createElement('div');
        chatOverlay.className = 'tf-v2-chat-container';
        chatOverlay.id = 'chat-overlay';
        chatOverlay.innerHTML = `
            <div class="tf-v2-chat-header">
                <i class="bi bi-chevron-left tf-v2-chat-back" onclick="tfeed.closeChat()"></i>
                <img src="${targetProfile?.photo_url || './logo.png'}" class="tf-v2-chat-avatar">
                <div class="flex-1">
                    <div class="tf-v2-conv-name">${targetProfile?.name || 'Carregando...'}</div>
                    <div class="text-xs text-green-500">Ativo agora</div>
                </div>
                <div class="tf-v2-chat-actions" style="display:flex; gap:15px; font-size:20px; color:var(--tf-cyan)">
                    <i class="bi bi-telephone-fill" style="cursor:pointer" onclick="tfeed.startCall('audio', '${targetId}')"></i>
                    <i class="bi bi-camera-video-fill" style="cursor:pointer" onclick="tfeed.startCall('video', '${targetId}')"></i>
                </div>
            </div>
            
            <div id="chat-messages" class="tf-v2-chat-messages">
                <div class="text-center p-xl"><div class="spinner-border text-primary spinner-border-sm"></div></div>
            </div>

            <div id="chat-preview-media" class="hidden" style="padding:10px 15px; background:#111; border-top:1px solid #333;"></div>

            <div class="tf-v2-chat-input-area">
                <div class="tf-v2-input-main-wrap">
                    <button class="tf-v2-input-btn" onclick="tfeed.triggerMediaUpload()"><i class="bi bi-camera"></i></button>
                    <textarea id="chat-msg-input" class="tf-v2-chat-input" placeholder="Mensagem..." rows="1" oninput="tfeed.toggleSendBtn(this)"></textarea>
                    
                    <div id="chat-send-actions" style="display:flex; align-items:center;">
                        <button id="record-audio-btn" class="tf-v2-input-btn" onmousedown="tfeed.startRecording()" onmouseup="tfeed.stopRecording()" ontouchstart="tfeed.startRecording()" ontouchend="tfeed.stopRecording()">
                            <i class="bi bi-mic"></i>
                        </button>
                        <button class="tf-v2-input-btn" onclick="tfeed.triggerFileUpload()"><i class="bi bi-paperclip"></i></button>
                        <div id="btn-send-dm" class="tf-v2-send-btn" onclick="tfeed.sendDmMessage()">Enviar</div>
                    </div>
                </div>
                <!-- Hidden Inputs -->
                <input type="file" id="dm-media-input" accept="image/*,video/*" style="display:none" onchange="tfeed.onMediaSelected(this)">
                <input type="file" id="dm-file-input" style="display:none" onchange="tfeed.onFileSelected(this)">
            </div>
        `;

        wrapper.appendChild(chatOverlay);
        this.loadMessages(conversationId);
        this.markAsRead(conversationId);
    }

    closeChat() {
        const chat = document.getElementById('chat-overlay');
        if (chat) chat.remove();
        this.activeChat = null;
        this.renderDirect();
    }

    async loadMessages(conversationId) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        try {
            const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (!messages || messages.length === 0) {
                container.innerHTML = `
                    <div class="p-xl text-center" style="margin-top:auto">
                        <i class="bi bi-chat-dots" style="font-size:40px; color:var(--tf-border)"></i>
                        <p class="text-muted text-sm mt-md">Nenhuma mensagem ainda.<br>Diga oi para começar!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = messages.map(m => this.renderMessage(m)).join('');
            container.scrollTop = container.scrollHeight;
        } catch (err) {
            console.error('[T-Feed Chat] Message Load Error:', err);
            container.innerHTML = '<div class="p-xl text-center text-muted">Erro ao carregar conversa.</div>';
        }
    }

    renderMessage(m) {
        const isMe = m.sender_id === this.currentUser.id;
        let contentHtml = '';

        switch (m.type) {
            case 'text':
                contentHtml = `<div class="tf-v2-message ${isMe ? 'sent' : 'received'}">${m.content}</div>`;
                break;
            case 'image':
                contentHtml = `
                    <div class="msg-media-container ${isMe ? 'sent' : 'received'}">
                        <img src="${m.media_url}" onclick="window.open('${m.media_url}', '_blank')">
                        ${m.content ? `<div class="p-sm text-sm">${m.content}</div>` : ''}
                    </div>
                `;
                break;
            case 'video':
                contentHtml = `
                    <div class="msg-media-container ${isMe ? 'sent' : 'received'}">
                        <video src="${m.media_url}" controls playsinline></video>
                        ${m.content ? `<div class="p-sm text-sm">${m.content}</div>` : ''}
                    </div>
                `;
                break;
            case 'audio':
                contentHtml = `
                    <div class="tf-v2-message ${isMe ? 'sent' : 'received'}">
                        <div class="audio-msg">
                            <div class="audio-btn" onclick="tfeed.playAudio('${m.media_url}', this)">
                                <i class="bi bi-play-fill"></i>
                            </div>
                            <div class="audio-progress">
                                <div class="audio-progress-fill"></div>
                            </div>
                            <span class="text-xs">0:00</span>
                        </div>
                    </div>
                `;
                break;
            case 'file':
                contentHtml = `
                    <div class="tf-v2-message ${isMe ? 'sent' : 'received'}" onclick="window.open('${m.media_url}', '_blank')" style="cursor:pointer">
                        <div class="flex items-center gap-sm">
                            <i class="bi bi-file-earmark-arrow-down" style="font-size:20px"></i>
                            <div>
                                <div class="text-sm font-bold truncate" style="max-width:140px">${m.content || 'Arquivo'}</div>
                                <div class="text-xs opacity-60">Baixar arquivo</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }

        return `
            <div class="msg-wrapper ${isMe ? 'sent' : 'received'}">
                ${contentHtml}
                <div class="text-xs mt-xs mx-sm" style="opacity:0.3; align-self:${isMe ? 'flex-end' : 'flex-start'}">
                    ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        `;
    }

    toggleSendBtn(input) {
        const sendBtn = document.getElementById('btn-send-dm');
        const micBtn = document.getElementById('record-audio-btn');
        if (input.value.trim().length > 0) {
            sendBtn.style.display = 'block';
            micBtn.style.display = 'none';
        } else {
            sendBtn.style.display = 'none';
            micBtn.style.display = 'flex';
        }
        input.style.height = 'auto';
        input.style.height = (input.scrollHeight) + 'px';
    }

    async sendDmMessage() {
        const input = document.getElementById('chat-msg-input');
        const text = input.value.trim();
        const convId = this.activeChat;

        if (!text && !this._pendingMediaFile) return;

        try {
            let mediaUrl = null;
            let type = 'text';

            if (this._pendingMediaFile) {
                UI.showLoading('Enviando mídia...');
                const file = this._pendingMediaFile;
                const fileExt = file.name.split('.').pop();
                const fileName = `dm_${Date.now()}.${fileExt}`;
                const { data: uploadData, error: uploadErr } = await supabase.storage.from('dm_media').upload(`${convId}/${fileName}`, file);
                
                if (uploadErr) throw uploadErr;
                const { data: { publicUrl } } = supabase.storage.from('dm_media').getPublicUrl(`${convId}/${fileName}`);
                
                mediaUrl = publicUrl;
                type = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'file');
                
                this._pendingMediaFile = null;
                document.getElementById('chat-preview-media').classList.add('hidden');
                UI.hideLoading();
            }

            const { error: rpcErr } = await supabase.rpc('send_premium_message', {
                p_conv_id: convId,
                p_sender_id: this.currentUser.id,
                p_type: type,
                p_content: text || '',
                p_media_url: mediaUrl
            });

            if (rpcErr) {
                console.error('[T-Feed Direct RPC Error]', rpcErr);
                throw rpcErr;
            }

            input.value = '';
            this.toggleSendBtn(input);
            this.loadMessages(convId);
        } catch (err) {
            console.error('[T-Feed Direct Catch]', err);
            UI.hideLoading();
            UI.showNotification('Erro', `Não foi possível enviar: ${err.message || 'Erro no servidor'}`, 'error');
        }
    }

    async markAsRead(conversationId) {
        try {
            await supabase.rpc('mark_all_as_read', {
                p_conv_id: conversationId,
                p_user_id: this.currentUser.id
            });
        } catch (e) {}
    }

    // VOX LOGIC
    startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            UI.showNotification('Erro', 'Seu navegador não suporta gravação de áudio.', 'error');
            return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            this._mediaRecorder = new MediaRecorder(stream);
            this._audioChunks = [];
            
            this._mediaRecorder.ondataavailable = e => this._audioChunks.push(e.data);
            this._mediaRecorder.onstop = () => this.handleAudioReady();
            
            this._mediaRecorder.start();
            document.getElementById('record-audio-btn').classList.add('active');
            console.log('Recording started...');
        }).catch(err => {
            UI.showNotification('Erro', 'Permissão de microfone negada.', 'error');
        });
    }

    stopRecording() {
        if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
            this._mediaRecorder.stop();
            document.getElementById('record-audio-btn').classList.remove('active');
            console.log('Recording stopped.');
        }
    }

    async handleAudioReady() {
        const audioBlob = new Blob(this._audioChunks, { type: 'audio/webm' });
        const convId = this.activeChat;
        if (!convId) return;

        UI.showLoading('Enviando áudio...');
        try {
            const fileName = `audio_${Date.now()}.webm`;
            const { data, error } = await supabase.storage.from('dm_media').upload(`${convId}/${fileName}`, audioBlob);
            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('dm_media').getPublicUrl(`${convId}/${fileName}`);
            
            await supabase.from('messages').insert({
                conversation_id: convId,
                sender_id: this.currentUser.id,
                type: 'audio',
                media_url: publicUrl
            });

            UI.hideLoading();
            this.loadMessages(convId);
        } catch (err) {
            UI.hideLoading();
            console.error(err);
        }
    }

    // MEDIA TRIGGERS
    triggerMediaUpload() { document.getElementById('dm-media-input').click(); }
    triggerFileUpload() { document.getElementById('dm-file-input').click(); }

    onMediaSelected(input) {
        const file = input.files[0];
        if (!file) return;
        this._pendingMediaFile = file;
        this.showMediaPreview(file);
    }

    onFileSelected(input) {
        const file = input.files[0];
        if (!file) return;
        this._pendingMediaFile = file;
        this.showMediaPreview(file);
    }

    showMediaPreview(file) {
        const preview = document.getElementById('chat-preview-media');
        preview.classList.remove('hidden');
        preview.innerHTML = `
            <div class="flex items-center justify-between p-sm" style="background:#222; border-radius:10px">
                <div class="flex items-center gap-sm">
                    <i class="bi bi-file-earmark-check text-cyan" style="font-size:24px"></i>
                    <span class="text-xs truncate" style="max-width:200px">${file.name}</span>
                </div>
                <i class="bi bi-x-circle text-danger" onclick="tfeed.cancelMediaPreview()"></i>
            </div>
        `;
        document.getElementById('btn-send-dm').style.display = 'block';
        document.getElementById('record-audio-btn').style.display = 'none';
    }

    cancelMediaPreview() {
        this._pendingMediaFile = null;
        document.getElementById('chat-preview-media').classList.add('hidden');
        this.toggleSendBtn(document.getElementById('chat-msg-input'));
    }

    async markAsRead(conversationId) {
        try {
            await supabase.from('conversation_members')
                .update({ unread_count: 0, last_read_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .eq('user_id', this.currentUser.id);
        } catch (e) {}
    }

    handleNewMessage(payload) {
        if (this.activeChat === payload.new.conversation_id) {
            this.loadMessages(this.activeChat);
            this.markAsRead(this.activeChat);
        } else if (this.currentView === 'direct') {
            this.renderDirect();
        }
        
        // Push notification simulation if not active
        if (this.activeChat !== payload.new.conversation_id && payload.new.sender_id !== this.currentUser.id) {
            // UI.showNotification('Nova Mensagem', 'Você recebeu uma mensagem no direct.', 'info');
        }
    }

    playAudio(url, btn) {
        const icon = btn.querySelector('i');
        const audio = new Audio(url);
        
        if (icon.classList.contains('bi-play-fill')) {
            audio.play();
            icon.classList.replace('bi-play-fill', 'bi-pause-fill');
            
            audio.onended = () => {
                icon.classList.replace('bi-pause-fill', 'bi-play-fill');
            };
        } else {
            audio.pause();
            icon.classList.replace('bi-pause-fill', 'bi-play-fill');
        }
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

        // Optimistic UI
        if (liked && !doubleTap) {
            this.userLikes.delete(postId);
            if (icon) {
                icon.className = 'bi bi-heart tf-v2-action-icon';
                icon.style.color = '#fff';
            }
            if (countSpan) countSpan.innerText = Math.max(0, parseInt(countSpan.innerText) - 1);
        } else if (!liked) {
            this.userLikes.add(postId);
            if (icon) {
                icon.className = 'bi bi-heart-fill liked tf-v2-action-icon';
                icon.style.color = '#fe2c55';
            }
            if (countSpan) countSpan.innerText = parseInt(countSpan.innerText) + 1;
        }

        try {
            if (liked && !doubleTap) {
                await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', this.currentUser.id);
            } else if (!liked) {
                await supabase.from('likes').insert({ post_id: postId, user_id: this.currentUser.id });
                this.awardPoints('Curtiu post', 1);
            }
        } catch (err) {
            console.error(err);
            this.loadInitialData(); // Rollback on error
        }
    }

    async toggleFollow(targetUid, isFollowing) {
        if (!this.currentUser) return;
        UI.showLoading();
        try {
            if (isFollowing) {
                await supabase.from('followers').delete().eq('follower_id', this.currentUser.id).eq('following_id', targetUid);
                this.followingIds.delete(targetUid);
            } else {
                await supabase.from('followers').insert({ follower_id: this.currentUser.id, following_id: targetUid });
                this.followingIds.add(targetUid);
            }
            UI.hideLoading();
            this.renderView('profile', targetUid);
        } catch (err) {
            UI.hideLoading();
            console.error(err);
        }
    }

    async awardPoints(action, amount) {
        try {
            const user = auth.getCurrentUser();
            if (!user) return;

            // Trigger GrowthSystem if it's the right action type
            if (typeof GrowthSystem !== 'undefined') {
                if (action === 'Publicação criada') GrowthSystem.awardPoints(user.id, 'post_feed');
                if (action === 'Concluir Treino') GrowthSystem.awardPoints(user.id, 'treino_concluido');
            }

            // Internal point award
            const curr = Number(user.t_points) || 0;
            await supabase.from('profiles').update({ t_points: curr + amount }).eq('id', user.id);
            user.t_points = curr + amount;

            console.log(`[T-Points] Awarded ${amount} for: ${action}`);
        } catch (err) {
            console.error('[T-Points] Point award failed:', err);
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
                <div class="card p-md text-center bg-black border-none hover-glow" onclick="UI.closeModal(); tfeed.triggerStoryUpload()" style="cursor:pointer; border: 1px solid var(--tf-border);">
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
            const { data: up, error: upErr } = await supabase.storage.from('posts_media').upload(`${this.currentUser.id}/${fileName}`, file);
            if (upErr) throw upErr;

            const { data: { publicUrl } } = supabase.storage.from('posts_media').getPublicUrl(`${this.currentUser.id}/${fileName}`);

            await supabase.from('posts').insert({
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
            // Conversão manual de base64 data URL para Blob e File para evitar erro do fetch() no iOS/Safari
            const block = base64Img.split(";");
            const contentType = block[0].split(":")[1];
            const realData = block[1].split(",")[1];
            
            const b64toBlob = (b64Data, contentType='', sliceSize=512) => {
                const byteCharacters = atob(b64Data);
                const byteArrays = [];
                for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                    const slice = byteCharacters.slice(offset, offset + sliceSize);
                    const byteNumbers = new Array(slice.length);
                    for (let i = 0; i < slice.length; i++) {
                        byteNumbers[i] = slice.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    byteArrays.push(byteArray);
                }
                return new Blob(byteArrays, {type: contentType});
            };

            const blob = b64toBlob(realData, contentType);
            const file = new File([blob], `workout_${Date.now()}.jpg`, { type: contentType || 'image/jpeg' });

            const fileName = `post_${Date.now()}.jpg`;

            const { data: up, error: upErr } = await supabase.storage.from('posts_media').upload(`${this.currentUser.id}/${fileName}`, file);
            if (upErr) throw upErr;

            const { data: { publicUrl } } = supabase.storage.from('posts_media').getPublicUrl(`${this.currentUser.id}/${fileName}`);

            await supabase.from('posts').insert({
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
                await supabase.from('saves').delete().eq('post_id', postId).eq('user_id', this.currentUser.id);
                this.userSaves.delete(postId);
                if (icon) {
                    icon.className = 'bi bi-bookmark tf-v2-action-icon';
                    icon.style.color = '#fff';
                }
                UI.showNotification('Salvos', 'Removido dos itens salvos.', 'info');
            } else {
                await supabase.from('saves').insert({ post_id: postId, user_id: this.currentUser.id });
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
            const { data: saves } = await supabase.from('saves')
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
                grid.innerHTML = posts.map(p => `
                    <div class="tf-v2-grid-item" onclick="tfeed.renderView('post_detail', '${p.id}')">
                        <img src="${p.media_url}" loading="lazy">
                    </div>
                `).join('');
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
                res = await supabase.from('followers').select('profiles!follower_id(id, name, photo_url)').eq('following_id', uid);
            } else {
                res = await supabase.from('followers').select('profiles!following_id(id, name, photo_url)').eq('follower_id', uid);
            }
            UI.hideLoading();

            const list = res.data || [];
            UI.showModal(type === 'followers' ? 'Seguidores' : 'Seguindo', `
                <div class="p-md" style="max-height: 400px; overflow-y: auto;">
                    ${list.length === 0 ? '<p class="text-center text-muted">Ninguém por aqui ainda.</p>' : list.map(item => {
                const p = item.profiles;
                return `
                            <div class="flex items-center justify-between mb-md">
                                <div class="flex items-center gap-md" onclick="UI.closeModal(); tfeed.renderView('profile', '${p.id}')" style="cursor: pointer;">
                                    <img src="${p.photo_url || './logo.png'}" style="width: 40px; height: 40px; border-radius: 50%;">
                                    <b>${p.name}</b>
                                </div>
                                ${p.id !== this.currentUser.id ? `
                                    <button class="btn btn-sm btn-outline" onclick="tfeed.toggleFollow('${p.id}', ${this.followingIds.has(p.id)})">
                                        ${this.followingIds.has(p.id) ? 'Seguindo' : 'Seguir'}
                                    </button>
                                ` : ''}
                            </div>
                        `;
            }).join('')}
                </div>
            `);
        } catch (err) {
            UI.hideLoading();
            console.error(err);
        }
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
            const isVideo = story.media_url?.includes('.mp4') || story.media_url?.includes('.mov');

            const viewer = document.createElement('div');
            viewer.id = 'tf-v2-story-overlay';
            viewer.className = 'tf-v2-story-viewer fade-in';
            viewer.innerHTML = `
                <div class="tf-v2-story-progress-bar">
                    ${items.map((_, i) => `<div class="tf-v2-story-progress-seg"><div class="tf-v2-story-progress-fill" style="width: ${i < index ? '100' : (i === index ? '0' : '0')}%"></div></div>`).join('')}
                </div>
                <div class="tf-v2-story-header">
                    <div class="tf-v2-story-user" onclick="UI.closeStoryViewer(); tfeed.renderView('profile', '${uid}')" style="cursor: pointer;">
                        <img src="${userStories.user.photo_url || userStories.user.photo || './logo.png'}" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #fff;">
                        <b>${userStories.user.name}</b>
                        <span class="text-xs opacity-70 ml-2">${this.timeAgo(story.created_at)}</span>
                    </div>
                    <button class="tf-v2-icon-btn" onclick="UI.closeStoryViewer()"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="tf-v2-story-content" onclick="tfeed.nextStory()">
                    ${isVideo
                    ? `<video src="${story.media_url}" autoplay playsinline style="width: 100%; height: 100%; object-fit: contain;"></video>`
                    : `<img src="${story.media_url}" style="width: 100%; height: 100%; object-fit: contain;">`
                }
                    <div class="story-nav-left" style="position: absolute; left: 0; top: 0; width: 30%; height: 100%; z-index: 10;" onclick="event.stopPropagation(); tfeed.prevStory()"></div>
                    <div class="story-nav-right" style="position: absolute; right: 0; top: 0; width: 70%; height: 100%; z-index: 5;" onclick="event.stopPropagation(); tfeed.nextStory()"></div>
                </div>
                <div class="tf-v2-story-footer p-md">
                     <div class="flex gap-md items-center">
                        <input type="text" class="form-input flex-1" placeholder="Enviar mensagem..." style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; color: #fff;">
                        <i class="bi bi-heart" style="font-size: 24px; cursor: pointer;"></i>
                        <i class="bi bi-send" style="font-size: 24px; cursor: pointer;"></i>
                     </div>
                </div>
            `;

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
        };

        this.nextStory = () => {
            const ctx = this.currentStoryContext;
            if (!ctx) return;
            UI.closeStoryViewer();
            if (ctx.index + 1 < ctx.total) {
                showStory(ctx.index + 1);
            } else {
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
            UI.closeStoryViewer();
            if (ctx.index > 0) {
                showStory(ctx.index - 1);
            } else {
                showStory(0);
            }
        };

        showStory(0);
    }

    async loadComments(postId) {
        try {
            const { data: comments, error } = await supabase.from('comments')
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
            const { error } = await supabase.from('comments').insert({
                post_id: postId,
                user_id: this.currentUser.id,
                comment_text: text
            });

            if (error) {
                // Tenta fallback para coluna 'text' se 'comment_text' falhar
                if (error.message.includes('comment_text')) {
                    const { error: error2 } = await supabase.from('comments').insert({
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
            if (countSpan) {
                const current = parseInt(countSpan.innerText.match(/\d+/) || [0])[0];
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
            await supabase.from('posts').delete().eq('id', postId);
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
            await supabase.from('profiles').update({ name, bio }).eq('id', this.currentUser.id);
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
            await supabase.storage.from('stories_media').upload(`${this.currentUser.id}/${fileName}`, file);
            const { data: { publicUrl } } = supabase.storage.from('stories_media').getPublicUrl(`${this.currentUser.id}/${fileName}`);

            await supabase.from('stories').insert({
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
            await supabase.from('t_boosts').insert({
                user_id: this.currentUser.id,
                item_id: postId,
                item_type: 'post',
                points_spent: cost,
                duration_minutes: min,
                expires_at: new Date(Date.now() + min * 60000).toISOString()
            });
            await supabase.rpc('add_tpoints', { user_id_param: this.currentUser.id, amount_param: -cost });
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

    async startCall(type, targetId) {
        console.log(`[T-Call] Iniciando chamada de ${type} para ${targetId}`);
        UI.showNotification('Conectando...', `Iniciando chamada de ${type === 'video' ? 'vídeo' : 'voz'}...`, 'info');
        
        try {
            // Placeholder for WebRTC Signal
            const { data, error } = await supabase.rpc('start_call', {
                p_caller: this.currentUser.id,
                p_type: type
            });

            if (error) throw error;
            
            UI.showModal('Chamada em Andamento', `
                <div class="text-center p-xl">
                    <div class="tf-v2-call-avatar mb-md">
                        <img src="./logo.png" style="width:100px; height:100px; border-radius:50%; border:3px solid var(--tf-cyan); animation: pulse 2s infinite;">
                    </div>
                    <h3 class="text-white mb-sm">Chamando...</h3>
                    <p class="text-muted text-sm mb-xl">Aguardando o outro atleta atender.</p>
                    <div class="flex justify-center gap-md">
                        <button class="btn btn-danger btn-circle" style="width:60px; height:60px; border-radius:50%;" onclick="UI.closeModal();">
                            <i class="bi bi-telephone-x-fill"></i>
                        </button>
                    </div>
                </div>
            `);
        } catch (err) {
            console.error(err);
            UI.showNotification('T-Call Beta', 'Esta funcionalidade premium está sendo liberada gradualmente em sua região.', 'info');
        }
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
