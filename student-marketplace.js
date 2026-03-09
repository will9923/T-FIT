
// ============================================
// STUDENT - MARKETPLACE
// ============================================

router.addRoute('/student/marketplace', async () => {
    if (!auth.requireAuth('student')) return;

    UI.showLoading('Carregando marketplace...');
    const personals = db.getAll('personais').filter(p => p.role === 'personal');
    const allStudents = db.getAll('profiles');
    UI.hideLoading();

    // Calculate ranking (based on number of active students)
    const rankedPersonals = personals.map(p => {
        const studentCount = allStudents.filter(s => s.assigned_personal_id === p.id && s.status === 'active').length;
        return { ...p, studentCount };
    }).sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));

    const top5 = rankedPersonals.slice(0, 5);

    const content = `
        <div class="page-header">
            <h1 class="page-title">Marketplace de Personals 🏋️</h1>
            <p class="page-subtitle">Escolha entre os melhores profissionais para te acompanhar</p>
        </div>

        <div class="mb-xl">
            <div class="form-group max-w-md mx-auto relative">
                <input type="text" class="form-input" id="search-personal" placeholder="🔍 Pesquisar personal por nome..." 
                       oninput="filterPersonals(this.value)" style="padding-left: 3rem; font-size: 1.1rem;">
                <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem;">🔍</span>
            </div>
        </div>

        <!-- Top 5 Ranking -->
        <h3 class="mb-lg">🔥 Em Destaque</h3>
        <div class="grid grid-5 mb-2xl" id="top5-container">
            ${top5.map((p, index) => renderPersonalCard(p, index + 1)).join('')}
        </div>

        <!-- All Personals -->
        <h3 class="mb-lg">Todos os Profissionais</h3>
        <div class="grid grid-3" id="all-personals-container">
            ${rankedPersonals.map(p => renderPersonalCard(p)).join('')}
        </div>
    `;

    UI.renderDashboard(content, 'student');
});

function renderPersonalCard(personal, rank = null) {
    const allPlans = db.getAll('planos_personal');
    const plans = allPlans.filter(p => p.personal_id === personal.id);
    const lowestPrice = plans.length > 0 ? Math.min(...plans.map(p => p.preco || 0)) : 0;
    const name = personal.name || personal.nome || 'Personal';
    const photo = personal.photo_url || personal.foto || '';
    const specialties = Array.isArray(personal.specialties) ? personal.specialties.join(', ') : (personal.especialidade || 'Personal Trainer');

    console.log(`[Marketplace] Personal ${name} has ${plans.length} plans. Total plans in cache: ${allPlans.length}`);

    return `
    <div class="card personal-card" style="position: relative; overflow: hidden; border: 1px solid var(--border); transition: transform 0.3s;" onclick="window.viewPersonalProfile('${personal.id}')">
        ${rank ? `
                <div style="position: absolute; top: 0; left: 0; background: var(--primary); color: white; padding: 4px 12px; border-bottom-right-radius: 8px; font-weight: bold; z-index: 1;">
                    #${rank}
                </div>
            ` : ''}

        <div class="card-body text-center p-md">
            <div class="sidebar-avatar mx-auto mb-md" style="width: 80px; height: 80px; font-size: 2rem; overflow: hidden; border: 2px solid var(--primary-light); background: #f8fafc;">
                ${photo ? `<img src="${photo}" style="width: 100%; height: 100%; object-fit: cover;">` : name.charAt(0)}
            </div>
            <h3 class="card-title mb-xs" style="font-size: 1.1rem;">${name}</h3>
            <p class="badge badge-primary mb-md" style="font-size: 0.7rem;">${specialties}</p>

            <div class="flex justify-center gap-md mb-md text-sm text-muted">
                <span>👥 ${personal.studentCount || 0} alunos</span>
                <span>⭐ ${personal.avaliacao || '5.0'}</span>
            </div>

            <div class="text-lg font-bold text-primary mb-md">
                ${lowestPrice > 0 ? `A partir de R$ ${parseFloat(lowestPrice).toFixed(2)}` : 'Consulte valores'}
            </div>

            <button class="btn btn-outline btn-block btn-sm">
                Ver Perfil
            </button>
        </div>
    </div>
    `;
}

window.filterPersonals = (query) => {
    const container = document.getElementById('all-personals-container');
    const personals = db.getAll('personais').filter(p => p.role === 'personal');
    const allStudents = db.getAll('profiles');

    const filtered = personals.filter(p => (p.nome || p.name || '').toLowerCase().includes(query.toLowerCase()));

    const rankedFiltered = filtered.map(p => {
        const studentCount = allStudents.filter(s => s.assigned_personal_id === p.id && s.status === 'active').length;
        return { ...p, studentCount };
    });

    container.innerHTML = rankedFiltered.map(p => renderPersonalCard(p)).join('');
};

