// ============================================
// FITPRO - MAIN APPLICATION (v7.0 SUPABASE)
// ============================================
const APP_VERSION = '7.0';

// ============================================
// DATABASE MANAGER (Supabase)
// ============================================
class Database {
    constructor() {
        this.collections = [
            'profiles', 'plans', 'workouts', 'diets', 'assessments',
            'payments', 'contracts', 'posts', 'comments', 'stories',
            'conversations', 'messages', 'notifications', 'ads', 'exercise_videos',
            'workout_completions', 'media_assets', 'activity_logs',
            'planos_personal', 'alunos_planos', 'pagamentos', 'tfit_payments',
            'app_convites', 'tfit_recompensas', 'tfit_resgates', 'tfit_missoes', 'tfit_missoes_usuario',
            'recompensas', 'missoes', 'indicacoes', 'config_pontos'
        ];
        // Virtual mapping for collections that live in the same table
        this.virtualCollections = {
            'students': { table: 'profiles', filter: { role: 'student' } },
            'personals': { table: 'profiles', filter: { role: 'personal' } },
            'personais': { table: 'profiles', filter: { role: 'personal' } },
            'admins': { table: 'profiles', filter: { role: 'admin' } }
        };
        this.dataLoaded = false;
        this.subscriptions = {};
        this.cache = {};

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
        console.log("🚀 Inicializando Database (Modo Otimizado)...");
        this.loadFromLocalStorage();

        if (!window.supabase) {
            console.error("❌ Supabase não inicializado!");
            UI.updateConnectionStatus('error');
            return;
        }

        try {
            // 1. Fetch essencial: Profiles (para saber quem é o usuário e seu status)
            // Carregamos isso primeiro pois é crítico para o roteamento e permissões
            UI.showLoading('Sincronizando perfil...');
            await this.fetchCollection('profiles');

            this.setupRealtimeListeners();
            this.dataLoaded = true;
            UI.updateConnectionStatus('online');

            // 2. Carregamento em Background das outras coleções secundárias
            // Isso não bloqueia a UI, o app já pode ser usado com os dados do LocalStorage
            this.backgroundSync();

            console.log("✅ Database inicializado (Perfil pronto, outros sincronizando em background)");
        } catch (error) {
            console.error("❌ Erro na inicialização do DB:", error);
            UI.updateConnectionStatus('error');
        }
    }

    async backgroundSync() {
        const secondaryCollections = [
            'plans', 'workouts', 'diets', 'payments', 'contracts',
            'notifications', 'exercise_videos', 'workout_completions',
            'planos_personal', 'alunos_planos', 'pagamentos'
        ];

        for (const col of secondaryCollections) {
            // Pequeno delay entre coleções para não sobrecarregar a rede/CPU de uma vez
            await new Promise(r => setTimeout(r, 500));
            this.fetchCollection(col).catch(err => console.warn(`[Sync] Falha silenciosa em ${col}`));
        }

        // Coleções pesadas (Social/Feed) só carregamos sob demanda no T-Feed
    }

    async fetchCollection(collectionName) {
        try {
            // Se não houver internet, usa o que está no cache local
            if (!navigator.onLine) return;

            // Para coleções grandes, limitamos o fetch inicial
            let query = window.supabase.from(collectionName).select('*');

            if (['posts', 'messages', 'activity_logs'].includes(collectionName)) {
                query = query.order('created_at', { ascending: false }).limit(50);
            } else if (collectionName === 'workout_completions') {
                query = query.order('completed_at', { ascending: false }).limit(50);
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                console.warn(`[${collectionName}] ${error.message}`);
                return;
            }

            this.cache[collectionName] = data || [];
            if (collectionName === 'profiles') {
                this._syncVirtualCollections(data);
            }
            this.persistToLocal(collectionName);

            // Trigger UI refresh after data arrives
            if (window.router && window.router.refresh) {
                window.router.refresh();
            }
        } catch (err) {
            console.error(`Erro ao carregar ${collectionName}:`, err);
        }
    }

    setupRealtimeListeners() {
        // Só inscrevemos se ainda não houver sub ativa
        this.collections.forEach(col => {
            if (this.subscriptions[col]) return;

            const channel = window.supabase
                .channel(`public:${col}`)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: col },
                    (payload) => this.handleRealtimeChange(col, payload)
                )
                .subscribe();
            this.subscriptions[col] = channel;
        });
    }

    handleRealtimeChange(collection, payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        switch (eventType) {
            case 'INSERT':
                const exists = this.cache[collection].some(item => item.id === newRecord.id);
                if (!exists) {
                    this.cache[collection].unshift(newRecord);
                }
                break;
            case 'UPDATE':
                const updateIndex = this.cache[collection].findIndex(item => item.id === newRecord.id);
                if (updateIndex !== -1) this.cache[collection][updateIndex] = newRecord;
                break;
            case 'DELETE':
                this.cache[collection] = this.cache[collection].filter(item => item.id !== oldRecord.id);
                break;
        }

        // If 'profiles' changed, re-sync virtual collections
        if (collection === 'profiles') {
            this._syncVirtualCollections(this.cache['profiles']);

            // CRITICAL: If the updated profile is the current user, refresh the auth session!
            if (newRecord && newRecord.id === auth.getCurrentUser()?.id) {
                console.log("[Sync] Perfil do usuário atualizado! Sincronizando sessão...");
                auth.refreshUser();
            }
        }

        // AUTO-ACTIVATION: If a new payment is approved for the current user, refresh the session
        if (collection === 'pagamentos' || collection === 'tfit_payments' || collection === 'alunos_planos') {
            if (newRecord && (newRecord.status === 'aprovado' || newRecord.status === 'approved' || newRecord.status === 'ativo')) {
                const currentUserId = auth.getCurrentUser()?.id;
                const isMyUpdate = newRecord.aluno_id === currentUserId || newRecord.user_id === currentUserId;

                if (isMyPayment) {
                    console.log(`[Sync] Novo pagamento "${collection}" aprovado! Forçando atualização de acesso...`);
                    auth.refreshUser();

                    // Optimization: If on the blocked page, navigate away after a short delay
                    if (window.location.hash.includes('blocked') || window.location.hash.includes('payments')) {
                        setTimeout(() => {
                            const access = PaymentHelper.checkStudentAccess(auth.getCurrentUser());
                            if (!access.blocked) {
                                const role = auth.getCurrentUser().role;
                                window.router.navigate(`/${role}/dashboard`);
                            }
                        }, 1000);
                    }
                }
            }
        }

        this.persistToLocal(collection);

        // OPTIMIZATION: Debounce refresh to handle bursts of events (like batch inserts)
        const skipRefresh = ['posts', 'likes', 'comments', 'messages', 'notifications', 'stories'];
        if (window.router && !skipRefresh.includes(collection)) {
            if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
            this._refreshTimeout = setTimeout(() => {
                window.router.refresh();
                this._refreshTimeout = null;
            }, 300); // 300ms window to group changes
        }
    }

    _syncVirtualCollections(profilesData) {
        if (!profilesData) return;
        Object.keys(this.virtualCollections).forEach(virtualCol => {
            const config = this.virtualCollections[virtualCol];
            this.cache[virtualCol] = profilesData.filter(p => p.role === config.filter.role);
            this.persistToLocal(virtualCol);
        });
    }

    loadFromLocalStorage() {
        // Load real collections
        this.collections.forEach(col => {
            const data = this.get(col);
            this.cache[col] = data || [];
        });
        // Load virtual collections
        Object.keys(this.virtualCollections).forEach(col => {
            const data = this.get(col);
            if (data) this.cache[col] = data;
        });
    }

    persistToLocal(collection) {
        if (!collection) return;
        // Throttle persistence to avoid freezing UI during bulk operations
        const now = Date.now();
        if (this._lastPersist && this._lastPersist[collection] && (now - this._lastPersist[collection] < 1000)) {
            if (this._persistTimeout && this._persistTimeout[collection]) return;
            this._persistTimeout = this._persistTimeout || {};
            this._persistTimeout[collection] = setTimeout(() => {
                this._lastPersist[collection] = Date.now();
                this._saveToLocalNow(collection);
                delete this._persistTimeout[collection];
            }, 1000);
            return;
        }
        this._lastPersist = this._lastPersist || {};
        this._lastPersist[collection] = now;
        this._saveToLocalNow(collection);
    }

    _saveToLocalNow(collection) {
        try {
            const data = this.cache[collection];
            if (data) {
                // If the data is too large, we might need a slice or just handle the error
                this.set(collection, data);
            }
        } catch (error) {
            console.warn(`LocalStorage backup failed for ${collection} (likely full or quota exceeded)`);
        }
    }

    cleanUpLocalCache() {
        // Placeholder for compatibility
    }

    // CRUD Operations
    _getTable(collection) {
        if (this.virtualCollections[collection]) return this.virtualCollections[collection].table;
        return collection;
    }

    getAll(collection) {
        const table = this._getTable(collection);
        if (this.virtualCollections[collection]) {
            return this.cache[collection] || [];
        }
        return Array.isArray(this.cache[table]) ? this.cache[table] : [];
    }

    getById(collection, id) {
        if (!id) return null;
        const table = this._getTable(collection);
        const cache = this.virtualCollections[collection] ? this.cache[collection] : this.cache[table];
        if (!cache || !Array.isArray(cache)) return null;

        // Robust matching (string to string)
        const searchId = String(id).toLowerCase();
        return cache.find(item => item && item.id && String(item.id).toLowerCase() === searchId) || null;
    }

    async create(collection, data, options = {}) {
        try {
            const virtual = this.virtualCollections[collection];
            const targetTable = virtual ? virtual.table : collection;

            let cleanData = this._prepareDataForSupabase(data, 'create', collection);

            if (virtual) {
                const roleValue = virtual.filter.role;
                cleanData.role = roleValue;
                cleanData.user_type = roleValue;
            }

            const { data: inserted, error } = await window.supabase
                .from(targetTable)
                .insert([cleanData])
                .select()
                .single();

            if (error) {
                console.error(`[DB] Supabase create error in ${targetTable}:`, error);
                throw error;
            }

            if (!this.cache[targetTable]) this.cache[targetTable] = [];
            const exists = this.cache[targetTable].some(item => item.id === inserted.id);
            if (!exists) {
                this.cache[targetTable].unshift(inserted);
                this.persistToLocal(targetTable);
            }

            if (virtual) this._syncVirtualCollections(this.cache['profiles']);

            if (!options.silent) {
                console.log(`[${collection}] ✅ Criado:`, inserted.id);
                if (window.router && !options.noRefresh) window.router.refresh();
            }
            return inserted;
        } catch (error) {
            console.error(`Erro ao criar em ${collection}:`, error);
            if (!options.silent) {
                UI.showNotification('Erro de Salvamento', error.message || 'Falha ao salvar no banco.', 'error');
            }
            throw error;
        }
    }

    async createMany(collection, items, options = {}) {
        if (!items || items.length === 0) return [];
        try {
            const virtual = this.virtualCollections[collection];
            const targetTable = virtual ? virtual.table : collection;

            const cleanItems = items.map(item => {
                let clean = this._prepareDataForSupabase(item, 'create', collection);
                if (virtual) {
                    clean.role = virtual.filter.role;
                    clean.user_type = virtual.filter.role;
                }
                return clean;
            });

            console.log(`[DB] Creating ${items.length} items in ${targetTable}...`);
            const { data: insertedList, error } = await window.supabase
                .from(targetTable)
                .insert(cleanItems)
                .select();

            if (error) throw error;

            if (!this.cache[targetTable]) this.cache[targetTable] = [];
            this.cache[targetTable] = [...(insertedList || []), ...this.cache[targetTable]];
            this.persistToLocal(targetTable);

            if (virtual) this._syncVirtualCollections(this.cache['profiles']);

            if (!options.silent) {
                console.log(`[${collection}] ✅ ${items.length} itens criados.`);
                if (window.router && !options.noRefresh) window.router.refresh();
            }
            return insertedList;
        } catch (error) {
            console.error(`Erro ao criar vários em ${collection}:`, error);
            throw error;
        }
    }

    async update(collection, id, data, options = {}) {
        try {
            const virtual = this.virtualCollections[collection];
            const targetTable = virtual ? virtual.table : collection;

            const updateData = this._prepareDataForSupabase(data, 'update', collection);

            const { error } = await window.supabase
                .from(targetTable)
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            const cache = this.cache[targetTable];
            if (cache) {
                const index = cache.findIndex(item => item.id == id);
                if (index !== -1) {
                    cache[index] = { ...cache[index], ...updateData };
                    this.persistToLocal(targetTable);
                }
            }

            if (virtual) this._syncVirtualCollections(this.cache['profiles']);

            if (!options.silent) {
                console.log(`[${collection}] ✅ Atualizado:`, id);
                if (window.router && !options.noRefresh) window.router.refresh();
            }
            return true;
        } catch (error) {
            console.error(`Erro ao atualizar ${collection}:`, error);
            if (!options.silent) UI.showNotification('Erro', 'Não foi possível atualizar.', 'error');
            return false;
        }
    }

    async delete(collection, id, options = {}) {
        try {
            const virtual = this.virtualCollections[collection];
            const targetTable = virtual ? virtual.table : collection;

            const { error } = await window.supabase
                .from(targetTable)
                .delete()
                .eq('id', id);

            if (error) throw error;

            if (this.cache[targetTable]) {
                this.cache[targetTable] = this.cache[targetTable].filter(item => item.id != id);
                this.persistToLocal(targetTable);
            }

            if (virtual) this._syncVirtualCollections(this.cache['profiles']);

            if (!options.silent) {
                console.log(`[${collection}] ✅ Deletado:`, id);
                if (window.router && !options.noRefresh) window.router.refresh();
            }
            return true;
        } catch (error) {
            console.error(`Erro ao deletar ${collection}:`, error);
            if (!options.silent) UI.showNotification('Erro', 'Não foi possível deletar.', 'error');
            return false;
        }
    }

    _prepareDataForSupabase(data, mode = 'create', collection = null) {
        const clean = {};
        const mapping = {
            // Perfil / Usuário
            'photoUrl': 'photo_url',
            'planId': 'plan_id',
            'planExpiry': 'plan_expiry',
            'billingCycle': 'billing_cycle',
            'durationDays': 'duration_days',
            'targetAudience': 'target_audience',
            'tempAccess': 'temp_access',
            'trialUsed': 'trial_used',
            'aiActive': 'ai_active',
            'birthDate': 'birth_date',
            'assignedPersonalId': 'assigned_personal_id',
            'personalId': (['payments', 'workouts', 'diets', 'assessments', 'contracts', 'planos_personal', 'alunos_planos', 'pagamentos'].includes(collection)) ? 'personal_id' : 'assigned_personal_id',
            'personal_id': (['payments', 'workouts', 'diets', 'assessments', 'contracts', 'planos_personal', 'alunos_planos', 'pagamentos'].includes(collection)) ? 'personal_id' : 'assigned_personal_id',
            'instagramPass': 'instagram_pass',
            'pixKey': 'pix_key',
            'personal_payment_link': 'personal_payment_link',
            'personalPaymentLink': 'personal_payment_link',
            'mpMonthlyLink': 'mp_monthly_link',
            'mpSubscriptionLink': 'mp_subscription_link',
            'duracaoMeses': 'duracao_meses',
            'duracaoDias': 'duracao_dias',

            // Social / Feed / Stories
            'userId': 'user_id',
            'userName': 'user_name',
            'userAvatar': 'user_avatar',
            'userType': 'user_type',
            'isVerified': 'is_verified',
            'mediaUrl': 'media_url',
            'workoutStats': 'workout_stats',
            'likedBy': 'liked_by',
            'viewedBy': 'viewed_by',
            'expiresAt': 'expires_at',
            'postId': 'post_id',
            'senderId': 'sender_id',
            'fromId': 'from_id',
            'fromName': 'from_name',
            'fromAvatar': 'from_avatar',
            'conversationId': 'conversation_id',
            'lastMessage': 'last_message',
            'lastMessageAt': 'last_message_at',
            'readBy': 'read_by',
            'isRepost': 'is_repost',
            'originalAuthor': 'original_author',
            'isPersonal': 'is_personal',
            'commentsList': 'comments_list',
            'proofUrl': 'proof_url',
            'proof_url': 'proof_url',

            // Exercícios
            'exerciseName': 'exercise_name',
            'youtubeUrl': 'youtube_url',
            'mediaType': 'media_type',
            'photoFront': 'photo_front',
            'photoSideRight': 'photo_side_right',
            'photoSideLeft': 'photo_side_left',

            // Workouts
            'studentId': 'student_id',
            'workoutId': 'workout_id',
            'workoutName': 'workout_name',
            'completedAt': 'completed_at',

            // Atividade
            'steps': 'steps',
            'calories': 'calories',
            'protein': 'protein',
            'carbs': 'carbs',
            'fat': 'fat',
            'water': 'water',
            'visualEvaluation': 'visual_evaluation',
            'rationale': 'rationale',

            // Outros
            'muscleGroups': 'muscle_groups',
            'createdAt': 'created_at',
            'updatedAt': 'updated_at',
            'studentName': 'student_name',
            'personalName': 'personal_name',
            'maxStudents': 'max_students',

            // Métricas Físicas / Aluno (v8.5)
            'weight': 'weight',
            'height': 'height',
            'age': 'age',
            'goal': 'goal',
            'level': 'level',
            'sleep': 'sleep',
            'stress': 'stress',
            'injuries': 'injuries',
            'healthConditions': 'health_conditions',
            'location': 'location',
            'equipment': 'equipment',
            'date': 'created_at',
            'bodyFat': 'body_fat_percentage',
            'bf': 'body_fat_percentage',
            'aiAnalysis': 'ai_analysis',
            'recommendations': 'recommendations',
            'strengths': 'strengths',
            'improvements': 'improvements',
            'isAiGenerated': 'is_ai_generated',

            // Proteção contra CamelCase da IA (Legado)
            'visualEvaluation': 'visual_evaluation',
            'rationaleText': 'rationale'
        };

        // UUID Regex check
        const isUUID = (str) => {
            if (typeof str !== 'string') return false;
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return regex.test(str);
        };

        Object.keys(data).forEach(key => {
            // Skip purely frontend/auth fields that don't belong in the profile table
            if (key === 'password' || key === 'confirmPassword') return;

            const dbKey = mapping[key] || key;

            // Special handling for 'id': if it's a fake frontend ID (e.g. 'post_123'), remove it.
            // Let the database gen_random_uuid() handle it instead.
            // 1. Skip temporary/fake IDs (except for media_assets which uses name-based IDs)
            if (dbKey === 'id' && !isUUID(data[key]) && collection !== 'media_assets') {
                return;
            }

            // 2. DEFENSIVE: 'SYSTEM' is a legacy indicator for AI, but DB expects UUID or NULL
            if (data[key] === 'SYSTEM' && (dbKey.includes('_id') || dbKey === 'assigned_personal_id')) {
                clean[dbKey] = null;
                return;
            }

            // 3. STRICT SCHEMA PROTECTION: If it's a diet or workout and it's not in our mapping OR it's a known illegal key, skip it
            if (collection === 'diets' || collection === 'workouts' || collection === 'assessments') {
                const knownIllegal = ['visualEvaluation', 'mealCount', 'goalText', 'specificGoal', 'focusText', 'volumeText'];
                if (knownIllegal.includes(key)) {
                    clean['visual_evaluation'] = clean['visual_evaluation'] || data[key]; // Map to snake_case if possible
                    return;
                }
            }

            // 4. DEFENSIVE: Handle potential NaN from parseFloat/parseInt
            if (typeof data[key] === 'number' && isNaN(data[key])) {
                clean[dbKey] = null;
                return;
            }

            clean[dbKey] = data[key];
        });

        // Let Database handle created_at via DEFAULT NOW()
        // On updates, explicitly remove created_at to avoid trying to update a protected column
        if (mode === 'update') {
            delete clean.created_at;
            delete clean.completed_at;
        }

        return clean;
    }

    query(collection, filterFn) {
        return this.getAll(collection).filter(filterFn);
    }

    insert(collection, data) {
        return this.create(collection, data);
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
} // AuthManagerOld removido



