
// ============================================
// STUDENT - AUTH & ONBOARDING
// ============================================

// Register Route
router.addRoute('/student/register', () => {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">
                    <img src="./logo.png" alt="T-FIT" class="logo-tfit" style="width: 100%; max-width: 200px; margin: 0 auto 1rem; display: block;">
                    <p>Crie sua conta</p>
                </div>
                
                <!-- Google Sign Up -->
                <button class="btn btn-google btn-block btn-lg mb-md" onclick="auth.loginWithGoogle('student')" style="background: #fff; color: #333; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" style="width: 20px;">
                    Cadastrar com Google
                </button>

                <div class="divider text-center mb-md" style="opacity: 0.5;">ou preencha seus dados</div>

                <form id="student-register-form">
                    <div class="form-group">
                        <label class="form-label">Nome Completo *</label>
                        <input type="text" class="form-input" id="reg-name" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Email *</label>
                        <input type="email" class="form-input" id="reg-email" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Senha *</label>
                        <input type="password" class="form-input" id="reg-password" required minlength="6">
                    </div>

                    <div class="form-group">
                        <label class="form-label">CPF * (Apenas números)</label>
                        <input type="text" class="form-input" id="reg-cpf" placeholder="000.000.000-00" maxlength="14" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Telefone (WhatsApp) *</label>
                        <input type="tel" class="form-input" id="reg-phone" placeholder="11911917087" required>
                    </div>

                    <div class="grid grid-2">
                        <div class="form-group">
                            <label class="form-label">Idade *</label>
                            <input type="number" class="form-input" id="reg-age" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Sexo *</label>
                            <select class="form-select" id="reg-gender" required>
                                <option value="">Selecione...</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Feminino">Feminino</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Objetivo Principal *</label>
                        <select class="form-select" id="reg-goal" required>
                            <option value="Emagrecimento">Emagrecimento</option>
                            <option value="Hipertrofia">Hipertrofia</option>
                            <option value="Ganho de Massa">Ganho de Massa Muscular</option>
                            <option value="Condicionamento">Condicionamento Físico</option>
                            <option value="Qualidade de Vida">Qualidade de Vida e Bem-estar</option>
                        </select>
                    </div>

                    <!-- WAZE FITNESS INTEGRATION -->
                    <div class="card p-md border-shadow" style="background: rgba(99, 102, 241, 0.05); border: 1px solid var(--primary-light); border-radius: 12px; margin-top: 20px; margin-bottom: 20px;">
                        <h4 class="mb-xs" style="color: var(--primary);">Academia onde você treina (Opcional)</h4>
                        <p class="text-xs text-muted mb-md">Informe o endereço correto da academia para que ela apareça no mapa do Waze Fitness e outros alunos possam conhecer.</p>
                        
                        <div class="form-group">
                            <label class="form-label">Nome da Academia</label>
                            <input type="text" class="form-input" id="reg-gym-name" placeholder="Ex: Iron Gym Fitness">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Endereço (Rua/Avenida)</label>
                            <input type="text" class="form-input" id="reg-gym-address" placeholder="Ex: Av. Paulista">
                        </div>
                        <div class="grid grid-3 gap-sm">
                            <div class="form-group" style="grid-column: span 1;">
                                <label class="form-label">Número</label>
                                <input type="text" class="form-input" id="reg-gym-number" placeholder="1234">
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label class="form-label">Cidade / Estado</label>
                                <input type="text" class="form-input" id="reg-gym-city" placeholder="São Paulo - SP">
                            </div>
                        </div>
                    </div>

                    <div class="form-group mb-md" style="margin-top: 15px;">
                        <label class="flex items-center gap-sm cursor-pointer" style="font-weight: normal; font-size: 0.8rem;">
                            <input type="checkbox" id="reg-privacy" required>
                            <span>Eu li e concordo com a <a href="#" onclick="router.navigate('/privacy'); return false;" class="text-primary hover:underline">Política de Privacidade</a>.</span>
                        </label>
                    </div>

                    <button type="submit" class="btn btn-primary btn-block">Criar Conta</button>
                </form>

                <div class="mt-md">
                    <button class="btn btn-ghost btn-block" onclick="router.navigate('/student/login')">
                        ← Voltar para Login
                    </button>
                </div>
            </div>
        </div>
    `;

    // CPF Mask
    document.getElementById('reg-cpf').addEventListener('input', (e) => {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
        e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
    });

    document.getElementById('student-register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const phone = document.getElementById('reg-phone').value;
        const cpfRaw = document.getElementById('reg-cpf').value;
        const cpf = cpfRaw.replace(/\D/g, ''); // Remove formatting
        const age = document.getElementById('reg-age').value;
        const gender = document.getElementById('reg-gender').value;
        const goal = document.getElementById('reg-goal').value;

        UI.showLoading('Criando sua conta...');
        try {
            // Check if email already exists with a different role
            const existingRole = await auth.checkEmailRole(email);
            if (existingRole) {
                UI.hideLoading();
                if (existingRole === 'student') {
                    UI.showNotification('Email em uso', 'Este email já possui uma conta de Aluno. Tente fazer login.', 'warning');
                } else {
                    const roleLabel = existingRole === 'personal' ? 'Personal Trainer' : 'Admin';
                    UI.showNotification('Conflito de Conta', `Este email já está cadastrado como ${roleLabel}. Não é possível usar o mesmo email para papéis diferentes.`, 'error');
                }
                return;
            }

            // Metadados que serão salvos no auth.users e copiados pelo Trigger para public.profiles
            let userData = {
                name,
                role: 'student', // IMPORTANTE para o Trigger
                cpf,
                phone,
                age: parseInt(age),
                gender,
                goal,
                status: 'active',
                paymentStatus: 'pending',
                signupDate: new Date().toISOString(),
                trialUsed: false
            };

            // Process WAZE FITNESS GYM (Mapbox Geocoding)
            const gymName = document.getElementById('reg-gym-name').value.trim();
            const gymAddress = document.getElementById('reg-gym-address').value.trim();
            const gymNumber = document.getElementById('reg-gym-number').value.trim();
            const gymCity = document.getElementById('reg-gym-city').value.trim();

            let finalGymId = null;

            if (gymName && gymAddress) {
                const fullAddressString = `${gymAddress}, ${gymNumber}, ${gymCity}`;
                UI.showLoading('Buscando localização da academia...');

                try {
                    let mbToken = typeof MAPBOX_TOKEN !== 'undefined' ? MAPBOX_TOKEN : 'pk.eyJ1Ijoid2lsbGNhcmRvc28iLCJhIjoiY21sbGszcWw2MDlkNTNocTBndjdvbnhteCJ9.-cqbPhB7Xir-LpDteY191Q';
                    let geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddressString)}.json?access_token=${mbToken}&limit=1`;

                    const geoRes = await fetch(geocodeUrl);
                    const geoData = await geoRes.json();

                    if (geoData.features && geoData.features.length > 0) {
                        const [lng, lat] = geoData.features[0].center;

                        // Check if this gym already exists
                        const curGyms = db.query('gyms', g => g.name.toLowerCase() === gymName.toLowerCase() && Math.abs(g.latitude - lat) < 0.01);

                        if (curGyms.length > 0) {
                            finalGymId = curGyms[0].id; // Re-use
                        } else {
                            // Create the gym directly in SB Database via REST or auth if possible
                            // For security, db.create works via the JS Proxy if public can insert
                            let newGymRes = await window.supabase.from('gyms').insert({
                                name: gymName,
                                address: gymAddress,
                                number: gymNumber,
                                city: gymCity,
                                state: gymCity.split('-')[1] ? gymCity.split('-')[1].trim() : '',
                                latitude: lat,
                                longitude: lng
                            }).select().single();

                            if (newGymRes.error) {
                                console.warn("Inserção no cadastro de gym falhou, tentando fallback em academias...");
                                newGymRes = await window.supabase.from('academias').insert({
                                    nome: gymName,
                                    endereco: gymAddress,
                                    latitude: lat,
                                    longitude: lng,
                                    capacidade_maxima: 100,
                                    alunos_presentes: 0
                                }).select().single();
                            }

                            if (newGymRes.data) {
                                finalGymId = newGymRes.data.id;
                            }
                        }
                    } else {
                        UI.showNotification('Aviso Geográfico', 'Não localizamos o endereço da academia com precisão, mas seu cadastro seguirá normalmente.', 'warning');
                    }
                } catch (geoErr) {
                    console.warn("Waze Fitness Geocoding Error:", geoErr);
                }
            }

            // We put gym_id in userData to see if trigger copies it, but we also do a backup force update
            if (finalGymId) userData.gym_id = finalGymId;

            UI.showLoading('Concluindo cadastro...');
            localStorage.setItem('tfit_pending_role', 'student');
            const result = await auth.signUp(email, password, userData);

            UI.hideLoading();
            if (result.success) {

                // Force update to profiles to inject gym_id immediately after account created
                if (finalGymId && result.user) {
                    await window.supabase.from('profiles').update({ gym_id: finalGymId }).eq('id', result.user.id);
                }

                if (result.requireConfirmation) {
                    UI.showNotification('Sucesso!', 'Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.', 'success');
                    setTimeout(() => router.navigate('/student/login'), 3000);
                } else {
                    UI.showNotification('Sucesso!', 'Conta criada com sucesso! Redirecionando...', 'success');
                    // Aguardar um pouco para o trigger do Supabase criar o profile
                    setTimeout(() => router.navigate('/student/dashboard'), 1000);
                }
            } else {
                UI.showNotification('Erro', result.message, 'error');
            }
        } catch (error) {
            UI.hideLoading();
            UI.showNotification('Erro', error.message, 'error');
        }
    });
});

