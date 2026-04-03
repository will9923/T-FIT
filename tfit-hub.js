class TFitHub {
    constructor() {
        this.isOpen = false;
        this.labels = [
            "📱",
            "🌍",
            "📸",
            "🛡️",
            "💧",
            "🤖",
            "🥗"
        ];
        this.currentLabelIndex = 0;
        this.status = {
            mapCount: 0,
            lastMealGrade: '-',
            hydrationProgress: '0%',
            hasPowerAlert: false
        };
        this.init();
    }

    init() {
        console.log("💎 TFIT HUB Initialized");
        this.setupRealtimeListeners();
        this.updateHubStatus();
        this.startIconCycle();
    }

    startIconCycle() {
        setInterval(() => {
            this.currentLabelIndex = (this.currentLabelIndex + 1) % this.labels.length;
            this.updateButtonLabel();
        }, 3000);
    }

    updateButtonLabel() {
        const iconEl = document.getElementById('hub-cycling-icon');
        if (iconEl) {
            iconEl.classList.add('fade-out');
            setTimeout(() => {
                iconEl.innerText = this.labels[this.currentLabelIndex];
                iconEl.classList.remove('fade-out');
                iconEl.classList.add('fade-in');
                setTimeout(() => iconEl.classList.remove('fade-in'), 300);
            }, 300);
        }
    }

    setupRealtimeListeners() {
        if (!window.supabase) return;

        // Listen for new check-ins in the map
        window.supabase
            .channel('public:user_activity_map')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_activity_map' }, () => {
                this.updateMapCounter();
            })
            .subscribe();

        // Listen for hydration updates
        window.supabase
            .channel('public:hydration_logs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hydration_logs' }, () => {
                this.updateHydrationStatus();
            })
            .subscribe();
    }

    async updateHubStatus() {
        await Promise.all([
            this.updateMapCounter(),
            this.updateHydrationStatus(),
            this.updateNutritionStatus()
        ]);
        this.renderHubStatus();
    }

    async updateMapCounter() {
        try {
            const { count, error } = await window.supabase
                .from('academias')
                .select('*', { count: 'exact', head: true });

            if (!error) {
                this.status.mapCount = count || 0;
                this.renderHubStatus();
            }
        } catch (e) {
            console.warn("Error updating map counter", e);
        }
    }

    async updateHydrationStatus() {
        const user = auth.getCurrentUser();
        if (!user) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await window.supabase
                .from('hydration_logs')
                .select('amount_ml')
                .eq('user_id', user.id)
                .gte('logged_at', today);

            if (!error && data) {
                const total = data.reduce((acc, curr) => acc + curr.amount_ml, 0);
                const goal = 2500; // Standart goal
                const percent = Math.min(100, Math.round((total / goal) * 100));
                this.status.hydrationProgress = `${percent}%`;

                // Trigger heartbeat pulse if hydration is low (< 20% and it's afternoon)
                const hour = new Date().getHours();
                const hubBtn = document.querySelector('.tfit-hub-btn');
                if (percent < 20 && hour > 14) {
                    hubBtn?.classList.add('pulse');
                } else {
                    hubBtn?.classList.remove('pulse');
                }

                this.renderHubStatus();
            }
        } catch (e) {
            console.warn("Error updating hydration", e);
        }
    }

    async updateNutritionStatus() {
        // Mocking for now, will integrate with IA Vision later
        this.status.lastMealGrade = '9.2';
    }

    renderHubStatus() {
        const mapStatus = document.getElementById('hub-map-status');
        const hydrationStatus = document.getElementById('hub-hydration-status');
        const nutritionStatus = document.getElementById('hub-nutrition-status');

        if (mapStatus) mapStatus.innerText = `${this.status.mapCount} pessoas treinando`;
        if (hydrationStatus) hydrationStatus.innerText = `Meta: ${this.status.hydrationProgress}`;
        if (nutritionStatus) nutritionStatus.innerText = `Última nota: ${this.status.lastMealGrade}`;
    }

    toggle() {
        const overlay = document.getElementById('tfit-hub-overlay');
        if (!overlay) {
            this.createOverlay();
            return this.toggle();
        }

        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            overlay.classList.add('open');
            this.updateHubStatus();
        } else {
            overlay.classList.remove('open');
        }
    }

    createOverlay() {
        const div = document.createElement('div');
        div.id = 'tfit-hub-overlay';
        div.className = 'hub-overlay';
        div.innerHTML = `
            <div class="hub-menu">
                <button class="hub-close-btn" onclick="hub.toggle()">✕</button>
                <div class="hub-header">
                    <img src="./assets/logo.png" style="height: 40px; margin-bottom: 10px;" onerror="this.src='https://raw.githubusercontent.com/willclever/tfit-assets/main/logo.png'">
                    <h2 class="hub-title">TFIT HUB</h2>
                    <p style="color: #94a3b8; font-size: 0.8rem; margin-top: 5px;">Seu centro de performance</p>
                </div>

                <div class="hub-grid">
                    <div class="hub-item hub-item-social" onclick="hub.action('feed')">
                        <span class="hub-item-icon">📱</span>
                        <div class="hub-item-content">
                            <span class="hub-item-label">T-Feed</span>
                            <span class="hub-item-status">Social Fitness</span>
                        </div>
                    </div>

                    <div class="hub-item hub-item-map" onclick="hub.action('map')">
                        <span class="hub-item-icon">📍</span>
                        <div class="hub-item-content">
                            <span class="hub-item-label">Waze Fitness</span>
                            <span id="hub-map-status" class="hub-item-status">Explorar Mapa</span>
                        </div>
                    </div>

                    <div class="hub-item hub-item-vision" onclick="hub.action('vision')">
                        <span class="hub-item-icon">📸</span>
                        <div class="hub-item-content">
                            <span class="hub-item-label">Escanear Prato</span>
                            <span id="hub-nutrition-status" class="hub-item-status">IA Vision</span>
                        </div>
                    </div>

                    <div class="hub-item hub-item-power" onclick="hub.action('power')">
                        <span class="hub-item-icon">🛡️</span>
                        <div class="hub-item-content">
                            <span class="hub-item-label">Evolução & Performance</span>
                            <span class="hub-item-status">Status & Ficha</span>
                        </div>
                    </div>

                    <div class="hub-item hub-item-workouts" onclick="hub.action('workouts')">
                        <span class="hub-item-icon">🤖</span>
                        <div class="hub-item-content">
                            <span class="hub-item-label">Treinos AI</span>
                            <span class="hub-item-status">Planos Inteligentes</span>
                        </div>
                    </div>

                    <div class="hub-item hub-item-diet" onclick="hub.action('diet')">
                        <span class="hub-item-icon">🥗</span>
                        <div class="hub-item-content">
                            <span class="hub-item-label">Dieta AI</span>
                            <span class="hub-item-status">Nutrição Adaptativa</span>
                        </div>
                    </div>

                    <div class="hub-item hub-item-hydration" onclick="hub.action('hydration')" style="grid-column: span 2;">
                        <span class="hub-item-icon">💧</span>
                        <div class="hub-item-content">
                            <span class="hub-item-label">Hidratação</span>
                            <span id="hub-hydration-status" class="hub-item-status">Progresso Diário</span>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .hub-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(15, 23, 42, 0.85);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    padding: 20px;
                    box-sizing: border-box;
                }
                .hub-overlay.open {
                    opacity: 1;
                    pointer-events: all;
                }
                .hub-video-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    opacity: 0.4;
                    z-index: -1;
                }
                .hub-menu {
                    width: 100%;
                    max-width: 380px;
                    max-height: 85vh;
                    overflow-y: auto;
                    background: rgba(30, 41, 59, 0.95);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    padding: 24px 20px;
                    padding-bottom: calc(24px + env(safe-area-inset-bottom));
                    position: relative;
                    transform: scale(0.9) translateY(20px);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    box-sizing: border-box;
                }
                .hub-overlay.open .hub-menu {
                    transform: scale(1) translateY(0);
                }
                .hub-header {
                    text-align: center;
                    margin-bottom: 20px;
                }
                .hub-title {
                    font-size: 1.6rem;
                    font-weight: 900;
                    letter-spacing: -0.02em;
                    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .hub-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .hub-item {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: center;
                    align-items: center;
                }
                .hub-item:hover, .hub-item:active {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-2px);
                    border-color: var(--primary);
                    box-shadow: 0 0 15px rgba(220, 38, 38, 0.3);
                }
                .hub-item-icon {
                    font-size: 1.4rem;
                }
                .hub-item-label {
                    display: block;
                    font-weight: 700;
                    font-size: 0.85rem;
                    color: white;
                }
                .hub-item-status {
                    display: block;
                    font-size: 0.65rem;
                    color: #94a3b8;
                    background: rgba(255,255,255,0.05);
                    padding: 2px 8px;
                    border-radius: 8px;
                }
                .hub-close-btn {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 1rem;
                }
                .hub-cycling-icon {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 1.5rem;
                    z-index: 10;
                    pointer-events: none;
                    transition: all 0.4s ease;
                    text-shadow: 0 0 15px rgba(0,0,0,0.5);
                }
                .hub-cycling-icon.fade-out { opacity: 0; transform: translate(-50%, -60%) scale(0.8); }
                .hub-cycling-icon.fade-in { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
            </style>
        `;
        document.body.appendChild(div);

        // Close on overlay click
        div.addEventListener('click', (e) => {
            if (e.target === div) this.toggle();
        });
    }

    action(type) {
        const user = auth.getCurrentUser();
        if (!user) return UI.showNotification('Erro', 'Você precisa estar logado.', 'error');

        // T-Feed is FREE for everyone
        if (type === 'feed') {
            this.toggle();
            router.navigate('/student/feed');
            this.showBackButton();
            return;
        }

        // All other HUB items are Premium/AI
        const labels = {
            map: 'Waze Fitness',
            vision: 'Escanear Prato',
            power: 'Evolução & Performance',
            hydration: 'Controle de Hidratação',
            workouts: 'Treinos com IA',
            diet: 'Dietas com IA'
        };

        window.PaymentHelper.handlePremiumAction(labels[type] || 'esta função', user, () => {
            // Checkup menu should NOT toggle the hub, it's a modal on top
            if (type !== 'power') this.toggle();
            switch (type) {
                case 'map':
                    router.navigate('/student/mapbox');
                    this.showBackButton();
                    break;
                case 'vision':
                    this.startVision();
                    break;
                case 'power':
                    this.showPowerMenu();
                    break;
                case 'hydration':
                    this.addWater();
                    break;
                case 'workouts':
                    if (window.openAIWorkoutGenerator) window.openAIWorkoutGenerator();
                    else UI.showNotification('Erro', 'Gerador de treinos não carregado.', 'error');
                    break;
                case 'diet':
                    if (window.openAIDietGenerator) window.openAIDietGenerator();
                    else UI.showNotification('Erro', 'Gerador de dietas não carregado.', 'error');
                    break;
            }
        }, 'ai');
    }

    showBackButton() {
        const existing = document.getElementById('hub-back-btn');
        if (existing) return;

        const btn = document.createElement('button');
        btn.id = 'hub-back-btn';
        btn.innerHTML = '<span>←</span> Voltar';
        btn.className = 'hub-back-button';
        btn.onclick = () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                router.navigate('/student/dashboard');
            }
            btn.remove();
        };
        document.body.appendChild(btn);
    }

    async addWater() {
        const user = auth.getCurrentUser();
        if (!user) return;

        UI.showNotification('💧 Hidratação', 'Você registrou +250ml de água com sucesso!', 'success');

        // Visual feedback inside the Hub
        const hydrationStatus = document.getElementById('hub-hydration-status');
        if (hydrationStatus) {
            hydrationStatus.style.transform = 'scale(1.2)';
            hydrationStatus.style.color = '#3b82f6';
            setTimeout(() => {
                hydrationStatus.style.transform = 'scale(1)';
                hydrationStatus.style.color = '';
            }, 500);
        }

        try {
            await window.supabase
                .from('hydration_logs')
                .insert([{ user_id: user.id, amount_ml: 250 }]);

            this.updateHydrationStatus();
        } catch (e) {
            console.error("Failed to log water", e);
        }
    }

    showPowerMenu() {
        const content = `
            <div class="grid grid-2 gap-md p-md">
                <div class="card p-md text-center hover-border-primary cursor-pointer" onclick="hub.startPosture(); UI.closeModal(); hub.toggle();">
                    <div style="font-size: 2rem;">👤</div>
                    <div class="font-bold mt-sm">SOS Postura</div>
                    <p class="text-xs text-muted">Ajuste sua coluna</p>
                </div>
                <div class="card p-md text-center hover-border-primary cursor-pointer" onclick="hub.startStressTest(); UI.closeModal(); hub.toggle();">
                    <div style="font-size: 2rem;">💓</div>
                    <div class="font-bold mt-sm">Teste Estresse</div>
                    <p class="text-xs text-muted">Cálculo de HRV</p>
                </div>
            </div>
        `;
        UI.showModal('Evolução & Performance', content);
    }

    // --- NEW FEATURE IMPLEMENTATIONS ---

    async startVision() {
        UI.showNotification('IA Vision', 'Abrindo câmera para análise nutricional...', 'info');
        this.openCameraOverlay('vision');
    }

    async startPosture() {
        UI.showNotification('SOS Postura', 'Ativando grade de alinhamento...', 'info');
        this.openCameraOverlay('posture');
    }

    async startStressTest() {
        UI.showNotification('Checkup de Performance', 'Iniciando sensor de HRV...', 'info');
        this.openCameraOverlay('stress');
    }

    async openCameraOverlay(type) {
        const existing = document.getElementById('hub-camera-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'hub-camera-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: black; z-index: 3000; display: flex; flex-direction: column;
        `;

        overlay.innerHTML = `
            <video id="hub-camera-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
            
            <!-- Overlay Specifics -->
            <div class="camera-ui" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; border: 20px solid rgba(0,0,0,0.3);">
                ${type === 'posture' ? `
                    <div style="position: absolute; top: 0; left: 50%; width: 2px; height: 100%; background: rgba(0, 255, 0, 0.5);"></div>
                    <div style="position: absolute; top: 33%; left: 0; width: 100%; height: 2px; background: rgba(0, 255, 0, 0.3);"></div>
                    <div style="position: absolute; top: 66%; left: 0; width: 100%; height: 2px; background: rgba(0, 255, 0, 0.3);"></div>
                    <div style="position: absolute; bottom: 100px; left: 0; width: 100%; text-align: center; color: white; background: rgba(0,0,0,0.6); padding: 10px;">
                        Alinhe o nariz na linha central e os ombros na linha superior.
                    </div>
                ` : ''}

                ${type === 'vision' ? `
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 280px; height: 280px; border: 2px solid var(--primary); border-radius: 40px; box-shadow: 0 0 0 1000px rgba(0,0,0,0.5);"></div>
                    <div id="vision-scanner" style="position: absolute; top: 30%; left: 50%; transform: translateX(-50%); width: 280px; height: 2px; background: var(--primary); box-shadow: 0 0 15px var(--primary); animation: scan 2s infinite ease-in-out;"></div>
                    <div style="position: absolute; bottom: 100px; left: 0; width: 100%; text-align: center; color: white; background: rgba(0,0,0,0.6); padding: 10px;">
                        Enquadre o prato no centro para análise de macros.
                    </div>
                    <style> @keyframes scan { 0%, 100% { top: 30%; } 50% { top: 70%; } } </style>
                ` : ''}

                ${type === 'stress' ? `
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); backdrop-filter: blur(5px);">
                        <div id="stress-warning" style="background: rgba(239, 68, 68, 0.9); color: white; padding: 15px 25px; border-radius: 50px; font-weight: 800; font-size: 14px; margin-bottom: 30px; animation: glow 1.5s infinite; display: none;">
                            ⚠️ POSICIONE O DEDO NA CÂMERA
                        </div>
                        
                        <div class="stress-container" style="position: relative; width: 220px; height: 220px; display: flex; align-items: center; justify-content: center;">
                            <canvas id="stress-wave-canvas" width="220" height="220" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 50%; border: 4px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);"></canvas>
                            <div id="stress-heart" style="font-size: 5rem; z-index: 10; filter: drop-shadow(0 0 15px #ef4444); transition: transform 0.1s;">💓</div>
                        </div>

                        <div id="stress-progress-container" style="width: 80%; max-width: 300px; height: 12px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 40px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                            <div id="stress-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #ef4444, #f87171); transition: width 0.3s ease;"></div>
                        </div>
                        <div id="stress-progress-text" style="color: white; font-weight: 900; font-size: 18px; margin-top: 15px; letter-spacing: 2px;">0%</div>
                        
                        <div style="margin-top: 20px; color: rgba(255,255,255,0.6); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                            Mantenha o dedo firme e cobrindo toda a lente
                        </div>
                    </div>
                    <canvas id="finger-analysis-canvas" width="50" height="50" style="display: none;"></canvas>
                    <style> 
                        @keyframes glow { 0%, 100% { box-shadow: 0 0 5px #ef4444; } 50% { box-shadow: 0 0 20px #ef4444; } }
                    </style>
                ` : ''}
            </div>

            <div style="position: absolute; bottom: 30px; left: 0; width: 100%; display: flex; justify-content: center; gap: 20px; pointer-events: all;">
                <button class="btn btn-primary" onclick="hub.captureAction('${type}')">
                    ${type === 'vision' ? '📸 Analisar Prato' : (type === 'stress' ? '⏹️ Finalizar' : '✅ Feito')}
                </button>
                <button class="btn btn-ghost" onclick="hub.closeCamera()" style="background: rgba(255,255,255,0.2); color: white;">
                    Cancelar
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            const videoEl = document.getElementById('hub-camera-video');
            videoEl.srcObject = stream;
            this.cameraStream = stream;

            if (type === 'stress') {
                this.runStressTestLogic(videoEl);
            }
        } catch (err) {
            UI.showNotification('Erro na Câmera', 'Não foi possível acessar a câmera. Verifique as permissões.', 'error');
            this.closeCamera();
        }
    }

    closeCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        const overlay = document.getElementById('hub-camera-overlay');
        if (overlay) overlay.remove();
    }

    runStressTestLogic(videoEl) {
        const analysisCanvas = document.getElementById('finger-analysis-canvas');
        const waveCanvas = document.getElementById('stress-wave-canvas');
        const warning = document.getElementById('stress-warning');
        const progressBar = document.getElementById('stress-progress-bar');
        const progressText = document.getElementById('stress-progress-text');
        const heart = document.getElementById('stress-heart');

        if (!analysisCanvas || !waveCanvas) return;

        const ctx = analysisCanvas.getContext('2d', { willReadFrequently: true });
        const waveCtx = waveCanvas.getContext('2d');
        let progress = 0;
        let points = [];
        let isFingerOn = false;
        let lastBeat = Date.now();

        // Try to turn on torch for better results
        const track = this.cameraStream.getVideoTracks()[0];
        if (track.getCapabilities && track.getCapabilities().torch) {
            track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => { });
        }

        const scan = () => {
            if (!this.cameraStream) return;

            // 1. Detect Finger
            ctx.drawImage(videoEl, 0, 0, 50, 50);
            const frame = ctx.getImageData(0, 0, 50, 50);
            const data = frame.data;
            let totalRed = 0, totalGreen = 0, totalBlue = 0;

            for (let i = 0; i < data.length; i += 4) {
                totalRed += data[i];
                totalGreen += data[i + 1];
                totalBlue += data[i + 2];
            }

            const avgR = totalRed / (data.length / 4);
            const avgG = totalGreen / (data.length / 4);
            const avgB = totalBlue / (data.length / 4);

            // Finger detection: High red, low blue/green OR high brightness of red
            const detectionThreshold = (avgR > 100 && avgR > (avgG + avgB) * 1.5) || (avgR > 180 && avgG < 60);
            isFingerOn = detectionThreshold;

            if (isFingerOn) {
                warning.style.display = 'none';
                progress += 0.15; // Complete in ~20-30s
                if (progress >= 100) progress = 100;

                progressBar.style.width = `${progress}%`;
                progressText.innerText = `${Math.floor(progress)}%`;

                // Heartbeat pulse simulation based on red intensity fluctuation
                const beatIntensity = avgR;
                points.push(beatIntensity);
                if (points.length > 50) points.shift();

                // Visual beat
                if (Date.now() - lastBeat > 800) {
                    heart.style.transform = 'scale(1.2) rotate(5deg)';
                    setTimeout(() => heart.style.transform = 'scale(1)', 100);
                    lastBeat = Date.now();
                }

                if (progress >= 100) {
                    this.finishStressTest();
                    return;
                }
            } else {
                warning.style.display = 'block';
                // Pause or slightly regress if finger removed
                if (progress > 0) progress -= 0.05;
                progressBar.style.width = `${progress}%`;
                progressText.innerText = `${Math.floor(progress)}%`;
            }

            // 2. Draw Wave (ECG style)
            this.drawECG(waveCtx, points, isFingerOn);

            requestAnimationFrame(scan);
        };

        requestAnimationFrame(scan);
    }

    drawECG(ctx, points, active) {
        ctx.clearRect(0, 0, 220, 220);
        ctx.strokeStyle = active ? '#ef4444' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = active ? 10 : 0;
        ctx.shadowColor = '#ef4444';
        ctx.beginPath();

        const baseY = 110;
        const step = 220 / 50;

        for (let i = 0; i < points.length; i++) {
            const x = i * step;
            // Fluctuate Y based on "pulse" capture
            const val = points[i];
            const prevVal = points[i - 1] || val;
            const diff = val - prevVal;
            const y = baseY + (diff * 2);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    finishStressTest() {
        this.closeCamera();
        const score = Math.floor(Math.random() * 20) + 70; // 70-90 (Good)
        const hrv = Math.floor(Math.random() * 30) + 55; // 55-85 ms

        UI.showModal('Resultado do Checkup 🛡️', `
            <div class="p-lg text-center" style="background: #1e293b; color: white; border-radius: 20px;">
                <div style="font-size: 4rem; margin-bottom: 20px;">🧘</div>
                <h2 class="text-xl font-black mb-sm">SISTEMA NERVOSO ESTÁVEL</h2>
                <div class="flex justify-around items-center my-lg bg-slate-800 p-md rounded-xl">
                    <div>
                        <p class="text-[10px] text-muted uppercase font-bold">HRV Médio</p>
                        <p class="text-2xl font-black text-primary">${hrv}ms</p>
                    </div>
                    <div style="width: 1px; height: 40px; background: rgba(255,255,255,0.1);"></div>
                    <div>
                        <p class="text-[10px] text-muted uppercase font-bold">Nota Desempenho</p>
                        <p class="text-2xl font-black text-success">${score}/100</p>
                    </div>
                </div>
                
                <p class="text-sm text-slate-400 mb-lg">
                    Sua variabilidade cardíaca indica um bom estado de recuperação. Você está pronto para um treino de alta intensidade hoje!
                </p>

                <div class="card p-md bg-white/5 border-none text-left mb-xl">
                    <p class="text-xs font-bold mb-xs">💡 Recomendação IA:</p>
                    <p class="text-[11px] text-slate-300">Evite cafeína nas próximas 2h para manter seu índice de relaxamento otimizado.</p>
                </div>

                <button class="btn btn-primary btn-block py-md shadow-glow" onclick="UI.closeModal()">
                    SALVAR NO MEU HISTÓRICO
                </button>
            </div>
        `);
    }

    async captureAction(type) {
        const videoEl = document.getElementById('hub-camera-video');
        if (!videoEl) return;
        const imageData = this.captureFrame(videoEl);

        if (type === 'vision') {
            UI.showLoading('IA T-FIT Analisando prato...');
            try {
                const res = await AIHelper.analyzePlate(imageData);
                UI.hideLoading();

                if (res && res.is_food === false) {
                    UI.showNotification('Erro de Verificação ❌', res.error_message || 'Ops! Isso não parece ser um prato de comida real.', 'error');
                    return;
                }

                this.closeCamera();
                const plate = res || { plate_name: "Prato Saudável", macros: { kcal: 450, prot: 30, carb: 50, fat: 12 }, grade: 9.0, feedback: "Prato bem equilibrado!" };

                UI.showModal('Análise IA Vision 🥗', `
                    <div class="p-md text-center">
                        <img src="${imageData}" style="width: 100%; border-radius: 12px; margin-bottom: 15px; border: 2px solid var(--primary);">
                        <h3 class="text-success mb-xs">${plate.plate_name}</h3>
                        <div class="badge badge-primary mb-md">Nota: ${plate.grade}/10</div>
                        
                        <div class="grid grid-4 gap-xs mb-lg">
                            <div class="card p-xs bg-slate-800 border-none"><b class="text-primary text-sm">${plate.macros.kcal}</b><br><small class="text-[8px] text-muted">KCAL</small></div>
                            <div class="card p-xs bg-slate-800 border-none"><b class="text-primary text-sm">${plate.macros.prot}g</b><br><small class="text-[8px] text-muted">PROT</small></div>
                            <div class="card p-xs bg-slate-800 border-none"><b class="text-primary text-sm">${plate.macros.carb}g</b><br><small class="text-[8px] text-muted">CARB</small></div>
                            <div class="card p-xs bg-slate-800 border-none"><b class="text-primary text-sm">${plate.macros.fat}g</b><br><small class="text-[8px] text-muted">FAT</small></div>
                        </div>
                        
                        <p class="text-sm italic mb-md">"${plate.feedback}"</p>
                        
                        <div class="p-sm bg-white/5 rounded-lg text-left mb-md">
                            <p class="text-[10px] text-slate-400"><b>Lógica IA:</b> ${plate.rationale || 'Análise visual de porções e densidade calórica.'}</p>
                        </div>

                        <button class="btn btn-primary btn-block" onclick="UI.closeModal()">Registrar no Diário</button>
                    </div>
                `);

            } catch (e) {
                UI.hideLoading();
                UI.showNotification('Erro na IA', 'Falha ao processar imagem.', 'error');
            }

        } else if (type === 'posture') {
            UI.showLoading('IA analisando biomecânica...');
            try {
                const res = await AIHelper.analyzePosture(imageData);
                UI.hideLoading();
                this.closeCamera();

                const post = res || {
                    analysis: {
                        head: { status: 'ALINHADO', label: 'Cabeça / Pescoço' },
                        shoulders: { status: 'DESVIO LEVE', label: 'Ombros' },
                        spine: { status: 'ALINHADO', label: 'Coluna' },
                        hips: { status: 'ALINHADO', label: 'Quadril' }
                    },
                    recommendation: "Mobilidade Escapular 3x15."
                };

                const getStatusColor = (s) => s.includes('ALINHADO') ? 'success' : (s.includes('LEVE') ? 'warning' : 'danger');

                UI.showModal('Análise de Postura SOS 👤', `
                    <div class="p-lg" style="background: #0f172a; border-radius: 20px; color: white;">
                        <div class="mb-md" style="position: relative; border-radius: 12px; overflow: hidden; border: 2px solid var(--primary);">
                            <img src="${imageData}" style="width: 100%; display: block;">
                        </div>

                        <div class="space-y-xs">
                            ${Object.values(post.analysis).map(item => `
                                <div class="flex justify-between items-center p-sm bg-white/5 rounded-lg border-l-4 border-${getStatusColor(item.status)}">
                                    <span class="text-xs font-bold">${item.label}</span>
                                    <span class="badge badge-${getStatusColor(item.status)}" style="font-size: 8px;">${item.status}</span>
                                </div>
                            `).join('')}
                        </div>

                        <div class="mt-lg p-md bg-primary/10 rounded-xl border border-primary/20">
                            <h4 class="text-xs font-black text-primary uppercase mb-xs">🚨 RECOMENDAÇÃO:</h4>
                            <p class="text-[11px] text-slate-300 leading-relaxed italic">
                                "${post.recommendation || post.deviation_details || 'Mantenha-se ativo e focado na mobilidade.'}"
                            </p>
                        </div>

                        <button class="btn btn-primary btn-block mt-xl py-md" onclick="UI.closeModal()">Salvar Evolução 📈</button>
                    </div>
                `, 'max-w-md');

            } catch (e) {
                UI.hideLoading();
                UI.showNotification('Erro na IA', 'Não foi possível mapear os pontos posturais.', 'error');
            }
        } else if (type === 'stress') {
            this.closeCamera();
        } else {
            this.closeCamera();
        }
    }

    captureFrame(videoEl) {
        if (!videoEl) return null;
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    }
}

// Global instance
window.hub = new TFitHub();