window.viewPersonalProfile = (id) => {
    const personal = db.getById('profiles', id) || db.getById('personais', id);
    if (!personal) {
        console.error('[Marketplace] Personal not found in cache:', id);
        return;
    }

    const allPlans = db.getAll('planos_personal');
    const plans = allPlans.filter(p => p.personal_id === id);
    console.log(`[Marketplace] Viewing profile for ${personal.name || 'N/A'}. Found ${plans.length} plans.`);

    const name = personal.name || personal.nome || 'Personal';
    const photo = personal.photo_url || personal.foto || '';
    const specialties = Array.isArray(personal.specialties) ? personal.specialties.join(', ') : (personal.especialidade || 'Personal Trainer');
    const bio = personal.bio || `Sou especialista em ${specialties}. Ajudo alunos a alcançarem seus objetivos com treinos personalizados.`;

    const modalContent = `
        <div class="profile-header -mx-md -mt-md p-lg mb-md text-white" style="background: linear-gradient(135deg, var(--primary), #4338ca); border-radius: 8px 8px 0 0;">
            <div class="flex items-center gap-md">
                <div class="sidebar-avatar" style="width: 90px; height: 90px; font-size: 2.5rem; background: white; color: var(--primary); border: 4px solid rgba(255,255,255,0.2); overflow: hidden;">
                    ${photo ? `<img src="${photo}" style="width: 100%; height: 100%; object-fit: cover;">` : name.charAt(0)}
                </div>
                <div>
                    <h2 class="text-xl font-bold mb-xs text-white">${name}</h2>
                    <div class="flex items-center gap-sm text-sm opacity-90">
                        <span class="badge" style="background: rgba(255,255,255,0.2); color: white;">${specialties}</span>
                        <span>⭐ ${personal.avaliacao || '5.0'}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="mb-xl">
            <h3 class="text-md font-bold mb-sm text-primary">Sobre o Personal</h3>
            <p class="text-muted leading-relaxed">${bio}</p>
        </div>

        <h3 class="text-md font-bold mb-md">Planos & Consultoria</h3>
        
        <div class="flex flex-col gap-md mb-xl">
            ${plans.length > 0 ? plans.map(p => `
                <div class="card p-md shadow-sm" style="border: 1px solid var(--border); border-left: 4px solid var(--primary);">
                    <div class="flex justify-between items-start mb-sm">
                        <div>
                            <h4 class="font-bold text-lg mb-0">${p.nome}</h4>
                            <span class="text-xs text-muted uppercase tracking-wider">${p.duracao_dias || 30} dias de acesso</span>
                        </div>
                        <div class="text-right">
                             <div class="text-xl font-bold text-primary">R$ ${parseFloat(p.preco).toFixed(2)}</div>
                        </div>
                    </div>
                    
                    <p class="text-sm text-muted mb-md">${p.descricao || 'Acesso completo a treinos e acompanhamento.'}</p>
                    
                    ${p.beneficios && Array.isArray(p.beneficios) && p.beneficios.length > 0 ? `
                        <ul class="text-sm text-muted mb-md space-y-xs">
                            ${p.beneficios.map(f => `<li class="flex items-center gap-xs">✓ ${f}</li>`).join('')}
                        </ul>
                    ` : ''}

                    <button class="btn btn-primary btn-block" onclick="hirePersonal('${personal.id}', '${p.id}', '${p.nome}', ${p.preco})">
                        Contratar Plano
                    </button>
                </div>
            `).join('') : '<p class="text-muted text-center p-lg bg-light rounded">Este profissional ainda não cadastrou planos públicos.</p>'}
        </div>

        <div class="text-center border-t pt-md">
            <p class="text-sm text-muted mb-sm">Dúvidas sobre o acompanhamento?</p>
            <button class="btn btn-outline btn-block gap-sm" onclick="window.WhatsApp.contactPersonal('${personal.phone || ''}', 'Olá, vi seu perfil no TFIT e tenho dúvidas sobre os planos.')">
                <span style="color: #25D366; font-size: 1.2rem;">📱</span> Conversar no WhatsApp
            </button>
        </div>
    `;

    UI.showModal('Perfil do Profissional', modalContent);
};

window.hirePersonal = (personalId, planId, plan_name, price) => {
    if (window.startCheckout) {
        // We pass 'marketplace_plan' as external_reference type
        window.startCheckout(price, plan_name, planId, personalId, 'marketplace_plan');
    } else {
        UI.showNotification('Erro', 'Sistema de pagamento não inicializado.', 'error');
    }
};
