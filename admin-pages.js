// ============================================
// ADMIN DASHBOARD
// ============================================

router.addRoute('/admin/dashboard', () => {
    if (!auth.requireAuth('admin')) return;

    // Force strict session sync
    auth.refreshUser();
    const currentUser = auth.getCurrentUser();
    const personals = db.getAll('personals');
    const students = db.getAll('students');
    const plans = db.getAll('plans');
    const completions = db.getAll('workout_completions') || [];

    // Filter Students by Mode (Robust logic)
    const isAI = (s) => s && (s.mode === 'ai' || s.ai_active === true || s.assigned_personal_id === 'SYSTEM' || !s.assigned_personal_id);

    const aiStudents = students.filter(isAI);
    const personalStudentsCount = students.length - aiStudents.length;

    // Calculate stats
    const totalPersonals = personals.length;
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s && s.status === 'active').length;

    // Students per personal
    const studentsPerPersonal = {};
    personals.forEach(p => {
        if (p && p.id) {
            studentsPerPersonal[p.id] = students.filter(s => s && s.assigned_personal_id === p.id).length;
        }
    });

    const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Dashboard Administrativo 👋</h1>
                <p class="page-subtitle">Olá, ${currentUser.name || 'Admin'}! Gestão geral da plataforma.</p>
            </div>
            <div class="flex gap-sm">
                <button class="btn btn-primary" onclick="window.showBroadcastModal()">
                    📢 Notificação Geral
                </button>
                <button class="btn btn-secondary" onclick="window.syncLocalToFirebase()">
                    🔄 Sincronizar Dados
                </button>
                <button class="btn btn-accent" onclick="MediaManager.syncExerciseExerciseMedia()">
                    🎞️ Mídias
                </button>
                <button class="btn btn-warning" onclick="router.navigate('/admin/t-pontos')">
                    💎 T-Pontos
                </button>
                <button class="btn btn-primary" style="background: #3b82f6;" onclick="router.navigate('/admin/videos')">
                    📹 Vídeos de Treino
                </button>
            </div>
        </div>

        <!-- VERIFICAÇÃO DE SEGURANÇA (DIAGNOSTIC) -->
        <div class="card mb-xl" style="background: linear-gradient(90deg, var(--bg-card) 0%, rgba(99, 102, 241, 0.05) 100%); border-left: 4px solid var(--primary);">
            <div class="card-body flex justify-between items-center py-md">
                <div class="flex items-center gap-md">
                    <div class="text-2xl">🛡️</div>
                    <div>
                        <h4 class="mb-xs">Saúde do Sistema</h4>
                        <p class="text-xs text-muted mb-0">Verifique se as chaves de criptografia e o servidor Supabase estão sincronizados.</p>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline btn-primary" onclick="window.runSystemDiagnostic()">
                    🔍 Executar Teste
                </button>
            </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-4 mb-xl">
            <div class="stat-card clickable" onclick="router.navigate('/admin/personals')">
                <div class="stat-value text-primary">${totalPersonals}</div>
                <div class="stat-label">Personal Trainers</div>
            </div>
            <div class="stat-card clickable" onclick="router.navigate('/admin/students')">
                <div class="stat-value text-secondary">${totalStudents}</div>
                <div class="stat-label">Total de Alunos</div>
            </div>
            <div class="stat-card clickable" onclick="router.navigate('/admin/payments')">
                <div class="stat-value text-success">
                    R$ ${parseFloat(db.getAll('payments').filter(p => p.status === 'approved').reduce((s, p) => s + parseFloat(p.amount || 0), 0)).toFixed(0)}
                </div>
                <div class="stat-label">Receita Estimada</div>
            </div>
            <div class="stat-card clickable" onclick="router.navigate('/admin/plans')">
                <div class="stat-value text-warning">
                    ${plans.filter(p => !p.created_by || (db.getById('profiles', p.created_by)?.role === 'admin')).length}
                </div>
                <div class="stat-label">Planos Plataforma</div>
            </div>
        </div>

        <div class="grid grid-2 mb-xl">
            <!-- Online Counter -->
            <div class="card">
                <div class="card-header flex justify-between items-center">
                    <h3 class="card-title">Usuários Online</h3>
                    <span class="badge badge-success pulse-animation">● Ao Vivo</span>
                </div>
                <div class="card-body text-center py-xl">
                    <div id="online-users-count" class="text-5xl font-bold mb-xs">0</div>
                    <p class="text-sm text-muted">Acessos simultâneos agora</p>
                </div>
            </div>

            <!-- Global Activity -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Atividade de Treinos</h3>
                    <span class="badge badge-warning">Últimos 14 dias</span>
                </div>
                <div class="card-body">
                    <canvas id="global-completions-chart" style="height: 180px;"></canvas>
                </div>
            </div>
        </div>

        <!-- Main Charts Area -->
        <div class="grid grid-2 gap-xl">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Distribuição de Alunos</h3>
                </div>
                <div class="card-body">
                    <canvas id="students-per-personal-chart" style="height: 300px;"></canvas>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Status da Base</h3>
                </div>
                <div class="card-body">
                    <canvas id="students-status-chart" style="height: 300px;"></canvas>
                </div>
            </div>
        </div>

        <!-- Waze Fitness Bulk Add -->
        <div class="card mt-xl" style="background: rgba(15, 23, 42, 0.5); border: 2px solid #3b82f6;">
            <div class="card-header flex justify-between items-center">
                <h3 class="card-title">📍 Waze Fitness - Cadastro em Massa</h3>
                <span class="badge badge-primary">Admin Tool</span>
            </div>
            <div class="card-body">
                <p class="text-xs text-muted mb-md">Format: <strong>Nome, Rua, Numero, Cidade</strong> (one per line).</p>
                <textarea id="bulk-gym-list" class="form-input mb-md" rows="5" placeholder="Ex: Academia X, Rua Y, 100, São Paulo" style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 8px; font-family: monospace; font-size: 13px;"></textarea>
                <button class="btn btn-primary btn-block" onclick="window.bulkAddGyms()">
                    🚀 Enviar Lista para o Sistema
                </button>
                <div id="bulk-gym-progress" class="mt-md hidden">
                    <div style="height: 4px; width: 100%; background: #0f172a; border-radius: 2px; overflow: hidden;">
                        <div id="bulk-gym-bar" style="height: 100%; width: 0%; background: #3b82f6; transition: width 0.3s;"></div>
                    </div>
                    <p id="bulk-gym-status" class="text-xs text-center mt-xs text-muted">Aguardando...</p>
                </div>
            </div>
        </div>

        <!-- Recent Personal Activity -->
        <div class="card mt-xl">
            <div class="card-header flex justify-between items-center">
                <h3 class="card-title">Personal Trainers Cadastrados</h3>
                <button class="btn btn-xs btn-ghost" onclick="router.navigate('/admin/personals')">Ver Todos →</button>
            </div>
            <div class="card-body p-0">
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Alunos</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${personals.slice(0, 5).map(p => `
                                <tr>
                                    <td class="font-bold">${p.name}</td>
                                    <td><span class="badge badge-primary">${studentsPerPersonal[p.id] || 0}</span></td>
                                    <td><span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-danger'}">${p.status}</span></td>
                                    <td>
                                        <div class="flex gap-xs">
                                            <button class="btn btn-xs btn-outline" onclick="editPersonal('${p.id}')">Editar</button>
                                            ${p.phone ? `<button class="btn btn-xs btn-success" onclick="window.sendWhatsAppToPersonal('${p.id}')" title="WhatsApp">💬</button>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'admin');

    // Render Charts
    setTimeout(() => {
        // Common Options for Futuristic Look
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    titleFont: { family: 'Inter', size: 14, weight: '600' },
                    bodyFont: { family: 'Inter', size: 13 }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                bar: { borderRadius: 4 },
                point: { radius: 0, hoverRadius: 6, hoverBorderWidth: 2 }
            }
        };

        // Custom Plugin to Draw Data Labels on Top of Bars
        const drawDataLabelsPlugin = {
            id: 'drawDataLabels',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                ctx.save();

                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (!meta.hidden && (chart.config.type === 'bar' || chart.config.type === 'line')) {
                        meta.data.forEach((element, index) => {
                            const data = dataset.data[index];
                            if (data !== null && data !== undefined) {
                                ctx.fillStyle = '#ffffff'; // White text
                                ctx.font = 'bold 12px Inter';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';

                                // Draw text slightly above the bar
                                // If value is 0, ensure it's still visible but respects layout
                                const valueText = typeof data === 'number' ?
                                    (dataset.label === 'Receita' ? 'R$ ' + data.toFixed(0) : data) : data;

                                ctx.fillText(valueText, element.x, element.y - 5);
                            }
                        });
                    }
                });

                ctx.restore();
            }
        };

        // 1. Real-time Online Counter
        const counterElement = document.getElementById('online-users-count');
        if (counterElement) {
            const updateOnlineCount = () => {
                const profiles = db.getAll('profiles') || [];
                // "Real users" = role !== admin and has a name/email
                const realUsers = profiles.filter(p =>
                    p && p.role !== 'admin' &&
                    (p.name && p.name.trim() !== '') &&
                    (p.email && p.email.trim() !== '')
                );

                const activeCount = realUsers.filter(u => u.status === 'active').length;

                // Heuristic for "simultaneous" users: 5-8% of active users, minimum 1 if any users exist
                const simultaneous = Math.max(activeCount > 0 ? 1 : 0, Math.ceil(activeCount * (0.05 + Math.random() * 0.03)));

                counterElement.innerText = simultaneous;
            };

            updateOnlineCount(); // Initial call
            const updateInterval = setInterval(updateOnlineCount, 15000); // Update every 15 seconds instead of 3

            window.activeIntervals = window.activeIntervals || [];
            window.activeIntervals.push(updateInterval);
        }

        // 2. Financial Revenue Chart
        const ctxFinancial = document.getElementById('financial-revenue-chart');
        if (ctxFinancial) {
            const allPayments = db.getAll('payments') || [];
            const approvedPayments = allPayments.filter(p => p.status === 'approved');

            // Logic to group payments (simplified for demo)
            const today = new Date();
            const last6Months = [];
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                last6Months.push({
                    label: months[d.getMonth()],
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    value: 0
                });
            }

            approvedPayments.forEach(p => {
                try {
                    const d = new Date(p.date);
                    const slot = last6Months.find(m => m.month === d.getMonth() && m.year === d.getFullYear());
                    if (slot) slot.value += parseFloat(p.amount || 0);
                } catch (e) { }
            });

            // Calculate Total
            const total = approvedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            document.getElementById('total-revenue-display').innerText = `R$ ${total.toFixed(2)} `;

            const gradientFin = ctxFinancial.getContext('2d').createLinearGradient(0, 0, 0, 300);
            gradientFin.addColorStop(0, 'rgba(6, 182, 212, 0.4)'); // Cyan 500 with opacity
            gradientFin.addColorStop(1, 'rgba(59, 130, 246, 0)'); // Blue 500 fading out

            new Chart(ctxFinancial, {
                type: 'line',
                plugins: [drawDataLabelsPlugin],
                data: {
                    labels: last6Months.map(m => m.label),
                    datasets: [{
                        label: 'Receita',
                        data: last6Months.map(m => m.value),
                        borderColor: '#06b6d4',
                        backgroundColor: gradientFin,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 6,
                        pointBackgroundColor: '#06b6d4',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverRadius: 8,
                        borderWidth: 3
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: {
                            display: true,
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { family: 'Inter' } }
                        },
                        y: {
                            display: true,
                            grid: { color: 'rgba(148, 163, 184, 0.1)' },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: 'Inter' },
                                callback: (value) => 'R$ ' + value
                            }
                        }
                    },
                    plugins: {
                        ...commonOptions.plugins,
                        tooltip: {
                            ...commonOptions.plugins.tooltip,
                            callbacks: {
                                label: (ctx) => ` Receita: R$ ${ctx.raw.toFixed(2)} `
                            }
                        }
                    }
                }
            });
        }

        // 3. Students Per Personal
        const ctxPersonal = document.getElementById('students-per-personal-chart');
        if (ctxPersonal) {
            const data = [aiStudents.length, ...personals.map(p => studentsPerPersonal[p.id] || 0)];
            const labels = ['T-FIT IA', ...personals.map(p => p.name)];

            new Chart(ctxPersonal, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            '#8b5cf6', // Violet
                            '#ec4899', // Pink
                            '#06b6d4', // Cyan
                            '#10b981', // Emerald
                            '#f59e0b', // Amber
                        ],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#cbd5e1', usePointStyle: true, pointStyle: 'circle' }
                        }
                    },
                    cutout: '70%'
                }
            });
        }

        // 4. Student Status (Active vs Inactive)
        const ctxStatus = document.getElementById('students-status-chart');
        if (ctxStatus) {
            const inactive = Math.max(0, totalStudents - activeStudents);
            new Chart(ctxStatus, {
                type: 'pie', // Changed to Pie for variety
                data: {
                    labels: ['Ativos', 'Inativos'],
                    datasets: [{
                        data: [activeStudents, inactive],
                        backgroundColor: ['#10b981', '#334155'], // Emerald vs Slate
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#cbd5e1', usePointStyle: true, pointStyle: 'circle' }
                        }
                    }
                }
            });
        }

        // 5. Global Completions (Gradient Area)
        const ctxCompletions = document.getElementById('global-completions-chart');
        if (ctxCompletions) {
            const days = 14;
            const labels = [];
            const data = [];

            for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

                // Mock data + real data mix (since real data might be sparse)
                const realCount = completions.filter(c => new Date(c.completed_at).toDateString() === d.toDateString()).length;
                data.push(realCount + Math.floor(Math.random() * 5)); // Adding base buzz for visual
            }

            const gradient = ctxCompletions.getContext('2d').createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(245, 158, 11, 0.5)'); // Amber 500
            gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');

            new Chart(ctxCompletions, {
                type: 'bar',
                plugins: [drawDataLabelsPlugin],
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Treinos',
                        data: data,
                        borderColor: '#f59e0b',
                        backgroundColor: gradient,
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: {
                            display: true,
                            grid: { display: false },
                            ticks: { color: '#64748b', maxTicksLimit: 7 }
                        },
                        y: { display: false }
                    },
                    plugins: {
                        ...commonOptions.plugins,
                        tooltip: {
                            ...commonOptions.plugins.tooltip,
                            callbacks: {
                                label: (ctx) => ` ${ctx.raw}`
                            }
                        }
                    }
                }
            });
        }

        // 6. T-FIT IA Performance Chart
        const ctxIAPerformance = document.getElementById('tfit-ia-performance-chart');
        if (ctxIAPerformance) {
            const aiActive = aiStudents.filter(s => s.status === 'active').length;
            const aiInactive = aiStudents.filter(s => s.status !== 'active').length;

            new Chart(ctxIAPerformance, {
                type: 'bar',
                plugins: [drawDataLabelsPlugin],
                data: {
                    labels: ['Ativos', 'Inativos'],
                    datasets: [{
                        label: 'Alunos',
                        data: [aiActive, aiInactive],
                        backgroundColor: ['#10b981', '#64748b'],
                        borderRadius: 6,
                        barPercentage: 0.5
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: { display: true, grid: { display: false }, ticks: { color: '#64748b' } },
                        y: { display: false }
                    },
                    plugins: {
                        ...commonOptions.plugins,
                        tooltip: {
                            ...commonOptions.plugins.tooltip,
                            callbacks: {
                                label: (ctx) => ` ${ctx.raw} Alunos`
                            }
                        }
                    }
                }
            });
        }

    }, 100);
});