// ============================================
// ROUTER
// ============================================
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.currentParams = {};

        // Handle hardware back button / browser back
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.path) {
                this.navigate(event.state.path, event.state.params, true);
            }
        });

        // Swipe to back logic
        this.setupSwipeBack();
    }

    addRoute(path, handler) {
        this.routes[path] = handler;
    }

    async navigate(pathWithQuery, params = {}, fromPopState = false) {
        console.log(`[Router] Navegando para: ${pathWithQuery}`, params);

        // Remove Hub Back Button if navigating back to a main page
        const hubBackBtn = document.getElementById('hub-back-btn');
        if (hubBackBtn && (pathWithQuery.includes('dashboard') || pathWithQuery.includes('subscription') || pathWithQuery === '/')) {
            if (hubBackBtn.parentNode) hubBackBtn.remove();
        }

        let path = pathWithQuery;
        if (pathWithQuery.includes('?')) {
            const parts = pathWithQuery.split('?');
            path = parts[0];
            const searchParams = new URLSearchParams(parts[1]);
            searchParams.forEach((value, k) => {
                params[k] = value;
            });
        }

        // Auto-close mobile menu if open
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('open');
        }

        this.currentRoute = path;
        this.currentParams = params;

        if (!fromPopState) {
            window.history.pushState({ path: pathWithQuery, params }, '', '#' + pathWithQuery);
        }

        let handler = this.routes[path];
        let matchedParams = { ...params };

        // Dynamic Route Matching (:id)
        if (!handler) {
            console.log(`[Router] Rota exata não encontrada: ${path}. Tentando matching dinâmico...`);
            for (const route in this.routes) {
                if (route.includes(':')) {
                    const routeParts = route.split('/');
                    const pathParts = path.split('/');
                    if (routeParts.length === pathParts.length) {
                        let match = true;
                        let tempParams = {};
                        for (let i = 0; i < routeParts.length; i++) {
                            if (routeParts[i].startsWith(':')) {
                                tempParams[routeParts[i].substring(1)] = pathParts[i];
                            } else if (routeParts[i] !== pathParts[i]) {
                                match = false;
                                break;
                            }
                        }
                        if (match) {
                            handler = this.routes[route];
                            matchedParams = { ...matchedParams, ...tempParams };
                            console.log(`[Router] Match dinâmico encontrado: ${route}`);
                            break;
                        }
                    }
                }
            }
        }

        if (handler) {
            try {
                console.log(`[Router] Executando handler para: ${path}`);
                await handler(matchedParams);
                window.scrollTo(0, 0);
            } catch (error) {
                console.error(`[Router] ERRO CRÍTICO no handler de ${path}:`, error);
                UI.showNotification('Erro de Interface', 'Ocorreu um erro ao carregar esta página.', 'error');

                // Rollback URL if needed or show emergency button
                const emergency = document.getElementById('emergency-enter-container');
                if (emergency) emergency.classList.remove('hidden');
            }
        } else {
            console.error(`[Router] ROTA NÃO ENCONTRADA: ${path}`);
            console.log("[Router] Rotas registradas:", Object.keys(this.routes));
            UI.showNotification('Página não encontrada', `A rota ${path} não foi definida.`, 'warning');
        }
    }

    async refresh() {
        if (this.currentRoute) {
            const handler = this.routes[this.currentRoute];
            if (handler) {
                console.log(`Refreshing view: ${this.currentRoute}`);
                await handler(this.currentParams);
            }
        }
    }

    back() {
        window.history.back();
    }

    setupSwipeBack() {
        let touchStartX = 0;
        let touchStartY = 0;

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 0) return;

            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;

            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;

            // Trigger back if: 
            // 1. Swiped right (dx > 80 pixels)
            // 2. Mostly horizontal (slope < 0.5)
            // 3. Start was in the left 15% of the screen (Edge Swipe)
            const edgeThreshold = Math.min(window.innerWidth * 0.15, 60);

            if (dx > 80 && Math.abs(dy) < Math.abs(dx) * 0.5 && touchStartX < edgeThreshold) {
                console.log("[Router] Swipe-back detected");

                // Priority A: Close Direct Messaging (DM)
                const dmOverlay = document.getElementById('dm-overlay');
                if (dmOverlay && dmOverlay.classList.contains('open')) {
                    if (window.tfeed && typeof window.tfeed.closeDm === 'function') {
                        window.tfeed.closeDm();
                        return;
                    }
                }

                // Priority B: Close Story Viewer
                const storyOverlay = document.getElementById('manual-story-overlay');
                if (storyOverlay) {
                    if (window.tfeed && typeof window.tfeed.closeStoryViewer === 'function') {
                        window.tfeed.closeStoryViewer();
                        return;
                    }
                }

                // Priority C: Close Standard Modals
                const modal = document.querySelector('.modal-overlay');
                if (modal) {
                    UI.closeModal();
                    return;
                }

                // Default: Navigate back in history
                this.back();
            }
        }, { passive: true });
    }
}

