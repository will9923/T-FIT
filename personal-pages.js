// ============================================
// PERSONAL TRAINER DASHBOARD
// ============================================

const getPersonalLimitInfo = (personalId) => {
    const personal = db.getById('personals', personalId);
    if (!personal || !personal.plan_id) return { maxStudents: 0, currentStudents: 0 };

    const plan = db.getById('plans', personal.plan_id);
    const activeStudents = db.query('profiles', s => s.assigned_personal_id === personalId && s.status === 'active').length;

    return {
        maxStudents: plan ? (plan.max_students || 0) : 0,
        currentStudents: activeStudents,
        plan_name: plan ? plan.name : 'N/A'
    };
};

const checkPersonalAccess = (callback, checkLimit = false) => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) return false;

    // Use unified premium guard
    // For personals, almost everything is premium, but we'll label it 'Plataforma Personal'
    window.PaymentHelper.handlePremiumAction('Plataforma Personal', currentUser, () => {
        // 2. For limit-specific check (Registration of students)
        if (checkLimit) {
            // Plan capacity check
            const limitInfo = getPersonalLimitInfo(currentUser.id);
            if (limitInfo.maxStudents > 0 && limitInfo.currentStudents >= limitInfo.maxStudents) {
                UI.showModal('Limite do Plano Atingido 📈', `
                    <div class="text-center p-lg">
                        <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">📈</div>
                        <h3 class="mb-md">Limite: ${limitInfo.maxStudents} Alunos</h3>
                        <p class="text-muted mb-xl">Você atingiu a capacidade máxima do seu plano <b>${limitInfo.plan_name}</b>. Faça um upgrade para continuar cadastrando.</p>
                        <div class="flex flex-col gap-sm">
                            <button class="btn btn-primary btn-block" onclick="router.navigate('/payment/plans'); UI.closeModal();">Ver Planos de Upgrade</button>
                        </div>
                    </div>
                `);
                return;
            }
        }

        if (callback) callback();
    }, 'base');

    return true; // We return true because the modal handles the block visually
};