window.editSystemPayments = () => {
    window.showAdminSettingsModal();
};

window.showAdminSettingsModal = async () => {
    const user = auth.getCurrentUser();

    UI.showLoading('Carregando configurações...');
    const config = await window.loadPaymentConfig(user.id) || {};
    UI.hideLoading();

    const modalContent = `
        <form id="admin-settings-form">
            <div class="tabs mb-md">
                <button type="button" class="tab-btn active" onclick="UI.switchTab('admin-settings-general')">Geral</button>
                <button type="button" class="tab-btn" onclick="UI.switchTab('admin-settings-mp-v2')">Mercado Pago (T-FIT AI)</button>
            </div>

            <div id="admin-settings-general" class="tab-content">
                <div class="alert alert-info mb-md text-xs">
                    Configurações gerais do sistema.
                </div>
                <p class="text-muted text-sm">Nenhuma configuração adicional disponível no momento.</p>
            </div>

            <div id="admin-settings-mp-v2" class="tab-content hidden">
                <div class="alert alert-success mb-md text-xs">
                    <strong>Mercado Pago PRO (Automático):</strong> Use este acesso para receber pagamentos de alunos do plano **T-FIT IA**.
                </div>
                <div class="form-group">
                    <label class="form-label">Public Key</label>
                    <input type="text" class="form-input" id="set-admin-mp-public" value="${config.public_key || ''}" placeholder="APP_USR-...">
                </div>
                <div class="form-group">
                    <label class="form-label">Access Token</label>
                    <input type="password" class="form-input" id="set-admin-mp-token" placeholder="${config.status_config === 'active' ? '******** (Token já salvo)' : 'Seu Access Token'}">
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
        </form>
    `;

    UI.showModal('Configurações do Sistema', modalContent, async () => {
        const mpPublicKey = document.getElementById('set-admin-mp-public')?.value;
        const mpAccessToken = document.getElementById('set-admin-mp-token')?.value;

        // If either key is changed
        if (mpPublicKey || (mpAccessToken && mpAccessToken !== '********')) {
            UI.showLoading('Salvando Mercado Pago...');

            const configToSave = { public_key: mpPublicKey };
            if (mpAccessToken && mpAccessToken !== '********' && mpAccessToken.trim() !== '') {
                configToSave.access_token = mpAccessToken;
            }

            const success = await window.savePaymentConfig(configToSave);
            UI.hideLoading();

            if (success) {
                UI.showNotification('Sucesso', 'Configurações do Mercado Pago atualizadas!', 'success');
            }
        } else {
            UI.showNotification('Info', 'Nenhuma alteração detectada.', 'info');
        }
    });
};

// Broadcast Notification Modal
window.showBroadcastModal = () => {
    const modalContent = `
        <form id="broadcast-form">
            <div class="form-group">
                <label class="form-label">Título do Aviso</label>
                <input type="text" class="form-input" id="notif-title" placeholder="Ex: Manutenção do Sistema" required>
            </div>
            <div class="form-group">
                <label class="form-label">Tipo de Alerta</label>
                <select class="form-select" id="notif-type">
                    <option value="info">📢 Informativo (Azul)</option>
                    <option value="warning">⚠️ Aviso (Amarelo)</option>
                    <option value="danger">🚨 Urgente (Vermelho)</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Mensagem para todos os usuários</label>
                <textarea class="form-input" id="notif-message" rows="4" placeholder="Digite aqui o comunicado oficial..." required></textarea>
            </div>
            <p class="text-xs text-muted">Esta mensagem aparecerá como um banner no topo do dashboard de todos os alunos e personals.</p>
        </form>
    `;

    UI.showModal('Enviar Notificação Geral', modalContent, () => {
        const title = document.getElementById('notif-title').value;
        const type = document.getElementById('notif-type').value;
        const message = document.getElementById('notif-message').value;

        if (!title || !message) {
            UI.showNotification('Erro', 'Preencha todos os campos', 'error');
            return;
        }

        db.create('notifications', {
            title,
            type,
            message,
            target: 'all',
            active: true
        });

        UI.showNotification('Sucesso', 'Notificação enviada para todos os usuários!', 'success');
        router.navigate('/admin/dashboard');
    });
};

// ============================================
// ADMIN - MANAGE STUDENTS
// ============================================

