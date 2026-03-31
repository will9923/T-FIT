// ============================================
// T-FIT - SUPABASE VERSION (v7.0)
// ============================================
const APP_VERSION = '7.0';

// ============================================
// DATABASE MANAGER (Supabase)
// ============================================
class Database {
    constructor() {
        this.cache = {};
        this.collections = [
            'profiles', 'workouts', 'diets', 'assessments',
            'plans', 'payments', 'contracts',
            'posts', 'stories', 'conversations', 'messages', 'comments', 'notifications',
            'exercise_videos', 'ads', 'tfit_recompensas', 'tfit_missoes', 'tfit_missoes_usuario', 'app_convites', 'tfit_resgates'
        ];
        this.dataLoaded = false;
        this.subscriptions = {}; // Supabase realtime subscriptions

        // LocalStorage helpers
        this.get = (key) => {
            const data = localStorage.getItem(`tfit_${key}`);
            return data ? JSON.parse(data) : null;
        };
        this.set = (key, value) => {
            localStorage.setItem(`tfit_${key}`, JSON.stringify(value));
        };
        this.remove = (key) => {
            localStorage.removeItem(`tfit_${key}`);
        };
    }

    async init() {
        console.log("🚀 Inicializando Database (Supabase)...");

        if (!window.supabase) {
            console.error("❌ Supabase não inicializado!");
            alert("Erro: Supabase não está configurado. Verifique supabase-config.js");
            return;
        }

        // Load data from localStorage first (instant)
        this.loadFromLocalStorage();

        // Then fetch fresh data from Supabase
        try {
            await Promise.all(this.collections.map(col => this.fetchCollection(col)));

            // Setup realtime listeners for live updates
            this.setupRealtimeListeners();

            this.dataLoaded = true;
            console.log("✅ Todos os dados carregados do Supabase!");

        } catch (error) {
            console.error("❌ Erro ao carregar dados:", error);
        }
    }

