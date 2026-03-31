
// ============================================
// STUDENT - PLAN
// ============================================

router.addRoute('/student/plan', () => {
    if (!auth.requireAuth('student')) return;

    const currentUser = auth.getCurrentUser();
    // Atualiza os dados do aluno do banco para pegar o plano mais recente
    const student = db.getById('students', currentUser.id);
    const plan = student.plan_id ? db.getById('plans', student.plan_id) : null;

    let content = `
        <div class="page-header">
            <h1 class="page-title">${plan ? 'Meu Plano Assinado 💎' : 'Assinatura & Planos'}</h1>
            <p class="page-subtitle">${plan ? 'Detalhes do seu plano T-FIT' : 'Escolha um plano para começar sua transformação'}</p>
        </div>
    `;

    if (plan) {
        // Calcular próxima data de pagamento (simulado a partir da data de criação do aluno ou data atual + ciclo)
        const startDate = new Date(student.created_at);
        let nextPayment = new Date(startDate);

        // Adicionar meses baseado no ciclo
        if (plan.billing_cycle === 'Mensal') nextPayment.setMonth(nextPayment.getMonth() + 1);
        else if (plan.billing_cycle === 'Trimestral') nextPayment.setMonth(nextPayment.getMonth() + 3);
        else if (plan.billing_cycle === 'Semestral') nextPayment.setMonth(nextPayment.getMonth() + 6);
        else if (plan.billing_cycle === 'Anual') nextPayment.setFullYear(nextPayment.getFullYear() + 1);

        // Se a data já passou, joga para o próximo ciclo a partir de agora
        if (nextPayment < new Date()) {
            nextPayment = new Date();
            nextPayment.setMonth(nextPayment.getMonth() + 1);
        }

        content += `
            <div class="card mb-xl" style="border-top: 5px solid var(--primary);">
                <div class="card-body text-center p-xl">
                    <h2 class="mb-md" style="color: var(--primary-light);">${plan.name}</h2>
                    <div class="stat-value" style="font-size: 3rem; margin-bottom: 2rem;">
                        R$ ${parseFloat(plan.price || 0).toFixed(2)} <span style="font-size: 1rem; color: var(--text-muted);">/${plan.billing_cycle}</span>
                    </div>
                    
                    <div class="grid grid-2 gap-lg mb-xl text-left" style="max-width: 600px; margin: 0 auto;">
                        <div>
                            <div class="text-muted mb-xs">Status</div>
                            <span class="badge badge-success">Ativo</span>
                        </div>
                        <div>
                            <div class="text-muted mb-xs">Próximo Pagamento</div>
                            <strong>${nextPayment.toLocaleDateString('pt-BR')}</strong>
                        </div>
                    </div>

                    <div class="divider mb-lg" style="border-top: 1px solid var(--border); margin: 2rem 0;"></div>

                    <div class="text-left" style="max-width: 600px; margin: 0 auto;">
                        <h4 class="mb-md">Seus Benefícios</h4>
                        <div class="flex flex-col gap-md">
                            ${plan.features.map(feature => `
                                <div class="flex items-center gap-md">
                                    <div style="background: rgba(16, 185, 129, 0.2); color: var(--success); padding: 4px; border-radius: 50%;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                    <span>${feature}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-body flex justify-between items-center">
                    <div>
                        <h4>Precisa de ajuda com seu plano?</h4>
                        <p class="text-muted mb-0">Entre em contato com nosso suporte exclusivo T-FIT.</p>
                    </div>
                    <button class="btn btn-outline" onclick="window.open('https://wa.me/5511911917087', '_blank')">
                        💬 Falar com Suporte
                    </button>
                </div>
            </div>
        `;
    } else {
        const trialStatus = PaymentHelper.getTrialStatus(currentUser);
        const availablePlans = db.getAll('plans').filter(p => {
            const creator = p.created_by ? db.getById('profiles', p.created_by) : null;
            return (!p.created_by || (creator && creator.role === 'admin')) && p.active !== false && (p.target_audience === 'student' || p.target_audience === 'student_ai');
        });

        content += `
            <div class="card text-center p-xl mb-xl ${trialStatus.isTrial ? 'border-primary' : ''}">
                <div class="card-body">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">${trialStatus.isTrial ? '🎁' : '💎'}</div>
                    <h2 class="mb-md">${trialStatus.isTrial ? `Teste Grátis Ativo (${trialStatus.daysLeft} dias)` : 'Nenhum Plano Ativo'}</h2>
                    <p class="text-muted mb-xl" style="max-width: 500px; margin-left: auto; margin-right: auto;">
                        ${trialStatus.isTrial ?
                'Você está aproveitando o período de degustação da plataforma. Assine um plano abaixo para garantir seu acesso contínuo.' :
                'Você ainda não possui um plano de assinatura vinculado à sua conta. Escolha uma das opções abaixo para começar.'}
                    </p>

                </div>
            </div>

            <h3 class="mb-lg">Meus Planos Assinados</h3>
            ${availablePlans.length > 0 ? `
                <div class="grid grid-3">
                    ${availablePlans.map(p => `
                        <div class="card border-hover transition-all">
                            <div class="card-header text-center">
                                <h3 class="card-title">${p.name}</h3>
                                <div class="stat-value text-primary" style="font-size: 2rem; margin: 1rem 0;">
                                    R$ ${parseFloat(p.price || 0).toFixed(2)}
                                </div>
                                <p class="text-muted text-sm">${p.billing_cycle}</p>
                            </div>
                            <div class="card-body">
                                <div class="flex flex-col gap-sm mb-lg">
                                    ${(p.features || []).map(f => `
                                        <div class="flex items-center gap-sm text-sm">
                                            <span style="color: var(--success);">✓</span>
                                            <span>${f}</span>
                                        </div>
                                    `).join('')}
                                </div>
                                <button class="btn btn-primary btn-block" onclick="window.payPersonalPlan('${p.id}')">
                                    Assinar Agora
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-center text-muted">Nenhum plano disponível no momento.</p>'}
        `;
    }

    UI.renderDashboard(content, 'student');
});