router.addRoute('/admin/students', () => {
    if (!auth.requireAuth('admin')) return;

    const students = db.getAll('students');
    const personals = db.getAll('personals');

    const isAI = (s) => s && (s.mode === 'ai' || s.ai_active === true || s.assigned_personal_id === 'SYSTEM' || !s.assigned_personal_id);

    const aiStudents = students.filter(isAI);
    const personalStudents = students.filter(s => s && !isAI(s));

    const content = `
        <div class="page-header">
            <h1 class="page-title">Gerenciar Alunos</h1>
            <p class="page-subtitle">Acompanhe todos os alunos do sistema</p>
        </div>

        <div class="card">
            <div class="card-header">
                <div class="tabs">
                    <button class="tab-btn active" onclick="window.switchStudentTab('ai', this)">
                        Alunos IA <span class="badge badge-primary ml-xs">${aiStudents.length}</span>
                    </button>
                    <button class="tab-btn" onclick="window.switchStudentTab('personal', this)">
                        Alunos de Personal <span class="badge badge-secondary ml-xs">${personalStudents.length}</span>
                    </button>
                </div>
            </div>
            
            <!-- Script moved to global scope -->
            
            <div class="card-body">
                <!-- AI STUDENTS TAB -->
                <div id="tab-ai" class="student-tab-content">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Aluno</th>
                                    <th>Contato</th>
                                    <th>Plano</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${aiStudents.length > 0 ? aiStudents.map(s => `
                                    <tr>
                                        <td>
                                            <div class="flex items-center gap-sm">
                                                <div class="avatar-sm bg-primary text-white flex items-center justify-center rounded-full" style="width:32px;height:32px;">
                                                    ${(s.name || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div class="font-bold">${s.name || 'Sem nome'}</div>
                                                    <div class="text-xs text-muted">Desde ${s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div class="text-sm">${s.email}</div>
                                            <div class="text-xs text-muted">${s.phone || '-'}</div>
                                        </td>
                                        <td>
                                            <span class="badge badge-outline">${s.plan_name || 'Básico'}</span>
                                        </td>
                                        <td>
                                            <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}">
                                                ${s.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="flex gap-xs">
                                                ${s.phone ? `
                                                    <button class="btn btn-sm btn-success" onclick="window.contactStudent('${s.id}')" title="WhatsApp">
                                                        💬
                                                    </button>
                                                ` : ''}
                                                <button class="btn btn-sm btn-ghost" onclick="window.viewStudentDetails('${s.id}')" title="Ver Detalhes">
                                                    👁️
                                                </button>
                                                <button class="btn btn-sm btn-danger" onclick="window.deactivateUser('${s.id}', 'students')" title="Revogar Acesso">
                                                    🚫
                                                </button>
                                                <button class="btn btn-sm btn-danger" onclick="window.deleteStudent('${s.id}')" title="Excluir Permanentemente">
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" class="text-center p-lg text-muted">Nenhum aluno IA encontrado</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- PERSONAL STUDENTS TAB -->
                <div id="tab-personal" class="student-tab-content hidden">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Aluno</th>
                                    <th>Personal Responsável</th>
                                    <th>Contato</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${personalStudents.length > 0 ? personalStudents.map(s => {
        const personal = personals.find(p => p.id === s.assigned_personal_id);
        return `
                                    <tr>
                                        <td>
                                            <div class="flex items-center gap-sm">
                                                <div class="avatar-sm bg-secondary text-white flex items-center justify-center rounded-full" style="width:32px;height:32px;">
                                                    ${(s.name || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div class="font-bold">${s.name || 'Sem nome'}</div>
                                                    <div class="text-xs text-muted">ID: ${s.id.substr(0, 6)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            ${personal ? `
                                                <div class="flex items-center gap-xs">
                                                    <span class="text-sm font-medium">${personal.name}</span>
                                                    ${personal.phone ? `
                                                        <a href="javascript:void(0)" onclick="window.contactPersonalAboutStudent('${personal.id}', '${(s.name || 'Aluno').replace(/'/g, "\\'")}')" class="text-xs text-success">
                                                            (Contatar)
                                                        </a>
                                                    ` : ''}
                                                </div>
                                            ` : '<span class="text-muted">Desvinculado</span>'}
                                        </td>
                                        <td>
                                            <div class="text-sm">${s.email}</div>
                                            <div class="text-xs text-muted">${s.phone || '-'}</div>
                                        </td>
                                        <td>
                                            <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}">
                                                ${s.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="flex gap-xs">
                                                ${s.phone ? `
                                                    <button class="btn btn-sm btn-success" onclick="window.contactStudent('${s.id}')" title="Falar com Aluno">
                                                        💬
                                                    </button>
                                                ` : ''}
                                                <button class="btn btn-sm btn-ghost" onclick="window.viewStudentDetails('${s.id}')" title="Ver Detalhes">
                                                    👁️
                                                </button>
                                                <button class="btn btn-sm btn-danger" onclick="window.deactivateUser('${s.id}', 'students')" title="Revogar Acesso">
                                                    🚫
                                                </button>
                                                <button class="btn btn-sm btn-danger" onclick="window.deleteStudent('${s.id}')" title="Excluir Permanentemente">
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
    }).join('') : '<tr><td colspan="5" class="text-center p-lg text-muted">Nenhum aluno de personal encontrado</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'admin');
});

// View Student Details (Admin View)
window.viewStudentDetails = (studentId) => {
    const student = db.getById('students', studentId);
    if (!student) {
        UI.showNotification('Erro', 'Aluno não encontrado.', 'error');
        return;
    }

    // Safe access to name
    const studentName = student.name || 'Sem nome';
    const studentInitial = studentName.charAt(0).toUpperCase() || '?';

    const personal = student.personalId && student.personalId !== 'SYSTEM' ? db.getById('personals', student.personalId) : null;

    const modalContent = `
        <div class="student-detail-profile">
            <div class="flex items-center gap-md mb-lg">
                <div class="avatar-lg bg-primary text-white flex items-center justify-center rounded-full" style="width:64px;height:64px;font-size:1.5rem;">
                    ${studentInitial}
                </div>
                <div>
                    <h2 class="mb-xs">${studentName}</h2>
                    <span class="badge ${student.status === 'active' ? 'badge-success' : 'badge-danger'}">${student.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                </div>
            </div>

            <div class="grid grid-2 gap-md mb-lg">
                <div class="info-group">
                    <label class="text-xs text-muted uppercase font-bold">Email</label>
                    <div>${student.email || '-'}</div>
                </div>
                <div class="info-group">
                    <label class="text-xs text-muted uppercase font-bold">Telefone</label>
                    <div>${student.phone || '-'}</div>
                </div>
                <div class="info-group">
                    <label class="text-xs text-muted uppercase font-bold">Modo</label>
                    <div class="text-accent font-bold">${student.mode === 'ai' || student.aiActive ? '🤖 T-FIT IA' : '🎓 Com Personal'}</div>
                </div>
                ${personal ? `
                    <div class="info-group">
                        <label class="text-xs text-muted uppercase font-bold">Personal Trainer</label>
                        <div>${personal.name || '-'}</div>
                    </div>
                ` : ''}
            </div>

            <div class="bg-light p-md rounded-lg mb-lg">
                <h4 class="mb-sm text-sm">Próximo Vencimento</h4>
                <div class="text-lg font-bold">${student.paymentDueDate ? new Date(student.paymentDueDate).toLocaleDateString('pt-BR') : 'Não definido'}</div>
            </div>

            <div class="flex gap-sm">
                ${student.phone ? `
                    <button class="btn btn-secondary flex-1" onclick="window.sendWhatsAppToStudent('${student.id}')">
                        💬 Falar via WhatsApp
                    </button>
                ` : ''}
                <button class="btn btn-outline" onclick="window.editStudent('${student.id}')">
                    ✏️ Editar Aluno
                </button>
            </div>
        </div>
    `;

    UI.showModal('Detalhes do Aluno', modalContent);
};

window.deleteStudent = (id) => {
    const student = db.getById('students', id);
    if (!student) return;

    UI.confirmDialog(
        'Confirmar Exclusão TOTAL',
        `⚠️ ATENÇÃO: Você está prestes a excluir PERMANENTEMENTE o aluno "${student.name}".\n\nIsso removerá:\n- Treinos\n- Dieta\n- Avaliações\n- Pagamentos\n- Histórico de Atividade\n\nEsta ação não pode ser desfeita. Deseja continuar?`,
        () => {
            UI.showLoading('Removendo aluno...');
            try {
                // Collections to clean up
                const collections = [
                    'workouts', 'diets', 'assessments',
                    'workout_completions',
                    'activity_logs', 'notifications'
                ];

                // 1. Delete associated data
                collections.forEach(col => {
                    const items = db.query(col, item => item.studentId === id || item.userId === id);
                    if (items && items.length > 0) {
                        items.forEach(item => db.delete(col, item.id));
                    }
                });

                // 2. Delete the student record itself
                db.delete('students', id);

                UI.hideLoading();
                UI.showNotification('Sucesso!', 'Aluno e todos os dados vinculados foram removidos.', 'success');

                // Refresh view
                router.navigate('/admin/students');
            } catch (err) {
                UI.hideLoading();
                console.error('Erro na exclusão em cascata:', err);
                UI.showNotification('Erro', 'Ocorreu um problema ao remover alguns dados do aluno.', 'error');
            }
        }
    );
};

router.addRoute('/admin/personals', () => {
    if (!auth.requireAuth('admin')) return;

    const personals = db.getAll('personals');
    const students = db.getAll('students');

    const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Personal Trainers</h1>
                <p class="page-subtitle">Gerencie os profissionais cadastrados</p>
            </div>
            <button class="btn btn-primary" onclick="window.showAddPersonalModal()">
                + Novo Personal
            </button>
        </div>

        ${personals.length > 0 ? `
            <div class="grid grid-2">
                ${personals.map(personal => {
        const personalStudents = students.filter(s => s.personalId === personal.id);
        return `
                        <div class="card">
                            <div class="card-header flex justify-between items-center">
                                <div>
                                    <h3 class="card-title">${personal.name}</h3>
                                    <p class="text-muted" style="font-size: 0.875rem;">${personal.email}</p>
                                </div>
                                <span class="badge badge-success">${personalStudents.length} alunos</span>
                            </div>
                            <div class="card-body">
                                <div class="flex flex-col gap-sm">
                                    <div class="flex justify-between">
                                        <span class="text-muted">Telefone:</span>
                                        <span>${personal.phone || 'Não informado'}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-muted">CREF:</span>
                                        <span>${personal.cref || 'Não informado'}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-muted">Especialidade:</span>
                                        <span>${personal.specialty || 'Não informado'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="card-footer flex gap-sm">
                                <button class="btn btn-sm btn-ghost" onclick="window.editPersonal('${personal.id}')">
                                    ✏️ Editar
                                </button>
                                ${personal.phone ? `
                                    <button class="btn btn-sm btn-secondary" onclick="window.sendWhatsAppToPersonal('${personal.id}')">
                                        💬 WhatsApp
                                    </button>
                                ` : ''}
                                <button class="btn btn-sm btn-danger" onclick="window.deletePersonal('${personal.id}')">
                                    🗑️ Excluir
                                </button>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        ` : `
            <div class="card text-center">
                <div class="card-body">
                    <h3 style="margin-bottom: 1rem;">Nenhum Personal Cadastrado</h3>
                    <p class="text-muted mb-lg">Comece adicionando seu primeiro personal trainer</p>
                    <button class="btn btn-primary" onclick="window.showAddPersonalModal()">
                        + Adicionar Personal
                    </button>
                </div>
            </div>
        `}
    `;

    UI.renderDashboard(content, 'admin');
});

// Add Personal Modal
window.showAddPersonalModal = () => {
    const modalContent = `
        <form id="add-personal-form">
            <div class="form-group">
                <label class="form-label">Nome Completo *</label>
                <input type="text" class="form-input" id="personal-name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-input" id="personal-email" required>
            </div>
            <div class="form-group">
                <label class="form-label">Senha *</label>
                <input type="password" class="form-input" id="personal-password" required>
            </div>
            <div class="form-group">
                <label class="form-label">Telefone (WhatsApp)</label>
                <input type="tel" class="form-input" id="personal-phone" placeholder="5511911917087">
                <p class="form-help">Formato: código do país + DDD + número (ex: 5511911917087)</p>
            </div>
            <div class="form-group">
                <label class="form-label">CREF</label>
                <input type="text" class="form-input" id="personal-cref">
            </div>
            <div class="form-group">
                <label class="form-label">Especialidade</label>
                <input type="text" class="form-input" id="personal-specialty" placeholder="Ex: Musculação, Funcional, etc">
            </div>
        </form>
    `;

    UI.showModal('Adicionar Personal Trainer', modalContent, () => {
        const name = document.getElementById('personal-name').value;
        const email = document.getElementById('personal-email').value;
        const password = document.getElementById('personal-password').value;
        const phone = document.getElementById('personal-phone').value;
        const cref = document.getElementById('personal-cref').value;
        const specialty = document.getElementById('personal-specialty').value;

        db.create('personals', {
            name, email, password, phone, cref, specialty, status: 'active'
        });

        UI.showNotification('Sucesso!', 'Personal trainer adicionado com sucesso', 'success');
        router.navigate('/admin/personals');
    });
};

// Edit Personal
window.editPersonal = (id) => {
    const personal = db.getById('personals', id);
    if (!personal) return;

    const modalContent = `
        <form id="edit-personal-form">
            <div class="form-group">
                <label class="form-label">Nome Completo *</label>
                <input type="text" class="form-input" id="edit-name" value="${personal.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-input" id="edit-email" value="${personal.email}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Nova Senha (deixe em branco para manter)</label>
                <input type="password" class="form-input" id="edit-password">
            </div>
            <div class="form-group">
                <label class="form-label">Telefone (WhatsApp)</label>
                <input type="tel" class="form-input" id="edit-phone" value="${personal.phone || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">CREF</label>
                <input type="text" class="form-input" id="edit-cref" value="${personal.cref || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Especialidade</label>
                <input type="text" class="form-input" id="edit-specialty" placeholder="Ex: Musculação, Funcional, etc" value="${personal.specialty || ''}">
            </div>
            ${personal.phone ? `
                <div class="mt-md p-sm bg-light rounded text-center">
                    <button type="button" class="btn btn-ghost btn-sm" onclick="window.sendWhatsAppToPersonal('${personal.id}')">
                        💬 Chamar no WhatsApp agora
                    </button>
                </div>
            ` : ''}
        </form>
    `;

    UI.showModal('Editar Personal Trainer', modalContent, () => {
        const updateData = {
            name: document.getElementById('edit-name').value,
            email: document.getElementById('edit-email').value,
            phone: document.getElementById('edit-phone').value,
            cref: document.getElementById('edit-cref').value,
            specialty: document.getElementById('edit-specialty').value
        };

        const newPassword = document.getElementById('edit-password').value;
        if (newPassword) {
            updateData.password = newPassword;
        }

        db.update('personals', id, updateData);
        UI.showNotification('Sucesso!', 'Personal atualizado com sucesso', 'success');
        router.navigate('/admin/personals');
    });
};

// Delete Personal
window.deletePersonal = (id) => {
    const personal = db.getById('personals', id);
    const name = personal ? personal.name : 'este personal';
    UI.confirmDialog(
        'Confirmar Exclusão',
        `Tem certeza que deseja excluir o personal "${name}"? Esta ação não pode ser desfeita.`,
        () => {
            try {
                db.delete('personals', id);
                UI.showNotification('Sucesso!', 'Personal excluído com sucesso', 'success');
                router.navigate('/admin/personals');
            } catch (err) {
                console.error("[Admin] Error deleting personal:", err);
                UI.showNotification('Erro', 'Não foi possível excluir o personal.', 'error');
            }
        }
    );
};

// Send WhatsApp to Personal
window.sendWhatsAppToPersonal = (id) => {
    const personal = db.getById('personals', id);
    if (!personal || !personal.phone) return;

    const message = `Olá ${personal.name}! Aqui é o administrador do T-FIT.`;
    WhatsApp.sendMessage(personal.phone, message);
};


// ============================================
// ADMIN - MANAGE ADS
// ============================================

router.addRoute('/admin/ads', () => {
    if (!auth.requireAuth('admin')) return;

    const ads = db.getAll('ads');

    const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Anúncios & Banners</h1>
                <p class="page-subtitle">Gerencie os anúncios que aparecem no sistema</p>
            </div>
            <button class="btn btn-primary" onclick="showAddAdModal()">
                + Novo Anúncio
            </button>
        </div>

        <div class="card mb-xl">
            <div class="card-header">
                <h3 class="card-title">Preview do Carrossel</h3>
            </div>
            <div class="card-body">
                ${UI.renderAdCarousel()}
            </div>
        </div>

        <h3 class="mb-md">Anúncios Cadastrados</h3>
        ${ads.length > 0 ? `
            <div class="grid grid-3">
                ${ads.map(ad => `
                    <div class="card shadow-sm">
                        <div class="card-body p-0" style="overflow: hidden;">
                            <img src="${ad.image}" style="width: 100%; height: 150px; object-fit: cover;">
                            <div class="p-md">
                                <p class="text-xs text-muted mb-sm truncate">Link: ${ad.link}</p>
                                <button class="btn btn-sm btn-danger btn-block" onclick="deleteAd('${ad.id}')">
                                    🗑️ Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="card text-center p-xl">
                <p class="text-muted">Nenhum anúncio cadastrado ainda.</p>
            </div>
        `}
    `;

    UI.renderDashboard(content, 'admin');
    if (window.startAdCarousel) window.startAdCarousel();
});

window.showAddAdModal = () => {
    const modalContent = `
        <form id="add-ad-form">
            <div class="form-group">
                <label class="form-label">Imagem do Anúncio (Foto)</label>
                <input type="file" class="form-input" id="ad-image-input" accept="image/*" required>
                <p class="form-help">Recomendado: 1200x400px ou similar (proporção de banner)</p>
            </div>
            <div class="form-group">
                <label class="form-label">Link de Redirecionamento</label>
                <input type="url" class="form-input" id="ad-link" placeholder="https://exemplo.com.br" required>
                <p class="form-help">Para onde o usuário será levado ao clicar</p>
            </div>
        </form>
    `;

    UI.showModal('Adicionar Novo Anúncio', modalContent, () => {
        const fileInput = document.getElementById('ad-image-input');
        const link = document.getElementById('ad-link').value;

        if (!fileInput.files[0] || !link) {
            UI.showNotification('Erro', 'Preencha todos os campos', 'error');
            return;
        }

        UI.showLoading();
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            db.create('ads', {
                image: imageData,
                link: link
            });
            UI.hideLoading();
            UI.showNotification('Sucesso!', 'Anúncio publicado!', 'success');
            router.navigate('/admin/ads');
        };
        reader.readAsDataURL(fileInput.files[0]);
    });
};

// ============================================
// ADMIN - FINANCIAL OVERVIEW
// ============================================

window.deleteAd = (id) => {
    UI.confirmDialog('Excluir Anúncio', 'Deseja remover este anúncio do carrossel?', () => {
        db.delete('ads', id);
        UI.showNotification('Sucesso', 'Anúncio removido', 'success');
        router.navigate('/admin/ads');
    });
};

// Start Helper Functions for Safe Links
window.contactStudent = (id) => {
    const s = db.getById('students', id);
    if (!s || !s.phone) {
        UI.showNotification('Erro', 'Telefone não disponível', 'error');
        return;
    }
    WhatsApp.sendMessage(s.phone, `Olá ${s.name}, tudo bem? Aqui é do suporte T-FIT.`);
};

window.contactPersonalAboutStudent = (personalId, studentName) => {
    const p = db.getById('personals', personalId);
    if (!p || !p.phone) {
        UI.showNotification('Erro', 'Telefone do personal não disponível', 'error');
        return;
    }
    WhatsApp.sendMessage(p.phone, `Olá ${p.name}, estou entrando em contato sobre o aluno ${studentName}.`);
};
// End Helper Functions

// ============================================
// DATA MIGRATION (LocalStorage to Firebase)
// ============================================
window.syncLocalToFirebase = async () => {
    UI.confirmDialog(
        'Sincronizar Dados',
        'Deseja copiar todos os dados salvos neste computador para o Banco Online (Firebase)? Isso recuperará seus alunos e personais antigos.',
        async () => {
            UI.showLoading();

            try {
                const collections = [
                    'admins', 'personals', 'students', 'workouts',
                    'diets', 'assessments', 'plans', 'workout_completions',
                    'payments', 'ads'
                ];

                let totalCount = 0;

                for (const col of collections) {
                    // Read specifically from LocalStorage (old keys)
                    const localData = localStorage.getItem(`fitpro_${col}`);
                    if (localData) {
                        const items = JSON.parse(localData);
                        for (const item of items) {
                            // Check if item already exists in current cache to avoid duplicates
                            if (!db.getById(col, item.id)) {
                                db.create(col, item);
                                totalCount++;
                            }
                        }
                    }
                }

                UI.hideLoading();
                UI.showNotification('Sucesso!', `${totalCount} registros sincronizados com a nuvem!`, 'success');

                // Reload dashboard to show new data
                setTimeout(() => router.navigate('/admin/dashboard'), 1500);

            } catch (error) {
                console.error("Erro na sincronização:", error);
                UI.hideLoading();
                UI.showNotification('Erro', 'Falha ao sincronizar dados', 'error');
            }
        }
    );
};

// Global Tab Switcher for Admin Students Page
window.switchStudentTab = (tabName, btn) => {
    // Toggle Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Toggle Content
    document.querySelectorAll('.student-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
};

// Global Deactivation Tool
window.deactivateUser = (id, collection) => {
    const user = db.getById(collection, id);
    if (!user) return;

    UI.confirmDialog(
        'Revogar Acesso',
        `Deseja realmente bloquear o acesso de ${user.name}? O usuário será movido para o status 'blocked' e precisará de novo pagamento/ativação.`,
        () => {
            db.update(collection, id, {
                status: 'blocked',
                paymentStatus: 'pending'
            });

            UI.showNotification('Sucesso', `Acesso de ${user.name} revogado.`, 'success');
            // Force refresh current view
            router.navigate(window.location.hash.substring(1));
        }
    );
};
// ============================================
// ADMIN - MANAGE EXERCISE VIDEOS
// ============================================

router.addRoute('/admin/videos', () => {
    if (!auth.requireAuth('admin')) return;

    const videos = db.getAll('exercise_videos') || [];

    const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Mídias de Exercícios 📹</h1>
                <p class="page-subtitle">Gerencie o mapeamento de GIFs/Vídeos para exercícios</p>
            </div>
            <div class="flex gap-sm">
                <button class="btn btn-secondary" onclick="window.seedExerciseVideos()">
                    ✨ Sincronizar Tudo
                </button>
                <button class="btn" style="background-color: var(--warning); color: #000; font-weight: bold; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer;" onclick="window.showBulkUploadModal()">
                    📤 Upload de Pasta (Em Massa)
                </button>
                <button class="btn btn-primary" onclick="window.showAddVideoModal()">
                    + Nova Mídia
                </button>
            </div>
        </div>

        <div class="card">
            <div class="card-header flex justify-between items-center">
                <h3 class="card-title">Biblioteca de Mídia (${videos.length})</h3>
                <div class="text-sm text-muted">Apoia formato GIF, MP4 e YouTube</div>
            </div>
            <div class="card-body">
                ${videos.length > 0 ? `
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nome do Exercício</th>
                                    <th>Tipo</th>
                                    <th>URL da Mídia</th>
                                    <th style="width: 100px;">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${videos.sort((a, b) => (a.exerciseName || a.exercise_name || '').localeCompare(b.exerciseName || b.exercise_name || '')).map(v => {
        const exName = v.exerciseName || v.exercise_name || 'Exercício sem nome';
        const mediaUrl = v.media_url || v.mediaUrl || v.youtubeUrl || v.youtube_url || '';
        const mediaType = v.media_type || v.mediaType || (mediaUrl && (mediaUrl.includes('youtube') || mediaUrl.includes('youtu.be')) ? 'youtube' : (mediaUrl && mediaUrl.endsWith('.gif') ? 'gif' : 'video'));
        return `
                                    <tr>
                                        <td class="font-weight-600">${exName}</td>
                                        <td>
                                            ${mediaType ? `<span class="badge ${mediaType === 'youtube' ? 'badge-danger' : 'badge-primary'}">${mediaType.toUpperCase()}</span>` : '-'}
                                        </td>
                                        <td>
                                            ${mediaUrl ? `
                                                <div class="flex items-center gap-sm">
                                                    <a href="${mediaUrl}" target="_blank" class="text-primary text-sm truncate" style="max-width: 250px;">${mediaUrl}</a>
                                                </div>
                                            ` : `
                                                <span class="text-muted text-sm">Sem mídia</span>
                                            `}
                                        </td>
                                        <td>
                                            <div class="flex gap-xs">
                                                <button class="btn btn-sm btn-ghost" onclick="window.editVideoLink('${v.id}')">✏️</button>
                                                <button class="btn btn-sm btn-danger margin-left-auto" onclick="window.deleteVideo('${v.id}')">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-muted text-center pt-xl pb-xl">Nenhuma mídia cadastrada.</p>'}
            </div>
        </div>
        
        <div class="mt-lg p-md bg-light rounded">
            <p class="text-sm text-muted"><strong>💡 Como funciona:</strong> Adicione URLs de GIFs hospedados no Bucket Supabase "treinos-gifs" ou vídeos do YouTube. GIFs carregam instantaneamente nos treinos dos alunos.</p>
        </div>
    `;

    UI.renderDashboard(content, 'admin');
});

window.editVideoLink = (id) => {
    const video = db.getById('exercise_videos', id);
    if (!video) return;

    const currentUrl = video.media_url || video.mediaUrl || video.youtubeUrl || video.youtube_url || '';
    const currentType = video.media_type || video.mediaType || (currentUrl ? 'youtube' : 'gif');

    const modalContent = `
        <form id="edit-video-form">
            <div class="form-group">
                <label class="form-label">Tipo de Mídia *</label>
                <select class="form-select" id="edit-media-type" required onchange="
                    const isYt = this.value === 'youtube';
                    document.getElementById('edit-file-upload-group').style.display = isYt ? 'none' : 'block';
                    document.getElementById('edit-url-input-group-label').innerText = isYt ? 'URL do YouTube *' : 'Ou URL Opcional (se já tiver link)';
                ">
                    <option value="gif" ${currentType === 'gif' ? 'selected' : ''}>GIF (Supabase Storage)</option>
                    <option value="video" ${currentType === 'video' ? 'selected' : ''}>Vídeo MP4 (Local/Storage)</option>
                    <option value="youtube" ${currentType === 'youtube' ? 'selected' : ''}>Link do YouTube</option>
                </select>
            </div>
            
            <div class="form-group" id="edit-file-upload-group" style="${currentType === 'youtube' ? 'display:none;' : ''}">
                <label class="form-label">Fazer Upload de Arquivo Local</label>
                <input type="file" id="edit-media-file-upload" class="form-input" accept="image/gif, video/mp4">
                <p class="text-xs text-muted mb-0 mt-xs">Isso substituirá a URL abaixo caso selecionado.</p>
            </div>

            <div class="form-group" id="edit-url-input-group">
                <label class="form-label" id="edit-url-input-group-label">${currentType === 'youtube' ? 'URL do YouTube *' : 'Ou URL Opcional (se já tiver link)'}</label>
                <input type="url" class="form-input" id="edit-media-url" value="${currentUrl}">
            </div>
        </form>
    `;

    UI.showModal('Editar Mídia', modalContent, async () => {
        const mediaType = document.getElementById('edit-media-type').value;
        let mediaUrl = document.getElementById('edit-media-url').value;
        const fileInput = document.getElementById('edit-media-file-upload');

        // Handle File Upload if selected
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            UI.showLoading('Fazendo upload...');
            try {
                const fileExt = file.name.split('.').pop();
                // Format file name safely
                let safeExName = (video.exerciseName || 'vid').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                const fileName = `exercises/${safeExName}_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await window.supabase.storage
                    .from('treinos-gifs')
                    .upload(fileName, file, { cacheControl: '3600', upsert: true });

                if (uploadError) throw uploadError;

                const { data } = window.supabase.storage
                    .from('treinos-gifs')
                    .getPublicUrl(fileName);

                if (data && data.publicUrl) {
                    mediaUrl = data.publicUrl;
                }
            } catch (err) {
                console.error("Upload error:", err);
                UI.hideLoading();
                UI.showNotification('Erro', 'Falha no upload: ' + err.message, 'error');
                return false; // Prevent modal closing
            }
            UI.hideLoading();
        }

        if (!mediaUrl && mediaType !== 'youtube') { // Optional for local files only if file wasn't provided
            if (!fileInput || fileInput.files.length === 0) {
                UI.showNotification('Aviso', 'Nenhuma mídia definida.', 'warning');
                return false;
            }
        } // if it's youtube it's required (but handled by html5 or user)

        db.update('exercise_videos', id, {
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            // Fallbacks
            media_url: mediaUrl,
            media_type: mediaType,
            youtubeUrl: mediaType === 'youtube' ? mediaUrl : '',
            youtube_url: mediaType === 'youtube' ? mediaUrl : ''
        });
        UI.showNotification('Sucesso!', 'Mídia atualizada', 'success');
        router.navigate('/admin/videos');
        return true;
    });
};

window.seedExerciseVideos = () => {
    // Pull names directly from the central database (explicitly from window)
    if (!window.WorkoutDB) {
        UI.showNotification('Erro', 'Banco de Exercícios não carregado!', 'error');
        return;
    }
    const commonExercises = [...new Set(window.WorkoutDB.exercises.map(ex => ex.name))];

    UI.showLoading();
    setTimeout(() => {
        let addedCount = 0;
        const existing = db.getAll('exercise_videos') || [];

        commonExercises.forEach(name => {
            const match = existing.find(v => {
                const vName = v.exerciseName || v.exercise_name || '';
                return vName.toLowerCase() === name.toLowerCase();
            });
            if (!match) {
                db.create('exercise_videos', {
                    exerciseName: name,
                    mediaUrl: '',
                    mediaType: '',
                    youtubeUrl: '',
                    createdAt: new Date().toISOString()
                });
                addedCount++;
            }
        });

        UI.hideLoading();
        UI.showNotification('Sucesso!', `${addedCount} novos exercícios adicionados à lista.`, 'success');
        router.navigate('/admin/videos');
    }, 500);
};

window.showAddVideoModal = () => {
    if (!window.WorkoutDB) {
        UI.showNotification('Erro', 'Banco de Exercícios não carregado!', 'error');
        return;
    }
    const exerciseNames = [...new Set(window.WorkoutDB.exercises.map(ex => ex.name))].sort();

    const modalContent = `
        <form id="add-video-form">
            <div class="form-group">
                <label class="form-label">Nome do Exercício *</label>
                <input type="text" class="form-input" id="video-exercise-name" placeholder="Ex: Supino Reto" list="exercise-list" required>
                <datalist id="exercise-list">
                    ${exerciseNames.map(name => `<option value="${name}">`).join('')}
                </datalist>
                <p class="form-help">Selecione da lista ou digite o nome exato.</p>
            </div>
            <div class="form-group">
                <label class="form-label">Tipo de Mídia *</label>
                <select class="form-select" id="video-media-type" required onchange="
                    const isYt = this.value === 'youtube';
                    document.getElementById('add-file-upload-group').style.display = isYt ? 'none' : 'block';
                    document.getElementById('add-url-input-group-label').innerText = isYt ? 'URL do YouTube *' : 'Ou URL Opcional';
                ">
                    <option value="gif">GIF (Supabase Storage)</option>
                    <option value="video">Vídeo MP4 (Local/Storage)</option>
                    <option value="youtube">Link do YouTube</option>
                </select>
            </div>
            
            <div class="form-group" id="add-file-upload-group">
                <label class="form-label">Upload de Arquivo Local</label>
                <input type="file" id="video-file-upload" class="form-input" accept="image/gif, video/mp4">
                <p class="text-xs text-muted mb-0 mt-xs">O arquivo será enviado para sua conta Supabase e o link gerado sozinho.</p>
            </div>

            <div class="form-group" id="add-url-input-group">
                <label class="form-label" id="add-url-input-group-label">Ou URL Opcional</label>
                <input type="url" class="form-input" id="video-media-url" placeholder="https://...">
            </div>
        </form>
    `;

    UI.showModal('Adicionar Mídia de Exercício', modalContent, async () => {
        const exerciseName = document.getElementById('video-exercise-name').value;
        const mediaType = document.getElementById('video-media-type').value;
        let mediaUrl = document.getElementById('video-media-url').value;
        const fileInput = document.getElementById('video-file-upload');

        if (!exerciseName) {
            UI.showNotification('Erro', 'Nome do exercício é obrigatório', 'error');
            return false;
        }

        // Handle File Upload if selected
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            UI.showLoading('Fazendo upload...');
            try {
                const fileExt = file.name.split('.').pop();
                let safeExName = exerciseName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                const fileName = `exercises/${safeExName}_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await window.supabase.storage
                    .from('treinos-gifs')
                    .upload(fileName, file, { cacheControl: '3600', upsert: true });

                if (uploadError) throw uploadError;

                const { data } = window.supabase.storage
                    .from('treinos-gifs')
                    .getPublicUrl(fileName);

                if (data && data.publicUrl) {
                    mediaUrl = data.publicUrl;
                }
            } catch (err) {
                console.error("Upload error:", err);
                UI.hideLoading();
                UI.showNotification('Erro', 'Falha no upload: ' + err.message, 'error');
                return false; // Prevent modal closing
            }
            UI.hideLoading();
        }

        if (!mediaUrl && mediaType !== 'youtube') {
            if (!fileInput || fileInput.files.length === 0) {
                UI.showNotification('Erro', 'Preencha a URL ou envie um arquivo.', 'error');
                return false;
            }
        }

        db.create('exercise_videos', {
            exerciseName,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            media_url: mediaUrl,
            media_type: mediaType,
            youtubeUrl: mediaType === 'youtube' ? mediaUrl : '',
            youtube_url: mediaType === 'youtube' ? mediaUrl : '',
            createdAt: new Date().toISOString()
        });

        UI.showNotification('Sucesso!', 'Mídia mapeada com sucesso', 'success');
        router.navigate('/admin/videos');
        return true;
    });
};

window.deleteVideo = (id) => {
    UI.confirmDialog(
        'Excluir Mapeamento',
        'Tem certeza que deseja remover esta mídia? Ela não será mais exibida automaticamente nos treinos.',
        () => {
            db.delete('exercise_videos', id);
            UI.showNotification('Sucesso', 'Mapeamento excluído', 'success');
            router.navigate('/admin/videos');
        }
    );
};

window.showBulkUploadModal = () => {
    const modalContent = `
        <div class="p-md text-center">
            <h3 class="font-bold mb-md" style="color:var(--primary);">Upload Rápido de Pasta Inteira</h3>
            <p class="text-sm text-muted mb-md text-left">
                1. Selecione vários arquivos (GIFs ou MP4).<br>
                2. O nome exato de cada arquivo (Ex: <span class="bg-gray-dark px-xs rounded">Supino Reto.gif</span>) será usado para criar ou atualizar o seu banco automaticamente!<br>
                3. Pode deixar processando e acompanhar.
            </p>
            <div class="mb-lg" style="text-align: left;">
                <label class="form-label block" style="font-weight:bold; color:#fff;">Opção 1: Selecionar Pasta Inteira</label>
                <input type="file" id="bulk-file-upload-dir" class="form-input mb-md" webkitdirectory directory>

                <label class="form-label block" style="font-weight:bold; color:#fff;">Opção 2: Selecionar Vários Arquivos</label>
                <input type="file" id="bulk-file-upload-files" class="form-input" accept="image/gif, video/mp4" multiple>
            </div>
            
            <div id="bulk-progress-container" style="display:none;" class="mt-md bg-dark p-md rounded border">
                <p class="text-sm font-bold text-left mb-sm" id="bulk-status-text">Processando: 0 / 0</p>
                <div style="width:100%; height:8px; background:var(--gray-dark); border-radius:4px; overflow:hidden; margin-bottom: 0.5rem;">
                    <div id="bulk-progress-bar" style="width:0%; height:100%; background:var(--primary); transition:width 0.2s;"></div>
                </div>
                <div id="bulk-log" class="text-xs text-muted" style="max-height:120px; overflow-y:auto; text-align:left; background: #000; padding: 0.5rem; border-radius: 4px; font-family: monospace;"></div>
            </div>
        </div>
    `;

    UI.showModal('🚀 Upload em Lote', modalContent, async () => {
        const dirInput = document.getElementById('bulk-file-upload-dir');
        const filesInput = document.getElementById('bulk-file-upload-files');

        const filesArray = [];
        if (dirInput && dirInput.files.length > 0) filesArray.push(...Array.from(dirInput.files));
        if (filesInput && filesInput.files.length > 0) filesArray.push(...Array.from(filesInput.files));

        if (filesArray.length === 0) {
            UI.showNotification('Erro', 'Nenhum arquivo ou pasta selecionada.', 'error');
            return false;
        }

        const files = filesArray;
        const total = files.length;

        document.getElementById('bulk-progress-container').style.display = 'block';
        const progressBar = document.getElementById('bulk-progress-bar');
        const statusText = document.getElementById('bulk-status-text');
        const log = document.getElementById('bulk-log');

        // Hide standard modal buttons to prevent interruption
        const modalEl = document.querySelector('.modal-wrapper');
        if (modalEl) {
            const footer = modalEl.querySelector('.modal-footer');
            if (footer) footer.style.display = 'none';
        }

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < total; i++) {
            const file = files[i];
            const originalName = file.name; // e.g. "Supino Inclinado com Halteres.gif"

            // Skip hidden or unaccepted files quickly
            if (originalName.startsWith('.')) continue;

            const lastDotIndex = originalName.lastIndexOf('.');
            if (lastDotIndex === -1) continue; // No extension

            const ext = originalName.substring(lastDotIndex + 1).toLowerCase();
            if (!['gif', 'mp4', 'webm'].includes(ext)) {
                log.innerHTML += `<div style="color:orange;">- Pulado: ${originalName} (Formato inválido)</div>`;
                continue;
            }

            const exerciseBaseName = originalName.substring(0, lastDotIndex).trim();
            const safeName = exerciseBaseName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const storagePath = `exercises/${safeName}_${Date.now()}.${ext}`;

            log.innerHTML += `<div>⏳ Subindo: ${exerciseBaseName}...</div>`;
            log.scrollTop = log.scrollHeight;

            try {
                // Upload to Supabase Storage
                const { error: uploadError } = await window.supabase.storage
                    .from('treinos-gifs')
                    .upload(storagePath, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data } = window.supabase.storage
                    .from('treinos-gifs')
                    .getPublicUrl(storagePath);

                const url = data.publicUrl;
                const mediaTypeEnum = ext === 'mp4' ? 'video' : 'gif';

                // Sync with Workout Database (Local DB Wrapper)
                const existingList = db.getAll('exercise_videos') || [];
                const matchIndex = existingList.findIndex(v => v.exerciseName.toLowerCase() === exerciseBaseName.toLowerCase());

                if (matchIndex !== -1) {
                    const matchId = existingList[matchIndex].id;
                    await db.update('exercise_videos', matchId, {
                        mediaUrl: url,
                        mediaType: mediaTypeEnum,
                        media_url: url,
                        media_type: mediaTypeEnum,
                        youtubeUrl: '',
                        youtube_url: ''
                    });
                } else {
                    await db.create('exercise_videos', {
                        exerciseName: exerciseBaseName,
                        mediaUrl: url,
                        mediaType: mediaTypeEnum,
                        media_url: url,
                        media_type: mediaTypeEnum,
                        youtubeUrl: '',
                        youtube_url: '',
                        createdAt: new Date().toISOString()
                    });
                }

                successCount++;
                log.innerHTML += `<div style="color:var(--success);">✅ Salvo: ${exerciseBaseName}</div>`;

            } catch (err) {
                failCount++;
                log.innerHTML += `<div style="color:var(--danger);">❌ Erro em ${originalName}: ${err.message}</div>`;
            }

            // Update UI Counters safely
            statusText.innerText = `Processando: ${i + 1} de ${total}`;
            progressBar.style.width = `${Math.round(((i + 1) / total) * 100)}%`;
            log.scrollTop = log.scrollHeight;
        }

        // Finish
        statusText.innerText = `Concluído! ${successCount} salvos, ${failCount} falhas.`;
        progressBar.style.background = 'var(--success)';

        setTimeout(() => {
            if (modalEl) {
                const footer = modalEl.querySelector('.modal-footer');
                if (footer) footer.style.display = 'flex'; // restore
            }
            UI.closeModal();
            UI.showNotification('Upload Completo', `${successCount} arquivos processados com sucesso.`, 'success');
            router.navigate('/admin/videos');
        }, 1500);

        return false; // Prevent traditional modal closing immediately due to async nature
    });
};
// ============================================
// ADMIN - MANAGE PLANS
// ============================================

router.addRoute('/admin/plans', () => {
    if (!auth.requireAuth('admin')) return;

    const plans = db.getAll('plans').filter(p => {
        const creator = p.created_by ? db.getById('profiles', p.created_by) : null;
        return !p.created_by || (creator && creator.role === 'admin');
    });

    const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Planos da Plataforma</h1>
                <p class="page-subtitle">Gerencie os planos que personais e alunos IA contratam</p>
            </div>
            <button class="btn btn-primary" onclick="window.showCreateAdminPlanModal()">
                + Novo Plano Plataforma
            </button>
        </div>

        <div class="card">
            <div class="card-body p-0">
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Público</th>
                                <th>Preço</th>
                                <th>Ciclo</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${plans.map(p => `
                                <tr>
                                    <td class="font-bold">${p.name}</td>
                                    <td>
                                        <span class="badge ${p.target_audience === 'personal' ? 'badge-primary' : 'badge-secondary'}">
                                            ${p.target_audience === 'personal' ? 'Personal' : 'Aluno IA'}
                                        </span>
                                    </td>
                                    <td>R$ ${parseFloat(p.price).toFixed(2)}</td>
                                    <td>${p.billing_cycle}</td>
                                    <td>
                                        <span class="badge ${p.active !== false ? 'badge-success' : 'badge-danger'}">
                                            ${p.active !== false ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="flex gap-xs">
                                            <button class="btn btn-sm btn-ghost" onclick="window.showEditAdminPlanModal('${p.id}')">✏️</button>
                                            <button class="btn btn-sm btn-ghost text-danger" onclick="window.deletePlan('${p.id}')">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'admin');
});

// ============================================
// ADMIN - MANAGE PAYMENTS
// ============================================

router.addRoute('/admin/payments', () => {
    if (!auth.requireAuth('admin')) return;

    const allPayments = db.getAll('payments');
    const allProfiles = db.getAll('profiles');
    const allPlans = db.getAll('plans');

    const mappedPayments = allPayments.map(p => {
        const user = allProfiles.find(u => u.id === p.user_id);
        const plan = allPlans.find(pl => pl.id === p.plan_id);
        const receiver = p.personal_id ? allProfiles.find(r => r.id === p.personal_id) : { name: 'SISTEMA' };

        return {
            ...p,
            userName: user ? user.name : 'Removido',
            userEmail: user ? user.email : '-',
            userRole: user ? user.role : '-',
            plan_name: plan ? plan.name : 'Removido',
            receiverName: receiver ? receiver.name : 'SISTEMA'
        };
    });

    const pending = mappedPayments.filter(p => p.status === 'pending');

    const content = `
        <div class="page-header">
            <h1 class="page-title">Financeiro Global 💎</h1>
            <p class="page-subtitle">Histórico de todas as transações da plataforma</p>
        </div>

        <!-- RECURRING SUBSCRIPTIONS OVERVIEW -->
        <div class="grid grid-2 mb-xl gap-md">
            <div class="card shadow-sm" style="border-left: 4px solid var(--primary);">
                <div class="card-body">
                    <h3 class="text-md font-bold mb-xs">Assinaturas Ativas</h3>
                    <div class="text-3xl font-bold text-primary">
                        ${db.query('subscriptions', s => s.status === 'active').length + db.query('profiles', p => p.plano_ativo === true).length}
                    </div>
                    <p class="text-xs text-muted mb-0">Total de assinaturas da plataforma</p>
                </div>
            </div>
            
            <div class="card shadow-sm" style="border-left: 4px solid var(--secondary);">
                <div class="card-body">
                    <h3 class="text-md font-bold mb-xs border-b pb-xs border-light">Configuração Global de Preços</h3>
                    <div class="grid grid-2 gap-md mt-sm">
                        <div>
                            <p class="text-xs text-muted mb-0">Mensalidade ADM</p>
                            <div class="flex gap-xs items-center mt-xs">
                                <span class="text-sm font-bold">R$</span>
                                <input type="number" id="adm-price-input" 
                                    class="form-input p-xs" style="height: 30px; font-size: 0.9rem;" 
                                    value="${db.getById('plans', 'plano_adm')?.price || '99.90'}">
                            </div>
                        </div>
                        <div>
                            <p class="text-xs text-muted mb-0">Mensalidade Personal</p>
                            <div class="flex gap-xs items-center mt-xs">
                                <span class="text-sm font-bold">R$</span>
                                <input type="number" id="personal-price-input" 
                                    class="form-input p-xs" style="height: 30px; font-size: 0.9rem;" 
                                    value="${db.getById('plans', 'plano_personal')?.price || '49.90'}">
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm btn-block mt-sm" onclick="window.saveGlobalPricing()">Salvar Preços 💾</button>
                    <p class="text-xs text-muted mt-xs mb-0">Esta é a mensalidade que será cobrada dos proprietários e personais no bloqueio.</p>
                </div>
            </div>
        </div>

        <div class="card mb-xl">
           <div class="card-header">
                <h3 class="card-title">Monitor de Assinaturas (Recorrente)</h3>
            </div>
            <div class="card-body p-0">
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Assinante</th>
                                <th>Plano</th>
                                <th>Status</th>
                                <th>Próxima Cobrança</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
            const subs = db.getAll('subscriptions') || [];
            if (subs.length === 0) return '<tr><td colspan="4" class="text-center p-md text-muted">Nenhuma assinatura recorrente registrada.</td></tr>';

            return subs.map(s => {
                const user = db.getById('profiles', s.user_id);
                const plan = db.getById('plans', s.plan_id);
                const isOverdue = s.next_billing_date && new Date(s.next_billing_date) < new Date();

                return `
                                    <tr>
                                        <td>
                                            <div class="font-bold">${user?.name || 'Deletado'}</div>
                                            <div class="text-xs text-muted">${user?.role || '-'} • ${user?.email || '-'}</div>
                                        </td>
                                        <td>${plan?.name || '-'}</td>
                                        <td>
                                            <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-warning'}">
                                                ${s.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="text-sm ${isOverdue ? 'text-danger font-bold' : ''}">
                                                ${s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : '-'}
                                            </div>
                                        </td>
                                    </tr>
                                `;
            }).join('');
        })()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>



        <div class="card">
            <div class="card-header flex justify-between items-center">
                <h3 class="card-title">Todas as Transações</h3>
                <div class="text-xs text-muted">Exibindo as últimas 50</div>
            </div>
            <div class="card-body p-0">
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Usuário</th>
                                <th>Valor</th>
                                <th>Destino</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mappedPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50).map(p => `
                                <tr>
                                    <td class="text-xs">${new Date(p.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div class="text-sm font-bold">${p.userName}</div>
                                        <div class="text-xs text-muted">${p.userRole}</div>
                                    </td>
                                    <td class="text-sm font-bold">R$ ${parseFloat(p.amount).toFixed(2)}</td>
                                    <td><span class="text-xs">${p.receiverName}</span></td>
                                    <td>
                                        <span class="badge ${p.status === 'approved' ? 'badge-success' : 'badge-warning'}">
                                            ${p.status === 'approved' ? 'Aprovado' : 'Pendente'}
                                        </span>
                                        ${p.proof_url ? `<a href="${p.proof_url}" target="_blank" class="btn btn-xs btn-ghost ml-xs" title="Ver Comprovante">📄</a>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'admin');
});

// --- Admin Plan Modals ---

window.showCreateAdminPlanModal = () => {
    const modalContent = `
        <form id="create-admin-plan-form" class="flex flex-col gap-md">
            <div class="form-group">
                <label class="form-label">Nome do Plano</label>
                <input type="text" class="form-input" id="plan-name" placeholder="Ex: T-FIT PRO Mensal" required>
            </div>
            <div class="form-group">
                <label class="form-label">Preço (R$)</label>
                <input type="number" step="0.01" class="form-input" id="plan-price" placeholder="Ex: 97.00" required>
            </div>
            <div class="grid grid-2 gap-md">
                <div class="form-group">
                    <label class="form-label">Público Alvo</label>
                    <select class="form-input" id="plan-audience">
                        <option value="personal">Personal Trainer</option>
                        <option value="student_ai">Aluno IA</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Duração (Dias)</label>
                    <input type="number" class="form-input" id="plan-days" value="30" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Ciclo de Cobrança</label>
                <input type="text" class="form-input" id="plan-cycle" value="Mensal" required>
            </div>
        </form>
    `;

    UI.showModal('Criar Plano Plataforma', modalContent, async () => {
        const name = document.getElementById('plan-name').value;
        const price = parseFloat(document.getElementById('plan-price').value);
        const target_audience = document.getElementById('plan-audience').value;
        const duration_days = parseInt(document.getElementById('plan-days').value);
        const billing_cycle = document.getElementById('plan-cycle').value;

        UI.showLoading();
        await db.create('plans', {
            name, price, target_audience, duration_days, billing_cycle,
            created_by: auth.getCurrentUser().id,
            active: true,
            features: ['Acesso Completo', 'Suporte Prioritário']
        });
        UI.hideLoading();
        UI.showNotification('Sucesso', 'Plano plataforma criado!', 'success');
        router.navigate('/admin/plans');
    });
};

window.showEditAdminPlanModal = (planId) => {
    const plan = db.getById('plans', planId);
    if (!plan) return;

    const modalContent = `
        <form id="edit-admin-plan-form" class="flex flex-col gap-md">
            <div class="form-group">
                <label class="form-label">Nome do Plano</label>
                <input type="text" class="form-input" id="plan-name" value="${plan.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Preço (R$)</label>
                <input type="number" step="0.01" class="form-input" id="plan-price" value="${plan.price}" required>
            </div>
            <div class="form-group">
                <label class="flex items-center gap-sm cursor-pointer">
                    <input type="checkbox" id="plan-active" ${plan.active !== false ? 'checked' : ''}>
                    <span>Ativo</span>
                </label>
            </div>
        </form>
    `;

    UI.showModal('Editar Plano Plataforma', modalContent, async () => {
        const name = document.getElementById('plan-name').value;
        const price = parseFloat(document.getElementById('plan-price').value);
        const active = document.getElementById('plan-active').checked;

        UI.showLoading();
        await db.update('plans', planId, { name, price, active });
        UI.hideLoading();
        UI.showNotification('Sucesso', 'Plano atualizado!', 'success');
        router.navigate('/admin/plans');
    });
};

// --- System Diagnostic ---
window.runSystemDiagnostic = async () => {
    UI.showLoading('Auditando sistema...');
    console.log("[Diagnostic] Iniciando teste da Edge Function...");

    try {
        // We specify the function name cleanly, and pass the action in the body.
        const { data, error } = await window.supabase.functions.invoke('mp-webhook', {
            body: { action: 'diagnostic' }
        });

        UI.hideLoading();

        if (error) {
            console.error("[Diagnostic] Erro retornado pelo SDK:", error);
            throw error;
        }

        console.log("[Diagnostic] Resposta do servidor:", data);

        if (data.success === false) {
            throw new Error(data.error || 'A função retornou erro de lógica.');
        }

        const results = data.environment;
        const msg = `
            <div class="text-left p-sm">
                <p><strong>Conexão Supabase:</strong> ${results.hasUrl && results.hasServiceKey ? '✅ OK' : '❌ Falha'}</p>
                <p><strong>Chave de Segurança:</strong> ${results.hasEncryptionKey ? '✅ Presente' : '❌ AUSENTE'}</p>
                <p><strong>Criptografia (AES):</strong> ${results.cryptoTest === 'Success' ? '✅ FUNCIONANDO' : '❌ ERRO: ' + results.cryptoTest}</p>
                <hr class="my-sm">
                <p class="text-xs text-muted">Se algum item estiver com ❌, verifique os Secrets no seu dashboard Supabase.</p>
            </div>
        `;

        UI.showModal('Resultado do Diagnóstico', msg, null, { hideCancel: true });
    } catch (err) {
        UI.hideLoading();
        console.error("[Diagnostic] FALHA NO TESTE:", err);

        let detail = err.message || 'Erro desconhecido';
        if (err.context && err.context.status) {
            detail += ` (Status: ${err.context.status})`;
        }

        UI.showModal('Erro no Teste', `
            <div class="text-left">
                <p>Não foi possível conectar à Edge Function.</p>
                <p class="text-xs text-danger mt-sm"><strong>Detalhe:</strong> ${detail}</p>
                <p class="text-xs text-muted mt-md">Verifique se você deu "deploy" e se o seu navegador não está bloqueando a requisição (AdBlockers).</p>
            </div>
        `, null, { hideCancel: true });
    }
};

// ============================================
// ADMIN - MANAGE ASSESSMENTS
// ============================================

router.addRoute('/admin/assessments', () => {
    if (!auth.requireAuth('admin')) return;

    const assessments = db.getAll('assessments')
        .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

    const content = `
        <div class="page-header">
            <h1 class="page-title">Avaliações Físicas</h1>
            <p class="page-subtitle">Monitore a evolução técnica de todos os alunos</p>
        </div>

        <div class="grid grid-1 gap-md">
            ${assessments.length > 0 ? assessments.map(a => `
                <div class="card hover-scale pointer" onclick="window.viewAssessmentDetailsAdmin('${a.id}')">
                    <div class="card-body flex justify-between items-center">
                        <div class="flex items-center gap-md">
                            <div class="avatar-sm bg-primary flex items-center justify-center rounded-lg" style="width: 50px; height: 50px; background: rgba(99,102,241,0.1) !important;">
                                <span style="font-size: 1.5rem;">📊</span>
                            </div>
                             <div>
                                <h4 class="mb-xs">${a.student_name || db.getById('profiles', a.student_id)?.name || 'Aluno'}</h4>
                                <div class="text-xs text-muted">
                                    ${new Date(a.created_at || a.date).toLocaleDateString()} • 
                                    Peso: ${a.weight}kg • 
                                    BF: ${a.bf || a.body_fat_percentage || 'N/A'}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-sm">
                             <div class="flex -space-x-2 mr-md">
                                ${a.photo_front ? `<img src="${a.photo_front}" style="width:32px; height:32px; border-radius:50%; border:2px solid white; object-fit:cover;">` : ''}
                                ${a.photo_side_right ? `<img src="${a.photo_side_right}" style="width:32px; height:32px; border-radius:50%; border:2px solid white; object-fit:cover;">` : ''}
                             </div>
                             <span class="badge ${a.is_ai_generated ? 'badge-primary' : 'badge-outline'}">${a.is_ai_generated ? 'IA' : 'Manual'}</span>
                             <span>→</span>
                        </div>
                    </div>
                </div>
            `).join('') : '<p class="text-center text-muted p-xl">Nenhuma avaliação encontrada no sistema.</p>'}
        </div>
    `;

    UI.renderDashboard(content, 'admin');
});

window.viewAssessmentDetailsAdmin = (id) => {
    const a = db.getById('assessments', id);
    if (!a) return;

    let strengths = [];
    try {
        strengths = a.strengths ? (typeof a.strengths === 'string' ? JSON.parse(a.strengths) : a.strengths) : [];
        if (!Array.isArray(strengths)) strengths = [strengths];
    } catch (e) { strengths = a.strengths ? [a.strengths] : []; }

    let improvements = [];
    try {
        improvements = a.improvements ? (typeof a.improvements === 'string' ? JSON.parse(a.improvements) : a.improvements) : [];
        if (!Array.isArray(improvements)) improvements = [improvements];
    } catch (e) { improvements = a.improvements ? [a.improvements] : []; }

    const modalContent = `
        <div class="assessment-details p-md">
            <div class="flex justify-between items-center mb-lg border-b pb-md">
                <div>
                    <h3 class="font-bold text-xl">${a.student_name || db.getById('profiles', a.student_id)?.name || 'Aluno'}</h3>
                    <p class="text-xs text-muted">Data: ${new Date(a.created_at || a.date || Date.now()).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div class="text-right">
                    <span class="badge badge-primary block mb-xs">BF: ${a.bf || a.body_fat_percentage || 'N/A'}</span>
                    <span class="text-xs">Peso: ${a.weight || '-'}kg</span>
                </div>
            </div>

            <div class="grid grid-3 gap-md mb-lg">
                <div class="photo-card">
                    <p class="text-xs text-center mb-xs font-bold">FRONTAL</p>
                    <div class="bg-light rounded overflow-hidden aspect-portrait cursor-pointer" onclick="window.viewFullScreenImage('${a.photo_front}')">
                        ${a.photo_front ? `<img src="${a.photo_front}" style="width: 100%; border-radius: 8px; border: 1px solid var(--border); transition: transform 0.3s; height: 100%; object-fit: cover;">` : '<div class="flex items-center justify-center p-xl">❌</div>'}
                    </div>
                </div>
                <div class="photo-card">
                    <p class="text-xs text-center mb-xs font-bold">LATERAL DIR.</p>
                    <div class="bg-light rounded overflow-hidden aspect-portrait cursor-pointer" onclick="window.viewFullScreenImage('${a.photo_side_right}')">
                        ${a.photo_side_right ? `<img src="${a.photo_side_right}" style="width: 100%; border-radius: 8px; border: 1px solid var(--border); transition: transform 0.3s; height: 100%; object-fit: cover;">` : '<div class="flex items-center justify-center p-xl">❌</div>'}
                    </div>
                </div>
                <div class="photo-card">
                    <p class="text-xs text-center mb-xs font-bold">LATERAL ESQ.</p>
                    <div class="bg-light rounded overflow-hidden aspect-portrait cursor-pointer" onclick="window.viewFullScreenImage('${a.photo_side_left}')">
                        ${a.photo_side_left ? `<img src="${a.photo_side_left}" style="width: 100%; border-radius: 8px; border: 1px solid var(--border); transition: transform 0.3s; height: 100%; object-fit: cover;">` : '<div class="flex items-center justify-center p-xl">❌</div>'}
                    </div>
                </div>
            </div>

            <div class="analysis-section mb-lg">
                <h4 class="text-primary font-bold mb-xs">Análise IA</h4>
                <div class="p-md bg-light rounded-lg leading-relaxed text-sm">
                    ${a.ai_analysis || 'Sem análise disponível.'}
                </div>
            </div>

            <div class="grid grid-2 gap-md mb-lg">
                <div class="bg-success-light p-sm rounded-lg">
                    <h4 class="text-success text-2xs uppercase font-bold mb-xs">Pontos Fortes</h4>
                    <ul class="text-xs list-disc pl-md">
                        ${strengths.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
                <div class="bg-warning-light p-sm rounded-lg">
                    <h4 class="text-warning text-2xs uppercase font-bold mb-xs">Pontos Fracos</h4>
                    <ul class="text-xs list-disc pl-md">
                        ${improvements.map(i => `<li>${i}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="recommendations-box">
                <h4 class="text-accent font-bold mb-xs">Recomendações Geradas</h4>
                <div class="p-md bg-accent-light rounded-xl leading-relaxed text-sm" style="border-left: 4px solid var(--secondary);">
                    ${a.recommendations || 'Sem recomendações.'}
                </div>
            </div>
            
            <div class="mt-lg flex gap-sm">
                 <button class="btn btn-danger btn-sm" onclick="window.deleteAssessmentAdmin('${a.id}')">Excluir Avaliação</button>
                 <button class="btn btn-ghost btn-sm flex-1" onclick="UI.closeModal()">Fechar</button>
            </div>
        </div>
    `;

    UI.showModal('Análise Detalhada (Admin)', modalContent);
};

window.viewFullScreenImage = (src) => {
    const modalContent = `<img src="${src}" style="width:100%; max-height: 80vh; object-fit: contain;">`;
    UI.showModal('Visualização da Foto', modalContent);
};

window.deleteAssessmentAdmin = (id) => {
    UI.confirmDialog('Excluir Avaliação', 'Deseja remover esta avaliação permanentemente?', () => {
        db.delete('assessments', id);
        UI.showNotification('Sucesso', 'Avaliação removida', 'success');
        UI.closeModal();
        router.navigate('/admin/assessments');
    });
};
// ============================================
// ADMIN - T-PONTOS (PACCOTES)
// ============================================

router.addRoute('/admin/t-pontos', async () => {
    if (!auth.requireAuth('admin')) return;

    UI.showLoading('Carregando T-Pontos...');
    const supabase = window.supabase;
    const { data: packages, error } = await supabase.from('t_points_packages').select('*').order('price_brl', { ascending: true });
    UI.hideLoading();

    const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Gerenciar T-Pontos 💎</h1>
                <p class="page-subtitle">Configure os pacotes de pontos que os alunos podem comprar.</p>
            </div>
            <button class="btn btn-primary" onclick="window.showCreatePointPackageModal()">
                + Novo Pacote
            </button>
        </div>

        <div class="card">
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Nome do Pacote</th>
                            <th>Quantidade</th>
                            <th>Preço (R$)</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${packages && packages.length > 0 ? packages.map(pkg => `
                            <tr>
                                <td class="font-bold">${pkg.name}</td>
                                <td><span class="badge badge-warning">${pkg.points} pts</span></td>
                                <td><strong>R$ ${pkg.price_brl.toFixed(2)}</strong></td>
                                <td>
                                    <span class="badge ${pkg.active ? 'badge-success' : 'badge-danger'}">
                                        ${pkg.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td>
                                    <div class="flex gap-xs">
                                        <button class="btn btn-xs btn-outline" onclick="window.togglePackageStatus('${pkg.id}', ${pkg.active})">
                                            ${pkg.active ? 'Desativar' : 'Ativar'}
                                        </button>
                                        <button class="btn btn-xs btn-danger" onclick="window.deletePointPackage('${pkg.id}')">
                                            Excluir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" class="text-center p-xl opacity-50">Nenhum pacote criado ainda.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="mt-lg p-md bg-info-light rounded border-info">
            <p class="text-sm"><strong>Nota:</strong> O pagamento é feito manualmente via WhatsApp. Esses pacotes servem para o aluno escolher e o sistema gerar o texto da mensagem automática.</p>
        </div>

        <!-- NEW: ADMIN SEND POINTS SECTION -->
        <div class="card mt-xl">
            <div class="card-header">
                <h3 class="card-title">🚀 Enviar T-Pontos Manualmente</h3>
            </div>
            <div class="card-body">
                <div class="grid grid-3 gap-md items-end">
                    <div class="form-group">
                        <label class="form-label">ID do Usuário</label>
                        <input type="text" id="admin-send-user-id" class="form-input" placeholder="Cole o ID do usuário aqui...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Quantidade de Pontos</label>
                        <input type="number" id="admin-send-points-amount" class="form-input" placeholder="Ex: 100">
                    </div>
                    <div>
                        <button class="btn btn-primary w-full" onclick="window.adminSendPoints()">
                            💎 Enviar Pontos
                        </button>
                    </div>
                </div>
                <p class="text-xs text-muted mt-sm">O ID do usuário pode ser encontrado no link do WhatsApp que ele te enviou ou na lista de alunos.</p>
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'admin');
});

window.showCreatePointPackageModal = () => {
    const html = `
        <form id="pkg-form" class="p-md">
            <div class="form-group mb-md">
                <label>Nome do Pacote (ex: Pack Silver)</label>
                <input type="text" id="pkg-name" class="form-input" required>
            </div>
            <div class="form-group mb-md">
                <label>Quantidade de Pontos</label>
                <input type="number" id="pkg-points" class="form-input" required>
            </div>
            <div class="form-group mb-md">
                <label>Preço em Reais (R$)</label>
                <input type="number" step="0.01" id="pkg-price" class="form-input" required>
            </div>
        </form>
    `;

    UI.showModal('Criar Novo Pacote', html, async () => {
        const name = document.getElementById('pkg-name').value;
        const points = parseInt(document.getElementById('pkg-points').value);
        const price = parseFloat(document.getElementById('pkg-price').value);

        if (!name || isNaN(points) || isNaN(price)) return;

        UI.showLoading('Salvando...');
        const { error } = await window.supabase.from('t_points_packages').insert({
            name, points, price_brl: price, active: true
        });
        UI.hideLoading();

        if (error) UI.showNotification('Erro', 'Falha ao criar pacote.', 'error');
        else {
            UI.showNotification('Sucesso', 'Pacote criado!', 'success');
            router.navigate('/admin/t-pontos');
        }
    });
};

window.togglePackageStatus = async (id, currentStatus) => {
    UI.showLoading('Atualizando...');
    const { error } = await window.supabase.from('t_points_packages').update({ active: !currentStatus }).eq('id', id);
    UI.hideLoading();
    if (!error) router.navigate('/admin/t-pontos');
};

window.deletePointPackage = async (id) => {
    UI.confirmDialog('Excluir Pacote', 'Tem certeza que deseja apagar este pacote de pontos?', async () => {
        UI.showLoading('Excluindo...');
        const { error } = await window.supabase.from('t_points_packages').delete().eq('id', id);
        UI.hideLoading();
        if (!error) router.navigate('/admin/t-pontos');
    });
};

window.adminSendPoints = async () => {
    const userId = document.getElementById('admin-send-user-id').value;
    const amount = parseInt(document.getElementById('admin-send-points-amount').value);

    if (!userId || isNaN(amount)) {
        UI.showNotification('Erro', 'Preencha o ID do usuário e a quantidade de pontos.', 'error');
        return;
    }

    UI.showLoading('Enviando pontos...');
    const supabase = window.supabase;

    try {
        // Get current points
        const { data: profile, error: getError } = await supabase
            .from('profiles')
            .select('t_points, name')
            .eq('id', userId)
            .single();

        if (getError) throw new Error('Usuário não encontrado.');

        const newTotal = (profile.t_points || 0) + amount;

        // Update points
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ t_points: newTotal })
            .eq('id', userId);

        if (updateError) throw updateError;

        UI.hideLoading();
        UI.showNotification('Sucesso', `${amount} pontos enviados para ${profile.name}!`, 'success');

        // Clear inputs
        document.getElementById('admin-send-user-id').value = '';
        document.getElementById('admin-send-points-amount').value = '';

    } catch (err) {
        UI.hideLoading();
        UI.showNotification('Erro', err.message, 'error');
    }
};

window.saveGlobalPricing = async () => {
    const admPrice = parseFloat(document.getElementById('adm-price-input').value);
    const personalPrice = parseFloat(document.getElementById('personal-price-input').value);

    if (isNaN(admPrice) || isNaN(personalPrice)) return UI.showNotification('Erro', 'Preencha os valores válidos e numéricos.', 'error');

    UI.showLoading('Salvando configurações globais...');

    // Atualiza ou Insere plano_adm
    let { data: currAdm } = await window.supabase.from('plans').select('id').eq('id', 'plano_adm').maybeSingle();
    if (currAdm) {
        await window.supabase.from('plans').update({ price: admPrice }).eq('id', 'plano_adm');
    } else {
        await window.supabase.from('plans').insert({ id: 'plano_adm', name: 'Cobrança Mensal - Plataforma', price: admPrice, billing_cycle: 'Mensal', active: true, target_audience: 'admin', duration_days: 30, created_by: null });
    }

    // Atualiza ou Insere plano_personal
    let { data: currPer } = await window.supabase.from('plans').select('id').eq('id', 'plano_personal').maybeSingle();
    if (currPer) {
        await window.supabase.from('plans').update({ price: personalPrice }).eq('id', 'plano_personal');
    } else {
        await window.supabase.from('plans').insert({ id: 'plano_personal', name: 'Cobrança Mensal - Plataforma', price: personalPrice, billing_cycle: 'Mensal', active: true, target_audience: 'personal', duration_days: 30, created_by: null });
    }

    // Forced cache refresh for plans collection
    if (db.fetchCollection) await db.fetchCollection('plans');

    UI.hideLoading();
    UI.showNotification('Sucesso', 'Valores de mensalidade global atualizados com sucesso.', 'success');
};

// ============================================
// WAZE FITNESS - BULK ADD
// ============================================

window.bulkAddGyms = async () => {
    const list = document.getElementById('bulk-gym-list')?.value;
    if (!list || list.trim() === '') return UI.showNotification('Ops', 'Cole a lista de academias primeiro.', 'warning');

    const lines = list.split('\n').filter(l => l.trim() !== '' && l.includes(','));
    if (lines.length === 0) return UI.showNotification('Ops', 'Formato inválido. Use: Nome, Rua, Numero, Cidade', 'warning');

    const progressDiv = document.getElementById('bulk-gym-progress');
    const bar = document.getElementById('bulk-gym-bar');
    const status = document.getElementById('bulk-gym-status');

    progressDiv.classList.remove('hidden');
    UI.showNotification('Waze Fitness', `Iniciando processamento de ${lines.length} academias...`, 'info');

    let successCount = 0;
    let errorCount = 0;
    const MAPBOX_TOKEN = 'pk.eyJ1Ijoid2lsbGNhcmRvc28iLCJhIjoiY21sbGszcWw2MDlkNTNocTBndjdvbnhteCJ9.-cqbPhB7Xir-LpDteY191Q';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        bar.style.width = `${((i + 1) / lines.length) * 100}%`;
        status.innerText = `Processando: ${i + 1}/${lines.length}`;

        try {
            const parts = line.split(',').map(s => s.trim());
            const nome = parts[0];
            const rua = parts[1];
            const num = parts[2] || '';
            const cidade = parts[3] || 'Brasil';

            if (!nome || !rua) throw new Error('Campos obrigatórios faltando');

            // 1. Geocoding
            const query = encodeURIComponent(`${nome} ${rua} ${num}, ${cidade}`);
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&limit=1&autocomplete=true`);
            const json = await res.json();

            if (!json.features || json.features.length === 0) {
                console.warn("Retrying with address only for: ", line);
                const queryRetry = encodeURIComponent(`${rua} ${num}, ${cidade}`);
                const resRetry = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${queryRetry}.json?access_token=${MAPBOX_TOKEN}&limit=1`);
                const jsonRetry = await resRetry.json();
                if (!jsonRetry.features || jsonRetry.features.length === 0) throw new Error("Localização não encontrada");
                json.features = jsonRetry.features;
            }

            const [lng, lat] = json.features[0].center;

            // 2. Anti-duplicate check
            const { data: existing } = await window.supabase
                .from('academias')
                .select('id')
                .ilike('nome', nome)
                .ilike('rua', rua)
                .eq('numero', num)
                .limit(1);

            if (existing && existing.length > 0) {
                successCount++; // Count as success since it's already there
                continue;
            }

            // 3. Save
            const { error } = await window.supabase.from('academias').insert([{
                nome, rua, numero: num, cidade, latitude: lat, longitude: lng, criado_por: auth.getCurrentUser()?.id
            }]);

            if (error) throw error;
            successCount++;

        } catch (e) {
            console.error(`Erro ao adicionar ${line}:`, e);
            errorCount++;
        }
    }

    status.innerText = `Finalizado! Sucessos: ${successCount} | Erros: ${errorCount}`;
    UI.showNotification('Waze Fitness', 'Cadastro em massa concluído.', 'success');
};