    async fetchCollection(collectionName) {
        try {
            console.log(`[${collectionName}] Carregando do Supabase...`);

            const { data, error } = await window.supabase
                .from(collectionName)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error(`Erro ao carregar ${collectionName}:`, error.message);
                return;
            }

            this.cache[collectionName] = data || [];
            this.persistToLocal(collectionName);

            console.log(`[${collectionName}] ✅ ${data?.length || 0} registros carregados`);

        } catch (err) {
            console.error(`Erro fatal ao carregar ${collectionName}:`, err);
        }
    }

    setupRealtimeListeners() {
        console.log("🔴 Configurando Supabase Realtime...");

        this.collections.forEach(col => {
            const channel = window.supabase
                .channel(`public:${col}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: col },
                    (payload) => {
                        console.log(`[Realtime] ${col}:`, payload.eventType);
                        this.handleRealtimeChange(col, payload);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log(`✅ Realtime ativo: ${col}`);
                    }
                });

            this.subscriptions[col] = channel;
        });
    }

    handleRealtimeChange(collection, payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        switch (eventType) {
            case 'INSERT':
                this.cache[collection].push(newRecord);
                break;
            case 'UPDATE':
                const updateIndex = this.cache[collection].findIndex(item => item.id === newRecord.id);
                if (updateIndex !== -1) {
                    this.cache[collection][updateIndex] = newRecord;
                }
                break;
            case 'DELETE':
                this.cache[collection] = this.cache[collection].filter(item => item.id !== oldRecord.id);
                break;
        }

        this.persistToLocal(collection);

        // Refresh UI
        if (window.router) {
            window.router.refresh();
        }
    }

    loadFromLocalStorage() {
        this.collections.forEach(col => {
            const data = localStorage.getItem(`tfit_${col}`);
            this.cache[col] = data ? JSON.parse(data) : [];
        });
    }

    persistToLocal(collection) {
        try {
            localStorage.setItem(`tfit_${collection}`, JSON.stringify(this.cache[collection]));
        } catch (error) {
            console.warn(`LocalStorage error for ${collection}:`, error.message);
        }
    }

    // CRUD Operations
    _getCollectionName(col) {
        if (['students', 'personals', 'personais', 'admins'].includes(col)) return 'profiles';
        return col;
    }

    getAll(collection) {
        const col = this._getCollectionName(collection);
        return Array.isArray(this.cache[col]) ? this.cache[col] : [];
    }

    getById(collection, id) {
        const col = this._getCollectionName(collection);
        if (!this.cache[col]) return null;
        return this.cache[col].find(item => item && item.id == id) || null;
    }

    async create(collection, data) {
        try {
            const mappedCol = this._getCollectionName(collection);
            const newData = { ...data, created_at: new Date().toISOString() };
            
            // Only delete id if it's not provided or is a temporary one
            if (!newData.id || typeof newData.id === 'string' && newData.id.startsWith('temp_')) {
                delete newData.id;
            }

            const { data: inserted, error } = await window.supabase
                .from(mappedCol)
                .insert([newData])
                .select()
                .single();

            if (error) throw error;

            // Update local cache
            if (this.cache[mappedCol]) {
                this.cache[mappedCol].unshift(inserted);
                this.persistToLocal(mappedCol);
            }

            console.log(`[${collection}] ✅ Criado:`, inserted.id);
            return inserted;

        } catch (error) {
            console.error(`Erro ao criar em ${collection}:`, error);
            UI.showNotification('Erro', 'Não foi possível salvar. Verifique sua conexão.', 'error');
            throw error;
        }
    }

    async update(collection, id, data) {
        try {
            const mappedCol = this._getCollectionName(collection);
            const updateData = { ...data, updated_at: new Date().toISOString() };

            const { error } = await window.supabase
                .from(mappedCol)
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            // Update local cache
            if (this.cache[mappedCol]) {
                const index = this.cache[mappedCol].findIndex(item => item.id == id);
                if (index !== -1) {
                    this.cache[mappedCol][index] = { ...this.cache[mappedCol][index], ...updateData };
                    this.persistToLocal(mappedCol);
                }
            }

            console.log(`[${collection}] ✅ Atualizado:`, id);
            return true;

        } catch (error) {
            console.error(`Erro ao atualizar ${collection}:`, error);
            UI.showNotification('Erro', 'Não foi possível atualizar.', 'error');
            return false;
        }
    }

    async delete(collection, id) {
        try {
            const mappedCol = this._getCollectionName(collection);
            const { error } = await window.supabase
                .from(mappedCol)
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Update local cache
            if (this.cache[mappedCol]) {
                this.cache[mappedCol] = this.cache[mappedCol].filter(item => item.id != id);
                this.persistToLocal(mappedCol);
            }

            console.log(`[${collection}] ✅ Deletado:`, id);
            return true;

        } catch (error) {
            console.error(`Erro ao deletar ${collection}:`, error);
            UI.showNotification('Erro', 'Não foi possível deletar.', 'error');
            return false;
        }
    }

    query(collection, filterFn) {
        const items = this.getAll(collection);
        return items.filter(filterFn);
    }

    insert(collection, data) {
        return this.create(collection, data);
    }
}

// ============================================
// AUTH MANAGER (Modo DEMO - Sem autenticação)
// ============================================
class AuthManager {
    constructor(db) {
        this.db = db;
        this.currentUser = this.loadSession();
    }

    loadSession() {
        return this.db.get('demo_session');
    }

    saveSession(user) {
        this.currentUser = user;
        this.db.set('demo_session', user);
    }

    clearSession() {
        this.currentUser = null;
        this.db.remove('demo_session');
    }

    // Login direto (modo demo)
    loginDirect(role) {
        console.log(`[Auth] Login direto como: ${role}`);

        // Buscar usuário demo do banco
        const profiles = this.db.getAll('profiles');
        let user;

        switch (role) {
            case 'admin':
                user = profiles.find(p => p.role === 'admin');
                break;
            case 'personal':
                user = profiles.find(p => p.role === 'personal');
                break;
            case 'student':
                user = profiles.find(p => p.role === 'student');
                break;
        }

        if (!user) {
            console.error(`Usuário ${role} não encontrado no banco!`);
            UI.showNotification('Erro', `Usuário ${role} não existe. Execute o script SQL primeiro.`, 'error');
            return { success: false };
        }

        // Salvar sessão
        user.type = role; // Compatibility
        this.saveSession(user);

        return { success: true, user };
    }

    logout() {
        this.clearSession();
        router.navigate('/');
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    requireAuth(type = null) {
        if (!this.isAuthenticated()) {
            router.navigate('/');
            return false;
        }
        if (type && this.currentUser.role !== type) {
            router.navigate('/');
            return false;
        }
        return true;
    }

    refreshUser() {
        if (!this.currentUser) return;
        const updated = this.db.getById('profiles', this.currentUser.id);
        if (updated) {
            this.saveSession({ ...updated, type: this.currentUser.role });
        }
    }
}

// ... (Router, UI, Pages permanecem iguais)
// Vou manter as classes Router e UI do app.js original