// Onboarding Route
router.addRoute('/student/onboarding', () => {
    if (!auth.requireAuth('student')) return;

    const aiPlans = db.query('plans', p => p.type === 'ai' || !p.personal_id || p.personal_id === '00000000-0000-0000-0000-000000000000' || p.target_audience === 'student_ai');
    const featuredPlan = aiPlans.length > 0 ? aiPlans[0] : {
        name: 'T-FIT IA',
        price: 29.90,
        billing_cycle: 'Mensal',
        features: ['Treinos IA', 'Dietas IA', 'Suporte Básico']
    };

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="page flex items-center justify-center p-lg">
            <div class="container" style="max-width: 900px;">
                <div class="text-center mb-2xl">
                    <h1 class="page-title mb-sm">Bem-vindo ao T-FIT! 🚀</h1>
                    <p class="text-muted" style="font-size: 1.1rem;">Como você deseja treinar hoje?</p>
                </div>

                <div class="grid grid-1" style="max-width: 500px; margin: 0 auto;">
                    <!-- Option 1: AI -->
                    <div class="card p-xl flex flex-col items-center text-center cursor-pointer hover:border-primary transition-all shadow-glow" 
                         style="border: 2px solid var(--primary); min-height: 400px; border-radius: 20px;"
                         onclick="window.selectMode('ai')">
                        <div style="font-size: 4rem; margin-bottom: 1.5rem;">🤖</div>
                        <h2 class="mb-md">${featuredPlan.name}</h2>
                        <p class="text-muted mb-lg">
                            Treinos e dietas gerados instantaneamente por Inteligência Artificial. Ideal para quem quer começar agora.
                        </p>
                        <ul class="text-left mb-xl" style="padding-left: 0; list-style: none;">
                            ${featuredPlan.features.map(f => `<li class="mb-sm">✅ ${f}</li>`).join('')}
                            <li class="mb-sm">💰 <strong>R$ ${parseFloat(featuredPlan.price || 0).toFixed(2).replace('.', ',')}/${featuredPlan.billing_cycle === 'Mensal' ? 'mês' : 'ciclo'}</strong></li>
                        </ul>
                        <button class="btn btn-primary btn-block mt-auto btn-lg" style="font-weight: 800;">Ativar Inteligência Artificial</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.selectMode = (mode) => {
        if (mode === 'ai') {
            // Use the fetched or fallback plan
            UI.confirmDialog(
                `Assinar ${featuredPlan.name}`,
                `Confirmar assinatura de R$ ${parseFloat(featuredPlan.price || 0).toFixed(2).replace('.', ',')} para acesso total à IA?`,
                () => {
                    // Start checkout with plan details
                    window.startCheckout(featuredPlan.price, featuredPlan.name, featuredPlan.id || 'plano_ia_estudante', '');
                }
            );
        }
    };
});

