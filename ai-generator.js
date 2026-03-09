// ============================================
// AI GENERATOR & ANALYTICS (GEMINI INTEGRATION)
// ============================================

console.log('T-FIT AI: Módulo ai-generator.js carregado v2.2 (Macros e Nutrição)');

const NutritionHelper = {
    calculateMacros: (params) => {
        const { weight, height, age, sex, activity, goal } = params;

        // 1. BMR (Mifflin-St Jeor)
        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        const isMale = sex && (sex.toLowerCase() === 'masculino' || sex.toLowerCase() === 'male');
        bmr = isMale ? bmr + 5 : bmr - 161;

        // 2. TDEE
        const tdee = bmr * parseFloat(activity);

        // 3. Goal Adjustment
        let calories = tdee;
        if (goal === 'lose_weight') calories -= 500;
        else if (goal === 'gain_muscle') calories += 400;

        // 4. Macro Splits
        let pRatio, cRatio, fRatio;
        if (goal === 'lose_weight') {
            pRatio = 0.4; cRatio = 0.3; fRatio = 0.3; // High Protein for cutting
        } else if (goal === 'gain_muscle') {
            pRatio = 0.3; cRatio = 0.5; fRatio = 0.2; // High Carb for bulking
        } else {
            pRatio = 0.3; cRatio = 0.4; fRatio = 0.3; // Balanced maintenance
        }

        return {
            calories: Math.round(calories),
            protein: Math.round((calories * pRatio) / 4),
            carbs: Math.round((calories * cRatio) / 4),
            fat: Math.round((calories * fRatio) / 9)
        };
    },
    calculateWater: (weight) => Math.round(weight * 35), // 35ml per kg

    // --- New Manual (Rule-based) Diet Generator ---
    generateManualDiet: (params) => {
        const macros = NutritionHelper.calculateMacros(params);
        const water = NutritionHelper.calculateWater(params.weight);
        const db = window.NutritionDB || { meals: {} };
        const meals = [];

        // Dynamic slot allocation based on meal count
        let mealSlots = [];
        if (params.mealCount == 3) mealSlots = ['breakfast', 'lunch', 'dinner'];
        else if (params.mealCount == 4) mealSlots = ['breakfast', 'lunch', 'snack', 'dinner'];
        else if (params.mealCount == 5) mealSlots = ['breakfast', 'snack', 'lunch', 'snack', 'dinner'];
        else if (params.mealCount == 6) mealSlots = ['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'snack'];
        else mealSlots = ['breakfast', 'lunch', 'snack', 'dinner']; // Default 4

        const usedIndices = { breakfast: [], lunch: [], snack: [], dinner: [] };

        for (let i = 0; i < mealSlots.length; i++) {
            const slot = mealSlots[i];
            const pool = db.meals[slot] || [];

            // Filter by preference
            let options = pool.filter(m => m.prefs.includes(params.preference || 'omnivore'));
            if (options.length === 0) options = pool; // Fallback to all in slot

            // Try to find a unique meal if possible
            let selectedIdx = -1;
            let attempts = 0;
            const availableOptions = options.length;

            do {
                selectedIdx = Math.floor(Math.random() * options.length);
                attempts++;
            } while (usedIndices[slot].includes(selectedIdx) && attempts < 10 && usedIndices[slot].length < availableOptions);

            usedIndices[slot].push(selectedIdx);
            const selected = options[selectedIdx];

            if (selected) {
                // Approximate time distribution
                let time = "08:00";
                if (params.mealCount == 3) {
                    const times = ["08:00", "12:30", "20:00"];
                    time = times[i];
                } else if (params.mealCount == 4) {
                    const times = ["08:00", "12:30", "16:30", "20:00"];
                    time = times[i];
                } else {
                    const interval = 12 / (params.mealCount - 1);
                    const hour = 8 + (i * interval);
                    const h = Math.floor(hour);
                    const m = Math.round((hour - h) * 60);
                    time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                }

                meals.push({
                    name: selected.name,
                    time: time,
                    foods: selected.foods,
                    macros: selected.macros, // Included for reference but not enforced yet
                    macroTip: `Refeição equilibrada para ${params.goal === 'lose_weight' ? 'emagrecer' : 'ganhar massa'}.`
                });
            }
        }

        return {
            calories: macros.calories,
            protein: macros.protein,
            carbs: macros.carbs,
            fat: macros.fat,
            water: water,
            meals: meals,
            visual_evaluation: "Plano gerado de forma automática com base no seu metabolismo e objetivos, sem necessidade de processamento por IA."
        };
    }
};

const AIHelper = {
    // --- Core API Call (Wrapper para Gemini ou DeepSeek) ---
    callGemini: async (prompt, config = {}, images = []) => {
        // PROVIDER ROUTER
        let provider = window.AI_CONFIG?.provider || 'gemini';

        // DeepSeek fallback/routing: If provider is deepseek but visual analysis is strictly required and Gemini is available,
        // we could force it, but the user requested to use the same IA as workouts (DeepSeek).
        // So we only force Gemini if the user explicitly chooses it or if the prompt is VISUAL ONLY.

        console.log(`T-FIT AI: Iniciando chamada (Provider: ${provider})...`);

        try {
            if (provider === 'deepseek') {
                return await AIHelper.callDeepSeek(prompt, config);
            }

            // Default to Gemini (via Backend or Direct fallback)
            if (window.firebaseFunctions) {
                const generateContent = window.firebaseFunctions.httpsCallable('generateAIContent');
                const result = await generateContent({ prompt, config, images });
                if (result.data && result.data.success) {
                    return AIHelper._parseJSON(result.data.text);
                } else {
                    throw new Error(result.data?.error || "Erro no Backend Gemini.");
                }
            } else {
                console.warn("T-FIT AI: Firebase Functions não disponível. Usando Gemini Direto...");
                return await AIHelper.callGeminiDirect(prompt, config, images);
            }
        } catch (error) {
            console.error(`T-FIT AI: Erro no provider ${provider}:`, error);

            // Auto-fallback chain
            if (provider === 'gemini') {
                // If firebase failed, try direct
                return await AIHelper.callGeminiDirect(prompt, config, images);
            }

            throw error;
        }
    },

    // --- Nova Chamada DeepSeek ---
    callDeepSeek: async (prompt, config = {}) => {
        const conf = window.AI_CONFIG.deepseek;
        if (!conf || !conf.apiKey) throw new Error("API Key da DeepSeek faltando!");

        console.log("T-FIT AI: Enviando requisição para DeepSeek...");

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

            const response = await fetch(conf.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${conf.apiKey.trim()}`
                },
                body: JSON.stringify({
                    model: conf.model || "deepseek-chat",
                    messages: [
                        { role: "system", content: "Você é um especialista em fitness da T-FIT AI. Responda APENAS JSON." },
                        { role: "user", content: prompt }
                    ],
                    temperature: config.temperature || 0.7,
                    response_format: { type: 'json_object' }
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                console.error("DeepSeek Error Response:", errorBody);
                throw new Error(`Erro API DeepSeek (${response.status}): ${errorBody.error?.message || response.statusText}`);
            }

            const data = await response.json();
            if (!data.choices || data.choices.length === 0) throw new Error("DeepSeek retornou uma resposta vazia.");

            const text = data.choices[0].message.content;
            return AIHelper._parseJSON(text);
        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                throw new Error("Erro de Conexão/CORS com DeepSeek. Verifique sua rede ou use o provider Gemini.");
            }
            throw err;
        }
    },

    // --- Gemini Direct Fetch (Bypass Firebase Restriction) ---
    callGeminiDirect: async (prompt, config = {}, images = []) => {
        const conf = window.AI_CONFIG.gemini;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${conf.model || 'gemini-1.5-flash'}:generateContent?key=${conf.apiKey}`;

        // Build parts array: text prompt + any images
        const parts = [{ text: prompt }];

        if (Array.isArray(images)) {
            images.forEach(img => {
                if (img && typeof img === 'string' && img.includes('base64,')) {
                    const mimeParts = img.match(/^data:([^;]+);base64,(.+)$/);
                    if (mimeParts) {
                        parts.push({
                            inlineData: {
                                mimeType: mimeParts[1],
                                data: mimeParts[2]
                            }
                        });
                    }
                }
            });
        }

        const body = {
            contents: [{ parts }],
            generationConfig: {
                temperature: config.temperature || 0.7,
                responseMimeType: "application/json"
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute for images

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const msg = errData.error?.message || response.statusText;
                console.error("Gemini API Error Detail:", errData);
                throw new Error(`Erro Gemini (${response.status}): ${msg}`);
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                const reason = data.promptFeedback?.blockReason || "Filtro de segurança ativado";
                throw new Error(`Gemini recusou a análise: ${reason}`);
            }

            const text = data.candidates[0].content.parts[0].text;
            return AIHelper._parseJSON(text);
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            if (fetchErr.name === 'AbortError') throw new Error("A análise demorou demais. Tente fotos menores ou verifique sua conexão.");
            throw fetchErr;
        }
    },

    // --- Helper to parse JSON from AI response ---
    _parseJSON: (textResponse) => {
        try {
            if (!textResponse) throw new Error("Resposta de texto vazia.");

            console.log("T-FIT AI: Processando resposta...", textResponse.substring(0, 100) + '...');

            // 1. Clean Markdown and extra text
            let cleaned = textResponse
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .replace(/\\n/g, '\n')
                .trim();

            // 2. Locate boundaries
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            const firstBracket = cleaned.indexOf('[');
            const lastBracket = cleaned.lastIndexOf(']');

            if (firstBrace === -1 && firstBracket === -1) {
                throw new Error("Nenhum objeto ou array JSON encontrado na resposta.");
            }

            // Prioritize what looks like the main content
            let jsonString = "";
            if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
                jsonString = cleaned.substring(firstBracket, lastBracket + 1);
            } else {
                jsonString = cleaned.substring(firstBrace, lastBrace + 1);
            }

            let parsed = JSON.parse(jsonString);

            // 3. Normalize: if AI wrapped the result in a property (common mistake)
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                const keys = Object.keys(parsed);
                // If it's something like { "workout": [...] } or { "diet": {...} }
                if (keys.length === 1 && (Array.isArray(parsed[keys[0]]) || typeof parsed[keys[0]] === 'object')) {
                    console.log(`T-FIT AI: Auto-extraindo conteúdo da chave principal: ${keys[0]}`);
                    parsed = parsed[keys[0]];
                }
            }

            return parsed;
        } catch (e) {
            console.error("T-FIT AI: Falha crítica ao processar JSON.", e, "\nResposta bruta:", textResponse);
            throw new Error(`Erro ao interpretar os dados da IA. Formato inválido ou incompleto.`);
        }
    },

    // --- Workout Generator ---
    generateSpecificWorkout: async (params) => {
        const prompt = `
            Você é um personal trainer especialista em musculação e fitness de elite da T-FIT.
            IMPORTANTE: Sua missão é criar um treino EXTREMAMENTE EFICAZ, SEGURO e ALTAMENTE PERSONALIZADO.
            
            DADOS DO ALUNO:
            - Perfil: ${params.sex === 'male' || params.sex === 'Masculino' ? 'Homem' : 'Mulher'}, ${params.age || 30} anos
            - Foco/Grupamento: ${params.focus || 'Full Body'}
            - Nível/Experiência: ${params.level || 'intermediário'}
            - Objetivo Principal: ${params.specificGoal || 'hipertrofia'}
            - Local e Equipamentos: ${params.location || 'academia'} com ${params.equipment || 'academia completa'}
            - Tempo Disponível: ${params.time || 60} minutos
            
            CONTEXTO DE RECUPERAÇÃO E SAÚDE:
            - Qualidade do Sono: ${params.sleep || params['wiz-sleep'] || 'Não informado'}
            - Nível de Estresse: ${params.stress || params['wiz-stress'] || 'Não informado'}
            - Restrições/Lesões: ${params.restrictions || params['wiz-injuries'] || 'Nenhuma'}
            - Condições de Saúde: ${params.health || params['wiz-health'] || 'Nenhuma'}
            
            PREFERÊNCIAS:
            - Estilos que Gostas: ${params.likedStyles || params['wiz-liked'] || 'Não informado'}
            - Estilos que NÃO Gostas: ${params.dislikedStyles || params['wiz-disliked'] || 'Não informado'}
            
            DIRETRIZES TÉCNICAS (AI PRO):
            1. Periodização: Selecione exercícios que sigam uma lógica biomecânica eficiente (ex: grandes grupos antes de pequenos).
            2. Segurança: Considere as restrições rigorosamente. Se houver má qualidade de sono ou alto estresse, modere o volume mas mantenha a intensidade.
            3. Volume: Ajuste séries e repetições para maximizar o resultado considerando que ${params.age} anos e ${params.sleep} de sono afetam a recuperação.
            4. Local: Use APENAS equipamentos disponíveis em ${params.equipment}.
            
            Formato JSON (ARRAY de objetos):
            [{
                "name": "Nome do exercício (Português)",
                "series": 3,
                "reps": "10-12",
                "rest": "60-90s",
                "notes": "Dica técnica avançada para este perfil específico."
            }]
            
            IMPORTANTE: Inclua um campo final chamado "rationale" (pode ser o último item do array ou um objeto pai) com uma análise técnica profunda (4-5 frases) explicando a estratégia adotada (ex: por que escolheu tal volume baseado no sono/estresse e como adaptou para as restrições).
            
            Retorne APENAS o JSON puro.
        `;

        const response = await AIHelper.callGemini(prompt, { temperature: 0.7 });

        // Handle normalization
        if (response && !Array.isArray(response) && response.exercises) {
            const exercises = response.exercises;
            exercises.rationale = response.rationale || exercises.rationale;
            return exercises;
        }
        return response;
    },

    generateDiet: async (params) => {
        // Normalização de parâmetros (suporte para os dois formatos: manual e wizard)
        const weight = params.weight || params['d-wiz-weight'];
        const height = params.height || params['d-wiz-height'];
        const age = params.age || params['d-wiz-age'];
        const sex = params.sex || params['d-wiz-sex'];
        const goal = params.goal || params['d-wiz-goal'];
        const preference = params.preference || params['d-wiz-pref'] || 'omnivore';
        const mealCount = params.mealCount || params['d-wiz-meals'] || 4;

        const appetite = params.appetite || params['d-wiz-appetite'] || 'Moderado';
        const routine = params.routine || params['d-wiz-routine'] || 'Mais ou menos';
        const delivery = params.delivery || params['d-wiz-delivery'] || 'Raramente';
        const alcohol = params.alcohol || params['d-wiz-alcohol'] || 'Não';
        const waterCons = params.water || params['d-wiz-water'] || '1–2L';
        const meds = params.meds || params['d-wiz-meds-desc'] || 'Nenhum';
        const supplements = params.supplements || (params['d-wiz-supps'] || []).join(', ') || 'Nenhum';
        const likes = params.likes || params['d-wiz-likes'] || 'Não informado';
        const dislikes = params.restrictions || params['d-wiz-dislikes'] || 'Não informado';

        const macros = params.macros || NutritionHelper.calculateMacros({ weight, height, age, sex, activity: params.activity || 1.375, goal });
        const waterTgt = NutritionHelper.calculateWater(weight);

        const prompt = `
            Você é um nutricionista esportivo de elite da T-FIT AI PRO.
            Seu objetivo é criar um plano alimentar científico, delicioso e perfeitamente ajustado aos macros e à realidade do aluno.
            
            DADOS METABÓLICOS:
            - Calorias: ${macros.calories}kcal
            - Proteína: ${macros.protein}g | Carboidrato: ${macros.carbs}g | Gordura: ${macros.fat}g
            - Hidratação Alvo: ${waterTgt}ml/dia (O aluno bebe atualmente: ${waterCons})
            
            PERFIL DETALHADO:
            - Aluno: ${weight}kg, ${height}cm, ${age} anos, Sexo: ${sex}
            - Objetivo: ${goal}
            - Estilo de Dieta: ${preference}
            - Refeições desejadas: ${mealCount} por dia
            
            HÁBITOS E COMPORTAMENTO:
            - Apetite: ${appetite}
            - Organização da Rotina: ${routine}
            - Frequência de Delivery/Comer fora: ${delivery}
            - Consumo de Álcool: ${alcohol}
            - Medicamentos: ${meds}
            - Suplementação Atual: ${supplements}
            
            PREFERÊNCIAS ALIMENTARES:
            - Alimentos que GOSTA: ${likes}
            - Alimentos a EVITAR / NÃO GOSTA / Alergias: ${dislikes}
            
            DIRETRIZES AI PRO:
            1. Realismo: Adapte a complexidade das refeições à organização da rotina (${routine}). Se for desorganizada, sugira preparos rápidos e "marmitáveis".
            2. Saciedade: Se o apetite for ${appetite}, ajuste o volume das refeições com vegetais e fibras sem estourar as calorias.
            3. Social e Álcool: Considere o consumo de álcool (${alcohol}) e dê uma dica técnica sobre como mitigar os danos ou ajustar a dieta se necessário.
            4. Personalização Extrema: Use os alimentos que o aluno gosta (${likes}) e NUNCA inclua os que ele não gosta (${dislikes}).
            5. Suplementação: Sugira como e quando utilizar os suplementos que ele já toma (${supplements}) para otimizar os resultados.
            
            Estrutura JSON:
            {
                "calories": ${macros.calories},
                "protein": ${macros.protein},
                "carbs": ${macros.carbs},
                "fat": ${macros.fat},
                "water": ${waterTgt},
                "meals": [{ "name": "Refeição", "time": "00:00", "foods": ["Quantidade + Alimento"], "macroTip": "Explicação nutricional avançada para este perfil." }],
                "visual_evaluation": "Feedback motivacional baseado nos seus dados específicos.",
                "rationale": "Análise técnica (4-5 frases) detalhando a estratégia nutricional aplicada (ex: como lidou com o apetite ${appetite} e a rotina ${routine})."
            }
            
            Retorne APENAS o JSON.
        `;

        return await AIHelper.callGemini(prompt, { temperature: 0.6 });
    },


    // --- Weekly Split Generator ---
    generateWeeklySplit: async (params) => {
        // Standardize numWorkouts to a valid integer
        const requestedNum = parseInt(params.numWorkouts) || 3;
        const safeNum = Math.min(Math.max(requestedNum, 1), 6); // Hard limit between 1 and 6

        // Standardize exercise count
        const safeExNum = parseInt(params.targetNumEx) || 8;

        // Generate required names to force Gemini
        const requiredNames = Array.from({ length: safeNum }, (_, i) => `Treino ${String.fromCharCode(65 + i)}`).join(', ');

        const prompt = `
            Você é um Head Coach da T-FIT AI PRO. Crie um Split Semanal (Divisão semanal) de elite e periodizado.
            
            DADOS DO PLANO:
            - Aluno: ${params.sex === 'male' || params.sex === 'Masculino' ? 'Homem' : 'Mulher'}, ${params.age || 30} anos
            - Treinos/Semana (Frequência sugerida): ${params.daysPerWeek}
            - Quantidade de Treinos Diferentes (Fichas/Objetos no array): ${safeNum}
            - EXERCÍCIOS POR TREINO: EXATAMENTE ${safeExNum} exercícios em cada ficha.
            - Nível/Experiência: ${params.level} (Tempo de treino: ${params.experienceTime || params['wiz-experience'] || 'Não informado'})
            - Objetivo: ${params.specificGoal}
            - Local: ${params.location || 'academia'}
            - Duração por sessão: ${params.time || 60} min
            - SÉRIES POR EXERCÍCIO (Sugerido): ${params.seriesCount || '3'} séries
            
            RECUPERAÇÃO E BIOTIPO:
            - Qualidade do Sono: ${params.sleep || params['wiz-sleep'] || 'Não informado'}
            - Nível de Estresse: ${params.stress || params['wiz-stress'] || 'Não informado'}
            - Restrições/Lesões: ${params.restrictions || params['wiz-injuries'] || 'Nenhuma'}
            - Histórico de Treino: ${params.prevTypes || params['wiz-prev-types'] || 'Não informado'}

            SOLICITAÇÕES ESPECÍFICAS (ALTA PRIORIDADE):
            - Foco Principal (Texto Livre): ${params.focusText || params['wiz-focus-text'] || 'Não informado (Seguir objetivo geral)'}
            - Solicitação de Volume/Quantidade: ${params.volumeText || params['wiz-volume-text'] || 'Não informado (Seguir padrão)'}

            DIRETRIZES TÉCNICAS (AI PRO):
            0. REGRA CRÍTICA E OBRIGATÓRIA: 
               - Você deve retornar EXATAMENTE ${safeNum} objetos dentro do array "workouts". Nem mais, nem menos. 
               - CADA TREINO DEVE TER EXATAMENTE ${safeExNum} EXERCÍCIOS.
               - NUNCA REPITA O NOME DOS TREINOS. Os nomes devem ser estritamente: ${requiredNames}.
               - EXCEÇÃO ZERO: Não crie "Treino A" duas vezes. Não crie "Treino B" duas vezes. Cada treino deve ser único para cobrir a divisão.
               - O array "workouts" DEVE ter EXATAMENTE o tamanho de ${safeNum}.
               - Se o campo "Solicitação de Volume/Quantidade" tiver números (ex: "6 para costas"), VOCÊ DEVE SEGUIR EXATAMENTE ESSA CONTAGEM.
            1. Estrutura: A divisão deve ser biomecanicamente equilibrada (ex: PPL, Upper/Lower, Arnold Split).
            2. Fadiga: Como o aluno tem estresse nível ${params.stress} e sono ${params.sleep}, gerencie o volume semanal para evitar overtraining, focando em qualidade sobre quantidade.
            3. Progressão: Organize os exercícios para maximizar a tensão mecânica dentro dos ${params.time} minutos disponíveis.
            4. Especificidade: Ajuste os exercícios rigosoramente para o local (${params.location}) e equipamentos (${params.equipment}).
            5. Segurança: NUNCA sugira exercícios que comprometam as lesões relatadas (${params.restrictions}).
            6. Retorno: Retorne APENAS o JSON puro. Não explique nada fora do JSON.
 

            Formato JSON esperado:
            {
                "rationale": "Análise profunda da periodização (4-5 frases).",
                "workouts": [
                    {
                        "name": "Nome do Treino (ex: Treino A - Peito)",
                        "type": "Foco do Treino",
                        "duration": 60,
                        "exercises": [{ "name": "Exercício", "series": 3, "reps": "12", "rest": "60s", "notes": "Dica" }]
                    }
                ]
            }
        `;

        const response = await AIHelper.callGemini(prompt, { temperature: 0.7 });

        // Normalização robusta v3.3
        let normalized = { rationale: response?.rationale || "", workouts: [] };

        if (Array.isArray(response)) {
            normalized.workouts = response;
        } else if (response && response.workouts && Array.isArray(response.workouts)) {
            normalized.workouts = response.workouts;
            normalized.rationale = response.rationale || normalized.rationale;
        }

        if (!normalized.workouts || normalized.workouts.length === 0) {
            console.error("T-FIT AI: Resposta não contém treinos válidos.", response);
            return [];
        }

        // Apply strict limit and mapping
        normalized.workouts = normalized.workouts.slice(0, safeNum).map((w, idx) => {
            const letter = String.fromCharCode(65 + idx);
            let cleanedName = w.name ? w.name.replace(/^[Tt]reino\s+[A-Z]\s*[-–:]*\s*/, '').trim() : '';
            if (!cleanedName || cleanedName.toLowerCase() === 'treino ' + letter.toLowerCase()) {
                cleanedName = w.type || w.focus || 'Geral';
            }

            // Strictly enforce exercise count in mapping if AI fails to follow instructions
            let exercises = Array.isArray(w.exercises) ? w.exercises : [];
            if (exercises.length > safeExNum) {
                exercises = exercises.slice(0, safeExNum);
            }

            return {
                ...w,
                name: `Treino ${letter} - ${cleanedName}`,
                type: w.type || w.focus || "Padrão",
                exercises: exercises
            };
        });

        // Attach rationale to the array itself if needed by legacy callers
        normalized.workouts.rationale = normalized.rationale;

        console.log(`T-FIT AI: Geração concluída. ${normalized.workouts.length} treinos gerados.`);
        return normalized.workouts;
    },

    // --- NEW: Posture Analysis AI ---
    analyzePosture: async (base64Image) => {
        const prompt = `
            Você é um fisioterapeuta especialista em biomecânica da T-FIT AI. 
            Analise a foto de postura do aluno (anexada em base64) e identifique desvios.
            
            FOCO DA ANÁLISE:
            1. Cabeça/Pescoço (Protrusão, Inclinação)
            2. Ombros (Nivelamento, Rotação interna)
            3. Coluna Torácica (Cifose/Corcunda)
            4. Pelve/Quadris (Inclinação lateral ou anterior)

            REGRAS:
            - Se a foto não for de uma pessoa, retorne um erro amigável no JSON.
            - Seja crítico mas encorajador.
            - Sugira 2 exercícios corretivos específicos baseados na falha detectada.

            RETORNO JSON:
            {
                "success": true,
                "analysis": {
                    "head": { "status": "ALINHADO|DESVIO LEVE|DESVIO ACENTUADO", "label": "Cabeça / Pescoço" },
                    "shoulders": { "status": "ALINHADO|DESVIO LEVE|DESVIO ACENTUADO", "label": "Ombros (Nível)" },
                    "spine": { "status": "ALINHADO|DESVIO LEVE|DESVIO ACENTUADO", "label": "Coluna Torácica" },
                    "hips": { "status": "ALINHADO|DESVIO LEVE|DESVIO ACENTUADO", "label": "Pelve / Quadris" }
                },
                "deviation_details": "Explicação técnica curta do desvio mais importante.",
                "recommendation": "Sugestão de exercícios corretivos (ex: Mobilidade Escapular 3x15)."
            }
        `;
        return await AIHelper.callGemini(prompt, { temperature: 0.4 }, [base64Image]);
    },

    // --- NEW: Physical Assessment AI ---
    analyzePhysicalAssessment: async (params, photos = {}) => {
        const prompt = `
            Você é um Head Coach e Especialista em Transformação Corporal da T-FIT AI.
            Sua missão é realizar uma AVALIAÇÃO FÍSICA completa baseada em dados biométricos e análise visual (se disponível).

            DADOS DO ALUNO:
            - Nome: ${params.name || 'Aluno'}
            - Peso: ${params.weight}kg
            - Altura: ${params.height}cm
            - Idade: ${params.age || 'Não informada'}
            - Sexo: ${params.sex || 'Não informado'}
            - Objetivo: ${params.goal || 'Transformação Geral'}

            NOTA TÉCNICA: Se este processamento for feito por uma IA de texto puro, utilize os dados biométricos (IMC, relação peso/altura) para fornecer uma estimativa profissional e um plano de ação condizente.

            SUA TAREFA:
            1. Analise a composição corporal (estimativa de gordura e massa muscular).
            2. Identifique possíveis pontos fortes e pontos de melhoria baseados no perfil.
            3. Forneça um plano de ação: o que o aluno deve mudar no treino ou dieta para resultados melhores.

            RETORNO JSON:
            {
                "success": true,
                "body_fat_est": "Estimativa % (ex: 18-22%)",
                "analysis": "Análise técnica do perfil físico e composição baseada nos dados fornecidos.",
                "strengths": ["Ponto forte 1", "Ponto forte 2"],
                "improvements": ["O que melhorar 1", "O que melhorar 2"],
                "recommendations": "O que tem que ser feito para resultados melhores (plano de ação claro).",
                "rationale": "Análise técnica final (4-5 frases) sobre a progressão ideal."
            }

            IMPORTANTE: Seja profissional, motivador e muito específico. Retorne APENAS o JSON puro.
        `;
        const imageParts = [];
        if (photos.front) imageParts.push(photos.front);
        if (photos.side_right) imageParts.push(photos.side_right);
        if (photos.side_left) imageParts.push(photos.side_left);

        return await AIHelper.callGemini(prompt, { temperature: 0.5 }, imageParts);
    },

    // --- NEW: IA Vision Plate Analysis ---
    analyzePlate: async (base64Image) => {
        const prompt = `
            Você é um nutricionista esportivo de elite da T-FIT AI especializado em análise visual de alimentos.
            Analise a imagem anexa e forneça uma estimativa profissional dos macronutrientes.

            REGRAS CRÍTICAS:
            1. Se a imagem NÃO for comida ou prato de alimentação, retorne "is_food": false com uma mensagem de erro.
            2. Seja o mais preciso possível nas quantidades baseando-se no tamanho relativo dos alimentos no prato.
            3. Dê uma nota de 0 a 10 para a qualidade nutricional do prato (densidade de nutrientes vs calorias vazias).

            RETORNO JSON:
            {
                "is_food": true,
                "plate_name": "Nome descritivo do prato",
                "macros": {
                    "kcal": 450,
                    "prot": 30,
                    "carb": 50,
                    "fat": 12
                },
                "grade": 8.5,
                "feedback": "Análise motivadora e curta sobre o prato.",
                "rationale": "Explicação técnica de por que chegou nesses números (ex: estimativa de 150g de frango e 200g de arroz)."
            }
        `;
        return await AIHelper.callGemini(prompt, { temperature: 0.4 }, [base64Image]);
    }
};

window.AIHelper = AIHelper;
console.log('T-FIT AI: Funções disponíveis:', Object.keys(AIHelper));
