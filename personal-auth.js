
// ============================================
// PERSONAL - AUTH & REGISTRATION
// ============================================

// Register Route
router.addRoute('/personal/register', () => {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="auth-container">
            <div class="auth-card" style="max-width: 500px;">
                <div class="auth-logo">
                    <img src="./logo.png" alt="T-FIT" class="logo-tfit" style="width: 100%; max-width: 200px; margin: 0 auto 1rem; display: block;">
                    <p>Comece a gerenciar seus alunos hoje mesmo</p>
                </div>

                <button class="btn btn-google btn-block btn-lg mb-md" onclick="auth.loginWithGoogle('personal')" style="background: #fff; color: #333; display: flex; align-items: center; justify-content: center; gap: 10px; border: 1px solid var(--border);">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" style="width: 20px;">
                    Cadastrar com Google
                </button>

                <div class="divider text-center mb-md" style="opacity: 0.5;">ou preencha seus dados</div>
                
                <form id="personal-register-form">
                    <div class="form-group">
                        <label class="form-label">Nome Completo *</label>
                        <input type="text" class="form-input" id="p-name" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Email Profissional *</label>
                        <input type="email" class="form-input" id="p-email" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">CPF * (Apenas números)</label>
                        <input type="text" class="form-input" id="p-cpf" placeholder="000.000.000-00" maxlength="14" required>
                    </div>

                    <div class="grid grid-2">
                         <div class="form-group">
                            <label class="form-label">Telefone (WhatsApp) *</label>
                            <input type="tel" class="form-input" id="p-phone" placeholder="11911917087" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">CREF</label>
                            <input type="text" class="form-input" id="p-cref" placeholder="000000-G/SP">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Especialidade Principal</label>
                         <select class="form-select" id="p-specialty">
                            <option value="Musculação">Musculação</option>
                            <option value="Funcional">Funcional</option>
                            <option value="Crossfit">Crossfit</option>
                            <option value="Pilates">Pilates</option>
                            <option value="Corrida">Corrida</option>
                            <option value="Emagrecimento">Emagrecimento</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Senha *</label>
                        <input type="password" class="form-input" id="p-password" required>
                    </div>
                    
                    <!-- WAZE FITNESS INTEGRATION -->
                    <div class="card p-md border-shadow" style="background: rgba(99, 102, 241, 0.05); border: 1px solid var(--primary-light); border-radius: 12px; margin-top: 20px; margin-bottom: 20px;">
                        <h4 class="mb-xs" style="color: var(--primary);">Academia onde você atua (Opcional)</h4>
                        <p class="text-xs text-muted mb-md">Informe o endereço correto da academia para que ela apareça no mapa do Waze Fitness e alunos encontrem você.</p>
                        
                        <div class="form-group">
                            <label class="form-label">Nome da Academia</label>
                            <input type="text" class="form-input" id="p-gym-name" placeholder="Ex: Iron Gym Fitness">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Endereço (Rua/Avenida)</label>
                            <input type="text" class="form-input" id="p-gym-address" placeholder="Ex: Av. Paulista">
                        </div>
                        <div class="grid grid-3 gap-sm">
                            <div class="form-group" style="grid-column: span 1;">
                                <label class="form-label">Número</label>
                                <input type="text" class="form-input" id="p-gym-number" placeholder="1234">
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label class="form-label">Cidade / Estado</label>
                                <input type="text" class="form-input" id="p-gym-city" placeholder="São Paulo - SP">
                            </div>
                        </div>
                    </div>

                    <div class="form-group mb-md" style="margin-top: 15px;">
                        <label class="flex items-center gap-sm cursor-pointer" style="font-weight: normal; font-size: 0.8rem;">
                            <input type="checkbox" id="p-privacy" required>
                            <span>Eu li e concordo com a <a href="#" onclick="router.navigate('/privacy'); return false;" class="text-primary hover:underline">Política de Privacidade</a>.</span>
                        </label>
                    </div>

                    <button type="submit" class="btn btn-secondary btn-block">Criar Conta Profissional</button>
                </form>

                <div class="mt-md">
                    <button class="btn btn-ghost btn-block" onclick="window.router.navigate('/')">
                        ← Voltar
                    </button>
                </div>
            </div>
        </div>
    `;

    window.googlePreFill = null;
    const isGoogleSignUp = false;

    // CPF Mask
    document.getElementById('p-cpf').addEventListener('input', (e) => {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
        e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
    });

    document.getElementById('personal-register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('p-name').value;
        const email = document.getElementById('p-email').value;
        const password = document.getElementById('p-password').value;
        const phone = document.getElementById('p-phone').value;
        const cpfRaw = document.getElementById('p-cpf').value;
        const cpf = cpfRaw.replace(/\D/g, ''); // Remove formatting
        const cref = document.getElementById('p-cref').value;
        const specialty = document.getElementById('p-specialty').value;

        UI.showLoading('Criando sua conta profissional...');
        try {
            // Check if email already exists with a different role
            const existingRole = await auth.checkEmailRole(email);
            if (existingRole) {
                UI.hideLoading();
                if (existingRole === 'personal') {
                    UI.showNotification('Email em uso', 'Este email já possui uma conta de Personal Trainer. Tente fazer login.', 'warning');
                } else {
                    const roleLabel = existingRole === 'student' ? 'Aluno' : 'Admin';
                    UI.showNotification('Conflito de Conta', `Este email já está cadastrado como ${roleLabel}. Não é possível usar o mesmo email para papéis diferentes.`, 'error');
                }
                return;
            }

            let userData = {
                name,
                role: 'personal', // IMPORTANTE para o Trigger
                cpf,
                phone,
                cref,
                specialty,
                status: 'active',
                paymentStatus: 'pending',
                planId: null,
                trialUsed: false,
                signupDate: new Date().toISOString()
            };

            // Process WAZE FITNESS GYM (Mapbox Geocoding)
            const gymName = document.getElementById('p-gym-name').value.trim();
            const gymAddress = document.getElementById('p-gym-address').value.trim();
            const gymNumber = document.getElementById('p-gym-number').value.trim();
            const gymCity = document.getElementById('p-gym-city').value.trim();

            let finalGymId = null;

            if (gymName && gymAddress) {
                const fullAddressString = `${gymAddress}, ${gymNumber}, ${gymCity}`;
                UI.showLoading('Localizando CEP da base...');

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
                            // Create the gym directly
                            const newGymRes = await window.supabase.from('gyms').insert({
                                name: gymName,
                                address: gymAddress,
                                number: gymNumber,
                                city: gymCity,
                                state: gymCity.split('-')[1] ? gymCity.split('-')[1].trim() : '',
                                latitude: lat,
                                longitude: lng
                            }).select().single();

                            if (newGymRes.data) {
                                finalGymId = newGymRes.data.id;
                            }
                        }
                    }
                } catch (geoErr) {
                    console.warn("Waze Fitness Geocoding Error:", geoErr);
                }
            }

            if (finalGymId) userData.gym_id = finalGymId;

            UI.showLoading('Confirmando...');
            localStorage.setItem('tfit_pending_role', 'personal');
            const result = await auth.signUp(email, password, userData);

            UI.hideLoading();
            if (result.success) {
                // Instala o vinculo de academia rapidamente apos criacao de auth profile
                if (finalGymId && result.user) {
                    await window.supabase.from('profiles').update({ gym_id: finalGymId }).eq('id', result.user.id);
                }

                if (result.requireConfirmation) {
                    UI.showNotification('Sucesso!', 'Conta criada! Verifique seu e-mail para confirmar o cadastro profissional.', 'success');
                    setTimeout(() => router.navigate('/'), 3000);
                } else {
                    UI.showNotification('Sucesso!', 'Conta profissional criada! Redirecionando...', 'success');
                    // Delay para trigger do Supabase
                    setTimeout(() => router.navigate('/personal/dashboard'), 1500);
                }

                // Show Install Guide
                setTimeout(() => UI.showInstallGuide(), 2000);
            } else {
                UI.showNotification('Erro', result.message, 'error');
            }
        } catch (error) {
            UI.hideLoading();
            UI.showNotification('Erro', error.message, 'error');
        }
    });
});
