const WorkoutDB = {
    exercises: [
        // PEITO (CHEST)
        { name: 'Flexão de braço (Push-up)', category: 'peito', equipment: 'home', priority: 1 },
        { name: 'Flexão diamante', category: 'peito', equipment: 'home', priority: 2 },
        { name: 'Flexão inclinada (mãos no banco)', category: 'peito', equipment: 'home', priority: 2 },
        { name: 'Flexão declinada (pés no banco)', category: 'peito', equipment: 'home', priority: 2 },
        { name: 'Supino reto (barra)', category: 'peito', equipment: 'gym', priority: 1 },
        { name: 'Supino inclinado (barra)', category: 'peito', equipment: 'gym', priority: 1 },
        { name: 'Supino declinado (barra)', category: 'peito', equipment: 'gym', priority: 1 },
        { name: 'Supino reto (halteres)', category: 'peito', equipment: 'gym', priority: 1 },
        { name: 'Supino inclinado (halteres)', category: 'peito', equipment: 'gym', priority: 1 },
        { name: 'Crucifixo reto (halteres)', category: 'peito', equipment: 'gym', priority: 2 },
        { name: 'Crucifixo inclinado (halteres)', category: 'peito', equipment: 'gym', priority: 2 },
        { name: 'Peck Deck (Voador)', category: 'peito', equipment: 'gym', priority: 2 },
        { name: 'Crossover (polia alta)', category: 'peito', equipment: 'gym', priority: 2 },
        { name: 'Crossover (polia baixa)', category: 'peito', equipment: 'gym', priority: 2 },
        { name: 'Supino máquina', category: 'peito', equipment: 'gym', priority: 1 },
        { name: 'Flexão com palmas (explosiva)', category: 'peito', equipment: 'home', priority: 2 },
        { name: 'Dips (Paralelas focado em peito)', category: 'peito', equipment: 'gym', priority: 1 },
        { name: 'Crucifixo no chão (com garrafas)', category: 'peito', equipment: 'home_objects', priority: 2 },

        // COSTAS (BACK)
        { name: 'Barra fixa (Pull-up)', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Barra fixa pegada supinada (Chin-up)', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Remada curvada (barra)', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Remada curvada (halteres)', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Remada unilateral (Serrote)', category: 'costas', equipment: 'gym', priority: 2 },
        { name: 'Remada baixa no triângulo', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Puxada frontal (Pulley)', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Puxada com pegada aberta', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Puxada com pegada fechada', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Pulldown com corda', category: 'costas', equipment: 'gym', priority: 2 },
        { name: 'Remada cavalinho', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Levantamento terra (Deadlift)', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Meio levantamento terra (Rack Pull)', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Extensão lombar (Banco romano)', category: 'costas', equipment: 'gym', priority: 2 },
        { name: 'Remada máquina articulada', category: 'costas', equipment: 'gym', priority: 1 },
        { name: 'Superman (chão)', category: 'costas', equipment: 'home', priority: 2 },
        { name: 'Remada invertida (na barra ou mesa)', category: 'costas', equipment: 'home', priority: 2 },
        { name: 'Remada unilateral (com galão de água)', category: 'costas', equipment: 'home_objects', priority: 2 },
        { name: 'Remada curvada (cabo de vassoura e mochilas)', category: 'costas', equipment: 'home_objects', priority: 1 },

        // PERNAS (LEGS - Quadríceps/Glúteos/Posteriores)
        { name: 'Agachamento livre', category: 'pernas', equipment: 'home', priority: 1 },
        { name: 'Agachamento com barra', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Agachamento sumô', category: 'pernas', equipment: 'home', priority: 1 },
        { name: 'Agachamento búlgaro', category: 'pernas', equipment: 'home', priority: 2 },
        { name: 'Agachamento frontal', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Agachamento Goblet (halter no peito)', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Leg Press 45°', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Leg Press horizontal', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Cadeira extensora', category: 'pernas', equipment: 'gym', priority: 2 },
        { name: 'Afundo (Lunge)', category: 'pernas', equipment: 'home', priority: 1 },
        { name: 'Passada (Walking lunge)', category: 'pernas', equipment: 'home', priority: 1 },
        { name: 'Hack Machine', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Sissy squat', category: 'pernas', equipment: 'home', priority: 2 },
        { name: 'Subida no banco (Step-up)', category: 'pernas', equipment: 'home', priority: 2 },
        { name: 'Ponte de glúteo', category: 'pernas', equipment: 'home', priority: 2 },
        { name: 'Elevação pélvica com barra', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Abdução de quadril (máquina)', category: 'pernas', equipment: 'gym', priority: 2 },
        { name: 'Abdução com caneleira', category: 'pernas', equipment: 'home', priority: 2 },
        { name: 'Chute atrás (Glute kickback)', category: 'pernas', equipment: 'home', priority: 2 },
        { name: 'Stiff (barra ou halter)', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Mesa flexora', category: 'pernas', equipment: 'gym', priority: 2 },
        { name: 'Cadeira flexora', category: 'pernas', equipment: 'gym', priority: 2 },
        { name: 'Flexora vertical (unilateral)', category: 'pernas', equipment: 'gym', priority: 2 },
        { name: 'Good Morning (Bom dia)', category: 'pernas', equipment: 'gym', priority: 2 },
        { name: 'Flexão nórdica', category: 'pernas', equipment: 'home', priority: 2 },
        { name: 'Panturrilha em pé (máquina)', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Panturrilha sentado (Sóleo)', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Panturrilha no leg press', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Panturrilha burrinho', category: 'pernas', equipment: 'gym', priority: 1 },
        { name: 'Panturrilha unilateral (peso do corpo)', category: 'pernas', equipment: 'home', priority: 1 },
        { name: 'Agachamento Goblet (com galão ou mochila)', category: 'pernas', equipment: 'home_objects', priority: 1 },
        { name: 'Afundo (com sacolas de peso)', category: 'pernas', equipment: 'home_objects', priority: 1 },
        { name: 'Agachamento búlgaro (pé no sofá)', category: 'pernas', equipment: 'home', priority: 2 },
        { name: 'Elevação pélvica (costas no sofá)', category: 'pernas', equipment: 'home', priority: 1 },
        { name: 'Stiff (com mochila carregada)', category: 'pernas', equipment: 'home_objects', priority: 1 },
        { name: 'Panturrilha no degrau', category: 'pernas', equipment: 'home', priority: 1 },

        // OMBROS (SHOULDERS)
        { name: 'Desenvolvimento com barra', category: 'ombros', equipment: 'gym', priority: 1 },
        { name: 'Desenvolvimento com halteres', category: 'ombros', equipment: 'gym', priority: 1 },
        { name: 'Desenvolvimento Arnold', category: 'ombros', equipment: 'gym', priority: 2 },
        { name: 'Elevação lateral (halteres)', category: 'ombros', equipment: 'gym', priority: 1 },
        { name: 'Elevação lateral (polia)', category: 'ombros', equipment: 'gym', priority: 1 },
        { name: 'Elevação frontal (halteres)', category: 'ombros', equipment: 'gym', priority: 2 },
        { name: 'Elevação frontal (barra)', category: 'ombros', equipment: 'gym', priority: 2 },
        { name: 'Crucifixo inverso (halteres)', category: 'ombros', equipment: 'gym', priority: 2 },
        { name: 'Crucifixo inverso (máquina ou polia)', category: 'ombros', equipment: 'gym', priority: 2 },
        { name: 'Face pull (polia com corda)', category: 'ombros', equipment: 'gym', priority: 2 },
        { name: 'Encolhimento de ombros (trapezio)', category: 'ombros', equipment: 'gym', priority: 1 },
        { name: 'Remada alta (barra ou polia)', category: 'ombros', equipment: 'gym', priority: 1 },
        { name: 'Desenvolvimento (sentado com pesos improvisados)', category: 'ombros', equipment: 'home_objects', priority: 1 },
        { name: 'Elevação lateral (com garrafas de 500ml)', category: 'ombros', equipment: 'home_objects', priority: 2 },

        // BRAÇOS (ARMS)
        { name: 'Rosca direta (barra reta)', category: 'braços', equipment: 'gym', priority: 1 },
        { name: 'Rosca direta (barra W)', category: 'braços', equipment: 'gym', priority: 1 },
        { name: 'Rosca alternada (halteres)', category: 'braços', equipment: 'gym', priority: 1 },
        { name: 'Rosca martelo', category: 'braços', equipment: 'gym', priority: 1 },
        { name: 'Rosca concentrada', category: 'braços', equipment: 'gym', priority: 2 },
        { name: 'Rosca Scott', category: 'braços', equipment: 'gym', priority: 1 },
        { name: 'Rosca 21', category: 'braços', equipment: 'gym', priority: 2 },
        { name: 'Rosca inclinada (halteres)', category: 'braços', equipment: 'gym', priority: 2 },
        { name: 'Rosca inversa (antebraço)', category: 'braços', equipment: 'gym', priority: 2 },
        { name: 'Rosca punho', category: 'braços', equipment: 'gym', priority: 2 },
        { name: 'Tríceps testa (barra)', category: 'braços', equipment: 'gym', priority: 1 },
        { name: 'Tríceps corda (polia)', category: 'braços', equipment: 'gym', priority: 1 },
        { name: 'Tríceps pulley (barra reta ou V)', category: 'braços', equipment: 'gym', priority: 1 },
        { name: 'Tríceps francês (halter)', category: 'braços', equipment: 'gym', priority: 2 },
        { name: 'Tríceps coice (halter ou polia)', category: 'braços', equipment: 'gym', priority: 2 },
        { name: 'Mergulho no banco (Dips)', category: 'braços', equipment: 'home', priority: 1 },
        { name: 'Extensão de tríceps unilateral (polia)', category: 'braços', equipment: 'gym', priority: 2 },
        { name: 'Rosca direta (garrafas pet ou baldes)', category: 'braços', equipment: 'home_objects', priority: 1 },
        { name: 'Tríceps francês (garrafa 2L)', category: 'braços', equipment: 'home_objects', priority: 2 },

        // CORE / ABS
        { name: 'Prancha isométrica', category: 'abs', equipment: 'home', priority: 1 },
        { name: 'Prancha lateral', category: 'abs', equipment: 'home', priority: 2 },
        { name: 'Abdominal Crunch (chão)', category: 'abs', equipment: 'home', priority: 1 },
        { name: 'Abdominal infra (elevação de pernas)', category: 'abs', equipment: 'home', priority: 1 },
        { name: 'Abdominal bicicleta', category: 'abs', equipment: 'home', priority: 2 },
        { name: 'Abdominal supra na polia', category: 'abs', equipment: 'gym', priority: 2 },
        { name: 'Abdominal infra na barra fixa (Hanging leg raise)', category: 'abs', equipment: 'gym', priority: 1 },
        { name: 'Canivete (V-up)', category: 'abs', equipment: 'home', priority: 2 },
        { name: 'Russian Twist (rotação de tronco)', category: 'abs', equipment: 'home', priority: 2 },
        { name: 'Roda abdominal', category: 'abs', equipment: 'gym', priority: 2 },
        { name: 'Abdominal com carga (arroz/feijão)', category: 'abs', equipment: 'home_objects', priority: 2 },

        // CARDIO / HIIT
        { name: 'Burpees', category: 'cardio', equipment: 'home', priority: 1 },
        { name: 'Polichinelos', category: 'cardio', equipment: 'home', priority: 1 },
        { name: 'Mountain Climbers (Escalador)', category: 'cardio', equipment: 'home', priority: 1 },
        { name: 'Corrida no lugar (Skiping)', category: 'cardio', equipment: 'home', priority: 1 },
        { name: 'Saltos em caixa (Box jump)', category: 'cardio', equipment: 'gym', priority: 2 },
        { name: 'Pular corda', category: 'cardio', equipment: 'home', priority: 1 },
        { name: 'Kettlebell Swing', category: 'cardio', equipment: 'gym', priority: 2 },
        { name: 'Thrusters (Agachamento com desenvolvimento)', category: 'cardio', equipment: 'gym', priority: 1 },
        { name: 'Battle Rope (Corda naval)', category: 'cardio', equipment: 'gym', priority: 2 }
    ]
};

const WorkoutBuilder = {
    generate: (params) => {
        try {
            console.log("WorkoutBuilder: Gerando treino inteligente...");
            const { focus, equipment, level, specificGoal, daysPerWeek, intensity, observations } = params;

            // 1. Filter by Equipment
            let available = WorkoutDB.exercises.filter(ex => {
                if (equipment === 'home_body') return ex.equipment === 'home';
                if (equipment === 'home_weights') return ex.equipment === 'home' || ex.equipment === 'home_objects';
                return true; 
            });

            // 2. Determine Number of Splits
            let numWorkouts = parseInt(daysPerWeek) || 3;
            if (numWorkouts > 7) numWorkouts = 7; 

            const intensityMap = {
                'light': { series: 3, reps: '15', rest: '90' },
                'moderate': { series: 3, reps: '12', rest: '60' },
                'high': { series: 4, reps: '10', rest: '45' }
            };
            let iConfig = intensityMap[intensity] || intensityMap['moderate'];

            // Goal overrides
            if (specificGoal === 'hypertrophy') {
                iConfig.reps = intensity === 'high' ? '8-10' : '10-12';
                if (intensity === 'high') iConfig.series = 4;
            } else if (specificGoal === 'strength') {
                iConfig.reps = '4-8';
                iConfig.series = 4;
                iConfig.rest = '120';
            } else if (specificGoal === 'endurance') {
                iConfig.reps = '15-20';
                iConfig.series = 3;
                iConfig.rest = '45';
            }

            let splits = [];
            for (let i = 0; i < numWorkouts; i++) {
                let currentFocus = focus;
                let workoutLetter = String.fromCharCode(65 + i);
                let workoutName = `Treino ${workoutLetter}`;

                if (focus === 'Full Body') {
                    if (numWorkouts === 2) {
                        currentFocus = i === 0 ? 'Push' : 'Pull';
                    } else if (numWorkouts === 3) {
                        const focuses = ['Push', 'Pull', 'Legs'];
                        currentFocus = focuses[i];
                    } else if (numWorkouts >= 4) {
                        const subFocuses = ['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core', 'Cardio'];
                        currentFocus = subFocuses[i % subFocuses.length];
                    }
                }

                if (currentFocus !== focus) workoutName += ` - ${currentFocus}`;
                const exercises = WorkoutBuilder._selectIntelligently(available, currentFocus, iConfig, observations);

                splits.push({
                    name: workoutName,
                    type: (intensity === 'high' ? 'Intenso' : 'Padrão'),
                    duration: params.time || 60,
                    exercises: exercises
                });
            }

            return splits;
        } catch (error) {
            console.error("Erro no WorkoutBuilder:", error);
            if (typeof ErrorMonitor !== 'undefined') {
                ErrorMonitor.logAutomatic('WORKOUT_GENERATION_FAILED', {
                    message: error.message,
                    params: params
                }, 'WorkoutBuilder.generate');
            }
            throw error;
        }
    },

    _selectIntelligently: (pool, focus, config, obs) => {
        const focusMap = {
            'Peito': ['peito'],
            'Costas': ['costas'],
            'Pernas': ['pernas'],
            'Braços': ['braços'],
            'Ombros': ['ombros'],
            'Cardio': ['cardio'],
            'Push': ['peito', 'ombros', 'braços'],
            'Pull': ['costas', 'braços'],
            'Legs': ['pernas'],
            'Full Body': ['peito', 'costas', 'pernas', 'ombros', 'abs']
        };

        const targetCats = focusMap[focus] || [focus.toLowerCase()];
        let selectedNames = new Set();
        let finalSelection = [];

        // Shuffle helper
        const shuffle = (array) => array.sort(() => Math.random() - 0.5);

        targetCats.forEach(cat => {
            const catPool = pool.filter(ex => ex.category === cat);
            const compounds = shuffle(catPool.filter(ex => ex.priority === 1));
            const isolations = shuffle(catPool.filter(ex => ex.priority === 2));

            // Pick based on focus density
            const pickCount = focus === 'Full Body' ? 1 : 3;

            compounds.slice(0, pickCount).forEach(ex => {
                if (!selectedNames.has(ex.name)) {
                    selectedNames.add(ex.name);
                    finalSelection.push(ex);
                }
            });

            isolations.slice(0, 2).forEach(ex => {
                if (!selectedNames.has(ex.name)) {
                    selectedNames.add(ex.name);
                    finalSelection.push(ex);
                }
            });
        });

        // Add variety finisher
        if (focus !== 'Cardio') {
            const finishers = shuffle(pool.filter(ex => (ex.category === 'abs' || ex.category === 'cardio')));
            finishers.slice(0, 1).forEach(ex => {
                if (finalSelection.length < 10 && !selectedNames.has(ex.name)) {
                    finalSelection.push(ex);
                }
            });
        }

        const baseNote = obs ? `Obs: ${obs}` : 'Foco na execução perfeita.';

        return finalSelection.slice(0, 10).map(ex => ({
            name: ex.name,
            series: config.series,
            reps: config.reps,
            rest: config.rest,
            notes: baseNote
        }));
    }
};

window.WorkoutBuilder = WorkoutBuilder;
window.WorkoutDB = WorkoutDB;
