// ============================================
// STUDENT DASHBOARD (FLEXIBLE PLANS)
// ============================================

// --- Audio Feedback Helper ---
const BeepHelper = {
    audioCtx: null,

    _init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume context if suspended (browser security)
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    beep(freq = 440, duration = 150, volume = 0.1, type = 'sine') {
        try {
            this._init();
            const oscillator = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

            gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration / 1000);

            oscillator.start(this.audioCtx.currentTime);
            oscillator.stop(this.audioCtx.currentTime + duration / 1000);
        } catch (e) {
            console.warn("Audio feedback blocked or unsupported", e);
        }
    },

    playStartRest() {
        // Som de 'Vidro' - 2 toques rápidos (agudo + curto)
        const freq = 1400;
        const dur = 80;
        this.beep(freq, dur, 0.4, 'triangle');
        setTimeout(() => this.beep(freq, dur, 0.4, 'triangle'), 150);
    },

    playEndRest() {
        // Som de 'Vidro' - 3 toques rápidos
        const freq = 1600;
        const dur = 80;
        this.beep(freq, dur, 0.5, 'triangle');
        setTimeout(() => this.beep(freq, dur, 0.5, 'triangle'), 150);
        setTimeout(() => this.beep(freq, dur, 0.5, 'triangle'), 300);
    }
};

// --- Workout Logic Helpers ---
const getNextWorkout = (student, workouts) => {
    if (!workouts || workouts.length === 0) return null;

    const sorted = [...workouts].sort((a, b) => a.name.localeCompare(b.name));
    const lastLetter = student.lastCompletedLetter || (student.workout_stats && student.workout_stats.lastCompletedLetter) || '';

    // Logic: Find the index of the last completed, then return index + 1
    // If no last letter, start with the first one (usually A)
    let nextIndex = 0;
    if (lastLetter) {
        const lastIdx = sorted.findIndex(w => {
            const match = w.name.match(/Treino ([A-G])/i);
            return match && match[1].toUpperCase() === lastLetter.toUpperCase();
        });
        if (lastIdx !== -1) {
            nextIndex = (lastIdx + 1) % sorted.length;
        }
    }

    return sorted[nextIndex];
};


