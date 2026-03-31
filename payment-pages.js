
// ============================================
// PAYMENT & ACCESS CONTROL PAGES
// ============================================

// 1. Blocked Subscription State
router.addRoute('/payment/blocked', () => {
    const user = auth.getCurrentUser();
    if (!user) return router.navigate('/');

    const checkPlan = user.role === 'admin' ? 'plano_adm' : 'plano_personal';
    // Em Produção, você extrai o preço e plano correto de db.getAll('plans') mapeando p/ role

    const content = `
        <div class="page flex items-center justify-center p-lg" style="background: var(--bg-body); min-height: 100vh;">
            <div class="card p-xl text-center shadow-lg w-full max-w-md" style="border-top: 5px solid var(--danger);">
                <div class="mb-lg">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🔒</div>
                    <h1 class="text-2xl font-bold mb-md text-danger">Acesso Bloqueado</h1>
                    <p class="text-muted">
                        Identificamos pendências no pagamento da sua assinatura T-FIT.<br><br>
                        Para continuar usando a plataforma e garantir que seus alunos não percam o acesso, por favor, regularize sua situação.
                    </p>
                </div>
                
                <button class="btn btn-primary btn-block btn-lg mb-md py-md font-bold" style="font-size: 1.1rem; filter: saturate(1.2)" 
                        onclick="window.startCheckout(49.90, 'Cobrança Mensal - T-FIT Profissional', '${checkPlan}', null, 'mensalidade_tfit')">
                    💰 REGULARIZAR E LIBERAR ACESSO
                </button>

                <p class="text-xs text-muted">Acesso é restaurado automaticamente após a confirmação do pagamento via Mercado Pago.</p>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = content;
});

// 2. Plan Selection (Blocked State for Students/General)
router.addRoute('/payment/plans', () => {
    const user = auth.getCurrentUser();
    if (!user) return router.navigate('/');

    const filter = router.currentParams.filter;

    // 1. Buscar Planos Administrativos (IA e outros)
    const adminPlans = db.getAll('plans').filter(p => {
        const creator = p.created_by ? db.getById('profiles', p.created_by) : null;
        const isAdminPlan = (!p.created_by || (creator && creator.role === 'admin'));
        const targetMatch = (p.target_audience === 'student' || p.target_audience === 'student_ai');

        if (user.role === 'student') {
            if (filter === 'ai') {
                return isAdminPlan && (p.name.toLowerCase().includes('ia') || p.id === 'plano_ia_estudante' || p.target_audience === 'student_ai');
            }
            return isAdminPlan && targetMatch && p.active !== false;
        } else {
            // Personal/Admin vê planos voltados para personal
            return isAdminPlan && p.target_audience === 'personal' && p.active !== false;
        }
    });


    const content = `
        <div class="page p-lg" style="background: var(--bg-body); min-height: 100vh;">
            <div class="container" style="max-width: 1000px;">
                <div class="text-center mb-xl">
                    <h1 class="page-title mb-sm">${filter === 'ai' ? 'Planos T-FIT IA 🤖' : 'Escolha seu Plano 💎'}</h1>
                    <p class="text-muted">Acesso completo às melhores ferramentas de treino e nutrição.</p>
                </div>

                <!-- Seção de Planos Administrativos (T-FIT IA / Oficiais) -->
                <div class="grid grid-2 gap-lg mb-2xl">
                    ${adminPlans.map(plan => `
                        <div class="card p-lg flex flex-col hover:border-primary transition-all cursor-pointer relative" 
                             onclick="window.selectPaymentPlan('${plan.id}')"
                             style="border: 1px solid ${plan.target_audience === 'student_ai' ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; background: ${plan.target_audience === 'student_ai' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)'}; border-radius: 16px;">
                            ${plan.target_audience === 'student_ai' ? '<span class="badge badge-primary" style="position: absolute; top: -10px; left: 20px; font-size: 10px;">RECOMENDADO T-FIT IA</span>' : ''}
                            <div class="text-center mb-md">
                                <h3 class="card-title">${plan.name}</h3>
                                <div class="stat-value text-primary mt-sm" style="font-size: 2.5rem; font-weight: 900; letter-spacing: -1px;">
                                    R$ ${parseFloat(plan.price || 0).toFixed(2).replace('.', ',')}
                                </div>
                                <div class="text-muted text-xs uppercase tracking-widest font-bold">${plan.billing_cycle || 'Mensal'}</div>
                            </div>
                            <ul class="text-sm text-left mb-xl" style="flex: 1; list-style: none; padding: 0;">
                                ${(plan.features || ['Treinos Ilimitados', 'IA T-FIT Integrada']).map(f => `<li class="mb-sm flex items-start gap-sm">
                                    <span style="color: var(--primary); font-weight: bold;">✓</span> 
                                    <span>${f}</span>
                                </li>`).join('')}
                            </ul>
                            <div class="text-center">
                                <button class="btn btn-primary btn-block py-md" style="font-weight: 800; border-radius: 10px;">
                                    ATIVAR ACESSO
                                </button>
                                <p class="text-xs text-muted mt-sm">Liberação imediata via Mercado Pago ou Pix.</p>
                            </div>
                        </div>
                    `).join('')}
                    ${adminPlans.length === 0 ? '<p class="text-center p-xl opacity-50 col-span-2">Nenhum plano administrativo disponível.</p>' : ''}
                </div>
                


                <div class="text-center mt-2xl">
                    <p class="text-muted text-xs">Precisa de ajuda com sua assinatura? <a href="#" onclick="window.WhatsApp.sendMessage('5511911917087', 'Preciso de ajuda com desbloqueio')">Fale com o Suporte</a></p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('app').innerHTML = content;



    window.selectPaymentPlan = (planId) => {
        const plan = db.getById('plans', planId);
        if (!plan) return;

        UI.confirmDialog('Confirmar Assinatura',
            `Você iniciará sua assinatura do plano ${plan.name}.
            Acesso ilimitado e imediato! Valor: R$ ${parseFloat(plan.price || 0).toFixed(2).replace('.', ',')}
            Deseja continuar com o pagamento?`,
            () => {
                const refType = 'mensalidade_tfit';
                window.startCheckout(plan.price, plan.name, plan.id, null, refType);
            }
        );
    };
});

