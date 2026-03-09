/**
 * TFIT - Payment & Access Control Helper
 * Manages Mercado Pago integration and student access status.
 */

window.PaymentHelper = {
    /**
     * Checks if a student has active access or is in trial.
     * @param {Object} user - The current user object.
     * @returns {Object} { status: 'active'|'trial'|'blocked', daysLeft: Number }
     */
    /**
     * Checks if a user has active access or is in trial.
     * @param {Object} user - The current user object.
     * @returns {Object} { status: 'active'|'trial'|'blocked', daysLeft: Number, permissions: Object }
     */
    checkStudentAccess: (user) => {
        if (!user) return { status: 'blocked', blocked: true, daysLeft: 0, permissions: { ai: false, personal: false, base: false } };

        // 1. ADM always has full access
        if (user.role === 'admin') return { status: 'active', blocked: false, daysLeft: 999, permissions: { ai: true, personal: true, base: true } };

        const now = new Date();
        const permissions = { ai: false, personal: false, base: false };

        // 2. PLATFORM FEE / SYSTEM ACCESS (ACTIVE ONLY)
        const expiryStr = user.data_vencimento || user.plan_expiry;
        if (expiryStr && user.plano_ativo !== false) {
            const dueDate = new Date(expiryStr);
            if (dueDate > now) {
                permissions.base = true; permissions.ai = true; permissions.personal = true;
                return { status: 'active', blocked: false, daysLeft: Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)), permissions };
            }
        }

        // 3. MARKETPLACE ACCESS (Student hiring Personal Plans)
        if (user.role === 'student' || user.type === 'student') {
            const marketplacePlan = db.query('alunos_planos', ap => ap.aluno_id === user.id && ap.status === 'ativo')[0];
            if (marketplacePlan) {
                const dueDate = marketplacePlan.data_proxima_cobranca ? new Date(marketplacePlan.data_proxima_cobranca) : null;
                if (dueDate && dueDate > now) {
                    permissions.base = true; permissions.ai = true; permissions.personal = true;
                    return { status: 'active', blocked: false, daysLeft: Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)), permissions };
                }
            }

            // Legacy Contracts Check (Just in case Pix was mapped here)
            const activeContract = db.query('contracts', c => c.student_id === user.id && c.status === 'active')[0];
            if (activeContract) {
                const dueDate = activeContract.end_date ? new Date(activeContract.end_date) : null;
                if (!dueDate || dueDate > now) {
                    permissions.base = true; permissions.ai = true; permissions.personal = true;
                    return { status: 'active', blocked: false, daysLeft: dueDate ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) : 30, permissions };
                }
            }
        }

        // 4. SELF-HEALING (Auto-Activation via Approved History)
        if (typeof db !== 'undefined') {
            const latestPayment = (user.role === 'student')
                ? db.getAll('pagamentos').filter(p => p.aluno_id === user.id && p.status === 'aprovado').sort((a, b) => new Date(b.created_at || b.data_pagamento) - new Date(a.created_at || a.data_pagamento))[0]
                : db.getAll('tfit_payments').filter(p => p.user_id === user.id && (p.status === 'approved' || p.status === 'aprovado')).sort((a, b) => new Date(b.created_at || b.data_confirmacao) - new Date(a.created_at || a.data_confirmacao))[0];

            if (latestPayment) {
                const payDate = new Date(latestPayment.created_at || latestPayment.data_pagamento || latestPayment.data_confirmacao);
                const diffTime = now.getTime() - payDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 30 && diffDays >= 0) {
                    permissions.base = true; permissions.ai = true; permissions.personal = true;
                    return { status: 'active', blocked: false, daysLeft: 30 - diffDays, permissions, healed: true };
                }
            }
        }

        // 5. TRIAL ACCESS (3 Days for New Users)
        if (user.trial_started_at && !user.trial_used) {
            const startDate = new Date(user.trial_started_at);
            const trialEnd = new Date(startDate.getTime() + (3 * 24 * 60 * 60 * 1000));
            if (trialEnd > now) {
                return { status: 'trial', blocked: false, daysLeft: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)), permissions: { ai: true, personal: true, base: true } };
            }
        }

        // 6. PLATFORM FEE (GRACE PERIOD)
        if (expiryStr && user.plano_ativo !== false) {
            const dueDate = new Date(expiryStr);
            if (dueDate <= now) {
                const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                const graceDays = user.dias_tolerancia || 2;
                if (diffDays <= graceDays && diffDays >= 0) {
                    permissions.base = true; permissions.ai = true; permissions.personal = true;
                    return { status: 'grace_period', blocked: false, warning: true, daysOverdue: diffDays, daysLeft: Math.max(0, (graceDays + 1) - diffDays), permissions };
                }
            }
        }

        return { status: 'blocked', blocked: true, daysLeft: 0, permissions };
    },

    getPersonalLimitInfo: (personalId) => {
        const personal = (typeof db !== 'undefined') ? db.getById('personals', personalId) : null;
        if (!personal) return { maxStudents: 0, currentStudents: 0, plan_name: 'Grátis' };

        // If it's a legacy plan_id in the personal profile
        const plan = personal.plan_id ? db.getById('plans', personal.plan_id) : null;
        const activeStudents = db.query('profiles', s => s.assigned_personal_id === personalId && s.status === 'active').length;

        return {
            maxStudents: plan ? (plan.max_students || 0) : 0,
            currentStudents: activeStudents,
            plan_name: plan ? plan.name : 'Grátis'
        };
    },

    checkActionLimit: (userId, action) => {
        const user = db.getById('profiles', userId) || db.getById('personals', userId) || db.getById('admins', userId);
        if (!user) return { allowed: false, message: 'Usuário não identificado.' };

        // Admins and elite personals have no bounds
        if (user.role === 'admin' || user.type === 'admin') return { allowed: true };

        if (action === 'register_student') {
            const limit = window.PaymentHelper.getPersonalLimitInfo(userId);
            // Free tier check if no plan_id
            if (!user.plan_id) {
                // If they have 1 or more active students and no plan, they hit the free limit
                if (limit.currentStudents >= 1) {
                    return {
                        allowed: false,
                        message: 'O plano gratuito permite apenas 1 aluno ativo. Faça um upgrade para gerenciar mais alunos.'
                    };
                }
            } else if (limit.maxStudents > 0 && limit.currentStudents >= limit.maxStudents) {
                return {
                    allowed: false,
                    message: `Você atingiu o limite de ${limit.maxStudents} alunos do seu plano ${limit.plan_name}.`
                };
            }
        }

        if (action === 'diet' || action === 'workout') {
            const access = window.PaymentHelper.checkStudentAccess(user);
            if (access.blocked) {
                return { allowed: false, message: 'Seu acesso expirou. Renove sua assinatura para continuar gerando conteúdos com IA.' };
            }
        }

        return { allowed: true };
    },


    /**
     * Guards premium features with granular permissions.
     * @param {String} actionName - Name of the action.
     * @param {Object} user - Current user.
     * @param {Function} callback - Success callback.
     * @param {String} type - 'ai', 'personal', or 'base'.
     */
    handlePremiumAction: (actionName, user, callback, type = 'base') => {
        // T-Feed is always free
        if (actionName.toLowerCase().includes('feed')) return callback();

        const access = PaymentHelper.checkStudentAccess(user);

        // Check if specific permission is granted
        if (access.permissions[type]) {
            return callback();
        }

        // If not granted, show appropriate modal
        const isTrialAvailable = !user.trial_used && !user.trial_started_at;

        let title = 'Assinatura Necessária 💎';
        let message = `Para usar ${actionName}, você precisa de um plano ativo.`;
        let btnLabel = 'Ver Planos';
        let btnAction = () => router.navigate('/payment/plans');

        if (type === 'ai') {
            title = 'Plano IA Requerido 🤖';
            message = `A ferramenta ${actionName} utiliza nossa Inteligência Artificial exclusiva e requer o plano <b>T-FIT IA Pros</b>.`;
        }

        if (access.status === 'blocked' && isTrialAvailable) {
            title = 'Período de Experiência 🎁';
            message = `Você ainda não ativou seu teste grátis! Deseja ativar agora <b>3 DIAS</b> de acesso TOTAL a todas as funções (IA + Personal)?`;
            btnLabel = '🚀 Ativar 3 Dias Grátis';
            btnAction = () => window.PaymentHelper.activateTrial(user.id, callback);
        }

        UI.showModal(title, `
            <div class="text-center p-lg">
                <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">${type === 'ai' ? '🤖' : '🔒'}</div>
                <h3 class="mb-md">${title}</h3>
                <p class="text-muted mb-xl">${message}</p>
                <div class="flex flex-col gap-sm">
                    <button class="btn btn-primary btn-block shadow-glow" id="premium-action-btn">
                        ${btnLabel}
                    </button>
                    <button class="btn btn-ghost btn-block" onclick="UI.closeModal()">Agora não</button>
                </div>
            </div>
        `);

        document.getElementById('premium-action-btn').onclick = () => {
            UI.closeModal();
            btnAction();
        };
    },

    /**
     * Activates the 3-day free trial.
     */
    activateTrial: async (userId, callback) => {
        UI.showLoading('Ativando seu presente...');
        try {
            const now = new Date().toISOString();

            // 1. Update Database
            await db.update('profiles', userId, {
                trial_started_at: now,
                status: 'active'
            });

            // 2. Proactive local update
            const user = auth.getCurrentUser();
            if (user && user.id === userId) {
                user.trial_started_at = now;
                user.status = 'active';
                auth.saveSession(user);
            }

            // 3. Refresh from server for final sync
            if (window.auth && auth.refreshUser) {
                await auth.refreshUser();
            }

            UI.hideLoading();
            UI.showNotification('Sucesso! 🎉', 'Seu acesso total de 3 dias foi ativado. Aproveite ao máximo!', 'success');

            if (callback) {
                setTimeout(() => callback(), 300);
            } else {
                router.navigate('/student/dashboard');
            }
        } catch (err) {
            UI.hideLoading();
            UI.showNotification('Erro', 'Não foi possível ativar seu teste.', 'error');
        }
    },

    /**
     * Compatibility helpers...
     */
    getTrialStatus: (user) => {
        const access = window.PaymentHelper.checkStudentAccess(user);
        return {
            status: access.status === 'trial' ? 'active' : 'inactive',
            daysLeft: access.daysLeft,
            isTrial: access.status === 'trial'
        };
    },

    getPaymentStatus: (user) => {
        const access = window.PaymentHelper.checkStudentAccess(user);
        if (access.status === 'active') return 'paid';
        if (access.status === 'trial') return 'trial';
        return 'unpaid';
    },

    hasAIAccess: (user) => {
        const access = window.PaymentHelper.checkStudentAccess(user);
        return access.permissions.ai;
    },

    /**
     * Approves a manual payment and grants access to the student.
     */
    approvePayment: async (paymentId) => {
        try {
            const payment = db.getById('payments', paymentId);
            if (!payment) throw new Error('Pagamento não encontrado');

            const plan = db.getById('plans', payment.plan_id);
            const duration = plan ? plan.duration_days : 30;

            // 1. Update Payment Status
            await db.update('payments', paymentId, {
                status: 'approved',
                processed_at: new Date().toISOString()
            });

            // 2. Update Student Profile
            await db.update('profiles', payment.user_id, {
                plan_id: payment.plan_id,
                plan_expiry: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
                status: 'active',
                trial_used: true
            });

            return { success: true };
        } catch (error) {
            console.error("Erro ao aprovar pagamento:", error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Rejects a manual payment.
     */
    rejectPayment: async (paymentId, reason) => {
        try {
            await db.update('payments', paymentId, {
                status: 'rejected',
                processed_at: new Date().toISOString()
            });

            // Optional: Create notification for student
            const payment = db.getById('payments', paymentId);
            if (payment) {
                await db.create('notifications', {
                    user_id: payment.user_id,
                    title: 'Pagamento Rejeitado ❌',
                    message: `Seu comprovante foi recusado: ${reason}. Por favor, envie novamente.`,
                    type: 'payment_rejected',
                    read: false
                });
            }

            return { success: true };
        } catch (error) {
            console.error("Erro ao rejeitar pagamento:", error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Increments usage count for AI features.
     * @param {String} userId - ID of the user.
     * @param {String} type - Type of usage ('workout' or 'diet').
     */
    incrementUsage: async (userId, type) => {
        try {
            // This is a placeholder for actual usage tracking logic.
            // In a real scenario, you might update a usage counter in the database.
            console.log(`[Usage] Incrementando uso de ${type} para o usuário: ${userId}`);

            // For now, we just ensure the function exists to prevent "is not a function" errors.
            // If you have a specific usage table, you can add db.create() or db.update() here.

            return { success: true };
        } catch (error) {
            console.error(`[Usage] Erro ao incrementar uso de ${type}:`, error);
            return { success: false };
        }
    },

    /**
     * Calculates the next due date based on the billing cycle.
     * @param {String} cycle - 'Mensal', 'Trimestral', 'Semestral' or 'Anual'
     * @returns {String} ISO Date String
     */
    calculateNextDueDate: (cycle) => {
        const now = new Date();
        switch (cycle) {
            case 'Anual':
                now.setFullYear(now.getFullYear() + 1);
                break;
            case 'Semestral':
                now.setMonth(now.getMonth() + 6);
                break;
            case 'Trimestral':
                now.setMonth(now.getMonth() + 3);
                break;
            default: // Mensal
                now.setMonth(now.getMonth() + 1);
        }
        return now.toISOString();
    }
};

/**
 * Global function to start Mercado Pago recurring checkout (Subscription).
 */
window.startMercadoPagoSubscription = async (planId, receiverId) => {
    const user = auth.getCurrentUser();
    if (!user) return UI.showNotification('Erro', 'Você precisa estar logado para assinar.', 'error');

    UI.showLoading('Iniciando plano de assinatura...');

    try {
        const { data, error } = await window.supabase.functions.invoke('mp-webhook', {
            method: 'POST',
            body: {
                action: 'create_subscription',
                plan_id: planId,
                user_id: user.id,
                payer_email: user.email,
                personal_owner_id: receiverId || null,
                origin: window.location.origin
            }
        });

        UI.hideLoading();

        if (error) throw error;
        if (data && data.init_point) {
            window.location.href = data.init_point;
        } else {
            throw new Error(data?.error || 'Não foi possível gerar o link de assinatura.');
        }

    } catch (err) {
        UI.hideLoading();
        console.error("Erro ao iniciar assinatura:", err);
        UI.showNotification('Erro', err.message, 'error');
    }
};

/**
 * Common function to cancel an active subscription.
 */
window.cancelSubscription = async (subscriptionId, receiverId) => {
    UI.confirmDialog('Cancelar Assinatura', 'Deseja mesmo cancelar sua assinatura ativa? Você manterá o acesso até o fim do período atual.', async () => {
        UI.showLoading('Cancelando...');
        try {
            const { data, error } = await window.supabase.functions.invoke('mp-webhook', {
                method: 'POST',
                body: {
                    action: 'cancel_subscription',
                    subscription_id: subscriptionId,
                    receiver_id: receiverId
                }
            });

            UI.hideLoading();
            if (error) throw error;

            UI.showNotification('Sucesso', 'Sua assinatura foi cancelada. Ela não será renovada no próximo mês.', 'success');

            // Update local DB
            const sub = db.query('subscriptions', s => s.mp_subscription_id === subscriptionId)[0];
            if (sub) {
                await db.update('subscriptions', sub.id, {
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                });
            }

            router.refresh();
        } catch (err) {
            UI.hideLoading();
            UI.showNotification('Erro', 'Não foi possível cancelar: ' + err.message, 'error');
        }
    });
};

/**
 * Global function to start Mercado Pago checkout.
 * Updated to use recurring if it is a subscription plan.
 */
window.startMercadoPagoCheckout = async (amount, planId, receiverId, refType = 'single') => {
    const user = auth.getCurrentUser();
    if (!user) return UI.showNotification('Erro', 'Você precisa estar logado para assinar.', 'error');

    UI.showLoading('Iniciando checkout...');
    console.log(`[MP Checkout] Iniciando para Plano ID: ${planId}, Personal: ${receiverId}, Valor: ${amount}, Tipo: ${refType}`);

    try {
        const { data, error } = await window.supabase.functions.invoke('mp-webhook', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: {
                action: 'create_preference',
                plan_id: planId,
                user_id: user.id,
                personal_owner_id: receiverId || null,
                ref_type: refType,
                origin: window.location.origin.replace(/\/$/, '')
            }
        });

        UI.hideLoading();

        if (error) {
            console.error("[MP Checkout Sync Error]", error);
            let body = {};
            try {
                if (error.context && typeof error.context.json === 'function') {
                    body = await error.context.json();
                } else if (error.context && typeof error.context === 'object') {
                    body = error.context;
                }
            } catch (e) { }
            throw new Error(body?.error || error.message || 'Erro ao conectar com servidor de pagamento');
        }

        // --- SAFETY PARSE ---
        // If data arrives as a string, parse it.
        if (typeof data === 'string') {
            try {
                console.log("[MP Checkout] Auto-parsing response string...");
                data = JSON.parse(data);
            } catch (e) {
                console.error("[MP Checkout] Fail to parse response string:", data);
            }
        }

        if (data && (data.error || data.success === false)) {
            console.error("[MP Server Error]", data.error);
            throw new Error(data.error || 'O Mercado Pago não pôde gerar o link no momento.');
        }

        if (data && data.init_point) {
            // Priority 1: Direct link (init_point)
            window.location.href = data.init_point;
        } else if (data && data.preferenceId) {
            // Priority 2: Preference ID (Redirect to MP)
            const mpCheckoutUrl = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${data.preferenceId}`;
            window.location.href = mpCheckoutUrl;
        } else {
            console.error("[MP Data Mismatch] O servidor retornou dados incompletos:", data);
            const serverMsg = data?.error || (data ? JSON.stringify(data) : 'Nenhum dado retornado');
            throw new Error(`O servidor de pagamento não retornou um link válido. Detalhes: ${serverMsg}`);
        }

    } catch (err) {
        UI.hideLoading();
        console.error("Erro Final MP Checkout:", err);

        let errorTitle = 'Erro no Checkout 💳';
        let errorMessage = err.message || 'Não foi possível iniciar o pagamento via Mercado Pago.';

        // Detailed guidance for encryption errors
        if (errorMessage.includes('ENCRYPTION_KEY') || errorMessage.includes('descriptografar')) {
            errorTitle = 'Configuração Pendente ⚙️';
            errorMessage = `O vendedor (Personal/Admin) precisa atualizar as credenciais do Mercado Pago para este plano. <br><br><small>Dica para o Personal: Vá em Painel > Configurações e re-insira seu Access Token.</small>`;
        }

        UI.showNotification(errorTitle, errorMessage, 'error');
    }
};

/**
 * Global function to show Checkout Selector (Mercado Pago vs Pix Manual).
 */
window.startCheckout = async (amount, plan_name, planId, receiverId, refType = 'single') => {
    // Redireciona diretamente para o checkout oficial do Mercado Pago
    console.log(`[Checkout] Iniciando pagamento direto: ${plan_name}`);
    return window.startMercadoPagoCheckout(amount, planId, receiverId, refType);
};

/**
 * Global function to start Direct Pix checkout without external redirection.
 */
window.startPixDirectCheckout = async (amount, planId, receiverId, refType = 'single') => {
    const user = auth.getCurrentUser();
    if (!user) return UI.showNotification('Erro', 'Você precisa estar logado.', 'error');

    UI.showLoading('Gerando QR Code Pix...');
    try {
        const { data, error } = await window.supabase.functions.invoke('mp-webhook', {
            body: {
                action: 'create_pix',
                plan_id: planId,
                user_id: user.id,
                personal_owner_id: receiverId,
                ref_type: refType,
                payer_email: user.email
            }
        });

        UI.hideLoading();
        if (error || !data || !data.success) throw new Error(data?.error || 'Erro ao gerar Pix do Mercado Pago');

        window.showPixPaymentModal(data.qr_code, data.qr_code_base64, amount);
    } catch (e) {
        UI.hideLoading();
        console.error("[Pix Direct] Error:", e);
        UI.showNotification('Erro', e.message, 'error');
        // Fallback to standard checkout if direct pix fails
        UI.confirmDialog('Aviso', 'Não foi possível gerar o QR Code direto agora. Deseja usar o link padrão do Mercado Pago?', () => {
            window.startMercadoPagoCheckout(amount, planId, receiverId, refType);
        });
    }
};

/**
 * Modal to show the generated Pix QR Code
 */
window.showPixPaymentModal = (qrCode, qrCodeBase64, amount) => {
    const modalContent = `
        <div class="p-md text-center">
            <h3 class="font-bold text-xl mb-sm">Pagamento via Pix</h3>
            <p class="text-sm text-muted mb-lg">Escaneie o código abaixo no seu banco para pagar instantaneamente.</p>
            
            <div class="flex justify-center mb-lg bg-white p-md rounded-xl shadow-lg" style="width: 210px; margin: 0 auto; border: 4px solid #fff;">
                <img src="data:image/png;base64,${qrCodeBase64}" style="width: 100%; image-rendering: pixelated;">
            </div>

            <div class="card bg-black bg-opacity-30 p-md mb-lg border border-white border-opacity-10">
                <div class="text-[10px] text-muted mb-xs uppercase font-bold tracking-widest">Código Pix (Copia e Cola)</div>
                <div class="flex gap-sm items-center">
                    <input type="text" readonly value="${qrCode}" class="form-input text-[10px] font-mono" 
                           style="background: transparent; border: none; padding: 0;" id="pix-copy-input">
                    <button class="btn btn-xs btn-primary px-lg" onclick="UI.copyToClipboard('${qrCode}')">COPIAR</button>
                </div>
            </div>

            <div class="flex flex-col gap-sm">
                <div class="p-md rounded-xl border border-dashed border-primary bg-primary bg-opacity-5 animate-pulse">
                    <div class="text-primary font-bold text-sm">
                        <i class="fas fa-spinner fa-spin mr-sm"></i> 
                        Aguardando sinal do mercado pago...
                    </div>
                </div>
                
                <button class="btn btn-ghost btn-sm opacity-60 mt-sm" onclick="location.reload()">
                    <i class="fas fa-sync-alt mr-xs"></i> Já paguei, verificar acesso
                </button>
            </div>
            
            <p class="text-[9px] text-muted mt-lg uppercase tracking-wider opacity-50">O acesso será liberado em segundos após o pagamento.</p>
        </div>
    `;

    UI.showModal('Pix Instantâneo', modalContent);

    // Initial user state for comparison
    const initialUser = { ...auth.getCurrentUser() };

    // Polling as a robust backup to Realtime (which is handled by app.js)
    const checkInterval = setInterval(async () => {
        try {
            await auth.refreshUser(); // Fetch fresh data from DB
            const currentUser = auth.getCurrentUser();

            // Debug check for developer
            console.log(`[Polling] Checking status for ${currentUser.id}. Plan: ${currentUser.plan_id}, Expiry: ${currentUser.plan_expiry}`);

            // Check if plan_id changed or data_vencimento moved forward
            // We compare against initialUser which was captured when modal opened
            if (currentUser.plan_id !== initialUser.plan_id ||
                currentUser.plan_expiry !== initialUser.plan_expiry ||
                currentUser.data_vencimento !== initialUser.data_vencimento) {

                clearInterval(checkInterval);
                UI.closeModal();
                UI.showNotification('Sucesso!', 'Pagamento identificado! Seu acesso foi liberado. 🎉', 'success');

                // Navigate to success or reload
                setTimeout(() => {
                    if (currentUser.role === 'student') router.navigate('/student/dashboard');
                    else router.navigate('/personal/dashboard');
                    location.reload(); // Hard reload ensures all caches are clean
                }, 1500);
            }
        } catch (e) {
            console.warn("[Polling Error] Will retry...", e);
        }
    }, 5000); // 5 seconds interval is safer for the server and enough for UX

    // Store interval to clear it if user closes modal or navigates
    window._pixPollingInterval = checkInterval;
};



/**
 * Saves Mercado Pago credentials for a Personal Trainer or Admin.
 */
window.savePaymentConfig = async (configData) => {
    const user = auth.getCurrentUser();

    UI.showLoading('Salvando configurações...');

    try {
        const { data, error } = await window.supabase.functions.invoke('mp-webhook', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: {
                action: 'save_config',
                user_id: user.id,
                access_token: configData.access_token || configData.accessToken,
                public_key: configData.public_key || configData.publicKey,
                webhook_secret: configData.webhook_secret || configData.webhookSecret || ''
            }
        });

        UI.hideLoading();

        if (error) {
            console.group("[DEBUG MP] Falha na Resposta do Servidor");
            console.error("Status:", error.status);
            console.error("Erro Objeto:", error);

            let msg = `Erro no Servidor (${error.status || '?'})`;
            // Tentar extrair mensagem do corpo do erro
            try {
                let errorBody = null;
                if (error.context && typeof error.context.json === 'function') {
                    errorBody = await error.context.json();
                } else if (error.context && typeof error.context === 'object') {
                    errorBody = error.context;
                }
                console.error("Corpo do Erro (JSON):", errorBody);
                if (errorBody?.error) msg = `Erro: ${errorBody.error}`;
                else if (errorBody?.message) msg = `Erro: ${errorBody.message}`;
            } catch (e) {
                console.warn("Não foi possível ler o corpo do erro ou não é JSON");
            }
            console.groupEnd();

            if (error.status === 401) msg = "Erro de Autenticação (JWT). Tente deslogar e logar novamente.";
            if (error.status === 404) msg = "Função não encontrada. Verifique se o deploy foi feito.";

            throw new Error(msg);
        }

        if (!data || !data.success) throw new Error(data?.error || 'Erro desconhecido na resposta da função');

        UI.showNotification('Sucesso', 'Configurações de pagamento salvas e validadas!', 'success');
        return true;

    } catch (err) {
        UI.hideLoading();
        console.error("Erro ao salvar config:", err);
        UI.showNotification('Erro na Configuração', err.message || 'Credenciais inválidas ou erro de rede.', 'error');
        return false;
    }
};

/**
 * Tests connection with Mercado Pago using saved credentials or a manual token.
 */
window.testMPConnection = async (userId, manualToken = null) => {
    UI.showLoading(manualToken ? 'Validando token...' : 'Testando conexão...');
    try {
        const body = { action: 'test_connection', user_id: userId };
        if (manualToken) body.access_token = manualToken;

        const { data, error } = await window.supabase.functions.invoke('mp-webhook', {
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: body
        });

        UI.hideLoading();

        if (error) {
            console.error("[MP Test Error] Supabase Error:", error);
            let msg = error.message || 'Falha na comunicação com o servidor';

            // Try to extract body if available in error context
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const errorBody = await error.context.json();
                    if (errorBody.error) msg = errorBody.error;
                }
            } catch (e) { }

            throw new Error(msg);
        }

        if (data && data.success) {
            UI.showNotification('Conectado! ✅', 'Suas chaves do Mercado Pago estão ativas e funcionando.', 'success');
            return true;
        } else {
            throw new Error(data?.error || 'Erro desconhecido na validação. Verifique se as chaves estão corretas.');
        }
    } catch (err) {
        UI.hideLoading();
        console.error("Erro ao testar MP:", err);
        UI.showNotification('Erro de Conexão', err.message || 'Não foi possível validar as chaves.', 'error');
        return false;
    }
};

/**
 * Loads (safe portion of) payment configuration.
 */
window.loadPaymentConfig = async (userId) => {
    try {
        const { data, error } = await window.supabase
            .from('payment_configs')
            .select('public_key, status_config')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
        return data || null;

    } catch (err) {
        console.error("Erro ao carregar config:", err);
        return null;
    }
};

// --- GLOBAL WINDOW HELPERS FOR PAYMENTS ---



window.viewReceipt = (term) => {
    let url = term;
    if (!term.startsWith('data:') && !term.startsWith('http')) {
        const payment = db.getById('payments', term);
        if (!payment) {
            UI.showNotification('Erro', 'Pagamento não encontrado.', 'error');
            return;
        }

        if (payment.proof_url || payment.proofData) {
            url = payment.proof_url || payment.proofData;
            UI.showReceipt(url);
        } else if (payment.status === 'confirmed' || payment.method === 'mercadopago' || payment.method === 'automated') {
            // No physical proof but payment is confirmed/automated - show digital receipt
            const plan = payment.plan_id ? db.getById('plans', payment.plan_id) : null;
            const digitalReceipt = `
                <div class="receipt-card bg-white p-0 rounded-xl overflow-hidden shadow-2xl" 
                     style="color: #333; font-family: 'Inter', sans-serif; max-width: 450px; margin: 0 auto; border: 1px solid #e5e7eb; text-align: left;">
                    
                    <div class="bg-[#009EE3] p-lg text-center relative overflow-hidden">
                        <div class="mx-auto bg-white rounded-full flex items-center justify-center text-[#009EE3]" style="width: 56px; height: 56px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                            <i class="fas fa-check text-2xl"></i>
                        </div>
                        <h2 class="text-white font-bold text-lg mt-md mb-0">Pagamento Confirmado</h2>
                        <p class="text-white/80 text-[11px] font-medium">Processado via T-FIT Pay</p>
                    </div>

                    <div class="p-lg">
                        <div class="text-center mb-xl">
                            <p class="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-xs">Valor Total</p>
                            <h1 class="text-4xl font-black text-[#333] tracking-tighter">R$ ${(parseFloat(payment.amount) || 0).toFixed(2).replace('.', ',')}</h1>
                        </div>

                        <div class="space-y-md mb-xl">
                            <div class="flex justify-between items-start gap-md border-b border-gray-100 pb-sm">
                                <span class="text-muted-foreground text-[11px] font-bold uppercase pt-1">Descrição</span>
                                <span class="text-[#333] text-sm font-bold text-right">${payment.description || plan?.name || 'Assinatura T-FIT'}</span>
                            </div>
                            
                            <div class="flex justify-between items-center border-b border-gray-100 pb-sm">
                                <span class="text-muted-foreground text-[11px] font-bold uppercase">Data</span>
                                <span class="text-[#555] text-sm font-medium">${new Date(payment.updated_at || payment.date || payment.created_at).toLocaleString('pt-BR')}</span>
                            </div>

                            <div class="flex justify-between items-center border-b border-gray-100 pb-sm">
                                <span class="text-muted-foreground text-[11px] font-bold uppercase">Método</span>
                                <span class="text-[#555] text-sm font-medium uppercase">${(payment.method || 'MERCADO PAGO').toUpperCase()}</span>
                            </div>

                            <div class="flex justify-between items-center pb-sm">
                                <span class="text-muted-foreground text-[11px] font-bold uppercase">Transação</span>
                                <span class="text-[#888] text-[10px] font-mono">${(payment.mp_payment_id || payment.id).substring(0, 16)}</span>
                            </div>
                        </div>

                        <div class="mt-xl flex flex-col items-center">
                            <div class="bg-[#e6f7ef] text-[#00a650] px-lg py-sm rounded-full text-xs font-bold uppercase border border-[#00a650]/20">
                                 Operação Concluída
                            </div>
                            <p class="text-[10px] text-muted-foreground mt-md text-center">Este comprovante digital tem validade legal dentro da plataforma T-FIT.</p>
                        </div>

                        <div class="mt-lg no-print">
                            <button class="btn btn-outline btn-block gap-sm border-gray-200 text-gray-700" onclick="window.print()">
                                <i class="fas fa-print"></i> Imprimir Comprovante
                            </button>
                        </div>
                    </div>
                </div>
            `;
            UI.showModal('Recibo de Pagamento', digitalReceipt);
        } else {
            UI.showNotification('Erro', 'Comprovante não disponível ainda.', 'info');
        }
    } else {
        UI.showReceipt(url);
    }
};