// --- Video Logic Helper ---
const getExerciseVideoHTML = (exerciseName, autoplay = false) => {
    if (!exerciseName) return '';

    // Normalize function for bulletproof matching
    const clean = (str) => {
        if (!str) return "";
        return str.toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/(com|na|no|de|barra|halteres|maquina|polia|elastico|banco|sentado|deitado|em pe)$/g, "")
            .replace(/[^a-z0-9]/g, "")      // remove everything that isn't a letter or number
            .trim();
    };

    const videos = (typeof db !== 'undefined' && db.getAll) ? db.getAll('exercise_videos') : [];
    if (!videos || videos.length === 0) return '';

    const targetName = clean(exerciseName);

    // Match Strategy (CamelCase or snake_case)
    let match = videos.find(v => clean(v.exerciseName || v.exercise_name) === targetName);
    if (!match) {
        match = videos.find(v => {
            const mapped = clean(v.exerciseName || v.exercise_name);
            return mapped.length > 3 && (targetName.includes(mapped) || mapped.includes(targetName));
        });
    }

    if (match) {
        const mediaUrl = match.media_url || match.mediaUrl || match.youtubeUrl || match.youtube_url;
        let mediaType = match.media_type || match.mediaType;

        // Auto-detect type if missing (fallback for manual DB entries)
        if (!mediaType && mediaUrl) {
            if (mediaUrl.toLowerCase().includes('.gif')) mediaType = 'gif';
            else if (mediaUrl.toLowerCase().includes('.mp4') || mediaUrl.toLowerCase().includes('.webm')) mediaType = 'video';
            else if (mediaUrl.includes('youtube') || mediaUrl.includes('youtu.be')) mediaType = 'youtube';
        }

        if (!mediaUrl || mediaUrl.trim() === '') return '';
        const url = mediaUrl.trim();

        if (mediaType === 'youtube') {
            let videoId = '';
            // Comprehensive Video ID extraction
            const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
            const matchId = url.match(regExp);

            if (matchId && matchId[1] && matchId[1].length === 11) {
                videoId = matchId[1];
            } else if (url.length === 11 && !url.includes('/') && !url.includes('.')) {
                videoId = url;
            } else if (url.includes('shorts/')) {
                const parts = url.split('shorts/');
                if (parts[1]) videoId = parts[1].split(/[?#&]/)[0];
            }

            if (videoId) {
                return `
                    <div class="video-container-premium" style="width: 100%; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 5px 15px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); margin-top: 10px;">
                        <div style="position: relative; padding-bottom: 56.25%; height: 0;">
                            <iframe 
                                loading="lazy"
                                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
                                src="https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&mute=1&loop=1&playlist=${videoId}&rel=0&modestbranding=1&controls=1" 
                                allow="autoplay; encrypted-media" 
                                allowfullscreen>
                            </iframe>
                        </div>
                    </div>
                `;
            }
        } else if (mediaType === 'gif') {
            return `
                <div class="media-container-local" style="width: 100%; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 5px 15px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); margin-top: 10px; display: flex; justify-content: center; align-items: center; min-height: 200px;">
                    <img 
                        loading="lazy"
                        src="${url}" 
                        alt="${exerciseName}" 
                        style="width: 100%; height: auto; max-height: 400px; object-fit: contain;"
                        onerror="this.style.display='none'; this.parentElement.style.display='none';"
                    >
                </div>
            `;
        } else if (mediaType === 'video') {
            return `
                <div class="media-container-local" style="width: 100%; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 5px 15px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); margin-top: 10px; display: flex; justify-content: center; align-items: center; min-height: 200px;">
                    <video 
                        src="${url}" 
                        style="width: 100%; height: auto; max-height: 400px; object-fit: contain;"
                        ${autoplay ? 'autoplay' : ''} muted loop playsinline
                        onerror="this.style.display='none'; this.parentElement.style.display='none';"
                    ></video>
                </div>
            `;
        }
    }
    return '';
};


const checkStudentAccess = (callback) => {
    const currentUser = auth.getCurrentUser();
    const access = PaymentHelper.checkStudentAccess(currentUser);

    if (access.status === 'blocked') {
        UI.showModal('Acesso Restrito 🔒', `
            <div class="text-center p-lg">
                <div style="font-size: 3rem; margin-bottom: 1rem;">💳</div>
                <h3 class="mb-md">Assinatura Necessária</h3>
                <p class="text-muted mb-xl">Para acessar seus treinos e dietas, você precisa ter uma assinatura ativa.</p>
                <div class="flex flex-col gap-sm">
                    <button class="btn btn-primary btn-block" onclick="router.navigate('/student/payments'); UI.closeModal();">Ver Minha Assinatura</button>
                    <button class="btn btn-ghost btn-block" onclick="UI.closeModal()">Agora não</button>
                </div>
            </div>
        `);
        return false;
    }
    if (callback) callback();
    return true;
};


// ============================================
// STUDENT FINANCIAL CENTER
// ============================================
router.addRoute('/student/payments', () => {
    if (!auth.requireAuth('student')) return;

    const currentUser = auth.getCurrentUser();

    // Legacy Payments (Direct/Admin)
    const legacyPayments = db.query('payments', p => p.student_id === currentUser.id || p.user_id === currentUser.id);

    // Marketplace Payments (New Table)
    const marketplacePayments = db.query('pagamentos', p => p.aluno_id === currentUser.id);

    // Unified and sorted list
    const allRecentTransactions = [
        ...legacyPayments.map(p => ({
            id: p.id,
            date: p.date || p.created_at,
            description: p.description || (p.plan_id ? db.getById('plans', p.plan_id)?.name : 'Assinatura'),
            amount: p.amount,
            method: p.method || 'PIX',
            status: 'approved',
            type: 'legacy'
        })),
        ...marketplacePayments.map(p => {
            const plan = db.getById('planos_personal', p.plano_id);
            const personal = db.getById('profiles', p.personal_id);
            return {
                id: p.id,
                date: p.data_pagamento,
                description: plan ? `${plan.nome} (${personal?.name || 'Personal'})` : 'Plano Personal',
                amount: p.valor,
                method: 'Mercado Pago',
                status: p.status === 'aprovado' ? 'approved' : p.status,
                type: 'marketplace'
            };
        })
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate status/due date
    const accessCheck = PaymentHelper.checkStudentAccess(currentUser);
    const nextDueDate = currentUser.plan_expiry ? new Date(currentUser.plan_expiry) : new Date();
    const isOverdue = accessCheck.warning || accessCheck.blocked;

    // Determine plan info
    let plan_name = 'Premium';
    let planAmount = 0.00;

    if (currentUser.plan_id) {
        const plan = db.getById('plans', currentUser.plan_id);
        if (plan) {
            plan_name = plan.name;
            planAmount = parseFloat(plan.price);
        }
    } else if (PaymentHelper.hasAIAccess(currentUser)) {
        plan_name = 'Assinatura T-FIT IA';
        planAmount = 29.90;
    } else {
        // Fallback for students with personal but no plan data yet
        plan_name = currentUser.assigned_personal_id ? 'Plano com Personal' : 'Pendente';
    }

    const content = `
        <div class="page-header">
            <h1 class="page-title">Financeiro & Assinatura 💳</h1>
            <p class="page-subtitle">Gerencie seus pagamentos, planos e extrato</p>
        </div>

        <style>
            .responsive-payment-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 1.5rem;
            }
            @media (min-width: 768px) {
                .responsive-payment-grid {
                    grid-template-columns: 1fr 1fr;
                }
            }
        </style>
        
        <div class="responsive-payment-grid mb-xl">
            <!-- Current Status Card (Refactored for Recurring Subscriptions) -->
            <div class="card" style="border-width: 2px; border-color: var(--primary);">
                <div class="card-body">
                    <h3 class="text-md font-bold mb-md">Minha Assinatura 💎</h3>
                    
                    <div class="flex flex-col gap-md">
                        ${(() => {
            const subs = db.query('subscriptions', s => s.user_id === currentUser.id && s.status !== 'blocked')
                .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            const contracts = db.query('contracts', c => c.student_id === currentUser.id && c.status === 'active')
                .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            const marketplacePlans = db.query('alunos_planos', ap => ap.aluno_id === currentUser.id && ap.status === 'ativo')
                .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            let renderedCards = [];

            const accessCheck = PaymentHelper.checkStudentAccess(currentUser);

            // Check for Trial
            if (accessCheck.status === 'trial') {
                return `
                    <div class="p-lg rounded-xl border-shadow mb-md" style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%); border: 1px dashed var(--warning);">
                        <div class="flex justify-between items-start mb-md">
                            <div>
                                <div class="text-warning font-black text-lg">Período de Teste Grátis 🎁</div>
                                <div class="text-xs text-muted">Você está experimentando as funções Premium</div>
                            </div>
                            <span class="badge badge-warning">Experimental</span>
                        </div>
                        
                        <div class="py-md border-t border-b border-dashed mb-md" style="border-color: rgba(245, 158, 11, 0.2)">
                            <div class="text-center">
                                <div class="text-xs text-muted uppercase tracking-wider font-bold">Tempo Restante</div>
                                <div class="text-2xl font-black text-warning">${accessCheck.daysLeft} Dias</div>
                            </div>
                        </div>

                        <div class="flex flex-col gap-sm">
                            <button class="btn btn-primary btn-block btn-sm shadow-sm font-bold" onclick="router.navigate('/payment/plans')">
                                <i class="fas fa-gem mr-xs"></i> Assinar Plano e Garantir Acesso
                            </button>
                        </div>
                    </div>
                `;
            }

            if (subs.length === 0 && contracts.length === 0 && marketplacePlans.length === 0 && !PaymentHelper.hasAIAccess(currentUser)) {
                return `
                    <div class="text-center p-md text-muted">
                        <p>Nenhuma assinatura ativa ou recorrente.</p>
                        <button class="btn btn-sm btn-primary mt-sm" onclick="router.navigate('/payment/plans')">Assinar Agora</button>
                    </div>
                `;
            }

            // 1. Rendizar Assinaturas Recorrentes (MP - T-FIT ou IA)
            renderedCards = renderedCards.concat(subs.map(sub => {
                const plan = db.getById('plans', sub.plan_id) || { name: 'Plano T-FIT', price: 0 };
                const nextBilling = sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('pt-BR') : 'N/A';
                const isGrace = accessCheck.status === 'grace_period';
                const isCancelled = sub.status === 'cancelled';

                return `
                    <div class="p-lg rounded-xl border-shadow mb-md" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%); border: 1px solid var(--primary-light);">
                        <div class="flex justify-between items-start mb-md">
                            <div>
                                <div class="text-primary font-bold text-lg">${plan.name}</div>
                                <div class="text-sm text-muted">R$ ${parseFloat(plan.price).toFixed(2)} / ${plan.billing_cycle || 'mês'}</div>
                            </div>
                            <span class="badge ${isGrace ? 'badge-warning' : (isCancelled ? 'badge-danger' : 'badge-success')}">
                                ${isGrace ? 'Pendência' : (isCancelled ? 'Cancelado' : 'Ativa')}
                            </span>
                        </div>
                        
                        <div class="grid grid-2 gap-md py-md border-t border-b border-dashed mb-md">
                            <div>
                                <div class="text-xs text-muted uppercase tracking-wider">Início da Assinatura</div>
                                <div class="font-bold">${new Date(sub.created_at).toLocaleDateString('pt-BR')}</div>
                            </div>
                            <div>
                                <div class="text-xs text-muted uppercase tracking-wider">Vencimento (Mensal)</div>
                                <div class="font-bold ${isGrace ? 'text-danger' : 'text-success'}">
                                    ${nextBilling} 
                                    <small class="block font-normal text-xs opacity-75">
                                        (${sub.next_billing_date ? Math.ceil((new Date(sub.next_billing_date) - new Date()) / (1000 * 60 * 60 * 24)) : 0} dias restantes)
                                    </small>
                                </div>
                            </div>
                        </div>

                        <!-- Pix / Card Action Buttons (Direct Pay for the internal monthly cycle) -->
                        <div class="flex flex-col gap-sm">
                            ${plan ? `
                                <button class="btn btn-primary btn-block btn-sm mb-xs" onclick="window.startCheckout('${plan.price}', '${plan.name}', '${plan.id}', null, 'mensalidade_tfit')">
                                    💳 Renovar agora
                                </button>
                            ` : `
                                <button class="btn btn-secondary btn-block btn-sm mb-xs" onclick="router.navigate('/payment/plans')">
                                    🔍 Ver Planos
                                </button>
                            `}
                            ${(sub.mp_subscription_id && !isCancelled) ? `
                                <button class="btn btn-ghost btn-block btn-xs text-danger" onclick="window.cancelSubscription('${sub.mp_subscription_id}', '${plan.created_by || ''}')">
                                    ❌ Cancelar Assinatura
                                </button>
                            ` : ''}
                        </div>
                        
                        ${isGrace ? `
                            <div class="p-sm bg-danger-light text-danger rounded-lg text-xs mt-sm font-bold flex items-center justify-between">
                                <div class="flex items-center gap-xs">
                                    <span>⚠️</span> 
                                    <span>Pagamento pendente</span>
                                </div>
                                <span class="badge badge-danger" style="font-size: 0.65rem;">
                                    Bloqueio em breve
                                </span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }));

            // 2. Renderizar Contratos Ativos (Personal via PIX ou Sistema Nativo)
            renderedCards = renderedCards.concat(contracts.map(contract => {
                // If this contract is already represented by a MP subscription, skip visual duplication
                const hasMpSub = subs.some(s => s.plan_id === contract.plan_id);
                if (hasMpSub) return '';

                const plan = db.getById('plans', contract.plan_id) || { name: 'Assinatura Personal', price: 0 };
                const personal = db.getById('users', contract.personal_id) || { name: 'Personal Trainer' };
                const expDate = contract.end_date ? new Date(contract.end_date).toLocaleDateString('pt-BR') : 'Sem validade fixada';

                return `
                    <div class="p-lg rounded-xl border-shadow mb-md" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid var(--success);">
                        <div class="flex justify-between items-start mb-md">
                            <div>
                                <div class="text-success font-bold text-lg">Personal: ${personal.name}</div>
                                <div class="text-sm text-muted">Plano: ${plan.name}</div>
                            </div>
                            <span class="badge badge-success">Ativa</span>
                        </div>
                        
                        <div class="grid grid-2 gap-md py-md border-t border-b border-dashed mb-md">
                            <div>
                                <div class="text-xs text-muted uppercase tracking-wider">Início da Assinatura</div>
                                <div class="font-bold">${new Date(contract.start_date || contract.created_at).toLocaleDateString('pt-BR')}</div>
                            </div>
                            <div>
                                <div class="text-xs text-muted uppercase tracking-wider">Vencimento (Mensal)</div>
                                <div class="font-bold text-success">
                                    ${expDate}
                                    <small class="block font-normal text-xs opacity-75">
                                        (${contract.end_date ? Math.ceil((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : '30'} dias restantes)
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-col gap-sm">
                            <button class="btn btn-outline btn-block btn-sm mb-xs" onclick="window.viewPersonalProfile('${contract.personal_id}')">
                                🏋️‍♂️ Ver Perfil do Personal
                            </button>
                            <button class="btn btn-primary btn-block btn-sm text-white font-bold" style="background: var(--success);" onclick="window.startCheckout('${plan.price}', '${plan.name}', '${plan.id}', '${contract.personal_id}', 'single')">
                                💰 Renovar Mensalidade (Pix/Cartão)
                            </button>
                        </div>
                    </div>
                `;
            }));

            // 2.1 Renderizar Assinaturas do Marketplace (Novo Sistema)
            renderedCards = renderedCards.concat(marketplacePlans.map(mp => {
                // Prevent duplication across legacy and new systems
                const hasMpSub = subs.some(s => s.plan_id === mp.plano_id);
                const hasContract = contracts.some(c => c.plan_id === mp.plano_id);
                if (hasMpSub || hasContract) return '';

                const plan = db.getById('planos_personal', mp.plano_id) || { nome: 'Plano Personal', preco: 0, duracao_meses: 1 };
                const personal = db.getById('profiles', mp.personal_id) || { name: 'Personal Trainer' };
                const renewalDate = mp.data_proxima_cobranca ? new Date(mp.data_proxima_cobranca) : null;
                const currentDate = new Date();
                const daysRemaining = renewalDate ? Math.ceil((renewalDate - currentDate) / (1000 * 60 * 60 * 24)) : 0;
                const isOverdue = daysRemaining <= 0;

                return `
                    <div class="p-lg rounded-xl border-shadow mb-md" style="background: linear-gradient(135deg, rgba(220, 38, 38, 0.05) 0%, rgba(185, 28, 28, 0.05) 100%); border: 1px solid #dc2626;">
                        <div class="flex justify-between items-start mb-md">
                            <div>
                                <div class="text-danger font-bold text-lg">${plan.nome}</div>
                                <div class="text-xs text-muted">Professor: <b>${personal.name}</b></div>
                            </div>
                            <span class="badge ${isOverdue ? 'badge-danger' : 'badge-success'}">
                                ${isOverdue ? 'Vencido' : 'Ativo'}
                            </span>
                        </div>
                        
                        <div class="grid grid-2 gap-md py-md border-t border-b border-dashed mb-md" style="border-color: rgba(220,38,38,0.2)">
                            <div>
                                <div class="text-xs text-muted uppercase tracking-wider font-bold">Ciclo</div>
                                <div class="text-sm">${plan.duracao_meses} ${plan.duracao_meses > 1 ? 'Meses' : 'Mês'}</div>
                                <div class="text-xs font-bold text-danger">R$ ${parseFloat(plan.preco).toFixed(2)}</div>
                            </div>
                            <div>
                                <div class="text-xs text-muted uppercase tracking-wider font-bold">Renovação</div>
                                <div class="text-sm font-bold ${isOverdue ? 'text-danger' : 'text-success'}">
                                    ${renewalDate ? renewalDate.toLocaleDateString('pt-BR') : 'Pendente'}
                                </div>
                                <div class="text-[10px] opacity-75">
                                    (${daysRemaining > 0 ? daysRemaining + ' dias restantes' : 'Vencido'})
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-col gap-sm">
                            <button class="btn btn-primary btn-block btn-sm shadow-sm font-bold" style="background: #dc2626; border: none;" 
                                    onclick="window.startCheckout('${plan.preco}', '${plan.nome}', '${plan.id}', '${personal.id}', 'marketplace')">
                                <i class="fas fa-sync-alt mr-xs"></i> Renovar Plano do Personal
                            </button>
                            <button class="btn btn-ghost btn-block btn-xs" onclick="window.viewPersonalProfile('${personal.id}')">
                                <i class="fas fa-user-tie mr-xs"></i> Ver Perfil do Professor
                            </button>
                        </div>
                    </div>
                `;
            }));

            // 3. Fallback T-FIT IA Signature if bypassed automatically via DB (No formal sub found but has AI access)
            if (PaymentHelper.hasAIAccess(currentUser) && currentUser.plan_id !== 'trial_free' && !subs.some(s => {
                const p = db.getById('plans', s.plan_id);
                return p && p.name && p.name.includes('IA');
            })) {
                const expiryDateStr = currentUser.ai_access_expiry || currentUser.plan_expiry;
                const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
                const expFormatted = expiryDate ? expiryDate.toLocaleDateString('pt-BR') : 'Mensal';
                const daysRemaining = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : 30;

                renderedCards.push(`
                    <div class="p-lg rounded-xl border-shadow mb-md" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%); border: 1px solid var(--primary-light);">
                        <div class="flex justify-between items-start mb-md">
                            <div>
                                <div class="text-primary font-bold text-lg">Assinatura T-FIT IA 🤖</div>
                                <div class="text-sm text-muted">Acesso Liberado</div>
                            </div>
                            <span class="badge badge-success">Ativa</span>
                        </div>
                        
                        <div class="grid grid-2 gap-md py-md border-t border-b border-dashed mb-md">
                            <div>
                                <div class="text-xs text-muted uppercase tracking-wider">Ciclo de Cobrança</div>
                                <div class="font-bold">Renovação Mensal</div>
                            </div>
                            <div>
                                <div class="text-xs text-muted uppercase tracking-wider">Vencimento (IA)</div>
                                <div class="font-bold text-success">
                                    ${expFormatted}
                                    <small class="block font-normal text-xs opacity-75">
                                        (${daysRemaining} dias restantes)
                                    </small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex flex-col gap-sm">
                            <button class="btn btn-primary btn-block btn-sm bg-primary" onclick="window.startCheckout('29.90', 'Assinatura T-FIT IA', 'plano_ia', null, 'mensalidade_tfit')">
                                💰 Renovar via Pix ou Cartão
                            </button>
                        </div>
                    </div>
                `);
            }

            return renderedCards.join('');
        })()}
                    </div>
                </div>
            </div>

            <!-- Payment Methods Info -->
            <div class="card">
                <div class="card-body">
                    <h4 class="mb-md">Informações de Pagamento</h4>
                    <div class="flex flex-col gap-md">
                        <div class="flex items-center gap-md">
                            <div class="flex items-center justify-center bg-primary-light text-primary rounded-circle" style="width: 40px; height: 40px; font-size: 1.2rem; flex-shrink: 0;">⚡</div>
                            <div>
                                <div class="font-weight-600">Liberação Instantânea</div>
                                <div class="text-xs text-muted">Acesso liberado automaticamente via Pix ou Cartão.</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-md">
                            <div class="flex items-center justify-center bg-secondary-light text-secondary rounded-circle" style="width: 40px; height: 40px; font-size: 1.2rem; flex-shrink: 0;">📋</div>
                            <div>
                                <div class="font-weight-600">Histórico Completo</div>
                                <div class="text-xs text-muted">Acesse todos os seus recibos abaixo.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Payment History (Extrato) -->
        <div class="flex justify-between items-center mb-md mt-xl">
            <h3 class="mb-0">Histórico de Pagamentos 📄</h3>
            <span class="text-sm text-muted">${allRecentTransactions.length} transações encontradas</span>
        </div>

        <div class="card">
            <div class="card-body p-0">
                ${allRecentTransactions.length > 0 ? `
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Descrição / Plano</th>
                                    <th>Valor</th>
                                    <th>Método</th>
                                    <th>Status</th>
                                    <th class="text-right">Recibo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allRecentTransactions.map(p => `
                                    <tr>
                                        <td>${new Date(p.date).toLocaleDateString('pt-BR')}</td>
                                        <td>
                                            <div class="font-bold">${p.description}</div>
                                            <div class="text-xs text-muted">${p.type === 'marketplace' ? 'Marketplace' : 'Sistema T-FIT'}</div>
                                        </td>
                                        <td><strong>R$ ${(parseFloat(p.amount) || 0).toFixed(2).replace('.', ',')}</strong></td>
                                        <td><span class="badge badge-outline">${p.method}</span></td>
                                        <td><span class="badge ${p.status === 'approved' ? 'badge-success' : 'badge-warning'}">${p.status === 'approved' ? 'Aprovado' : 'Pendente'}</span></td>
                                        <td class="text-right">
                                            <button class="btn btn-sm btn-ghost" onclick="${p.type === 'marketplace' ? `window.viewMarketplaceReceipt('${p.id}')` : `window.viewReceipt('${p.id}')`}">
                                                👁️ Ver
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="text-center py-xl">
                        <div style="font-size: 3rem; opacity: 0.2;">💸</div>
                        <p class="text-muted mt-md">Nenhum pagamento registrado ainda.</p>
                    </div>
                `}
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'student');
});

// Mercado Pago V1 Integration Helper
window.MercadoPagoHelper = {
    subscribe: async (plan_id) => {
        const user = auth.getCurrentUser();
        if (!user) return UI.showNotification('Erro', 'Usuário não autenticado', 'error');

        UI.showLoading('Gerando link de pagamento...');
        try {
            const subscribeMP = firebase.functions().httpsCallable('subscribeMP');
            const result = await subscribeMP({
                email: user.email,
                plan_id: plan_id || 'plano_padrao_tfit'
            });

            UI.hideLoading();
            if (result.data.success && result.data.checkout_url) {
                // Open in new tab/WebView
                window.open(result.data.checkout_url, '_blank');
                UI.showNotification('Sucesso', 'Link de checkout aberto. Após o pagamento, seu acesso será liberado em instantes.', 'success');
            } else {
                throw new Error(result.data.error || 'Erro ao gerar checkout');
            }
        } catch (error) {
            UI.hideLoading();
            UI.showNotification('Erro', error.message, 'error');
        }
    }
};

window.viewMarketplaceReceipt = (paymentId) => {
    const payment = db.getById('pagamentos', paymentId);
    if (!payment) return UI.showNotification('Erro', 'Pagamento não encontrado.', 'error');

    const personal = db.getById('profiles', payment.personal_id);
    const plan = db.getById('planos_personal', payment.plano_id);

    const modalContent = `
        <div class="receipt-container p-lg" style="font-family: monospace; border: 1px dashed var(--border); background: var(--bg-card);">
            <div class="text-center mb-xl">
                <h2 style="margin-bottom: 5px;">RECIBO TFIT</h2>
                <div class="text-xs text-muted">Comprovante de Pagamento Marketplace</div>
            </div>
            
            <div class="flex flex-col gap-sm mb-xl">
                <div class="flex justify-between">
                    <span class="text-muted">ID Transação:</span>
                    <span class="font-bold">${payment.mercado_pago_id}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-muted">Data:</span>
                    <span>${new Date(payment.data_pagamento).toLocaleString('pt-BR')}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-muted">Destinatário:</span>
                    <span>${personal?.name || 'Personal Trainer'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-muted">Plano:</span>
                    <span>${plan?.nome || 'Personal Plan'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-muted">Duração:</span>
                    <span>${plan?.duracao_meses || 1} Mês(es)</span>
                </div>
            </div>
            
            <div class="border-t border-dashed pt-md mt-md flex justify-between items-center">
                <span class="text-lg font-bold">TOTAL PAGO:</span>
                <span class="text-xl font-black text-primary">R$ ${parseFloat(payment.valor).toFixed(2).replace('.', ',')}</span>
            </div>
            
            <div class="mt-xl pt-md text-center" style="border-top: 1px solid var(--border);">
                <span class="badge badge-success">PAGAMENTO APROVADO ✅</span>
            </div>
        </div>
        <div class="mt-lg flex gap-sm">
            <button class="btn btn-outline flex-1" onclick="window.print()">🖨️ Imprimir</button>
            <button class="btn btn-primary flex-1" onclick="UI.closeModal()">Fechar</button>
        </div>
    `;

    UI.showModal('Recibo de Pagamento', modalContent);
};

window.activateAIPlan = () => {
    const user = auth.getCurrentUser();
    if (user && PaymentHelper.hasAIAccess(user) && user.plan_id !== 'trial_free') {
        const paymentStatus = PaymentHelper.getPaymentStatus(user);
        if (paymentStatus === 'paid') {
            UI.showNotification('Plano Ativo 💎', 'Você já possui uma assinatura T-FIT IA ativa.', 'info');
            return;
        }
    }
    // Em vez de ir direto pro checkout, vai para a página de seleção de planos filtrada para IA
    router.navigate('/payment/plans?filter=ai');
};

/**
 * Handles payment for a specific personal trainer plan.
 */
window.payPersonalPlan = async (planId) => {
    const user = auth.getCurrentUser();
    if (!planId) return UI.showNotification('Erro', 'Plano não identificado.', 'error');

    UI.showLoading('Buscando detalhes do plano...');
    try {
        // 1. Try Marketplace Tables
        let plan = db.getById('planos_personal', planId);

        // 2. Fallback to Legacy Tables
        if (!plan) {
            plan = db.getById('plans', planId);
        }

        if (!plan) throw new Error('Plano não encontrado no sistema T-FIT.');

        // Field Normalization (Handle both schemas)
        const name = plan.nome || plan.name || 'Plano Personal';
        const price = plan.preco || plan.price || 0;
        const owner = plan.personal_id || plan.created_by;

        UI.hideLoading();
        window.startCheckout(price, name, planId, owner, 'marketplace_plan');
    } catch (err) {
        UI.hideLoading();
        console.error("Erro ao buscar plano para pagamento:", err);
        UI.showNotification('Erro', err.message, 'error');
    }
};

// Access Control Helper
const checkAccess = (actionType) => {
    const user = auth.getCurrentUser();
    if (!user) return false;

    // Direct check for admin
    if (user.role === 'admin') return true;

    let allowed = false;
    const actionLabel = actionType === 'diet' ? 'Gerar Dieta IA' : 'Gerar Treino IA';

    // handlePremiumAction will show the modal if not allowed
    // We pass 'ai' as the permission type
    PaymentHelper.handlePremiumAction(actionLabel, user, () => {
        allowed = true;
    }, 'ai');

    return allowed;
};

router.addRoute('/student/dashboard', async () => {
    try {
        console.log('📌 Iniciando Renderização: Student Dashboard');

        if (!auth.requireAuth('student')) {
            console.warn('⛔ Acesso negado ao dashboard');
            return;
        }

        // Force strict session sync with DB with 3s timeout
        try {
            await Promise.race([
                auth.refreshUser(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Dashboard Sync Timeout')), 3000))
            ]);
        } catch (e) {
            console.warn('[Dashboard] Continuando sem refresh completo:', e.message);
        }

        const currentUser = auth.getCurrentUser();
        if (!currentUser) throw new Error("Usuário não encontrado na sessão");

        console.log('👤 Usuário:', currentUser.email);

        // --- MIGRATION: SELF-HEALING CONTRACTS ---
        const myContracts = typeof db !== 'undefined' ? db.query('contracts', c => c.student_id === currentUser.id) : [];

        // ... (restante do código)

        if (currentUser.assigned_personal_id && myContracts.length === 0) {
            // Create backfill contract - Matching current public.contracts schema
            db.create('contracts', {
                student_id: currentUser.id,
                personal_id: currentUser.assigned_personal_id,
                status: (currentUser.status === 'active' && PaymentHelper.getPaymentStatus(currentUser) === 'paid') ? 'active' : 'pending_payment',
                start_date: new Date().toISOString()
            });
            // Refresh query
            // myContracts = db.query('contracts', c => c.studentId === currentUser.id); 
            // (We can just reload page or let next render handle it, but for now let's just proceed)
        }

        // Check payment status
        const accessCheck = PaymentHelper.checkStudentAccess(currentUser);

        // Determine active plans
        const hasAI = PaymentHelper.hasAIAccess(currentUser);
        // const hasPersonal = !!currentUser.assigned_personal_id; // OLD CHECK
        const hasPersonal = myContracts.some(c => c.status === 'active'); // NEW CHECK

        // Fetch data
        // Fetch data and ensure uniqueness
        const allWorkouts = db.query('workouts', w => w.student_id === currentUser.id);
        const workouts = allWorkouts.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
        
        // Separação de treinos: IA vs Personal (conforme item 4 do objetivo)
        const aiWorkouts = workouts.filter(w => w.personal_name === 'T-FIT AI' || w.personal_name === 'SISTEMA' || !w.personal_name);
        const personalWorkouts = workouts.filter(w => w.personal_name !== 'T-FIT AI' && w.personal_name !== 'SISTEMA' && w.personal_name);

        const diets = db.query('diets', d => d.student_id === currentUser.id);
        const personalDiet = diets.find(d => d.personal_name !== 'T-FIT AI' && d.personal_name !== 'SISTEMA');
        const personalWorkout = personalWorkouts[0];
        const aiDiet = diets.find(d => d.personal_name === 'T-FIT AI' || d.personal_name === 'SISTEMA');
        const completions = db.query('workout_completions', c => c.student_id === currentUser.id);
        const nextWorkout = getNextWorkout(currentUser, workouts);
        const heroWorkout = nextWorkout || workouts[0];

        // Use the permissions already determined
        const hasAI_final = hasAI;
        const hasPersonal_final = hasPersonal;

        // Calculate stats
        const today = new Date().toDateString();
        const completedToday = completions.filter(c => new Date(c.completed_at).toDateString() === today).length;


        let content = `
        <!-- Error Reporting Banner -->
        ${typeof UI.getErrorBannerHTML === 'function' ? UI.getErrorBannerHTML() : ''}

        <!-- Trial Banner / Activation Card -->
        ${(() => {
                if (accessCheck.status === 'blocked' && !currentUser.trial_used && !currentUser.trial_started_at) {
                    return `
                    <div class="card mb-xl shadow-glow" style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: white; border: none; border-radius: 20px;">
                        <div class="card-body text-center p-xl">
                            <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 10px;">Período de Experiência 🎁</h2>
                            <p style="opacity: 0.9; margin-bottom: 20px; font-size: 0.95rem;">
                                Você ainda não ativou seu teste grátis! Deseja ativar agora <b>3 DIAS</b> de acesso TOTAL a todas as funções com IA?
                            </p>
                            <button class="btn btn-primary shadow-glow py-md" style="background: white; color: #4f46e5; border: none; font-weight: 800; width: 100%; font-size: 1.1rem; border-radius: 12px; margin-bottom: 10px;" onclick="window.PaymentHelper.activateTrial('${currentUser.id}')">
                                🚀 Ativar 3 Dias Grátis
                            </button>
                            <button class="btn btn-ghost py-md" style="color: rgba(255,255,255,0.7); font-size: 0.9rem;" onclick="this.parentElement.parentElement.style.display='none'">
                                Agora não
                            </button>
                        </div>
                    </div>
                    `;
                }
                if (accessCheck.status === 'trial') {
                    const trial = PaymentHelper.getTrialStatus(currentUser);
                    const isLastDay = trial.daysLeft <= 1;
                    return `
                    <div class="card mb-xl" style="background: ${isLastDay ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)'}; border: 2px solid ${isLastDay ? '#ef4444' : 'var(--primary)'}; border-radius: 20px;">
                        <div class="card-body flex justify-between items-center p-lg">
                            <div>
                                <h3 style="color: ${isLastDay ? '#ef4444' : 'var(--primary)'}; font-size: 1.1rem; font-weight: 800; margin-bottom: 4px;">
                                    ${isLastDay ? '⚠️ Último Dia de Teste!' : '🎁 Teste Grátis Ativo'}
                                </h3>
                                <p class="mb-0 text-muted" style="font-size: 0.9rem;">
                                    Falta${trial.daysLeft === 1 ? '' : 'm'} <b>${trial.daysLeft} dia${trial.daysLeft === 1 ? '' : 's'}</b> para o bloqueio.
                                </p>
                            </div>
                            <button class="btn btn-primary" style="background: ${isLastDay ? '#ef4444' : 'var(--primary)'}; border: none;" onclick="router.navigate('/payment/plans?filter=ai')">
                                Assinar Agora
                            </button>
                        </div>
                    </div>
                `;
                }
                return '';
            })()}


        <!-- Removed personal trainer pending/payment blocks -->

        <!-- 1. ATIVIDADE DIÁRIA (Daily Activity Tracker) -->
        <div class="activity-tracker-card mb-xl shadow-glow">
            <style>
                .activity-tracker-card {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    color: white;
                    border-radius: 24px;
                    padding: 1.5rem;
                    border: 1px solid rgba(255,255,255,0.08);
                    box-shadow: var(--shadow-glow);
                }
                .activity-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                }
                .activity-main-chart {
                    grid-column: span 2;
                    height: 180px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 20px;
                    padding: 1rem;
                    position: relative;
                }
                .summary-item {
                    text-align: center;
                    background: rgba(255,255,255,0.05);
                    padding: 1rem;
                    border-radius: 16px;
                }
                .summary-val {
                    font-size: 1rem;
                    font-weight: 800;
                    color: #818cf8;
                }
                .summary-lbl {
                    font-size: 0.6rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-top: 2px;
                }
                .chart-center-text {
                    position: absolute;
                    top: 60%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    pointer-events: none;
                }
                .btn-caminhada {
                    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 8px 16px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
                .btn-caminhada:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(99, 102, 241, 0.4);
                }
            </style>
            
            <div class="flex justify-between items-center mb-lg">
                <h3 class="mb-0" style="font-size: 1.1rem;">Atividade Diária 🔥</h3>
                <button class="btn-caminhada" onclick="window.logDailyActivity()">
                    🚶 INICIAR CAMINHADA
                </button>
            </div>
            
            <div class="activity-grid">
                <div class="activity-main-chart">
                    <canvas id="dailyActivityChart"></canvas>
                    <div class="chart-center-text">
                        <div style="font-size: 1.5rem; font-weight: 800; color: #fbbf24;" id="chart-calories">0</div>
                        <div style="font-size: 0.6rem; color: #94a3b8; text-transform: uppercase;">kcal</div>
                    </div>
                </div>
                
                <div class="summary-item" style="grid-column: span 2; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; background: transparent; padding: 0;">
                    <div class="summary-item" style="background: rgba(255,255,255,0.05);">
                        <div class="summary-lbl">Hoje</div>
                        <div class="summary-val" id="today-steps" style="color: #6366f1;">0</div>
                    </div>
                    <div class="summary-item" style="background: rgba(255,255,255,0.05);">
                        <div class="summary-lbl">Semana</div>
                        <div class="summary-val" id="weekly-steps">0</div>
                    </div>
                    <div class="summary-item" style="background: rgba(255,255,255,0.05);">
                        <div class="summary-lbl">Mês</div>
                        <div class="summary-val" id="monthly-steps">0</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. TREINO DO DIA (Hero section) -->
        ${heroWorkout ? `
            <div class="today-workout-hero mb-xl shadow-glow">
                <style>
                    .today-workout-hero {
                        background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                        border-radius: 28px;
                        padding: 2rem;
                        color: white;
                        position: relative;
                        overflow: hidden;
                        box-shadow: var(--shadow-glow);
                    }
                    .today-workout-hero::after {
                        content: '';
                        position: absolute;
                        top: -50%;
                        right: -10%;
                        width: 200px;
                        height: 200px;
                        background: rgba(255,255,255,0.1);
                        border-radius: 50%;
                        filter: blur(40px);
                    }
                    .hero-content {
                        position: relative;
                        z-index: 2;
                    }
                    .hero-label {
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        font-size: 0.75rem;
                        font-weight: 800;
                        margin-bottom: 0.5rem;
                        opacity: 0.9;
                    }
                    .hero-title {
                        font-size: 2rem;
                        font-weight: 900;
                        margin-bottom: 1rem;
                        line-height: 1.1;
                    }
                    .hero-meta {
                        display: flex;
                        gap: 1rem;
                        margin-bottom: 1.5rem;
                        font-size: 0.9rem;
                        font-weight: 500;
                    }
                    .btn-start-hero {
                        background: white;
                        color: #4f46e5;
                        border: none;
                        border-radius: 16px;
                        padding: 1rem 2rem;
                        font-size: 1rem;
                        font-weight: 800;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        transition: all 0.3s;
                        box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                        width: fit-content;
                    }
                    .btn-start-hero:hover {
                        transform: scale(1.05);
                        box-shadow: 0 15px 25px rgba(0,0,0,0.15);
                    }
                </style>
                <div class="hero-content">
                    <div class="hero-label">Treino do Dia 🔥</div>
                    <h2 class="hero-title">${heroWorkout.name || 'Seu Treino'}</h2>
                    <div class="hero-meta">
                        <span>⏱️ ${heroWorkout.duration || 45} min</span>
                        <span>💪 ${(heroWorkout.exercises || []).length} exercícios</span>
                    </div>
                    <button class="btn-start-hero" onclick="checkStudentAccess(() => startWorkoutWithMotivation('${heroWorkout.id}'))">
                        <span>▶️</span> INICIAR TREINO AGORA
                    </button>
                </div>
            </div>



            <!-- Estilos Compartilhados de Carrossel -->
            <style>
                .workout-carousel {
                    display: flex;
                    gap: 1rem;
                    overflow-x: auto;
                    padding-bottom: 10px;
                    scroll-snap-type: x mandatory;
                    -webkit-overflow-scrolling: touch;
                }
                .workout-carousel::-webkit-scrollbar { display: none; }
                .workout-slide {
                    min-width: 240px;
                    background: var(--bg-card);
                    border-radius: 20px;
                    padding: 1.25rem;
                    border: 1px solid var(--border);
                    scroll-snap-align: start;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                .workout-slide-label {
                    font-size: 0.6rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: var(--primary-light);
                    margin-bottom: 0.5rem;
                }
                .workout-slide h3 {
                    font-size: 1.1rem;
                    margin-bottom: 0.5rem;
                    font-weight: 700;
                }
                .workout-slide-meta {
                    display: flex;
                    gap: 10px;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-bottom: 1.25rem;
                }
                .workout-slide-btn {
                    padding: 8px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .workout-slide-btn.primary { background: var(--primary); color: white; }
                .workout-slide-btn.outline { background: transparent; border: 1px solid var(--border); color: var(--text-primary); }
            </style>

            <!-- 3. TREINOS DA IA (Carousel) -->
            ${aiWorkouts.length > 0 ? `
                <div class="mb-xl">
                    <div class="flex justify-between items-center mb-md px-1">
                        <h3 class="mb-0" style="font-size: 1.25rem;">TREINO DA IA</h3>
                        <span class="text-xs text-muted" style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px;">Deslize 👉</span>
                    </div>
                    <div class="workout-carousel">

                        ${aiWorkouts.map(w => `
                                    <div class="workout-slide">
                                        <div class="workout-slide-label">INTELIGÊNCIA ARTIFICIAL 🤖</div>
                                        <h3>${w.name || 'Treino IA'}</h3>
                                        <div class="workout-slide-meta">
                                            <span>⏱️ ${w.duration || 0} min</span>
                                            <span>🔥 ${(w.exercises || []).length} ex.</span>
                                        </div>
                                        <div class="flex flex-col gap-sm w-full mt-auto">
                                            <button class="workout-slide-btn primary" onclick="checkStudentAccess(() => startWorkoutWithMotivation('${w.id}'))">
                                                <span>▶️</span> INICIAR
                                            </button>
                                            <button class="workout-slide-btn outline" onclick="router.navigate('/student/workout/details/${w.id}')">
                                                DETALHES
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                    </div>
                </div>
            ` : ''}


        ` : ''}

        <!-- 5. INTELIGÊNCIA T-FIT IA (AI Section) MOVED -->
        <div class="ai-card-premium mb-xl shadow-glow relative overflow-hidden">
            <style>
                .ai-card-premium {
                    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
                    border-radius: 28px;
                    padding: 1.8rem;
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    position: relative;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
                }
                .ai-card-premium::before {
                    content: '';
                    position: absolute;
                    top: -50px; right: -50px;
                    width: 200px; height: 200px;
                    background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%);
                    border-radius: 50%;
                    pointer-events: none;
                }
                .btn-ai-glow-v2 {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    border-radius: 20px;
                    padding: 1.2rem 0.5rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                    cursor: pointer;
                }
                .btn-ai-glow-v2:hover {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(99, 102, 241, 0.5);
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.2), 0 0 15px rgba(99, 102, 241, 0.2);
                }
                .btn-ai-glow-v2 .icon {
                    font-size: 2.2rem;
                    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
                    transition: transform 0.3s ease;
                }
                .btn-ai-glow-v2:hover .icon {
                    transform: scale(1.1);
                }
                .btn-ai-glow-v2 .label {
                    font-weight: 700;
                    font-size: 0.65rem;
                    letter-spacing: 0px;
                    text-align: center;
                    opacity: 0.9;
                    white-space: nowrap;
                }
                .ai-badge {
                    background: linear-gradient(90deg, #6366f1, #a855f7);
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 1px;
                    color: white;
                    box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
                }
            </style>
            
            <div class="flex justify-between items-start mb-lg relative z-10">
                <div>
                    <h2 style="font-size: 1.4rem; font-weight: 800; color: white; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        T-FIT IA <span style="font-size:1.2rem;">✨</span>
                    </h2>
                    <p style="color: rgba(255,255,255,0.6); font-size: 0.85rem; margin: 0;">O poder da Inteligência Artificial</p>
                </div>
                <span class="ai-badge">PRO EXCLUSIVE</span>
            </div>
            
            <div class="grid grid-3 gap-sm relative z-10">
                <div class="btn-ai-glow-v2" onclick="window.PaymentHelper.handlePremiumAction('Gerar Treino IA', null, () => openAIWorkoutGenerator(), 'ai')">
                    <div class="icon">🏋️</div>
                    <span class="label">GERAR TREINO COM IA</span>
                    ${!hasAI ? '<div class="lock-icon" style="position: absolute; top: 5px; right: 5px; font-size: 10px;">🔒</div>' : ''}
                </div>
                <div class="btn-ai-glow-v2" onclick="window.PaymentHelper.handlePremiumAction('Gerar Dieta IA', null, () => openAIDietGenerator(), 'ai')">
                    <div class="icon">🥗</div>
                    <span class="label">GERAR DIETA COM IA</span>
                    ${!hasAI ? '<div class="lock-icon" style="position: absolute; top: 5px; right: 5px; font-size: 10px;">🔒</div>' : ''}
                </div>
                <div class="btn-ai-glow-v2" onclick="window.PaymentHelper.handlePremiumAction('Gerar Avaliação IA', null, () => openAssessmentGenerator(), 'ai')">
                    <div class="icon">📸</div>
                    <span class="label">GERAR AVALIAÇÃO COM IA</span>
                    ${!hasAI ? '<div class="lock-icon" style="position: absolute; top: 5px; right: 5px; font-size: 10px;">🔒</div>' : ''}
                </div>
            </div>
        </div>

        <!-- 4. ATIVIDADE SEMANAL (Weekly Progress) MOVED -->
        <div class="chart-container mb-xl shadow-sm">
            <style>
                .chart-container {
                    background: var(--bg-card);
                    border-radius: 24px;
                    padding: 1.5rem;
                    border: 1px solid var(--border);
                }
            </style>
            <h3 class="card-title mb-md" style="font-size: 1.1rem;">📊 Atividade Semanal</h3>
            <div style="height: 200px; position: relative;">
                <canvas id="progressChart"></canvas>
            </div>
        </div>

        <!-- 3.5. DIETAS E TREINOS -->
        <div class="mb-xl">
            <div class="flex justify-between items-center mb-md px-1">
                <h3 class="mb-0" style="font-size: 1.25rem;">VISUALIZAR DIETAS</h3>
            </div>
            
            <div class="grid grid-1">
                <!-- Dieta com IA -->
                <div class="card shadow-md relative overflow-hidden text-left cursor-pointer" style="border-radius: 20px; border: 1px solid rgba(168,85,247,0.3); background: linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(168,85,247,0.05) 100%);" 
                     onclick="window.PaymentHelper.handlePremiumAction('Dieta IA', null, () => router.navigate('/student/nutrition'), 'ai')">
                    ${aiDiet ? `
                        <div class="badge" style="position: absolute; top: 10px; right: 10px; font-size: 0.6rem; background: linear-gradient(90deg, #6366f1, #a855f7); color: white;">IA</div>
                        <div class="p-md flex flex-col justify-between h-full">
                            <div>
                                <div style="font-size: 2.2rem; margin-bottom: 0.2rem;">🤖</div>
                                <h4 class="mb-xs" style="font-size: 1.1rem; font-weight: 800;">DIETA COM IA</h4>
                            </div>
                            <div class="text-sm font-bold mt-sm" style="color: #a855f7;">${aiDiet.calories || 0} kcal</div>
                        </div>
                    ` : `
                        <div class="badge" style="position: absolute; top: 10px; right: 10px; font-size: 0.6rem; background: rgba(0,0,0,0.1); color: var(--text-muted);">VAZIO</div>
                        <div class="p-md flex flex-col justify-between h-full">
                            <div>
                                <div style="font-size: 2.2rem; margin-bottom: 0.2rem; filter: grayscale(1); opacity: 0.5;">🤖</div>
                                <h4 class="mb-xs" style="font-size: 1.1rem; font-weight: 800; color: var(--text-muted);">DIETA COM IA</h4>
                                <p class="text-xs text-muted mb-0">GERAR NOVA DIETA COM IA</p>
                            </div>
                            <div class="text-xs mt-sm font-bold" style="color: #a855f7;">Gerar →</div>
                        </div>
                    `}
                </div>
            </div>

            </div>
        </div>

        <!-- 3.6 ACOMPANHAMENTO (Registro e Gamification) -->
        <div class="mb-xl">
            <div class="flex justify-between items-center mb-md px-1">
                <h3 class="mb-0" style="font-size: 1.25rem;">MEU ACOMPANHAMENTO</h3>
            </div>

            <!-- Card de Registro Diário -->
            <div class="card shadow-md relative overflow-hidden text-left cursor-pointer mt-sm" style="border-radius: 20px; border: 1px solid var(--border); background: linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(5,150,105,0.05) 100%);" onclick="router.navigate('/student/progress')">
                <div class="p-md flex items-center justify-between">
                    <div class="flex items-center gap-md">
                        <div style="font-size: 2.2rem;">📏</div>
                        <div>
                            <h4 class="mb-xs" style="font-size: 1.1rem; font-weight: 800;">Registro Diário</h4>
                            <p class="text-xs text-muted mb-0">Registrar e acessar dados de IMC</p>
                        </div>
                    </div>
                    <div class="text-xs font-bold" style="color: var(--primary);">Abrir →</div>
                </div>
            </div>

            <!-- Painel de Saldo Atual & Convites -->
            <div class="card shadow-glow mt-sm mb-lg relative overflow-hidden" style="border-radius: 20px; border: 1px solid rgba(251,191,36,0.2); background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);">
                <div class="p-lg flex justify-between items-center flex-wrap gap-md">
                    <div>
                        <p class="text-xs text-indigo-300 uppercase tracking-widest font-black mb-xs">Saldo Atual</p>
                        <div class="flex items-center gap-sm">
                            <span style="font-size: 2.2rem; filter: drop-shadow(0 2px 5px rgba(251,191,36,0.5));">💎</span>
                            <h2 class="text-4xl font-black text-white mb-0" id="dash-tpoints-balance">${currentUser.t_points || 0}</h2>
                        </div>
                    </div>
                    <button class="btn font-black shadow-sm p-sm" style="background: #fbbf24; color: #78350f; border-radius: 12px; border: none; min-width: 140px; font-size: 0.85rem;" onclick="router.navigate('/student/convites')">
                        🚀 CONVIDE E GANHE
                    </button>
                </div>
            </div>

            <!-- Card T-Points & Missões -->
            <div class="card shadow-md relative overflow-hidden text-left cursor-pointer mt-sm" style="border-radius: 20px; border: 1px solid rgba(139,92,246,0.3); background: linear-gradient(135deg, rgba(139,92,246,0.05) 0%, rgba(109,40,217,0.05) 100%);" onclick="router.navigate('/student/missoes')">
                <div class="p-md flex items-center justify-between">
                    <div class="flex items-center gap-md">
                        <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(139,92,246,0.4));">🏆</div>
                        <div>
                            <h4 class="mb-xs" style="font-size: 1.1rem; font-weight: 800; color: #a78bfa;">T-Points & Missões</h4>
                            <p class="text-xs text-muted mb-0">Ver meu saldo e missões ativas</p>
                        </div>
                    </div>
                    <div class="text-xs font-bold" style="color: #a78bfa;">Ver Tudo →</div>
                </div>
            </div>


            <!-- Card Loja de Recompensas -->
            <div class="card shadow-md relative overflow-hidden text-left cursor-pointer mt-sm" style="border-radius: 20px; border: 1px solid rgba(245,158,11,0.3); background: linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(217,119,6,0.05) 100%);" onclick="router.navigate('/student/loja')">
                <div class="badge" style="position: absolute; top: 10px; right: 10px; font-size: 0.6rem; background: linear-gradient(90deg, #f59e0b, #d97706); color: white; border-radius: 10px; padding: 2px 8px; font-weight: bold;">T-POINTS</div>
                <div class="p-md flex items-center justify-between">
                    <div class="flex items-center gap-md">
                        <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(245,158,11,0.4));">🛒</div>
                        <div>
                            <h4 class="mb-xs" style="font-size: 1.1rem; font-weight: 800; color: #fbbf24;">Loja de Recompensas</h4>
                            <p class="text-xs text-muted mb-0">Troque pontos por benefícios exclusivos</p>
                        </div>
                    </div>
                    <div class="text-xs font-bold" style="color: #fbbf24;">Visitar →</div>
                </div>
            </div>
        </div>



        
        <!-- Instagram Connect & Follow Section -->
        <div class="instagram-footer card mb-xl shadow-glow" style="background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%); color: white; border: none; border-radius: 28px; padding: 1.5rem; margin-top: 1rem;">
            <style>
                .insta-btn {
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    border-radius: 16px;
                    padding: 0.75rem 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: all 0.3s;
                    backdrop-filter: blur(5px);
                    font-weight: 700;
                    width: 100%;
                    cursor: pointer;
                    text-decoration: none;
                }
                .insta-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                }
            </style>
            <div class="flex flex-col gap-md">
                <div class="text-center mb-xs">
                    <h3 style="color: white; margin-bottom: 4px;">Comunidade T-FIT 📸</h3>
                    <p style="color: rgba(255,255,255,0.8); font-size: 0.8rem; margin: 0;">Conecte sua conta e acompanhe as novidades!</p>
                </div>
                <div class="grid grid-2 gap-md">
                    <button class="insta-btn" onclick="UI.showProfileEditor()">
                        <span>🔗</span>
                        <span style="font-size: 0.8rem;">Conectar Instagram</span>
                    </button>
                    <button class="insta-btn" onclick="window.open('https://instagram.com/tfit_app', '_blank')">
                        <span>📸</span>
                        <span style="font-size: 0.8rem;">Siga @TFIT_APP</span>
                    </button>
                </div>
            </div>
        </div>
    `;

        UI.renderDashboard(content, 'student');
        if (window.startAdCarousel) window.startAdCarousel();

        // Initialize Progress Charts
        if (hasAI || hasPersonal) {
            setTimeout(() => {
                // --- DAILY ACTIVITY CHART (Steps & Calories) ---
                const dailyCtx = document.getElementById('dailyActivityChart');
                if (dailyCtx) {
                    const d = new Date();
                    const todayStr = `${d.getFullYear()
                        }-${(d.getMonth() + 1).toString().padStart(2, '0')} -${d.getDate().toString().padStart(2, '0')} `;
                    const logs = db.query('activity_logs', l => l.student_id === currentUser.id) || [];
                    const todayLog = logs.find(l => {
                        if (!l.date) return false;
                        return l.date.substring(0, 10) === todayStr;
                    }) || { steps: 0, calories: 0 };

                    // Targets
                    const stepTarget = 10000;
                    const calTarget = 500;

                    new Chart(dailyCtx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Passos', 'Meta', 'Calorias', 'Meta'],
                            datasets: [
                                {
                                    label: 'Passos',
                                    data: [todayLog.steps, Math.max(0, stepTarget - todayLog.steps)],
                                    backgroundColor: ['#6366f1', 'rgba(255,255,255,0.1)'],
                                    borderWidth: 0,
                                    circumference: 180,
                                    rotation: 270,
                                    cutout: '80%'
                                },
                                {
                                    label: 'Calorias',
                                    data: [todayLog.calories, Math.max(0, calTarget - todayLog.calories)],
                                    backgroundColor: ['#fbbf24', 'rgba(255,255,255,0.1)'],
                                    borderWidth: 0,
                                    circumference: 180,
                                    rotation: 270,
                                    cutout: '65%'
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: { enabled: true }
                            }
                        }
                    });

                    document.getElementById('chart-calories').innerText = (todayLog.calories || 0).toLocaleString();
                    document.getElementById('today-steps').innerText = (todayLog.steps || 0).toLocaleString();

                    // Calculate Weekly/Monthly
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

                    const weeklyLogs = logs.filter(l => new Date(l.date) >= oneWeekAgo);
                    const monthlyLogs = logs.filter(l => new Date(l.date) >= oneMonthAgo);

                    const weeklySteps = weeklyLogs.reduce((acc, curr) => acc + (curr.steps || 0), 0);
                    const monthlySteps = monthlyLogs.reduce((acc, curr) => acc + (curr.steps || 0), 0);

                    document.getElementById('weekly-steps').innerText = weeklySteps.toLocaleString();
                    document.getElementById('monthly-steps').innerText = monthlySteps.toLocaleString();
                }

                // --- WEEKLY ACTIVITY BARS ---
                const ctx = document.getElementById('progressChart');
                if (ctx) {
                    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                    const completionsByDay = new Array(7).fill(0);
                    const now = new Date();
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(now.getDate() - 7);
                    const studentCompletions = db.query('workout_completions', c =>
                        c.student_id === currentUser.id && new Date(c.completed_at) >= oneWeekAgo
                    );
                    studentCompletions.forEach(c => {
                        const day = new Date(c.completed_at || c.completedAt).getDay();
                        if (!isNaN(day)) completionsByDay[day]++;
                    });
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: days,
                            datasets: [{
                                label: 'Treinos',
                                data: completionsByDay,
                                backgroundColor: '#6366f1',
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' } },
                                x: { ticks: { color: '#94a3b8' } }
                            }
                        }
                    });
                }
            }, 300);
        }
    } catch (error) {
        console.error('❌ Erro no Dashboard do Aluno:', error);
        UI.renderDashboard(`
        <div class="text-center p-xl" >
                <h3>Ops! Erro ao carregar seu dashboard</h3>
                <p class="text-muted">${error.message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Recarregar</button>
            </div>
        `, 'student');
    }
});

// --- Actions ---
window.cancelAIPlan = () => {
    UI.confirmDialog(
        'Cancelar Plano IA',
        'Tem certeza que deseja cancelar sua assinatura T-FIT IA? Você perderá o acesso aos treinos e dietas gerados por inteligência artificial.',
        () => {
            const currentUser = auth.getCurrentUser();
            db.update('profiles', currentUser.id, {
                ai_active: false,
                mode: 'manual',
                assigned_personal_id: null,
                personal_name: null
            });

            // Update session
            const freshUser = db.getById('profiles', currentUser.id);
            freshUser.type = 'student';
            auth.saveSession(freshUser);

            UI.showNotification('Plano Cancelado', 'Sua assinatura T-FIT IA foi cancelada com sucesso.', 'info');
            router.navigate('/student/dashboard');
        }
    );
};

window.cancelPersonalPlan = () => {
    UI.confirmDialog(
        'Cancelar Parceria',
        'Tem certeza que deseja cancelar sua parceria com este Personal Trainer? Seus treinos e dietas atuais podem ficar indisponíveis.',
        () => {
            const currentUser = auth.getCurrentUser();
            db.update('profiles', currentUser.id, {
                assigned_personal_id: null,
                personal_name: null,
                status: 'pending'
            });

            // Update session
            const freshUser = db.getById('profiles', currentUser.id);
            freshUser.type = 'student';
            auth.saveSession(freshUser);

            UI.showNotification('Parceria Encerrada', 'Sua parceria com o Personal Trainer foi encerrada.', 'info');
            router.navigate('/student/dashboard');
        }
    );
};

// ============================================
// PEDOMETER - Contador de Passos PRECISO
// ============================================
// Algoritmo: Detecta PADRÃO de caminhada real
// - Exige múltiplos passos em ritmo consistente
// - Ignora tremores e balançar casual
// ============================================
const Pedometer = {
    // Estado público
    steps: 0,
    calories: 0,
    distance: 0,
    isRunning: false,
    startTime: null,

    // Configuração (ajustada para precisão)
    sensitivity: 1.5,      // Threshold MAIS ALTO (ignora tremores leves)
    minStepTime: 250,      // Mínimo ms entre passos (corrida rápida)
    maxStepTime: 1200,     // Máximo ms entre passos (caminhada lenta)
    confirmSteps: 4,       // Quantidade de passos para CONFIRMAR caminhada

    // Interno - Detecção
    _listener: null,
    _interval: null,
    _updateCallback: null,

    // Buffer de amostras
    _samples: [],
    _sampleSize: 8,       // Média móvel maior = mais suave

    // Detecção de picos
    _wasAbove: false,
    _lastPeakTime: 0,
    _peakValue: 0,

    // Validação de padrão de caminhada
    _pendingSteps: 0,      // Passos candidatos (ainda não confirmados)
    _stepIntervals: [],    // Intervalos entre passos recentes
    _isWalking: false,     // Se o padrão de caminhada foi detectado
    _lastConfirmTime: 0,

    start(onUpdate) {
        if (this.isRunning) return;

        // Reset completo
        this.steps = 0;
        this.calories = 0;
        this.distance = 0;
        this.startTime = Date.now();
        this._samples = [];
        this._wasAbove = false;
        this._lastPeakTime = 0;
        this._peakValue = 0;
        this._pendingSteps = 0;
        this._stepIntervals = [];
        this._isWalking = false;
        this._lastConfirmTime = 0;
        this._updateCallback = onUpdate;
        this.isRunning = true;

        // Handler do acelerômetro
        this._listener = (event) => {
            const acc = event.accelerationIncludingGravity || event.acceleration;
            if (!acc || acc.x === null) return;

            // Calcular magnitude da aceleração
            const mag = Math.sqrt(
                (acc.x || 0) ** 2 +
                (acc.y || 0) ** 2 +
                (acc.z || 0) ** 2
            );

            // Buffer de média móvel
            this._samples.push(mag);
            if (this._samples.length > this._sampleSize) {
                this._samples.shift();
            }

            // Precisamos de amostras suficientes
            if (this._samples.length < this._sampleSize) return;

            // Média suavizada
            const avgMag = this._samples.reduce((a, b) => a + b, 0) / this._samples.length;
            const now = Date.now();

            // Threshold dinâmico baseado na gravidade (~9.8)
            const threshold = 9.8 + this.sensitivity;

            // Detectar PICO (subida)
            if (avgMag > threshold && !this._wasAbove) {
                this._wasAbove = true;
                this._peakValue = avgMag;
            }
            // Detectar pico mais alto durante subida
            else if (this._wasAbove && avgMag > this._peakValue) {
                this._peakValue = avgMag;
            }
            // Detectar DESCIDA (final do passo)
            else if (avgMag < 9.2 && this._wasAbove) { // Sensibilidade levemente ajustada para detecção de descida
                const now = Date.now();
                const interval = now - this._lastPeakTime;

                // Verificar se intervalo está dentro do range de caminhada
                if (interval >= this.minStepTime && interval <= this.maxStepTime) {
                    this._registerStep(interval, now);
                } else if (interval > this.maxStepTime) {
                    // Intervalo muito longo = parou de caminhar
                    this._resetWalkingState();
                }

                this._lastPeakTime = now;
                this._wasAbove = false;
                this._peakValue = 0;
            }
        };

        // Verificar permissão iOS
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permission => {
                    if (permission === 'granted') {
                        this._startListening();
                    } else {
                        UI.showNotification('Permissão Negada', 'Permita o sensor de movimento.', 'error');
                        this.isRunning = false;
                    }
                })
                .catch(() => this._startListening());
        } else if (window.DeviceMotionEvent) {
            this._startListening();
        } else {
            UI.showNotification('Erro', 'Sensor de movimento não suportado.', 'error');
            this.isRunning = false;
        }
    },

    _startListening() {
        window.addEventListener('devicemotion', this._listener);
        if (this._interval) clearInterval(this._interval);
        this._interval = setInterval(() => {
            if (this.isRunning && this._updateCallback) {
                this._updateCallback(this.getStats());
            }
        }, 500);
        UI.showNotification('Pronto!', '🚶 Comece a caminhar...', 'success');
    },

    _registerStep(interval, now) {
        // Adicionar intervalo ao histórico
        this._stepIntervals.push(interval);
        if (this._stepIntervals.length > 6) {
            this._stepIntervals.shift();
        }

        if (!this._isWalking) {
            // Ainda não confirmou caminhada
            this._pendingSteps++;

            // Verificar se temos passos suficientes para confirmar
            if (this._pendingSteps >= this.confirmSteps) {
                // Verificar REGULARIDADE dos intervalos
                if (this._isRegularPattern()) {
                    // CONFIRMADO! É caminhada real!
                    this._isWalking = true;
                    this.steps += this._pendingSteps;
                    this._pendingSteps = 0;
                    this._lastConfirmTime = now;
                    this._updateStats();
                } else {
                    // Não é padrão regular, resetar
                    this._resetWalkingState();
                }
            }
        } else {
            // Já está caminhando, adicionar passo diretamente
            this.steps++;
            this._lastConfirmTime = now;
            this._updateStats();

            // Verificar se continua no padrão
            if (!this._isRegularPattern()) {
                // Perdeu o padrão, mas mantém passos já contados
                this._isWalking = false;
                this._pendingSteps = 1;
            }
        }
    },

    _isRegularPattern() {
        // Precisamos de pelo menos 3 intervalos para verificar padrão
        if (this._stepIntervals.length < 3) return true;

        // Calcular média e desvio
        const avg = this._stepIntervals.reduce((a, b) => a + b, 0) / this._stepIntervals.length;
        const variance = this._stepIntervals.reduce((sum, val) => sum + (val - avg) ** 2, 0) / this._stepIntervals.length;
        const stdDev = Math.sqrt(variance);

        // Coeficiente de variação (quanto menor, mais regular)
        const cv = stdDev / avg;

        // Caminhada real tem CV < 40% (intervalos consistentes)
        return cv < 0.4;
    },

    _resetWalkingState() {
        this._pendingSteps = 0;
        this._stepIntervals = [];
        this._isWalking = false;
    },

    _updateStats() {
        const user = auth.getCurrentUser() || {};
        const weight = user.weight || 70;
        const height = user.height || 170;

        this.calories = Math.round(this.steps * 0.04 * (weight / 70));
        const strideM = (height / 100) * 0.415;
        this.distance = (this.steps * strideM) / 1000;
    },

    getStats() {
        const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        return {
            steps: this.steps,
            calories: this.calories,
            distance: this.distance,
            duration: duration,
            isWalking: this._isWalking
        };
    },

    stop() {
        // Adicionar passos pendentes se houver pelo menos 2
        if (this._pendingSteps >= 2 && this._isRegularPattern()) {
            this.steps += this._pendingSteps;
            this._updateStats();
        }

        if (this._listener) {
            window.removeEventListener('devicemotion', this._listener);
        }
        if (this._interval) {
            clearInterval(this._interval);
        }
        this.isRunning = false;
        this._resetWalkingState();
        return this.getStats();
    }
};

window.logDailyActivity = () => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
        UI.showNotification('Erro', 'Usuário não autenticado.', 'error');
        return;
    }

    const d = new Date();
    const todayString = d.toISOString().split('T')[0];

    // Função para buscar log do banco (sempre fresco)
    const getTodayLog = () => {
        const logs = db.query('activity_logs', l => l.student_id === currentUser.id) || [];
        return logs.find(l => {
            if (!l.date) return false;
            return l.date.split('T')[0] === todayString;
        }) || { steps: 0, calories: 0 };
    };

    const todayLog = getTodayLog();

    const content = `
        <div class="p-md text-center">
            
            <!-- MOSTRADOR PRINCIPAL -->
            <div class="mb-lg">
                <div style="font-size: 3.5rem;" class="mb-xs" id="step-icon">👟</div>
                <h1 class="text-4xl font-bold mb-xs" id="step-count" style="color: var(--primary);">
                    ${Pedometer.isRunning ? Pedometer.steps : todayLog.steps}
                </h1>
                <p class="text-muted text-sm uppercase tracking-wide">Passos</p>
                
                <div class="grid grid-2 gap-md mt-md">
                    <div class="bg-light p-md rounded shadow-sm">
                        <div class="text-xl font-bold" id="step-distance">
                            ${Pedometer.isRunning ? Pedometer.distance.toFixed(2) : '0.00'} km
                        </div>
                        <div class="text-xs text-muted uppercase">Distância</div>
                    </div>
                    <div class="bg-light p-md rounded shadow-sm">
                        <div class="text-xl font-bold" id="step-calories">
                            ${Pedometer.isRunning ? Pedometer.calories : todayLog.calories} kcal
                        </div>
                        <div class="text-xs text-muted uppercase">Calorias</div>
                    </div>
                </div>
            </div>

            <!--CONTROLES -->
            <div id="step-controls">
                ${!Pedometer.isRunning ? `
                    <button class="btn btn-success btn-xl w-full shadow-md" onclick="window._startPedometer()">
                        <span class="text-lg">▶ INICIAR CAMINHADA</span>
                    </button>
                ` : `
                    <div class="text-center mb-md">
                        <span class="badge badge-success animate-pulse">● CONTANDO PASSOS</span>
                        <div class="text-2xl font-mono mt-sm" id="step-timer">00:00</div>
                    </div>
                    <button class="btn btn-danger btn-xl w-full shadow-md" onclick="window._stopAndSave()">
                        <span class="text-lg">⏹ PARAR E SALVAR</span>
                    </button>
                `}
            </div>

            <div class="mt-xl border-t pt-md text-left" id="step-history">
                <h4 class="text-xs font-bold mb-sm text-muted uppercase">Histórico de Hoje</h4>
                <div class="flex justify-between text-sm">
                    <span id="history-steps">${todayLog.steps} passos</span>
                    <span id="history-calories">${todayLog.calories} kcal</span>
                </div>
            </div>
        </div>
        `;

    UI.showModal('Atividade Diária 🚶', content);

    // INICIAR PEDÔMETRO
    window._startPedometer = () => {
        const icon = document.getElementById('step-icon');
        if (icon) icon.classList.add('animate-bounce');

        Pedometer.start((stats) => {
            // Atualizar display
            const countEl = document.getElementById('step-count');
            const distEl = document.getElementById('step-distance');
            const calEl = document.getElementById('step-calories');
            const timerEl = document.getElementById('step-timer');

            if (countEl) countEl.innerText = stats.steps;
            if (distEl) distEl.innerText = stats.distance.toFixed(2) + ' km';
            if (calEl) calEl.innerText = stats.calories + ' kcal';

            if (timerEl) {
                const min = Math.floor(stats.duration / 60).toString().padStart(2, '0');
                const sec = (stats.duration % 60).toString().padStart(2, '0');
                timerEl.innerText = `${min}:${sec} `;
            }
        });

        // Atualizar UI para estado "contando"
        const controls = document.getElementById('step-controls');
        if (controls) {
            controls.innerHTML = `
        <div class="text-center mb-md" >
                    <span class="badge badge-success animate-pulse">● CONTANDO PASSOS</span>
                    <div class="text-2xl font-mono mt-sm" id="step-timer">00:00</div>
                </div>
        <button class="btn btn-danger btn-xl w-full shadow-md" onclick="window._stopAndSave()">
            <span class="text-lg">⏹ PARAR E SALVAR</span>
        </button>
    `;
        }
    };

    // PARAR E SALVAR
    window._stopAndSave = async () => {
        const icon = document.getElementById('step-icon');
        if (icon) icon.classList.remove('animate-bounce');

        // Parar e pegar estatísticas
        const stats = Pedometer.stop();

        if (stats.steps === 0) {
            UI.showNotification('Aviso', 'Nenhum passo detectado.', 'warning');
            _resetUI();
            return;
        }

        // Buscar log FRESCO do banco
        const freshLog = getTodayLog();
        const newSteps = (freshLog.steps || 0) + stats.steps;
        const newCalories = (freshLog.calories || 0) + stats.calories;

        // Salvar no banco
        try {
            if (freshLog.id) {
                await db.update('activity_logs', freshLog.id, {
                    steps: newSteps,
                    calories: newCalories,
                    updated_at: new Date().toISOString()
                });
            } else {
                await db.create('activity_logs', {
                    student_id: currentUser.id,
                    date: todayString,
                    steps: newSteps,
                    calories: newCalories,
                    created_at: new Date().toISOString()
                });
            }

            UI.showNotification('Salvo!', `+ ${stats.steps} passos (Total: ${newSteps})`, 'success');

            // Resetar UI primeiro
            _resetUI();

            // Atualizar display APÓS reset (com delay para garantir que elementos existem)
            setTimeout(() => {
                const stepCountEl = document.getElementById('step-count');
                const stepCaloriesEl = document.getElementById('step-calories');
                const stepDistanceEl = document.getElementById('step-distance');
                const historyStepsEl = document.getElementById('history-steps');
                const historyCaloriesEl = document.getElementById('history-calories');

                if (stepCountEl) stepCountEl.innerText = newSteps;
                if (stepCaloriesEl) stepCaloriesEl.innerText = newCalories + ' kcal';
                if (stepDistanceEl) {
                    const height = currentUser.height || 170;
                    const strideM = (height / 100) * 0.415;
                    const totalDist = (newSteps * strideM) / 1000;
                    stepDistanceEl.innerText = totalDist.toFixed(2) + ' km';
                }
                if (historyStepsEl) historyStepsEl.innerText = newSteps + ' passos';
                if (historyCaloriesEl) historyCaloriesEl.innerText = newCalories + ' kcal';
            }, 100);

        } catch (err) {
            console.error('Erro salvando atividade:', err);
            UI.showNotification('Erro', 'Não foi possível salvar. Tente novamente.', 'error');
            _resetUI();
        }
    };

    // Resetar UI para estado inicial
    function _resetUI() {
        const controls = document.getElementById('step-controls');
        if (controls) {
            controls.innerHTML = `
                <button class="btn btn-success btn-xl w-full shadow-md" onclick="window._startPedometer()">
                    <span class="text-lg">▶ INICIAR CAMINHADA</span>
                </button>
            `;
        }
        const distEl = document.getElementById('step-distance');
        if (distEl) distEl.innerText = '0.00 km';
    }
};



window.generateStudentWithIA = () => {
    const currentUser = auth.getCurrentUser();

    PaymentHelper.handlePremiumAction('IA T-FIT', currentUser, () => {
        UI.confirmDialog(
            'Gerar com IA ✨',
            'O que você deseja que a IA gere para você hoje?',
            () => window.openAIWorkoutGenerator(),
            '💪 Treino Sob Medida',
            () => window.openAIDietGenerator(),
            '🥗 Dieta Personalizada'
        );
    }, 'ai');
};

// activateAIPlan is defined globally above

window.cancelAIPlan = () => {
    UI.confirmDialog(
        'Cancelar IA',
        'Tem certeza? Você perderá acesso aos treinos automáticos.',
        () => {
            const user = auth.getCurrentUser();
            db.update('profiles', user.id, { ai_active: false });
            UI.showNotification('Cancelado', 'Plano IA desativado.', 'info');
            router.navigate('/student/dashboard');
        }
    );
};


window.viewAIPlan = () => {
    router.navigate('/student/workouts');
};


// --- AI Feature Modals ---

window.openAIWorkoutGenerator = () => {
    if (!checkAccess('workout')) return;
    const user = auth.getCurrentUser();

    let step = 1;
    let answers = {
        'wiz-age': user.age || '',
        'wiz-height': user.height || '',
        'wiz-weight': user.weight || '',
        'wiz-sex': user.sex || 'Feminino'
    };

    const renderStep = () => {
        let title = '';
        let content = '';

        if (step === 1) {
            title = 'Passo 1: Perfil Básico';
            content = `
        <div class="grid grid-2 gap-md" >
                    <div class="form-group">
                        <label class="form-label">Idade</label>
                        <input type="number" class="form-input" id="wiz-age" value="${answers['wiz-age']}" placeholder="Anos">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sexo</label>
                        <select class="form-select" id="wiz-sex">
                            <option value="Feminino" ${answers['wiz-sex'] === 'Feminino' ? 'selected' : ''}>Feminino</option>
                            <option value="Masculino" ${answers['wiz-sex'] === 'Masculino' ? 'selected' : ''}>Masculino</option>
                            <option value="Prefiro não informar" ${answers['wiz-sex'] === 'Prefiro não informar' ? 'selected' : ''}>Prefiro não informar</option>
                        </select>
                    </div>
                </div>
        <div class="grid grid-2 gap-md mt-md">
            <div class="form-group">
                <label class="form-label">Altura (cm)</label>
                <input type="number" class="form-input" id="wiz-height" value="${answers['wiz-height']}" placeholder="Ex: 170">
            </div>
            <div class="form-group">
                <label class="form-label">Peso (kg)</label>
                <input type="number" class="form-input" id="wiz-weight" value="${answers['wiz-weight']}" placeholder="Ex: 70">
            </div>
        </div>
    `;
        } else if (step === 2) {
            title = 'Passo 2: Objetivo e Experiência';
            content = `
        <div class="form-group" >
                    <label class="form-label">1. Qual é seu objetivo principal?</label>
                    <select class="form-select" id="wiz-goal">
                        <option value="Emagrecimento">Emagrecimento</option>
                        <option value="Ganho de massa muscular">Ganho de massa muscular</option>
                        <option value="Definição muscular">Definição muscular</option>
                        <option value="Condicionamento físico">Condicionamento físico</option>
                        <option value="Qualidade de vida">Qualidade de vida e Bem-estar</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">2. Você já treina?</label>
                    <select class="form-select" id="wiz-experience">
                        <option value="Nunca treinei">Nunca treinei</option>
                        <option value="Iniciante (até 6 meses)">Iniciante (até 6 meses)</option>
                        <option value="Intermediário (6 meses a 2 anos)">Intermediário (6 meses a 2 anos)</option>
                        <option value="Avançado (mais de 2 anos)">Avançado (mais de 2 anos)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">3. Que tipo de treino você já fez ou faz?</label>
                    <div class="grid grid-2 gap-xs">
                        ${['Musculação', 'Funcional', 'Cross / HIIT', 'Corrida / Cardio', 'Nenhum', 'Outro'].map(t => `
                            <label class="flex items-center gap-sm p-sm border rounded cursor-pointer hover-bg-light">
                                <input type="checkbox" name="wiz-previous-types" value="${t}" ${(answers['wiz-previous-types'] || []).includes(t) ? 'checked' : ''}>
                                <span class="text-sm">${t}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group mt-md border-t pt-sm">
                    <label class="form-label text-primary">★ Personalização Profissional (Opcional)</label>
                    
                    <label class="form-label mt-sm text-sm">Foco Principal (Escreva livremente)</label>
                    <p class="text-xs text-muted mb-xs">Ex: "Quero focar na largura das costas e pico do bíceps"</p>
                    <textarea class="form-input" id="wiz-focus-text" rows="2" placeholder="Descreva seu foco detalhadamente...">${answers['wiz-focus-text'] || ''}</textarea>

                    <label class="form-label mt-md text-sm">Volume / Quantidade de Exercícios</label>
                    <p class="text-xs text-muted mb-xs">Ex: "Quero 7 exercícios para pernas e 4 para panturrilha"</p>
                    <textarea class="form-input" id="wiz-volume-text" rows="2" placeholder="Defina a quantidade de exercícios se desejar...">${answers['wiz-volume-text'] || ''}</textarea>
                </div>
    `;
        } else if (step === 3) {
            title = 'Passo 3: Rotina e Estrutura';
            content = `
        <div class="form-group" >
                    <label class="form-label">4. Quantos dias por semana pode treinar?</label>
                    <select class="form-select" id="wiz-days">
                        <option value="2 dias">2 dias</option>
                        <option value="3 dias" selected>3 dias</option>
                        <option value="4 dias">4 dias</option>
                        <option value="5 dias">5 dias</option>
                        <option value="6 ou mais">6 ou mais</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">5. Quantos treinos diferentes (fichas) deseja gerar?</label>
                    <select class="form-select" id="wiz-num-workouts">
                        <option value="1">1 Treino (Full Body)</option>
                        <option value="2">2 Treinos (A/B)</option>
                        <option value="3" selected>3 Treinos (A/B/C)</option>
                        <option value="4">4 Treinos (A/B/C/D)</option>
                        <option value="5">5 Treinos (A/B/C/D/E)</option>
                        <option value="6">6 Treinos (A/B/C/D/E/F)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">6. Quanto tempo por treino?</label>
                    <select class="form-select" id="wiz-time">
                        <option value="Até 30 minutos">Até 30 minutos</option>
                        <option value="45 minutos">45 minutos</option>
                        <option value="1 hora" selected>1 hora</option>
                        <option value="Mais de 1 hora">Mais de 1 hora</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">7. Onde irá treinar?</label>
                    <select class="form-select" id="wiz-location">
                        <option value="Academia">Academia</option>
                        <option value="Em casa">Em casa</option>
                        <option value="Ambos">Ambos</option>
                    </select>
                </div>
    `;
        } else if (step === 4) {
            title = 'Passo 4: Performance e Desempenho';
            content = `
        <div class="form-group" >
                    <label class="form-label">10. Possui alguma lesão, dor ou limitação física?</label>
                    <select class="form-select" id="wiz-injury" onchange="document.getElementById('wiz-injury-cond').style.display = this.value === 'Sim' ? 'block' : 'none'">
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                    </select>
                    <div id="wiz-injury-cond" style="display: none;" class="mt-sm">
                        <label class="form-label text-xs">👉 Qual?</label>
                        <input type="text" class="form-input" id="wiz-injury-desc" placeholder="Descreva aqui...">
                    </div>
                </div>
        <div class="form-group">
            <label class="form-label">11. Possui alguma limitação de desempenho ou fôlego?</label>
            <select class="form-select" id="wiz-performance" onchange="document.getElementById('wiz-perf-cond').style.display = this.value === 'Sim' ? 'block' : 'none'">
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
            </select>
            <div id="wiz-perf-cond" style="display: none;" class="mt-sm">
                <label class="form-label text-xs">👉 Descreva brevemente:</label>
                <input type="text" class="form-input" id="wiz-performance-desc" placeholder="Ex: Cansaço rápido, falta de fôlego...">
            </div>
        </div>
    `;
        } else if (step === 5) {
            title = 'Passo 5: Estilo de Vida';
            content = `
        <div class="grid grid-2 gap-md" >
                    <div class="form-group">
                        <label class="form-label">10. Como é seu sono?</label>
                        <select class="form-select" id="wiz-sleep">
                            <option value="Bom">Bom</option>
                            <option value="Regular">Regular</option>
                            <option value="Ruim">Ruim</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">11. Nível de estresse?</label>
                        <select class="form-select" id="wiz-stress">
                            <option value="Baixo">Baixo</option>
                            <option value="Médio">Médio</option>
                            <option value="Alto">Alto</option>
                        </select>
                    </div>
                </div>
        <p class="text-sm text-muted mt-md">A T-FIT AI usará esses dados para ajustar a recuperação entre os exercícios.</p>
    `;
        }

        const modalHtml = `
        <div class="wizard-container" >
            <div class="wiz-progress mb-lg" style="height: 4px; background: #eee; border-radius: 2px;">
                <div style="height: 100%; width: ${(step / 5) * 100}%; background: var(--primary); transition: width 0.3s;"></div>
            </div>
                
                ${content}

    <div class="flex flex-col gap-sm mt-xl pt-md border-t">
        <div class="flex justify-between items-center mb-sm">
            ${step > 1 ? `<button class="btn btn-ghost" onclick="window.prevWizStep()">← Voltar</button>` : '<div></div>'}
            ${step < 5 ? `<button class="btn btn-primary" onclick="window.nextWizStep()">Próximo →</button>` : ''}
        </div>

        ${step === 5 ? `
                        <div class="text-center">
                            <button class="btn btn-primary btn-ai-glow btn-block" onclick="window.nextWizStep()">
                                🤖 Gerar Treino Mágico (IA)
                            </button>
                        </div>
                    ` : ''}
    </div>
            </div>
        `;

        UI.showModal(title, modalHtml);
    };

    window.prevWizStep = () => { if (step > 1) { step--; renderStep(); } };

    window.nextWizStep = () => {
        // Collect Data
        if (step === 1) {
            answers['wiz-age'] = document.getElementById('wiz-age').value;
            answers['wiz-sex'] = document.getElementById('wiz-sex').value;
            answers['wiz-height'] = document.getElementById('wiz-height').value;
            answers['wiz-weight'] = document.getElementById('wiz-weight').value;
            if (!answers['wiz-age'] || !answers['wiz-height'] || !answers['wiz-weight']) return UI.showNotification('Erro', 'Preencha todos os campos!', 'warning');
        } else if (step === 2) {
            answers['wiz-goal'] = document.getElementById('wiz-goal').value;
            answers['wiz-experience'] = document.getElementById('wiz-experience').value;
            const previousTypes = [];
            document.querySelectorAll('input[name="wiz-previous-types"]:checked').forEach(c => previousTypes.push(c.value));
            answers['wiz-previous-types'] = previousTypes;
            answers['wiz-focus-text'] = document.getElementById('wiz-focus-text').value;
            answers['wiz-volume-text'] = document.getElementById('wiz-volume-text').value;
        } else if (step === 3) {
            answers['wiz-days'] = document.getElementById('wiz-days').value;
            answers['wiz-num-workouts'] = document.getElementById('wiz-num-workouts').value;
            answers['wiz-time'] = document.getElementById('wiz-time').value;
            answers['wiz-location'] = document.getElementById('wiz-location').value;
        } else if (step === 4) {
            answers['wiz-injury'] = document.getElementById('wiz-injury').value;
            answers['wiz-injury-desc'] = document.getElementById('wiz-injury-desc').value;
            answers['wiz-performance'] = document.getElementById('wiz-performance').value;
            answers['wiz-performance-desc'] = document.getElementById('wiz-performance-desc').value;
        } else if (step === 5) {
            answers['wiz-sleep'] = document.getElementById('wiz-sleep').value;
            answers['wiz-stress'] = document.getElementById('wiz-stress').value;

            // FINISH
            finishWorkoutGen('ai', answers);
            return;
        }
        step++;
        renderStep();
    };

    const finishWorkoutGen = async (method = 'ai', customAnswers = null) => {
        if (window._isGeneratingWorkout) return;
        window._isGeneratingWorkout = true;

        const user = auth.getCurrentUser();
        const data = customAnswers || answers;
        UI.showLoading(method === 'ai' ? 'IA T-FIT Gerando seu Treino...' : 'Criando seu Treino...');

        try {
            let splits;

            // 1. Data Sanitization
            const aiParams = {
                ...data,
                numWorkouts: parseInt(data['wiz-num-workouts']) || 3,
                daysPerWeek: data['wiz-days'],
                specificGoal: data['wiz-goal'],
                level: data['wiz-experience'],
                experienceTime: data['wiz-experience'],
                restrictions: `${data['wiz-injury'] === 'Sim' ? data['wiz-injury-desc'] : ''} ${data['wiz-performance'] === 'Sim' ? data['wiz-performance-desc'] : ''} `.trim() || 'Nenhuma',
                studentName: user.name,
                weight: parseFloat(data['wiz-weight']) || parseFloat(user.weight),
                height: parseFloat(data['wiz-height']) || parseFloat(user.height),
                age: parseInt(data['wiz-age']) || parseInt(user.age)
            };

            if (method === 'ai') {
                console.log("Iniciando geração de treino via IA com params:", aiParams);
                splits = await AIHelper.generateWeeklySplit(aiParams);
            } else {
                splits = WorkoutBuilder.generate({
                    focus: aiParams.specificGoal || 'Bem-estar',
                    level: aiParams.level || 'Iniciante',
                    daysPerWeek: parseInt(aiParams.daysPerWeek) || 3,
                    equipment: data['wiz-location'] || 'Academia'
                });
            }

            if (!splits || !Array.isArray(splits) || splits.length === 0) {
                console.error("Geração falhou: splits vazio ou inválido.");
                throw new Error("Não foi possível gerar sugestões de treino. Verifique os dados inseridos.");
            }

            // 1. Clear previous workouts efficiently and silently
            // CRITICAL: ONLY delete workouts generated by AI or system (where personal_id is null/SYSTEM/Blank)
            const oldWorkouts = db.query('workouts', w => {
                const isStudentWorkout = String(w.student_id) === String(user.id);
                const isNotProfessional = !w.personal_id ||
                    String(w.personal_id) === 'null' ||
                    String(w.personal_id) === 'undefined' ||
                    String(w.personal_id) === 'SYSTEM' ||
                    String(w.personal_id).startsWith('00000000-0000-0000-0000-000000000000');
                const isAIName = w.personal_name === 'T-FIT AI' || w.personal_name === 'SISTEMA' || !w.personal_name;
                return isStudentWorkout && (isNotProfessional || isAIName);
            });

            if (oldWorkouts.length > 0) {
                console.log(`Limpando ${oldWorkouts.length} treinos antigos para garantir a quantidade correta...`);
                for (const w of oldWorkouts) {
                    if (w && w.id) {
                        try {
                            await db.delete('workouts', w.id, { noRefresh: true, silent: true });
                        } catch (e) { console.error('Error deleting old workout:', e); }
                    }
                }
            }

            // 2. Prepare and Save New Workouts
            console.log(`Salvando ${splits.length} novos treinos...`);
            const workoutsToCreate = splits.map((w, idx) => ({
                name: w.name || `Treino ${String.fromCharCode(65 + idx)}`,
                type: w.type || w.focus || 'Padrão',
                duration: parseInt(w.duration) || 60,
                exercises: Array.isArray(w.exercises) ? w.exercises : [],
                muscle_groups: Array.isArray(w.muscle_groups) ? w.muscle_groups : [],
                rationale: w.rationale || splits.rationale || "Periodização gerada via IA.",
                student_id: user.id,
                student_name: user.name,
                personal_id: null,
                personal_name: 'T-FIT AI'
            }));

            await db.createMany('workouts', workoutsToCreate);

            PaymentHelper.incrementUsage(user.id, 'workout');

            // 3. Update Student Profile with latest stats (Silent and Non-Blocking)
            try {
                const normalizedWeight = parseFloat(data['wiz-weight']) || parseFloat(user.weight) || 0;
                const normalizedHeight = parseFloat(data['wiz-height']) || parseFloat(user.height) || 0;
                const normalizedAge = parseInt(data['wiz-age']) || parseInt(user.age) || 0;

                await db.update('profiles', user.id, {
                    weight: normalizedWeight,
                    height: normalizedHeight,
                    age: normalizedAge,
                    goal: data['wiz-goal'],
                    level: data['wiz-experience'],
                    location: data['wiz-location'],
                    equipment: (data['wiz-equipment'] || []).join(', '),
                    sleep: data['wiz-sleep'],
                    stress: data['wiz-stress'],
                    injuries: data['wiz-injury'] === 'Sim' ? data['wiz-injury-desc'] : 'Nenhuma'
                }, { silent: true, noRefresh: true });
            } catch (err) {
                console.warn("Informações do perfil não puderam ser atualizadas, mas o treino foi salvo.", err);
            }

            UI.hideLoading();
            UI.closeModal();

            // Handle rationale extraction
            const rationale = splits.rationale || "";

            const successHtml = `
<div class="text-center" >
                    <div style="font-size: 3rem; margin-bottom: 1rem;">${method === 'ai' ? '✨' : '⚙️'}</div>
                    <h3 class="text-success mb-md">Treino Criado com Sucesso!</h3>
                    
                    ${method === 'ai' && rationale ? `
                        <div class="card p-md bg-light mb-lg text-left border-primary" style="border-left: 4px solid var(--primary);">
                            <p class="text-sm"><strong>🤖 Por que este treino?</strong></p>
                            <p class="text-xs text-muted mt-xs italic">"${rationale}"</p>
                        </div>
                    ` : `
                        <p class="text-muted mb-lg">Sua rotina foi dividida em <strong>${splits.length} treinos</strong> perfeitamente otimizados para você.</p>
                    `}

    <button class="btn btn-primary w-full" onclick="UI.closeModal(); router.navigate('/student/workouts')">Ver Meus Treinos</button>
                </div>
    `;
            UI.showModal('Parabéns!', successHtml);
        } catch (error) {
            console.error('Error generating workout:', error);
            UI.hideLoading();
            UI.showNotification('Erro', 'Falha ao gerar treino: ' + error.message, 'error');
        } finally {
            window._isGeneratingWorkout = false;
        }
    };
    window.finishWorkoutGen = finishWorkoutGen;

    renderStep();
};

window.openAIDietGenerator = () => {
    if (!checkAccess('diet')) return;
    const user = auth.getCurrentUser();

    let step = 1;
    let answers = {
        'd-wiz-weight': user.weight || '',
        'd-wiz-height': user.height || '',
        'd-wiz-age': user.age || '',
        'd-wiz-sex': user.sex || 'Feminino'
    };

    const renderDietStep = () => {
        let title = '';
        let content = '';

        if (step === 1) {
            title = 'Passo 1: Dados Corporais';
            content = `
    <div class="grid grid-2 gap-md" >
                    <div class="form-group">
                        <label class="form-label">Peso (kg)</label>
                        <input type="number" class="form-input" id="d-wiz-weight" value="${answers['d-wiz-weight']}" placeholder="Ex: 70">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Altura (cm)</label>
                        <input type="number" class="form-input" id="d-wiz-height" value="${answers['d-wiz-height']}" placeholder="Ex: 170">
                    </div>
                </div>
    <div class="grid grid-2 gap-md mt-md">
        <div class="form-group">
            <label class="form-label">Idade</label>
            <input type="number" class="form-input" id="d-wiz-age" value="${answers['d-wiz-age']}" placeholder="Ex: 30">
        </div>
        <div class="form-group">
            <label class="form-label">Sexo</label>
            <select class="form-select" id="d-wiz-sex">
                <option value="Feminino" ${answers['d-wiz-sex'] === 'Feminino' ? 'selected' : ''}>Feminino</option>
                <option value="Masculino" ${answers['d-wiz-sex'] === 'Masculino' ? 'selected' : ''}>Masculino</option>
                <option value="Prefiro não informar" ${answers['d-wiz-sex'] === 'Prefiro não informar' ? 'selected' : ''}>Prefiro não informar</option>
            </select>
        </div>
    </div>
            `;
        } else if (step === 2) {
            title = 'Passo 2: Objetivo e Hábitos';
            content = `
    <div class="form-group" >
                    <label class="form-label">1. Objetivo principal com a dieta?</label>
                    <select class="form-select" id="d-wiz-goal">
                        <option value="Emagrecimento">Emagrecimento</option>
                        <option value="Ganho de massa muscular">Ganho de massa muscular</option>
                        <option value="Definição">Definição</option>
                        <option value="Manutenção do peso">Manutenção do peso</option>
                        <option value="Qualidade de vida">Qualidade de vida e Bem-estar</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">2. Você já segue alguma dieta?</label>
                    <select class="form-select" id="d-wiz-experience">
                        <option value="Nunca segui">Nunca segui</option>
                        <option value="Já segui, mas parei">Já segui, mas parei</option>
                        <option value="Sigo atualmente">Sigo atualmente</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">3. Refeições por dia?</label>
                    <select class="form-select" id="d-wiz-meals">
                        <option value="3 refeições">3 refeições</option>
                        <option value="4 refeições" selected>4 refeições</option>
                        <option value="5 refeições">5 refeições</option>
                        <option value="6 ou mais">6 ou mais</option>
                        <option value="Não tenho preferência">Não tenho preferência</option>
                    </select>
                </div>
                <div class="grid grid-2 gap-md mt-md">
                    <div class="form-group">
                        <label class="form-label">7. Como é seu apetite?</label>
                        <select class="form-select" id="d-wiz-appetite">
                            <option value="Baixo">Baixo</option>
                            <option value="Moderado" selected>Moderado</option>
                            <option value="Alto">Alto</option>
                            <option value="Varia muito">Varia muito</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">8. Rotina alimentar?</label>
                        <select class="form-select" id="d-wiz-routine">
                            <option value="Bem organizada">Bem organizada</option>
                            <option value="Mais ou menos" selected>Mais ou menos</option>
                            <option value="Totalmente desorganizada">Totalmente desorganizada</option>
                        </select>
                    </div>
                </div>
            `;
        } else if (step === 3) {
            title = 'Passo 3: Condição Física e Restrições';
            content = `
    <div class="form-group" >
                    <label class="form-label">4. Restrição alimentar?</label>
                    <div class="grid grid-2 gap-xs">
                        ${['Nenhuma', 'Intolerância à lactose', 'Alergia ao glúten', 'Alergia alimentar (outras)', 'Vegetarian@', 'Vegan@', 'Outro'].map(r => `
                            <label class="flex items-center gap-sm p-sm border rounded cursor-pointer hover-bg-light">
                                <input type="checkbox" name="d-wiz-rest" value="${r}" ${(answers['d-wiz-rest'] || []).includes(r) ? 'checked' : ''}>
                                <span class="text-sm">${r}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">5. Nível funcional e dores?</label>
                    <div class="grid grid-2 gap-xs">
                        ${['Nenhuma', 'Sedentarismo grave', 'Fadiga crônica prévia', 'Metabolismo muito lento', 'Limitação articular', 'Outro'].map(c => `
                            <label class="flex items-center gap-sm p-sm border rounded cursor-pointer hover-bg-light">
                                <input type="checkbox" name="d-wiz-health" value="${c}" ${(answers['d-wiz-health'] || []).includes(c) ? 'checked' : ''}>
                                <span class="text-sm">${c}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">6. Possui alguma limitação severa de mobilidade?</label>
                    <select class="form-select" id="d-wiz-meds" onchange="document.getElementById('d-wiz-meds-cond').style.display = this.value === 'Sim' ? 'block' : 'none'">
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                    </select>
                    <div id="d-wiz-meds-cond" style="display: none;" class="mt-sm">
                        <label class="form-label text-xs">👉 Qual(is)?</label>
                        <input type="text" class="form-input" id="d-wiz-meds-desc" placeholder="Descreva aqui...">
                    </div>
                </div>
            `;
        } else if (step === 4) {
            title = 'Passo 4: Alimentação e Estilo de Vida';
            content = `
    <div class="grid grid-2 gap-md" >
                   <div class="form-group">
                        <label class="form-label">10. Alimentos que GOSTA</label>
                        <textarea class="form-input" id="d-wiz-likes" rows="2" placeholder="Ex: arroz, frango, ovos, frutas...">${answers['d-wiz-likes'] || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">11. Alimentos que NÃO gosta</label>
                        <textarea class="form-input" id="d-wiz-dislikes" rows="2" placeholder="Ex: fígado, jiló...">${answers['d-wiz-dislikes'] || ''}</textarea>
                    </div>
                </div>
                <div class="grid grid-2 gap-md">
                    <div class="form-group">
                        <label class="form-label">9. Pede delivery?</label>
                        <select class="form-select" id="d-wiz-delivery">
                            <option value="Raramente">Raramente</option>
                            <option value="1–2x por semana">1–2x por semana</option>
                            <option value="3–4x por semana">3–4x por semana</option>
                            <option value="Quase todos os dias">Quase todos os dias</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">12. Consome álcool?</label>
                        <select class="form-select" id="d-wiz-alcohol">
                            <option value="Não">Não</option>
                            <option value="Raramente">Raramente</option>
                            <option value="Finais de semana">Finais de semana</option>
                            <option value="Frequentemente">Frequentemente</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-2 gap-md">
                    <div class="form-group">
                        <label class="form-label">13. Consumo de água?</label>
                        <select class="form-select" id="d-wiz-water">
                            <option value="Menos de 1L">Menos de 1L</option>
                            <option value="1–2L" selected>1–2L</option>
                            <option value="2–3L">2–3L</option>
                            <option value="Mais de 3L">Mais de 3L</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">14. Utiliza suplementos?</label>
                        <div class="grid grid-2 gap-xs">
                             ${['Nenhum', 'Whey protein', 'Creatina', 'Multivitamínico', 'Outros'].map(s => `
                                <label class="flex items-center gap-xs p-xs border rounded cursor-pointer hover-bg-light">
                                    <input type="checkbox" name="d-wiz-supps" value="${s}" ${(answers['d-wiz-supps'] || []).includes(s) ? 'checked' : ''}>
                                    <span class="text-xs">${s}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        const modalHtml = `
    <div class="wizard-container" >
    <div class="wiz-progress mb-lg" style="height: 4px; background: #eee; border-radius: 2px;">
        <div style="height: 100%; width: ${(step / 4) * 100}%; background: var(--success); transition: width 0.3s;"></div>
    </div>
                
                ${content}

<div class="flex flex-col gap-sm mt-xl pt-md border-t" >
<div class="flex justify-between items-center mb-sm">
    ${step > 1 ? `<button class="btn btn-ghost" onclick="window.prevDietStep()">← Voltar</button>` : '<div></div>'}
    ${step < 4 ? `<button class="btn btn-primary" onclick="window.nextDietStep()">Próximo →</button>` : ''}
</div>

                    ${step === 4 ? `
                        <div class="text-center">
                            <button class="btn btn-primary btn-ai-glow btn-block" onclick="window.nextDietStep()">
                                🤖 Gerar Dieta Inteligente (IA)
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
    `;

        UI.showModal(title, modalHtml);
    };

    window.prevDietStep = () => { if (step > 1) { step--; renderDietStep(); } };

    window.nextDietStep = () => {
        if (step === 1) {
            answers['d-wiz-weight'] = document.getElementById('d-wiz-weight').value;
            answers['d-wiz-height'] = document.getElementById('d-wiz-height').value;
            answers['d-wiz-age'] = document.getElementById('d-wiz-age').value;
            answers['d-wiz-sex'] = document.getElementById('d-wiz-sex').value;
            if (!answers['d-wiz-weight'] || !answers['d-wiz-height'] || !answers['d-wiz-age']) return UI.showNotification('Erro', 'Preencha peso, altura e idade!', 'warning');
        } else if (step === 2) {
            answers['d-wiz-goal'] = document.getElementById('d-wiz-goal').value;
            answers['d-wiz-experience'] = document.getElementById('d-wiz-experience').value;
            answers['d-wiz-meals'] = document.getElementById('d-wiz-meals').value;
            answers['d-wiz-appetite'] = document.getElementById('d-wiz-appetite').value;
            answers['d-wiz-routine'] = document.getElementById('d-wiz-routine').value;
        } else if (step === 3) {
            const rests = [];
            document.querySelectorAll('input[name="d-wiz-rest"]:checked').forEach(c => rests.push(c.value));
            answers['d-wiz-rest'] = rests;
            const health = [];
            document.querySelectorAll('input[name="d-wiz-health"]:checked').forEach(c => health.push(c.value));
            answers['d-wiz-health'] = health;
            answers['d-wiz-meds'] = document.getElementById('d-wiz-meds').value;
            answers['d-wiz-meds-desc'] = document.getElementById('d-wiz-meds-desc').value;
        } else if (step === 4) {
            answers['d-wiz-likes'] = document.getElementById('d-wiz-likes').value;
            answers['d-wiz-dislikes'] = document.getElementById('d-wiz-dislikes').value;
            answers['d-wiz-delivery'] = document.getElementById('d-wiz-delivery').value;
            answers['d-wiz-alcohol'] = document.getElementById('d-wiz-alcohol').value;
            answers['d-wiz-water'] = document.getElementById('d-wiz-water').value;
            const supps = [];
            document.querySelectorAll('input[name="d-wiz-supps"]:checked').forEach(c => supps.push(c.value));
            answers['d-wiz-supps'] = supps;

            // FINISH
            finishDietGen('ai', answers);
            return;
        }
        step++;
        renderDietStep();
    };

    const finishDietGen = async (method = 'ai', customAnswers = null) => {
        const user = auth.getCurrentUser();
        const data = customAnswers || answers;
        UI.showLoading(method === 'ai' ? 'IA T-FIT Gerando sua Dieta...' : 'Criando sua Dieta...');

        try {
            let diet;

            if (method === 'ai') {
                try {
                    // Enviar TODAS as novas perguntas para a IA
                    diet = await AIHelper.generateDiet({
                        ...data,
                        studentName: user.name
                    });
                } catch (aiError) {
                    console.error("Diet AI failed, falling back to manual:", aiError);
                    UI.showNotification('Aviso', 'IA de Nutrição indisponível. Usando cálculo manual...', 'warning');
                    method = 'manual';
                }
            }

            if (method === 'manual' || !diet) {
                // Fallback manual (Simplificado para o novo formato)
                diet = NutritionHelper.generateManualDiet({
                    weight: parseFloat(data['d-wiz-weight']) || 70,
                    height: parseFloat(data['d-wiz-height']) || 170,
                    age: parseInt(data['d-wiz-age']) || 30,
                    sex: data['d-wiz-sex'] === 'Masculino' ? 'male' : 'female',
                    goal: data['d-wiz-goal'] || 'maintain',
                    activity: data['d-wiz-activity'] || 'moderate', // Assuming a default activity level
                    mealCount: parseInt(data['d-wiz-meals']) || 4,
                    preference: data['d-wiz-rest'] || [] // Assuming preferences can be derived from restrictions
                });
            }

            if (!diet) throw new Error("Não foi possível gerar o plano alimentar.");

            // 1. Clear previous diets (Only AI or Non-Professional ones)
            const oldDiets = db.query('diets', d => {
                const isStudentDiet = d.student_id === user.id;
                const isNotProfessional = !d.personal_id || d.personal_id === 'SYSTEM' || d.personal_id === '00000000-0000-0000-0000-000000000000';
                const isAIName = d.personal_name === 'T-FIT AI' || !d.personal_name;
                return isStudentDiet && (isNotProfessional || isAIName);
            });

            if (oldDiets.length > 0) {
                console.log(`Limpando ${oldDiets.length} dietas antigas(Não - Profissionais)...`);
                await Promise.all(oldDiets.map(d => db.delete('diets', d.id, { noRefresh: true, silent: true })));
            }

            // 2. Save new diet
            console.log('Salvando nova dieta...');

            // Clean AI object for DB persistence (Hardened Mapping)
            const cleanDiet = {
                // id: removed (Supabase handles UUIDs)
                name: (diet && diet.name) ? diet.name : 'Plano Alimentar',
                type: (diet && (diet.type || diet.preference)) ? (diet.type || diet.preference) : 'omnivore',
                goal: (diet && diet.goal) ? diet.goal : (user.goal || 'maintenance'),
                meals: (diet && diet.meals) ? diet.meals : [],
                calories: parseInt(diet.calories) || 0,
                protein: parseInt(diet.protein) || 0,
                carbs: parseInt(diet.carbs) || 0,
                fat: parseInt(diet.fat) || 0,
                water: parseInt(diet.water) || 0,
                visual_evaluation: diet.visual_evaluation || diet.visualEvaluation || "Análise concluída.",
                rationale: diet.rationale || diet.rationaleText || "Estratégia nutricional baseada no seu perfil.",
                student_id: user.id,
                student_name: user.name,
                personal_name: 'T-FIT AI'
            };

            await db.create('diets', cleanDiet);
            PaymentHelper.incrementUsage(user.id, 'diet');

            // 3. Update User Data (Silent and Non-Blocking)
            try {
                const normalizedWeight = parseFloat(data['d-wiz-weight']) || parseFloat(user.weight) || 0;
                const normalizedHeight = parseFloat(data['d-wiz-height']) || parseFloat(user.height) || 0;
                const normalizedAge = parseInt(data['d-wiz-age']) || parseInt(user.age) || 0;

                await db.update('profiles', user.id, {
                    weight: normalizedWeight,
                    height: normalizedHeight,
                    age: normalizedAge,
                    sex: data['d-wiz-sex'],
                    goal: data['d-wiz-goal']
                }, { silent: true, noRefresh: true });
            } catch (err) {
                console.warn("Métricas do usuário não puderam ser atualizadas, mas a dieta foi salva.", err);
            }

            const rationale = diet.rationale || null;

            UI.hideLoading();
            const successHtml = `
<div class="text-center p-xl" >
                        <div style="font-size: 4rem; margin-bottom: 2rem;">🥗</div>
                        <h2 class="mb-md">Dieta Gerada!</h2>
                        
                        ${rationale ? `
                            <div class="card p-md bg-light mb-lg text-left border-success" style="border-left: 4px solid var(--success);">
                                <p class="text-sm"><strong>🤖 Estratégia da IA:</strong></p>
                                <p class="text-xs text-muted mt-xs italic">"${rationale}"</p>
                            </div>
                        ` : `
                            <p class="text-muted mb-xl">Sua nova estratégia nutricional está pronta baseada nos seus objetivos.</p>
                        `}

    <button class="btn btn-primary w-full" onclick="UI.closeModal(); router.navigate('/student/nutrition')">Ver Minha Dieta</button>
                    </div>
    `;
            UI.showModal('Pronto!', successHtml);
        } catch (error) {
            console.error('Error generating diet:', error);
            UI.hideLoading();

            UI.showNotification('Erro', error.message || 'A IA falhou ao gerar sua dieta. Tente novamente em alguns instantes.', 'error');
        }
    };
    window.finishDietGen = finishDietGen;

    renderDietStep();
};



// --- Assessment Generator ---
window.openAssessmentGenerator = () => {
    // Redireciona para a nova avaliação física completa
    router.navigate('/student/assessments');
};

// Route for Physical Assessments
router.addRoute('/student/assessments', async () => {
    if (!auth.requireAuth('student')) return;
    const user = auth.getCurrentUser();

    // Fetch assessments
    const assessments = db.query('assessments', a => a.student_id === user.id)
        .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

    const content = `
    <div class="page-header flex justify-between items-center" >
            <div>
                <h1 class="page-title">Avaliação Física 📏</h1>
                <p class="page-subtitle">Acompanhe sua evolução e análise inteligente</p>
            </div>
            <button class="btn btn-ghost" onclick="router.navigate('/student/dashboard')">← Voltar</button>
        </div>

        <div class="mb-xl text-center">
            <button class="btn btn-lg btn-block text-white" style="background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); font-weight: 800; font-size: 1.1rem; box-shadow: 0 10px 25px rgba(168, 85, 247, 0.4);" onclick="window.startAIPhysicalAssessment()">
                ✨ CRIAR NOVA AVALIAÇÃO COM IA 🤖
            </button>
            <p class="text-sm text-muted mt-md">A T-FIT IA analisará suas fotos e medidas instantaneamente.</p>
        </div>

        <h3 class="mb-md" id="history-personal">Histórico de Avaliações</h3>
        <div class="grid grid-1 gap-md">
            ${assessments.length > 0 ? assessments.map(a => `
                <div class="card hover-scale transition-all" onclick="window.viewAssessmentDetails('${a.id}')" style="cursor: pointer;">
                    <div class="card-body flex justify-between items-center">
                        <div class="flex items-center gap-md">
                            <div class="avatar-sm bg-primary flex items-center justify-center rounded-lg" style="width: 50px; height: 50px; background: ${a.is_ai_generated ? 'rgba(168, 85, 247, 0.2)' : 'rgba(99,102,241,0.2)'} !important;">
                                <span style="font-size: 1.5rem;">${a.is_ai_generated ? '🤖' : '📏'}</span>
                            </div>
                            <div>
                                <h4 class="mb-xs">Avaliação de ${new Date(a.created_at || a.date).toLocaleDateString()}</h4>
                                <div class="text-xs text-muted">
                                    ${a.weight ? `Peso: ${a.weight}kg` : ''} 
                                    ${a.body_fat_percentage ? ` • BF: ${a.body_fat_percentage}%` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-sm">
                             <span class="badge badge-primary" style="background: #a855f7;">
                                IA
                             </span>
                             <span>→</span>
                        </div>
                    </div>
                </div>
            `).join('') : `
                <div class="card p-xl text-center">
                    <p class="text-muted">Você ainda não realizou nenhuma avaliação.</p>
                </div>
            `}
        </div>
    `;

    UI.renderDashboard(content, 'student');
});

window.startAIPhysicalAssessment = () => {
    const user = auth.getCurrentUser();

    const modalContent = `
    <div id="ai-assessment-form" >
            <div class="alert alert-info mb-md text-sm">
                📌 <b>Instruções:</b> Envie 3 fotos nítidas. Use roupas de treino justas, biquíni ou sunga para que a IA identifique corretamente sua estrutura e depósitos de gordura.
            </div>

            <div class="grid grid-2 gap-md mb-lg">
                <div class="form-group">
                    <label class="form-label">Peso Atual (kg)</label>
                    <input type="number" id="assess-weight" class="form-input" value="${user.weight || ''}" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label class="form-label">Altura (cm)</label>
                    <input type="number" id="assess-height" class="form-input" value="${user.height || ''}" placeholder="170">
                </div>
            </div>

            <div class="flex flex-col gap-md">
                <div class="photo-upload-container">
                    <label class="form-label">Foto de Frente 📸</label>
                    <div class="photo-preview-box" id="preview-front" onclick="document.getElementById('photo-front').click()">
                        <span>Clique para selecionar</span>
                    </div>
                    <input type="file" id="photo-front" accept="image/*" class="hidden" onchange="window.previewAssessmentPhoto(this, 'preview-front')">
                </div>

                <div class="grid grid-2 gap-md">
                    <div class="photo-upload-container">
                        <label class="form-label">Lado Direito 📸</label>
                        <div class="photo-preview-box" id="preview-right" onclick="document.getElementById('photo-right').click()">
                            <span>Selecionar</span>
                        </div>
                        <input type="file" id="photo-right" accept="image/*" class="hidden" onchange="window.previewAssessmentPhoto(this, 'preview-right')">
                    </div>
                    <div class="photo-upload-container">
                        <label class="form-label">Lado Esquerdo 📸</label>
                        <div class="photo-preview-box" id="preview-left" onclick="document.getElementById('photo-left').click()">
                            <span>Selecionar</span>
                        </div>
                        <input type="file" id="photo-left" accept="image/*" class="hidden" onchange="window.previewAssessmentPhoto(this, 'preview-left')">
                    </div>
                </div>
            </div>

            <style>
                .photo-preview-box {
                    height: 120px;
                    border: 2px dashed var(--border);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    overflow: hidden;
                    background: rgba(255,255,255,0.02);
                    transition: 0.3s;
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 0.8rem;
                }
                .photo-preview-box:hover {
                    border-color: var(--primary);
                    background: rgba(99,102,241,0.05);
                }
                .photo-preview-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
            </style>
        </div>
    `;

    UI.showModal('Nova Avaliação Física', modalContent, async () => {
        const weight = document.getElementById('assess-weight').value;
        const height = document.getElementById('assess-height').value;

        const photoFront = document.getElementById('preview-front').querySelector('img')?.src;
        const photoRight = document.getElementById('preview-right').querySelector('img')?.src;
        const photoLeft = document.getElementById('preview-left').querySelector('img')?.src;

        if (!weight || !height || !photoFront || !photoRight || !photoLeft) {
            UI.showNotification('Dados Incompletos', 'Por favor, preencha peso, altura e envie as 3 fotos.', 'warning');
            return false;
        }

        UI.showLoading('T-FIT IA analisando seu corpo...');

        try {
            const aiResult = await AIHelper.analyzePhysicalAssessment({
                name: user.name,
                weight,
                height,
                age: user.age,
                goal: user.goal
            }, {
                front: photoFront,
                side_right: photoRight,
                side_left: photoLeft
            });

            if (aiResult) {
                // Save to database
                const assessmentData = {
                    student_id: user.id,
                    weight: parseFloat(weight) || 0,
                    height: parseFloat(height) || 0,
                    body_fat_percentage: parseFloat(aiResult.body_fat_est) || null,
                    notes: aiResult.analysis || '',
                    photos: [photoFront, photoRight, photoLeft].filter(Boolean),
                    photo_front: photoFront,
                    photo_side_right: photoRight,
                    photo_side_left: photoLeft,
                    ai_analysis: aiResult.analysis || '',
                    recommendations: aiResult.recommendations,
                    strengths: Array.isArray(aiResult.strengths) ? JSON.stringify(aiResult.strengths) : aiResult.strengths,
                    improvements: Array.isArray(aiResult.improvements) ? JSON.stringify(aiResult.improvements) : aiResult.improvements,
                    is_ai_generated: true,
                    measurements: {
                        ai_analysis: aiResult.analysis || '',
                        recommendations: aiResult.recommendations,
                        strengths: aiResult.strengths,
                        improvements: aiResult.improvements,
                        photo_front: photoFront,
                        photo_side_right: photoRight,
                        photo_side_left: photoLeft,
                        is_ai_generated: true
                    }
                };

                const saved = await db.create('assessments', assessmentData);
                UI.hideLoading();
                UI.showNotification('Sucesso!', 'Avaliação concluída com sucesso pela IA.', 'success');

                // Show Result Details
                window.viewAssessmentDetails(saved.id);
            }
        } catch (error) {
            console.error('Erro na avaliação IA:', error);
            UI.hideLoading();
            UI.showNotification('Erro na IA', error.message || 'Não foi possível completar a análise visual no momento.', 'error');
        }
    }, 'Gerar Agora');
};

window.previewAssessmentPhoto = (input, previewId) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Compress image to max 800px to avoid API Payload Too Large errors
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Use 0.6 quality JPEG
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

                const preview = document.getElementById(previewId);
                preview.innerHTML = `<img src="${dataUrl}">`;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};

window.viewAssessmentDetails = (id) => {
    const a = db.getById('assessments', id);
    if (!a) return;

    const measurements = a.measurements || {};

    // Safety Parse (Strengths and Improvements can be JSON strings in DB)
    let strengths = a.strengths || measurements.strengths || [];
    let improvements = a.improvements || measurements.improvements || [];

    if (typeof strengths === 'string') {
        try { strengths = JSON.parse(strengths); } catch (e) { strengths = [strengths]; }
    }
    if (typeof improvements === 'string') {
        try { improvements = JSON.parse(improvements); } catch (e) { improvements = [improvements]; }
    }

    // Ensure they are arrays
    if (!Array.isArray(strengths)) strengths = [];
    if (!Array.isArray(improvements)) improvements = [];

    const reco = measurements.recommendations || a.recommendations || 'Sem recomendações.';

    const modalContent = `
<div class="assessment-details p-md" >
            <div class="flex justify-between items-center mb-lg">
                <h3 class="font-bold text-xl">${new Date(a.created_at || a.date).toLocaleDateString()}</h3>
                <span class="badge badge-primary">BF Estimado: ${a.body_fat_percentage || 'N/A'}%</span>
            </div>

            <div class="photos-preview-strip mb-lg" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;">
                ${(a.photos || []).map(p => `
                    <img src="${p}" style="height: 180px; border-radius: 12px; border: 1px solid var(--border);">
                `).join('')}
            </div>

            <div class="analysis-section mb-lg">
                <h4 class="text-primary font-bold mb-xs">🧠 Análise da T-FIT IA</h4>
                <div class="p-md bg-light rounded-lg leading-relaxed text-sm">
                    ${a.notes || 'Sem análise disponível.'}
                </div>
            </div>

            <div class="grid grid-2 gap-md mb-lg">
                <div class="bg-success-light p-md rounded-lg">
                    <h4 class="text-success text-xs uppercase font-bold mb-sm">Pontos Fortes</h4>
                    <ul class="text-xs list-disc pl-md">
                        ${strengths.length > 0 ? strengths.map(s => `<li>${s}</li>`).join('') : '<li>Dados não disponíveis</li>'}
                    </ul>
                </div>
                <div class="bg-warning-light p-md rounded-lg">
                    <h4 class="text-warning text-xs uppercase font-bold mb-sm">A Melhorar</h4>
                    <ul class="text-xs list-disc pl-md">
                        ${improvements.length > 0 ? improvements.map(i => `<li>${i}</li>`).join('') : '<li>Dados não disponíveis</li>'}
                    </ul>
                </div>
            </div>

            <div class="recommendations-section mb-lg">
                <h4 class="text-accent font-bold mb-xs">🚀 Recomendações de Treino/Dieta</h4>
                <div class="p-md bg-accent-light rounded-xl leading-relaxed text-sm" style="border-left: 4px solid var(--secondary);">
                    ${reco}
                </div>
            </div>
        </div>
    `;

    UI.showModal('Resultado da Avaliação IA', modalContent);
};

window.openAutoAssessment = async () => {
    if (!checkAccess('assessment')) return;
    try {
        const user = auth.getCurrentUser();
        if (!user) {
            UI.showNotification('Erro', 'Usuário não autenticado', 'error');
            return;
        }

        const modalContent = `
    <div class="form-group" >
                <label class="form-label">Peso Atual (kg)</label>
                <input type="number" step="0.1" class="form-input" id="auto-assess-weight" required value="${user.weight || ''}" placeholder="Ex: 75.5">
            </div>
            <div class="form-group">
                <label class="form-label">Altura (cm)</label>
                <input type="number" class="form-input" id="auto-assess-height" required value="${user.height || ''}" placeholder="Ex: 175">
            </div>
        `;

        UI.showModal('Nova Avaliação de Progresso', modalContent, async () => {
            const weightInput = document.getElementById('auto-assess-weight');
            const heightInput = document.getElementById('auto-assess-height');

            if (!weightInput || !heightInput) {
                console.error('[Assessment] Inputs not found in DOM');
                return false;
            }

            const weight = parseFloat(weightInput.value);
            const height = parseInt(heightInput.value);

            if (isNaN(weight) || weight <= 0 || isNaN(height) || height <= 0) {
                UI.showNotification('Dados Inválidos', 'Por favor, insira valores numéricos válidos para peso e altura.', 'warning');
                return false;
            }

            UI.showLoading('Salvando avaliação...');
            try {
                const heightM = height / 100;
                const bmiNumber = weight / (heightM * heightM);
                const bmi = isFinite(bmiNumber) ? bmiNumber.toFixed(1) : '0.0';

                let status = 'Peso normal';
                let feedback = 'Excelente! Você está na faixa saudável. Mantenha a consistência nos treinos e dieta.';

                if (bmiNumber < 18.5) {
                    status = 'Abaixo do peso';
                    feedback = 'Foque em aumentar a ingestão calórica e treinos de ganho de massa.';
                } else if (bmiNumber >= 25 && bmiNumber < 30) {
                    status = 'Sobrepeso';
                    feedback = 'Ótimo momento para intensificar os treinos cardiovasculares e controlar os macros.';
                } else if (bmiNumber >= 30) {
                    status = 'Obesidade';
                    feedback = 'Foco total em reeducação alimentar e exercícios diários para melhora do seu condicionamento e bem-estar.';
                }

                // Compare with last - SAFE QUERY
                const rawAssessments = db.query('assessments', a => a && a.student_id === user.id) || [];
                const assessments = [...rawAssessments].sort((a, b) => {
                    const dateA = new Date(a.created_at || a.date || 0);
                    const dateB = new Date(b.created_at || b.date || 0);
                    return dateB - dateA;
                });

                const last = assessments[0] || null;
                if (last && !isNaN(last.weight)) {
                    const diff = (weight - last.weight).toFixed(1);
                    if (diff > 0) feedback += ` (Ganho de ${diff}kg desde a última vez).`;
                    else if (diff < 0) feedback += ` (Perda de ${Math.abs(diff)}kg desde a última vez).`;
                }

                await db.create('assessments', {
                    student_id: user.id,
                    weight,
                    height,
                    notes: `Avaliação do Sistema: ${status}.${feedback} `,
                    measurements: { is_ai_generated: false }
                });

                // Update user weight/height
                await db.update('profiles', user.id, { weight, height });

                // Refresh session
                auth.refreshUser();

                // Increment Usage
                PaymentHelper.incrementUsage(user.id, 'assessment');

                UI.hideLoading();
                UI.showNotification('Avaliação Concluída', 'Seus dados foram atualizados com sucesso! 💪', 'success');

                // Re-render to show new assessment
                if (window.router) {
                    setTimeout(() => {
                        window.router.navigate('/student/progress');
                    }, 500);
                }

                return true;
            } catch (error) {
                console.error('[Assessment] Error during save process:', error);
                UI.hideLoading();
                UI.showNotification('Erro ao Salvar', 'Não foi possível registrar os dados: ' + error.message, 'error');
                return false;
            }
        });
    } catch (outerError) {
        console.error('[Assessment] Error opening modal:', outerError);
        UI.showNotification('Erro', 'Falha ao abrir formulário de avaliação.', 'error');
    }
};

// ============================================
// STUDENT - WORKOUTS LIST
// ============================================
router.addRoute('/student/workouts', () => {
    if (!auth.requireAuth('student')) return;

    const currentUser = auth.getCurrentUser();
    const allWorkouts = db.query('workouts', w => w.student_id === currentUser.id);
    const workouts = allWorkouts.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

    const content = `
    <div class="page-header flex justify-between items-center" >
            <div>
                <h1 class="page-title">Meus Treinos 💪</h1>
                <p class="page-subtitle">Acesse seus treinos personalizados</p>
            </div>
            <button class="btn btn-sm btn-primary btn-ai" onclick="openAIWorkoutGenerator()">
                🤖 Gerar Novo Treino IA
            </button>
        </div>

    ${workouts.length > 0 ? (() => {
            const nextWorkout = getNextWorkout(currentUser, workouts);
            const nextWorkoutId = nextWorkout ? nextWorkout.id : null;

            const sortedWorkouts = workouts.sort((a, b) => {
                if (a.id === nextWorkoutId) return -1;
                if (b.id === nextWorkoutId) return 1;
                return a.name.localeCompare(b.name);
            });

            return `
                <div class="grid grid-2 gap-lg">
                    ${sortedWorkouts.map(w => {
                const isNext = w.id === nextWorkoutId;
                return `
                            <div class="card shadow-sm transition-all ${isNext ? 'border-primary border-2' : 'hover-border-primary'}" style="${isNext ? 'box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);' : ''}">
                                <div class="card-header pb-xs">
                                    <div class="flex justify-between items-center">
                                        <h3 class="card-title">${w.name}</h3>
                                        ${isNext ? '<span class="badge badge-primary">PRÓXIMO 🎯</span>' : ''}
                                    </div>
                                    <p class="text-sm text-muted">${w.type} • ${w.duration} min</p>
                                </div>
                                <div class="card-body">
                                    <div class="flex justify-between items-center">
                                        <span class="badge badge-ghost">${w.exercises.length} exercícios</span>
                                        <div class="flex gap-sm">
                                            <button class="btn btn-outline btn-sm" onclick="router.navigate('/student/workout/details/${w.id}')">
                                                Detalhes
                                            </button>
                                            <button class="btn btn-primary btn-sm" onclick="startWorkoutWithMotivation('${w.id}')">
                                                Iniciar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        })() : `
            <div class="card text-center p-xl">
                <div class="card-body">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🏋️</div>
                    <h3>Nenhum treino encontrado</h3>
                    <p class="text-muted">Você ainda não possui treinos cadastrados.</p>
                </div>
            </div>
        `}
`;

    UI.renderDashboard(content, 'student');
});

// ============================================
// STUDENT - NUTRITION (DIET)
// ============================================
router.addRoute('/student/nutrition', () => {
    if (!auth.requireAuth('student')) return;

    const currentUser = auth.getCurrentUser();
    const diet = db.query('diets', d => d.student_id === currentUser.id)[0];

    const content = `
    <div class="page-header flex justify-between items-center" >
            <div>
                <h1 class="page-title">Minha Dieta 🥗</h1>
                <p class="page-subtitle">Plano alimentar personalizado</p>
            </div>
        </div>

        <!-- Destaque para Atualizar Dieta IA -->
        <div class="card shadow-glow mb-xl" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border: 1px solid rgba(99,102,241,0.4); border-radius: 24px; cursor: pointer; transition: transform 0.2s;" onclick="openAIDietGenerator()">
            <div class="p-lg flex items-center justify-between flex-wrap gap-md">
                <div class="flex items-center gap-md">
                    <div style="font-size: 2.5rem; filter: drop-shadow(0 2px 4px rgba(99,102,241,0.5));">🍎</div>
                    <div>
                        <h4 class="mb-xs text-white" style="font-size: 1.25rem; font-weight: 800;">Atualizar Minha Dieta IA</h4>
                        <p class="text-indigo-200 text-xs mb-0 font-bold uppercase tracking-widest">GERAR NOVO CARDÁPIO INTELIGENTE</p>
                    </div>
                </div>
                <button class="btn font-black shadow-sm" style="background: white; color: #312e81; border: none; padding: 12px 24px; border-radius: 14px; font-size: 0.9rem;">
                    🔄 GERAR IA
                </button>
            </div>
        </div>

    ${diet ? `
            <div class="grid grid-4 mb-xl gap-md">
                <div class="stat-card">
                    <div class="stat-value text-primary">${diet.calories}</div>
                    <div class="stat-label">Calorias (kcal)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value text-success">${diet.protein}g</div>
                    <div class="stat-label">Proteínas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value text-warning">${diet.carbs}g</div>
                    <div class="stat-label">Carbos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value text-danger">${diet.fat}g</div>
                    <div class="stat-label">Gorduras</div>
                </div>
            </div>

            <div class="flex flex-col gap-lg">
                ${diet.meals.map(meal => `
                    <div class="card shadow-sm">
                        <div class="card-header flex justify-between items-center" style="background: var(--bg-secondary); border-bottom: 1px solid var(--border);">
                            <h3 class="card-title mb-0">${meal.name}</h3>
                            <span class="badge badge-ghost">${meal.time}</span>
                        </div>
                        <div class="card-body">
                            <ul class="flex flex-col gap-xs" style="list-style: none; padding: 0;">
                                ${meal.foods.map(food => `
                                    <li class="flex items-center gap-sm">
                                        <span class="text-primary">●</span>
                                        <span>${food}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="card text-center p-xl">
                <div class="card-body">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🍎</div>
                    <h3>Dieta não configurada</h3>
                    <p class="text-muted">Você ainda não possui um plano alimentar cadastrado.</p>
                </div>
            </div>
        `}
`;

    UI.renderDashboard(content, 'student');
});

// ============================================
// STUDENT - PROGRESS (ASSESSMENTS)
// ============================================
router.addRoute('/student/progress', () => {
    if (!auth.requireAuth('student')) return;

    const currentUser = auth.getCurrentUser();
    const assessments = db.query('assessments', a => a.student_id === currentUser.id).sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

    const content = `
    <div class="page-header flex justify-between items-center" >
            <div>
                <h1 class="page-title">Meu Progresso 📈</h1>
                <p class="page-subtitle">Acompanhe sua evolução física</p>
            </div>
            <button class="btn btn-sm btn-primary" onclick="openAutoAssessment()">
                📊 Nova Avaliação
            </button>
        </div>

    ${assessments.length > 0 ? `
            <div class="grid grid-2 gap-lg mb-xl">
                <!-- Weight Evolution Chart -->
                <div class="card shadow-sm">
                    <div class="card-header">
                        <h3 class="card-title">Evolução de Peso</h3>
                    </div>
                    <div class="card-body">
                        <canvas id="weightEvolutionChart" style="height: 250px;"></canvas>
                    </div>
                </div>

                <!-- BMI Tracking -->
                <div class="card shadow-sm">
                    <div class="card-header">
                        <h3 class="card-title">Últimas Avaliações</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-sm">
                            ${assessments.slice(0, 5).map(a => `
                                <div class="flex justify-between items-center p-sm bg-light rounded shadow-xs">
                                    <div>
                                         <div class="font-weight-600">${new Date(a.created_at || a.date).toLocaleDateString('pt-BR')}</div>
                                        <div class="text-xs text-muted">${a.weight}kg • ${a.height}cm</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="badge badge-primary">${(a.weight / ((a.height / 100) ** 2)).toFixed(1)} IMC</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Detailed History -->
            <h3>Histórico Detalhado</h3>
            <div class="flex flex-col gap-lg mt-md">
                ${assessments.map(a => `
                    <div class="card shadow-sm">
                        <div class="card-header bg-light">
                            <strong>Avaliação em ${new Date(a.created_at || a.date).toLocaleDateString('pt-BR')}</strong>
                        </div>
                        <div class="card-body">
                            <div class="grid grid-3 gap-md mb-md">
                                <div><span class="text-muted">Peso:</span> <strong>${a.weight} kg</strong></div>
                                <div><span class="text-muted">Altura:</span> <strong>${a.height} cm</strong></div>
                                <div><span class="text-muted">BF:</span> <strong>${a.body_fat_percentage || a.bf || '-'} %</strong></div>
                            </div>
                            ${a.notes ? `<p class="text-sm bg-light p-sm rounded"><strong>Observações:</strong> ${a.notes}</p>` : ''}
                            
                            ${a.photos && a.photos.length > 0 ? `
                                <div class="mt-md"> <span class="text-muted text-xs">Registros Visuais:</span>
                                    <div class="flex gap-sm mt-xs overflow-x-auto pb-sm">
                                        ${a.photos.map(p => `<img src="${p}" style="height:120px; border-radius:12px; border:1px solid var(--border);">`).join('')}
                                    </div>
                                </div>
                            ` : (a.photo_front ? `
                                <div class="mt-md"> <span class="text-muted text-xs">Registros Visuais:</span>
                                    <div class="flex gap-sm mt-xs">
                                        ${a.photo_front ? `<img src="${a.photo_front}" style="height:120px; border-radius:12px; border:1px solid var(--border);">` : ''}
                                        ${a.photo_side_right ? `<img src="${a.photo_side_right}" style="height:120px; border-radius:12px; border:1px solid var(--border);">` : ''}
                                        ${a.photo_side_left ? `<img src="${a.photo_side_left}" style="height:120px; border-radius:12px; border:1px solid var(--border);">` : ''}
                                    </div>
                                </div>
                            ` : '')}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="card text-center p-xl">
                <div class="card-body">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📏</div>
                    <h3>Nenhuma avaliação ainda</h3>
                    <p class="text-muted">Faça sua primeira avaliação para começar a acompanhar seu progresso.</p>
                </div>
            </div>
        `}
`;

    UI.renderDashboard(content, 'student');

    // Initialize Chart
    if (assessments.length > 1) {
        setTimeout(() => {
            const ctx = document.getElementById('weightEvolutionChart');
            if (ctx) {
                const sorted = [...assessments].reverse();
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: sorted.map(a => new Date(a.date).toLocaleDateString('pt-BR')),
                        datasets: [{
                            label: 'Peso (kg)',
                            data: sorted.map(a => a.weight),
                            borderColor: '#6366f1',
                            tension: 0.3,
                            fill: true,
                            backgroundColor: 'rgba(99, 102, 241, 0.1)'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: false, ticks: { color: '#94a3b8' } },
                            x: { ticks: { color: '#94a3b8' } }
                        }
                    }
                });
            }
        }, 100);
    }
});

// ============================================
// STUDENT - WORKOUT DETAILS
// ============================================
router.addRoute('/student/workout/details/:id', (params) => {
    if (!auth.requireAuth('student')) return;

    const workout = db.getById('workouts', params.id);
    if (!workout) {
        UI.showNotification('Erro', 'Treino não encontrado', 'error');
        router.navigate('/student/workouts');
        return;
    }

    const content = `
    <div class="page-header flex justify-between items-center" >
            <div>
                <button class="btn btn-sm btn-ghost mb-sm" onclick="router.navigate('/student/workouts')">
                    ← Voltar
                </button>
                <h1 class="page-title">${workout.name}</h1>
                <p class="page-subtitle">${workout.type} • ${workout.duration} min • ${workout.exercises.length} exercícios</p>
            </div>
            <button class="btn btn-primary" onclick="startWorkoutWithMotivation('${workout.id}')">
                ▶️ Iniciar Agora
            </button>
        </div>

        <div class="flex flex-col gap-lg">
            ${workout.exercises.map((ex, index) => {
        const theme = getMuscleTheme(ex.name);
        return `
                <div class="card shadow-sm exercise-card-premium" style="border-left: 5px solid ${theme.color}">
                    <div class="card-body flex gap-lg items-center">
                        <div class="exercise-mini-visual">
                            <img src="${getExerciseVisual(ex.name)}" alt="${ex.name}" 
                                 loading="lazy">
                        </div>
                        <div class="flex-1">
                            <h3 class="mb-xs">${index + 1}. ${ex.name}</h3>
                            <div class="flex gap-md text-sm text-muted">
                                <span><strong>${ex.sets || ex.series || '3'}</strong> séries</span>
                                <span><strong>${ex.reps || '12'}</strong> reps</span>
                                <span><strong>${ex.rest || '60'}s</strong> descanso</span>
                            </div>
                            <div class="text-xs uppercase font-bold mt-xs" style="color: ${theme.color}">${theme.label}</div>
                            ${ex.notes ? `<p class="text-xs mt-sm text-accent italic">💡 ${ex.notes}</p>` : ''}
                            
                            ${getExerciseVideoHTML(ex.name)}
                        </div>
                    </div>
                </div>
            `}).join('')}
        </div>

        <div class="mt-xl text-center">
            <button class="btn btn-primary btn-lg btn-block" onclick="startWorkoutWithMotivation('${workout.id}')">
                VAMOS COMEÇAR! 💪
            </button>
        </div>
`;

    UI.renderDashboard(content, 'student');
});

const motivacionalPhrases = [
    "O corpo alcança o que a mente acredita! 💪",
    "Não pare quando estiver cansado, pare quando terminar! 🔥",
    "Sua única competição é você mesmo ontem.",
    "Disciplina é fazer o que precisa ser feito, mesmo sem vontade.",
    "Cada gota de suor é um passo em direção ao seu objetivo.",
    "A dor de hoje é a força de amanhã.",
    "Você é mais forte do que imagina! 🚀",
    "Foco no progresso, não na perfeição.",
    "Transforme 'eu queria' em 'eu consegui'.",
    "Se fosse fácil, todo mundo faria. Seja diferente! 🏆"
];

// --- Workout Player ---
window.startWorkoutWithMotivation = (id, studentId = null) => {
    // Show a motivational popup before starting
    const quote = motivacionalPhrases[Math.floor(Math.random() * motivacionalPhrases.length)];

    UI.showModal('Prepare-se!', `
    <div class="text-center py-lg" >
            <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔥</div>
            <h3 class="mb-md">${quote}</h3>
            <p class="text-muted mb-xl">Respire fundo, beba água e vamos dominar esse treino.</p>
            <button class="btn btn-primary btn-block btn-lg" onclick="UI.closeModal(); window.startWorkout('${id}', ${studentId ? `'${studentId}'` : 'null'});">
                COMEÇAR AGORA 🚀
            </button>
        </div>
    `);
};
window.startWorkout = (id, studentId = null, resumeIndex = null) => {
    const workout = db.getById('workouts', id);
    if (!workout) return;

    window._workoutStartTime = resumeIndex !== null && window._resumeStartTime ? new Date(window._resumeStartTime) : new Date();

    // Persist session if not already resuming with a specific time
    const saveSession = (index) => {
        localStorage.setItem('fitpro_active_session', JSON.stringify({
            workout_id: id,
            student_id: studentId,
            start_index: index,
            start_time: window._workoutStartTime.toISOString(),
            timestamp: new Date().getTime()
        }));
    };

    // Store reference for finish handler
    window._currentSessionWorkout = workout;
    window._currentSessionStudentId = studentId;

    if (window._workoutTimerInterval) clearInterval(window._workoutTimerInterval);
    let currentExerciseIndex = resumeIndex !== null ? resumeIndex : 0;
    let timeRemaining = 0;
    let isTimerRunning = false;

    // Initial save
    saveSession(currentExerciseIndex);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s} `;
    };

    window.toggleWorkoutTimer = () => {
        if (isTimerRunning) {
            clearInterval(window._workoutTimerInterval);
            isTimerRunning = false;
        } else {
            if (timeRemaining <= 0) {
                const ex = workout.exercises[currentExerciseIndex];
                timeRemaining = parseInt(ex.rest) || 60;
            }
            isTimerRunning = true;
            BeepHelper.playStartRest(); // 1 Beep at start
            window._workoutTimerInterval = setInterval(() => {
                if (timeRemaining > 0) {
                    timeRemaining--;
                    const display = document.getElementById('timer-display');
                    if (display) display.innerText = formatTime(timeRemaining);
                } else {
                    clearInterval(window._workoutTimerInterval);
                    isTimerRunning = false;
                    BeepHelper.playEndRest(); // 2 Beeps at end
                    UI.showNotification('Descanso Concluído!', 'Hora da próxima série! 💪', 'success');
                    renderWorkoutStep();
                }
            }, 1000);
        }
        renderWorkoutStep();
    };

    window.resetWorkoutTimer = () => {
        clearInterval(window._workoutTimerInterval);
        isTimerRunning = false;
        const ex = workout.exercises[currentExerciseIndex];
        timeRemaining = parseInt(ex.rest) || 60;
        renderWorkoutStep();
    };

    window.nextExercise = () => {
        if (currentExerciseIndex < workout.exercises.length - 1) {
            clearInterval(window._workoutTimerInterval);
            isTimerRunning = false;
            timeRemaining = 0;
            currentExerciseIndex++;
            saveSession(currentExerciseIndex);
            renderWorkoutStep();
        }
    };

    window.prevExercise = () => {
        if (currentExerciseIndex > 0) {
            clearInterval(window._workoutTimerInterval);
            isTimerRunning = false;
            timeRemaining = 0;
            currentExerciseIndex--;
            saveSession(currentExerciseIndex);
            renderWorkoutStep();
        }
    };

    // Safe finish handler — no JSON in HTML attributes
    window._finishCurrentWorkout = () => {
        window.finishWorkout(window._currentSessionWorkout, window._currentSessionStudentId);
    };

    const renderWorkoutStep = () => {
        const ex = workout.exercises[currentExerciseIndex];
        const theme = getMuscleTheme(ex.name);

        // Helper for RGB conversion (for shadow/rgba effects)
        const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `${r}, ${g}, ${b} `;
        };

        // Dynamic theme injection
        document.documentElement.style.setProperty('--muscle-accent', theme.color);
        document.documentElement.style.setProperty('--muscle-accent-rgb', hexToRgb(theme.color));

        const modalContent = `
    <div class="workout-player-container ultimate-theme" >
                <div class="exercise-info-header">
                    <h2 class="exercise-title-premium">${ex.name}</h2>
                    <div class="muscle-group-badge">
                        ${theme.label} | EXERCÍCIO ${currentExerciseIndex + 1} DE ${workout.exercises.length}
                    </div>
                </div>

                <div class="exercise-visual-container">
                    <div class="exercise-immersive-visual">
                        <div class="muscle-tag-premium">${theme.label}</div>
                        ${(() => {
                // Use a helper function for consistent video rendering
                const html = getExerciseVideoHTML(ex.name, true);
                if (html) return html;

                // Fallback to default visual if no video mapping found
                return `<img src="${getExerciseVisual(ex.name)}" alt="${ex.name}" class="visual-boneco" id="workout-step-img">`;
            })()}
                    </div>
                </div>

                <div class="ultimate-stats-container">
                    <div class="ultimate-stat-card">
                        <div class="ultimate-stat-label">Séries</div>
                        <div class="ultimate-stat-value">${ex.sets || ex.series || '3'}</div>
                    </div>
                    <div class="ultimate-stat-card">
                        <div class="ultimate-stat-label">Reps</div>
                        <div class="ultimate-stat-value">${ex.reps || '12'}</div>
                    </div>
                    <div class="ultimate-stat-card">
                        <div class="ultimate-stat-label">Descanso</div>
                        <div class="ultimate-stat-value">${ex.rest || '60'}s</div>
                    </div>
                </div>

                <div class="timer-card-premium ${isTimerRunning ? 'timer-active' : ''}">
                    <div class="timer-header">
                        <span>DESCANSAR</span>
                    </div>
                    <div class="timer-display" id="timer-display">${formatTime(timeRemaining || (parseInt(ex.rest) || 60))}</div>
                    <div class="timer-actions">
                        <button class="timer-btn-toggle" onclick="window.toggleWorkoutTimer()">
                             ${isTimerRunning ? '⏸️ PAUSAR' : '▶️ INICIAR'}
                        </button>
                        <br>
                        <button class="timer-btn-reset" onclick="window.resetWorkoutTimer()">
                            🔄 RESET
                        </button>
                    </div>
                </div>

                <div class="workout-controls-ultimate">
                    <button class="btn-ultimate-prev" onclick="window.prevExercise()" ${currentExerciseIndex === 0 ? 'disabled' : ''}>
                        VOLTAR
                    </button>
                    ${currentExerciseIndex === workout.exercises.length - 1 ?
                `<button class="btn-ultimate-next" onclick="window._finishCurrentWorkout()">
                             FINALIZAR 🏆
                         </button>` :
                `<button class="btn-ultimate-next" onclick="window.nextExercise()">
                             PRÓXIMO ➔
                         </button>`
            }
                </div>
            </div>
    `;

        UI.showModal(`Treino: ${workout.name} `, modalContent);
    };

    renderWorkoutStep();
};

window.finishWorkout = async (workout, studentId = null) => {
    // Clear any running timer intervals/audio
    if (window._workoutTimerInterval) clearInterval(window._workoutTimerInterval);

    // Cálculo de tempo
    const startTime = window._workoutStartTime || new Date();
    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / 60000);
    const timing = {
        start: startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        end: endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        duration: duration
    };

    try {
        console.log("Finalizando treino:", workout);
        const currentUser = auth.getCurrentUser();
        if (!currentUser) throw new Error("Usuário não autenticado");

        // Determination of the actual owner of the progress
        const targetStudentId = studentId || currentUser.id;
        const isPersonalActing = !!studentId && currentUser.role === 'personal';

        const workoutName = (workout && workout.name) ? workout.name : 'Treino T-FIT';
        const rawWorkoutId = (workout && workout.id) ? workout.id : '';
        // UUID check to prevent FK errors in Supabase
        const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        const finalWorkoutId = isUUID(rawWorkoutId) ? rawWorkoutId : null;

        const completionData = {
            student_id: targetStudentId,
            workout_id: finalWorkoutId,
            workout_name: workoutName
        };

        // Insert the completion using await to catch any DB errors properly
        await db.create('workout_completions', completionData);

        // Award T-Points for workout completion
        if (targetStudentId === currentUser.id && typeof GrowthSystem !== 'undefined') {
            GrowthSystem.awardPoints(targetStudentId, 'treino_concluido');
        }

        // Clear active session
        localStorage.removeItem('fitpro_active_session');
        delete window._resumeStartTime;

        // Track progression (A -> B -> C)
        const letterMatch = workoutName.match(/Treino ([A-G])/i);
        let nextWorkoutName = '';
        if (letterMatch) {
            const letter = letterMatch[1].toUpperCase();
            console.log(`Progredindo treino para letra: ${letter} `);

            // Fetch current profile to get existing stats
            const currentProfile = db.getById('profiles', targetStudentId) || {};
            const workoutStats = currentProfile.workout_stats || {};
            workoutStats.lastCompletedLetter = letter;

            // Await the update using the existing JSONB column "workout_stats"
            await db.update('profiles', targetStudentId, { workout_stats: workoutStats }, { silent: true });

            // Refresh user session to update progression data for the dashboard
            await auth.refreshUser();

            // Compatibility for getNextWorkout locally after save
            const targetUser = auth.getCurrentUser();
            if (targetUser) targetUser.lastCompletedLetter = letter;

            // Peek at next workout for the notification
            const allWorkouts = db.query('workouts', w => w.student_id === targetStudentId);
            const nextW = typeof getNextWorkout === 'function' ? getNextWorkout(targetUser, allWorkouts) : null;
            if (nextW) nextWorkoutName = nextW.name;
        }

        UI.closeModal();

        if (isPersonalActing) {
            UI.showNotification('Treino Registrado!', 'O treino do aluno foi concluído com sucesso.', 'success');
            if (window.router) window.router.navigate('/personal/dashboard');
        } else {
            // Show the premium celebration screen for students
            UI.showWorkoutCompletion(workout, timing);
        }
    } catch (error) {
        console.error("Erro fatal ao finalizar/salvar treino:", error);

        // Show non-blocking warning (since we'll still show the card)
        UI.showNotification('Aviso', 'Seu treino foi concluído, mas houve um erro ao sincronizar o histórico.', 'warning');

        UI.closeModal();

        if (studentId && auth.getCurrentUser()?.role === 'personal') {
            if (window.router) window.router.navigate('/personal/dashboard');
        } else {
            // IMPORTANT: Still show the completion card even if DB sync failed! 
            // This ensures the user sees the photo taking card.
            UI.showWorkoutCompletion(workout, timing);
        }
    }
};
// --- Motivation & Notifications System ---



const dailyNotifications = [
    "Bom dia! ☀️ Já se hidratou hoje?",
    "Lembrete: Seu corpo precisa de movimento! 🏃‍♂️",
    "Hora de focar nos seus objetivos! 🎯",
    "Não pule o treino de hoje! Você vai se agradecer depois.",
    "Alimentação em dia? 🥗 Lembre-se das suas metas!",
    "Descanse bem para treinar melhor amanhã! 😴"
];

// Helper to get random item
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Initialize Daily Notification check
const checkDailyNotification = () => {
    const lastNotif = localStorage.getItem('fitpro_last_daily_notif');
    const today = new Date().toDateString();

    if (lastNotif !== today) {
        // Show notification
        const msg = getRandom(dailyNotifications);
        setTimeout(() => {
            UI.showNotification('T-FIT Diz:', msg, 'info');
        }, 2000); // Delay slightly for effect
        localStorage.setItem('fitpro_last_daily_notif', today);
    }
};

// Hook into Dashboard load
const originalDashboardRoute = window.router?.routes['/student/dashboard'];
if (originalDashboardRoute) {
    // Only wrap if not already wrapped (simple check)
    // Actually simpler to just call it inside the route handler if we edited it, 
    // but here we are appending. Let's make a global init function.
    // For now, let's just run it whenever this file is loaded/app starts if user is student.
    const user = auth.getCurrentUser();
    if (user && user.type === 'student') {
        checkDailyNotification();
    }
}


// --- "Ultimate Edition" Exercise Visuals System ---

// Professional 3D Animated Library (Reliable Sources)
// Reliable Giphy IDs for Ultimate Experience (B&W / Clean 3D)
window.EXERCISE_VISUALS = {
    // Peito (Chest)
    'supino reto': 'assets/exercises/supino-reto.gif',
    'supino inclinado': 'assets/exercises/supino-inclinado.gif',
    'flexão': 'assets/exercises/flexao.gif',
    'voador': 'assets/exercises/voador.gif',
    'crucifixo': 'assets/exercises/crucifixo.gif',
    'mergulho paralelas': 'assets/exercises/mergulho-paralelas.gif',
    'pike push-up': 'assets/exercises/pike-push-up.gif',

    // Costas (Back)
    'puxada alta': 'assets/exercises/puxada-alta.gif',
    'remada baixa': 'assets/exercises/remada-baixa.gif',
    'remada curvada': 'assets/exercises/remada-curvada.gif',
    'serrote': 'assets/exercises/serrote.gif',
    'barra fixa': 'assets/exercises/barra-fixa.gif',
    'superman': 'assets/exercises/superman.gif',

    // Pernas (Legs)
    'agachamento': 'assets/exercises/agachamento.gif',
    'leg press': 'assets/exercises/leg-press.gif',
    'stiff': 'assets/exercises/stiff.gif',
    'extensora': 'assets/exercises/extensora.gif',
    'flexor': 'assets/exercises/flexor.gif',
    'afundo': 'assets/exercises/afundo.gif',
    'passada': 'assets/exercises/passada.gif',
    'panturrilha': 'assets/exercises/panturrilha.gif',
    'elevação pélvica': 'assets/exercises/elevacao-pelvica.gif',
    'glute bridge': 'assets/exercises/glute-bridge.gif',

    // Braços (Arms)
    'rosca direta': 'assets/exercises/rosca-direta.gif',
    'rosca martelo': 'assets/exercises/rosca-martelo.gif',
    'rosca concentrada': 'assets/exercises/rosca-concentrada.gif',
    'tríceps corda': 'assets/exercises/triceps-corda.gif',
    'tríceps testa': 'assets/exercises/triceps-testa.gif',
    'tríceps francês': 'assets/exercises/triceps-frances.gif',
    'tríceps coice': 'assets/exercises/triceps-coice.gif',
    'bíceps': 'assets/exercises/biceps.gif',

    // Ombros (Shoulders)
    'desenvolvimento': 'assets/exercises/desenvolvimento.gif',
    'elevação lateral': 'assets/exercises/elevacao-lateral.gif',
    'frontal': 'assets/exercises/frontal.gif',

    // Cardio / Abdominais
    'abdominal': 'assets/exercises/abdominal.gif',
    'burpee': 'assets/exercises/burpee.gif',
    'polichinelo': 'assets/exercises/polichinelo.gif',
    'corrida': 'assets/exercises/corrida.gif',
    'salto': 'assets/exercises/salto.gif',
    'prancha': 'assets/exercises/prancha.gif'
};

// Generic Muscle Group Mapping (Fallback)
window.MUSCLE_VISUALS = {
    'peito': 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeXNjNXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKVUn7iM8FMEU24/giphy.gif',
    'costas': 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeXNjNXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKv5p5U9iS7G5G0/giphy.gif',
    'pernas': 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeXNjNXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKv4p5U9iS7G5G0/giphy.gif',
    'braços': 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeXNjNXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKvGp5U9iS7G5G0/giphy.gif',
    'ombros': 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeXNjNXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKvSP5U9iS7G5G0/giphy.gif',
    'cardio': 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeXNjNXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKvCo5U9iS7G5G0/giphy.gif'
};

const getExerciseVisual = (name) => {
    // Default pulsing animation for missing ones
    const defaultVisual = 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeXNjNXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKv4p5U9iS7G5G0/giphy.gif';
    if (!name) return defaultVisual;
    const n = name.toLowerCase();

    // 1. Priority: Database (Custom User Upload uploads)
    const storedMedia = db.getById('media_assets', n);
    if (storedMedia && storedMedia.base64 && storedMedia.base64.length > 50) {
        return storedMedia.base64;
    }

    // 2. Secondary: EXERCISE_VISUALS mapping
    for (const [key, url] of Object.entries(window.EXERCISE_VISUALS)) {
        if (n.includes(key)) {
            // Return URL, but we have an 'onerror' in the <img> tag that handles if file is truly missing
            return url;
        }
    }

    // 3. Robust Check: Try to guess the path if not in mapping
    // This helps if user adds a file but we forgot to map it
    const slug = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
    // We return the predicted path, and the onerror will catch it if it doesn't exist
    if (slug.length > 3) return `assets / exercises / ${slug}.gif`;

    // 4. Muscle group fallback
    const getFallback = (group) => {
        const stored = db.getById('media_assets', `fallback_${group} `);
        if (stored && stored.base64) return stored.base64;
        return window.MUSCLE_VISUALS[group] || defaultVisual;
    };

    if (n.includes('peit') || n.includes('supin') || n.includes('voador') || n.includes('crucif')) return getFallback('peito');
    if (n.includes('costa') || n.includes('puxad') || n.includes('remad') || n.includes('serrot')) return getFallback('costas');
    if (n.includes('pern') || n.includes('coxa') || n.includes('agacham') || n.includes('leg') || n.includes('extens') || n.includes('flexor')) return getFallback('pernas');
    if (n.includes('braç') || n.includes('rosca') || n.includes('tricep') || n.includes('bicep') || n.includes('antebr')) return getFallback('braços');
    if (n.includes('ombro') || n.includes('elevac') || n.includes('desenvolv')) return getFallback('ombros');
    if (n.includes('cardio') || n.includes('abdominal') || n.includes('corrida') || n.includes('pulo') || n.includes('salt')) return getFallback('cardio');

    return defaultVisual;
};


const getMuscleTheme = (name) => {
    if (!name) return { color: '#6366f1', label: 'Geral' }; // Indigo default
    const n = name.toLowerCase();

    if (n.includes('peit') || n.includes('supin')) return { color: '#ef4444', label: 'Peito' };
    if (n.includes('costa') || n.includes('puxad') || n.includes('remad')) return { color: '#3b82f6', label: 'Costas' };
    if (n.includes('pern') || n.includes('coxa') || n.includes('leg') || n.includes('agacham')) return { color: '#10b981', label: 'Pernas' };
    if (n.includes('braç') || n.includes('rosca') || n.includes('tricep') || n.includes('bicep')) return { color: '#f59e0b', label: 'Braços' };
    if (n.includes('ombro')) return { color: '#8b5cf6', label: 'Ombros' };
    if (n.includes('cardio') || n.includes('corrida') || n.includes('polichinelo')) return { color: '#06b6d4', label: 'Cardio' };

    return { color: '#6366f1', label: 'Treino' };
};

window.contactMyPersonal = () => {
    const user = auth.getCurrentUser();
    let phone = '5511911917087'; // Default Support

    if (user.assigned_personal_id) {
        const personal = db.getById('personals', user.assigned_personal_id);
        if (personal && personal.phone) {
            phone = personal.phone;
        }
    } else {
        const admin = db.getById('admins', 'ad000000-1111-2222-3333-444455556666');
        if (admin && admin.phone) {
            phone = admin.phone;
        }
    }

    WhatsApp.contactPersonal(phone, user.name);
};

// --- Exercise Visual Helper Functions ---

window.GIPHY_MAPPING = {
    'chest': 'https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif', // Chest/Arms/Shoulders
    'legs': 'https://i.giphy.com/l41lOflvX6L2zMhXO.gif', // Legs
    'cardio': 'https://i.giphy.com/u6A76097A19rW.gif', // Cardio
    'default': 'https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif'
};

window.handleExerciseImageLoad = (img, badgeId) => {
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.innerText = img.src.split('/').pop();
        badge.classList.add('active');
        badge.style.color = '#10b981'; // Green color for "functioning"
    }
};

window.handleExerciseImageError = (img, exerciseName, badgeId) => {
    console.warn(`Erro ao carregar imagem para ${exerciseName}. Tentando fallback...`);

    // Determine which Giphy URL to use as fallback based on name
    const n = exerciseName.toLowerCase();
    let fallback = window.GIPHY_MAPPING.default;

    if (n.includes('peit') || n.includes('supin') || n.includes('braç') || n.includes('rosca') || n.includes('ombro')) {
        fallback = window.GIPHY_MAPPING.chest;
    } else if (n.includes('pern') || n.includes('coxa') || n.includes('agacham') || n.includes('leg')) {
        fallback = window.GIPHY_MAPPING.legs;
    } else if (n.includes('cardio') || n.includes('corrida') || n.includes('abdominal')) {
        fallback = window.GIPHY_MAPPING.cardio;
    }

    // Update badge to show we are using fallback
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.innerText = "Fallback: " + fallback.split('/').pop();
        badge.style.color = '#f59e0b'; // Yellow for fallback
    }

    img.onerror = null; // Prevent infinite loop
    img.src = fallback;

    // Once fallback loads, it will trigger handleExerciseImageLoad which will make it green
};

console.log('Student-pages.js loaded successfully');
// --- Student Global Helpers ---
window.payPersonalPlan = (planId) => {
    // 1. Search in planos_personal (New Table)
    let plan = db.getById('planos_personal', planId);

    // 2. Fallback to old plans table (Legacy/AI)
    if (!plan) {
        plan = db.getById('plans', planId);
    }

    if (!plan) {
        console.error('Plano não encontrado:', planId);
        UI.showNotification('Erro', 'Plano não encontrado. Tente atualizar a página.', 'error');
        return;
    }

    const price = parseFloat(plan.preco || plan.price);
    if (isNaN(price)) {
        console.error('Preço do plano inválido:', plan);
        UI.showNotification('Erro', 'Preço do plano inválido.', 'error');
        return;
    }

    const description = `Renovação: ${plan.nome || plan.name} `;
    const personalId = plan.personal_id || plan.created_by || '';

    if (window.startCheckout) {
        window.startCheckout(price, description, planId, personalId, 'marketplace_plan');
    } else {
        UI.showNotification('Erro', 'Sistema de pagamento não inicializado.', 'error');
    }
};

window.showMyPersonalPlanDetails = () => {
    const user = auth.getCurrentUser();
    const alunoPlano = db.query('alunos_planos', ap => ap.aluno_id === user.id && ap.status === 'ativo')[0];

    if (!alunoPlano) {
        UI.showModal('Meu Plano', '<div class="p-lg text-center"><p class="text-muted">Você não possui um plano de personal ativo.</p></div>');
        return;
    }

    const plan = db.getById('planos_personal', alunoPlano.plano_id);
    const personal = db.getById('personais', alunoPlano.personal_id);

    const dataInicio = new Date(alunoPlano.data_inicio).toLocaleDateString('pt-BR');
    const dataVenc = new Date(alunoPlano.data_proxima_cobranca).toLocaleDateString('pt-BR');

    const modalContent = `
    <div class="p-md" >
            <div class="card p-md bg-light mb-lg" style="border-left: 4px solid var(--primary);">
                <h3 class="mb-xs">${plan ? plan.nome : 'Plano Personal'}</h3>
                <p class="text-sm text-muted mb-0">Contratado em: ${dataInicio}</p>
            </div>

            <div class="grid grid-2 gap-md mb-lg">
                <div class="p-sm border rounded">
                    <div class="text-xs text-muted uppercase">Status</div>
                    <div class="font-bold text-success">Ativo</div>
                </div>
                <div class="p-sm border rounded">
                    <div class="text-xs text-muted uppercase">Próxima Cobrança</div>
                    <div class="font-bold">${dataVenc}</div>
                </div>
            </div>

            <h4 class="mb-sm text-primary">📑 Benefícios do Plano</h4>
            <div class="bg-white p-md rounded border mb-lg">
                ${plan && plan.beneficios && plan.beneficios.length > 0 ? `
                    <ul class="text-sm space-y-xs">
                        ${plan.beneficios.map(b => `<li>✓ ${b}</li>`).join('')}
                    </ul>
                ` : '<p class="text-xs text-muted">Benefícios padrão inclusos.</p>'}
            </div>

            <h4 class="mb-sm text-primary">👤 Meu Personal</h4>
            <div class="flex items-center gap-md p-md border rounded mb-xl">
                <div class="sidebar-avatar" style="width: 50px; height: 50px; font-size: 1.2rem;">
                    ${personal && personal.foto ? `<img src="${personal.foto}">` : (personal?.nome || 'P').charAt(0)}
                </div>
                <div>
                    <div class="font-bold">${personal ? personal.nome : 'Personal Trainer'}</div>
                    <div class="text-xs text-muted">${personal ? personal.especialidade : 'Acompanhamento'}</div>
                </div>
            </div>

            <button class="btn btn-primary btn-block mb-sm" onclick="window.payPersonalPlan('${alunoPlano.plano_id}')">
                💰 Renovar Agora (Manual)
            </button>
            <p class="text-center text-xs text-muted">A renovação não é automática. Você receberá um aviso 7 dias antes do vencimento.</p>
        </div>
    `;

    UI.showModal('Detalhes da Assinatura', modalContent);
};

window.cancelHiringRequest = () => {
    UI.confirmDialog('Cancelar Solicitação', 'Deseja realmente cancelar seu pedido de contratação?', () => {
        const user = auth.getCurrentUser();
        db.update('profiles', user.id, {
            assigned_personal_id: null,
            personal_name: null,
            plan_id: null,
            status: 'active'
        });
        auth.refreshUser();
        router.navigate('/student/dashboard');
        UI.showNotification('Ok', 'Solicitação cancelada.', 'info');
    });
};