// ============================================
// UI UTILITIES
// ============================================
class UI {
    static compressImage(base64, maxWidth = 300, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        });
    }

    static copyToClipboard(text) {
        if (!navigator.clipboard) {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                UI.showNotification('Sucesso', 'Copiado para a área de transferência!', 'success');
            } catch (err) {
                console.error('Erro ao copiar:', err);
                UI.showNotification('Erro', 'Não foi possível copiar automaticamente.', 'error');
            }
            document.body.removeChild(textArea);
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            UI.showNotification('Sucesso', 'Copiado para a área de transferência!', 'success');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            UI.showNotification('Erro', 'Não foi possível copiar automaticamente.', 'error');
        });
    }

    static showNotification(title, message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;
        container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    static showLoading(message = 'Carregando...') {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;

        // Cancel any pending fade-out from a previous hideLoading call
        if (window._hideLoadingTimeout) {
            clearTimeout(window._hideLoadingTimeout);
            window._hideLoadingTimeout = null;
        }

        overlay.classList.remove('fade-out');
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');

        // For in-app loading (after initial boot), hide video and show spinner fallback
        const video = document.getElementById('splash-video');
        const fallback = document.getElementById('splash-fallback');
        if (video && video.paused && !video.src) {
            // Video was already cleaned up (initial boot finished) - show spinner
            video.style.display = 'none';
            if (fallback) fallback.style.display = 'block';
        }

        const textElement = document.getElementById('loading-text');
        if (textElement) {
            textElement.innerText = message;
        }

        // --- Loading Phrases Rotation ---
        const phrases = [
            "IA T-FIT analisando seu perfil...",
            "Selecionando os melhores exercícios...",
            "Ajustando sua carga...",
            "Calculando o seu volume de treino...",
            "Preparando o seu plano de elite...",
            "Quase lá! Finalizando os detalhes...",
            "Otimizando sua rotina..."
        ];

        let index = 0;
        if (window.loadingInterval) clearInterval(window.loadingInterval);

        window.loadingInterval = setInterval(() => {
            if (overlay.classList.contains('hidden')) {
                clearInterval(window.loadingInterval);
                return;
            }
            index = (index + 1) % phrases.length;
            if (textElement) {
                textElement.style.opacity = '0';
                setTimeout(() => {
                    textElement.innerText = phrases[index];
                    textElement.style.opacity = '1';
                }, 300);
            }
        }, 3000);
    }

    static hideLoading() {
        const overlay = document.getElementById('loading-overlay');

        // Cancel any pending fade-out timer
        if (window._hideLoadingTimeout) {
            clearTimeout(window._hideLoadingTimeout);
            window._hideLoadingTimeout = null;
        }

        if (overlay) {
            // Check if splash video is still playing (initial boot)
            const video = document.getElementById('splash-video');
            const isInitialBoot = video && !video.paused && video.currentTime > 0;

            if (isInitialBoot) {
                // Smooth fade out for initial splash
                overlay.classList.add('fade-out');
                window._hideLoadingTimeout = setTimeout(() => {
                    overlay.classList.add('hidden');
                    overlay.classList.remove('fade-out');
                    // Stop and cleanup video
                    if (video) {
                        video.pause();
                        video.removeAttribute('src');
                        video.load();
                    }
                    window._hideLoadingTimeout = null;
                }, 600);
            } else {
                // Instant hide for in-app loading
                overlay.classList.add('hidden');
            }
        }
        if (window.loadingInterval) {
            clearInterval(window.loadingInterval);
            window.loadingInterval = null;
        }
    }

    static switchTab(tabId) {
        // Find the target tab content
        const target = document.getElementById(tabId);
        if (!target) {
            console.warn('[UI] Tab not found:', tabId);
            return;
        }

        // Find the parent container (form or modal) that holds all tab-content divs
        const parent = target.parentElement;
        if (!parent) return;

        // Hide all sibling tab-content divs
        const allTabs = parent.querySelectorAll('.tab-content');
        allTabs.forEach(tab => {
            tab.classList.add('hidden');
        });

        // Show the target tab
        target.classList.remove('hidden');

        // Update active state on tab buttons
        const tabsBar = parent.querySelector('.tabs');
        if (tabsBar) {
            tabsBar.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
                // Match button to tab by checking its onclick handler
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
                    btn.classList.add('active');
                }
            });
        }
    }

    static showModal(title, content, onSave = null, saveText = 'Salvar') {
        const modalContainer = document.getElementById('modal-container');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${onSave ? `
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button class="btn btn-primary" id="modal-save-btn">${saveText}</button>
                </div>
                ` : ''}
            </div>
        `;
        modalContainer.innerHTML = '';
        modalContainer.appendChild(modal);

        if (onSave) {
            const saveBtn = document.getElementById('modal-save-btn');
            saveBtn.addEventListener('click', async () => {
                // Prevent double clicks
                if (saveBtn.disabled) return;
                saveBtn.disabled = true;
                const originalText = saveBtn.innerText;
                saveBtn.innerText = 'Processando...';

                try {
                    const result = await onSave();
                    if (result !== false) {
                        modal.remove();
                    } else {
                        // Re-enable if validation failed
                        saveBtn.disabled = false;
                        saveBtn.innerText = originalText;
                    }
                } catch (err) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = originalText;
                    console.error("[Modal] Save error:", err);
                    UI.showNotification('Erro', err.message || 'Ocorreu um erro ao salvar.', 'error');
                }
            });
        }

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    static closeModal() {
        const container = document.getElementById('modal-container');
        container.innerHTML = '';
    }

    static showHelpModal() {
        const user = auth.getCurrentUser();
        const type = user.type || 'student';

        let helpHtml = '';
        if (type === 'personal') {
            helpHtml = `
                <div class="help-section">
                    <div class="mb-xl">
                        <h4 class="text-primary mb-sm">🚀 Sobre o T-FIT Personal</h4>
                        <p class="text-muted text-sm">O T-FIT é a ferramenta definitiva para você escalar sua consultoria. Nossa missão é automatizar a parte burocrática (treinos e dietas base) para que você foque no atendimento de elite.</p>
                    </div>

                    <div class="mb-xl">
                        <h4 class="text-primary mb-sm">💡 Como usar o App</h4>
                        <ul class="help-list">
                            <li><strong>Gestão de Alunos:</strong> Cadastre novos alunos e monitore o status de cada um (Ativo/Bloqueado).</li>
                            <li><strong>Gerador de IA:</strong> Use em "Treinos" ou "Dietas" para criar protocolos de elite em segundos.</li>
                            <li><strong>Financeiro:</strong> Controle faturas e receba notificações de pagamentos.</li>
                        </ul>
                    </div>

                    <div class="mb-xl">
                        <h4 class="text-primary mb-sm">💎 Seus Benefícios</h4>
                        <ul class="help-list">
                            <li>✅ <strong>Escalabilidade:</strong> Atenda 10x mais alunos no mesmo tempo.</li>
                            <li>✅ <strong>Profissionalismo:</strong> Entregue um app exclusivo com sua marca (Premium).</li>
                            <li>✅ <strong>Retenção:</strong> Alunos com dados e progresso no app renovam mais.</li>
                        </ul>
                    </div>
                </div>
            `;
        } else {
            helpHtml = `
                <div class="help-section">
                    <div class="mb-xl">
                        <h4 class="text-primary mb-sm">🔥 Bem-vindo à sua Evolução</h4>
                        <p class="text-muted text-sm">O T-FIT é seu ecossistema de alta performance. Aqui você tem tudo o que precisa para transformar seu corpo com a ajuda da inteligência artificial mais avançada do mercado fitness.</p>
                    </div>

                    <div class="mb-xl">
                        <h4 class="text-primary mb-sm">🛠️ Passo a Passo</h4>
                        <ul class="help-list">
                            <li><strong>Seu Treino:</strong> Acesse "Treinos" para ver o que fazer hoje. Use o Gerador 🤖 para treinos novos.</li>
                            <li><strong>Sua Dieta:</strong> Em "Dieta", a IA calcula seus macros e sugere refeições precisas.</li>
                            <li><strong>Seu Progresso:</strong> Registre seus treinos e peso para ver sua evolução em gráficos reais.</li>
                        </ul>
                    </div>

                    <div class="mb-xl">
                        <h4 class="text-primary mb-sm">🌟 Por que o T-FIT?</h4>
                        <ul class="help-list">
                            <li>✅ <strong>Precisão:</strong> Planos calculados cientificamente para você.</li>
                            <li>✅ <strong>Praticidade:</strong> Tudo na palma da mão, onde quer que você esteja.</li>
                            <li>✅ <strong>Motivação:</strong> Acompanhe cada pequena vitória no seu progresso.</li>
                        </ul>
                    </div>
                </div>
            `;
        }

        const modalContent = `
            <div class="p-sm">
                ${helpHtml}
                
                <div class="support-box mt-xl p-md rounded bg-light text-center" style="border: 1px dashed var(--primary);">
                    <p class="mb-md font-weight-bold">Não encontrou o que precisava?</p>
                    <button class="btn btn-primary btn-block" onclick="window.open('https://wa.me/5511911917087?text=Suporte%20T-FIT', '_blank')">
                        💬 Falar com Suporte (WhatsApp)
                    </button>
                </div>
                
                <button class="btn btn-ghost btn-block mt-md" onclick="UI.closeModal()">Fechar</button>
            </div>
        `;

        UI.showModal('Central de Ajuda ❓', modalContent);
    }

    static showInstallGuide() {
        // Prevent showing on desktop if possible, or just show universally as requested
        // Detection logic could be added here Use userAgent

        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);

        let instructions = `
            <div class="text-center mb-lg">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📱</div>
                <h3>Instale o App</h3>
                <p class="text-muted">Tenha o T-FIT direto na sua tela inicial!</p>
            </div>
        `;

        if (isIOS) {
            instructions += `
                <div class="bg-light p-md rounded text-left mb-md">
                    <p class="mb-sm font-weight-bold">Para iPhone (iOS):</p>
                    <ol class="pl-lg" style="margin-left: 1.2rem;">
                        <li class="mb-xs">Toque no botão <strong>Compartilhar</strong> <img src="https://cdn-icons-png.flaticon.com/512/1358/1358023.png" style="width:16px; display:inline;"> abaixo.</li>
                        <li class="mb-xs">Role para cima e toque em <strong>"Adicionar à Tela de Início"</strong>.</li>
                        <li>Confirme tocando em <strong>Adicionar</strong>.</li>
                    </ol>
                </div>
            `;
        } else if (isAndroid) {
            instructions += `
                <div class="bg-light p-md rounded text-left mb-md">
                    <p class="mb-sm font-weight-bold">Para Android:</p>
                    <ol class="pl-lg" style="margin-left: 1.2rem;">
                        <li class="mb-xs">Toque nos <strong>3 pontinhos</strong> (menu) do navegador.</li>
                        <li class="mb-xs">Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</li>
                        <li>Confirme a instalação.</li>
                    </ol>
                </div>
            `;
        } else {
            // Desktop or unknown
            instructions += `
                <div class="bg-light p-md rounded text-left mb-md">
                    <p class="text-center">Acesse as configurações do seu navegador e procure por <strong>"Instalar T-FIT"</strong> ou <strong>"Adicionar à Tela Inicial"</strong>.</p>
                </div>
            `;
        }

        instructions += `
            <button class="btn btn-primary btn-block mt-lg" onclick="UI.closeModal()">
                Entendi, vamos lá!
            </button>
        `;

        UI.showModal('Instalação', instructions);
    }


    static confirmDialog(title, message, onConfirm, confirmLabel = 'Confirmar', onConfirm2 = null, confirmLabel2 = null) {
        const modalContainer = document.getElementById('modal-container');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const footerContent = onConfirm2 ? `
            <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
            <div class="flex gap-sm">
                <button class="btn btn-secondary" id="confirm-btn-2">${confirmLabel2}</button>
                <button class="btn btn-primary" id="confirm-btn-1">${confirmLabel}</button>
            </div>
        ` : `
            <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
            <button class="btn btn-danger" id="confirm-btn-1">${confirmLabel}</button>
        `;

        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p style="white-space: pre-line;">${message}</p>
                </div>
                <div class="modal-footer flex justify-between">
                    ${footerContent}
                </div>
            </div>
        `;
        modalContainer.innerHTML = '';
        modalContainer.appendChild(modal);

        document.getElementById('confirm-btn-1').addEventListener('click', () => {
            onConfirm();
            modal.remove();
        });

        if (onConfirm2) {
            document.getElementById('confirm-btn-2').addEventListener('click', () => {
                onConfirm2();
                modal.remove();
            });
        }
    }

    static promptDialog(title, message, defaultValue = '', onConfirm) {
        const modalContainer = document.getElementById('modal-container');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p class="mb-md">${message}</p>
                    <input type="text" class="form-input" id="prompt-input" value="${defaultValue}">
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button class="btn btn-primary" id="prompt-confirm-btn">Confirmar</button>
                </div>
            </div>
        `;
        modalContainer.innerHTML = '';
        modalContainer.appendChild(modal);

        document.getElementById('prompt-confirm-btn').addEventListener('click', () => {
            const value = document.getElementById('prompt-input').value;
            onConfirm(value);
            modal.remove();
        });
    }

    static showProfileEditor() {
        const user = auth.getCurrentUser();
        const names = (user.name || 'Usuário').split(' ');
        const initials = names.map(n => n[0]).join('').toUpperCase().substring(0, 2);
        const avatarHtml = user.photo_url
            ? `<img src="${user.photo_url}" alt="Avatar">`
            : `<span>${initials}</span>`;

        // Load MP config if Personal or Admin
        const setupMP = async () => {
            if (user.type !== 'personal' && user.type !== 'admin') return;
            const config = await window.loadPaymentConfig(user.id);
            if (config) {
                const pkInput = document.getElementById('edit-mp-public-key');
                const atInput = document.getElementById('edit-mp-access-token');
                if (pkInput) pkInput.value = config.public_key || '';
                if (atInput) atInput.value = '********';
            }
        };

        const content = `
            <div class="profile-editor">
                <div class="profile-photo-container" onclick="document.getElementById('profile-photo-input').click()">
                    <div class="avatar-preview" id="profile-avatar-preview">
                        ${avatarHtml}
                    </div>
                    <div class="photo-edit-overlay">📸</div>
                    <input type="file" id="profile-photo-input" hidden accept="image/*">
                </div>
                <p class="text-center text-muted mb-lg">Toque na foto para alterar</p>

                <form id="profile-edit-form">
                    <div class="form-group">
                        <label class="form-label">Nome Completo</label>
                        <input type="text" class="form-input" id="edit-name" value="${user.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="edit-email" value="${user.email || ''}" required>
                    </div>
                    
                    <div class="grid grid-2 gap-md">
                        <div class="form-group">
                            <label class="form-label">WhatsApp</label>
                            <input type="text" class="form-input" id="edit-whatsapp" value="${user.whatsapp || user.phone || ''}" placeholder="(00) 00000-0000">
                        </div>
                        <div class="form-group">
                            <label class="form-label">CPF</label>
                            <input type="text" class="form-input" id="edit-cpf" value="${user.cpf || ''}" placeholder="000.000.000-00">
                        </div>
                    </div>


                    ${user.type === 'personal' ? `
                    <div class="form-group">
                        <label class="form-label">CREF (Registro Profissional)</label>
                        <input type="text" class="form-input" id="edit-cref" value="${user.cref || ''}" placeholder="000000-G/UF">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Chave Pix (Para recebimento manual)</label>
                        <input type="text" class="form-input" id="edit-pix-key" value="${user.pix_key || ''}" placeholder="Sua chave Pix">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sobre seu Trabalho (Bio)</label>
                        <textarea class="form-input" id="edit-bio" rows="4" placeholder="Descreva sua experiência, especialidades...">${user.bio || ''}</textarea>
                    </div>
                    ` : ''}

                    ${(user.type === 'personal' || user.type === 'admin') ? `
                    <div class="mt-xl pt-lg" style="border-top: 2px dashed var(--border);">
                        <div class="flex justify-between items-center mb-md">
                            <h4 class="font-bold flex items-center gap-sm">
                                💳 Configurações Mercado Pago
                                <span class="cursor-pointer" onclick="UI.showHelpMP()" style="background: var(--bg-tertiary); width: 20px; height: 20px; border-radius: 50%; display: inline-flex; items-center; justify-content: center; font-size: 12px; border: 1px solid var(--border);">?</span>
                            </h4>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Public Key</label>
                            <input type="text" class="form-input" id="edit-mp-public-key" placeholder="APP_USR-...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Access Token</label>
                            <input type="password" class="form-input" id="edit-mp-access-token" placeholder="APP_USR-...">
                        </div>
                        
                        <button type="button" class="btn btn-outline btn-sm btn-block mb-md" id="btn-test-mp-profile">
                            ⚡ Testar Conexão Mercado Pago
                        </button>
                    </div>
                    ` : ''}

                    <p class="text-xs text-muted mt-md">Alterar o email mudará seu login. Mantenha seus contatos atualizados para suporte e vendas.</p>
                
                    <!-- Logout & Delete Section -->
                    <div class="mt-xl pt-lg flex flex-col gap-sm" style="border-top: 1px solid var(--border);">
                        <button type="button" class="btn btn-outline text-danger btn-block" onclick="UI.closeModal(); auth.logout();">
                            🚪 Sair da Conta
                        </button>
                        <button type="button" class="btn btn-ghost text-muted btn-sm btn-block mt-md" onclick="UI.closeModal(); window.requestAccountDeletion();">
                            🗑️ Excluir Minha Conta
                        </button>
                    </div>
                </form>
            </div>
        `;

        UI.showModal('Editar Perfil', content, async () => {
            const nameInput = document.getElementById('edit-name');
            const emailInput = document.getElementById('edit-email');
            const whatsappInput = document.getElementById('edit-whatsapp');
            const cpfInput = document.getElementById('edit-cpf');

            if (!nameInput || !emailInput) return false;

            const updateData = {
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                whatsapp: whatsappInput.value.trim(),
                phone: whatsappInput.value.trim(), // Keep both synced
                cpf: cpfInput.value.trim(),
                photo_url: window.tempProfilePhoto || user.photo_url
            };

            if (user.type === 'personal') {
                updateData.cref = document.getElementById('edit-cref').value.trim();
                updateData.pix_key = document.getElementById('edit-pix-key').value.trim();
                updateData.bio = document.getElementById('edit-bio').value.trim();
            }

            // Handle MP config save separately before profile update
            if (user.type === 'personal' || user.type === 'admin') {
                const mpPk = document.getElementById('edit-mp-public-key').value.trim();
                let mpAt = document.getElementById('edit-mp-access-token').value.trim();

                // Save only if at least one field changed from the '********' placeholder
                if (mpPk || (mpAt && mpAt !== '********')) {
                    const saveRes = await window.savePaymentConfig({
                        public_key: mpPk,
                        access_token: mpAt === '********' ? null : mpAt // Send null to keep existing token
                    });
                    if (!saveRes) return false; // Abort profile save if MP save failed
                }
            }

            UI.showLoading('Salvando perfil...');
            try {
                const collection = user.type === 'admin' ? 'admins' : (user.type === 'personal' ? 'personals' : 'students');
                const success = db.update(collection, user.id, updateData);

                if (success) {
                    auth.saveSession({ ...user, ...updateData });
                    delete window.tempProfilePhoto;
                    UI.hideLoading();
                    UI.showNotification('Sucesso', 'Perfil atualizado!', 'success');
                    if (window.router) window.router.refresh();
                    return true;
                }
                throw new Error('Falha no banco local');
            } catch (error) {
                UI.hideLoading();
                UI.showNotification('Erro', 'Erro ao salvar: ' + error.message, 'error');
                return false;
            }
        });

        // Initialize MP values
        setupMP();

        // Handle MP test button inside profile editor
        const testBtn = document.getElementById('btn-test-mp-profile');
        if (testBtn) {
            testBtn.onclick = async () => {
                const atInput = document.getElementById('edit-mp-access-token');
                if (atInput && atInput.value && atInput.value !== '********') {
                    // Test with current input values if provided
                    await window.testMPConnection(user.id, atInput.value);
                } else {
                    // Fallback to saved DB credentials
                    await window.testMPConnection(user.id);
                }
            };
        }

        // Handle Photo Upload
        document.getElementById('profile-photo-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const originalBase64 = event.target.result;
                UI.showLoading('Otimizando foto...');
                try {
                    const compressed = await UI.compressImage(originalBase64);
                    window.tempProfilePhoto = compressed;
                    document.getElementById('profile-avatar-preview').innerHTML = `<img src="${compressed}" alt="Preview">`;
                } catch (err) {
                    console.error("Compression error:", err);
                    window.tempProfilePhoto = originalBase64;
                }
                UI.hideLoading();
            };
            reader.readAsDataURL(file);
        });
    }

    static showHelpMP() {
        UI.showModal('Como pegar as chaves?', `
            <div class="p-md">
                <ol class="flex flex-col gap-md text-sm">
                    <li>1. Acesse o <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" class="text-primary font-bold">Painel do Desenvolvedor</a> do Mercado Pago.</li>
                    <li>2. Clique na sua <b>Aplicação</b> (ou crie uma nova do tipo 'Pagamentos Online').</li>
                    <li>3. No menu lateral, vá em <b>'Credenciais de Produção'</b>.</li>
                    <li>4. Copie a <b>Public Key</b> e o <b>Access Token</b>.</li>
                    <li>5. Cole nos campos do seu perfil aqui no T-FIT e clique em <b>Salvar perfil</b>.</li>
                </ol>
                <div class="card mt-lg bg-primary-dark" style="background: rgba(var(--primary-rgb), 0.1);">
                    <p class="text-xs mb-0 p-sm">⚠️ Use sempre as credenciais de <b>PRODUÇÃO</b> para receber valores reais.</p>
                </div>
            </div>
        `);
    }

    static renderAdCarousel() {
        const ads = db.getAll('ads');
        if (ads.length === 0) return '';

        return `
            <div class="ad-carousel-container mb-xl">
                <div class="ad-carousel" id="main-ad-carousel">
                    ${ads.map((ad, index) => `
                        <div class="ad-slide ${index === 0 ? 'active' : ''}" 
                             onclick="window.open('${ad.link}', '_blank')" 
                             style="cursor: pointer;">
                            <img src="${ad.image}" alt="Anúncio">
                        </div>
                    `).join('')}
                </div>
                ${ads.length > 1 ? `
                    <div class="ad-indicators">
                        ${ads.map((_, index) => `<span class="ad-indicator ${index === 0 ? 'active' : ''}" onclick="goToAdSlide(${index})"></span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    static updateConnectionStatus(status) {
        // Store status globally for future renders
        window.lastDbStatus = status;

        const indicator = document.getElementById('db-status-indicator');
        if (!indicator) return;

        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');

        if (status === 'online') {
            dot.style.background = '#10b981'; // success
            dot.style.boxShadow = '0 0 8px #10b981';
            text.innerText = 'Online';
            text.style.color = '#10b981';
        } else if (status === 'offline') {
            dot.style.background = '#f59e0b'; // warning
            dot.style.boxShadow = 'none';
            text.innerText = 'Offline (Local)';
            text.style.color = '#f59e0b';
        } else if (status === 'error') {
            dot.style.background = '#ef4444'; // danger
            dot.style.boxShadow = 'none';
            text.innerText = 'Erro de Conexão';
            text.style.color = '#ef4444';
        }
    }

    static injectStatusIndicator() {
        if (window.lastDbStatus) {
            this.updateConnectionStatus(window.lastDbStatus);
        }
    }

    static _updateNavActiveStates(currentPath) {
        document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
            // Extract path from onclick attribute for navigation items
            const pathMatch = el.getAttribute('onclick')?.match(/navigate\('(.+?)'\)/);
            const path = pathMatch ? pathMatch[1] : null;

            if (path === currentPath) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    static renderDashboard(content, userType) {
        // ALWAYS REMOVE T-FEED BLACK SCREEN ACTIVE CLASS
        document.body.classList.remove('t-feed-active');

        console.log(`[UI] Renderizando Dashboard para: ${userType}`);
        const app = document.getElementById('app');
        if (!app) {
            console.error('[UI] Elemento #app não encontrado!');
            return;
        }

        // OPTIMIZATION: If already in dashboard, only update the content area to avoid "white screen" and flicker
        const existingWrapper = app.querySelector('.dashboard-wrapper');
        const contentArea = document.getElementById('dashboard-content');

        if (existingWrapper && contentArea) {
            contentArea.innerHTML = `
                ${UI.renderProfileCompletionCard(auth.getCurrentUser())}
                ${content}
            `;
            this._updateNavActiveStates(window.router?.currentRoute);

            // Re-inject alert banners if needed
            const alertsContainer = app.querySelector('.global-alerts-container');
            if (alertsContainer) alertsContainer.outerHTML = UI.renderGlobalAlerts();

            return;
        }

        try {
            // SET UP NAVIGATION ITEMS
            let featuredItems = [];
            let otherItems = [];

            if (userType === 'student') {
                featuredItems = [
                    { path: '/student/dashboard', icon: '🏠', label: 'Início' },
                    { path: '/student/workouts', icon: '💪', label: 'Treino' },
                    { path: '/student/feed', icon: '📱', label: 'T-Feed' },
                ];
                otherItems = [
                    { path: '/student/mapbox', icon: '📍', label: 'Waze' },
                    { path: '/student/payments', icon: '💳', label: 'Financeiro' },
                    { path: '/student/nutrition', icon: '🥗', label: 'Minha dieta' },
                    { path: '/student/assessments', icon: '📏', label: 'Avaliação Física' },
                    { path: '/notifications', icon: '🔔', label: 'Notificações' },
                    { path: '#', action: 'UI.showProfileEditor(); if(window.toggleMobileMenu) window.toggleMobileMenu(true);', icon: '👤', label: 'Perfil' },
                ];
            } else if (userType === 'personal') {
                featuredItems = [
                    { path: '/personal/dashboard', icon: '🏠', label: 'Painel' },
                    { path: '/personal/students', icon: '👥', label: 'Alunos' },
                    { path: '/personal/feed', icon: '📱', label: 'T-Feed' },
                ];
                otherItems = [
                    { path: '/personal/nutrition', icon: '🥗', label: 'Dieta' },
                    { path: '/personal/payments', icon: '💰', label: 'Financeiro / MP' },
                    { path: '/personal/assessments', icon: '📏', label: 'Avaliações' },
                    { path: '/notifications', icon: '🔔', label: 'Notificações' },
                    { path: '/personal/subscription', icon: '💳', label: 'Assinatura' },
                    { path: '/student/mapbox', icon: '📍', label: 'Waze Fitness' },
                ];
            } else if (userType === 'admin') {
                featuredItems = [
                    { path: '/admin/dashboard', icon: '📊', label: 'Início' },
                    { path: '/admin/students', icon: '👥', label: 'Alunos' },
                ];
                otherItems = [
                    { path: '/admin/feed', icon: '📱', label: 'T-Feed' },
                    { path: '/admin/payments', icon: '💰', label: 'Financeiro' },
                    { path: '/admin/assessments', icon: '📏', label: 'Avaliações' },
                    { path: '/admin/videos', icon: '📹', label: 'Treino' },
                    { path: '/admin/plans', icon: '💳', label: 'Planos' },
                    { path: '/admin/ads', icon: '📺', label: 'Anúncios' },
                    { path: '/student/mapbox', icon: '📍', label: 'Waze Fitness' },
                    { path: '/notifications', icon: '🔔', label: 'Notificações' },
                ];
            }

            const user = auth.getCurrentUser() || { name: 'Usuário', email: '---' };
            const names = (user.name || 'Usuário').split(' ');
            const initials = names.map(n => n[0]).join('').toUpperCase().substring(0, 2);
            const avatarHtml = user.photo_url
                ? `<img src="${user.photo_url}" alt="${user.name}">`
                : initials;

            const globalAlerts = UI.renderGlobalAlerts();

            app.innerHTML = `
                <div class="dashboard-wrapper">
                    ${globalAlerts}
                    <div class="mobile-overlay" onclick="toggleMobileMenu()"></div>
                    
                    <div class="mobile-header">
                        <button class="btn btn-ghost" onclick="toggleMobileMenu()">
                            <span style="font-size: 1.5rem;">☰</span>
                        </button>
                        <div class="mobile-logo" onclick="UI.showHelpModal()">
                            <img src="./logo.png" alt="T-FIT" style="height: 32px; vertical-align: middle; cursor: pointer;">
                        </div>
                        <div class="flex items-center gap-sm">
                                <button class="btn-notification" onclick="router.navigate('/notifications')" style="position: relative;">
                                    🔔
                                    <span class="notification-badge hidden"></span>
                                </button>
                                <div class="avatar-sm" onclick="UI.showProfileEditor()" style="cursor: pointer;">${avatarHtml}</div>
                        </div>
                    </div>

                    <div class="dashboard">
                        <aside class="sidebar">
                            <div class="sidebar-logo" onclick="UI.showHelpModal()" style="cursor: pointer;">
                                <img src="./logo.png" alt="T-FIT" style="width: 100%; max-width: 150px; margin-bottom: var(--spacing-sm); display: block;">
                                <p class="text-muted" style="font-size: 0.75rem;">Gestão Inteligente v${APP_VERSION}</p>
                            </div>
                            
                            <nav>
                                ${featuredItems.map(item => `
                                    <a href="#" onclick="event.preventDefault(); ${item.action || `router.navigate('${item.path}')`}" class="nav-item ${router.currentRoute === item.path ? 'active' : ''}">
                                        <span class="nav-icon">${item.icon}</span>
                                        <span class="nav-label">${item.label}</span>
                                    </a>
                                `).join('')}

                                <div class="nav-divider"></div>
                                
                                ${otherItems.map(item => `
                                    <a href="#" onclick="event.preventDefault(); ${item.action || `router.navigate('${item.path}')`}" class="nav-item ${router.currentRoute === item.path ? 'active' : ''}">
                                        <span class="nav-icon">${item.icon}</span>
                                        <span class="nav-label">${item.label}</span>
                                    </a>
                                `).join('')}

                                <div class="mt-auto pt-lg">
                                    <a href="#" onclick="event.preventDefault(); auth.logout()" class="nav-item text-danger">
                                        <span class="nav-icon">🚪</span>
                                        <span class="nav-label">Sair</span>
                                    </a>
                                </div>
                            </nav>
                        </aside>

                        <main class="main-content">
                            <div id="dashboard-content" class="fade-in">
                                ${UI.renderProfileCompletionCard(user)}
                                ${content}
                            </div>
                        </main>
                    </div>

                    <!-- Bottom Navigation (Mobile) -->
                    <nav class="bottom-nav">
                        ${featuredItems.slice(0, 2).map(item => {
                let badge = '';
                if (item.path && item.path.endsWith('/feed')) {
                    try {
                        const u = auth.getCurrentUser();
                        if (u && typeof db !== 'undefined') {
                            const convs = (db.getAll('conversations') || []).filter(c => c && c.participants && Array.isArray(c.participants) && c.participants.includes(u.id));
                            const unread = convs.filter(c => {
                                const msgsArr = db.getAll('messages') || [];
                                const last = msgsArr.filter(m => m && m.conversation_id === c.id && m.sender_id !== u.id).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
                                return last && (!c.read_by || !c.read_by[u.id] || new Date(last.created_at) > new Date(c.read_by[u.id]));
                            }).length;
                            if (unread > 0) badge = `<span class="nav-dm-badge">${unread}</span>`;
                        }
                    } catch (e) {
                        console.warn('[UI] Badge calculation failed:', e);
                    }
                }
                return `
                                <a href="#" onclick="event.preventDefault(); ${item.action || `router.navigate('${item.path}')`}" class="bottom-nav-item ${router.currentRoute === item.path ? 'active' : ''}">
                                    <span class="bottom-nav-icon">${item.icon}${badge}</span>
                                    <span class="bottom-nav-label">${item.label}</span>
                                </a>
                            `;
            }).join('')}

                        <!-- HUB BUTTON -->
                        <div class="hub-button-container">
                            <button class="tfit-hub-btn" onclick="hub.toggle()">
                                <span id="hub-cycling-icon" class="hub-cycling-icon">📱</span>
                            </button>
                        </div>

                        ${featuredItems.slice(2).map(item => {
                let badge = '';
                if (item.path && item.path.endsWith('/feed')) {
                    try {
                        const u = auth.getCurrentUser();
                        if (u) {
                            const convs = db.getAll('conversations').filter(c => c.participants && c.participants.includes(u.id));
                            const msgs = db.getAll('messages');
                            const unread = convs.filter(c => {
                                const last = msgs.filter(m => m.conversation_id === c.id && m.sender_id !== u.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                                return last && (!c.read_by || !c.read_by[u.id] || new Date(last.created_at) > new Date(c.read_by[u.id]));
                            }).length;
                            if (unread > 0) badge = '<span class="nav-dm-badge">' + unread + '</span>';
                        }
                    } catch (e) { }
                }
                return `
                                <a href="#" onclick="event.preventDefault(); ${item.action || `router.navigate('${item.path}')`}" class="bottom-nav-item ${router.currentRoute === item.path ? 'active' : ''}">
                                    <span class="bottom-nav-icon">${item.icon}${badge}</span>
                                    <span class="bottom-nav-label">${item.label}</span>
                                </a>
                            `;
            }).join('')}
                        
                        <a href="#" class="bottom-nav-item" onclick="event.preventDefault(); toggleMobileMenu()">
                            <span class="bottom-nav-icon">☰</span>
                            <span class="bottom-nav-label">Mais</span>
                        </a>
                    </nav>
                </div>
            `;
            console.log(`[UI] Dashboard renderizado com sucesso para: ${userType}`);
        } catch (err) {
            console.error('[UI] Erro grave ao renderizar dashboard:', err);
            app.innerHTML = `<div class="p-xl text-center"><h2 class="text-danger">Erro de Interface</h2><p>${err.message}</p><button class="btn btn-primary mt-md" onclick="location.reload()">Recarregar Aplicativo</button></div>`;
        }
    }

    static renderProfileCompletionCard(user) {
        if (!user || user.type === 'admin') return '';

        // Exibir apenas nos dashboards principais
        const dashboardRoutes = ['/student/dashboard', '/personal/dashboard'];
        const currentPath = window.router?.currentRoute || '';
        if (!dashboardRoutes.includes(currentPath)) return '';

        // Campos críticos solicitados pelo usuário
        const criticalFields = ['cpf', 'birth_date', 'weight', 'height', 'sex'];
        const isIncomplete = criticalFields.some(f => !user[f]);

        if (!isIncomplete) return '';
        if (sessionStorage.getItem('fitpro_pc_hidden')) return '';

        return `
            <div class="card mb-xl animate-fade-in shadow-premium" id="profile-completion-card" 
                 style="border: none; background: var(--bg-card); overflow: hidden; position: relative; z-index: 10; border-radius: 20px;">
                <div style="height: 6px; background: linear-gradient(90deg, var(--primary), #8b5cf6);"></div>
                <div class="card-body p-xl">
                    <div class="flex justify-between items-start mb-lg">
                        <div>
                            <h2 class="font-black text-2xl mb-xs">🚀 Complete seu Perfil</h2>
                            <p class="text-muted">Precisamos de alguns dados para personalizar sua experiência.</p>
                        </div>
                        <button class="btn btn-ghost p-sm" onclick="this.closest('#profile-completion-card').remove(); sessionStorage.setItem('fitpro_pc_hidden', 'true');" title="Pular por enquanto">✕</button>
                    </div>
                    
                    <form id="profile-completion-form">
                        <div class="grid grid-2 gap-lg mb-xl">
                            <div class="form-group col-span-2">
                                <label class="form-label font-bold text-sm uppercase tracking-wider">Nome Completo</label>
                                <input type="text" class="form-input" id="pc-name" value="${user.name || ''}" placeholder="Seu nome completo" style="background: var(--bg-tertiary);">
                            </div>
                            <div class="form-group">
                                <label class="form-label font-bold text-sm uppercase tracking-wider">CPF</label>
                                <input type="text" class="form-input" id="pc-cpf" value="${user.cpf || ''}" placeholder="000.000.000-00" style="background: var(--bg-tertiary);">
                            </div>
                            <div class="form-group">
                                <label class="form-label font-bold text-sm uppercase tracking-wider">Data de Nascimento</label>
                                <input type="date" class="form-input" id="pc-birth-date" value="${user.birth_date || ''}" style="background: var(--bg-tertiary);">
                            </div>
                            <div class="form-group">
                                <label class="form-label font-bold text-sm uppercase tracking-wider">Idade</label>
                                <input type="number" class="form-input" id="pc-age" value="${user.age || ''}" placeholder="Ex: 25" style="background: var(--bg-tertiary);">
                            </div>
                            <div class="form-group">
                                <label class="form-label font-bold text-sm uppercase tracking-wider">Sexo</label>
                                <select class="form-select" id="pc-sex" style="background: var(--bg-tertiary);">
                                    <option value="">Selecione...</option>
                                    <option value="Masculino" ${user.sex === 'Masculino' ? 'selected' : ''}>Masculino</option>
                                    <option value="Feminino" ${user.sex === 'Feminino' ? 'selected' : ''}>Feminino</option>
                                    <option value="Outro" ${user.sex === 'Outro' ? 'selected' : ''}>Outro</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label font-bold text-sm uppercase tracking-wider">Peso Atual (kg)</label>
                                <input type="number" step="0.1" class="form-input" id="pc-weight" value="${user.weight || ''}" placeholder="0.0" style="background: var(--bg-tertiary);">
                            </div>
                            <div class="form-group">
                                <label class="form-label font-bold text-sm uppercase tracking-wider">Altura (cm)</label>
                                <input type="number" class="form-input" id="pc-height" value="${user.height || ''}" placeholder="Ex: 175" style="background: var(--bg-tertiary);">
                            </div>
                        </div>


                        <div class="flex gap-md">
                             <button type="button" class="btn btn-ghost flex-1 py-lg" onclick="this.closest('#profile-completion-card').remove(); sessionStorage.setItem('fitpro_pc_hidden', 'true');">Pular Agora</button>
                             <button type="button" class="btn btn-primary flex-2 py-lg shadow-glow font-bold" onclick="UI.saveProfileCompletion()">
                                🚀 Salvar e Começar Agora
                             </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    static async saveProfileCompletion() {
        const user = auth.getCurrentUser();
        if (!user) return;

        const data = {
            name: document.getElementById('pc-name').value.trim(),
            cpf: document.getElementById('pc-cpf').value.trim(),
            birthDate: document.getElementById('pc-birth-date').value,
            age: parseInt(document.getElementById('pc-age').value) || null,
            sex: document.getElementById('pc-sex').value,
            weight: parseFloat(document.getElementById('pc-weight').value) || null,
            height: parseInt(document.getElementById('pc-height').value) || null
        };

        if (!data.name) return UI.showNotification('Erro', 'O nome é obrigatório.', 'warning');

        UI.showLoading('Salvando seu perfil...');
        try {
            const collection = user.type === 'personal' ? 'personals' : 'students';
            const payload = { ...data };

            const success = await db.update(collection, user.id, payload);
            if (success) {
                auth.saveSession({
                    ...user,
                    ...data,
                    birth_date: data.birthDate
                });
                UI.hideLoading();
                UI.showNotification('Sucesso!', 'Perfil completo! Agora aproveite o T-FIT.', 'success');
                if (window.router) window.router.refresh();
            } else {
                throw new Error("Falha ao atualizar banco de dados.");
            }
        } catch (e) {
            UI.hideLoading();
            UI.showNotification('Erro', 'Falha ao salvar: ' + e.message, 'error');
        }
    }

    static showReceipt(dataUrl) {
        if (!dataUrl) {
            UI.showNotification('Erro', 'Comprovante não encontrado', 'error');
            return;
        }

        const isPDF = dataUrl.includes('application/pdf');
        let viewContent = '';

        if (isPDF) {
            viewContent = `<iframe src="${dataUrl}" style="width: 100%; height: 500px; border: none;"></iframe>`;
        } else {
            viewContent = `<img src="${dataUrl}" style="width: 100%; border-radius: 8px; box-shadow: var(--shadow);">`;
        }

        const modalContent = `
            <div class="flex flex-col gap-md">
                ${viewContent}
                <div class="flex justify-center mt-md">
                    <a href="${dataUrl}" download="comprovante" class="btn btn-primary">
                        📥 Baixar Comprovante
                    </a>
                </div>
            </div>
        `;

        UI.showModal('Visualizar Comprovante', modalContent);
    }

    static renderGlobalAlerts() {
        if (!window.db) return '';
        const notifications = db.getAll('notifications') || [];
        const dismissedNotifs = JSON.parse(localStorage.getItem('fitpro_dismissed_notifs') || '[]');

        // Filter active notifications (e.g., from last 7 days and not dismissed)
        const activeNotifs = notifications.filter(n => {
            if (!n || n.target !== 'all' || dismissedNotifs.includes(n.id)) return false;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return new Date(n.created_at) > sevenDaysAgo;
        });

        if (activeNotifs.length === 0) return '';

        return `
            <div class="global-alerts-container">
                ${activeNotifs.map(n => `
                    <div class="alert-banner alert-${n.type || 'info'}" id="alert-${n.id}">
                        <div class="alert-content">
                            <span class="alert-icon">${n.type === 'warning' ? '⚠️' : n.type === 'danger' ? '🚨' : '📢'}</span>
                            <div class="alert-text">
                                <strong>${n.title || 'Informativo'}</strong>: ${n.message}
                            </div>
                        </div>
                        <button class="alert-close" onclick="window.dismissNotification('${n.id}')">×</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    static showWorkoutCompletion(workout, timing = {}) {
        const user = auth.getCurrentUser();
        if (!user) return;

        // Safety check for workout object
        const activeWorkout = workout || { name: 'Treino T-FIT' };

        const date = new Date();
        const days = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
        const dayName = days[date.getDay()];

        // Get Weekly Progress
        const completions = db.query('workout_completions', c => c.student_id === user.id) || [];
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
        endOfWeek.setHours(23, 59, 59, 999);

        const weeklyCompletions = completions.filter(c => {
            const cDate = new Date(c.completed_at);
            return cDate >= startOfWeek && cDate <= endOfWeek;
        });

        const completedDaysMap = {};
        weeklyCompletions.forEach(c => {
            const cDay = new Date(c.completed_at).getDay();
            completedDaysMap[cDay] = true;
        });

        const dayInitials = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
        const progressVerticalHtml = dayInitials.map((initial, index) => {
            const isCompleted = completedDaysMap[index];
            const isToday = index === date.getDay();
            return `
                <div class="weekly-day-vertical ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}">
                    <div class="day-letter-box">${initial}</div>
                </div>
                `;
        }).join('');

        // Helper for Photo Capture logic
        window.captureSelfie = () => {
            document.getElementById('workout-photo-input').click();
        };

        window.uploadPhoto = () => {
            document.getElementById('workout-photo-upload').click();
        };

        window.handleWorkoutPhoto = (input) => {
            const file = input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                window._activeWorkoutPhoto = base64; // Armazena globalmente

                const container = document.getElementById('share-card-container');
                if (container) {
                    container.style.backgroundImage = `url(${base64})`;
                    container.style.backgroundSize = 'cover';
                    container.style.backgroundPosition = 'center';

                    UI.showNotification('Foto Adicionada!', 'Ficou ótimo! Agora vamos preparar sua publicação.', 'success');

                    // Auto-capture the card after a short delay for the image to render
                    setTimeout(() => {
                        window.captureWorkoutCard();
                    }, 500);
                }
            };
            reader.readAsDataURL(file);
        };

        window.captureWorkoutCard = async () => {
            const target = document.getElementById('share-card-container');
            if (!target || !window.html2canvas) return null;

            try {
                // Diminuir brilho do background image se quiser mas vamos manter original
                const canvas = await html2canvas(target, {
                    useCORS: true,
                    allowTaint: true,
                    scale: 2, // Melhor qualidade
                    backgroundColor: '#000000'
                });
                const finalImg = canvas.toDataURL('image/jpeg', 0.8);
                window._capturedWorkoutCard = finalImg;
                return finalImg;
            } catch (err) {
                console.error('Erro ao capturar card:', err);
                return null;
            }
        };

        // Reset global photo on open
        window._activeWorkoutPhoto = null;
        window._capturedWorkoutCard = null;

        const modalContent = `
                <div id="share-card-container" class="workout-celebration-premium">
                <style>
                    .workout-celebration-premium {
                        background: linear-gradient(135deg, #000000 0%, #0f172a 50%, #1e293b 100%);
                        color: white;
                        border-radius: 28px;
                        padding: 0;
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
                        border: 1px solid rgba(255,255,255,0.08);
                        min-height: 550px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }

                    .workout-celebration-premium::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: radial-gradient(circle, transparent 20%, rgba(0,0,0,0.5) 100%);
                        z-index: 1;
                        pointer-events: none;
                    }
                    
                    /* Sidebar Progress & Timing */
                    .sidebar-progress-v {
                        position: absolute;
                        right: 15px;
                        top: 50%;
                        transform: translateY(-50%);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        z-index: 5;
                    }
                    .sidebar-timing-v {
                        position: absolute;
                        left: 15px;
                        top: 50%;
                        transform: translateY(-50%);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        z-index: 5;
                        text-align: left;
                    }
                    .timing-box {
                        background: rgba(0,0,0,0.5);
                        border: 1px solid rgba(255,255,255,0.15);
                        padding: 5px 8px;
                        border-radius: 8px;
                        backdrop-filter: blur(8px);
                    }
                    .timing-label {
                        font-size: 0.55rem;
                        color: rgba(255,255,255,0.6);
                        text-transform: uppercase;
                        font-weight: 700;
                        margin-bottom: 2px;
                    }
                    .timing-value {
                        font-family: 'Inter', sans-serif;
                        font-size: 0.75rem;
                        font-weight: 800;
                        color: #ffffff;
                    }
                    .weekly-day-vertical {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .day-letter-box {
                        width: 32px;
                        height: 32px;
                        background: rgba(0,0,0,0.5);
                        border: 1px solid rgba(255,255,255,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 800;
                        font-size: 1.1rem;
                        color: rgba(255,255,255,0.7);
                        border-radius: 4px;
                        backdrop-filter: blur(4px);
                    }
                    .weekly-day-vertical.completed .day-letter-box {
                        background: #10b981;
                        color: #ffffff;
                        border-color: #10b981;
                        box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
                    }
                    .weekly-day-vertical.today .day-letter-box {
                         border-color: #dc2626;
                         border-width: 2px;
                         transform: scale(1.1);
                    }

                    .celebration-title-v2 {
                        font-size: 2.2rem;
                        font-weight: 900;
                        line-height: 1;
                        margin-bottom: 0.5rem;
                        color: #ffffff;
                        text-transform: uppercase;
                        letter-spacing: -1px;
                        text-shadow: 0 0 20px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.8);
                    }
                    .celebration-title-v2 span {
                        color: #dc2626; 
                    }

                    /* Footer Overlay */
                    .footer-overlay {
                        background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%);
                        padding: 7rem 1.5rem 2rem;
                        z-index: 5;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        width: 100%;
                        border-bottom-left-radius: 28px;
                        border-bottom-right-radius: 28px;
                    }
                    .app-logo-celebration {
                        height: 90px;
                        margin-top: 10px;
                        filter: drop-shadow(0 0 15px rgba(0,0,0,0.9)) brightness(1.1);
                        opacity: 1;
                    }
                    /* Space filler */
                    .spacer-flex {
                        flex: 1;
                    }
                </style>

                <div class="sidebar-progress-v">
                    ${progressVerticalHtml}
                </div>

                <div class="sidebar-timing-v">
                    <div class="timing-box">
                        <div class="timing-label">Início</div>
                        <div class="timing-value">${timing.start || '--:--'}</div>
                    </div>
                    <div class="timing-box">
                        <div class="timing-label">Fim</div>
                        <div class="timing-value">${timing.end || '--:--'}</div>
                    </div>
                    <div class="timing-box">
                        <div class="timing-label">Duração</div>
                        <div class="timing-value">${timing.duration || '0'} min</div>
                    </div>
                </div>
                
                <div class="spacer-flex"></div>

                <div class="footer-overlay">
                     <p class="celebration-day" style="color: #ef4444; font-weight: 800; font-size: 0.9rem; letter-spacing: 2px; text-transform: uppercase;">${dayName}</p>
                     <h1 class="celebration-title-v2">Treino<br><span>Concluído</span></h1>
                    <img src="./logo.png" class="app-logo-celebration" alt="T-FIT">
                </div>
            </div>

                <div class="share-actions" style="display: flex; flex-direction: column; gap: 12px; margin-top: 1.5rem;">
                    <input type="file" id="workout-photo-input" accept="image/*" capture="user" style="display: none;" onchange="window.handleWorkoutPhoto(this)">
                    <input type="file" id="workout-photo-upload" accept="image/*" style="display: none;" onchange="window.handleWorkoutPhoto(this)">

                            <div class="flex gap-sm">
                                <button class="btn btn-outline btn-lg flex-1" onclick="window.captureSelfie()" style="border-width: 2px; font-weight: 700;">
                                    📸 Tirar Foto
                                </button>
                                <button class="btn btn-outline btn-lg flex-1" onclick="window.uploadPhoto()" style="border-width: 2px; font-weight: 700;">
                                    📁 Carregar
                                </button>
                            </div>

                            <button class="btn btn-primary btn-lg btn-block" id="btn-share-tfeed"
                    style="background: linear-gradient(45deg, #6366f1 0%, #8b5cf6 100%); border: none; font-weight: 800; height: 55px;">
                            📱 Publicar no T-FEED
                        </button>


                        <button class="btn btn-primary btn-lg btn-block" id="btn-save-gallery" style="background: linear-gradient(45deg, #10b981 0%, #059669 100%); border: none; font-weight: 800; height: 55px;">
                            💾 Salvar na Galeria
                        </button>


                        <button class="btn btn-ghost btn-block" onclick="UI.closeModal(); router.navigate('/student/dashboard');">
                            Continuar para o App
                        </button>
                </div>
            `;

        UI.showModal('Parabéns! 🙌', modalContent);

        // Implementation of Sharing to T-FEED
        let dynamicActiveWorkoutName = activeWorkout.name || 'Treino Livre';
        let dynamicDayName = dayName;
        let dynamicDuration = timing.duration || 0;

        document.getElementById('btn-share-tfeed')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-share-tfeed');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Preparando Post...';
            btn.disabled = true;

            try {
                let finalImg = window._capturedWorkoutCard;
                if (!finalImg) {
                    finalImg = await window.captureWorkoutCard();
                }

                if (!finalImg) throw new Error("Aguarde a imagem finalizar para publicar.");

                btn.innerHTML = originalText;
                btn.disabled = false;

                if (typeof window.tfeed === 'undefined' && typeof TFeedV2 !== 'undefined') {
                    window.tfeed = new TFeedV2();
                }

                    if (window.tfeed && typeof window.tfeed.openWorkoutShareModal === 'function') {
                        window.tfeed.openWorkoutShareModal({
                            title: dynamicActiveWorkoutName,
                            duration: `${dynamicDuration} min`,
                            calories: '350 kcal',
                            dayName: dynamicDayName,
                            capturedImg: finalImg
                        });
                    } else {
                        UI.showNotification('Erro', 'T-Feed não está disponível no momento', 'error');
                    }
            } catch (err) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                UI.showNotification('Aviso', err.message, 'warning');
            }
        });

        // Implementation of Sharing logic using html2canvas
        document.getElementById('btn-save-gallery')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-save-gallery');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Salvando...';
            btn.disabled = true;

            try {
                const element = document.getElementById('share-card-container');
                const canvas = await html2canvas(element, {
                    scale: 3, // Higher quality
                    backgroundColor: null,
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                });

                // Generation of image
                const workoutNameClean = workout?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'treino';
                const filename = `T - FIT_${workoutNameClean}_${new Date().getTime()}.png`;

                // Convert canvas to Blob (more stable for mobile)
                canvas.toBlob(async (blob) => {
                    if (!blob) throw new Error("Falha ao gerar imagem.");

                    const file = new File([blob], filename, { type: 'image/png' });

                    // Try Web Share API (Best for Mobile Gallery)
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: 'Meu Treino T-FIT',
                                text: 'Check-in concluído! 🔥'
                            });
                            UI.showNotification('Sucesso!', 'Imagem enviada/salva! 🔥', 'success');
                        } catch (shareError) {
                            if (shareError.name !== 'AbortError') {
                                console.error('Share error:', shareError);
                                UI.fallbackDownload(blob, filename);
                            }
                        }
                    } else {
                        // Fallback to direct download
                        UI.fallbackDownload(blob, filename);
                    }
                }, 'image/png');

            } catch (error) {
                console.error('[Share] Erro:', error);
                UI.showNotification('Erro', 'Não foi possível processar a imagem.', 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

    }

    static fallbackDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up memory
        setTimeout(() => URL.revokeObjectURL(url), 100);
        UI.showNotification('Download', 'A imagem foi baixada. Verifique sua galeria ou downloads.', 'info');
    }
}

// ============================================
// NOTIFICATION MANAGER (PWA + SUPABASE)
// ============================================
class NotificationManager {
    static async init() {
        if (!('Notification' in window)) {
            console.log('[Notification] Este navegador não suporta notificações.');
            return;
        }

        const user = auth.getCurrentUser();
        if (!user) return;

        // Inicia o sistema de Push via Supabase (definido em push-notifications.js)
        if (window.setupPushNotifications) {
            window.setupPushNotifications();
        }

        // Busca contagem inicial de não lidas
        if (window.updateNotificationBadge) {
            window.updateNotificationBadge();
        }
    }

    static async markAllAsRead() {
        if (window.markNotificationsAsRead) {
            await window.markNotificationsAsRead();
        }
    }
}

// ============================================
// WHATSAPP UTILITIES
// ============================================
class WhatsApp {
    static sendMessage(phone, message) {
        // Remove non-numeric characters
        const cleanPhone = phone.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
        window.open(url, '_blank');
    }

    static sendCredentials(phone, name, email, password, loginUrl) {
        const message = `🎯 *T-FIT - Suas Credenciais*\n\nOlá ${name}!\n\nSeu acesso ao FitPro foi criado:\n\n📧 Email: ${email}\n🔑 Senha: ${password}\n\n🔗 Acesse aqui: ${loginUrl}\n\nBons treinos! 💪`;
        this.sendMessage(phone, message);
    }


    static contactPersonal(phone, studentName) {
        const message = `Olá! Sou ${studentName}, seu aluno no T-FIT. Gostaria de tirar uma dúvida.`;
        this.sendMessage(phone, message);
    }

    static contactStudent(phone, personalName) {
        const message = `Olá! Aqui é ${personalName}, seu Personal Trainer.`;
        this.sendMessage(phone, message);
    }
}

// ============================================
// ACCOUNT DELETION HELPER
// ============================================
window.requestAccountDeletion = async () => {
    // 1. Confirm Intent
    UI.confirmDialog(
        'Excluir Conta Permanentemente ⚠️',
        'Tem certeza? Essa ação é irreversível. Todos os seus dados, treinos e histórico serão apagados e sua assinatura cancelada.',
        () => {
            // 2. Re-authentication Prompt
            UI.promptDialog(
                'Confirmação de Segurança 🔒',
                'Para continuar, digite sua senha atual:',
                '',
                async (password) => {
                    if (!password) return;

                    UI.showLoading('Verificando senha...');
                    try {
                        const user = window.authFirebase.currentUser;
                        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);

                        // 3. Re-authenticate
                        await user.reauthenticateWithCredential(credential);

                        UI.showLoading('Processando exclusão (Não feche o app)...');

                        // 4. Call Cloud Function
                        if (window.firebaseFunctions) {
                            const deleteFn = window.firebaseFunctions.httpsCallable('deleteAccount');
                            await deleteFn({ password }); // Password technically not needed by optimized backend, but kept for legacy

                            UI.hideLoading();

                            // 5. Success Handling
                            await auth.logout();
                            UI.showModal('Conta Excluída 👋', `
                                <div class="text-center p-md">
                                    <h3 class="text-success">Tudo pronto.</h3>
                                    <p class="text-muted mt-sm">Sua conta foi removida com sucesso.</p>
                                    <p class="text-sm">Um e-mail de confirmação foi enviado para você.</p>
                                    <button class="btn btn-primary mt-md" onclick="location.reload()">Voltar ao Início</button>
                                </div>
                            `);
                        } else {
                            throw new Error('Serviço de nuvem indisponível.');
                        }

                    } catch (error) {
                        console.error('Erro na exclusão:', error);
                        UI.hideLoading();

                        let msg = error.message;
                        if (error.code === 'auth/wrong-password') msg = 'Senha incorreta.';
                        if (error.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Aguarde um pouco.';

                        UI.showNotification('Erro', msg, 'error');
                    }
                },
                'password' // input type
            );
        },
        'Sim, excluir tudo',
        null,
        'Cancelar'
    );
};



// O módulo AIHelper agora é gerenciado pelo arquivo ai-generator.js

// ============================================
// INITIALIZE APP
// ============================================
const db = new Database();
const auth = new AuthManager(db);
const router = new Router();

// Expose to window for other scripts (admin-pages.js, etc.)
// Expose to window for other scripts (admin-pages.js, etc.)
window.db = db;
window.auth = auth;
window.router = router;
window.UI = UI;
window.WhatsApp = WhatsApp;
window.NotificationManager = NotificationManager;


// Mobile Hamburger Logic (Global)
window.toggleMobileMenu = (forceClose = false) => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');

    // Safety check if elements exist
    if (!sidebar || !overlay) return;

    if (forceClose || sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('open');
    }
};

// Global click listener to close menu when clicking outside
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');

    if (sidebar && sidebar.classList.contains('open')) {
        // If click is on the overlay or on the main content area (not in sidebar or toggle buttons)
        const isToggle = e.target.closest('.mobile-header button') ||
            e.target.closest('.sidebar-logo button') ||
            e.target.closest('.bottom-nav-item');
        const isSidebar = e.target.closest('.sidebar');

        if (!isSidebar && !isToggle) {
            window.toggleMobileMenu(true);
        }
    }
});

// ============================================
// ROUTE DEFINITIONS
// ============================================

// Handle Notifications
router.addRoute('/notifications', () => {
    if (!auth.isAuthenticated()) return router.navigate('/');
    if (window.renderNotificationsPage) {
        window.renderNotificationsPage();
    } else {
        document.getElementById('dashboard-content').innerHTML = '<div class="p-xl text-center">Carregando notificações...</div>';
        // Fallback render if not defined yet
        UI.renderDashboard('Notificações', '<div id="notifications-list"></div>');
    }
});

// Home / Login Selection (Bypassed directly to student login)
router.addRoute('/login-selection', () => {
    router.navigate('/student/login');
});

// NEW LANDING PAGE
router.addRoute('/', () => {
    // If authenticated, redirect to dashboard
    if (auth.isAuthenticated()) {
        const user = auth.getCurrentUser();
        if (user.type === 'student') return router.navigate('/student/dashboard');
        // Personal option removed completely
        if (user.type === 'admin') return router.navigate('/admin/dashboard');
    }

    if (window.LandingPage) {
        LandingPage.init();
    } else {
        // Fallback simple landing if module fails
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="landing-page padding-xl text-center">
                <img src="./logo.png" style="height: 60px; margin-bottom: 2rem;">
                <h1>TFIT - A Nova Geração Fitness</h1>
                <p>O poder da IA para seu treino e dieta.</p>
                <button class="btn btn-primary" onclick="router.navigate('/student/login')">COMEÇAR AGORA</button>
            </div>
        `;
    }

    // Update database status indicator after render
    setTimeout(() => {
        UI.injectStatusIndicator();
    }, 500);
});

// PRIVACY POLICY ROUTE
router.addRoute('/privacy', async () => {
    const app = document.getElementById('app');
    UI.showLoading('Carregando Política...');

    try {
        const response = await fetch('privacy.html');
        const html = await response.text();

        // Extract body content
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        let content = bodyMatch ? bodyMatch[1] : html;

        // Add back button and container
        app.innerHTML = `
            <div class="page p-lg" style="background: #000; color: #fff; line-height: 1.6; max-width: 800px; margin: 0 auto;">
                <button class="btn btn-ghost mb-lg" onclick="window.history.back()" style="color: var(--primary);">← Voltar</button>
                <div class="privacy-content">
                    ${content}
                </div>
                <div class="text-center mt-2xl mb-2xl">
                    <button class="btn btn-primary" onclick="window.history.back()">Entendi</button>
                </div>
            </div>
            <style>
                .privacy-content h1 { color: var(--primary); font-weight: 800; margin-bottom: 8px; text-align: center; font-size: 1.5rem; }
                .privacy-content .last-update { text-align: center; color: #a1a1aa; font-size: 0.9em; margin-bottom: 32px; }
                .privacy-content h2 { border-bottom: 2px solid var(--primary); padding-bottom: 8px; margin-top: 32px; font-size: 1.2em; font-weight: 700; color: #fff; }
                .privacy-content p, .privacy-content ul { color: #e4e4e7; margin-bottom: 1rem; }
                .privacy-content li { margin-bottom: 8px; }
                .privacy-content .contact-info { background: #18181b; padding: 20px; border-radius: 12px; border: 1px solid #27272a; margin-top: 40px; }
                .privacy-content .btn-back { display: none; } /* Hide the fixed link from HTML */
            </style>
        `;
    } catch (err) {
        app.innerHTML = `<div class="p-lg text-center">Erro ao carregar política. <button class="btn btn-primary" onclick="router.navigate('/')">Voltar</button></div>`;
    } finally {
        UI.hideLoading();
    }
});

// Admin Login (SupaBase Auth Real)
router.addRoute('/admin/login', () => {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">
                    <img src="./logo.png" alt="T-FIT" style="width: 100%; max-width: 200px; margin: 0 auto 1rem; display: block;">
                    <p>Acesso Administrador</p>
                </div>
                
                <form id="login-form">
                    <div class="form-group mb-md">
                        <label>E-mail</label>
                        <input type="email" id="email" class="form-input" placeholder="seu@email.com" required>
                    </div>
                    <div class="form-group mb-lg">
                        <label>Senha</label>
                        <input type="password" id="password" class="form-input" placeholder="********" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block btn-lg">
                        Entrar
                    </button>
                </form>

                <div class="mt-md text-center">
                    <a href="#" onclick="window.forgotPassword()" class="text-sm text-primary">Esqueci minha senha</a>
                </div>

                <div class="mt-md">
                    <button class="btn btn-ghost btn-block" onclick="router.navigate('/')">
                        ← Voltar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        UI.showLoading('Autenticando...');
        const result = await auth.login(email, password);
        UI.hideLoading();

        if (result.success) {
            const user = auth.getCurrentUser();
            const userRole = user?.role || user?.type;
            if (userRole !== 'admin') {
                UI.showNotification('Acesso Negado', 'Este e-mail não possui permissão de administrador. Você está cadastrado como "' + (userRole || 'desconhecido') + '".', 'error');
                await auth.logout();
                return;
            }
            console.log('[Login] Sucesso! Navegando para admin dashboard...');
            UI.showNotification('Sucesso', 'Bem-vindo de volta!', 'success');
            router.navigate('/admin/dashboard');
        } else {
            UI.showNotification('Erro', result.message, 'error');
        }
    });
});

// Personal Login (SupaBase Auth Real)
router.addRoute('/personal/login', () => {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">
                    <img src="./logo.png" alt="T-FIT" style="width: 100%; max-width: 200px; margin: 0 auto 1rem; display: block;">
                    <p>Acesso Personal Trainer</p>
                </div>
                
                <form id="login-form">
                    <div class="form-group mb-md">
                        <label>E-mail</label>
                        <input type="email" id="email" class="form-input" placeholder="seu@email.com" required>
                    </div>
                    <div class="form-group mb-lg">
                        <label>Senha</label>
                        <input type="password" id="password" class="form-input" placeholder="********" required>
                    </div>
                    <button type="submit" class="btn btn-secondary btn-block btn-lg">
                        Entrar
                    </button>
                </form>

                <div class="divider text-center my-md" style="opacity: 0.5;">ou acesse com</div>
                
                <button class="btn btn-outline btn-block" onclick="auth.loginWithGoogle('personal')" style="display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 12px; height: 50px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" style="width: 20px;">
                    Entrar com Google
                </button>

                <div class="mt-md text-center">
                    <a href="#" onclick="window.forgotPassword()" class="text-sm text-primary">Esqueci minha senha</a>
                </div>

                <div class="mt-md">
                    <button class="btn btn-ghost btn-block" onclick="router.navigate('/')">
                        ← Voltar
                    </button>
                    <!-- Atalho Demo -->
                    <button class="btn btn-sm btn-ghost mt-sm" onclick="auth.loginDirect('personal')" style="opacity: 0.5;">
                        🗝️ Demo (Sem Senha)
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        UI.showLoading('Autenticando...');
        const result = await auth.login(email, password);
        UI.hideLoading();

        if (result.success) {
            const user = auth.getCurrentUser();
            const userRole = user?.role || user?.type;
            if (userRole !== 'personal') {
                UI.showNotification('Acesso Negado', 'Este e-mail não está cadastrado como Personal Trainer. Você está cadastrado como "' + (userRole || 'desconhecido') + '".', 'error');
                await auth.logout();
                return;
            }
            console.log('[Login] Sucesso! Navegando para personal dashboard...');
            UI.showNotification('Sucesso', 'Bem-vindo de volta!', 'success');
            await router.navigate('/personal/dashboard');
        } else {
            UI.showNotification('Erro', result.message, 'error');
        }
    });
});

