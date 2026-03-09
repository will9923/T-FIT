
// ============================================
// PERSONAL - PLANS MANAGEMENT (MARKETPLACE)
// ============================================

router.addRoute('/personal/plans', () => {
    if (!auth.requireAuth('personal')) return;

    const currentUser = auth.getCurrentUser();
    // Using the new marketplace table
    const myPlans = db.query('planos_personal', p => p.personal_id === currentUser.id);

    const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">💰 Meus Planos Marketplace</h1>
                <p class="page-subtitle">Gerencie seus pacotes de consultoria pública</p>
            </div>
            <button class="btn btn-primary" onclick="window.showPersonalAddPlanModal()">
                + Novo Plano
            </button>
        </div>

        ${myPlans.length > 0 ? `
            <div class="grid grid-3">
                ${myPlans.map(plan => `
                    <div class="card plan-card">
                        <div class="card-header">
                            <h3 class="card-title">${plan.nome}</h3>
                            <div class="flex items-end gap-xs mt-sm">
                                <span class="stat-value text-primary" style="font-size: 2rem;">R$ ${parseFloat(plan.preco || 0).toFixed(2)}</span>
                                <span class="text-muted mb-xs">/${plan.duracao_meses > 1 ? plan.duracao_meses + ' meses' : 'mês'}</span>
                            </div>
                            <p class="text-muted text-xs mt-xs">${plan.duracao_dias || 30} dias de acesso</p>
                        </div>
                        <div class="card-body">
                            <p class="text-sm mb-md">${plan.descricao || ''}</p>
                            <ul class="text-sm text-muted mb-lg" style="list-style: none; padding: 0;">
                                ${(plan.beneficios || []).map(f => `<li class="mb-xs flex items-center gap-xs">
                                    <span style="color: var(--success);">✓</span>
                                    <span>${f}</span>
                                </li>`).join('')}
                            </ul>
                            <div class="flex gap-sm mt-auto pt-md border-t">
                                <button class="btn btn-block btn-outline btn-sm" onclick="window.editPersonalPlan('${plan.id}')">✏️ Editar</button>
                                <button class="btn btn-block btn-ghost btn-sm text-danger" onclick="window.deletePersonalPlan('${plan.id}', '${plan.nome}')">🗑️ Excluir</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="card text-center p-xl">
                <div class="card-body">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🛍️</div>
                    <h3>Crie seu primeiro plano de consultoria</h3>
                    <p class="text-muted mb-lg">Defina seus preços e benefícios para aparecer no Marketplace do Aluno.</p>
                    <button class="btn btn-primary" onclick="window.showPersonalAddPlanModal()">
                        Criar Plano Agora
                    </button>
                </div>
            </div>
        `}
    `;

    UI.renderDashboard(content, 'personal');
});

const BENEFITS_OPTIONS = [
    "Treinos Gerados por I.A. 🤖",
    "Dietas Personalizadas I.A. 🥗",
    "Suporte via WhatsApp 💬",
    "Suporte Prioritário 24/7 🚀",
    "Acesso ao Marketplace 🌍",
    "Análise de Evolução 📊",
    "Avaliações Ilimitadas 📝",
    "Consultoria Individual 👤",
    "Evolução em Fotos 📸",
    "Protocolos de Treino Exclusivos 🔥",
    "Videochamada Mensal 🎥",
    "Ajustes Ilimitados 🔄"
];

function getBenefitsCheckboxes(selected = []) {
    return `
        <div class="grid grid-2 gap-sm p-sm bg-light rounded" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border);">
            ${BENEFITS_OPTIONS.map((b, index) => `
                <div class="form-check">
                    <input type="checkbox" class="form-check-input benefit-checkbox" id="benefit-${index}" value="${b}" ${selected.includes(b) ? 'checked' : ''}>
                    <label class="form-check-label text-sm" for="benefit-${index}" style="cursor: pointer;">${b}</label>
                </div>
            `).join('')}
        </div>
    `;
}

// Add Plan
window.showPersonalAddPlanModal = () => {
    const modalContent = `
        <form id="plan-form">
            <div class="form-group">
                <label class="form-label">Nome do Plano *</label>
                <input type="text" class="form-input" id="plan-name" placeholder="Ex: Consultoria Premium" required>
            </div>
            <div class="form-group">
                <label class="form-label">Descrição curta</label>
                <textarea class="form-input" id="plan-desc" placeholder="O que está incluso neste plano?"></textarea>
            </div>
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label">Preço (R$) *</label>
                    <input type="number" class="form-input" id="plan-price" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Duração (Meses) *</label>
                    <input type="number" class="form-input" id="plan-months" value="1" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Duração Total (Dias)</label>
                <input type="number" class="form-input" id="plan-duration" value="30" required>
            </div>
            <div class="form-group">
                <label class="form-label mb-sm">Benefícios Inclusos (Selecione)</label>
                ${getBenefitsCheckboxes()}
            </div>
        </form>
    `;

    UI.showModal('Novo Plano Marketplace', modalContent, async () => {
        const nome = document.getElementById('plan-name').value;
        const descricao = document.getElementById('plan-desc').value;
        const preco = parseFloat(document.getElementById('plan-price').value);
        const duracao_meses = parseInt(document.getElementById('plan-months').value);
        const duracao_dias = parseInt(document.getElementById('plan-duration').value);
        const beneficios = Array.from(document.querySelectorAll('.benefit-checkbox:checked')).map(cb => cb.value);

        if (!nome || isNaN(preco)) {
            UI.showNotification('Erro', 'Nome e preço são obrigatórios', 'error');
            return false;
        }

        const currentUser = auth.getCurrentUser();
        UI.showLoading('Criando plano no marketplace...');

        try {
            await db.create('planos_personal', {
                nome,
                descricao,
                preco,
                duracao_meses,
                duracao_dias,
                beneficios,
                personal_id: currentUser.id,
                ativo: true
            });

            UI.hideLoading();
            UI.showNotification('Sucesso', 'Plano criado com sucesso!', 'success');
            router.navigate('/personal/plans');
            return true;
        } catch (error) {
            UI.hideLoading();
            console.error('Erro ao criar plano:', error);
            return false;
        }
    });
};

// Edit Plan
window.editPersonalPlan = (id) => {
    const plan = db.getById('planos_personal', id);
    if (!plan) return;

    const modalContent = `
        <form id="edit-plan-form">
            <div class="form-group">
                <label class="form-label">Nome do Plano *</label>
                <input type="text" class="form-input" id="edit-plan-name" value="${plan.nome}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Descrição</label>
                <textarea class="form-input" id="edit-plan-desc">${plan.descricao || ''}</textarea>
            </div>
            <div class="grid grid-2">
                <div class="form-group">
                    <label class="form-label">Preço (R$) *</label>
                    <input type="number" class="form-input" id="edit-plan-price" value="${plan.preco}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Duração (Meses) *</label>
                    <input type="number" class="form-input" id="edit-plan-months" value="${plan.duracao_meses || 1}" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Duração (Dias)</label>
                <input type="number" class="form-input" id="edit-plan-duration" value="${plan.duracao_dias || 30}" required>
            </div>
            <div class="form-group">
                <label class="form-label mb-sm">Benefícios Inclusos</label>
                ${getBenefitsCheckboxes(plan.beneficios || [])}
            </div>
        </form>
    `;

    UI.showModal('Editar Plano', modalContent, async () => {
        const nome = document.getElementById('edit-plan-name').value;
        const descricao = document.getElementById('edit-plan-desc').value;
        const preco = parseFloat(document.getElementById('edit-plan-price').value);
        const duracao_meses = parseInt(document.getElementById('edit-plan-months').value);
        const duracao_dias = parseInt(document.getElementById('edit-plan-duration').value);
        const beneficios = Array.from(document.querySelectorAll('.benefit-checkbox:checked')).map(cb => cb.value);

        UI.showLoading('Salvando plano...');
        try {
            await db.update('planos_personal', id, {
                nome,
                descricao,
                preco,
                duracao_meses,
                duracao_dias,
                beneficios
            });

            UI.hideLoading();
            UI.showNotification('Sucesso', 'Plano atualizado!', 'success');
            router.navigate('/personal/plans');
            return true;
        } catch (error) {
            UI.hideLoading();
            console.error('Erro ao atualizar plano:', error);
            return false;
        }
    });
};

// Delete Plan
window.deletePersonalPlan = (id, name) => {
    UI.confirmDialog(
        'Excluir Plano',
        `Tem certeza que deseja apagar o plano "${name}"?`,
        async () => {
            UI.showLoading('Removendo plano...');
            try {
                await db.delete('planos_personal', id);
                UI.hideLoading();
                UI.showNotification('Sucesso', 'Plano removido.', 'success');
                router.navigate('/personal/plans');
            } catch (error) {
                UI.hideLoading();
                console.error('Erro ao excluir plano:', error);
            }
        }
    );
};