// ============================================
// AUTOMATIC PAYMENT CHECK
// ============================================
// 3. Payment Success Redirection Page
router.addRoute('/payment/success', () => {
    const user = auth.getCurrentUser();
    if (!user) return router.navigate('/');

    const dashboardPath = user.type === 'personal' ? '/personal/dashboard' : '/student/dashboard';
    const welcomeMsg = user.type === 'personal' ? 'Parabéns pela sua assinatura!' : 'Pagamento realizado com sucesso!';

    const content = `
        <div class="page flex items-center justify-center p-lg" style="background: var(--bg-body); min-height: 100vh;">
            <div class="card p-xl text-center shadow-lg" style="max-width: 500px; width: 100%; border-top: 5px solid var(--success);">
                <div class="mb-lg">
                    <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 2s infinite;">✅</div>
                    <h1 class="text-2xl font-bold mb-md">${welcomeMsg}</h1>
                    <p class="text-muted mb-xl">
                        Sua transação foi processada pelo Mercado Pago. 
                        Em instantes seu acesso será totalmente liberado pelo sistema ou pelo seu personal.
                    </p>
                </div>

                <div class="p-md bg-light rounded mb-xl" style="border: 1px solid var(--border);">
                    <p class="text-sm font-weight-600 mb-0">
                        O que acontece agora?
                    </p>
                    <p class="text-xs text-muted mt-sm">
                        Se você usou Cartão ou Pix, a liberação costuma ser instantânea. 
                        Se usou Boleto, pode levar até 2 dias úteis.
                    </p>
                </div>

                <button class="btn btn-primary btn-block btn-lg" onclick="router.navigate('${dashboardPath}')">
                    Ir para o meu Dashboard ➔
                </button>

                <p class="text-xs text-muted mt-lg">
                    Dúvidas? <a href="#" onclick="window.WhatsApp.sendMessage('5511911917087', 'Tenho uma dúvida sobre meu pagamento recente')">Fale com o Suporte</a>
                </p>
            </div>
        </div>
    `;

    document.getElementById('app').innerHTML = content;
});