// Setup AI Profile
router.addRoute('/student/ai-setup', () => {
    if (!auth.requireAuth('student')) return;

    // Simple form to get initial data for AI
    const modalContent = `
        <div class="p-lg">
            <h2 class="mb-lg text-center">Configuração Inicial</h2>
            <form id="ai-setup-form">
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Peso (kg)</label>
                        <input type="number" class="form-input" id="setup-weight" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Altura (cm)</label>
                        <input type="number" class="form-input" id="setup-height" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Objetivo Principal</label>
                    <select class="form-select" id="setup-goal" required>
                        <option value="Emagrecimento">Emagrecimento</option>
                        <option value="Hipertrofia">Hipertrofia</option>
                        <option value="Ganho de Massa">Ganho de Massa Muscular</option>
                        <option value="Condicionamento">Condicionamento Físico</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Nível de Experiência</label>
                    <select class="form-select" id="setup-level" required>
                        <option value="beginner">Iniciante</option>
                        <option value="intermediate">Intermediário</option>
                        <option value="advanced">Avançado</option>
                    </select>
                </div>
            </form>
            <div class="text-center mt-xl">
                <button class="btn btn-primary btn-lg" onclick="window.finishAISetup()">Gerar Meu Plano 🚀</button>
            </div>
        </div>
    `;

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="page flex items-center justify-center">
            <div class="card" style="max-width: 600px; width: 100%;">
                ${modalContent}
            </div>
        </div>
    `;

    window.finishAISetup = async () => {
        const weight = document.getElementById('setup-weight').value;
        const height = document.getElementById('setup-height').value;
        const goal = document.getElementById('setup-goal').value;
        const level = document.getElementById('setup-level').value;

        if (!weight || !height) {
            UI.showNotification('Erro', 'Preencha seus dados', 'error');
            return;
        }

        const user = auth.getCurrentUser();

        PaymentHelper.handlePremiumAction('Gerar Meu Plano', user, async () => {
            await db.update('profiles', user.id, {
                weight: parseFloat(weight),
                height: parseInt(height),
                goal,
                level
            });

            // Generate initial AI content
            UI.showLoading();
            try {
                // Map Portuguese goal to AI internal goal
                const goalMap = {
                    'Emagrecimento': 'weight_loss',
                    'Hipertrofia': 'hypertrophy',
                    'Ganho de Massa': 'gain_muscle',
                    'Condicionamento': 'endurance',
                    'Qualidade de Vida': 'wellbeing'
                };
                const aiGoal = goalMap[goal] || 'hypertrophy';

                // Generate Workout
                const splits = await AIHelper.generateWeeklySplit({ goal: aiGoal, level, daysPerWeek: 4 });

                // Save Splits
                for (const split of splits) {
                    await db.create('workouts', {
                        name: split.name,
                        type: split.type,
                        duration: split.duration,
                        exercises: split.exercises,
                        student_id: user.id,
                        student_name: user.name,
                        personal_id: null,
                        personal_name: 'T-FIT IA'
                    });
                }

                // Generate Diet
                const diet = await AIHelper.generateDiet({ weight, height, goal: aiGoal });
                await db.create('diets', {
                    ...diet,
                    student_id: user.id,
                    student_name: user.name,
                    personal_id: null,
                    personal_name: 'T-FIT IA'
                });

                UI.hideLoading();
                UI.showNotification('Pronto!', 'Seu plano personalizado foi criado!', 'success');
                router.navigate('/student/dashboard');
            } catch (error) {
                console.error('Error in AI Setup:', error);
                UI.hideLoading();
                UI.showNotification('Erro', 'Falha ao gerar plano inicial: ' + error.message, 'error');
            }
        }, 'ai');
    };
});
