// ############################################
// T-FIT GROWTH SYSTEM (REFERRALS & REWARDS)
// ############################################

window.GrowthSystem = {
    // 1. INITIALIZE ROUTES
    initRoutes() {
        if (typeof router === 'undefined') return;

        router.addRoute('/student/convites', () => this.renderInviteFriends());
        router.addRoute('/student/loja', () => this.renderRewardStore());
        router.addRoute('/student/missoes', () => this.renderDailyMissions());
        router.addRoute('/student/extrato-pontos', () => this.renderPointsHistory());

        // Global function for nutrition page
        window.openMealAIAnalysis = () => this.openMealAIAnalysis();
    },

    // 2. RENDER: INVITE FRIENDS
    async renderInviteFriends() {
        if (!auth.requireAuth('student')) return;
        const currentUser = auth.getCurrentUser();
        
        let rewardAmount = 100;
        try {
            const config = db.getAll('config_pontos')[0];
            if (config && config.pontos_indicacao !== undefined) {
                rewardAmount = config.pontos_indicacao;
            }
        } catch (e) {}

        UI.renderDashboard(`
            <div class="page-header"><h1 class="page-title">Convide Amigos 🚀</h1></div>
            <div class="p-lg">
                <div class="card shadow-glow mb-xl" style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: white; border: none; border-radius: 28px; text-align: center;">
                    <div class="card-body p-xl">
                        <div style="font-size: 4rem; margin-bottom: 1.5rem;">🎁</div>
                        <h2 class="text-3xl font-black mb-md">Ganhe ${rewardAmount} Pontos!</h2>
                        <p class="text-white opacity-80 mb-xl" style="font-size: 1.1rem;">Convide seus amigos para treinar no T-FIT. Quando eles se cadastrarem, você ganha T-Points na hora!</p>
                        
                        <div class="bg-white/10 rounded-2xl p-lg border border-white/20 mb-xl">
                            <p class="text-xs uppercase tracking-widest font-bold mb-sm opacity-80">Seu Link de Convite</p>
                            <div class="flex items-center gap-sm bg-black/20 p-md rounded-xl">
                                <code class="flex-1 text-sm font-bold truncate" id="invite-link-text">https://tfit.app/?ref=${currentUser.id}</code>
                                <button class="btn btn-sm btn-white text-indigo-600 font-bold" onclick="UI.copyToClipboard('https://tfit.app/?ref=${currentUser.id}')">
                                    COPIAR
                                </button>
                            </div>
                        </div>

                        <div class="flex gap-sm">
                            <button class="btn btn-white btn-block py-md font-bold" style="color: #4f46e5;" onclick="GrowthSystem.shareInviteLink('${currentUser.id}')">
                                <i class="fab fa-whatsapp mr-xs"></i> COMPARTILHAR WHATSAPP
                            </button>
                        </div>
                    </div>
                </div>

                <h3 class="mb-md">Como funciona? 🤔</h3>
                <div class="grid grid-3 gap-md mb-2xl">
                    <div class="card p-md text-center" style="border-radius: 20px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">🔗</div>
                        <h4 class="text-sm mb-xs">1. Envie o Link</h4>
                        <p class="text-xs text-muted">Compartilhe seu link único com seus amigos.</p>
                    </div>
                    <div class="card p-md text-center" style="border-radius: 20px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">📝</div>
                        <h4 class="text-sm mb-xs">2. Cadastro</h4>
                        <p class="text-xs text-muted">Seu amigo cria uma conta grátis no app.</p>
                    </div>
                    <div class="card p-md text-center" style="border-radius: 20px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">💎</div>
                        <h4 class="text-sm mb-xs">3. Ganhe Pontos</h4>
                        <p class="text-xs text-muted">Receba seus T-Points e troque por prêmios.</p>
                    </div>
                </div>

                <h3 class="mb-md">Pessoas Convidadas 👥</h3>
                <div id="invites-list-container">
                    <div class="text-center p-xl text-muted">Carregando seus convites...</div>
                </div>
            </div>
        `, 'student');

        this.loadUserInvites(currentUser.id);
    },

    // 3. RENDER: REWARD STORE
    async renderRewardStore() {
        if (!auth.requireAuth('student')) return;
        const currentUser = auth.getCurrentUser();

        UI.renderDashboard(`
            <div class="page-header"><h1 class="page-title">Loja de Recompensas 🛒</h1></div>
            <div class="p-lg">
                <div class="flex justify-between items-center mb-xl">
                    <div>
                        <p class="text-xs text-muted uppercase tracking-widest font-bold mb-xs">Saldo de Pontos</p>
                        <h2 class="text-3xl font-black mb-0" id="store-tpoints-balance">💎 ${currentUser.t_points || 0}</h2>
                    </div>
                    <div class="flex gap-sm">
                        <button class="btn btn-warning btn-sm font-bold" onclick="GrowthSystem.renderBuyPoints()">COMPRAR PONTOS 💎</button>
                        <button class="btn btn-outline btn-sm font-bold" onclick="router.navigate('/student/extrato-pontos')">HISTÓRICO</button>
                    </div>
                </div>

                <div class="grid grid-2 gap-lg" id="rewards-container">
                    <div class="col-span-2 text-center p-xl text-muted">Carregando loja...</div>
                </div>
            </div>
        `, 'student');

        this.loadRewards(currentUser.id);
    },

    // 4.1. RENDER: BUY POINTS
    async renderBuyPoints() {
        if (!auth.requireAuth('student')) return;
        
        UI.showLoading('Carregando pacotes...');
        const { data: packages, error } = await window.supabase.from('t_points_packages').select('*').eq('active', true).order('price_brl', { ascending: true });
        UI.hideLoading();

        UI.showModal('Comprar T-Points 💎', `
            <div class="p-md">
                <p class="text-sm text-muted mb-xl text-center">Escolha um pacote para acelerar seus resgates e ganhar prêmios incríveis!</p>
                <div class="flex flex-col gap-md">
                    ${packages && packages.length > 0 ? packages.map(pkg => `
                        <div class="card p-lg border-2 border-warning/20 bg-warning/5 flex items-center justify-between cursor-pointer hover:border-warning/50 transition-all" onclick="GrowthSystem.buyPoints('${pkg.id}', '${pkg.name}', ${pkg.points}, ${pkg.price_brl})">
                            <div class="flex items-center gap-md">
                                <div style="font-size: 2rem;">💎</div>
                                <div>
                                    <h4 class="font-black mb-0">${pkg.name}</h4>
                                    <p class="text-sm font-bold text-warning">${pkg.points} Pontos</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-lg font-black">R$ ${pkg.price_brl.toFixed(2)}</div>
                                <span class="text-[10px] uppercase font-bold text-muted">Comprar →</span>
                            </div>
                        </div>
                    `).join('') : '<div class="text-center p-xl opacity-50">Nenhum pacote disponível no momento.</div>'}
                </div>
                <button class="btn btn-ghost btn-block mt-xl" onclick="UI.closeModal()">Fechar</button>
            </div>
        `);
    },

    async buyPoints(pkgId, name, points, price) {
        const text = `Olá! Gostaria de comprar o pacote de T-Points: *${name}*\n💎 Quantidade: ${points} pontos\n💰 Valor: R$ ${price.toFixed(2)}\n\nMeu ID: ${auth.getCurrentUser().id}`;
        const url = `https://wa.me/5511999999999?text=${encodeURIComponent(text)}`; // TODO: Get admin phone dynamically if possible
        window.open(url, '_blank');
        UI.showNotification('WhatsApp Aberto', 'Conclua o pagamento com o administrador para receber seus pontos.', 'info');
    },

    // 4. RENDER: DAILY MISSIONS
    async renderDailyMissions() {
        if (!auth.requireAuth('student')) return;
        const currentUser = auth.getCurrentUser();

        UI.renderDashboard(`
            <div class="page-header"><h1 class="page-title">Missões Diárias 🎯</h1></div>
            <div class="p-lg">
                <div class="card shadow-glow mb-xl" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: none; border-radius: 28px;">
                    <div class="card-body p-xl text-center">
                        <h3 class="text-white mb-md">Consiga mais T-Points!</h3>
                        <p class="text-slate-400 mb-0">Complete missões diárias para acelerar seu progresso e ganhar convites para o Ranking Elite.</p>
                    </div>
                </div>

                <h3 class="mb-md">Suas Missões de Hoje</h3>
                <div class="flex flex-col gap-md" id="missions-container">
                    <div class="text-center p-xl text-muted">Carregando missões...</div>
                </div>
            </div>
        `, 'student');

        this.loadMissions(currentUser.id);
    },

    // 5. RENDER: POINTS HISTORY
    async renderPointsHistory() {
        if (!auth.requireAuth('student')) return;
        const currentUser = auth.getCurrentUser();

        UI.renderDashboard(`
            <div class="page-header"><h1 class="page-title">Histórico de Pontos 📄</h1></div>
            <div class="p-lg">
                <div class="card shadow-md mb-xl">
                    <div class="card-body p-xl flex justify-between items-center">
                        <div>
                            <h4 class="text-muted mb-xs">Status da Conta</h4>
                            <h2 class="mb-0 font-black">Nível Bronze 🥉</h2>
                        </div>
                        <div class="text-right">
                            <h4 class="text-muted mb-xs">Pontos Totais</h4>
                            <h2 class="mb-0 font-black text-primary">${currentUser.t_points || 0}</h2>
                        </div>
                    </div>
                </div>

                <h3 class="mb-md">Extrato Detalhado</h3>
                <div class="card">
                    <div class="card-body p-0" id="points-history-container">
                        <div class="text-center p-xl text-muted">Carregando extrato...</div>
                    </div>
                </div>
            </div>
        `, 'student');

        this.loadPointsHistory(currentUser.id);
    },

    // --- LOGIC HELPERS ---

    async shareInviteLink(userId) {
        const text = `🎉 Venha treinar comigo no T-FIT! O app com a melhor IA e Personais parceiros. Use meu link e ganhe bônus no cadastro:\n\nhttps://tfit.app/?ref=${userId}`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    },

    async loadUserInvites(userId) {
        try {
            const invites = await db.query('app_convites', i => i.quem_convidou === userId);
            const container = document.getElementById('invites-list-container');
            if (!container) return;
            
            if (!invites || invites.length === 0) {
                container.innerHTML = `
                    <div class="card p-xl text-center" style="border: 2px dashed var(--border); border-radius: 24px; color: var(--text-muted);">
                        <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;">📭</div>
                        <p class="mb-0">Você ainda não tem convite. Comece agora!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="card">
                    <div class="card-body p-0">
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Convidado</th>
                                        <th>Status</th>
                                        <th>Ganhos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invites.map(i => `
                                        <tr>
                                            <td class="font-bold">${i.quem_foi_convidado_email || 'Usuário'}</td>
                                            <td>
                                                <span class="badge ${i.status === 'registrado' ? 'badge-success' : 'badge-warning'}">
                                                    ${i.status === 'registrado' ? 'Registrado' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td class="font-bold text-success">+${i.pontos_ganhos || 0}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading invites:', error);
        }
    },

    async loadRewards() {
        const container = document.getElementById('rewards-container');
        if (!container) return;
        try {
            const rewards = await db.getAll('tfit_recompensas');
            if (!rewards || rewards.length === 0) {
                container.innerHTML = '<div class="col-span-2 text-center p-xl">Nenhuma recompensa disponível no momento.</div>';
                return;
            }

            container.innerHTML = rewards.map(r => `
                <div class="card overflow-hidden shadow-glow" style="border-radius: 20px; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                    <div style="height: 120px; background: #27272a; display: flex; align-items: center; justify-content: center; font-size: 3rem;">
                        ${r.tipo === 'desconto' ? '🎟️' : (r.tipo === 'premium_access' ? '💎' : '🎁')}
                    </div>
                    <div class="card-body p-md">
                        <h4 class="mb-xs font-black" style="font-size: 1rem;">${r.nome}</h4>
                        <p class="text-xs text-muted mb-md line-clamp-2">${r.descricao}</p>
                        <div class="flex justify-between items-center mt-auto">
                            <div class="text-sm font-black text-primary">💎 ${r.custo_pontos}</div>
                            <button class="btn btn-primary btn-xs font-bold" onclick="GrowthSystem.redeemReward('${r.id}', ${r.custo_pontos})">RESGATAR</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            if (container) {
                container.innerHTML = '<div class="col-span-2 text-center p-xl">Erro ao carregar loja.</div>';
            }
        }
    },

    async redeemReward(rewardId, cost) {
        const currentUser = auth.getCurrentUser();
        if ((currentUser.t_points || 0) < cost) {
            UI.showModal('Saldo Insuficiente 💎', `
                <div class="text-center p-lg">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚖️</div>
                    <h3 class="mb-md">Pontos Insuficientes</h3>
                    <p class="text-muted mb-xl">Você precisa de mais <b>${cost - (currentUser.t_points || 0)} pontos</b> para esta recompensa.</p>
                    <div class="flex flex-col gap-sm">
                        <button class="btn btn-warning btn-block" onclick="UI.closeModal(); GrowthSystem.renderBuyPoints();">Comprar Pontos agora</button>
                        <button class="btn btn-ghost btn-block" onclick="UI.closeModal()">Agora não</button>
                    </div>
                </div>
            `);
            return;
        }

        UI.showModal('Confirmar Resgate 🛍️', `
            <div class="text-center p-lg">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🎁</div>
                <h3 class="mb-md">Confirmar Resgate?</h3>
                <p class="text-muted mb-xl">Você usará <b>${cost} T-Points</b> para esta recompensa.</p>
                <div class="flex flex-col gap-sm">
                    <button class="btn btn-primary btn-block" id="confirm-redeem-btn">Confirmar e Resgatar</button>
                    <button class="btn btn-ghost btn-block" onclick="UI.closeModal()">Cancelar</button>
                </div>
            </div>
        `);

        document.getElementById('confirm-redeem-btn').addEventListener('click', async () => {
            UI.showLoading('Processando resgate...');
            try {
                // Update points locally first
                const newBalance = currentUser.t_points - cost;
                await auth.updateProfileDirect(currentUser.id, { t_points: newBalance });
                
                // Record redemption
                await db.create('tfit_resgates', {
                    user_id: currentUser.id,
                    recompensa_id: rewardId,
                    pontos_gastos: cost,
                    status: 'realizado'
                });

                // --- SPECIAL ACTIONS PER REWARD TYPE ---
                const reward = db.getById('tfit_recompensas', rewardId);
                if (reward && reward.tipo === 'premium_access') {
                    // Automatically grant 30 days of VIP/Premium
                    const oneMonthLater = new Date();
                    oneMonthLater.setDate(oneMonthLater.getDate() + 30);
                    await auth.updateProfileDirect(currentUser.id, {
                        is_vip: true,
                        plan_expiry: oneMonthLater.toISOString().split('T')[0],
                        status: 'active'
                    });
                }

                UI.hideLoading();
                UI.closeModal();
                UI.showNotification('Sucesso! 🎉', 'Recompensa resgatada e ativada.', 'success');
                setTimeout(() => location.reload(), 2000);
            } catch (error) {
                UI.hideLoading();
                UI.showNotification('Erro', 'Falha ao processar resgate.', 'error');
            }
        });
    },

    async loadMissions(userId) {
        const container = document.getElementById('missions-container');
        try {
            const allMissions = await db.getAll('tfit_missoes');
            const userProgress = await db.query('tfit_missoes_usuario', m => m.user_id === userId && m.data_missao === new Date().toISOString().split('T')[0]);

            if (!allMissions || allMissions.length === 0) {
                container.innerHTML = '<div class="text-center p-xl">Sem missões hoje. Volte mais tarde!</div>';
                return;
            }

            container.innerHTML = allMissions.map(m => {
                const progress = userProgress.find(p => p.missao_id === m.id) || { progresso: 0, concluido: false };
                const percent = Math.min((progress.progresso / (m.meta_quantidade || 1)) * 100, 100);

                return `
                    <div class="card p-lg ${progress.concluido ? 'opacity-60' : ''}" style="border-radius: 20px; border-left: 4px solid ${progress.concluido ? 'var(--success)' : 'var(--primary)'};">
                        <div class="flex justify-between items-start mb-md">
                            <div class="flex items-center gap-md">
                                <div style="font-size: 1.5rem;">${this.getMissionIcon(m.tipo)}</div>
                                <div>
                                    <h4 class="mb-xs font-black">${m.titulo}</h4>
                                    <p class="text-xs text-muted mb-0">${m.descricao}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="badge ${progress.concluido ? 'badge-success' : 'badge-primary'} font-black">+${m.recompensa_pontos}</span>
                            </div>
                        </div>

                        <div class="flex items-center gap-md">
                            <div class="flex-1" style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                                <div style="height: 100%; width: ${percent}%; background: ${progress.concluido ? 'var(--success)' : 'var(--primary)'}; border-radius: 3px;"></div>
                            </div>
                            <span class="text-[10px] font-bold text-muted">${progress.progresso}/${m.meta_quantidade || 1}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            container.innerHTML = '<div class="text-center p-xl">Erro ao carregar missões.</div>';
        }
    },

    getMissionIcon(type) {
        const icons = {
            'login': '👋',
            'treino_concluido': '💪',
            'post_feed': '📸',
            'analise_refeicao': '🥗',
            'convidar_amigo': '🚀'
        };
        return icons[type] || '🎯';
    },

    async loadPointsHistory(userId) {
        const container = document.getElementById('points-history-container');
        try {
            // Simplified: list redemptions and missions as history
            const missions = await db.query('tfit_missoes_usuario', m => m.user_id === userId && m.concluido === true);
            const redemptions = await db.query('tfit_resgates', r => r.user_id === userId);

            const history = [
                ...missions.map(m => {
                    const missionData = db.getById('tfit_missoes', m.missao_id);
                    return {
                        date: m.concluido_em,
                        desc: missionData?.titulo || 'Missão Concluída',
                        points: missionData?.recompensa_pontos || 0,
                        type: 'gain'
                    };
                }),
                ...redemptions.map(r => {
                    const rewardData = db.getById('tfit_recompensas', r.recompensa_id);
                    return {
                        date: r.created_at,
                        desc: `Resgate: ${rewardData?.nome || 'Recompensa'}`,
                        points: -r.pontos_gastos,
                        type: 'spend'
                    };
                })
            ].sort((a, b) => new Date(b.date) - new Date(a.date));

            if (history.length === 0) {
                container.innerHTML = '<div class="text-center p-xl">Nenhuma movimentação ainda.</div>';
                return;
            }

            container.innerHTML = `
                <div class="table-container">
                    <table class="table">
                        <tbody>
                            ${history.map(h => `
                                <tr>
                                    <td>
                                        <div class="text-xs text-muted">${new Date(h.date).toLocaleDateString('pt-BR')}</div>
                                        <div class="font-bold">${h.desc}</div>
                                    </td>
                                    <td class="text-right">
                                        <span class="font-black ${h.type === 'gain' ? 'text-success' : 'text-danger'}">
                                            ${h.type === 'gain' ? '+' : ''}${h.points}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            container.innerHTML = '<div class="text-center p-xl">Erro ao carregar histórico.</div>';
        }
    },

    // 6. GLOBAL POINTS AWARDER (Core Logic)
    async awardPoints(userId, actionType, metadata = {}) {
        console.log(`[GrowthSystem] Tentando premiar: ${actionType} para ${userId}`);
        
        try {
            // Find valid mission for this type
            const mission = db.query('tfit_missoes', m => m.ativo === true && m.tipo === actionType)[0];
            if (!mission) return;

            const today = new Date().toISOString().split('T')[0];
            
            // Get current progress
            let progress = db.query('tfit_missoes_usuario', p => 
                p.user_id === userId && 
                p.missao_id === mission.id && 
                p.data_missao === today
            )[0];

            if (progress && progress.concluido) return; // Already done today

            if (!progress) {
                progress = {
                    user_id: userId,
                    missao_id: mission.id,
                    progresso: 0,
                    concluido: false,
                    data_missao: today
                };
                await db.create('tfit_missoes_usuario', progress);
                // Re-fetch to get ID
                progress = db.query('tfit_missoes_usuario', p => p.user_id === userId && p.missao_id === mission.id && p.data_missao === today)[0];
            }

            // Update Progress
            const newProg = (progress.progresso || 0) + 1;
            const isConcluido = newProg >= (mission.meta_quantidade || 1);

            await db.update('tfit_missoes_usuario', progress.id, {
                progresso: newProg,
                concluido: isConcluido,
                concluido_em: isConcluido ? new Date().toISOString() : null
            });

            // If finished, ADD POINTS TO PROFILE
            if (isConcluido) {
                const profile = await db.getById('profiles', userId);
                const currentPoints = profile.t_points || 0;
                const bonus = mission.recompensa_pontos;
                
                await auth.updateProfileDirect(userId, { t_points: currentPoints + bonus });
                
                UI.showNotification('Missão Concluída! 🎯', `+${bonus} T-Points adicionados à sua conta.`, 'success');
            }
        } catch (error) {
            console.error('[GrowthSystem] Erro ao premiar pontos:', error);
        }
    },

    // 7. REFERRAL HANDLER (For Signup)
    async handleReferralSignup(newUserId, referrerId) {
        if (!referrerId) return;
        
        try {
            // Link the referrer
            await auth.updateProfileDirect(newUserId, { referrer_id: referrerId });

            // Fetch configured reward amount
            let rewardAmount = 100; // default
            try {
                const config = db.getAll('config_pontos')[0];
                if (config && config.pontos_indicacao !== undefined) {
                    rewardAmount = config.pontos_indicacao;
                }
            } catch (e) {}

            // Create invitation record
            await db.create('app_convites', {
                quem_convidou: referrerId,
                quem_foi_convidado_id: newUserId,
                status: 'registrado',
                pontos_ganhos: rewardAmount // Admin defined bonus
            });

            // Award points to Referrer
            const referrer = await db.getById('profiles', referrerId);
            await auth.updateProfileDirect(referrerId, { t_points: (referrer.t_points || 0) + rewardAmount });

            // Award points for Mission
            this.awardPoints(referrerId, 'convidar_amigo');
            
            console.log(`[GrowthSystem] Referral processed: ${referrerId} invited ${newUserId}`);
        } catch (error) {
            console.error('[GrowthSystem] Error handling referral signup:', error);
        }
    },

    // 8. MEAL AI ANALYSIS (Mission: analise_refeicao)
    async openMealAIAnalysis() {
        UI.showModal('Análise de Prato IA 📸', `
            <div class="p-lg text-center">
                <div class="mb-xl bg-emerald-500/10 p-xl rounded-full inline-block">
                    <span style="font-size: 4rem;">🥗</span>
                </div>
                <h2 class="text-2xl font-black mb-md">Como funciona?</h2>
                <p class="text-muted mb-xl">Tire uma foto do seu prato e nossa IA identificará os macros e calorias estimadas instantaneamente.</p>
                
                <div class="bg-indigo-900/40 p-md rounded-2xl border border-indigo-500/20 mb-xl flex items-center justify-between">
                    <span class="text-xs font-bold text-indigo-200 uppercase tracking-widest">Recompensa</span>
                    <span class="badge badge-success font-black">+20 T-Points</span>
                </div>

                <div class="flex flex-col gap-sm">
                    <label class="btn btn-primary btn-block btn-lg shadow-glow" style="cursor: pointer; background: #10b981; border: none;">
                        <i class="fas fa-camera mr-xs"></i> TIRAR FOTO DO PRATO
                        <input type="file" id="ai-plate-file" accept="image/*" capture="environment" style="display: none;" onchange="GrowthSystem.processPlatePhoto(this)">
                    </label>
                    <button class="btn btn-ghost btn-block" onclick="UI.closeModal()">Agora não</button>
                </div>
            </div>
        `);
    },

    async processPlatePhoto(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];

        UI.showLoading('Iniciando Visão Computacional...');

        try {
            // Convert to base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result;
                
                UI.showLoading('T-FIT IA Analisando cores e formas...');
                
                // Call AI Helper
                const res = await AIHelper.analyzePlate(base64);
                
                UI.hideLoading();
                
                if (res && res.is_food) {
                    this.renderPlateResult(res);
                    // Award points!
                    this.awardPoints(auth.getCurrentUser().id, 'analise_refeicao');
                } else {
                    UI.showNotification('Erro', res?.feedback || 'Nenhum alimento identificado na imagem.', 'warning');
                    UI.closeModal();
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            UI.hideLoading();
            UI.showNotification('Erro', 'Falha ao processar imagem.', 'error');
        }
    },

    renderPlateResult(data) {
        UI.showModal('Resultado da Análise IA 🤖', `
            <div class="p-lg">
                <div class="card bg-emerald-500/5 mb-xl" style="border: 2px solid #10b981; border-radius: 24px;">
                    <div class="card-body p-xl text-center">
                        <p class="text-[10px] text-emerald-600 font-black uppercase mb-xs tracking-widest">Identificado como</p>
                        <h2 class="text-2xl font-black mb-md">${data.plate_name}</h2>
                        
                        <div class="flex justify-center gap-xl mb-xl">
                            <div>
                                <div class="text-2xl font-black">${data.macros.kcal}</div>
                                <div class="text-[10px] text-muted uppercase font-bold">Kcal</div>
                            </div>
                            <div style="width: 1px; background: rgba(0,0,0,0.05);"></div>
                            <div>
                                <div class="text-2xl font-black">${data.macros.prot}g</div>
                                <div class="text-[10px] text-muted uppercase font-bold">Prot</div>
                            </div>
                            <div style="width: 1px; background: rgba(0,0,0,0.05);"></div>
                            <div>
                                <div class="text-2xl font-black">${data.macros.carb}g</div>
                                <div class="text-[10px] text-muted uppercase font-bold">Carbo</div>
                            </div>
                        </div>

                        <div class="bg-white rounded-2xl p-lg border border-emerald-100 text-left">
                            <p class="text-sm italic text-emerald-800 mb-0">"${data.feedback}"</p>
                        </div>
                    </div>
                </div>

                <div class="mb-xl">
                    <h4 class="mb-sm">Nota Nutricional: ${data.grade}/10</h4>
                    <div style="height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
                        <div style="height: 100%; width: ${data.grade * 10}%; background: ${data.grade > 7 ? '#10b981' : (data.grade > 4 ? '#f59e0b' : '#ef4444')}; border-radius: 6px;"></div>
                    </div>
                </div>

                <div class="bg-indigo-50 rounded-2xl p-md border border-indigo-100 mb-xl">
                    <p class="text-[10px] uppercase font-bold text-indigo-600 mb-xs">Explicação Técnica</p>
                    <p class="text-xs text-indigo-900 mb-0">${data.rationale}</p>
                </div>

                <button class="btn btn-primary btn-block p-lg font-black" onclick="UI.closeModal()">ENTENDIDO!</button>
            </div>
        `);
    }
};

// Auto-init routes on script load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => GrowthSystem.initRoutes(), 500);
} else {
    window.addEventListener('load', () => GrowthSystem.initRoutes());
}
