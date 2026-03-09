// ============================================
// PERSONAL - WORKOUTS MANAGEMENT
// ============================================

router.addRoute('/personal/workouts', (params) => {
    if (!auth.requireAuth('personal')) return;

    const currentUser = auth.getCurrentUser();
    const students = db.query('profiles', s => s.assigned_personal_id === currentUser.id);
    const limitInfo = getPersonalLimitInfo(currentUser.id);
    let activeCount = 0;
    const sortedStudents = students.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    const selectedStudentId = params.studentId || '';

    const content = `
        <div class="page-header">
            <h1 class="page-title">Gestão de Treinos</h1>
            <p class="page-subtitle">Crie e gerencie treinos personalizados</p>
        </div>

        <div class="card mb-xl">
            <div class="card-header">
                <h3 class="card-title">Criar Novo Treino com IA</h3>
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Selecione o Aluno *</label>
                    <select class="form-select" id="workout-student" required>
                        <option value="">Escolha um aluno...</option>
                        ${sortedStudents.map(s => {
        let isOverLimit = false;
        if (s.status === 'active') {
            activeCount++;
            if (limitInfo.maxStudents > 0 && activeCount > limitInfo.maxStudents) {
                isOverLimit = true;
            }
        }
        return `<option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''} ${isOverLimit ? 'disabled' : ''}>
                                    ${s.name} ${isOverLimit ? '(⚠️ Limite Excedido)' : ''}
                                </option>`;
    }).join('')}
                    </select>
                </div>

                <button type="button" class="btn btn-primary btn-ai-glow btn-block" onclick="generateWorkoutWithAI()">
                    🤖 Gerar Treino com IA T-FIT
                </button>

                <div id="exercises-container" class="mt-lg" style="display: none;">
                    <h4 class="mb-md">Exercícios do Treino</h4>
                    <div id="exercises-list"></div>
                    <button class="btn btn-primary mt-md" onclick="saveWorkout()">
                        💾 Salvar Treino
                    </button>
                </div>
            </div>
        </div>

        <script>
            setTimeout(() => {
                const rawHash = window.location.hash || '';
                const parts = rawHash.split('?');
                const urlParams = new URLSearchParams(parts[1] || '');
                const mode = urlParams.get('mode');
                
                if (mode === 'ai') {
                    if (!window._aiWizardOpened) {
                        window._aiWizardOpened = true;
                        
                        // Clean the URL so refreshing the route won't trigger this again
                        if (window.history.replaceState) {
                            window.history.replaceState(null, '', parts[0]);
                        }
                        
                        const btn = document.querySelector('button[onclick="generateWorkoutWithAI()"]');
                        if (btn) {
                            btn.classList.add('btn-ai-glow');
                            btn.click();
                        }
                    }
                } else if (mode === 'manual') {
                    const btn = document.querySelector('button[onclick="addExerciseManually()"]');
                    if (btn) btn.scrollIntoView({ behavior: 'smooth' });
                }
            }, 500);
        </script>

        <!-- List Existing Workouts -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Treinos Cadastrados</h3>
            </div>
            <div class="card-body">
                <div id="workouts-list">
                    ${renderWorkoutsList()}
                </div>
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'personal');
});

function renderWorkoutsList() {
    const currentUser = auth.getCurrentUser();
    const workouts = db.query('workouts', w => w && w.personal_id == currentUser.id);

    if (workouts.length === 0) {
        return '<p class="text-muted text-center">Nenhum treino cadastrado ainda</p>';
    }

    return `
        <div class="grid grid-2">
            ${workouts.map(w => `
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title">${w.name}</h4>
                        <p class="text-muted" style="font-size: 0.875rem;">Aluno: ${w.student_name || 'N/A'}</p>
                    </div>
                    <div class="card-body">
                            <div class="flex justify-between">
                                <span class="text-muted">Foco:</span>
                                <span>${w.type}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Exercícios:</span>
                                <span class="badge badge-primary">${w.exercises.length}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Duração:</span>
                                <span>${w.duration} min</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer flex gap-sm">
                        <button class="btn btn-sm btn-ghost" onclick="viewWorkoutDetails('${w.id}')">
                            👁️ Ver Detalhes
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="editWorkout('${w.id}')">
                            📝 Editar
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteWorkout('${w.id}')">
                            🗑️ Excluir
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Toggle fields based on mode
window.toggleGenMode = () => {
    const mode = document.querySelector('input[name="gen-mode"]:checked').value;
    const focusGroup = document.getElementById('focus-group');
    const nameGroup = document.getElementById('name-group');

    if (mode === 'split') {
        focusGroup.style.display = 'none';
        nameGroup.style.display = 'none';
    } else {
        focusGroup.style.display = 'block';
        nameGroup.style.display = 'block';
    }
};

let currentExercises = [];
let editingWorkoutId = null;
let generatedWorkoutsBatch = []; // For split generation

window.generateWorkoutWithSystem = () => {
    generateWorkoutWithAI('manual');
};

const _originalGenerateWorkoutWithAI = window.generateWorkoutWithAI;
window.generateWorkoutWithAI = (method = 'ai') => {
    if (window._isGeneratingWorkout) {
        UI.showNotification('Aguarde', 'Já existe uma geração em andamento.', 'info');
        return;
    }

    const studentSelect = document.getElementById('workout-student');
    if (!studentSelect) return;
    const studentId = studentSelect.value;
    if (!studentId) {
        UI.showNotification('Erro', 'Selecione um aluno primeiro', 'error');
        return;
    }

    const currentUser = auth.getCurrentUser();
    PaymentHelper.handlePremiumAction('Gerar Treino', currentUser, () => {
        const student = db.getById('profiles', studentId);
        if (!student) return;

        startWorkoutWizard(student);
    }, 'ai');
};

function startWorkoutWizard(student) {


    // AI Wizard logic
    let step = 1;
    let answers = {
        'wiz-age': student.age || '',
        'wiz-height': student.height || '',
        'wiz-weight': student.weight || '',
        'wiz-sex': student.sex === 'male' ? 'Masculino' : (student.sex === 'female' ? 'Feminino' : 'Prefiro não informar')
    };

    const renderStep = () => {
        let title = '';
        let content = '';

        if (step === 1) {
            title = '📋 Sobre você';
            content = `
                <div class="form-group">
                    <label class="form-label">Idade</label>
                    <input type="number" class="form-input" id="wiz-age" value="${answers['wiz-age']}" placeholder="Anos">
                </div>
                <div class="form-group">
                    <label class="form-label">Sexo</label>
                    <select class="form-select" id="wiz-sex">
                        <option value="Feminino" ${answers['wiz-sex'] === 'Feminino' ? 'selected' : ''}>Feminino</option>
                        <option value="Masculino" ${answers['wiz-sex'] === 'Masculino' ? 'selected' : ''}>Masculino</option>
                        <option value="Prefiro não informar" ${answers['wiz-sex'] === 'Prefiro não informar' ? 'selected' : ''}>Prefiro não informar</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Altura (cm)</label>
                    <input type="number" class="form-input" id="wiz-height" value="${answers['wiz-height']}" placeholder="Ex: 170">
                </div>
                <div class="form-group">
                    <label class="form-label">Peso atual (kg)</label>
                    <input type="number" class="form-input" id="wiz-weight" value="${answers['wiz-weight']}" placeholder="Ex: 70">
                </div>
                <div class="form-group">
                    <label class="form-label">Você se considera iniciante, intermediário ou avançado?</label>
                    <select class="form-select" id="wiz-level">
                        <option value="Iniciante" ${answers['wiz-level'] === 'Iniciante' ? 'selected' : ''}>Iniciante</option>
                        <option value="Intermediário" ${answers['wiz-level'] === 'Intermediário' ? 'selected' : ''}>Intermediário</option>
                        <option value="Avançado" ${answers['wiz-level'] === 'Avançado' ? 'selected' : ''}>Avançado</option>
                    </select>
                </div>
            `;
        } else if (step === 2) {
            title = '🎯 Objetivo principal';
            content = `
                <div class="form-group">
                    <label class="form-label">Qual é o seu objetivo?</label>
                    <p class="text-xs text-muted mb-xs">Ex: ganhar massa, emagrecer, definir, melhorar condicionamento, força, saúde...</p>
                    <select class="form-select" id="wiz-goal">
                        <option value="Ganhar massa muscular">Ganhar massa muscular</option>
                        <option value="Emagrecer">Emagrecer</option>
                        <option value="Definir">Definir</option>
                        <option value="Melhorar condicionamento">Melhorar condicionamento</option>
                        <option value="Ganhar força">Ganhar força</option>
                        <option value="Saúde e bem-estar">Saúde e bem-estar</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Tem algum prazo ou meta específica?</label>
                    <textarea class="form-input" id="wiz-deadline" rows="2" placeholder="Ex: Quero perder 5kg em 3 meses, ou apenas descreva sua meta...">${answers['wiz-deadline'] || ''}</textarea>
                </div>
            `;
        } else if (step === 3) {
            title = '🏋️ Experiência e rotina';
            content = `
                <div class="form-group">
                    <label class="form-label">Já treina há quanto tempo?</label>
                    <select class="form-select" id="wiz-experience">
                        <option value="Nunca treinei">Nunca treinei</option>
                        <option value="Menos de 6 meses">Menos de 6 meses</option>
                        <option value="6 meses a 1 ano">6 meses a 1 ano</option>
                        <option value="1 a 2 anos">1 a 2 anos</option>
                        <option value="Mais de 2 anos">Mais de 2 anos</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Quantos dias por semana pode treinar?</label>
                    <select class="form-select" id="wiz-days">
                        <option value="2">2 dias</option>
                        <option value="3">3 dias</option>
                        <option value="4">4 dias</option>
                        <option value="5">5 dias</option>
                        <option value="6">6 dias</option>
                        <option value="7">7 dias</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Quanto tempo por treino?</label>
                    <select class="form-select" id="wiz-time">
                        <option value="30 minutos">30 minutos</option>
                        <option value="45 minutos">45 minutos</option>
                        <option value="1 hora">1 hora</option>
                        <option value="Mais de 1 hora">Mais de 1 hora</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Treina em academia, em casa ou ao ar livre?</label>
                    <select class="form-select" id="wiz-location">
                        <option value="Academia">Academia</option>
                        <option value="Em casa">Em casa</option>
                        <option value="Ao ar livre">Ao ar livre</option>
                        <option value="Varia">Varia</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Quantidade de exercícios desejada por treino</label>
                    <select class="form-select" id="wiz-num-exercises">
                        <option value="4">4 exercícios</option>
                        <option value="5">5 exercícios</option>
                        <option value="6">6 exercícios</option>
                        <option value="7-8" selected>7-8 exercícios</option>
                        <option value="9-10">9-10 exercícios</option>
                        <option value="Mais de 10">Mais de 10 exercícios</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Quantidade de séries sugerida</label>
                    <select class="form-select" id="wiz-series-count">
                        <option value="2">2 séries</option>
                        <option value="3" selected>3 séries</option>
                        <option value="4">4 séries</option>
                        <option value="5">5 séries</option>
                    </select>
                </div>
            `;
        } else if (step === 4) {
            title = '⚠️ Saúde e limitações';
            content = `
                <div class="form-group">
                    <label class="form-label">Tem alguma lesão, dor ou problema de saúde?</label>
                    <textarea class="form-input" id="wiz-health" rows="3" placeholder="Descreva aqui qualquer lesão, dor ou problema de saúde que você tenha, ou deixe em branco se não tiver nada...">${answers['wiz-health'] || ''}</textarea>
                    <p class="text-xs text-muted mt-xs">Ex: Dor no joelho direito, problema na coluna lombar, hipertensão, etc.</p>
                </div>
            `;
        } else if (step === 5) {
            title = '🥗 Alimentação e recuperação';
            content = `
                <div class="form-group">
                    <label class="form-label">Como é sua alimentação hoje?</label>
                    <select class="form-select" id="wiz-nutrition">
                        <option value="Organizada">Organizada 👍</option>
                        <option value="Mais ou menos">Mais ou menos 🤷</option>
                        <option value="Bagunçada">Bagunçada 😅</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Dorme quantas horas por noite, em média?</label>
                    <select class="form-select" id="wiz-sleep">
                        <option value="Menos de 5 horas">Menos de 5 horas</option>
                        <option value="5-6 horas">5-6 horas</option>
                        <option value="7-8 horas">7-8 horas</option>
                        <option value="Mais de 8 horas">Mais de 8 horas</option>
                    </select>
                </div>
            `;
        } else if (step === 6) {
            title = '🔥 Preferências pessoais';
            content = `
                <div class="form-group">
                    <label class="form-label">Prefere treinos mais curtos e intensos ou mais longos e tranquilos?</label>
                    <select class="form-select" id="wiz-intensity">
                        <option value="Curtos e intensos">Curtos e intensos</option>
                        <option value="Longos e tranquilos">Longos e tranquilos</option>
                        <option value="Equilibrado">Equilibrado</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Gosta de cardio? Se sim, qual?</label>
                    <input type="text" class="form-input" id="wiz-cardio" value="${answers['wiz-cardio'] || ''}" placeholder="Ex: Corrida, bicicleta, ou deixe em branco se não gosta">
                </div>
                <div class="form-group">
                    <label class="form-label">Quer algo mais simples ou mais variado/desafiador?</label>
                    <select class="form-select" id="wiz-complexity">
                        <option value="Mais simples">Mais simples</option>
                        <option value="Mais variado/desafiador">Mais variado/desafiador</option>
                        <option value="Equilibrado">Equilibrado</option>
                    </select>
                </div>
            `;
        }

        const modalHtml = `
            <div class="wizard-container">
                <div class="wiz-progress mb-lg" style="height: 4px; background: #eee; border-radius: 2px;">
                    <div style="height: 100%; width: ${(step / 6) * 100}%; background: var(--primary); transition: width 0.3s;"></div>
                </div>
                
                ${content}

                <div class="flex flex-col gap-sm mt-xl pt-md border-t">
                    <div class="flex justify-between items-center mb-sm">
                        ${step > 1 ? `<button class="btn btn-ghost" onclick="window.prevWizStep()">← Voltar</button>` : '<div></div>'}
                        ${step < 6 ? `<button class="btn btn-primary" onclick="window.nextWizStep()">Próximo →</button>` : ''}
                    </div>

                    ${step === 6 ? `
                        <div class="text-center">
                            <button class="btn btn-primary btn-ai-glow btn-block" onclick="window.nextWizStep()">
                                🤖 Gerar Treino com IA
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        UI.showModal(title, modalHtml);
    };

    window.prevWizStep = () => { if (step > 1) { step--; renderStep(); } };

    window.nextWizStep = () => {
        if (step === 1) {
            answers['wiz-age'] = document.getElementById('wiz-age').value;
            answers['wiz-sex'] = document.getElementById('wiz-sex').value;
            answers['wiz-height'] = document.getElementById('wiz-height').value;
            answers['wiz-weight'] = document.getElementById('wiz-weight').value;
            answers['wiz-level'] = document.getElementById('wiz-level').value;
            if (!answers['wiz-age'] || !answers['wiz-height'] || !answers['wiz-weight']) return UI.showNotification('Erro', 'Preencha todos os campos obrigatórios!', 'warning');
        } else if (step === 2) {
            answers['wiz-goal'] = document.getElementById('wiz-goal').value;
            answers['wiz-deadline'] = document.getElementById('wiz-deadline').value;
        } else if (step === 3) {
            answers['wiz-experience'] = document.getElementById('wiz-experience').value;
            answers['wiz-days'] = document.getElementById('wiz-days').value;
            answers['wiz-time'] = document.getElementById('wiz-time').value;
            answers['wiz-location'] = document.getElementById('wiz-location').value;
            answers['wiz-num-exercises'] = document.getElementById('wiz-num-exercises').value;
            answers['wiz-series-count'] = document.getElementById('wiz-series-count').value;
        } else if (step === 4) {
            answers['wiz-health'] = document.getElementById('wiz-health').value;
        } else if (step === 5) {
            answers['wiz-nutrition'] = document.getElementById('wiz-nutrition').value;
            answers['wiz-sleep'] = document.getElementById('wiz-sleep').value;
        } else if (step === 6) {
            answers['wiz-intensity'] = document.getElementById('wiz-intensity').value;
            answers['wiz-cardio'] = document.getElementById('wiz-cardio').value;
            answers['wiz-complexity'] = document.getElementById('wiz-complexity').value;

            // FINISH
            finishWorkoutGenForPersonal(student.id, answers);
            return;
        }
        step++;
        renderStep();
    };

    renderStep();
};

const finishWorkoutGenForPersonal = async (studentId, data) => {
    if (window._isGeneratingWorkout) return;
    window._isGeneratingWorkout = true;

    const student = db.getById('profiles', studentId);
    const currentUser = auth.getCurrentUser();
    UI.showLoading('IA T-FIT Gerando Treino...');

    try {
        if (!student) throw new Error("Estudante não encontrado no banco de dados.");

        // Determine number of exercises per workout
        const numExRaw = data['wiz-num-exercises'] || '7-8';
        let targetNumEx = 8;
        if (numExRaw === '4') targetNumEx = 4;
        else if (numExRaw === '5') targetNumEx = 5;
        else if (numExRaw === '6') targetNumEx = 6;
        else if (numExRaw === '5-6') targetNumEx = 6;
        else if (numExRaw === '7-8') targetNumEx = 8;
        else if (numExRaw === '9-10') targetNumEx = 10;
        else if (numExRaw === 'Mais de 10') targetNumEx = 12;

        // Auto-determine number of workout DAYS/SPLITS
        const daysNum = parseInt(data['wiz-days']) || 3;
        let numWorkouts = 1;
        if (daysNum >= 2 && daysNum <= 3) numWorkouts = daysNum;
        else if (daysNum >= 4 && daysNum <= 5) numWorkouts = daysNum - 1;
        else if (daysNum >= 6) numWorkouts = 5;

        const splits = await AIHelper.generateWeeklySplit({
            ...data,
            numWorkouts: numWorkouts,
            targetNumEx: targetNumEx,
            daysPerWeek: data['wiz-days'],
            specificGoal: data['wiz-goal'],
            deadline: data['wiz-deadline'],
            level: data['wiz-level'],
            experienceTime: data['wiz-experience'],
            restrictions: data['wiz-health'] || 'Nenhuma',
            numExercises: data['wiz-num-exercises'],
            nutrition: data['wiz-nutrition'],
            intensity: data['wiz-intensity'],
            cardio: data['wiz-cardio'],
            complexity: data['wiz-complexity'],
            seriesCount: data['wiz-series-count'],
            studentName: student.name
        });

        if (!splits || !Array.isArray(splits) || splits.length === 0) {
            throw new Error("Não foi possível gerar sugestões de treino. Tente novamente.");
        }

        generatedWorkoutsBatch = splits;

        // Update Student Profile (Defensive against missing columns)
        try {
            await db.update('profiles', studentId, {
                weight: parseFloat(data['wiz-weight']) || null,
                height: parseFloat(data['wiz-height']) || null,
                age: parseInt(data['wiz-age']) || null,
                goal: data['wiz-goal'],
                level: data['wiz-level'],
                sleep: data['wiz-sleep'],
                injuries: data['wiz-health'] || 'Nenhuma'
            }, { silent: true });
        } catch (updateErr) {
            console.warn("Aviso: Falha ao atualizar métricas do perfil (provável coluna faltante):", updateErr.message);
        }

        // SAVE AUTOMATICALLY - User can edit later from the list
        for (const w of splits) {
            await db.create('workouts', {
                name: w.name || 'Treino Gerado',
                type: w.type || 'Padrão',
                duration: parseInt(w.duration) || 60,
                exercises: w.exercises || [],
                student_id: studentId,
                student_name: student.name,
                personal_id: currentUser.id,
                personal_name: currentUser.name,
                muscle_groups: w.muscle_groups || [],
                rationale: splits.rationale || ""
            }, { silent: true });
        }

        UI.hideLoading();
        UI.closeModal();
        UI.showNotification('Treinos Salvos!', 'Os treinos foram gerados e salvos automaticamente. Você pode editá-los na lista abaixo.', 'success');

        // Refresh list
        const listDiv = document.getElementById('workouts-list');
        if (listDiv) listDiv.innerHTML = renderWorkoutsList();

        const rationale = splits.rationale || "";
        if (rationale) {
            UI.showModal('Análise da IA 🤖', `
                <div class="card p-md bg-light border-primary" style="border-left: 4px solid var(--primary);">
                    <p class="text-sm"><strong>Estratégia do Treino:</strong></p>
                    <p class="text-xs text-muted mt-xs italic">"${rationale}"</p>
                </div>
                <button class="btn btn-primary btn-block mt-md" onclick="UI.closeModal()">Entendido</button>
            `);
        }
    } catch (error) {
        console.error('AI Generation Error:', error);
        UI.hideLoading();
        UI.showNotification('Erro', error.message || 'A geração via IA falhou.', 'error');
    } finally {
        window._isGeneratingWorkout = false;
    }
};

window.addExerciseManually = () => {
    const modalContent = `
        <form id="add-exercise-form">
            <div class="form-group">
                <label class="form-label">Nome do Exercício *</label>
                <input type="text" class="form-input" id="exercise-name" required>
            </div>
            <div class="grid grid-3">
                <div class="form-group">
                    <label class="form-label">Séries *</label>
                    <input type="number" class="form-input" id="exercise-series" value="3" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Repetições *</label>
                    <input type="text" class="form-input" id="exercise-reps" value="12" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Descanso *</label>
                    <input type="text" class="form-input" id="exercise-rest" value="60s" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Observações</label>
                <textarea class="form-textarea" id="exercise-notes" placeholder="Ex: Manter a postura correta"></textarea>
            </div>
        </form>
    `;

    UI.showModal('Adicionar Exercício', modalContent, () => {
        const exercise = {
            name: document.getElementById('exercise-name').value,
            series: parseInt(document.getElementById('exercise-series').value),
            reps: document.getElementById('exercise-reps').value,
            rest: document.getElementById('exercise-rest').value,
            notes: document.getElementById('exercise-notes').value
        };

        currentExercises.push(exercise);
        displayExercises();
        UI.showNotification('Sucesso!', 'Exercício adicionado', 'success');
    });
};

function displayExercises() {
    const container = document.getElementById('exercises-container');
    const list = document.getElementById('exercises-list');

    if (currentExercises.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // If coming from split view, hide batch view if exists
    const batchDiv = document.getElementById('batch-container');
    if (batchDiv) batchDiv.style.display = 'none';

    list.innerHTML = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 40%">Exercício</th>
                        <th style="width: 15%">Séries</th>
                        <th style="width: 15%">Reps</th>
                        <th style="width: 15%">Descanso</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="exercises-tbody">
                    ${currentExercises.map((ex, index) => `
                        <tr>
                            <td><input type="text" class="form-input p-xs" value="${ex.name}" onchange="updateExercise(${index}, 'name', this.value)"></td>
                            <td><input type="number" class="form-input p-xs" value="${ex.series}" onchange="updateExercise(${index}, 'series', this.value)"></td>
                            <td><input type="text" class="form-input p-xs" value="${ex.reps}" onchange="updateExercise(${index}, 'reps', this.value)"></td>
                            <td><input type="text" class="form-input p-xs" value="${ex.rest || '60s'}" onchange="updateExercise(${index}, 'rest', this.value)"></td>
                            <td>
                                <button class="btn btn-sm btn-ghost text-danger" onclick="removeExercise(${index})">✖</button>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="5" style="padding-top: 0; padding-bottom: 10px;">
                                <input type="text" class="form-input p-xs text-muted text-sm" value="${ex.notes || ''}" placeholder="Observações..." onchange="updateExercise(${index}, 'notes', this.value)" style="border: none; background: transparent; width: 100%;">
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <button class="btn btn-sm btn-outline mt-sm" onclick="addExerciseManually()">+ Adicionar Linha</button>
        </div>
    `;

    // Ensure save button is visible and correct
    const saveBtn = document.querySelector('#exercises-container > button.btn-primary');
    if (saveBtn) {
        saveBtn.style.display = 'block';
        if (editingWorkoutId) {
            saveBtn.innerText = '💾 Salvar Alterações';
            saveBtn.onclick = () => window.updateExistingWorkout(editingWorkoutId);
        } else {
            saveBtn.innerText = '💾 Salvar Treino';
            saveBtn.onclick = window.saveWorkout;
        }
    }
}

window.editWorkout = (id) => {
    const workout = db.getById('workouts', id);
    if (!workout) return;

    editingWorkoutId = id;
    currentExercises = JSON.parse(JSON.stringify(workout.exercises)); // Deep copy

    // Set student in select
    const studentSelect = document.getElementById('workout-student');
    if (studentSelect) {
        studentSelect.value = workout.student_id;
    }

    displayExercises();

    // Scroll to editor
    const container = document.getElementById('exercises-container');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth' });
        const titleEl = container.querySelector('h4');
        if (titleEl) titleEl.innerText = `Editando Treino: ${workout.name}`;
    }
};

window.updateExistingWorkout = async (id) => {
    if (currentExercises.length === 0) {
        UI.showNotification('Erro', 'O treino deve ter pelo menos um exercício.', 'warning');
        return;
    }

    UI.showLoading('Salvando alterações...');
    try {
        await db.update('workouts', id, {
            exercises: currentExercises,
            updated_at: new Date().toISOString()
        });

        UI.hideLoading();
        UI.showNotification('Sucesso', 'Treino atualizado com sucesso!', 'success');

        // Reset
        editingWorkoutId = null;
        currentExercises = [];
        const container = document.getElementById('exercises-container');
        if (container) {
            container.style.display = 'none';
            const titleEl = container.querySelector('h4');
            if (titleEl) titleEl.innerText = 'Exercícios do Treino';
        }

        // Refresh list
        const listDiv = document.getElementById('workouts-list');
        if (listDiv) listDiv.innerHTML = renderWorkoutsList();

    } catch (err) {
        UI.hideLoading();
        UI.showNotification('Erro', 'Falha ao salvar: ' + err.message, 'error');
    }
};

window.updateExercise = (index, field, value) => {
    currentExercises[index][field] = value;
};

window.removeExercise = (index) => {
    currentExercises.splice(index, 1);
    displayExercises();
};

// Display for Split (Batch)
function displayBatchWorkouts() {
    const container = document.getElementById('exercises-container');
    container.style.display = 'block';

    let batchDiv = document.getElementById('batch-container');
    if (!batchDiv) {
        batchDiv = document.createElement('div');
        batchDiv.id = 'batch-container';
        container.insertBefore(batchDiv, container.firstChild);
    } else {
        batchDiv.style.display = 'block';
    }

    document.getElementById('exercises-list').innerHTML = '';

    batchDiv.innerHTML = `
        <div class="flex justify-between items-center mb-md">
            <div>
                <h4 class="mb-xs">Treinos Gerados (${generatedWorkoutsBatch.length})</h4>
                <p class="text-sm text-muted">Ajuste os exercícios abaixo se desejar antes de salvar.</p>
            </div>
        </div>

        <div class="flex flex-col gap-lg">
            ${generatedWorkoutsBatch.map((w, wIndex) => `
                <div class="card p-md shadow-sm" style="border: 1px solid var(--border); border-top: 4px solid var(--primary);">
                    <div class="flex justify-between items-center mb-md">
                        <input type="text" class="form-input font-bold text-primary" value="${w.name}" 
                               style="border:none; background:transparent; font-size:1.1rem; width:70%;"
                               onchange="generatedWorkoutsBatch[${wIndex}].name = this.value">
                        <button class="btn btn-xs btn-ghost text-danger" onclick="generatedWorkoutsBatch.splice(${wIndex},1); displayBatchWorkouts();">✖ Remover Treino</button>
                    </div>
                    
                    <div class="table-container">
                        <table class="table mb-sm">
                            <thead>
                                <tr style="background: rgba(0,0,0,0.02);">
                                    <th style="width: 40%">Exercício</th>
                                    <th>Séries</th>
                                    <th>Reps</th>
                                    <th>Descanso</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${w.exercises.map((ex, exIdx) => `
                                    <tr>
                                        <td><input type="text" class="form-input p-xs text-sm" value="${ex.name}" onchange="generatedWorkoutsBatch[${wIndex}].exercises[${exIdx}].name = this.value"></td>
                                        <td><input type="number" class="form-input p-xs text-sm" value="${ex.series}" onchange="generatedWorkoutsBatch[${wIndex}].exercises[${exIdx}].series = this.value" style="width:40px"></td>
                                        <td><input type="text" class="form-input p-xs text-sm" value="${ex.reps}" onchange="generatedWorkoutsBatch[${wIndex}].exercises[${exIdx}].reps = this.value" style="width:60px"></td>
                                        <td><input type="text" class="form-input p-xs text-sm" value="${ex.rest || '60s'}" onchange="generatedWorkoutsBatch[${wIndex}].exercises[${exIdx}].rest = this.value" style="width:60px"></td>
                                        <td><button class="btn btn-xs btn-ghost text-danger" onclick="generatedWorkoutsBatch[${wIndex}].exercises.splice(${exIdx},1); displayBatchWorkouts();">✖</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <button class="btn btn-xs btn-outline btn-block mt-xs" onclick="generatedWorkoutsBatch[${wIndex}].exercises.push({name: 'Novo Exercício', series: 3, reps: '12', rest: '60s'}); displayBatchWorkouts();">
                        + Adicionar Exercício ao ${w.name.split('-')[0].trim()}
                    </button>
                </div>
            `).join('')}
        </div>

        <div class="mt-xl pt-lg mb-xl bg-light p-md rounded-xl border-dashed" style="border: 2px dashed var(--border);">
            <button class="btn btn-primary btn-lg btn-block shadow-glow" onclick="window.saveBatchWorkouts()">
                🚀 Salvar e Enviar para o Aluno
            </button>
            <button class="btn btn-ghost btn-block mt-sm" onclick="if(confirm('Descartar estes treinos?')) { generatedWorkoutsBatch = []; document.getElementById('exercises-container').style.display='none'; }">
                🗑️ Descartar Geração
            </button>
        </div>
    `;

    const saveBtn = document.querySelector('#exercises-container > button.btn-primary');
    if (saveBtn) saveBtn.style.display = 'none';
}

window.editBatchWorkout = (index) => {
    // Load specific workout into single editor
    currentExercises = [...generatedWorkoutsBatch[index].exercises]; // Copy

    // Set form title temporarily (visual only since we are in batch mode)
    const workoutNameEl = document.getElementById('workout-name');
    if (workoutNameEl) workoutNameEl.value = generatedWorkoutsBatch[index].name;

    // Show single editor
    displayExercises();

    // Change save button to "Update Batch"
    const saveBtn = document.querySelector('#exercises-container > button.btn-primary');
    saveBtn.innerText = '✅ Atualizar na Lista';
    saveBtn.style.display = 'block';

    // Override save function
    saveBtn.onclick = () => {
        generatedWorkoutsBatch[index].exercises = [...currentExercises];
        // Note: we don't update name from input as input is hidden in split mode

        displayBatchWorkouts(); // Go back to batch view

        // Reset save button properties handled by displayExercises next time
    };
};

window.saveBatchWorkouts = async () => {
    const studentId = document.getElementById('workout-student').value;
    const currentUser = auth.getCurrentUser();
    const student = db.getById('profiles', studentId);

    UI.showLoading('Salvando treinos...');
    try {
        if (!student) throw new Error("Selecione um aluno válido antes de salvar.");

        for (const w of generatedWorkoutsBatch) {
            await db.create('workouts', {
                name: w.name || 'Treino Gerado',
                type: w.type || 'Padrão',
                duration: parseInt(w.duration) || 60,
                exercises: w.exercises || [],
                student_id: studentId,
                student_name: student.name,
                personal_id: currentUser.id,
                personal_name: currentUser.name,
                muscle_groups: w.muscle_groups || []
            });
        }
        UI.hideLoading();
        UI.showNotification('Sucesso', `${generatedWorkoutsBatch.length} treinos criados!`, 'success');
    } catch (err) {
        UI.hideLoading();
        console.error("Erro ao salvar lote de treinos:", err);
        UI.showNotification('Erro', 'Não foi possível salvar os treinos: ' + err.message, 'error');
    }
    generatedWorkoutsBatch = [];
    document.getElementById('workout-student').value = '';
    document.getElementById('exercises-container').style.display = 'none';

    // Refresh list and navigate
    document.getElementById('workouts-list').innerHTML = renderWorkoutsList();
    router.navigate('/personal/workouts');
};

window.saveWorkout = async () => {
    const studentId = document.getElementById('workout-student').value;

    if (!studentId || currentExercises.length === 0) {
        UI.showNotification('Erro', 'Selecione um aluno e adicione exercícios', 'error');
        return;
    }

    const currentUser = auth.getCurrentUser();
    const student = db.getById('profiles', studentId);

    // Create a default workout name based on exercises
    const workoutName = `Treino - ${new Date().toLocaleDateString('pt-BR')}`;

    UI.showLoading('Salvando treino...');
    await db.create('workouts', {
        name: workoutName,
        type: 'Treino Personalizado',
        duration: 60,
        exercises: currentExercises,
        student_id: studentId,
        student_name: student.name,
        personal_id: currentUser.id,
        personal_name: currentUser.name,
        created_at: new Date().toISOString()
    });

    UI.hideLoading();
    PaymentHelper.incrementUsage(currentUser.id, 'workout');

    UI.showNotification('Sucesso!', 'Treino salvo com sucesso', 'success');
    currentExercises = [];
    document.getElementById('workout-student').value = '';
    document.getElementById('exercises-container').style.display = 'none';

    document.getElementById('workouts-list').innerHTML = renderWorkoutsList();
};

window.viewWorkoutDetails = (id) => {
    const workout = db.getById('workouts', id);
    if (!workout) return;

    const modalContent = `
        <div class="mb-md">
            <div class="flex justify-between mb-sm">
                <span class="text-muted">Aluno:</span>
                <span class="font-weight: 600;">${workout.student_name || 'N/A'}</span>
            </div>
            <div class="flex justify-between mb-sm">
                <span class="text-muted">Tipo:</span>
                <span>${workout.type}</span>
            </div>
            <div class="flex justify-between mb-sm">
                <span class="text-muted">Duração:</span>
                <span>${workout.duration} minutos</span>
            </div>
        </div>

        <h4 class="mb-md">Exercícios</h4>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Exercício</th>
                        <th>Séries</th>
                        <th>Repetições</th>
                        <th>Descanso</th>
                    </tr>
                </thead>
                <tbody>
                    ${workout.exercises.map(ex => `
                        <tr>
                            <td>${ex.name}</td>
                            <td>${ex.series}</td>
                            <td>${ex.reps}</td>
                            <td>${ex.rest}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    UI.showModal(`Treino: ${workout.name}`, modalContent);
};

window.deleteWorkout = (id) => {
    const workout = db.getById('workouts', id);
    const name = workout ? workout.name : 'Treino';
    UI.confirmDialog(
        'Confirmar Exclusão',
        `Tem certeza que deseja excluir o treino "${name}"?`,
        async () => {
            UI.showLoading('Excluindo...');
            await db.delete('workouts', id);
            UI.hideLoading();
            UI.showNotification('Sucesso!', 'Treino excluído com sucesso', 'success');
            router.navigate('/personal/workouts');
        }
    );
};

// ============================================
// PERSONAL - NUTRITION MANAGEMENT
// ============================================

router.addRoute('/personal/nutrition', (params) => {
    if (!auth.requireAuth('personal')) return;

    const currentUser = auth.getCurrentUser();
    const students = db.query('profiles', s => s.assigned_personal_id === currentUser.id);
    const limitInfo = getPersonalLimitInfo(currentUser.id);
    let activeCount = 0;
    const sortedStudents = students.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    const selectedStudentId = params.studentId || '';

    const content = `
        <div class="page-header">
            <h1 class="page-title">Gestão de Dietas</h1>
            <p class="page-subtitle">Crie planos alimentares personalizados</p>
        </div>

        <div class="card mb-xl p-lg" style="border-radius: 20px;">
            <div class="form-group mb-0">
                <label class="form-label font-bold text-primary uppercase tracking-widest text-xs">1. Selecione o Aluno</label>
                <select class="form-select border-2" id="diet-student" required style="border-radius: 12px; font-weight: 600;">
                    <option value="">Escolha um aluno para gerenciar a dieta...</option>
                    ${sortedStudents.map(s => {
        let isOverLimit = false;
        if (s.status === 'active') {
            activeCount++;
            if (limitInfo.maxStudents > 0 && activeCount > limitInfo.maxStudents) {
                isOverLimit = true;
            }
        }
        return `
                            <option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''} 
                                ${isOverLimit ? 'disabled' : ''}
                                data-weight="${s.weight || 70}" 
                                data-height="${s.height || 170}"
                                data-goal="${s.goal || ''}"
                                data-sex="${s.sex || 'male'}"
                                data-age="${s.age || 30}">
                                ${s.name} ${isOverLimit ? '(⚠️ Limite Excedido)' : ''}
                            </option>
                        `;
    }).join('')}
                </select>
            </div>
        </div>

        <div class="grid grid-2 gap-lg mb-xl">
            <div class="card p-xl hover-scale text-center border-2 hover-border-primary transition-all shadow-sm" style="cursor: pointer; border-radius: 24px;" onclick="openManualDietEditor()">
                <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">📝</div>
                <h3 class="mb-sm">Dieta Presencial</h3>
                <p class="text-muted text-sm px-md">Crie um plano alimentar manualmente definindo macros e refeições conforme sua prescrição.</p>
                <button class="btn btn-outline btn-block mt-md" style="border-radius: 12px;">Iniciar Manual</button>
            </div>
            <div class="card p-xl hover-scale text-center border-2 border-primary shadow-glow transition-all" style="cursor: pointer; border-radius: 24px; background: rgba(220, 38, 38, 0.02);" onclick="generateDietWithAI('ai')">
                <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">🤖</div>
                <h3 class="mb-sm text-primary">Gerar com IA T-FIT</h3>
                <p class="text-muted text-sm px-md">Nossa inteligência artificial cria uma dieta otimizada baseada no perfil e objetivos do aluno.</p>
                <button class="btn btn-primary btn-block mt-md shadow-lg" style="border-radius: 12px;">Usar IA</button>
            </div>
        </div>

        <div id="diet-container" class="card mb-xl p-xl" style="display: none; border-radius: 20px;">
            <div class="flex justify-between items-center mb-lg border-b pb-md">
                <h4 class="font-black text-xl">Plano Alimentar Estruturado</h4>
                <button class="btn btn-sm btn-ghost" onclick="document.getElementById('diet-container').style.display='none'">✖</button>
            </div>
            <div id="diet-content"></div>
            <div class="flex gap-md mt-xl">
                <button class="btn btn-primary btn-lg flex-1 shadow-glow" onclick="saveDiet()" style="border-radius:12px;">
                    💾 Salvar e Enviar para Aluno
                </button>
                <button class="btn btn-outline btn-lg" onclick="document.getElementById('diet-container').style.display='none'" style="border-radius:12px;">
                    Cancelar
                </button>
            </div>
        </div>

        <!-- List Existing Diets -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Dietas Cadastradas</h3>
            </div>
            <div class="card-body">
                ${renderDietsList()}
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'personal');

    // Auto-fill student data when selected (simplified as some fields are gone from UI but kept in memory for AI)
    document.getElementById('diet-student').addEventListener('change', (e) => {
        const selected = e.target.selectedOptions[0];
        if (!selected.value) return;

        UI.showNotification('Aluno Selecionado', `Gerenciando dieta para: ${selected.innerText.split('(')[0]}`, 'info');
    });

    // Add CSS for grid-3 if not exists
    if (!document.getElementById('custom-grid-styles')) {
        const style = document.createElement('style');
        style.id = 'custom-grid-styles';
        style.textContent = `
            .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
            @media (max-width: 768px) { .grid-3 { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
    }
});

function renderDietsList() {
    const currentUser = auth.getCurrentUser();
    const diets = db.query('diets', d => d.personal_id === currentUser.id);

    if (diets.length === 0) {
        return '<p class="text-muted text-center">Nenhuma dieta cadastrada ainda</p>';
    }

    return `
        <div class="grid grid-2">
            ${diets.map(d => `
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title">Dieta - ${d.student_name || 'Aluno'}</h4>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-sm mb-md">
                            <div class="flex justify-between">
                                <span class="text-muted">Calorias:</span>
                                <span class="badge badge-primary">${d.calories} kcal</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Proteínas:</span>
                                <span>${d.protein}g</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Carboidratos:</span>
                                <span>${d.carbs}g</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted">Gorduras:</span>
                                <span>${d.fat}g</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer flex gap-sm">
                        <button class="btn btn-sm btn-ghost" onclick="viewDietDetails('${d.id}')">
                            👁️ Ver Refeições
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteDiet('${d.id}')">
                            🗑️ Excluir
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

let currentDiet = null;

window.generateDietWithAI = (method = 'ai') => {
    const studentSelect = document.getElementById('diet-student');
    if (!studentSelect) return;
    const studentId = studentSelect.value;
    if (!studentId) {
        UI.showNotification('Erro', 'Selecione um aluno primeiro', 'error');
        return;
    }

    if (method === 'manual') {
        openManualDietEditor();
        return;
    }

    const currentUser = auth.getCurrentUser();

    PaymentHelper.handlePremiumAction('Gerar Dieta', currentUser, () => {
        const student = db.getById('profiles', studentId);
        if (!student) return;
        startDietWizard(student);
    }, 'ai');
};

window.openManualDietEditor = () => {
    const studentSelect = document.getElementById('diet-student');
    const studentId = studentSelect?.value;
    if (!studentId) {
        UI.showNotification('Erro', 'Selecione um aluno primeiro', 'error');
        return;
    }

    const mealCount = 4; // Default to 4
    const student = db.getById('profiles', studentId);

    UI.showLoading('Iniciando editor manual...');

    // Initialize currentDiet with a blank/default structure
    currentDiet = {
        student_id: studentId,
        student_name: student.name,
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 60,
        meals: Array.from({ length: mealCount }, (_, i) => ({
            name: `Refeição ${i + 1}`,
            time: (8 + (i * 3)) + ':00',
            foods: ['']
        })),
        rationale: 'Plano alimentar presencial elaborado pelo Personal Trainer.'
    };

    setTimeout(() => {
        UI.hideLoading();
        displayDiet();
        document.getElementById('diet-container').scrollIntoView({ behavior: 'smooth' });
        UI.showNotification('Editor Manual Aberto', 'Preencha os dados e clique em Salvar.', 'info');
    }, 500);
};

function startDietWizard(student) {
    const studentId = student.id;

    // AI Wizard logic - Full 5-step wizard with all questions + photo upload
    let step = 1;
    const totalSteps = 5;
    let answers = {
        'd-wiz-weight': student.weight || '',
        'd-wiz-height': student.height || '',
        'd-wiz-age': student.age || '',
        'd-wiz-sex': student.sex === 'male' ? 'Masculino' : (student.sex === 'female' ? 'Feminino' : 'Prefiro não informar')
    };

    const renderDietStep = () => {
        let title = '';
        let content = '';

        if (step === 1) {
            title = 'Passo 1: Dados Corporais';
            content = `
                <div class="grid grid-2 gap-md">
                    <div class="form-group">
                        <label class="form-label">Peso Atual (kg) *</label>
                        <input type="number" class="form-input" id="d-wiz-weight" value="${answers['d-wiz-weight']}" placeholder="Ex: 70">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Altura (cm) *</label>
                        <input type="number" class="form-input" id="d-wiz-height" value="${answers['d-wiz-height']}" placeholder="Ex: 170">
                    </div>
                </div>
                <div class="grid grid-2 gap-md mt-md">
                    <div class="form-group">
                        <label class="form-label">Idade *</label>
                        <input type="number" class="form-input" id="d-wiz-age" value="${answers['d-wiz-age']}" placeholder="Ex: 30">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sexo Biológico *</label>
                        <select class="form-select" id="d-wiz-sex">
                            <option value="Feminino" ${answers['d-wiz-sex'] === 'Feminino' ? 'selected' : ''}>Feminino</option>
                            <option value="Masculino" ${answers['d-wiz-sex'] === 'Masculino' ? 'selected' : ''}>Masculino</option>
                        </select>
                    </div>
                </div>
            `;
        } else if (step === 2) {
            title = 'Passo 2: Objetivo e Hábitos';
            content = `
                <div class="form-group">
                    <label class="form-label">1. Objetivo principal com a dieta? *</label>
                    <select class="form-select" id="d-wiz-goal">
                        <option value="Emagrecimento" ${answers['d-wiz-goal'] === 'Emagrecimento' ? 'selected' : ''}>Emagrecimento</option>
                        <option value="Ganho de massa muscular" ${answers['d-wiz-goal'] === 'Ganho de massa muscular' ? 'selected' : ''}>Ganho de massa muscular</option>
                        <option value="Definição" ${answers['d-wiz-goal'] === 'Definição' ? 'selected' : ''}>Definição</option>
                        <option value="Manutenção do peso" ${answers['d-wiz-goal'] === 'Manutenção do peso' ? 'selected' : ''}>Manutenção do peso</option>
                        <option value="Saúde / qualidade de vida" ${answers['d-wiz-goal'] === 'Saúde / qualidade de vida' ? 'selected' : ''}>Saúde / qualidade de vida</option>
                        <option value="Outro" ${answers['d-wiz-goal'] === 'Outro' ? 'selected' : ''}>Outro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">2. Já segue alguma dieta?</label>
                    <select class="form-select" id="d-wiz-experience">
                        <option value="Nunca segui" ${answers['d-wiz-experience'] === 'Nunca segui' ? 'selected' : ''}>Nunca segui</option>
                        <option value="Já segui, mas parei" ${answers['d-wiz-experience'] === 'Já segui, mas parei' ? 'selected' : ''}>Já segui, mas parei</option>
                        <option value="Sigo atualmente" ${answers['d-wiz-experience'] === 'Sigo atualmente' ? 'selected' : ''}>Sigo atualmente</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">3. Refeições por dia?</label>
                    <select class="form-select" id="d-wiz-meals">
                        <option value="3" ${answers['d-wiz-meals'] === '3' ? 'selected' : ''}>3 refeições</option>
                        <option value="4" ${!answers['d-wiz-meals'] || answers['d-wiz-meals'] === '4' ? 'selected' : ''}>4 refeições</option>
                        <option value="5" ${answers['d-wiz-meals'] === '5' ? 'selected' : ''}>5 refeições</option>
                        <option value="6" ${answers['d-wiz-meals'] === '6' ? 'selected' : ''}>6 ou mais</option>
                    </select>
                </div>
                <div class="grid grid-2 gap-md mt-md">
                    <div class="form-group">
                        <label class="form-label">7. Como é o apetite?</label>
                        <select class="form-select" id="d-wiz-appetite">
                            <option value="Baixo" ${answers['d-wiz-appetite'] === 'Baixo' ? 'selected' : ''}>Baixo</option>
                            <option value="Moderado" ${!answers['d-wiz-appetite'] || answers['d-wiz-appetite'] === 'Moderado' ? 'selected' : ''}>Moderado</option>
                            <option value="Alto" ${answers['d-wiz-appetite'] === 'Alto' ? 'selected' : ''}>Alto</option>
                            <option value="Varia muito" ${answers['d-wiz-appetite'] === 'Varia muito' ? 'selected' : ''}>Varia muito</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">8. Rotina alimentar?</label>
                        <select class="form-select" id="d-wiz-routine">
                            <option value="Bem organizada" ${answers['d-wiz-routine'] === 'Bem organizada' ? 'selected' : ''}>Bem organizada</option>
                            <option value="Mais ou menos" ${!answers['d-wiz-routine'] || answers['d-wiz-routine'] === 'Mais ou menos' ? 'selected' : ''}>Mais ou menos</option>
                            <option value="Totalmente desorganizada" ${answers['d-wiz-routine'] === 'Totalmente desorganizada' ? 'selected' : ''}>Totalmente desorganizada</option>
                        </select>
                    </div>
                </div>
            `;
        } else if (step === 3) {
            title = 'Passo 3: Saúde e Restrições';
            content = `
                <div class="form-group">
                    <label class="form-label">4. Restrição alimentar?</label>
                    <div class="grid grid-2 gap-xs">
                        ${['Nenhuma', 'Intolerância à lactose', 'Alergia ao glúten', 'Alergia alimentar (outras)', 'Vegetarian@', 'Vegan@', 'Outro'].map(r => `
                            <label class="flex items-center gap-sm p-sm border rounded cursor-pointer hover-bg-light">
                                <input type="checkbox" name="d-wiz-rest" value="${r}" ${(answers['d-wiz-rest'] || []).includes(r) ? 'checked' : ''}>
                                <span class="text-sm">${r}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">5. Condição de saúde?</label>
                    <div class="grid grid-2 gap-xs">
                        ${['Nenhuma', 'Diabetes', 'Hipotireoidismo / Hipertireoidismo', 'Hipertensão', 'Gastrite / refluxo', 'Outro'].map(c => `
                            <label class="flex items-center gap-sm p-sm border rounded cursor-pointer hover-bg-light">
                                <input type="checkbox" name="d-wiz-health" value="${c}" ${(answers['d-wiz-health'] || []).includes(c) ? 'checked' : ''}>
                                <span class="text-sm">${c}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">6. Usa algum medicamento contínuo?</label>
                    <select class="form-select" id="d-wiz-meds" onchange="document.getElementById('d-wiz-meds-cond').style.display = this.value === 'Sim' ? 'block' : 'none'">
                        <option value="Não" ${!answers['d-wiz-meds'] || answers['d-wiz-meds'] === 'Não' ? 'selected' : ''}>Não</option>
                        <option value="Sim" ${answers['d-wiz-meds'] === 'Sim' ? 'selected' : ''}>Sim</option>
                    </select>
                    <div id="d-wiz-meds-cond" style="display: ${answers['d-wiz-meds'] === 'Sim' ? 'block' : 'none'};" class="mt-sm">
                        <label class="form-label text-xs">👉 Qual(is)?</label>
                        <input type="text" class="form-input" id="d-wiz-meds-desc" value="${answers['d-wiz-meds-desc'] || ''}" placeholder="Descreva aqui...">
                    </div>
                </div>
            `;
        } else if (step === 4) {
            title = 'Passo 4: Alimentação e Estilo de Vida';
            content = `
                <div class="grid grid-2 gap-md">
                   <div class="form-group">
                        <label class="form-label">10. Alimentos que GOSTA</label>
                        <textarea class="form-input" id="d-wiz-likes" rows="2" placeholder="Ex: arroz, frango, ovos, frutas...">${answers['d-wiz-likes'] || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">11. Alimentos que NÃO gosta</label>
                        <textarea class="form-input" id="d-wiz-dislikes" rows="2" placeholder="Ex: fígado, jiló...">${answers['d-wiz-dislikes'] || ''}</textarea>
                    </div>
                </div>
                <div class="grid grid-2 gap-md">
                    <div class="form-group">
                        <label class="form-label">9. Pede delivery?</label>
                        <select class="form-select" id="d-wiz-delivery">
                            <option value="Raramente" ${!answers['d-wiz-delivery'] || answers['d-wiz-delivery'] === 'Raramente' ? 'selected' : ''}>Raramente</option>
                            <option value="1–2x por semana" ${answers['d-wiz-delivery'] === '1–2x por semana' ? 'selected' : ''}>1–2x por semana</option>
                            <option value="3–4x por semana" ${answers['d-wiz-delivery'] === '3–4x por semana' ? 'selected' : ''}>3–4x por semana</option>
                            <option value="Quase todos os dias" ${answers['d-wiz-delivery'] === 'Quase todos os dias' ? 'selected' : ''}>Quase todos os dias</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">12. Consome álcool?</label>
                        <select class="form-select" id="d-wiz-alcohol">
                            <option value="Não" ${!answers['d-wiz-alcohol'] || answers['d-wiz-alcohol'] === 'Não' ? 'selected' : ''}>Não</option>
                            <option value="Raramente" ${answers['d-wiz-alcohol'] === 'Raramente' ? 'selected' : ''}>Raramente</option>
                            <option value="Finais de semana" ${answers['d-wiz-alcohol'] === 'Finais de semana' ? 'selected' : ''}>Finais de semana</option>
                            <option value="Frequentemente" ${answers['d-wiz-alcohol'] === 'Frequentemente' ? 'selected' : ''}>Frequentemente</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-2 gap-md">
                    <div class="form-group">
                        <label class="form-label">13. Consumo de água?</label>
                        <select class="form-select" id="d-wiz-water">
                            <option value="Menos de 1L" ${answers['d-wiz-water'] === 'Menos de 1L' ? 'selected' : ''}>Menos de 1L</option>
                            <option value="1–2L" ${!answers['d-wiz-water'] || answers['d-wiz-water'] === '1–2L' ? 'selected' : ''}>1–2L</option>
                            <option value="2–3L" ${answers['d-wiz-water'] === '2–3L' ? 'selected' : ''}>2–3L</option>
                            <option value="Mais de 3L" ${answers['d-wiz-water'] === 'Mais de 3L' ? 'selected' : ''}>Mais de 3L</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">14. Utiliza suplementos?</label>
                        <div class="grid grid-2 gap-xs">
                             ${['Nenhum', 'Whey protein', 'Creatina', 'Multivitamínico', 'Outros'].map(s => `
                                <label class="flex items-center gap-xs p-xs border rounded cursor-pointer hover-bg-light">
                                    <input type="checkbox" name="d-wiz-supps" value="${s}" ${(answers['d-wiz-supps'] || []).includes(s) ? 'checked' : ''}>
                                    <span class="text-xs">${s}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else if (step === 5) {
            title = 'Passo 5: Fotos do Aluno (Opcional)';
            content = `
                <p class="text-muted mb-md text-sm">Envie até 3 fotos do aluno para a IA fazer uma avaliação visual e gerar uma dieta mais personalizada.</p>
                <div class="grid grid-3 gap-md">
                    <div class="form-group text-center">
                        <label class="form-label">📸 Frente</label>
                        <div id="d-wiz-photo-front-preview" style="width: 100%; height: 120px; border: 2px dashed var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden;" onclick="document.getElementById('d-wiz-photo-front').click()">
                            ${answers['d-wiz-photo-front'] ? `<img src="${answers['d-wiz-photo-front']}" style="max-width: 100%; max-height: 100%; object-fit: cover;">` : '<span class="text-muted text-sm">Clique para selecionar</span>'}
                        </div>
                        <input type="file" id="d-wiz-photo-front" accept="image/*" hidden onchange="window.handleDietPhoto(this, 'front')">
                    </div>
                    <div class="form-group text-center">
                        <label class="form-label">📸 Lado</label>
                        <div id="d-wiz-photo-side-preview" style="width: 100%; height: 120px; border: 2px dashed var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden;" onclick="document.getElementById('d-wiz-photo-side').click()">
                            ${answers['d-wiz-photo-side'] ? `<img src="${answers['d-wiz-photo-side']}" style="max-width: 100%; max-height: 100%; object-fit: cover;">` : '<span class="text-muted text-sm">Clique para selecionar</span>'}
                        </div>
                        <input type="file" id="d-wiz-photo-side" accept="image/*" hidden onchange="window.handleDietPhoto(this, 'side')">
                    </div>
                    <div class="form-group text-center">
                        <label class="form-label">📸 Costas</label>
                        <div id="d-wiz-photo-back-preview" style="width: 100%; height: 120px; border: 2px dashed var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden;" onclick="document.getElementById('d-wiz-photo-back').click()">
                            ${answers['d-wiz-photo-back'] ? `<img src="${answers['d-wiz-photo-back']}" style="max-width: 100%; max-height: 100%; object-fit: cover;">` : '<span class="text-muted text-sm">Clique para selecionar</span>'}
                        </div>
                        <input type="file" id="d-wiz-photo-back" accept="image/*" hidden onchange="window.handleDietPhoto(this, 'back')">
                    </div>
                </div>
            `;
        }

        const modalHtml = `
            <div class="wizard-container">
                <div class="wiz-progress mb-lg" style="height: 4px; background: #eee; border-radius: 2px;">
                    <div style="height: 100%; width: ${(step / totalSteps) * 100}%; background: var(--success); transition: width 0.3s;"></div>
                </div>
                
                ${content}

                <div class="flex flex-col gap-sm mt-xl pt-md border-t">
                    <div class="flex justify-between items-center mb-sm">
                        ${step > 1 ? `<button class="btn btn-ghost" onclick="window.prevDietStep()">← Voltar</button>` : '<div></div>'}
                        ${step < totalSteps ? `<button class="btn btn-primary" onclick="window.nextDietStep()">Próximo →</button>` : ''}
                    </div>

                    ${step === totalSteps ? `
                        <div class="text-center">
                            <button class="btn btn-primary btn-ai-glow btn-block" onclick="window.nextDietStep()">
                                🤖 Gerar Dieta com IA
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        UI.showModal(title, modalHtml);
    };

    // Photo handler
    window.handleDietPhoto = (input, position) => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            answers[`d-wiz-photo-${position}`] = e.target.result;
            const preview = document.getElementById(`d-wiz-photo-${position}-preview`);
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%; object-fit: cover;">`;
            }
        };
        reader.readAsDataURL(file);
    };

    window.prevDietStep = () => { if (step > 1) { step--; renderDietStep(); } };

    window.nextDietStep = async () => {
        if (step === 1) {
            answers['d-wiz-weight'] = document.getElementById('d-wiz-weight').value;
            answers['d-wiz-height'] = document.getElementById('d-wiz-height').value;
            answers['d-wiz-age'] = document.getElementById('d-wiz-age').value;
            answers['d-wiz-sex'] = document.getElementById('d-wiz-sex').value;
            if (!answers['d-wiz-weight'] || !answers['d-wiz-height'] || !answers['d-wiz-age']) return UI.showNotification('Erro', 'Preencha peso, altura e idade!', 'warning');
        } else if (step === 2) {
            answers['d-wiz-goal'] = document.getElementById('d-wiz-goal').value;
            answers['d-wiz-experience'] = document.getElementById('d-wiz-experience')?.value;
            answers['d-wiz-meals'] = document.getElementById('d-wiz-meals').value;
            answers['d-wiz-appetite'] = document.getElementById('d-wiz-appetite').value;
            answers['d-wiz-routine'] = document.getElementById('d-wiz-routine').value;
        } else if (step === 3) {
            const rests = [];
            document.querySelectorAll('input[name="d-wiz-rest"]:checked').forEach(c => rests.push(c.value));
            answers['d-wiz-rest'] = rests;
            const health = [];
            document.querySelectorAll('input[name="d-wiz-health"]:checked').forEach(c => health.push(c.value));
            answers['d-wiz-health'] = health;
            answers['d-wiz-meds'] = document.getElementById('d-wiz-meds').value;
            answers['d-wiz-meds-desc'] = document.getElementById('d-wiz-meds-desc')?.value || '';
        } else if (step === 4) {
            answers['d-wiz-likes'] = document.getElementById('d-wiz-likes').value;
            answers['d-wiz-dislikes'] = document.getElementById('d-wiz-dislikes').value;
            answers['d-wiz-delivery'] = document.getElementById('d-wiz-delivery').value;
            answers['d-wiz-alcohol'] = document.getElementById('d-wiz-alcohol').value;
            answers['d-wiz-water'] = document.getElementById('d-wiz-water').value;
            const supps = [];
            document.querySelectorAll('input[name="d-wiz-supps"]:checked').forEach(c => supps.push(c.value));
            answers['d-wiz-supps'] = supps;
        } else if (step === 5) {
            // Photos are already in answers via handleDietPhoto - FINISH
            finishDietGenForPersonal(student.id, answers);
            return;
        }
        step++;
        renderDietStep();
    };

    renderDietStep();
};

const finishDietGenForPersonal = async (studentId, data) => {
    const student = db.getById('profiles', studentId);
    UI.showLoading('IA T-FIT Gerando Dieta...');

    try {
        const diet = await AIHelper.generateDiet({
            ...data,
            weight: parseFloat(data['d-wiz-weight']),
            height: parseFloat(data['d-wiz-height']),
            age: parseInt(data['d-wiz-age']),
            sex: data['d-wiz-sex'] === 'Masculino' ? 'male' : 'female',
            goal: data['d-wiz-goal'],
            activity: data['d-wiz-activity'] || 1.375,
            preference: data['d-wiz-pref'] || 'omnivore',
            mealCount: parseInt(data['d-wiz-meals']) || 4,
            appetite: data['d-wiz-appetite'],
            routine: data['d-wiz-routine'],
            restrictions: (data['d-wiz-rest'] || []).join(', ') || 'Nenhuma',
            health: (data['d-wiz-health'] || []).join(', ') || 'Nenhuma',
            meds: data['d-wiz-meds-desc'] || 'Nenhum',
            likes: data['d-wiz-likes'] || 'Não informado',
            dislikes: data['d-wiz-dislikes'] || 'Não informado',
            delivery: data['d-wiz-delivery'],
            alcohol: data['d-wiz-alcohol'],
            water: data['d-wiz-water'],
            supplements: (data['d-wiz-supps'] || []).join(', ') || 'Nenhum',
            studentName: student.name
        });

        currentDiet = diet;

        // Add photos to diet if provided
        const photos = {};
        if (data['d-wiz-photo-front']) photos.front = data['d-wiz-photo-front'];
        if (data['d-wiz-photo-side']) photos.side = data['d-wiz-photo-side'];
        if (data['d-wiz-photo-back']) photos.back = data['d-wiz-photo-back'];
        if (Object.keys(photos).length > 0) {
            currentDiet.photos = photos;
        }

        // Update Student Profile
        await db.update('profiles', studentId, {
            weight: parseFloat(data['d-wiz-weight']),
            height: parseFloat(data['d-wiz-height']),
            age: parseInt(data['d-wiz-age']),
            sex: data['d-wiz-sex'] === 'Masculino' ? 'male' : 'female',
            goal: data['d-wiz-goal']
        });

        // DO NOT SAVE IMMEDIATELY - Allow user to edit first.
        UI.hideLoading();
        UI.closeModal();
        UI.showNotification('Dieta Gerada!', 'Revise o plano abaixo e clique em Salvar.', 'success');

        // Show result on the page
        displayDiet();

        if (diet.rationale) {
            UI.showModal('Análise da IA 🤖', `
                <div class="card p-md bg-light border-success" style="border-left: 4px solid var(--success);">
                    <p class="text-sm"><strong>Estratégia Nutricional:</strong></p>
                    <p class="text-xs text-muted mt-xs italic">"${diet.rationale}"</p>
                </div>
                <button class="btn btn-primary btn-block mt-md" onclick="UI.closeModal()">Entendido</button>
            `);
        }
    } catch (error) {
        console.error('AI Diet Generation Error:', error);
        UI.hideLoading();
        UI.showNotification('Erro', error.message || 'A geração de dieta via IA falhou.', 'error');
    }
};

function displayDiet() {
    const container = document.getElementById('diet-container');
    const content = document.getElementById('diet-content');

    if (!currentDiet) {
        container.style.display = 'none';
        return;
    }

    // Hide the creation form entirely when showing result
    const form = document.getElementById('create-diet-form');
    if (form) form.style.display = 'none';

    container.style.display = 'block';
    content.innerHTML = `
        <!-- Evaluation Section -->
        ${currentDiet.visualEvaluation ? `
            <div class="card mb-lg" style="border-left: 5px solid var(--secondary);">
                <div class="card-header">
                    <h4 class="card-title text-secondary">🤖 Análise da IA</h4>
                </div>
                <div class="card-body">
                    <div class="alert alert-info" style="background: rgba(var(--secondary-rgb), 0.1); border-color: var(--secondary);">
                        <p class="mb-0"><strong>Dica do Sistema:</strong> ${currentDiet.visualEvaluation}</p>
                    </div>
                </div>
            </div>
        ` : ''}

        <div class="grid grid-4 mb-lg">
            <div class="stat-card">
                <div class="stat-value" style="font-size: 1.2rem;"><input type="number" class="form-input p-xs text-center" value="${currentDiet.calories}" onchange="currentDiet.calories = this.value"></div>
                <div class="stat-label">Calorias (kcal)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size: 1.2rem;"><input type="number" class="form-input p-xs text-center" value="${currentDiet.protein}" onchange="currentDiet.protein = this.value"></div>
                <div class="stat-label">Proteínas (g)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size: 1.2rem;"><input type="number" class="form-input p-xs text-center" value="${currentDiet.carbs}" onchange="currentDiet.carbs = this.value"></div>
                <div class="stat-label">Carbos (g)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size: 1.2rem;"><input type="number" class="form-input p-xs text-center" value="${currentDiet.fat}" onchange="currentDiet.fat = this.value"></div>
                <div class="stat-label">Gorduras (g)</div>
            </div>
        </div>

        <h4 class="mb-md">Refeições (Editáveis)</h4>
        <div class="flex flex-col gap-md">
            ${currentDiet.meals.map((meal, index) => `
                <div class="card p-md" style="border-left: 3px solid var(--primary);">
                    <div class="flex justify-between items-center mb-sm">
                        <input type="text" class="form-input font-bold text-primary" style="border:none; background:transparent; width: 60%; font-size: 1.1rem;" value="${meal.name}" onchange="updateMeal(${index}, 'name', this.value)">
                        <input type="text" class="form-input text-muted text-right" style="border:none; background:transparent; width: 30%;" value="${meal.time}" onchange="updateMeal(${index}, 'time', this.value)">
                    </div>
                    <div class="form-group mb-sm">
                        <textarea class="form-textarea" style="min-height: 80px;" onchange="updateMeal(${index}, 'foods', this.value.split('\\n'))">${meal.foods.join('\n')}</textarea>
                    </div>
                    <div class="flex justify-end">
                        <button class="btn btn-xs btn-ghost text-danger" onclick="currentDiet.meals.splice(${index}, 1); displayDiet();">🗑️ Remover Refeição</button>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="mt-xl flex flex-col gap-sm">
            <button class="btn btn-outline btn-block" onclick="currentDiet.meals.push({name: 'Nova Refeição', time: '00:00', foods: ['Novo alimento']}); displayDiet();">
                + Adicionar Refeição
            </button>
            <button class="btn btn-primary btn-block btn-lg shadow-glow mt-md" onclick="window.saveDiet()">
                ✅ Confirmar e Salvar Plano Alimentar
            </button>
            <button class="btn btn-ghost btn-block mt-sm" onclick="if(confirm('Descartar esta dieta?')) { currentDiet = null; displayDiet(); }">
                ❌ Descartar Geração
            </button>
        </div>
    `;
}

window.updateMeal = (index, field, value) => {
    currentDiet.meals[index][field] = value;
};

window.saveDiet = async () => {
    const studentId = document.getElementById('diet-student').value;
    const student = db.getById('profiles', studentId);

    // Enforce Freemium Limits
    const check = PaymentHelper.checkActionLimit(auth.getCurrentUser().id, 'diet');
    if (!check.allowed) {
        UI.showModal('Limite de Plano Gratuito 🔒', `
            <div class="text-center p-lg">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🥗</div>
                <h3>Limite de Dietas Atingido</h3>
                <p class="text-muted mb-lg">${check.message}</p>
                <button class="btn btn-primary btn-block" onclick="router.navigate('/personal/subscription'); UI.closeModal();">
                    Fazer Upgrade Agora
                </button>
            </div>
        `);
        return;
    }

    if (!studentId || !currentDiet) {
        UI.showNotification('Erro', 'Gere uma dieta primeiro', 'error');
        return;
    }

    const currentUser = auth.getCurrentUser();

    UI.showLoading('Salvando dieta...');
    // Delete existing diet for this student
    const existingDiets = db.query('diets', d => d && d.student_id == studentId);
    for (const d of existingDiets) {
        await db.delete('diets', d.id);
    }

    await db.create('diets', {
        ...currentDiet,
        student_id: studentId,
        student_name: student.name,
        personal_id: currentUser.id,
        personal_name: currentUser.name,
        created_at: new Date().toISOString()
    });

    UI.hideLoading();
    UI.showNotification('Sucesso!', 'Dieta salva com sucesso', 'success');
    currentDiet = null;
    router.navigate('/personal/nutrition');
};

window.viewDietDetails = (id) => {
    const diet = db.getById('diets', id);
    if (!diet) return;

    const modalContent = `
        <div class="grid grid-4 mb-lg">
            <div class="stat-card">
                <div class="stat-value" style="font-size: 1.5rem;">${diet.calories}</div>
                <div class="stat-label">Calorias</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size: 1.5rem;">${diet.protein}g</div>
                <div class="stat-label">Proteínas</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size: 1.5rem;">${diet.carbs}g</div>
                <div class="stat-label">Carbos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size: 1.5rem;">${diet.fat}g</div>
                <div class="stat-label">Gorduras</div>
            </div>
        </div>

        ${diet.visualEvaluation ? `
            <div class="mb-lg p-sm bg-light rounded border-left" style="border-left: 4px solid var(--secondary);">
                <h5 class="text-secondary mb-xs">🤖 Análise Visual da IA:</h5>
                <p class="text-sm mb-md">${diet.visualEvaluation}</p>
                <div class="flex gap-sm overflow-x-auto pb-xs">
                    ${diet.photos?.front ? `<img src="${diet.photos.front}" style="height: 80px; border-radius: 4px; border: 1px solid var(--border);">` : ''}
                    ${diet.photos?.side ? `<img src="${diet.photos.side}" style="height: 80px; border-radius: 4px; border: 1px solid var(--border);">` : ''}
                    ${diet.photos?.back ? `<img src="${diet.photos.back}" style="height: 80px; border-radius: 4px; border: 1px solid var(--border);">` : ''}
                </div>
            </div>
        ` : ''}

        <h4 class="mb-md">Refeições</h4>
        ${diet.meals.map(meal => `
            <div class="mb-md">
                <div class="flex justify-between mb-sm">
                    <strong>${meal.name}</strong>
                    <span class="text-muted">${meal.time}</span>
                </div>
                <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary);">
                    ${meal.foods.map(food => `<li>${food}</li>`).join('')}
                </ul>
            </div>
        `).join('')}
    `;

    UI.showModal(`Dieta - ${diet.student_name || 'Aluno'}`, modalContent);
};

window.deleteDiet = (id) => {
    UI.confirmDialog(
        'Confirmar Exclusão',
        'Tem certeza que deseja excluir esta dieta?',
        async () => {
            UI.showLoading('Excluindo...');
            await db.delete('diets', id);
            UI.hideLoading();
            UI.showNotification('Sucesso!', 'Dieta excluída com sucesso', 'success');
            router.navigate('/personal/nutrition');
        }
    );
};

// ============================================
// PERSONAL - ASSESSMENTS
// ============================================

router.addRoute('/personal/assessments', (params) => {
    if (!auth.requireAuth('personal')) return;

    const currentUser = auth.getCurrentUser();
    const students = db.query('profiles', s => s.assigned_personal_id === currentUser.id);
    const selectedStudentId = params.studentId || '';

    const content = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Avaliações Físicas</h1>
                <p class="page-subtitle">Acompanhe a evolução dos seus alunos</p>
            </div>
        <div class="grid grid-2 gap-lg mb-xl">
            <div class="card p-xl hover-scale text-center border-2 hover-border-primary transition-all" style="cursor: pointer;" onclick="showAddAssessmentModal()">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
                <h3 class="mb-sm">Avaliação Presencial</h3>
                <p class="text-muted text-sm">Preencha manualmente peso, BF e circunferências do aluno.</p>
                <button class="btn btn-outline btn-block mt-md">Iniciar Manual</button>
            </div>
            <div class="card p-xl hover-scale text-center border-2 border-primary shadow-glow transition-all" style="cursor: pointer;" onclick="startAIAssessmentForPersonal('${selectedStudentId}')">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🤖</div>
                <h3 class="mb-sm text-primary">Avaliação via IA</h3>
                <p class="text-muted text-sm">Análise visual automática através de 3 fotos nítidas do aluno.</p>
                <button class="btn btn-primary btn-block mt-md">Gerar com IA</button>
            </div>
        </div>

        <div id="assessment-container" class="mt-lg" style="display: none; transition: all 0.5s ease;">
            <div id="assessment-content"></div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Selecione um Aluno para ver Histórico</h3>
            </div>
            <div class="card-body">
                ${students.length > 0 ? `
                    <div class="grid grid-3">
                        ${students.map(s => {
        const assessments = db.query('assessments', a => a && a.student_id == s.id);
        return `
                                <div class="card ${s.id === selectedStudentId ? 'border-primary' : ''} hover-border-primary" style="cursor: pointer;" onclick="viewStudentAssessments('${s.id}')">
                                    <div class="card-header">
                                        <h4 class="card-title">${s.name}</h4>
                                    </div>
                                    <div class="card-body text-center">
                                        <div class="stat-value" style="font-size: 2rem;">${assessments.length}</div>
                                        <div class="stat-label">Avaliações</div>
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>
                ` : '<p class="text-muted text-center">Nenhum aluno cadastrado</p>'}
            </div>
        </div>
    `;

    UI.renderDashboard(content, 'personal');

    if (selectedStudentId) {
        setTimeout(() => {
            const btn = document.querySelector('button[onclick*="startAIAssessmentForPersonal"]');
            if (btn && !window._autoOpenAI) {
                window._autoOpenAI = true;
                btn.click();
            }
        }, 500);
    }
});

window.showAddAssessmentModal = () => {
    const currentUser = auth.getCurrentUser();
    const students = db.query('profiles', s => s.assigned_personal_id === currentUser.id);
    renderAssessmentModal(students, currentUser);
};

function renderAssessmentModal(students, currentUser) {

    const modalContent = `
        <form id="add-assessment-form">
            <div class="form-group">
                <label class="form-label">Selecione o Aluno *</label>
                <select class="form-select" id="assessment-student" required>
                    <option value="">Escolha um aluno...</option>
                    ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
            </div>

            <div class="grid grid-3">
                <div class="form-group">
                    <label class="form-label">Peso (kg) *</label>
                    <input type="number" class="form-input" id="assessment-weight" step="0.1" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Altura (cm) *</label>
                    <input type="number" class="form-input" id="assessment-height" required>
                </div>
                <div class="form-group">
                    <label class="form-label">BF (%)</label>
                    <input type="number" class="form-input" id="assessment-bf" step="0.1">
                </div>
            </div>

            <h5 class="mb-md mt-md">Circunferências (cm)</h5>
            <div class="grid grid-4">
                <div class="form-group">
                    <label class="form-label">Peitoral</label>
                    <input type="number" class="form-input" id="assessment-chest" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Cintura</label>
                    <input type="number" class="form-input" id="assessment-waist" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Quadril</label>
                    <input type="number" class="form-input" id="assessment-hip" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Braço</label>
                    <input type="number" class="form-input" id="assessment-arm" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Coxa</label>
                    <input type="number" class="form-input" id="assessment-thigh" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Panturrilha</label>
                    <input type="number" class="form-input" id="assessment-calf" step="0.1">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label font-bold">Fotos do Aluno 📸</label>
                <div class="grid grid-3 gap-sm">
                    <div class="photo-upload-container text-center">
                        <div class="photo-preview-box-personal" id="manual-preview-front" onclick="document.getElementById('manual-photo-front').click()"
                             style="height:80px; border:1px dashed var(--border); border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;">
                            <span class="text-xs">Frente</span>
                        </div>
                        <input type="file" id="manual-photo-front" accept="image/*" class="hidden" onchange="window.previewAssessmentPhotoPersonal(this, 'manual-preview-front')">
                    </div>
                    <div class="photo-upload-container text-center">
                        <div class="photo-preview-box-personal" id="manual-preview-right" onclick="document.getElementById('manual-photo-right').click()"
                             style="height:80px; border:1px dashed var(--border); border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;">
                            <span class="text-xs">Lado D</span>
                        </div>
                        <input type="file" id="manual-photo-right" accept="image/*" class="hidden" onchange="window.previewAssessmentPhotoPersonal(this, 'manual-preview-right')">
                    </div>
                    <div class="photo-upload-container text-center">
                        <div class="photo-preview-box-personal" id="manual-preview-left" onclick="document.getElementById('manual-photo-left').click()"
                             style="height:80px; border:1px dashed var(--border); border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;">
                            <span class="text-xs">Lado E</span>
                        </div>
                        <input type="file" id="manual-photo-left" accept="image/*" class="hidden" onchange="window.previewAssessmentPhotoPersonal(this, 'manual-preview-left')">
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Observações</label>
                <textarea class="form-textarea" id="assessment-notes"></textarea>
            </div>
        </form>
    `;

    UI.showModal('Nova Avaliação Física', modalContent, async () => {
        const studentId = document.getElementById('assessment-student').value;
        const weight = parseFloat(document.getElementById('assessment-weight').value);
        const height = parseInt(document.getElementById('assessment-height').value);

        if (!studentId || !weight || !height) {
            UI.showNotification('Erro', 'Preencha os campos obrigatórios', 'error');
            return;
        }

        const photoFront = document.getElementById('manual-preview-front').querySelector('img')?.src;
        const photoRight = document.getElementById('manual-preview-right').querySelector('img')?.src;
        const photoLeft = document.getElementById('manual-preview-left').querySelector('img')?.src;
        const photos = [photoFront, photoRight, photoLeft].filter(Boolean);

        const assessment = {
            student_id: studentId,
            personal_id: currentUser.id,
            weight,
            height,
            body_fat_percentage: parseFloat(document.getElementById('assessment-bf').value) || null,
            measurements: {
                chest: parseFloat(document.getElementById('assessment-chest').value) || null,
                waist: parseFloat(document.getElementById('assessment-waist').value) || null,
                hip: parseFloat(document.getElementById('assessment-hip').value) || null,
                arm: parseFloat(document.getElementById('assessment-arm').value) || null,
                thigh: parseFloat(document.getElementById('assessment-thigh').value) || null,
                calf: parseFloat(document.getElementById('assessment-calf').value) || null
            },
            photos: photos,
            notes: document.getElementById('assessment-notes').value,
            date: new Date().toISOString()
        };

        await db.create('assessments', assessment);
        PaymentHelper.hasAIAccess(currentUser);
        UI.showNotification('Sucesso!', 'Avaliação física salva com fotos', 'success');
        router.navigate('/personal/assessments');
    });
};

window.viewStudentAssessments = (studentId) => {
    const student = db.getById('profiles', studentId);
    const studentName = student ? student.name : 'Aluno';
    const assessments = db.query('assessments', a => a && a.student_id == studentId)
        .sort((a, b) => {
            const dateA = a && (a.created_at || a.date) ? new Date(a.created_at || a.date) : 0;
            const dateB = b && (b.created_at || b.date) ? new Date(b.created_at || b.date) : 0;
            return dateB - dateA;
        });

    const modalContent = `
        <h4 class="mb-md">Histórico de Avaliações</h4>
        ${assessments.length > 0 ? `
            <div class="flex flex-col gap-md">
                ${assessments.map(a => {
        const dateObj = a.date ? new Date(a.date) : null;
        const date = dateObj && !isNaN(dateObj) ? dateObj.toLocaleDateString('pt-BR') : 'Data n/d';
        const heightM = (a.height || 0) / 100;
        const imc = (a.weight && heightM > 0) ? (a.weight / (heightM ** 2)).toFixed(1) : 'n/d';
        const m = a.measurements || {};

        return `
                        <div class="card">
                            <div class="card-header">
                                <div class="flex justify-between">
                                    <strong>${date}</strong>
                                    ${a.body_fat_percentage ? `<span class="badge badge-primary">${a.body_fat_percentage}% BF</span>` : ''}
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="grid grid-3 mb-md">
                                    <div>
                                        <div class="text-muted">Peso</div>
                                        <strong>${a.weight || 'n/d'} kg</strong>
                                    </div>
                                    <div>
                                        <div class="text-muted">Altura</div>
                                        <strong>${a.height || 'n/d'} cm</strong>
                                    </div>
                                    <div>
                                        <div class="text-muted">IMC</div>
                                        <strong>${imc}</strong>
                                    </div>
                                </div>
                                 ${Object.values(m).some(v => v) ? `
                                    <div><strong>Circunferências:</strong></div>
                                    <div class="grid grid-3 gap-sm mt-sm">
                                        ${m.chest ? `<div>Peitoral: ${m.chest}cm</div>` : ''}
                                        ${m.waist ? `<div>Cintura: ${m.waist}cm</div>` : ''}
                                        ${m.hip ? `<div>Quadril: ${m.hip}cm</div>` : ''}
                                        ${m.arm ? `<div>Braço: ${m.arm}cm</div>` : ''}
                                        ${m.thigh ? `<div>Coxa: ${m.thigh}cm</div>` : ''}
                                        ${m.calf ? `<div>Panturrilha: ${m.calf}cm</div>` : ''}
                                    </div>
                                ` : ''}
                                
                                ${a.photos && a.photos.length > 0 ? `
                                    <div class="mt-md"><strong>Fotos:</strong></div>
                                    <div class="flex gap-sm mt-xs overflow-x-auto pb-sm">
                                        ${a.photos.map(p => `<img src="${p}" style="height:100px; border-radius:8px; border:1px solid var(--border);">`).join('')}
                                    </div>
                                ` : (a.photo_front ? `
                                    <div class="mt-md"><strong>Fotos:</strong></div>
                                    <div class="flex gap-sm mt-xs">
                                        ${a.photo_front ? `<img src="${a.photo_front}" style="height:100px; border-radius:8px; border:1px solid var(--border);">` : ''}
                                        ${a.photo_side_right ? `<img src="${a.photo_side_right}" style="height:100px; border-radius:8px; border:1px solid var(--border);">` : ''}
                                        ${a.photo_side_left ? `<img src="${a.photo_side_left}" style="height:100px; border-radius:8px; border:1px solid var(--border);">` : ''}
                                    </div>
                                ` : '')}

                                ${a.notes ? `<div class="mt-md"><strong>Observações:</strong> ${a.notes}</div>` : ''}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        ` : '<p class="text-muted text-center">Nenhuma avaliação registrada</p>'}
    `;

    UI.showModal(`Avaliações - ${studentName}`, modalContent);
};

// AI Assessment Flow for Personal
let currentAssessment = null;

window.startAIAssessmentForPersonal = (selectedId = '') => {
    const currentUser = auth.getCurrentUser();
    const students = db.query('profiles', s => s.assigned_personal_id === currentUser.id);

    const modalContent = `
        <div id="ai-assessment-form">
            <div class="form-group">
                <label class="form-label">Selecione o Aluno *</label>
                <select class="form-select" id="assess-student" required>
                    <option value="">Escolha um aluno...</option>
                    ${students.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>
            <div class="grid grid-2 gap-md mb-lg">
                <div class="form-group">
                    <label class="form-label">Peso Atual (kg)</label>
                    <input type="number" id="assess-weight" class="form-input" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label class="form-label">Altura (cm)</label>
                    <input type="number" id="assess-height" class="form-input" placeholder="170">
                </div>
            </div>

            <div class="flex flex-col gap-md">
                <div class="photo-upload-container">
                    <label class="form-label">Foto de Frente 📸</label>
                    <div class="photo-preview-box-personal" id="preview-front-p" onclick="document.getElementById('photo-front-p').click()" 
                         style="height:120px; border:2px dashed var(--border); border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;">
                        <span>Clique para selecionar</span>
                    </div>
                    <input type="file" id="photo-front-p" accept="image/*" class="hidden" onchange="window.previewAssessmentPhotoPersonal(this, 'preview-front-p')">
                </div>

                <div class="grid grid-2 gap-md">
                    <div class="photo-upload-container">
                        <label class="form-label">Lado Direito 📸</label>
                        <div class="photo-preview-box-personal" id="preview-right-p" onclick="document.getElementById('photo-right-p').click()"
                             style="height:120px; border:2px dashed var(--border); border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;">
                            <span>Selecionar</span>
                        </div>
                        <input type="file" id="photo-right-p" accept="image/*" class="hidden" onchange="window.previewAssessmentPhotoPersonal(this, 'preview-right-p')">
                    </div>
                    <div class="photo-upload-container">
                        <label class="form-label">Lado Esquerdo 📸</label>
                        <div class="photo-preview-box-personal" id="preview-left-p" onclick="document.getElementById('photo-left-p').click()"
                             style="height:120px; border:2px dashed var(--border); border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;">
                            <span>Selecionar</span>
                        </div>
                        <input type="file" id="photo-left-p" accept="image/*" class="hidden" onchange="window.previewAssessmentPhotoPersonal(this, 'preview-left-p')">
                    </div>
                </div>
            </div>
        </div>
    `;

    UI.showModal('🤖 Avaliação Física IA', modalContent, async () => {
        const studentId = document.getElementById('assess-student').value;
        const weight = document.getElementById('assess-weight').value;
        const height = document.getElementById('assess-height').value;

        const photoFront = document.getElementById('preview-front-p').querySelector('img')?.src;
        const photoRight = document.getElementById('preview-right-p').querySelector('img')?.src;
        const photoLeft = document.getElementById('preview-left-p').querySelector('img')?.src;

        if (!studentId || !weight || !height || !photoFront) {
            UI.showNotification('Dados Incompletos', 'Preencha aluno, peso, altura e pelo menos a foto de frente.', 'warning');
            return false;
        }

        UI.showLoading('Personal IA analisando o aluno...');

        try {
            const student = db.getById('profiles', studentId);
            const aiResult = await AIHelper.analyzePhysicalAssessment({
                name: student.name,
                weight,
                height,
                age: student.age,
                goal: student.goal
            }, {
                front: photoFront,
                side_right: photoRight,
                side_left: photoLeft
            });

            if (aiResult) {
                currentAssessment = {
                    student_id: studentId,
                    student_name: student.name,
                    weight: parseFloat(weight) || 0,
                    height: parseFloat(height) || 0,
                    body_fat_percentage: parseFloat(aiResult.body_fat_est) || 0,
                    analysis: aiResult.analysis || '',
                    recommendations: aiResult.recommendations || '',
                    photo_front: photoFront,
                    photo_side_right: photoRight,
                    photo_side_left: photoLeft,
                    is_ai_generated: true,
                    date: new Date().toISOString()
                };

                UI.hideLoading();
                UI.closeModal();
                displayAIAssessmentResult();
            }
        } catch (error) {
            console.error('Erro na avaliação IA:', error);
            UI.hideLoading();
            UI.showNotification('Erro na IA', error.message || 'Não foi possível completar a análise visual.', 'error');
        }
    }, '🤖 Gerar Análise');
};

window.previewAssessmentPhotoPersonal = (input, previewId) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(previewId);
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

function displayAIAssessmentResult() {
    const container = document.getElementById('assessment-container');
    const content = document.getElementById('assessment-content');

    if (!currentAssessment) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    content.innerHTML = `
        <div class="card mb-xl shadow-glow" style="border-top: 5px solid var(--primary);">
            <div class="card-header flex justify-between items-center">
                <h3 class="card-title">Resultado da Análise IA para ${currentAssessment.student_name}</h3>
                <span class="badge badge-primary">🤖 Gerado por IA</span>
            </div>
            <div class="card-body">
                <div class="grid grid-3 gap-md mb-lg">
                    <div class="stat-card">
                        <div class="stat-label">Peso</div>
                        <div class="stat-value"><input type="number" class="form-input text-center" value="${currentAssessment.weight}" onchange="currentAssessment.weight = this.value"></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Altura</div>
                        <div class="stat-value"><input type="number" class="form-input text-center" value="${currentAssessment.height}" onchange="currentAssessment.height = this.value"></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Gordura Est. (%)</div>
                        <div class="stat-value"><input type="number" class="form-input text-center" value="${currentAssessment.body_fat_percentage}" onchange="currentAssessment.body_fat_percentage = this.value"></div>
                    </div>
                </div>

                <div class="form-group mb-md">
                    <label class="form-label font-bold">Análise Técnica (Editável)</label>
                    <textarea class="form-textarea" style="min-height: 150px;" onchange="currentAssessment.analysis = this.value">${currentAssessment.analysis}</textarea>
                </div>

                <div class="form-group mb-lg">
                    <label class="form-label font-bold">Recomendações do Coach (Editável)</label>
                    <textarea class="form-textarea" style="min-height: 100px;" onchange="currentAssessment.recommendations = this.value">${currentAssessment.recommendations}</textarea>
                </div>

                <div class="flex gap-md mb-xl">
                    <div class="flex-1 text-center">
                        <p class="text-xs mb-xs">Frente</p>
                        <img src="${currentAssessment.photo_front}" class="rounded-lg shadow-sm" style="width:100%; height:150px; object-fit:cover;">
                    </div>
                    ${currentAssessment.photo_side_right ? `
                    <div class="flex-1 text-center">
                        <p class="text-xs mb-xs">Lado Dir.</p>
                        <img src="${currentAssessment.photo_side_right}" class="rounded-lg shadow-sm" style="width:100%; height:150px; object-fit:cover;">
                    </div>` : ''}
                    ${currentAssessment.photo_side_left ? `
                    <div class="flex-1 text-center">
                        <p class="text-xs mb-xs">Lado Esq.</p>
                        <img src="${currentAssessment.photo_side_left}" class="rounded-lg shadow-sm" style="width:100%; height:150px; object-fit:cover;">
                    </div>` : ''}
                </div>

                <div class="flex flex-col gap-sm">
                    <button class="btn btn-primary btn-lg btn-block shadow-glow" onclick="window.saveAIAssessment()">
                        💾 Salvar Avaliação e Enviar
                    </button>
                    <button class="btn btn-ghost btn-block" onclick="if(confirm('Descartar esta avaliação?')) { currentAssessment = null; displayAIAssessmentResult(); }">
                        🗑️ Descartar
                    </button>
                </div>
            </div>
        </div>
    `;

    container.scrollIntoView({ behavior: 'smooth' });
}

window.saveAIAssessment = async () => {
    if (!currentAssessment) return;

    UI.showLoading('Salvando avaliação...');
    try {
        const photos = [];
        if (currentAssessment.photo_front) photos.push(currentAssessment.photo_front);
        if (currentAssessment.photo_side_right) photos.push(currentAssessment.photo_side_right);
        if (currentAssessment.photo_side_left) photos.push(currentAssessment.photo_side_left);

        await db.create('assessments', {
            student_id: currentAssessment.student_id,
            weight: currentAssessment.weight,
            height: currentAssessment.height,
            body_fat_percentage: currentAssessment.body_fat_percentage,
            notes: currentAssessment.analysis || currentAssessment.notes,
            measurements: {
                recommendations: currentAssessment.recommendations
            },
            photos: photos,
            personal_id: auth.getCurrentUser().id,
            date: new Date().toISOString()
        });

        UI.hideLoading();
        UI.showNotification('Sucesso!', 'Avaliação física salva com sucesso.', 'success');

        currentAssessment = null;
        displayAIAssessmentResult();

        router.navigate('/personal/assessments');
    } catch (err) {
        console.error('Error saving AI assessment:', err);
        UI.hideLoading();
        UI.showNotification('Erro', 'Falha ao salvar a avaliação.', 'error');
    }
};