// Student Login (SupaBase Auth Real + Google)
router.addRoute('/student/login', () => {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">
                    <img src="./logo.png" alt="T-FIT" id="admin-secret-gate" class="logo-tfit" style="width: 100%; max-width: 200px; margin: 0 auto 1rem; display: block; cursor: default;">
                    <p>Acesso Aluno</p>
                </div>
                
                <!-- Google Login -->
                <button class="btn btn-google btn-block btn-lg mb-md" onclick="auth.loginWithGoogle()" style="background: #fff; color: #333; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" style="width: 20px;">
                    Entrar com Google
                </button>

                <div class="divider text-center mb-md" style="opacity: 0.5;">ou entre com e-mail</div>

                <form id="login-form">
                    <div class="form-group mb-md">
                        <label>E-mail</label>
                        <input type="email" id="email" class="form-input" placeholder="seu@email.com" required>
                    </div>
                    <div class="form-group mb-lg">
                        <label>Senha</label>
                        <input type="password" id="password" class="form-input" placeholder="********" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block btn-lg">
                        Entrar
                    </button>
                </form>

                <div class="mt-md text-center">
                    <a href="#" onclick="window.forgotPassword()" class="text-sm text-primary">Esqueci minha senha</a>
                </div>

                <div class="mt-lg pt-md border-top text-center">
                    <p class="text-muted mb-sm">Ainda não tem conta?</p>
                    <button class="btn btn-outline btn-block" onclick="router.navigate('/student/register')">
                        Criar Conta
                    </button>
                    
                    <button class="btn btn-ghost btn-block mt-md" onclick="router.navigate('/')">
                        ← Voltar
                    </button>
                    <!-- Atalho Demo -->
                    <button class="btn btn-sm btn-ghost mt-sm" onclick="auth.loginDirect('student')" style="opacity: 0.5;">
                        🗝️ Demo (Sem Senha)
                    </button>
                </div>
            </div>
        </div>
    `;

    // Secret Admin Gate: Click 5 times on logo
    let secretClicks = 0;
    setTimeout(() => {
        const logo = document.getElementById('admin-secret-gate');
        if (logo) {
            logo.addEventListener('click', () => {
                secretClicks++;
                if (secretClicks >= 5) {
                    UI.showNotification('Acesso Restrito', 'Redirecionando...', 'info');
                    router.navigate('/admin/login');
                }
            });
        }
    }, 500);

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        UI.showLoading('Autenticando...');
        const result = await auth.login(email, password);
        UI.hideLoading();

        if (result.success) {
            const user = auth.getCurrentUser();
            const userRole = user?.role || user?.type;
            if (userRole !== 'student') {
                UI.showNotification('Acesso Negado', 'Este e-mail não está cadastrado como Aluno. Você está cadastrado como "' + (userRole || 'desconhecido') + '".', 'error');
                await auth.logout();
                return;
            }
            console.log('[Login] Sucesso! Navegando para student dashboard...');
            UI.showNotification('Sucesso', 'Bem-vindo de volta!', 'success');
            await router.navigate('/student/dashboard');
        } else {
            UI.showNotification('Erro', result.message, 'error');
        }
    });

    // Tratamento de retorno do Google (se houver hash na URL)
    auth.initAuthListener();
});

// ============================================
// GLOBAL ADS LOGIC
// ============================================
let adInterval;
window.goToAdSlide = (index) => {
    const slides = document.querySelectorAll('.ad-slide');
    const indicators = document.querySelectorAll('.ad-indicator');

    if (slides.length === 0) return;

    // Reset interval on manual interaction
    clearInterval(adInterval);
    window.startAdCarousel();

    slides.forEach(s => s.classList.remove('active'));
    indicators.forEach(i => i.classList.remove('active'));

    // Wrap around
    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;

    if (slides[index]) slides[index].classList.add('active');
    if (indicators[index]) indicators[index].classList.add('active');

    // Store current index for auto-rotation reference
    window.currentAdIndex = index;
};

window.startAdCarousel = () => {
    if (adInterval) clearInterval(adInterval);

    // Check if carousel exists
    const carousel = document.getElementById('main-ad-carousel');
    if (!carousel) return;

    window.currentAdIndex = 0;

    adInterval = setInterval(() => {
        const slides = document.querySelectorAll('.ad-slide');
        if (slides.length <= 1) return; // No need to rotate if only 1 slide

        let nextIndex = (window.currentAdIndex || 0) + 1;
        if (nextIndex >= slides.length) nextIndex = 0;

        // Manually update classes to avoid clearing interval recursively via goToAdSlide
        // Or just call goToAdSlide but modify it to NOT reset interval if called internally?
        // Simpler: Just rely on goToAdSlide resetting it, effectively resetting the timer each switch.
        // But wait, goToAdSlide clears and RESTARTS. That keeps the rhythm.

        // However, we can't pass a "fromInterval" flag easily to a global window function exposed to onclick.
        // Let's implement the DOM update directly here or just call a helper.

        window.goToAdSlide(nextIndex);
    }, 5000); // 5 seconds
};

// Start carousel on page load if it exists

// ============================================
// MANUAL SYNC UTILITY (Cloud Migration)
// ============================================
window.syncLocalToFirebase = async () => {
    if (!window.dbRT) {
        UI.showNotification('Erro', 'Banco de dados não disponível', 'error');
        return;
    }

    UI.showLoading();
    try {
        console.log("Iniciando sincronização manual...");
        const collections = db.collections;

        for (const col of collections) {
            const localData = db.getAll(col);
            if (localData.length > 0) {
                console.log(`Sincronizando ${localData.length} itens da coleção ${col}...`);
                for (const item of localData) {
                    if (item && item.id) {
                        await window.dbRT.ref(col).child(item.id).set(item);
                    }
                }
            }
        }

        UI.showNotification('Sucesso', 'Todos os dados locais foram salvos na nuvem! ☁️', 'success');
    } catch (error) {
        console.error("Falha na sincronização manual:", error);
        UI.showNotification('Erro', 'Ocorreu um erro ao sincronizar os dados.', 'error');
    } finally {
        UI.hideLoading();
    }
};

// Forgot Password Helper
window.forgotPassword = () => {
    UI.promptDialog('Recuperar Senha', 'Digite seu e-mail cadastrado para receber as instruções de redefinição:', '', async (email) => {
        if (!email) return;
        UI.showLoading('Enviando e-mail...');
        const result = await auth.resetPassword(email);
        UI.hideLoading();
        if (result.success) {
            UI.showNotification('Sucesso!', 'E-mail de redefinição enviado com sucesso. Verifique sua caixa de entrada.', 'success');
        } else {
            UI.showNotification('Erro', result.message, 'error');
        }
    });
};

// Load remaining routes from separate files
// ============================================
// BOOTSTRAP APP
// ============================================

// Show loading screen immediately (before any big logic)
if (typeof UI !== 'undefined' && UI.showLoading) {
    UI.showLoading('Iniciando T-FIT...');
}

window.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 DOM Pronto. Iniciando Boot do App...");
    let safetyTimeout;
    let bootFinished = false;

    // Função de limpeza para garantir que o loader suma
    const finishBoot = (success = true) => {
        if (bootFinished) return;
        bootFinished = true;
        clearTimeout(safetyTimeout);
        UI.hideLoading();
        if (success) {
            console.log("✨ App inicializado com sucesso!");
        }
    };

    try {
        // Show debug logger if needed
        const logger = document.getElementById('debug-screen-logger');
        if (logger) logger.style.display = 'block';

        // Safety Timeout: Forçar entrada após 10 segundos se nada acontecer
        safetyTimeout = setTimeout(() => {
            if (!bootFinished) {
                console.warn("⚠️ Watchdog: Boot demorou demais. Forçando entrada...");
                const btn = document.getElementById('emergency-enter-container');
                if (btn) btn.classList.remove('hidden');
                finishBoot(false);
            }
        }, 12000);

        // Initialize Database (Sync with Supabase)
        console.log("📡 [S1] Conectando ao Banco de Dados...");
        if (typeof db !== 'undefined') {
            await db.init().catch(e => console.error("Erro db.init:", e));
        }

        console.log("🔑 [S2] Verificando Sessão...");
        // Initialize Auth (Verify session)
        if (typeof auth !== 'undefined' && auth.initAuthListener) {
            await auth.initAuthListener().catch(e => console.error("Erro auth.init:", e));
        }

        console.log("💳 [S3] Verificando Pagamentos...");
        // Check for Payment Return (Auto Validate)
        const urlParams = new URLSearchParams(window.location.search);
        const isSuccessMP = (
            urlParams.get('mp_status') === 'success' ||
            urlParams.get('status') === 'approved' ||
            urlParams.get('collection_status') === 'approved' ||
            urlParams.get('status') === 'pending' // Pix starts as pending sometimes
        );

        if (isSuccessMP) {
            console.log("💰 Pagamento detectado via URL! Atualizando acesso...");
            UI.showNotification('Pagamento Identificado', 'Estamos sincronizando seu acesso agora mesmo! 🎉', 'success');
            if (auth && auth.refreshUser) await auth.refreshUser();

            // Clean URL clean (remove query params) to prevent double-processing on refresh
            const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);

            // Set flag to force redirection to success page
            window._paymentReturnSuccess = true;
        }

        if (typeof window.checkPaymentReturn === 'function') {
            try { window.checkPaymentReturn(); } catch (e) { console.error(e); }
        }

        // Determine First Route
        try {
            if (auth && auth.isAuthenticated && auth.isAuthenticated()) {
                const user = auth.getCurrentUser();
                console.log("👤 Usuário Autenticado:", user?.name);

                const role = user.role || user.type;
                const dashboardMap = {
                    'admin': '/admin/dashboard',
                    'personal': '/personal/dashboard',
                    'student': '/student/dashboard'
                };

                let targetRoute = '/';

                // Redirecionamento Prioritário após Pagamento
                if (window._paymentReturnSuccess) {
                    targetRoute = '/payment/success';
                } else if (role === 'student') {
                    // Always land on dashboard, feature-level checks will handle restrictions
                    targetRoute = '/student/dashboard';
                } else if (dashboardMap[role]) {
                    targetRoute = dashboardMap[role];
                }

                console.log(`🚀 Navegando para rota inicial: ${targetRoute}`);
                await router.navigate(targetRoute);
            } else {
                console.log("🏠 Não autenticado. Indo para Home.");
                await router.navigate('/');
            }
        } catch (routeErr) {
            console.error("Erro ao definir rota inicial:", routeErr);
            await router.navigate('/');
        }

        // Finalize ONLY after initial navigation is done
        finishBoot(true);

        // Resume Active Session Check (Workout)
        const sessionData = localStorage.getItem('fitpro_active_session');
        if (sessionData && auth.isAuthenticated()) {
            try {
                const session = JSON.parse(sessionData);
                const user = auth.getCurrentUser();
                if (session.workout_id && (session.student_id === user.id || user.type === 'personal')) {
                    UI.confirmDialog(
                        'Treino em Andamento 💡',
                        'Identificamos que você possui um treino não finalizado. Deseja continuar de onde parou?',
                        () => {
                            window._resumeStartTime = session.start_time;
                            window.startWorkout(session.workout_id, session.student_id, session.start_index);
                        },
                        'Sim, continuar',
                        () => localStorage.removeItem('fitpro_active_session'),
                        'Não, descartar'
                    );
                }
            } catch (e) { console.error(e); }
        }

        // Initialize Notifications
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.init().catch(e => console.error(e));
        }

    } catch (criticalError) {
        console.error("❌ ERRO FATAL NO BOOT:", criticalError);
        finishBoot(false);
        UI.showLoading('Erro ao iniciar App. Verifique sua conexão.');

        // Se o app não renderizou nada, mostra tela de erro forçada
        const app = document.getElementById('app');
        if (!app || app.innerHTML.trim() === '') {
            app.innerHTML = `<div class="text-center p-xl">
                <h2 class="text-danger">Erro de Conexão</h2>
                <p>Não foi possível sincronizar os dados iniciais.</p>
                <button class="btn btn-primary mt-md" onclick="location.reload()">Tentar Novamente</button>
             </div>`;
        }
    }
});

// T-FEED ROUTES
// ============================================
router.addRoute('/student/feed', () => {
    if (!auth.requireAuth('student')) return;
    if (window.ignoreFeedRefresh && document.getElementById('t-feed-container')) return;
    UI.renderDashboard('<div id="t-feed-container" class="fade-in"></div>', 'student');
    renderTFeed();
});

router.addRoute('/student/post', () => {
    if (!auth.requireAuth('student')) return;
    router.navigate('/student/feed');
    setTimeout(() => {
        if (window.tfeed) window.tfeed.openCreatePost();
    }, 500);
});

// Personal T-Feed
router.addRoute('/personal/feed', () => {
    if (!auth.requireAuth('personal')) return;
    if (window.ignoreFeedRefresh && document.getElementById('t-feed-container')) return;
    UI.renderDashboard('<div id="t-feed-container" class="fade-in"></div>', 'personal');
    renderTFeed();
});

router.addRoute('/personal/post', () => {
    if (!auth.requireAuth('personal')) return;
    router.navigate('/personal/feed');
    setTimeout(() => {
        if (window.tfeed) window.tfeed.openCreatePost();
    }, 500);
});

// Admin T-Feed
router.addRoute('/admin/feed', () => {
    if (!auth.requireAuth('admin')) return;
    if (window.ignoreFeedRefresh && document.getElementById('t-feed-container')) return;
    UI.renderDashboard('<div id="t-feed-container" class="fade-in"></div>', 'admin');
    renderTFeed();
});

router.addRoute('/admin/post', () => {
    if (!auth.requireAuth('admin')) return;
    router.navigate('/admin/feed');
    setTimeout(() => {
        if (window.tfeed) window.tfeed.openCreatePost();
    }, 500);
});

// Generic T-Feed Render Helper
function renderTFeed() {
    let attempts = 0;
    const maxAttempts = 20; // Increased retries for slower devices

    const tryRender = () => {
        const container = document.getElementById('t-feed-container');

        // If container doesn't exist yet, we can try to create it if we are in the right context
        if (!container) {
            const dashboardContent = document.getElementById('dashboard-content');
            if (dashboardContent) {
                console.log("[T-Feed Render] Creating container manually...");
                dashboardContent.innerHTML = '<div id="t-feed-container" class="fade-in"></div>';
            }
        }

        const activeContainer = document.getElementById('t-feed-container');

        if (activeContainer && window.tfeed) {
            try {
                window.tfeed.render('t-feed-container');
            } catch (error) {
                console.error("Erro render T-Feed:", error);
                activeContainer.innerHTML = `
                    <div class="text-center p-xl">
                        <h3>Erro ao carregar Feed</h3>
                        <p class="text-muted text-sm mb-lg">${error.message}</p>
                        <button class="btn btn-primary btn-sm" onclick="location.reload()">Recarregar Aplicativo</button>
                    </div>
                `;
            }
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(tryRender, 250);
            } else {
                console.error("[T-Feed Render] Failed to find container or tfeed object after 20 attempts.");
                const app = document.getElementById('app');
                if (app && (!activeContainer || activeContainer.innerHTML === '')) {
                    UI.showNotification('Erro de Carregamento', 'O T-Feed demorou demais para responder.', 'error');
                }
            }
        }
    };
    tryRender();
}
// Global Receipt Viewer (Mercado Pago Style - Light Theme for Readability)
window.viewReceipt = (paymentId) => {
    const payment = db.getById('payments', paymentId);
    if (!payment) {
        UI.showNotification('Erro', 'Pagamento não encontrado.', 'error');
        return;
    }

    const proof = payment.proofData || payment.proofUrl || payment.proof || payment.proof_url;
    const plan = payment.plan_id ? db.getById('plans', payment.plan_id) : null;
    let proofHtml = '';

    if (proof) {
        const isImage = proof.startsWith('data:image') || proof.match(/\.(jpeg|jpg|gif|png|webp)$/i);
        proofHtml = isImage ?
            `<div class="mt-lg pt-lg border-t border-dashed">
                <p class="text-[10px] text-muted-foreground uppercase font-bold mb-sm text-center">Comprovante Original</p>
                <div class="text-center">
                    <img src="${proof}" style="max-width: 100%; max-height: 250px; border-radius: 4px; border: 1px solid #ddd; cursor:pointer;" onclick="window.open('${proof}', '_blank')">
                </div>
            </div>` :
            `<div class="mt-lg pt-md border-t border-dashed text-center">
                <a href="${proof}" target="_blank" class="btn btn-sm btn-outline" style="border-color: #009EE3; color: #009EE3;">Abrir Comprovante Externo 🔗</a>
            </div>`;
    }

    const content = `
        <div class="receipt-card bg-white p-0 rounded-xl overflow-hidden shadow-2xl" 
             style="color: #333; font-family: 'Inter', -apple-system, system-ui, sans-serif; max-width: 450px; margin: 0 auto; border: 1px solid #e5e7eb;">
            
            <!-- MP Header Style -->
            <div class="bg-[#009EE3] p-lg text-center relative overflow-hidden">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%);"></div>
                <div class="mx-auto bg-white rounded-full flex items-center justify-center text-[#009EE3] relative z-10" style="width: 56px; height: 56px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                    <i class="fas fa-check text-2xl"></i>
                </div>
                <h2 class="text-white font-bold text-lg mt-md relative z-10 mb-0">Pagamento Confirmado</h2>
                <p class="text-white/80 text-[11px] font-medium relative z-10">Processado via T-FIT Pay</p>
            </div>

            <div class="p-lg">
                <!-- Main Value -->
                <div class="text-center mb-xl">
                    <p class="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-xs">Valor Total</p>
                    <h1 class="text-4xl font-black text-[#333] tracking-tighter">R$ ${(parseFloat(payment.amount) || parseFloat(plan?.price) || 0).toFixed(2).replace('.', ',')}</h1>
                </div>

                <!-- Receipt Details -->
                <div class="space-y-md mb-xl">
                    <div class="flex justify-between items-start gap-md">
                        <span class="text-muted-foreground text-[11px] font-bold uppercase shrink-0 pt-1">Descrição</span>
                        <span class="text-[#333] text-sm font-bold text-right">${payment.description || plan?.name || 'Assinatura T-FIT'}</span>
                    </div>
                    
                    <div class="flex justify-between items-center border-t border-gray-100 pt-sm">
                        <span class="text-muted-foreground text-[11px] font-bold uppercase">Data</span>
                        <span class="text-[#555] text-sm font-medium">${new Date(payment.updated_at || payment.date || payment.created_at).toLocaleString('pt-BR')}</span>
                    </div>

                    <div class="flex justify-between items-center border-t border-gray-100 pt-sm">
                        <span class="text-muted-foreground text-[11px] font-bold uppercase">Método</span>
                        <div class="flex items-center gap-xs">
                            <i class="fas fa-bolt text-primary opacity-70" style="font-size: 10px;"></i>
                            <span class="text-[#555] text-sm font-medium uppercase">${(payment.method || 'PIX/MP').toUpperCase()}</span>
                        </div>
                    </div>

                    <div class="flex justify-between items-center border-t border-gray-100 pt-sm">
                        <span class="text-muted-foreground text-[11px] font-bold uppercase">ID Transação</span>
                        <span class="text-[#888] text-[10px] font-mono select-all">${(payment.mp_payment_id || payment.id).substring(0, 16)}...</span>
                    </div>
                </div>

                ${proofHtml}

                <!-- Status Badge -->
                <div class="mt-xl flex flex-col items-center">
                    <div class="inline-flex items-center gap-sm bg-[#e6f7ef] text-[#00a650] px-lg py-sm rounded-full text-xs font-bold uppercase border border-[#00a650]/20">
                         Operação Concluída
                    </div>
                    <p class="text-[10px] text-muted-foreground mt-md text-center">Este comprovante tem validade fiscal e legal dentro da plataforma T-FIT, gerado eletronicamente através dos registros oficiais do Mercado Pago.</p>
                </div>

                <!-- Footer Actions -->
                <div class="flex justify-between gap-md mt-lg no-print">
                    <button class="btn btn-outline flex-1 gap-sm py-sm border-gray-200 hover:bg-gray-50 text-gray-700" onclick="window.print()">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                    <button class="btn btn-ghost flex-1 py-sm text-gray-400 hover:text-gray-900" onclick="UI.closeModal()">
                        Voltar
                    </button>
                </div>
            </div>
            
            <!-- Safety Bar -->
            <div class="bg-gray-50 p-sm text-center border-t border-gray-100">
                <p class="text-[9px] text-gray-400 uppercase font-black tracking-widest flex items-center justify-center gap-xs">
                    <i class="fas fa-shield-alt"></i> Pagamento Seguro & Criptografado
                </p>
            </div>
        </div>

        <style>
            @media print {
                body * { visibility: hidden; }
                .receipt-card, .receipt-card * { visibility: visible; }
                .receipt-card { 
                    position: absolute; 
                    left: 0; 
                    top: 0; 
                    width: 100%; 
                    box-shadow: none !important; 
                    border: none !important;
                }
                .no-print { display: none !important; }
            }
        </style>
    `;

    UI.showModal('Comprovante Digital', content);
};
