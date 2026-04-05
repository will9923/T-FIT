// ============================================
// AUTH MANAGER (Supabase Auth Real + Google)
// ============================================
class AuthManager {
    constructor(db) {
        this.db = db;
        this.currentUser = null;
        this._listenerInitialized = false;
        // initAuthListener will be called by app.js during boot to ensure all modules are ready
    }

    async initAuthListener() {
        // Guard against double initialization
        if (this._listenerInitialized) {
            console.log('[Auth] Listener já inicializado, pulando.');
            return;
        }
        this._listenerInitialized = true;

        // Verificar se Supabase existe
        if (!window.supabase || !window.supabase.auth) {
            console.warn('[Auth] Supabase Auth não disponível ainda.');
            this._listenerInitialized = false;
            return;
        }

        // Verificar sessão atual
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            await this.handleSession(session);
        }

        // Escutar mudanças de auth
        window.supabase.auth.onAuthStateChange((event, session) => {
            console.log(`[Auth] Evento: ${event}`);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                this.handleSession(session);
            } else if (event === 'SIGNED_OUT') {
                this.handleSignOut();
            }
        });
    }

    async handleSession(session) {
        if (!session || !session.user) {
            console.log('[Auth] Nenhum dado de sessão recebido em handleSession');
            return;
        }

        console.log('[Auth] handleSession iniciado para:', session.user.email);

        try {
            // TENTAR buscar o perfil com TIMEOUT de 5 segundos
            const profilePromise = window.supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            const { data: profile, error } = await Promise.race([
                profilePromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Auth Timeout')), 5000))
            ]);

            // Se o erro for "não encontrado", não damos throw para permitir o self-healing
            if (error && error.code !== 'PGRST116') throw error;

            if (profile) {
                const finalRole = profile.role;
                this.currentUser = { ...profile, role: finalRole, type: finalRole };

                // Clear pending role after identifying the user - safety first!
                if (localStorage.getItem('tfit_pending_role')) {
                    console.log(`[Auth] Limpando papel pendente (${localStorage.getItem('tfit_pending_role')}) após login bem-sucedido.`);
                    localStorage.removeItem('tfit_pending_role');
                }

                this.saveSession(this.currentUser);
                console.log(`[Auth] Usuário logado: ${this.currentUser.name || 'Sem Nome'} | Role: ${finalRole}`);
                
                // Award T-Points for Login (Growth System)
                if (finalRole === 'student' && typeof GrowthSystem !== 'undefined') {
                    GrowthSystem.awardPoints(this.currentUser.id, 'login');
                }

                this.redirectAfterLogin(finalRole);
                return;
            } else {
                // AUTO-CORREÇÃO: Perfil não existe no banco (Trigger falhou ou deletado)
                console.warn('[Auth] Perfil não encontrado no banco. Iniciando auto-correção...');

                const role = session.user.user_metadata?.role || localStorage.getItem('tfit_pending_role') || 'student';
                const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Usuário';

                // Check for referral code in URL or LocalStorage
                const urlParams = new URLSearchParams(window.location.search);
                const referrerId = urlParams.get('ref') || localStorage.getItem('tfit_referrer_id');

                const newProfile = {
                    id: session.user.id,
                    email: session.user.email,
                    name: name,
                    role: role,
                    status: 'active',
                    referrer_id: (role === 'student' && referrerId) ? referrerId : null,
                    created_at: new Date().toISOString()
                };

                const { data: created, error: createError } = await window.supabase
                    .from('profiles')
                    .insert([newProfile])
                    .select()
                    .single();

                if (!createError && created) {
                    console.log('[Auth] Perfil recuperado com sucesso via auto-correção.');
                    this.currentUser = { ...created, role: created.role, type: created.role };
                    this.saveSession(this.currentUser);

                    // Handle Referral Logic (Growth System)
                    if (created.role === 'student' && created.referrer_id && typeof GrowthSystem !== 'undefined') {
                        GrowthSystem.handleReferralSignup(created.id, created.referrer_id);
                    }

                    this.redirectAfterLogin(this.currentUser.role);
                    return;
                } else {
                    console.error('[Auth] Falha crítica na auto-correção:', createError);
                }
            }
        } catch (err) {
            console.warn('[Auth] Erro ou Timeout ao buscar perfil:', err.message);
        }

        // FALLBACK: Se houver erro ou timeout, tenta usar metadados da sessão ou local storage
        console.log('[Auth) Usando fallback para definição de usuário...');
        const backupUser = this.loadSession();
        if (backupUser && backupUser.id === session.user.id) {
            this.currentUser = backupUser;
        } else {
            const role = session.user.user_metadata?.role || localStorage.getItem('tfit_pending_role') || 'student';
            this.currentUser = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || 'Usuário',
                role: role,
                type: role
            };
        }

        this.saveSession(this.currentUser);
        this.redirectAfterLogin(this.currentUser.role);
    }

    handleSignOut() {
        this.currentUser = null;
        this.db.remove('session');

        // Se estiver em área restrita, vai para home
        if (!window.location.hash.includes('login') && window.location.hash !== '' && window.location.hash !== '#/') {
            router.navigate('/');
        }
    }

    redirectAfterLogin(role) {
        const hash = window.location.hash;
        // Se o ?code= pertence ao Spotify (não ao Supabase), ignora o redirect do T-FIT
        const isSpotifyCallback = !!window._spotifyCallbackInProgress;
        const isCallback = isSpotifyCallback || window.location.pathname.includes('/callback') || window.location.search.includes('code=');

        // Se estiver em uma página de login específica ou retorno de auth (callback), NÃO redirecionar.
        if (isCallback || hash.includes('/admin/login') || hash.includes('/personal/login') || hash.includes('/student/login') ||
            hash.includes('/personal/register') || hash.includes('/student/register')) {
            console.log(`[Auth] Path "${window.location.pathname}" ou Hash "${hash}" detectado. Redirecionamento automático IGNORADO para preservar fluxo.`);
            return;
        }

        if (hash === '' || hash === '#/' || hash === '#') {
            const dashboardMap = {
                'admin': '/admin/dashboard',
                'personal': '/personal/dashboard',
                'student': '/student/dashboard'
            };
            if (dashboardMap[role]) {
                setTimeout(() => {
                    console.log(`[Auth] 🎯 Redirecionamento Final: Role "${role}" -> Rota "${dashboardMap[role]}"`);
                    router.navigate(dashboardMap[role]);
                }, 300);
            } else {
                console.warn(`[Auth] ⚠️ Role "${role}" não possui dashboard mapeado.`);
            }
        }
    }

    loadSession() {
        return this.db.get('session');
    }

    saveSession(user) {
        this.currentUser = user;
        this.db.set('session', user);
    }

    async login(email, password) {
        try {
            console.log(`[Auth] Iniciando login para: ${email}`);
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            console.log('[Auth] Logado com sucesso no Supabase. Aguardando perfil...', data.user.id);

            // Aguardar até que o handleSession (disparado pelo onAuthStateChange) popule o currentUser
            let attempts = 0;
            while ((!this.currentUser || this.currentUser.id !== data.user.id) && attempts < 10) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
                console.log(`[Auth] Aguardando perfil... tentativa ${attempts}`);
            }

            if (!this.currentUser) {
                console.warn('[Auth] Perfil não carregou a tempo, mas login foi ok.');
            } else {
                console.log('[Auth] Perfil carregado e pronto:', this.currentUser.name);
            }

            return { success: true, user: data.user };
        } catch (error) {
            console.error('[Auth] Erro Login:', error.message);
            return { success: false, message: this.translateAuthError(error) };
        }
    }

    // LOGIN DIRETO (Modo Demo - sem senha)
    async loginDirect(role) {
        console.log(`[Auth] Login direto como: ${role}`);

        // Verificar se Supabase está pronto para uso
        if (!window.supabase || typeof window.supabase.from !== 'function') {
            console.error('[Auth] Cliente Supabase não está pronto:', window.supabase);
            return { success: false };
        }

        try {
            const { data, error } = await window.supabase
                .from('profiles')
                .select('*')
                .eq('role', role)
                .limit(1);

            if (error || !data || data.length === 0) {
                console.error('[Auth] Usuário não encontrado para role:', role, error);
                return { success: false };
            }

            const user = data[0];
            user.type = role;
            this.saveSession(user);

            // Redirecionamento inteligente
            this.redirectAfterLogin(role);

            return { success: true, user };
        } catch (err) {
            console.error('[Auth] Exceção Login Direto:', err);
            return { success: false };
        }
    }

    async loginWithGoogle(role = 'student') {
        // OAuth redirection does NOT work with file:// protocol
        if (window.location.protocol === 'file:') {
            console.error('[Auth] Redirecionamento OAuth não suportado em file://');
            return { success: false, message: 'Protocolo file:// não suportado para Google Auth.' };
        }

        // Save intended role for new user profile creation
        localStorage.setItem('tfit_pending_role', role);

        try {
            let redirectTo = window.location.origin;

            console.log(`[Auth] Iniciando Login Google. Redirecionando para: ${redirectTo}`);

            const { data, error } = await window.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectTo,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('[Auth] Erro Google:', error);
            const msg = error.message || 'Erro desconhecido';
            if (msg.includes('connection refused')) {
                UI.showNotification('Erro de Conexão', 'Não foi possível conectar ao servidor de autenticação. Verifique se o simple-server.js está rodando.', 'error');
            }
            return { success: false, message: msg };
        }
    }

    async signUp(email, password, metadata) {
        try {
            console.log(`[Auth] Tentando cadastro para: ${email}`);
            const { data, error } = await window.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: metadata,
                    emailRedirectTo: window.location.origin
                }
            });

            if (error) throw error;

            // Se o session vier nulo, significa que o e-mail precisa ser confirmado (config do Supabase)
            const requireConfirmation = !data.session;

            return {
                success: true,
                user: data.user,
                session: data.session,
                requireConfirmation: requireConfirmation
            };
        } catch (error) {
            console.error('[Auth] Erro Cadastro:', error.message);
            return { success: false, message: this.translateAuthError(error) };
        }
    }

    async signUpWithoutLogin(email, password, metadata, extraProfileData = null) {
        try {
            console.log(`[Auth] Tentando cadastro administrativo para: ${email}`);
            
            // Usando a lib original guardada no supabase-config.js
            const lib = window.supabaseLib || window.supabase;
            const tempClient = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            });

            const { data, error: signUpError } = await tempClient.auth.signUp({
                email,
                password,
                options: {
                    data: metadata,
                    emailRedirectTo: window.location.origin
                }
            });

            if (signUpError) throw signUpError;

            // If we have extra data and a user was created, update the profile using the new user's session
            if (data.user && extraProfileData) {
                const { error: updateError } = await tempClient
                    .from('profiles')
                    .update(extraProfileData)
                    .eq('id', data.user.id);
                
                if (updateError) {
                    console.warn('[Auth] Erro ao atualizar dados extras do perfil (administrativo):', updateError.message);
                }
            }

            return { 
                success: true, 
                user: data.user,
                requireConfirmation: !data.session 
            };
        } catch (error) {
            console.error('[Auth] Erro Cadastro Adm:', error.message);
            return { success: false, message: this.translateAuthError(error) };
        }
    }

    async logout() {
        await window.supabase.auth.signOut();
        // O listener handleSignOut cuidará da limpeza
    }

    translateAuthError(error) {
        const msg = error.message;
        if (msg.includes('Invalid login credentials')) return 'Email ou senha incorretos.';
        if (msg.includes('Email not confirmed')) return 'Verifique seu email antes de entrar.';
        if (msg.includes('User already registered')) return 'Email já cadastrado.';
        if (msg.includes('Password should be')) return 'A senha deve ter caracteres, letras e números.';
        return 'Erro na autenticação. Verifique os dados.';
    }

    isAuthenticated() {
        const authed = this.currentUser !== null;
        console.log(`[Auth] Verificando isAuthenticated: ${authed}`, this.currentUser ? this.currentUser.email : 'null');
        return authed;
    }

    checkAuth() {
        return this.isAuthenticated();
    }

    requireAuth(type = null) {
        console.log(`[Auth] requireAuth(type=${type}) iniciado.`);
        if (!this.isAuthenticated()) {
            console.warn('[Auth] Acesso negado: não autenticado. Redirecionando para /');
            router.navigate('/');
            return false;
        }
        if (type && this.currentUser.role !== type && this.currentUser.type !== type) {
            // Redirecionar para o dashboard correto do usuário (não para home)
            const actualRole = this.currentUser.role || this.currentUser.type;
            const dashboardMap = {
                'admin': '/admin/dashboard',
                'personal': '/personal/dashboard',
                'student': '/student/dashboard'
            };
            console.warn(`[Auth] Acesso negado: precisa de '${type}', tem '${actualRole}'. Redirecionando...`);
            router.navigate(dashboardMap[actualRole] || '/');
            return false;
        }

        // T-FIT Mensalidade Adimplência Check
        if (type === 'personal' || type === 'admin') {
            if (this.currentUser.plano_ativo === false && this.currentUser.bloqueado_por_inadimplencia === true) {
                // If the user has a trial, we should skip blocking.
                if (this.currentUser.trial_used === true || !this.currentUser.trial_started_at) {
                    // Force the blockage screen
                    if (window.location.hash !== '#/payment/blocked') {
                        router.navigate('/payment/blocked');
                    }
                    return false;
                }
            }
        }

        return true;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async refreshUser() {
        if (!this.currentUser) return;
        console.log('[Auth] Atualizando dados do usuário...');

        try {
            const query = window.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            const { data, error } = await Promise.race([
                query,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh Timeout')), 4000))
            ]);

            if (data) {
                this.currentUser = { ...data, type: data.role };
                this.saveSession(this.currentUser);
                console.log('[Auth] Usuário atualizado com sucesso.');
            } else if (error) {
                console.warn('[Auth] Erro ao atualizar usuário:', error.message);
            }
        } catch (err) {
            console.warn('[Auth] Erro ou Timeout no refresh:', err.message);
        }
    }

    async checkEmailRole(email) {
        try {
            const { data, error } = await window.supabase
                .from('profiles')
                .select('role')
                .eq('email', email)
                .maybeSingle();

            if (error) {
                console.warn('[Auth] Erro ao verificar role por email:', error.message);
                return null;
            }

            return data ? data.role : null;
        } catch (err) {
            console.error('[Auth] Exceção ao verificar role:', err);
            return null;
        }
    }

    async updateProfileDirect(userId, data) {
        try {
            const { error } = await window.supabase
                .from('profiles')
                .update(data)
                .eq('id', userId);

            if (error) throw error;
            
            // Sync with current user if it's the same
            if (this.currentUser && this.currentUser.id === userId) {
                this.currentUser = { ...this.currentUser, ...data };
                this.saveSession(this.currentUser);
            }
            return true;
        } catch (err) {
            console.error('[Auth] Erro ao atualizar perfil:', err);
            return false;
        }
    }
}