router.addRoute('/personal/dashboard', async () => {
    try {
        if (!auth.requireAuth('personal')) return;

        // Force strict session sync with DB
        const currentUser = auth.getCurrentUser();

        // Marketplace stats
        const activeRelations = db.query('alunos_planos', ap => ap.personal_id === currentUser.id && ap.status === 'ativo');
        const activeStudents = activeRelations.length;

        const allRelations = db.query('alunos_planos', ap => ap.personal_id === currentUser.id);
        const studentPayments = db.query('pagamentos', p => p.personal_id === currentUser.id && p.status === 'aprovado');

        // Pending logic (new)
        const pendingPayments = db.query('pagamentos', p => p.personal_id === currentUser.id && p.status === 'pendente');

        const workouts = db.query('workouts', w => w.personal_id === currentUser.id);
        const completions = db.getAll('workout_completions');

        const totalWorkouts = workouts.length;
        const completedToday = completions.filter(c => {
            const today = new Date().toDateString();
            return new Date(c.completed_at).toDateString() === today;
        }).length;

        // Subscription Logic (Trainer's own plan with T-FIT)
        const isPaid = PaymentHelper.getPaymentStatus(currentUser) === 'paid';
        const dueDate = currentUser.plan_expiry ? new Date(currentUser.plan_expiry) : null;
        const today = new Date();
        const isOverdue = dueDate && today > dueDate;


        const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Olá, ${currentUser.name}! 👋</h1>
                <p class="page-subtitle">Personal Trainer Dashboard • Marketplace</p>
            </div>
        </div>

        <!-- Analytics Section (Moved to top based on user request) -->
        <div class="grid grid-2 mb-xl gap-lg">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">💰 Receita Acumulada</h3>
                </div>
                <div class="card-body">
                    <div class="text-center py-lg border-b mb-md">
                        <div class="text-4xl font-black text-primary mb-xs">R$ ${studentPayments.reduce((sum, p) => sum + parseFloat(p.valor || 0), 0).toFixed(2)}</div>
                        <p class="text-xs text-muted font-bold uppercase tracking-wider">Total Acumulado</p>
                    </div>
                    
                    <div class="grid grid-2 gap-md mb-lg">
                        <div class="p-md bg-light rounded-xl text-center">
                            <div class="text-xs text-muted uppercase font-bold mb-xs">Este Mês</div>
                            <div class="text-xl font-bold text-primary">
                                R$ ${studentPayments.filter(p => {
            const d = new Date(p.data_pagamento || p.created_at);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((sum, p) => sum + parseFloat(p.valor || 0), 0).toFixed(2)}
                            </div>
                        </div>
                        <div class="p-md bg-light rounded-xl text-center">
                            <div class="text-xs text-muted uppercase font-bold mb-xs">Esta Semana</div>
                            <div class="text-xl font-bold text-success">
                                R$ ${studentPayments.filter(p => {
            const d = new Date(p.data_pagamento || p.created_at);
            const now = new Date();
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            return d >= weekAgo;
        }).reduce((sum, p) => sum + parseFloat(p.valor || 0), 0).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div class="chart-container" style="height: 180px;">
                        <canvas id="finance-chart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📊 Engajamento</h3>
                </div>
                <div class="card-body">
                    <div class="text-center py-lg">
                        <div class="text-4xl font-black text-success mb-xs" id="engagement-rate">0%</div>
                        <p class="text-xs text-muted font-bold uppercase tracking-wider">Treinos Concluídos</p>
                    </div>
                    <canvas id="performance-chart" style="max-height: 150px;"></canvas>
                </div>
            </div>
        </div>

        <!-- Stats Cards (Marketplace) -->
        <div class="grid grid-3 mb-xl">
            <div class="stat-card">
                <div class="stat-value">${allRelations.length}</div>
                <div class="stat-label">Total de Alunos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${activeStudents}</div>
                <div class="stat-label">Alunos Ativos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${completedToday}</div>
                <div class="stat-label">Treinos Hoje</div>
            </div>
        </div>

        ${pendingPayments.length > 0 ? `
            <div class="card mb-xl shadow-glow" style="border-left: 5px solid var(--warning); background: rgba(245, 158, 11, 0.05);">
                <div class="card-body flex justify-between items-center py-md">
                    <div>
                        <h3 class="text-warning mb-xs">⚠️ Pagamentos Pendentes (${pendingPayments.length})</h3>
                        <p class="text-muted mb-0">Existem alunos aguardando processamento de pagamento.</p>
                    </div>
                    <button class="btn btn-warning" onclick="router.navigate('/personal/payments')">Ver Extrato</button>
                </div>
            </div>
        ` : ''}

        <!-- Quick Actions -->
        <div class="card mb-xl">
            <div class="card-header">
                <h3 class="card-title">Ações do Marketplace</h3>
            </div>
            <div class="card-body">
                <div class="grid grid-3 gap-md">
                    <button class="btn btn-primary" onclick="router.navigate('/personal/students')">
                        👤 Meus Alunos
                    </button>
                    <button class="btn btn-secondary" onclick="router.navigate('/personal/plans')">
                        💰 Planos Marketplace
                    </button>
                    <button class="btn btn-outline" onclick="router.navigate('/personal/payments')">
                        📊 Financeiro / MP
                    </button>
                </div>
            </div>
        </div>

        <!-- Recent Students List -->
        <div class="card">
            <div class="card-header flex justify-between items-center">
                <h3 class="card-title">Últimos Alunos Contratados</h3>
                <button class="btn btn-xs btn-ghost" onclick="router.navigate('/personal/students')">Ver todos</button>
            </div>
            <div class="card-body">
                ${allRelations.length > 0 ? `
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Aluno</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allRelations.slice(0, 5).map(rel => {
            const student = db.getById('profiles', rel.aluno_id);
            return `
                                        <tr>
                                            <td>
                                                <div class="flex items-center gap-sm">
                                                    <div class="sidebar-avatar" style="width:30px; height:30px; font-size:0.8rem;">
                                                        ${student?.foto ? `<img src="${student.foto}">` : (student?.name || '?').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div class="font-bold text-sm">${student?.name || 'Desconhecido'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span class="badge ${rel.status === 'ativo' ? 'badge-success' : 'badge-danger'}">${rel.status.toUpperCase()}</span></td>
                                            <td>
                                                <button class="btn btn-xs btn-outline" onclick="router.navigate('/personal/workouts?studentId=${rel.aluno_id}')">Treinos</button>
                                            </td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-muted text-center py-lg">Nenhum aluno no marketplace ainda.</p>'}
            </div>
        </div>
        `;

        if (window.startAdCarousel) window.startAdCarousel();

        // ==============================
        // ANALYTICS & CHARTS
        // ==============================

        // Calculate financial metrics
        // Create Set for easy lookup
        // const myStudentIds = new Set(activeStudentsList.map(s => s.id)); // This was for old logic
        // const plans = db.query('plans', p => p.created_by === currentUser.id);
        // let monthlyRevenue = 0;

        // activeStudentsList.forEach(student => {
        //     const studentPlan = plans.find(p => p.id === student.plan_id);
        //     if (studentPlan) {
        //         monthlyRevenue += parseFloat(studentPlan.price) || 0;
        //     } else {
        //         // Default value if no plan is set (R$ 150/month average)
        //         monthlyRevenue += 150;
        //     }
        // });

        // setTimeout(() => {
        //     const el = document.getElementById('monthly-revenue');
        //     if (el) el.textContent = `R$ ${monthlyRevenue.toFixed(2).replace('.', ',')} `;
        // }, 50);

        // Calculate engagement rate
        // const allWorkouts = db.query('workouts', w => {
        //     return activeStudentsList.some(s => s.id === w.student_id);
        // });

        // const totalAssignedWorkouts = allWorkouts.length;
        // const completedWorkouts = completions.filter(c => myStudentIds.has(c.student_id)).length;
        // const targetMonthly = activeStudentsList.length * 12;
        // const engagementRate = targetMonthly > 0 ? Math.min(100, Math.round((completedWorkouts / targetMonthly) * 100)) : 0;

        // setTimeout(() => {
        //     const el = document.getElementById('engagement-rate');
        //     if (el) el.textContent = `${engagementRate} % `;
        // }, 50);

        // Find top student
        // const studentCompletions = {};
        // completions.forEach(c => {
        //     if (!studentCompletions[c.student_id]) studentCompletions[c.student_id] = 0;
        //     studentCompletions[c.student_id]++;
        // });

        // let topStudent = '-';
        // let maxCompletions = 0;
        // Object.keys(studentCompletions).forEach(studentId => {
        //     // Only count if student is mine & active
        //     if (myStudentIds.has(studentId) && studentCompletions[studentId] > maxCompletions) {
        //         maxCompletions = studentCompletions[studentId];
        //         const student = activeStudentsList.find(s => s.id === studentId);
        //         if (student && student.name) topStudent = student.name.split(' ')[0];
        //         else if (student) topStudent = 'Aluno';
        //     }
        // });

        // setTimeout(() => {
        //     const el = document.getElementById('top-student');
        //     if (el) el.textContent = topStudent;
        // }, 50);

        // ======== ANALYTICS CALCULATIONS (Delayed for UI) ========
        setTimeout(() => {
            // Calculate engagement rate
            const myStudentIds = new Set(allRelations.map(rel => rel.aluno_id));
            const completedWorkouts = completions.filter(c => myStudentIds.has(c.student_id)).length;
            const targetMonthly = activeStudents * 12; // Base estimation
            const engagementRate = targetMonthly > 0 ? Math.min(100, Math.round((completedWorkouts / targetMonthly) * 100)) : 0;

            const engEl = document.getElementById('engagement-rate');
            if (engEl) engEl.textContent = `${engagementRate}%`;

            // ======== CHARTS ========
            const ctxFinance = document.getElementById('finance-chart');
            if (ctxFinance) {
                // Group payments by day for the last 7 days
                const last7Days = [...Array(7)].map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    return d.toISOString().split('T')[0];
                });

                const dailyValues = last7Days.map(date => {
                    return studentPayments
                        .filter(p => (p.data_pagamento || p.created_at).startsWith(date))
                        .reduce((sum, p) => sum + parseFloat(p.valor || 0), 0);
                });

                new Chart(ctxFinance, {
                    type: 'line',
                    data: {
                        labels: last7Days.map(d => new Date(d).toLocaleDateString('pt-BR', { weekday: 'short' })),
                        datasets: [{
                            label: 'Receita (R$)',
                            data: dailyValues,
                            borderColor: 'rgba(99, 102, 241, 1)',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }

            const ctxPerformance = document.getElementById('performance-chart');
            if (ctxPerformance && activeStudents > 0) {
                const studentPerf = allRelations.slice(0, 5).map(rel => {
                    const student = db.getById('profiles', rel.aluno_id);
                    const count = completions.filter(c => c.student_id === rel.aluno_id).length;
                    return { name: (student?.name || 'Aluno').split(' ')[0], count };
                }).sort((a, b) => b.count - a.count);

                new Chart(ctxPerformance, {
                    type: 'bar',
                    data: {
                        labels: studentPerf.map(s => s.name),
                        datasets: [{
                            label: 'Concluídos',
                            data: studentPerf.map(s => s.count),
                            backgroundColor: 'rgba(16, 185, 129, 0.8)',
                            borderWidth: 0
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, display: false } } }
                });
            }
        }, 100);


        // Helper to activate student
        window.activateStudent = (studentId) => {
            UI.confirmDialog(
                'Ativar Aluno',
                'Confirmar que o pagamento foi recebido e liberar acesso ao aluno?',
                () => {
                    db.update('profiles', studentId, {
                        status: 'active'
                    });

                    // Send welcome message
                    const student = db.getById('profiles', studentId);
                    if (student.phone) {
                        const message = `Olá ${student.name}!Seu acesso foi liberado! Já pode acessar seus treinos no app. 💪`;
                        WhatsApp.sendMessage(student.phone, message);
                    }

                    UI.showNotification('Sucesso', 'Aluno ativado com sucesso!', 'success');
                    router.navigate('/personal/dashboard'); // refresh
                }
            );
        };

        UI.renderDashboard(content, 'personal');
    } catch (error) {
        console.error('❌ Erro no Dashboard do Personal:', error);
        UI.renderDashboard(`
            <div class="text-center p-xl">
                <h3>Ops! Erro ao carregar dashboard</h3>
                <p class="text-muted">${error.message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Recarregar</button>
            </div>
        `, 'personal');
    }
});

// ============================================
// PERSONAL - MANAGE STUDENTS
// ============================================

router.addRoute('/personal/payments', async () => {
    const user = auth.getCurrentUser();
    if (!user) return router.navigate('/');

    UI.showLoading('Carregando financeiro...');
    const config = await window.loadPaymentConfig(user.id);
    const marketplacePayments = db.query('pagamentos', p => p.personal_id === user.id)
        .sort((a, b) => new Date(b.created_at || b.data_pagamento) - new Date(a.created_at || a.data_pagamento));
    const tfitPx = db.getAll('tfit_payments') || [];
    const generalPx = db.getAll('payments') || [];
    const subPayments = [...tfitPx, ...generalPx].filter(p => p.user_id === user.id)
        .sort((a, b) => new Date(b.data_geracao || b.created_at || 0) - new Date(a.data_geracao || a.created_at || 0));
    UI.hideLoading();

    // Stats calculations
    const approvedPayments = marketplacePayments.filter(p => p.status === 'aprovado');
    const totalRevenue = approvedPayments.reduce((sum, p) => sum + parseFloat(p.valor || 0), 0);
    const pendingCount = marketplacePayments.filter(p => p.status === 'pendente').length;

    const content = `
        <div class="page p-xl">
            <div class="page-header flex justify-between items-center mb-xl">
                <div>
                    <h1 class="page-title">Financeiro & Pagamentos 💰</h1>
                    <p class="page-subtitle">Gestão de ganhos e assinaturas da plataforma</p>
                </div>
            </div>

            <!-- TAB NAVIGATION -->
            <div class="tabs mb-xl" style="background: rgba(255,255,255,0.05); padding: 5px; border-radius: 12px;">
                <button class="tab-btn active" onclick="UI.switchTab('tab-recebimentos')">📊 Recebimentos</button>
                <button class="tab-btn" onclick="UI.switchTab('tab-assinatura')">💎 Minha Assinatura</button>
                <button class="tab-btn" onclick="UI.switchTab('tab-config')">⚙️ Configurações</button>
            </div>

            <!-- TAB 1: RECEBIMENTOS -->
            <div id="tab-recebimentos" class="tab-content transition-fade">
                <div class="grid grid-3 gap-md mb-xl">
                    <div class="card p-lg text-center bg-primary text-white shadow-glow" style="border: none; border-radius: 20px;">
                        <div class="text-xs opacity-80 uppercase mb-xs font-bold tracking-widest">Saldo Total</div>
                        <div class="text-3xl font-black">R$ ${totalRevenue.toFixed(2)}</div>
                    </div>
                    <div class="card p-lg text-center" style="border-radius: 20px;">
                        <div class="text-xs text-muted uppercase mb-xs font-bold tracking-widest">Vendas Aprovadas</div>
                        <div class="text-3xl font-black text-success">${approvedPayments.length}</div>
                    </div>
                    <div class="card p-lg text-center" style="border-radius: 20px;">
                        <div class="text-xs text-muted uppercase mb-xs font-bold tracking-widest">Aprovações Pendentes</div>
                        <div class="text-3xl font-black text-warning">${pendingCount}</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Extrato de Alunos (Marketplace)</h3>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Aluno</th>
                                        <th>Plano</th>
                                        <th>Valor</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${marketplacePayments.length > 0 ? marketplacePayments.map(p => {
        const aluno = db.getById('profiles', p.aluno_id);
        const date = p.data_pagamento || p.created_at;
        return `
                                            <tr>
                                                <td class="text-xs text-muted">${date ? new Date(date).toLocaleDateString() : '-'}</td>
                                                <td>
                                                    <div class="font-bold flex items-center gap-xs">
                                                        <div class="sidebar-avatar" style="width:24px; height:24px; font-size:0.7rem;">
                                                            ${aluno?.foto ? `<img src="${aluno.foto}">` : (aluno?.name || '?').charAt(0)}
                                                        </div>
                                                        ${aluno?.name || 'Aluno Excluído'}
                                                    </div>
                                                </td>
                                                <td class="text-sm">${p.plano_nome || 'Aula/Plano'}</td>
                                                <td class="font-bold">R$ ${parseFloat(p.valor || 0).toFixed(2)}</td>
                                                <td class="flex gap-xs items-center">
                                                    ${p.status === 'pendente' ? `
                                                        <button class="btn btn-xs btn-primary font-bold" onclick="window.manuallyApproveStudentPayment('${p.id}')">Aprovar</button>
                                                    ` : `
                                                        <span class="badge badge-success">APROVADO</span>
                                                    `}
                                                    ${(p.mercado_pago_id || p.id) ? `
                                                        <button class="btn btn-xs btn-outline ml-sm" onclick="window.showDigitalReceipt('${p.id}')">🧾 Comprovante App</button>
                                                    ` : ''}
                                                </td>
                                            </tr>
                                        `;
    }).join('') : '<tr><td colspan="5" class="text-center p-xl text-muted">Nenhum histórico de recebimentos.</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 2: MINHA ASSINATURA -->
            <div id="tab-assinatura" class="tab-content hidden transition-fade">
                <div class="card mb-xl">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Assinatura do Profissional (T-FIT)</h3>
                    </div>
                    <div class="card-body">
                        ${(() => {
            const accessCheck = PaymentHelper.checkStudentAccess(user);
            const sub = db.query('subscriptions', s => s.user_id === user.id)[0];
            const isTrial = accessCheck.status === 'trial';
            const isGrace = accessCheck.status === 'grace_period';
            const isBlocked = accessCheck.status === 'blocked';
            const planId = user.plan_id || 'plano_personal_mensal';
            const plan = db.getById('plans', planId) || { name: 'Plano Profissional', price: 99.90 };

            const expiryDateStr = user.data_vencimento || user.plan_expiry;
            const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
            const daysLeft = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : 0;

            if (isTrial) {
                return `
                                    <div class="text-center py-xl bg-warning-light rounded-xl border-dashed border-warning p-md">
                                        <div class="text-4xl mb-md">🎁</div>
                                        <h2 class="text-warning mb-xs">Modo de Teste Grátis</h2>
                                        <p class="text-muted mb-lg">Sua degustação completa expira em <strong>${accessCheck.daysLeft} dias</strong>.</p>
                                        <button class="btn btn-primary" onclick="router.navigate('/payment/plans')">Contratar agora</button>
                                    </div>
                                `;
            }

            return `
                                <div class="p-lg rounded-xl mb-md" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid var(--primary-light);">
                                    <div class="flex justify-between items-start mb-lg">
                                        <div>
                                            <h2 class="font-black text-2xl mb-xs">${plan.name} 💎</h2>
                                            <p class="text-sm text-muted">Acesso ilimitado às ferramentas do Personal</p>
                                        </div>
                                        <span class="badge ${isBlocked ? 'badge-danger' : isGrace ? 'badge-warning' : 'badge-success'} text-lg py-xs px-md">
                                            ${isBlocked ? 'EXPIRADO/BLOQUEADO' : isGrace ? 'VENCIDO/PENDENTE' : 'ATIVO'}
                                        </span>
                                    </div>
                                    <div class="flex gap-xl border-t border-dashed pt-md mb-lg">
                                        <div>
                                            <div class="text-xs text-muted uppercase font-bold mb-xs">Próxima Cobrança / Vencimento</div>
                                            <div class="font-bold text-lg ${daysLeft <= 3 ? 'text-danger' : 'text-success'}">${expiryDate ? expiryDate.toLocaleDateString() : 'Não consta'}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs text-muted uppercase font-bold mb-xs">Status Financeiro</div>
                                            <div class="font-bold text-lg">${isBlocked ? '❌ Expirado' : isGrace ? '⚠️ Pendente' : '✅ Em dia'}</div>
                                        </div>
                                    </div>
                                    <button class="btn btn-primary btn-block shadow-lg" onclick="window.startCheckout('${plan.price}', '${plan.name}', '${plan.id}', null, 'mensalidade_tfit')">
                                        💳 Renovar Assinatura (Pix/Cartão)
                                    </button>
                                </div>
                            `;
        })()}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Histórico de Pagamentos à Plataforma</h3>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Plano</th>
                                        <th>Valor</th>
                                        <th>Status</th>
                                        <th>Comprovante</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${subPayments.length > 0 ? subPayments.map(p => {
            const date = p.data_confirmacao || p.data_geracao || p.created_at;
            const isApproved = p.status === 'aprovado' || p.status === 'approved';
            const mpId = p.id_transacao_mercadopago || p.mercado_pago_id;
            return `
                                        <tr>
                                            <td class="text-xs">${date ? new Date(date).toLocaleDateString() : '-'}</td>
                                            <td class="text-sm">${p.description || 'Plano Profissional/IA'}</td>
                                            <td class="font-bold">R$ ${parseFloat(p.valor || p.amount || 0).toFixed(2)}</td>
                                            <td><span class="badge ${isApproved ? 'badge-success' : 'badge-warning'}">${(p.status || 'pendente').toUpperCase()}</span></td>
                                            <td>
                                                ${(mpId || p.id) ? `<button class="btn btn-xs btn-outline" onclick="window.showDigitalReceipt('${p.id}')">🧾 Comprovante App</button>` : `<span class="text-xs text-muted">-</span>`}
                                            </td>
                                        </tr>
                                    `;
        }).join('') : '<tr><td colspan="5" class="text-center p-lg text-muted">Nenhum pagamento registrado.</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 3: CONFIGURACAO MERCADO PAGO -->
            <div id="tab-config" class="tab-content hidden transition-fade">
                <div class="card" style="border-top: 5px solid #009ee3;">
                    <div class="card-header flex justify-between items-center">
                        <div>
                            <h3 class="card-title">Configurar Recebimento (Mercado Pago)</h3>
                            <p class="text-xs text-muted">Receba diretamente de seus alunos via Checkout Pro</p>
                        </div>
                        <span class="badge ${config ? 'badge-success' : 'badge-warning'}">${config ? 'CONECTADO' : 'PENDENTE'}</span>
                    </div>
                    <div class="card-body">
                        <form id="mp-config-form" class="grid grid-2 gap-md mb-lg">
                            <div class="form-group">
                                <label class="form-label">Minha Public Key</label>
                                <input type="text" id="mp-public-key" class="form-input" placeholder="APP_USR-..." value="${config?.public_key || ''}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Meu Access Token</label>
                                <input type="password" id="mp-access-token" class="form-input" placeholder="${config ? '******** (Salvo)' : 'APP_USR-...'}" required>
                                <p class="text-xs text-muted mt-xs">O token é encriptado antes de salvar.</p>
                            </div>
                        </form>
                        <div class="flex gap-md">
                            <button class="btn btn-primary" id="btn-save-mp-config">💾 Salvar Chaves</button>
                            <button class="btn btn-outline" onclick="window.testMPConnection('${user.id}')" ${!config ? 'disabled' : ''}>⚡ Testar Conexão</button>
                        </div>
                        <hr class="my-xl">
                        <div class="bg-light p-md rounded-xl border-dashed">
                            <h4 class="mb-xs text-sm">❓ Onde encontro estas chaves?</h4>
                            <p class="text-xs text-muted mb-0">No seu painel do Mercado Pago Developers, vá em <strong>Suas Aplicações > Produção > Credenciais</strong>.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'personal');

    const btnSave = document.getElementById('btn-save-mp-config');
    if (btnSave) {
        btnSave.onclick = async () => {
            const publicKey = document.getElementById('mp-public-key').value;
            let accessToken = document.getElementById('mp-access-token').value;
            if (accessToken && accessToken.includes('***')) accessToken = null;

            UI.showLoading('Salvando...');
            const success = await window.savePaymentConfig({ user_id: user.id, public_key: publicKey, access_token: accessToken });
            UI.hideLoading();
            if (success) {
                UI.showNotification('Sucesso', 'Configurações atualizadas!', 'success');
                router.navigate('/personal/payments');
            }
        };
    }
});

// Helper: Manual approval of student payment
window.manuallyApproveStudentPayment = async (paymentId) => {
    UI.confirmDialog('Aprovar Recebimento', 'Confirma que recebeu este pagamento via Pix manual? O acesso do aluno será desbloqueado agora.', async () => {
        UI.showLoading('Processando aprovação...');
        try {
            const payment = db.getById('pagamentos', paymentId);
            if (!payment) throw new Error('Pagamento não encontrado');

            const plan = db.getById('planos_personal', payment.plano_id);
            const duration = plan?.duracao_dias || 30;
            const nextBilling = new Date(); nextBilling.setDate(nextBilling.getDate() + duration);

            // 1. Update Payment Status
            await db.update('pagamentos', paymentId, { status: 'aprovado', data_pagamento: new Date().toISOString() });

            // 2. Update Student Relationship (Composite check)
            const relations = db.query('alunos_planos', ap => ap.aluno_id === payment.aluno_id && ap.personal_id === payment.personal_id);
            if (relations.length > 0) {
                await db.update('alunos_planos', relations[0].id, { status: 'ativo', data_proxima_cobranca: nextBilling.toISOString() });
            } else {
                await db.create('alunos_planos', {
                    aluno_id: payment.aluno_id,
                    personal_id: payment.personal_id,
                    plano_id: payment.plano_id,
                    status: 'ativo',
                    data_proxima_cobranca: nextBilling.toISOString()
                });
            }

            // 3. Activate Student Profile
            await db.update('profiles', payment.aluno_id, { status: 'active', assigned_personal_id: payment.personal_id });

            UI.hideLoading();
            UI.showNotification('Sucesso', 'Pagamento aprovado e aluno liberado!', 'success');
            router.navigate('/personal/payments');
        } catch (e) {
            UI.hideLoading();
            console.error(e);
            UI.showNotification('Erro', 'Falha ao aprovar pagamento: ' + e.message, 'error');
        }
    });
};

// Digital Receipt Modal Function
window.showDigitalReceipt = async (paymentId) => {
    // Try catching payment from any caching structure
    const payment = db.getById('pagamentos', paymentId) ||
        db.getById('tfit_payments', paymentId) ||
        db.getById('payments', paymentId) ||
        db.getAll('tfit_payments').find(p => p.id === paymentId) ||
        db.getAll('payments').find(p => p.id === paymentId);

    if (!payment) return UI.showNotification('Erro', 'Comprovante não encontrado no banco local.', 'error');

    // Assemble info
    const isApproved = payment.status === 'aprovado' || payment.status === 'approved';
    const date = payment.data_confirmacao || payment.data_pagamento || payment.data_geracao || payment.created_at;
    const amount = parseFloat(payment.valor || payment.amount || 0).toFixed(2);
    const transId = payment.mercado_pago_id || payment.id_transacao_mercadopago || payment.id;

    let subtitle = payment.aluno_id ? "Extrato Marketplace Aluno" : "Extrato Assinatura Plataforma T-FIT";
    let planName = payment.plano_nome || payment.description || "Plano";
    let buyerName = "-";

    if (payment.aluno_id) {
        const student = db.getById('profiles', payment.aluno_id);
        buyerName = student ? student.name : "Aluno Excluído";
        const plan = db.getById('planos_personal', payment.plano_id);
        if (plan) planName = plan.nome;
    } else {
        const user = db.getById('personals', payment.user_id) || db.getById('profiles', payment.user_id);
        buyerName = user ? (user.name || user.nome) : "Você";
    }

    const modalContent = `
        <div class="p-md text-center">
            <div class="mb-lg">
                <div class="avatar-lg bg-primary mx-auto mb-xs flex items-center justify-center font-bold text-white text-2xl shadow-glow" style="width: 70px; height: 70px; border-radius: 50%;">
                    ${isApproved ? '✅' : '⏳'}
                </div>
                <h2 class="text-xl font-black mb-xs text-primary">R$ ${amount}</h2>
                <div class="badge ${isApproved ? 'badge-success' : 'badge-warning'} mb-sm font-bold">${(payment.status || 'Pendente').toUpperCase()}</div>
                <p class="text-xs text-muted uppercase tracking-wider">${subtitle}</p>
            </div>
            
            <div class="card p-md shadow-sm mb-lg text-left" style="background: rgba(255,255,255,0.03); border: 1px dashed var(--border);">
                <div class="flex justify-between border-b pb-sm mb-sm border-dashed">
                    <span class="text-sm text-muted uppercase font-bold text-[10px]">ID Transação</span>
                    <span class="text-sm font-bold opacity-75">${transId}</span>
                </div>
                <div class="flex justify-between border-b pb-sm mb-sm border-dashed">
                    <span class="text-sm text-muted uppercase font-bold text-[10px]">Data e Hora</span>
                    <span class="text-sm font-bold">${date ? new Date(date).toLocaleString('pt-BR') : '-'}</span>
                </div>
                <div class="flex justify-between border-b pb-sm mb-sm border-dashed">
                    <span class="text-sm text-muted uppercase font-bold text-[10px]">Produto / Plano</span>
                    <span class="text-sm font-bold">${planName}</span>
                </div>
                <div class="flex justify-between pt-xs">
                    <span class="text-sm text-muted uppercase font-bold text-[10px]">Titular Pagador</span>
                    <span class="text-sm font-bold text-primary">${buyerName}</span>
                </div>
            </div>
            
            <p class="text-xs text-muted mb-lg">Este é o comprovante digital oficial (Nota Interna) gerado dentro do seu dashboard T-FIT Private Marketplace.</p>
            <button class="btn btn-outline btn-block mb-xs" onclick="UI.closeModal()">Fechar Comprovante</button>
        </div>
    `;
    UI.showModal('🧾 Comprovante Digital', modalContent);
};

router.addRoute('/personal/students', async () => {
    if (!auth.requireAuth('personal')) return;

    UI.showLoading('Carregando alunos...');
    const currentUser = auth.getCurrentUser();

    // Fetch students who have an active (or recently expired) plan with this personal
    const relations = db.query('alunos_planos', ap => ap.personal_id === currentUser.id);
    const profiles = db.getAll('profiles');

    // Map relations to profiles
    const students = relations.map(rel => {
        const profile = profiles.find(p => p.id === rel.aluno_id);
        return profile ? { ...profile, plan_info: rel } : null;
    }).filter(s => s !== null);

    const activeCount = relations.filter(r => r.status === 'ativo').length;
    const pendingCount = relations.filter(r => r.status !== 'ativo').length;

    UI.hideLoading();

    const content = `
        <div class="page p-xl">
            <div class="page-header flex justify-between items-center mb-xl">
                <div>
                    <h1 class="page-title">Meus Alunos Marketplace 👥</h1>
                    <p class="page-subtitle">Gestão de alunos vinculados aos seus planos</p>
                </div>
                <div class="flex gap-sm">
                    <button class="btn btn-outline" onclick="router.navigate('/personal/plans')">Gerenciar Planos</button>
                    <button class="btn btn-primary shadow-glow" onclick="showAddStudentModal()">+ Novo Aluno</button>
                </div>
            </div>

            <!-- SUMMARY STATS -->
            <div class="grid grid-3 gap-md mb-xl">
                <div class="card p-lg text-center bg-light border-0">
                    <div class="text-xs text-muted uppercase font-bold mb-xs tracking-widest">Total Alunos</div>
                    <div class="text-3xl font-black">${students.length}</div>
                </div>
                <div class="card p-lg text-center bg-success-light border-0">
                    <div class="text-xs text-success uppercase font-bold mb-xs tracking-widest">Ativos</div>
                    <div class="text-3xl font-black text-success">${activeCount}</div>
                </div>
                <div class="card p-lg text-center bg-warning-light border-0">
                    <div class="text-xs text-warning uppercase font-bold mb-xs tracking-widest">Pendentes</div>
                    <div class="text-3xl font-black text-warning">${pendingCount}</div>
                </div>
            </div>

            <!-- SEARCH BAR -->
            <div class="mb-xl">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="student-search" class="form-input" placeholder="Buscar aluno por nome ou email..." oninput="filterStudents(this.value)" style="padding-left: 3rem;">
                </div>
            </div>

            <div id="students-grid" class="grid grid-3 gap-lg">
                ${students.length > 0 ? students.sort((a, b) => new Date(b.plan_info.created_at || b.plan_info.data_inicio) - new Date(a.plan_info.created_at || a.plan_info.data_inicio)).map(student => {
        const plan = db.getById('planos_personal', student.plan_info.plano_id);
        const status = student.plan_info.status;
        const nextBilling = new Date(student.plan_info.data_proxima_cobranca);
        const isOverdue = nextBilling < new Date();

        return `
                        <div class="card student-card transition-fade hover-scale shadow-sm p-0 overflow-hidden" data-name="${student.name.toLowerCase()} ${student.email.toLowerCase()}">
                            <div class="p-lg">
                                <div class="flex items-center gap-md mb-lg">
                                    <div class="sidebar-avatar" style="width: 56px; height: 56px; border: 2px solid ${status === 'ativo' ? 'var(--success)' : 'var(--border)'};">
                                        ${student.foto ? `<img src="${student.foto}">` : student.name.charAt(0)}
                                    </div>
                                    <div class="flex-1 overflow-hidden">
                                        <h3 class="font-bold text-lg mb-0 truncate">${student.name}</h3>
                                        <p class="text-xs text-muted truncate">${student.email}</p>
                                    </div>
                                    <span class="badge ${status === 'ativo' ? 'badge-success' : 'badge-danger'} badge-pill" style="padding: 2px 8px; font-size: 0.6rem;">${status}</span>
                                </div>

                                <div class="p-md rounded-xl mb-lg bg-light" style="background: rgba(0,0,0,0.02);">
                                    <div class="flex justify-between items-center mb-xs">
                                        <span class="text-2xs text-muted uppercase font-bold">Plano</span>
                                        <span class="text-xs font-bold text-primary">${plan ? plan.nome : 'Personal'}</span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span class="text-2xs text-muted uppercase font-bold">Renovação</span>
                                        <span class="text-xs font-bold ${isOverdue ? 'text-danger' : 'text-success'}">
                                            ${nextBilling.toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>

                                <div class="grid grid-4 gap-xs">
                                    <button class="btn btn-xs btn-outline" onclick="router.navigate('/personal/workouts?studentId=${student.id}')" title="Ficha de Treinos">🏋️</button>
                                    <button class="btn btn-xs btn-outline" onclick="router.navigate('/personal/nutrition?studentId=${student.id}')" title="Dieta e Macros">🥗</button>
                                    <button class="btn btn-xs btn-outline" onclick="router.navigate('/personal/assessments?studentId=${student.id}')" title="Avaliações">📊</button>
                                    <button class="btn btn-xs btn-success" onclick="WhatsApp.contactStudent('${student.phone}', '${currentUser.name}')" title="Chamar WhatsApp">💬</button>
                                </div>
                            </div>
                            <div class="card-footer bg-light py-xs px-lg flex justify-between items-center">
                                <span class="text-2xs text-muted">ID: ...${student.id.slice(-6)}</span>
                                <button class="btn btn-xs btn-ghost p-0 font-bold text-primary" onclick="window.editStudent('${student.id}')">EDITAR</button>
                            </div>
                        </div>
                    `;
    }).join('') : `
                    <div class="col-span-3 text-center p-2xl card bg-light border-dashed">
                        <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;">👤</div>
                        <h3 class="text-muted">Nenhum aluno no marketplace</h3>
                        <p class="text-muted mb-lg">Os alunos que assinarem seus planos aparecerão aqui.</p>
                        <button class="btn btn-primary" onclick="showAddStudentModal()">Cadastrar Primeiro Aluno</button>
                    </div>
                `}
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'personal');

    // SEARCH LOGIC
    window.filterStudents = (term) => {
        const query = term.toLowerCase();
        document.querySelectorAll('.student-card').forEach(card => {
            const name = card.getAttribute('data-name');
            card.style.display = name.includes(query) ? 'block' : 'none';
        });
    };
});

// Add Student Modal
window.showAddStudentModal = window.showQuickAddStudentModal = () => {
    // Feature Lock: Check for subscription AND student limit
    if (!checkPersonalAccess(null, true)) return;

    // Double check specific limit for student registration
    const check = (window.PaymentHelper && typeof window.PaymentHelper.checkActionLimit === 'function')
        ? window.PaymentHelper.checkActionLimit(auth.getCurrentUser().id, 'register_student')
        : { allowed: true };

    if (!check.allowed) {
        UI.showModal('Limite de Plano Gratuito 🔒', `
                <div class="text-center p-lg">
                <div style="font-size: 3rem; margin-bottom: 1rem;">👥</div>
                <h3>Limite de Alunos Atingido</h3>
                <p class="text-muted mb-lg">${check.message}</p>
                <button class="btn btn-primary btn-block" onclick="router.navigate('/personal/subscription'); UI.closeModal();">
                    Fazer Upgrade Agora
                </button>
            </div>
    `);
        return;
    }

    const currentUser = auth.getCurrentUser();
    const plans = db.query('planos_personal', p => p.personal_id === currentUser.id);

    const modalContent = `
    <form id="add-student-form">
            <div class="form-group">
                <label class="form-label">Nome Completo *</label>
                <input type="text" class="form-input" id="student-name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-input" id="student-email" required>
            </div>
            <div class="form-group">
                <label class="form-label">Plano de Assinatura</label>
                <select class="form-select" id="student-plan">
                    <option value="">Selecione um plano...</option>
                    ${plans.map(p => `<option value="${p.id}">${p.nome} - R$ ${parseFloat(p.preco).toFixed(2)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Senha Provisória *</label>
                <input type="password" class="form-input" id="student-password" value="${Math.random().toString(36).slice(-8)}" required>
                <p class="form-help">Esta senha será enviada ao aluno via WhatsApp</p>
            </div>
            <div class="form-group">
                <label class="form-label">Telefone (WhatsApp) *</label>
                <input type="tel" class="form-input" id="student-phone" placeholder="5511911917087" required>
                <p class="form-help">Necessário para enviar as credenciais</p>
            </div>
            <div class="form-group">
                <label class="form-label">Objetivo</label>
                <select class="form-select" id="student-goal">
                    <option value="">Selecione...</option>
                    <option value="Emagrecimento">Emagrecimento</option>
                    <option value="Ganho de Massa">Ganho de Massa Muscular</option>
                    <option value="Condicionamento">Condicionamento Físico</option>
                    <option value="Saúde">Saúde e Bem-estar</option>
                </select>
            </div>
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label">Sexo Biológico *</label>
                    <select class="form-select" id="student-sex" required>
                        <option value="male">Masculino</option>
                        <option value="female">Feminino</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Idade *</label>
                    <input type="number" class="form-input" id="student-age" placeholder="Ex: 25" required>
                </div>
            </div>
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label">Peso (kg)</label>
                    <input type="number" class="form-input" id="student-weight" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Altura (cm)</label>
                    <input type="number" class="form-input" id="student-height">
                </div>
            </div>
        </form>
    `;

    UI.showModal('Adicionar Novo Aluno', modalContent, async () => {
        const name = document.getElementById('student-name').value;
        const email = document.getElementById('student-email').value;
        const password = document.getElementById('student-password').value;
        const phone = document.getElementById('student-phone').value;
        const planId = document.getElementById('student-plan').value;
        const goal = document.getElementById('student-goal').value;
        const weight = document.getElementById('student-weight').value;
        const height = document.getElementById('student-height').value;
        const sex = document.getElementById('student-sex').value;
        const age = document.getElementById('student-age').value;

        if (!name || !email || !password || !phone || !age) {
            UI.showNotification('Erro', 'Preencha todos os campos obrigatórios', 'error');
            return false;
        }

        const selectedPlan = db.getById('planos_personal', planId) || db.getById('plans', planId);
        const cycle = selectedPlan ? (selectedPlan.billing_cycle || (selectedPlan.duracao_meses ? 'Personalizado' : 'Mensal')) : 'Mensal';

        const studentData = {
            name,
            email,
            password,
            phone: phone || '',
            plan_id: planId || null,
            goal: goal || '',
            weight: (weight && !isNaN(parseFloat(weight.replace(',', '.')))) ? parseFloat(weight.replace(',', '.')) : null,
            height: (height && !isNaN(parseInt(height))) ? parseInt(height) : null,
            sex: sex || '',
            age: (age && !isNaN(parseInt(age))) ? parseInt(age) : null,
            assigned_personal_id: currentUser.id,
            personal_name: currentUser.name || '',
            status: 'active',
            payment_status: 'paid',
            last_payment_date: new Date().toISOString(),
            plan_expiry: PaymentHelper.calculateNextDueDate(cycle),
            payment_cycle: cycle,
            role: 'student',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        UI.showLoading('Salvando aluno...');
        try {
            const student = await db.create('profiles', studentData);

            // Sync with alunos_planos (Marketplace mapping)
            if (planId) {
                const days = selectedPlan ? (selectedPlan.duracao_dias || 30) : 30;
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + days);

                await db.create('alunos_planos', {
                    aluno_id: student.id,
                    personal_id: currentUser.id,
                    plano_id: planId,
                    data_inicio: new Date().toISOString(),
                    data_proxima_cobranca: expiryDate.toISOString(),
                    status: 'ativo',
                    updated_at: new Date().toISOString()
                });
            }
            UI.hideLoading();
            UI.showNotification('Sucesso!', 'Aluno cadastrado com sucesso', 'success');

            // Ask if want to send credentials
            UI.confirmDialog(
                'Enviar Credenciais',
                `Deseja enviar as credenciais de acesso para ${name} via WhatsApp ? `,
                () => {
                    const loginUrl = window.location.origin + window.location.pathname;
                    WhatsApp.sendCredentials(phone, name, email, password, loginUrl);
                }
            );

            router.navigate('/personal/students');
        } catch (error) {
            UI.hideLoading();
            console.error('Erro ao cadastrar aluno:', error);
        }
    });
};

// Payment Management Functions
window.markAsPaid = (studentId) => {
    const student = db.getById('profiles', studentId);
    if (!student) return;

    UI.confirmDialog(
        'Confirmar Pagamento',
        `Você confirma que o aluno ${student.name} realizou o pagamento ? `,
        async () => {
            UI.showLoading('Salvando...');
            // If there's a pending payment record, approve it
            const pendingPayments = db.query('payments', p => p.user_id === studentId && p.status === 'paid_waiting_approval');
            if (pendingPayments.length > 0) {
                await PaymentHelper.approvePayment(pendingPayments[0].id);
            } else {
                // Otherwise update student directly
                const cycle = student.payment_cycle || 'Mensal';
                await db.update('profiles', studentId, {
                    payment_status: 'paid',
                    status: 'active',
                    waitingApproval: false,
                    plan_expiry: PaymentHelper.calculateNextDueDate(cycle)
                });

                // Update Marketplace Sync
                const personal = auth.getCurrentUser();
                const relations = db.query('alunos_planos', ap => ap.aluno_id === studentId && ap.personal_id === personal.id);
                if (relations.length > 0) {
                    const rel = relations[0];
                    await db.update('alunos_planos', rel.id, {
                        status: 'ativo',
                        data_proxima_cobranca: PaymentHelper.calculateNextDueDate(cycle),
                        updated_at: new Date().toISOString()
                    });

                    // Record Manual Payment for Financeiro Extract
                    const plan = db.getById('planos_personal', rel.plano_id);
                    await db.create('pagamentos', {
                        aluno_id: studentId,
                        personal_id: personal.id,
                        plano_id: rel.plano_id,
                        mercado_pago_id: 'MANUAL_' + Date.now(),
                        valor: plan ? plan.preco : 0,
                        taxa_mercado_pago: 0,
                        valor_liquido: plan ? plan.preco : 0,
                        data_pagamento: new Date().toISOString(),
                        status: 'aprovado'
                    });
                }

            }
            UI.hideLoading();
            UI.showNotification('Sucesso', 'Pagamento registrado!', 'success');
            router.navigate('/personal/dashboard'); // Refresh
        }
    );
};

window.markAsPending = (studentId) => {
    const student = db.getById('profiles', studentId);
    if (!student) return;

    UI.confirmDialog(
        'Marcar como Pendente',
        `Deseja marcar o acesso de ${student.name} como pendente ? `,
        async () => {
            UI.showLoading('Salvando...');
            await db.update('profiles', studentId, {
                payment_status: 'pending',
                waitingApproval: false
            });
            UI.hideLoading();
            UI.showNotification('Ok', 'Status alterado para pendente.', 'info');
            router.navigate('/personal/dashboard'); // Refresh
        }
    );
};

// Edit Student
window.editStudent = (id) => {
    const student = db.getById('profiles', id);
    const currentUser = auth.getCurrentUser();
    const plans = db.query('planos_personal', p => p.personal_id === currentUser.id);
    if (!student) return;

    const modalContent = `
        <form id="edit-student-form">
            <div class="form-group">
                <label class="form-label">Nome Completo *</label>
                <input type="text" class="form-input" id="edit-student-name" value="${student.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-input" id="edit-student-email" value="${student.email}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Plano de Assinatura</label>
                <select class="form-select" id="edit-student-plan">
                    <option value="">Selecione um plano...</option>
                    ${plans.map(p => `<option value="${p.id}" ${student.plan_id === p.id ? 'selected' : ''}>${p.nome} - R$ ${parseFloat(p.preco).toFixed(2)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Nova Senha (deixe em branco para manter)</label>
                <input type="password" class="form-input" id="edit-student-password">
            </div>
            <div class="form-group">
                <label class="form-label">Telefone (WhatsApp)</label>
                <input type="tel" class="form-input" id="edit-student-phone" value="${student.phone || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Objetivo</label>
                <select class="form-select" id="edit-student-goal">
                    <option value="">Selecione...</option>
                    <option value="Emagrecimento" ${student.goal === 'Emagrecimento' ? 'selected' : ''}>Emagrecimento</option>
                    <option value="Ganho de Massa" ${student.goal === 'Ganho de Massa' ? 'selected' : ''}>Ganho de Massa Muscular</option>
                    <option value="Condicionamento" ${student.goal === 'Condicionamento' ? 'selected' : ''}>Condicionamento Físico</option>
                    <option value="Saúde" ${student.goal === 'Saúde' ? 'selected' : ''}>Saúde e Bem-estar</option>
                </select>
            </div>
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label">Sexo Biológico *</label>
                    <select class="form-select" id="edit-student-sex" required>
                        <option value="male" ${student.sex === 'male' ? 'selected' : ''}>Masculino</option>
                        <option value="female" ${student.sex === 'female' ? 'selected' : ''}>Feminino</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Idade *</label>
                    <input type="number" class="form-input" id="edit-student-age" value="${student.age || ''}" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="edit-student-status">
                    <option value="active" ${student.status === 'active' ? 'selected' : ''}>Ativo</option>
                    <option value="inactive" ${student.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                </select>
            </div>
        </form>
    `;

    UI.showModal('Editar Aluno', modalContent, async () => {
        const updateData = {
            name: document.getElementById('edit-student-name').value,
            email: document.getElementById('edit-student-email').value,
            phone: document.getElementById('edit-student-phone').value,
            plan_id: document.getElementById('edit-student-plan').value,
            goal: document.getElementById('edit-student-goal').value,
            sex: document.getElementById('edit-student-sex').value,
            age: parseInt(document.getElementById('edit-student-age').value),
            status: document.getElementById('edit-student-status').value
        };

        const newPassword = document.getElementById('edit-student-password').value;
        if (newPassword) {
            updateData.password = newPassword;
        }

        UI.showLoading('Salvando alterações...');
        await db.update('profiles', id, updateData);
        UI.hideLoading();
        UI.showNotification('Sucesso!', 'Aluno atualizado com sucesso', 'success');
        router.navigate('/personal/students');
    });
};

// Delete Student
window.deleteStudent = (id) => {
    const student = db.getById('profiles', id);
    const name = student ? student.name : 'Aluno';
    UI.confirmDialog(
        'Confirmar Exclusão',
        `Tem certeza que deseja excluir o aluno "${name}" ? Esta ação não pode ser desfeita.`,
        async () => {
            UI.showLoading('Excluindo...');
            await db.delete('profiles', id);
            UI.hideLoading();
            UI.showNotification('Sucesso!', 'Aluno excluído com sucesso', 'success');
            router.navigate('/personal/students');
        }
    );
};

// Send Credentials to Student
window.sendCredentialsToStudent = (id) => {
    const student = db.getById('profiles', id);
    if (!student || !student.phone) {
        UI.showNotification('Erro', 'Telefone não cadastrado', 'error');
        return;
    }

    const loginUrl = window.location.origin + window.location.pathname;
    WhatsApp.sendCredentials(student.phone, student.name, student.email, student.password, loginUrl);
    UI.showNotification('Sucesso!', 'WhatsApp aberto para enviar credenciais', 'success');
};

// View Student Details
window.viewStudentDetails = (id) => {
    const currentUser = auth.getCurrentUser();
    const student = db.getById('profiles', id);
    if (!student) return;

    const studentWorkouts = db.query('workouts', w => w && w.student_id == student.id);
    const completions = db.query('workout_completions', c => c && c.student_id == student.id);
    const paymentStatus = PaymentHelper.getPaymentStatus(student);

    const modalContent = `
        <div class="flex flex-col gap-md">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-weight-600 mb-xs">${student.name}</h3>
                    <p class="text-muted">${student.email}</p>
                    ${student.phone ? `<p class="text-muted">${student.phone}</p>` : ''}
                </div>
                <div class="text-right">
                    <div class="badge ${student.status === 'active' ? 'badge-success' : 'badge-danger'} mb-xs">
                        ${student.status === 'active' ? 'Ativo' : 'Inativo'}
                    </div>
                </div>
            </div>

            <div class="grid grid-2 gap-md">
                <div class="card p-sm bg-light">
                    <div class="text-sm text-muted">Objetivo</div>
                    <div class="font-weight-600">${student.goal || '-'}</div>
                </div>
                <div class="card p-sm bg-light">
                    <div class="text-sm text-muted">Pagamento</div>
                    <div class="flex items-center gap-xs">
                        <span class="badge ${paymentStatus === 'paid' ? 'badge-success' :
            paymentStatus === 'due_soon' ? 'badge-warning' :
                'badge-danger'
        }">
                            ${student.payment_status === 'paid' ? 'Em dia' :
            paymentStatus === 'overdue' ? 'Atrasado' : 'Vencendo'
        }
                        </span>
                    </div>
                </div>
                <div class="card p-sm bg-light">
                    <div class="text-sm text-muted">Peso</div>
                    <div class="font-weight-600">${student.weight ? student.weight + ' kg' : '-'}</div>
                </div>
                <div class="card p-sm bg-light">
                    <div class="text-sm text-muted">Altura</div>
                    <div class="font-weight-600">${student.height ? student.height + ' cm' : '-'}</div>
                </div>
            </div>

            <div class="stats-row flex justify-between text-center p-md bg-white rounded border">
                <div>
                    <div class="text-xl font-weight-bold text-primary">${studentWorkouts.length}</div>
                    <div class="text-xs text-muted">Treinos</div>
                </div>
                <div>
                    <div class="text-xl font-weight-bold text-success">${completions.length}</div>
                    <div class="text-xs text-muted">Concluídos</div>
                </div>
                <div>
                    <div class="text-xl font-weight-bold text-warning">${PaymentHelper.checkStudentAccess(student).daysOverdue || 0}</div>
                    <div class="text-xs text-muted">Dias Atraso</div>
                </div>
            </div>

            <div class="flex flex-col gap-sm mt-md">
                <button class="btn btn-primary w-full py-md" onclick="window.showSessionWorkoutPicker('${student.id}'), UI.closeModal()" style="font-size: 1.1rem; background: var(--secondary); border-color: var(--secondary);">
                    🏋️ Iniciar Aula Presencial
                </button>
                
                ${student.phone ? `
                    <button class="btn btn-success w-full" onclick="WhatsApp.contactStudent('${student.phone}', '${currentUser.name}')">
                        💬 Conversar no WhatsApp
                    </button>
                    <button class="btn btn-outline w-full" onclick="sendCredentialsToStudent('${student.id}')">
                        🔑 Reenviar Acesso
                    </button>
                ` : '<div class="alert alert-warning">Telefone não cadastrado</div>'}
                
                <div class="grid grid-3 gap-sm">
                    <button class="btn btn-primary" onclick="createWorkoutForStudent('${student.id}'), UI.closeModal()" title="Treinos">
                        💪 Treinos
                    </button>
                    <button class="btn btn-secondary" onclick="createDietForStudent('${student.id}'), UI.closeModal()" title="Dieta">
                        🥗 Dieta
                    </button>
                    <button class="btn btn-outline" onclick="window.viewStudentAssessments('${student.id}'), UI.closeModal()" title="Avaliação">
                        📊 Avaliação
                    </button>
                </div>
            </div>
        </div >
    `;

    UI.showModal('Detalhes do Aluno', modalContent);
};

// --- In-person Session Logic ---
window.showSessionWorkoutPicker = (studentId) => {
    const student = db.getById('profiles', studentId);
    if (!student) return;

    const workouts = db.query('workouts', w => w && w.student_id == student.id);

    if (workouts.length === 0) {
        UI.confirmDialog(
            'Nenhum Treino Encontrado',
            `O aluno ${student.name} ainda não possui treinos cadastrados.Deseja criar um agora ? `,
            () => router.navigate('/personal/workouts', { studentId })
        );
        return;
    }

    if (workouts.length === 1) {
        // Only one workout, start it directly
        window.startWorkoutWithMotivation(workouts[0].id, studentId);
        return;
    }

    // Multiple workouts, show selection modal
    const pickerHtml = `
        <div class="flex flex-col gap-md py-md">
            <p class="text-muted">Selecione o treino para a aula com <strong>${student.name}</strong>:</p>
            <div class="grid grid-1 gap-sm">
                ${workouts.map(w => `
                    <button class="card p-md hover-border-primary text-left bg-white" 
                            onclick="UI.closeModal(); window.startWorkoutWithMotivation('${w.id}', '${studentId}')">
                        <div class="flex justify-between items-center">
                            <div>
                                <h4 class="mb-xs">${w.name}</h4>
                                <p class="text-sm text-muted mb-0">${w.exercises.length} exercícios • ${w.duration} min</p>
                            </div>
                            <span class="text-xl">➔</span>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div >
        `;

    UI.showModal('Escolha o Treino', pickerHtml);
};

// Global helper for quick IA generation
window.generateWithIA = (studentId) => {
    UI.closeModal();
    UI.confirmDialog(
        'Criar Conteúdo',
        'O que você deseja gerenciar agora?',
        () => router.navigate(`/personal/workouts?studentId=${studentId}`),
        '💪 Treino',
        () => router.navigate(`/personal/nutrition?studentId=${studentId}`),
        '🥗 Dieta'
    );
};

// Create Workout for Student
window.createWorkoutForStudent = (studentId) => {
    router.navigate('/personal/workouts', { studentId });
};

// Create Diet for Student
window.createDietForStudent = (studentId) => {
    router.navigate('/personal/nutrition', { studentId });
};

// Personal Settings Modal
window.showPersonalSettingsModal = async () => {
    const user = auth.getCurrentUser();

    UI.showLoading('Carregando configurações...');
    const config = await window.loadPaymentConfig(user.id) || {};
    UI.hideLoading();

    const modalContent = `
        <form id="personal-settings-form">
            <div class="tabs mb-md">
                <button type="button" class="tab-btn active" onclick="UI.switchTab('settings-profile')">Perfil</button>
                <button type="button" class="tab-btn" onclick="UI.switchTab('settings-payment-mp-v2')">Mercado Pago PRO</button>
            </div>

            <div id="settings-profile" class="tab-content">
                <div class="form-group">
                    <label class="form-label">Nome Profissional</label>
                    <input type="text" class="form-input" id="set-name" value="${user.name || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Telefone / WhatsApp</label>
                    <input type="text" class="form-input" id="set-phone" value="${user.phone || ''}" placeholder="Ex: 5511999999999">
                </div>
            </div>
            
            <div id="settings-payment-mp-v2" class="tab-content hidden">
                <div class="alert alert-success mb-md text-xs">
                    <strong>Mercado Pago PRO (Automático):</strong> Receba pagamentos de seus alunos via Cartão/Pix com liberação automática. 
                    Pegue suas credenciais no painel de desenvolvedor do Mercado Pago.
                </div>
                <div class="form-group">
                    <label class="form-label">Public Key</label>
                    <input type="text" class="form-input" id="set-mp-public" value="${config.public_key || ''}" placeholder="APP_USR-...">
                </div>
                <div class="form-group">
                    <label class="form-label">Access Token</label>
                    <input type="password" class="form-input" id="set-mp-token" placeholder="${config.status_config === 'active' ? '******** (Token já salvo)' : 'Seu Access Token'}">
                    <p class="text-xs text-muted mt-xs">O token é encriptado antes de ser salvo.</p>
                </div>
                
                ${config.status_config === 'active' ? `
                    <div class="flex gap-sm mt-md">
                        <button type="button" class="btn btn-ghost btn-sm flex-1" onclick="window.testMPConnection('${user.id}')">
                            🔌 Testar Conexão
                        </button>
                    </div>
                ` : ''}
            </div>

            <div class="mt-xl pt-lg" style="border-top: 1px solid var(--border);">
                <button type="button" class="btn btn-danger btn-sm btn-block" onclick="UI.closeModal(); window.requestAccountDeletion();">
                    🗑️ Excluir Minha Conta
                </button>
                <p class="text-xs text-muted text-center mt-xs">Esta ação é irreversível</p>
            </div>
        </form>
    `;

    UI.showModal('Minhas Configurações', modalContent, async () => {
        const name = document.getElementById('set-name').value;
        const phone = document.getElementById('set-phone').value;
        const pixKey = document.getElementById('set-pix').value;
        const personalPaymentLink = document.getElementById('set-payment-link').value;

        const mpAccessToken = document.getElementById('set-mp-token').value;
        const mpPublicKey = document.getElementById('set-mp-public').value;

        if (!name) return UI.showNotification('Erro', 'O nome é obrigatório', 'error');

        UI.showLoading('Salvando configurações...');

        try {
            // 1. Update profile + legacy payment fields
            await db.update('profiles', user.id, {
                name,
                phone,
                pix_key: pixKey,
                personal_payment_link: personalPaymentLink
            });

            // 2. Save MP V2 Credentials if provided
            if (mpPublicKey) { // Only attempt to save if public key is provided
                const configToSave = {
                    user_id: user.id,
                    public_key: mpPublicKey
                };

                // Only include access_token if it's not the placeholder
                if (mpAccessToken && mpAccessToken !== '********') {
                    configToSave.access_token = mpAccessToken;
                }

                UI.showLoading('Salvando Mercado Pago...');
                await window.savePaymentConfig(configToSave);
                UI.hideLoading();
            }

            auth.refreshUser();
            UI.hideLoading();
            UI.showNotification('Sucesso', 'Configurações salvas!', 'success');
            router.navigate('/personal/dashboard');
        } catch (err) {
            UI.hideLoading();
            console.error('Erro ao salvar config personal:', err);
            UI.showNotification('Erro', 'Falha ao salvar configurações.', 'error');
        }
    });
};

// ============================================
// PERSONAL - SUBSCRIPTION MANAGEMENT
// ============================================
router.addRoute('/personal/subscription', () => {
    if (!auth.requireAuth('personal')) return;

    const currentUser = auth.getCurrentUser();
    // Get official platform plans + free trial if not used
    const plans = db.query('plans', p => p.target_audience === 'personal');
    const admin = db.getById('admins', 'ad000000-1111-2222-3333-444455556666');

    // Status logic
    const accessCheck = PaymentHelper.checkStudentAccess(currentUser);
    const isTrial = accessCheck.status === 'trial';
    const isGrace = accessCheck.status === 'grace_period';
    const isBlocked = accessCheck.status === 'blocked';
    const isActive = accessCheck.status === 'active';

    const expiryDateStr = currentUser.data_vencimento || currentUser.plan_expiry;
    const dueDate = expiryDateStr ? new Date(expiryDateStr) : null;

    // Find current plan
    const planId = currentUser.plan_id || currentUser.planId || 'plano_personal_mensal';
    const currentPlan = db.getById('plans', planId);

    let planDisplayName = currentPlan ? currentPlan.name : 'Plano T-FIT';

    if (isTrial) {
        planDisplayName = `Teste Grátis (${accessCheck.daysLeft} dias)`;
    } else if (isBlocked && !expiryDateStr) {
        planDisplayName = 'Pendente';
    } else if (isBlocked) {
        planDisplayName += ' (Expirado)';
    }

    const badgeClass = isBlocked ? 'badge-danger' : isGrace ? 'badge-warning' : isTrial ? 'badge-warning' : 'badge-success';
    const badgeText = isBlocked ? 'EXPIRADO/BLOQUEADO' : isGrace ? 'VENCIDO/PENDENTE' : isTrial ? 'TESTE GRÁTIS' : 'ASSINANTE PRO';

    const content = `
        <div class="page-header">
            <h1 class="page-title">Assinatura T-FIT 💳</h1>
            <p class="page-subtitle">Escolha seu plano e ative seu acesso PRO</p>
        </div >

        <div class="card mb-xl border-primary" style="border-width: 2px;">
            <div class="card-body">
                <div class="flex justify-between items-start mb-md">
                    <div>
                        <p class="text-xs text-muted mb-xs uppercase letter-spacing-1">Sua Assinatura Atual</p>
                        <h3 class="mb-0 text-primary" style="font-size: 1.5rem;">${planDisplayName}</h3>
                    </div>
                    <span class="badge ${badgeClass}">${badgeText}</span>
                </div>

                <div class="flex flex-col md:flex-row gap-md items-center justify-between p-sm bg-light rounded" style="background: rgba(255,255,255,0.05);">
                    <div>
                        <p class="text-xs text-muted mb-xs">Próximo Vencimento</p>
                        <div class="font-weight-bold">
                            ${dueDate ? dueDate.toLocaleDateString('pt-BR') : 'A definir'}
                        </div>
                    </div>
                    ${isActive ? `
                        <button class="btn btn-primary btn-sm" onclick="window.startCheckout('${currentPlan ? currentPlan.price : '99.90'}', '${currentPlan ? currentPlan.name : 'Plano'}', '${planId}', null, 'mensalidade_tfit')">
                            💳 Renovar Assinatura
                        </button>
                    ` : `
                        <button class="btn btn-primary" onclick="document.getElementById('plans-grid').scrollIntoView({behavior: 'smooth'})">
                            🚀 Ativar Acesso Completo
                        </button>
                    `}
                </div>
            </div>
        </div>

        ${!isActive ? `
        <h2 class="section-title mb-lg" id="plans-grid">Planos Disponíveis</h2>

        <div class="grid grid-2 gap-md" id="plans-grid">
            ${plans.filter(p => p.id !== (currentPlan ? currentPlan.id : '')).map(plan => `
                <div class="card p-xl border-hover transition-all">
                    <div class="text-center mb-lg">
                        <h3 class="card-title">${plan.name}</h3>
                        <div class="stat-value text-primary" style="font-size: 2.5rem;">R$ ${parseFloat(plan.price || 0).toFixed(2)}</div>
                        <div class="text-muted text-sm">${plan.billing_cycle || 'Mensal'}</div>
                    </div>
                    <ul class="mb-xl text-left" style="min-height: 120px;">
                        ${(plan.features || []).map(f => `<li class="mb-xs">✅ ${f}</li>`).join('')}
                    </ul>
                    <button class="btn btn-outline btn-block" 
                            onclick="${plan.id === 'trial_free' ? `window.activatePersonalTrial('${plan.id}')` : `window.startPersonalCheckout('${plan.id}')`}">
                        Assinar Este Plano
                    </button>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="card mt-xl p-md bg-light">
            <p class="text-center text-xs text-muted mb-0">
                Precisa de ajuda com o pagamento? <a href="#" onclick="window.WhatsApp.sendMessage('5511911917087', 'Quero assinar o T-FIT Personal')">Fale com o suporte</a>
            </p>
        </div>
`;

    UI.renderDashboard(content, 'personal');
});

window.cancelPersonalSubscription = () => {
    UI.showNotification('Aviso', 'O sistema de pagamentos está sendo atualizado.', 'info');
};

// Start Personal Checkout (Mercado Pago)
window.startPersonalCheckout = (planId) => {
    // Force refresh
    if (typeof db !== 'undefined' && db.loadFromLocalStorage) {
        db.loadFromLocalStorage();
    }

    const plan = db.getById('plans', planId);
    if (!plan) {
        UI.showNotification('Erro', 'Plano não encontrado. Tente atualizar a página.', 'error');
        return;
    }

    // Admin info for Pix (Global T-FIT)
    const admin = db.getById('admins', 'ad000000-1111-2222-3333-444455556666') || {};
    const pixKey = admin.pix_key || 'thaysfittcont@gmail.com';

    // Links config
    const mpLink = plan.billing_cycle === 'Anual' ?
        (admin.mpAnualLink || 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...') :
        (admin.mpMensalLink || 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...');

    const modalContent = `
    <style>
        .premium-checkout { padding: 10px; }
        .checkout-header { text-align: center; margin-bottom: 25px; }
        .checkout-amount {
            font-size: 3rem; font-weight: 800; color: var(--primary);
            text-shadow: 0 0 20px rgba(220, 38, 38, 0.2); margin-bottom: 5px;
            letter-spacing: -1px;
        }
        .checkout-subtitle { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); }
        .checkout-card {
            background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px; padding: 20px; transition: all 0.3s ease;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); margin-bottom: 15px;
        }
        .checkout-card:hover { border-color: rgba(220, 38, 38, 0.3); transform: translateY(-2px); }
        .checkout-method-badge { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
        .checkout-method-badge span { font-weight: 600; font-size: 0.9rem; color: var(--text-secondary); }
        .checkout-copy-box {
            background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px; padding: 10px 15px; display: flex;
            justify-content: space-between; align-items: center; margin-bottom: 15px;
        }
        .checkout-key-text {
            font-family: monospace; font-size: 0.85rem; color: var(--primary-light);
            font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;
        }
        .checkout-divider { position: relative; text-align: center; margin: 20px 0; }
        .checkout-divider span {
            background: #0f172a; padding: 0 15px; color: var(--text-muted);
            font-size: 0.75rem; font-weight: 600; position: relative; z-index: 1;
        }
        .checkout-divider::after {
            content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px;
            background: rgba(255, 255, 255, 0.1);
        }
        .checkout-proof-box {
            border: 2px dashed rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.02);
            border-radius: 16px; padding: 20px;
        }
        .checkout-btn-mp {
            background: linear-gradient(90deg, #009EE3 0%, #007EB5 100%); color: white!important;
            font-weight: 700!important; box-shadow: 0 4px 15px rgba(0, 158, 227, 0.3);
        }
    </style>

    <div class="premium-checkout">
        <div class="checkout-header">
            <div class="checkout-amount font-black" style="font-size: 2rem;">R$ ${parseFloat(plan.price || 0).toFixed(2).replace('.', ',')}</div>
            <div class="checkout-subtitle">${plan.name}</div>
            <div class="text-xs uppercase tracking-widest text-muted mt-xs" style="opacity: 0.6;">PLATAFORMA T-FIT</div>
        </div>

        <div class="flex flex-col gap-lg">
            <!-- MERCADO PAGO PREMIUM CARD -->
            <div class="checkout-card mp-premium-card">
                <div class="flex justify-between items-center mb-lg">
                    <img src="https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo-0.png" alt="MP" style="height: 24px;">
                    <span class="badge badge-primary">PAGAMENTO SEGURO</span>
                </div>

                <div class="mb-xl text-center">
                    <p class="text-sm text-muted mb-sm">Acesso Liberado Imediatamente</p>
                    <button class="btn-mp-pro w-full" onclick="window.startCheckout(${plan.price}, '${plan.name}', '${plan.id}', '', 'mensalidade_tfit')">
                        ASSINAR COM CARTÃO DE CRÉDITO
                    </button>
                </div>

                <div class="flex flex-col gap-sm">
                    <div class="flex justify-center gap-md opacity-50 grayscale hover:grayscale-0 transition-all">
                        <img src="https://logodownload.org/wp-content/uploads/2014/10/visa-logo-1.png" style="height: 14px;">
                        <img src="https://logodownload.org/wp-content/uploads/2014/07/mastercard-logo-7.png" style="height: 14px;">
                        <img src="https://logodownload.org/wp-content/uploads/2014/09/elo-logo-0.png" style="height: 14px;">
                        <img src="https://logodownload.org/wp-content/uploads/2016/10/hipercard-logo-0.png" style="height: 14px;">
                    </div>
                    <p class="text-center text-xs text-muted mt-md">Cobrança única de R$ ${parseFloat(plan.price || 0).toFixed(2).replace('.', ',')} com renovação automática.</p>
                </div>
            </div>

            <style>
                .mp-premium-card {
                    background: linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
                    border: 1px solid rgba(0, 158, 227, 0.4) !important;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.3) !important;
                }
                .btn-mp-pro {
                    background: #009EE3;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 18px;
                    font-weight: 800;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(0, 158, 227, 0.3);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .btn-mp-pro:hover {
                    background: #0081bb;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0, 158, 227, 0.5);
                }
            </style>

            <button class="btn btn-ghost btn-sm mt-md" onclick="UI.closeModal()" style="opacity: 0.5; font-size: 0.75rem; width: 100%;">
                FECHAR SEM CONTRATAR
            </button>
        </div>
    </div>
`;

    UI.showModal('Finalizar Pagamento', modalContent);
};

window.confirmPixPayment = (planId) => {
    const user = auth.getCurrentUser();
    UI.confirmDialog('Confirmar Envio', 'Após o pagamento, envie o comprovante pelo WhatsApp para liberação imediata. Deseja continuar?', () => {
        window.WhatsApp.sendMessage('5511911917087', `Olá, acabei de pagar o plano ${planId} via PIX para o email ${user.email}. Segue o comprovante: `);
        UI.closeModal();
    });
};

// --- Hiring Request Handling ---
window.approveHiringRequest = (studentId) => {
    const student = db.getById('profiles', studentId);
    if (!student) return;

    db.update('profiles', studentId, {
        status: 'pending_payment',
        updated_at: new Date().toISOString()
    });

    // Notify student
    db.create('notifications', {
        user_id: studentId,
        title: 'Pedido Aprovado! ✅',
        message: `Seu personal aprovou seu pedido.Agora você pode realizar o pagamento.`,
        type: 'hiring_approved',
        created_at: new Date().toISOString(),
        read: false
    });

    UI.showNotification('Sucesso', 'Pedido aprovado com sucesso!', 'success');
    router.refresh();
};

window.rejectHiringRequest = (studentId) => {
    UI.confirmDialog('Recusar Pedido', 'Tem certeza que deseja recusar este pedido de contratação?', () => {
        const student = db.getById('profiles', studentId);
        if (!student) return;

        // Reset student state
        db.update('profiles', studentId, {
            assigned_personal_id: null,
            personal_name: null,
            plan_id: null,
            status: 'active'
        });

        // Notify student
        db.create('notifications', {
            user_id: studentId,
            title: 'Pedido Recusado ❌',
            message: `Desculpe, seu personal não pôde aceitar seu pedido no momento.`,
            type: 'hiring_rejected',
            created_at: new Date().toISOString(),
            read: false
        });

        UI.showNotification('Aviso', 'Pedido recusado.', 'info');
        router.refresh();
    });
};
// --- Plan Management Functions ---
window.showCreatePlanModal = () => {
    const currentUser = auth.getCurrentUser();
    const modalContent = `
        <form id="create-plan-form" class="flex flex-col gap-md">
            <div class="form-group">
                <label class="form-label">Nome do Plano</label>
                <input type="text" class="form-input" id="plan-name" placeholder="Ex: Consultoria Mensal" required>
            </div>
            <div class="form-group">
                <label class="form-label">Preço (R$)</label>
                <input type="number" step="0.01" class="form-input" id="plan-price" placeholder="Ex: 149.90" required>
            </div>
            <div class="grid grid-2 gap-md">
                <div class="form-group">
                    <label class="form-label">Periodicidade</label>
                    <select class="form-input" id="plan-cycle">
                        <option value="Mensal">Mensal</option>
                        <option value="Trimestral">Trimestral</option>
                        <option value="Semestral">Semestral</option>
                        <option value="Anual">Anual</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Duração (Dias)</label>
                    <input type="number" class="form-input" id="plan-days" value="30" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Descrição / O que inclui</label>
                <textarea type="text" class="form-input" id="plan-desc" rows="3" placeholder="Ex: Planilhas semanais, Suporte via WhatsApp..."></textarea>
            </div>
        </form>
    `;

    UI.showModal('Criar Novo Plano', modalContent, async () => {
        const name = document.getElementById('plan-name').value;
        const price = parseFloat(document.getElementById('plan-price').value);
        const billing_cycle = document.getElementById('plan-cycle').value;
        const duration_days = parseInt(document.getElementById('plan-days').value);
        const description = document.getElementById('plan-desc').value;

        if (!name || isNaN(price)) {
            UI.showNotification('Erro', 'Preencha os campos obrigatórios.', 'error');
            return;
        }

        UI.showLoading('Criando plano...');
        try {
            await db.create('plans', {
                name,
                price,
                billing_cycle,
                duration_days,
                description,
                created_by: currentUser.id,
                target_audience: 'student',
                active: true
            });
            UI.hideLoading();
            UI.showNotification('Sucesso', 'Plano criado com sucesso!', 'success');
            router.navigate('/personal/plans');
        } catch (error) {
            UI.hideLoading();
            console.error('Erro ao criar plano:', error);
            UI.showNotification('Erro', 'Falha ao criar plano.', 'error');
        }
    });
};

window.showEditPlanModal = (planId) => {
    const plan = db.getById('plans', planId);
    if (!plan) return;

    const modalContent = `
        <form id="edit-plan-form" class="flex flex-col gap-md">
            <div class="form-group">
                <label class="form-label">Nome do Plano</label>
                <input type="text" class="form-input" id="plan-name" value="${plan.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Preço (R$)</label>
                <input type="number" step="0.01" class="form-input" id="plan-price" value="${plan.price}" required>
            </div>
            <div class="grid grid-2 gap-md">
                <div class="form-group">
                    <label class="form-label">Periodicidade</label>
                    <select class="form-input" id="plan-cycle">
                        <option value="Mensal" ${plan.billing_cycle === 'Mensal' ? 'selected' : ''}>Mensal</option>
                        <option value="Trimestral" ${plan.billing_cycle === 'Trimestral' ? 'selected' : ''}>Trimestral</option>
                        <option value="Semestral" ${plan.billing_cycle === 'Semestral' ? 'selected' : ''}>Semestral</option>
                        <option value="Anual" ${plan.billing_cycle === 'Anual' ? 'selected' : ''}>Anual</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Duração (Dias)</label>
                    <input type="number" class="form-input" id="plan-days" value="${plan.duration_days}" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Descrição</label>
                <textarea class="form-input" id="plan-desc" rows="3">${plan.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="flex items-center gap-sm cursor-pointer">
                    <input type="checkbox" id="plan-active" ${plan.active !== false ? 'checked' : ''}>
                    <span>Plano Ativo (Aparece para alunos)</span>
                </label>
            </div>
        </form>
    `;

    UI.showModal('Editar Plano', modalContent, async () => {
        const name = document.getElementById('plan-name').value;
        const price = parseFloat(document.getElementById('plan-price').value);
        const billing_cycle = document.getElementById('plan-cycle').value;
        const duration_days = parseInt(document.getElementById('plan-days').value);
        const description = document.getElementById('plan-desc').value;
        const active = document.getElementById('plan-active').checked;

        UI.showLoading('Salvando alterações...');
        try {
            await db.update('plans', planId, {
                name,
                price,
                billing_cycle,
                duration_days,
                description,
                active
            });
            UI.hideLoading();
            UI.showNotification('Sucesso', 'Plano atualizado!', 'success');
            router.navigate('/personal/plans');
        } catch (error) {
            UI.hideLoading();
        }
    });
};

window.deletePlan = (planId) => {
    UI.confirmDialog(
        'Excluir Plano',
        'Tem certeza que deseja excluir este plano? Alunos atuais não serão afetados, mas novos não poderão contratar.',
        async () => {
            UI.showLoading('Excluindo...');
            await db.delete('plans', planId);
            UI.hideLoading();
            router.navigate('/personal/plans');
        }
    );
};
window.viewStudentAssessments = (studentId) => {
    const student = db.getById('profiles', studentId);
    if (!student) return;

    const assessments = db.query('assessments', a => a.student_id === studentId)
        .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

    const content = `
        <div class="p-md">
            <h3 class="mb-md">Histórico de Avaliações: ${student.name}</h3>
            <div class="grid grid-1 gap-sm">
                ${assessments.length > 0 ? assessments.map(a => `
                    <div class="card p-md hover-scale pointer" onclick="window.viewAssessmentDetailsPersonal('${a.id}')">
                        <div class="flex justify-between items-center">
                            <div>
                                <h4 class="mb-xs">Avaliação ${new Date(a.created_at || a.date).toLocaleDateString()}</h4>
                                <div class="text-xs text-muted">Peso: ${a.weight}kg • BF: ${a.body_fat_percentage || a.bf || 'N/A'}%</div>
                            </div>
                            <span class="badge ${a.is_ai_generated ? 'badge-primary' : 'badge-outline'}">${a.is_ai_generated ? 'IA' : 'Manual'}</span>
                        </div>
                    </div>
                `).join('') : '<p class="text-center text-muted">Nenhuma avaliação encontrada.</p>'}
            </div>
            <div class="mt-lg">
                 <button class="btn btn-ghost btn-block" onclick="window.viewStudentDetails('${studentId}')">← Voltar aos Detalhes</button>
            </div>
        </div>
    `;

    UI.showModal('Avaliações Físicas', content);
};

window.viewAssessmentDetailsPersonal = (id) => {
    const a = db.getById('assessments', id);
    if (!a) return;

    const strengths = a.strengths ? (typeof a.strengths === 'string' ? JSON.parse(a.strengths) : a.strengths) : [];
    const improvements = a.improvements ? (typeof a.improvements === 'string' ? JSON.parse(a.improvements) : a.improvements) : [];

    const modalContent = `
        <div class="assessment-details p-md">
            <div class="flex justify-between items-center mb-lg">
                <h3 class="font-bold text-xl">${new Date(a.created_at || a.date).toLocaleDateString()}</h3>
                <span class="badge badge-primary">BF Estimado: ${a.body_fat_percentage || a.bf || 'N/A'}%</span>
            </div>

            <div class="photos-preview-strip mb-lg" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;">
                ${a.photos && a.photos.length > 0 ? a.photos.map(p => `<img src="${p}" style="height: 180px; border-radius: 12px; border: 1px solid var(--border);">`).join('') : `
                    ${a.photo_front ? `<img src="${a.photo_front}" style="height: 180px; border-radius: 12px; border: 1px solid var(--border);">` : ''}
                    ${a.photo_side_right ? `<img src="${a.photo_side_right}" style="height: 180px; border-radius: 12px; border: 1px solid var(--border);">` : ''}
                    ${a.photo_side_left ? `<img src="${a.photo_side_left}" style="height: 180px; border-radius: 12px; border: 1px solid var(--border);">` : ''}
                `}
            </div>

            <div class="analysis-section mb-lg">
                <h4 class="text-primary font-bold mb-xs">🧠 Análise da T-FIT IA</h4>
                <div class="p-md bg-light rounded-lg leading-relaxed text-sm">
                    ${a.ai_analysis || 'Sem análise disponível.'}
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

            <div class="recommendations-section">
                <h4 class="text-accent font-bold mb-xs">🚀 Recomendações Profissionais (IA)</h4>
                <div class="p-md bg-accent-light rounded-xl leading-relaxed text-sm" style="border-left: 4px solid var(--secondary);">
                    ${a.recommendations || 'Sem recomendações.'}
                </div>
            </div>
            
            <div class="mt-lg">
                 <button class="btn btn-ghost btn-block" onclick="window.viewStudentAssessments('${a.student_id}')">← Voltar ao Histórico</button>
            </div>
        </div>
    `;

    UI.showModal('Resultado da Avaliação IA', modalContent);
};
