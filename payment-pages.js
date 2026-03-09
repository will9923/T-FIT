
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

    // 2. Buscar Personals (apenas se for aluno)
    let rankedPersonals = [];
    let top5 = [];
    if (user.role === 'student') {
        const personals = db.getAll('profiles').filter(p => p.role === 'personal' && p.status === 'active');
        const students = db.getAll('profiles').filter(p => p.role === 'student');

        rankedPersonals = personals.map(p => {
            const studentCount = students.filter(s => s.assigned_personal_id === p.id).length;
            return { ...p, studentCount };
        }).sort((a, b) => b.studentCount - a.studentCount);

        top5 = rankedPersonals.slice(0, 5);
    }

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
                
                ${user.role === 'student' && filter !== 'ai' ? `
                    <!-- Busca de Personal -->
                    <div class="mt-2xl border-t pt-2xl" style="border-color: rgba(255,255,255,0.1);">
                        <h2 class="section-title text-center mb-lg">Contrate um Personal Trainer</h2>
                        
                        <div class="mb-xl">
                            <div class="form-group max-w-md mx-auto relative">
                                <input type="text" class="form-input" id="search-personal-plans" placeholder="🔍 Pesquisar personal por nome..." 
                                       oninput="window.filterPersonalsInPlans(this.value)" style="padding-left: 3rem; background: rgba(255,255,255,0.05); border-radius: 12px; height: 50px;">
                                <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem;">🔍</span>
                            </div>
                        </div>

                        <!-- Top 5 Personals -->
                        <h3 class="text-md font-bold mb-md">🔥 TOP 5 Profissionais</h3>
                        <div class="grid grid-5 gap-md mb-2xl" id="top5-personals-plans">
                            ${top5.map((p, idx) => `
                                <div class="card p-md text-center hover:shadow-lg transition-all" style="border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.01); position: relative;">
                                    <div style="position: absolute; top: 0; left: 0; background: var(--primary); color: white; font-size: 10px; padding: 2px 8px; border-bottom-right-radius: 8px; font-weight: bold;">#${idx + 1}</div>
                                    <div class="sidebar-avatar mx-auto mb-md" style="width: 50px; height: 50px; font-size: 1rem; background: var(--bg-hover); overflow: hidden; border: 2px solid rgba(255,255,255,0.1);">
                                        ${p.photo_url ? `<img src="${p.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : p.name.charAt(0)}
                                    </div>
                                    <h4 class="mb-xs text-xs" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                                    <button class="btn btn-outline btn-block btn-xs mt-sm" onclick="window.viewPersonalPlansFromPlans('${p.id}')" style="font-size: 10px;">
                                        Ver Planos
                                    </button>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Lista de Todos/Filtrados -->
                        <h3 class="text-md font-bold mb-md" id="all-personals-title">Todos os Profissionais</h3>
                        <div class="grid grid-4 gap-md" id="personals-grid-plans">
                            ${rankedPersonals.map(p => `
                                <div class="card p-lg text-center hover:shadow-lg transition-all" style="border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.01);">
                                    <div class="sidebar-avatar mx-auto mb-md" style="width: 65px; height: 65px; font-size: 1.5rem; background: var(--bg-hover); overflow: hidden; border: 2px solid rgba(255,255,255,0.1);">
                                        ${p.photo_url ? `<img src="${p.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : p.name.charAt(0)}
                                    </div>
                                    <h4 class="mb-xs text-sm">${p.name}</h4>
                                    <div class="text-muted text-xs mb-md">⭐ 5.0 • ${p.studentCount} alunos</div>
                                    <button class="btn btn-outline btn-block btn-xs" onclick="window.viewPersonalPlansFromPlans('${p.id}')">
                                        Ver Planos
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="text-center mt-2xl">
                    <p class="text-muted text-xs">Precisa de ajuda com sua assinatura? <a href="#" onclick="window.WhatsApp.sendMessage('5511911917087', 'Preciso de ajuda com desbloqueio')">Fale com o Suporte</a></p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('app').innerHTML = content;

    // Helper Functions for this page
    window.filterPersonalsInPlans = (query) => {
        const container = document.getElementById('personals-grid-plans');
        const title = document.getElementById('all-personals-title');
        const top5 = document.getElementById('top5-personals-plans');

        if (!query) {
            title.innerText = "Todos os Profissionais";
            if (top5) top5.parentElement.style.display = 'block';
            container.innerHTML = rankedPersonals.map(p => `
                <div class="card p-lg text-center hover:shadow-lg transition-all" style="border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.01);">
                    <div class="sidebar-avatar mx-auto mb-md" style="width: 65px; height: 65px; font-size: 1.5rem; background: var(--bg-hover); overflow: hidden; border: 2px solid rgba(255,255,255,0.1);">
                        ${p.photo_url ? `<img src="${p.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : p.name.charAt(0)}
                    </div>
                    <h4 class="mb-xs text-sm">${p.name}</h4>
                    <div class="text-muted text-xs mb-md">⭐ 5.0 • ${p.studentCount} alunos</div>
                    <button class="btn btn-outline btn-block btn-xs" onclick="window.viewPersonalPlansFromPlans('${p.id}')">
                        Ver Planos
                    </button>
                </div>
            `).join('');
            return;
        }

        title.innerText = "Resultados da Busca";
        if (top5) top5.parentElement.style.display = 'none';

        const filtered = rankedPersonals.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

        container.innerHTML = filtered.map(p => `
            <div class="card p-lg text-center hover:shadow-lg transition-all" style="border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.01);">
                <div class="sidebar-avatar mx-auto mb-md" style="width: 65px; height: 65px; font-size: 1.5rem; background: var(--bg-hover); overflow: hidden; border: 2px solid rgba(255,255,255,0.1);">
                    ${p.photo_url ? `<img src="${p.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : p.name.charAt(0)}
                </div>
                <h4 class="mb-xs text-sm">${p.name}</h4>
                <div class="text-muted text-xs mb-md">⭐ 5.0 • ${p.studentCount} alunos</div>
                <button class="btn btn-outline btn-block btn-xs" onclick="window.viewPersonalPlansFromPlans('${p.id}')">
                    Ver Planos
                </button>
            </div>
        `).join('');

        if (filtered.length === 0) {
            container.innerHTML = '<p class="col-span-4 text-center py-xl opacity-50">Nenhum profissional encontrado.</p>';
        }
    };

    window.viewPersonalPlansFromPlans = (id) => {
        const personal = db.getById('profiles', id);
        if (!personal) return;
        const pPlans = db.query('plans', p => p.created_by === id && p.target_audience === 'student' && p.active !== false);

        const modalContent = `
            <div class="p-md">
                <div class="flex items-center gap-md mb-lg">
                    <div class="sidebar-avatar" style="width: 50px; height: 50px; font-size: 1.2rem;">
                         ${personal.photo_url ? `<img src="${personal.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : personal.name.charAt(0)}
                    </div>
                    <div>
                        <h3 class="mb-0">Planos de ${personal.name}</h3>
                        <p class="text-xs text-muted mb-0">Escolha o plano ideal para seu objetivo</p>
                    </div>
                </div>
                <div class="flex flex-col gap-md">
                    ${pPlans.map(p => `
                        <div class="card p-md border-light hover:border-primary transition-all" style="border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                            <div class="flex justify-between items-center mb-sm">
                                <div>
                                    <h4 class="font-bold">${p.name}</h4>
                                    <span class="text-xs text-muted">${p.billing_cycle || 'Mensal'}</span>
                                </div>
                                <div class="text-lg font-bold text-primary">R$ ${parseFloat(p.price).toFixed(2).replace('.', ',')}</div>
                            </div>
                            <button class="btn btn-primary btn-block btn-sm mt-md" onclick="window.hirePersonalFromPlans('${personal.id}', '${p.id}', '${p.name}', ${p.price})">
                                Contratar Este Plano
                            </button>
                        </div>
                    `).join('')}
                    ${pPlans.length === 0 ? '<p class="text-center text-muted p-lg">Este personal não possui planos ativos no momento.</p>' : ''}
                </div>
            </div>
        `;
        UI.showModal('Planos do Personal', modalContent);
    };

    window.hirePersonalFromPlans = (personalId, planId, plan_name, price) => {
        UI.closeModal();
        window.startCheckout(price, `Contratação Personal - ${plan_name}`, planId, personalId);
    };

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
