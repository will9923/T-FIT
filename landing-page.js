/**
 * TFIT - Ultra Modern Landing Page v3.0
 * Design baseado no layout fornecido nas imagens.
 * Estilo futurista, neon e tecnológico.
 */

window.LandingPage = {
    init() {
        const app = document.getElementById('app');
        if (!app) return;

        // Injetar estilos específicos da landing
        this.injectStyles();

        app.innerHTML = `
            <div class="lp-container">
                ${this.renderHeader()}
                ${this.renderHero()}
                ${this.renderCounters()}
                ${this.renderFeaturesGrid()}
                ${this.renderBenefitsSection()}
                ${this.renderFinalCTA()}
                ${this.renderFooter()}
            </div>
        `;

        // Ativar animações, contadores e segredos após render
        setTimeout(() => {
            this.animateCounters();
            this.initScrollAnimations();
            this.initAdminSecret();
        }, 300);
    },

    injectStyles() {
        if (document.getElementById('landing-v3-styles')) return;

        const style = document.createElement('style');
        style.id = 'landing-v3-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap');

            :root {
                --lp-primary: #22c55e;
                --lp-primary-glow: rgba(34, 197, 94, 0.4);
                --lp-bg: #000000;
                --lp-card-bg: rgba(15, 23, 42, 0.4);
                --lp-border: rgba(255, 255, 255, 0.1);
                --lp-text: #ffffff;
                --lp-text-muted: #94a3b8;
            }

            .lp-container {
                font-family: 'Outfit', sans-serif;
                background-color: var(--lp-bg);
                color: var(--lp-text);
                line-height: 1.4;
                overflow-x: hidden;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                min-height: 100vh;
                position: relative;
            }

            /* Background Effects */
            .lp-container::before {
                content: '';
                position: absolute;
                top: 0; left: 0; width: 100%; height: 1000px;
                background: radial-gradient(circle at 70% 30%, rgba(34, 197, 94, 0.1), transparent 50%);
                pointer-events: none;
                z-index: 0;
            }

            .container-lp {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 1.5rem;
                position: relative;
                z-index: 1;
            }

            /* Navigation */
            .lp-nav {
                position: fixed;
                top: 0; left: 0; width: 100%;
                z-index: 1000;
                padding: 1rem 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(20px);
                border-bottom: 1px solid var(--lp-border);
            }

            .nav-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .nav-logo img {
                height: 32px;
            }

            .nav-links {
                display: flex;
                gap: 2rem;
                align-items: center;
            }

            @media screen and (max-width: 768px) {
                .nav-links { display: none; }
            }

            .nav-link {
                color: #fff;
                text-decoration: none;
                font-weight: 600;
                font-size: 0.85rem;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: color 0.3s;
                position: relative;
            }

            .nav-link.active::after {
                content: '';
                position: absolute;
                bottom: -5px; left: 0; width: 30%; height: 2px;
                background: var(--lp-primary);
            }

            .nav-link:hover {
                color: var(--lp-primary);
            }

            /* Buttons */
            .btn-lp {
                padding: 0.8rem 1.8rem;
                border-radius: 50px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-size: 0.85rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                justify-content: center;
            }

            .btn-lp-primary {
                background: linear-gradient(90deg, #22c55e, #16a34a);
                color: #000;
                box-shadow: 0 0 20px var(--lp-primary-glow);
            }

            .btn-lp-primary:hover {
                transform: scale(1.05);
                box-shadow: 0 0 30px var(--lp-primary-glow);
            }

            .btn-lp-video {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .btn-lp-video:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            /* Hero */
            .hero-section {
                padding: 160px 0 80px;
                text-align: left;
            }

            .hero-content {
                display: grid;
                grid-template-columns: 1.2fr 0.8fr;
                gap: 2rem;
                align-items: center;
            }

            @media screen and (max-width: 992px) {
                .hero-content { grid-template-columns: 1fr; text-align: center; }
                .hero-visuals { display: none; }
            }

            .hero-title {
                font-size: clamp(2.5rem, 5vw, 4rem);
                font-weight: 900;
                line-height: 1;
                margin-bottom: 1.5rem;
                text-transform: uppercase;
            }

            .hero-title span {
                color: var(--lp-primary);
            }

            .hero-subtitle {
                font-size: 1.2rem;
                color: var(--lp-text);
                margin-bottom: 2.5rem;
                letter-spacing: 0.5px;
                font-weight: 400;
            }

            .hero-cta-group {
                display: flex;
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            @media screen and (max-width: 768px) {
                .hero-cta-group { justify-content: center; }
            }

            .social-proof {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: #fff;
                font-size: 0.9rem;
            }

            .stars { color: #fbbf24; }

            .hero-visuals {
                position: relative;
                height: 500px;
            }

            .phone-layer {
                position: absolute;
                border-radius: 30px;
                border: 8px solid #1e293b;
                overflow: hidden;
                box-shadow: 0 50px 100px rgba(0,0,0,0.8);
            }

            .phone-1 { width: 220px; height: 440px; left: 0; bottom: 0; z-index: 2; transform: rotate(-5deg); }
            .phone-2 { width: 220px; height: 440px; right: 0; top: 0; z-index: 1; transform: rotate(5deg); opacity: 0.8; }
            .hero-img-main { position: absolute; right: -50px; top: -50px; width: 400px; z-index: 0; filter: brightness(0.8); }

            /* Counter Grid */
            .counter-section {
                padding: 40px 0;
            }

            .counter-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
            }

            @media screen and (max-width: 992px) {
                .counter-grid { grid-template-columns: repeat(2, 1fr); }
            }

            .counter-item {
                background: rgba(15, 23, 42, 0.4);
                border: 1px solid rgba(34, 197, 94, 0.2);
                border-radius: 16px;
                padding: 1.5rem;
                display: flex;
                align-items: center;
                gap: 1rem;
                transition: border-color 0.3s;
            }

            .counter-item:hover {
                border-color: var(--lp-primary);
            }

            .counter-icon {
                font-size: 2rem;
                color: var(--lp-primary);
            }

            .counter-info .number {
                font-size: 1.5rem;
                font-weight: 800;
                display: block;
            }

            .counter-info .label {
                font-size: 0.7rem;
                text-transform: uppercase;
                color: var(--lp-text-muted);
                font-weight: 700;
            }

            /* Features Grid */
            .features-grid {
                padding: 60px 0;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
            }

            @media screen and (max-width: 992px) {
                .features-grid { grid-template-columns: repeat(2, 1fr); }
            }

            .feature-card {
                background: linear-gradient(to bottom, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.8));
                border: 1px solid var(--lp-border);
                border-radius: 20px;
                padding: 2rem 1rem;
                text-align: center;
                transition: all 0.3s;
                cursor: pointer;
            }

            .feature-card:hover {
                border-color: var(--lp-primary);
                transform: translateY(-5px);
                background: linear-gradient(to bottom, rgba(34, 197, 94, 0.1), rgba(0, 0, 0, 0.8));
            }

            .feature-icon-v3 {
                width: 50px;
                height: 50px;
                margin: 0 auto 1.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                border-radius: 12px;
            }

            .feature-label {
                font-size: 0.8rem;
                font-weight: 800;
                text-transform: uppercase;
                color: #fff;
            }

            /* Benefits */
            .benefits-section {
                padding: 60px 0;
            }

            .benefits-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 2rem;
            }

            @media screen and (max-width: 768px) {
                .benefits-grid { grid-template-columns: 1fr; }
            }

            .benefit-card-v3 {
                background: rgba(15, 23, 42, 0.3);
                border: 1px solid var(--lp-border);
                border-radius: 24px;
                padding: 2.5rem;
            }

            .benefit-header {
                font-size: 1.2rem;
                font-weight: 950;
                text-transform: uppercase;
                margin-bottom: 2rem;
                color: #fff;
            }

            .benefit-header span { color: var(--lp-primary); }

            .benefit-list {
                list-style: none; padding: 0;
            }

            .benefit-item-v3 {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 1.2rem;
                font-weight: 600;
                font-size: 1rem;
                text-transform: uppercase;
            }

            .benefit-icon { color: var(--lp-primary); font-size: 1.2rem; }

            /* Final CTA */
            .final-cta {
                padding: 100px 0;
                text-align: center;
            }

            .final-cta h2 {
                font-size: 2rem;
                font-weight: 900;
                text-transform: uppercase;
                margin-bottom: 2.5rem;
            }

            .final-cta h2 span { color: var(--lp-primary); }

            /* Footer */
            .footer-lp {
                padding: 60px 0 40px;
                border-top: 1px solid var(--lp-border);
            }

            .footer-links {
                display: flex;
                justify-content: center;
                gap: 2rem;
                margin-bottom: 2rem;
            }

            @media screen and (max-width: 600px) {
                .footer-links { flex-direction: column; align-items: center; gap: 1rem; }
            }

            .footer-link {
                color: var(--lp-text-muted);
                text-decoration: none;
                font-size: 0.8rem;
                text-transform: uppercase;
                font-weight: 700;
                transition: color 0.3s;
            }

            .footer-link:hover { color: #fff; }

            .social-links {
                display: flex;
                justify-content: center;
                gap: 1.5rem;
            }

            .social-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.05);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                color: #fff;
                transition: transform 0.3s, background 0.3s;
            }

            .social-icon:hover {
                transform: translateY(-3px);
                background: var(--lp-primary);
                color: #000;
            }

            /* Reveal Animation */
            .reveal {
                opacity: 0;
                transform: translateY(30px);
                transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
            }

            .reveal.active {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    },

    renderHeader() {
        return `
            <nav class="lp-nav">
                <div class="container-lp nav-content">
                    <div class="nav-logo">
                        <img src="./logo.png" alt="T-FIT">
                    </div>
                    <div class="nav-links">
                        <a href="#" class="nav-link active">Início</a>
                        <a href="#funcionalidades" class="nav-link">Funcionalidades</a>
                        <a href="#alunos" class="nav-link">Benefícios</a>
                        <a href="#contato" class="nav-link">Contato</a>
                    </div>
                    <div class="flex gap-md items-center">
                        <button class="btn btn-sm btn-ghost text-white font-bold" onclick="router.navigate('/student/login')">Entrar</button>
                        <button class="btn-lp btn-lp-primary" onclick="router.navigate('/student/register')">COMEÇAR AGORA</button>
                    </div>
                </div>
            </nav>
        `;
    },

    renderHero() {
        return `
            <header class="hero-section">
                <div class="container-lp hero-content">
                    <div class="hero-text reveal">
                        <h1 class="hero-title">
                            O SEU<br>
                            <span>PERSONAL TRAINER</span> COM<br>
                            <span>INTELIGÊNCIA ARTIFICIAL</span>
                        </h1>
                        <p class="hero-subtitle">
                            TREINOS, DIETAS E AVALIAÇÕES PERSONALIZADAS PARA VOCÊ EVOLUIR MAIS RÁPIDO!
                        </p>
                        <div class="hero-cta-group">
                            <button class="btn-lp btn-lp-primary" onclick="router.navigate('/student/login')">COMEÇAR AGORA</button>
                            <button class="btn-lp btn-lp-video" onclick="window.open('https://youtube.com', '_blank')">
                                <span style="font-size: 1.2rem;">▶</span> ASSISTA AO VÍDEO
                            </button>
                        </div>
                        <div class="social-proof">
                            <div class="stars">★★★★★</div>
                            <span>+50.000 usuários aprovam!</span>
                        </div>
                    </div>
                    <div class="hero-visuals reveal">
                        <img src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1000&auto=format&fit=crop" class="hero-img-main" alt="Fitness">
                        <div class="phone-layer phone-1">
                            <div style="width: 100%; height: 100%; background: #000; padding: 15px;">
                                <div style="height: 10px; width: 40px; background: #334155; margin: 0 auto 20px;"></div>
                                <div style="height: 60px; background: var(--lp-primary); border-radius: 10px; margin-bottom: 20px;"></div>
                                <div style="height: 40px; background: #1e293b; border-radius: 8px; margin-bottom: 10px;"></div>
                                <div style="height: 40px; background: #1e293b; border-radius: 8px; margin-bottom: 10px;"></div>
                                <div style="height: 120px; background: #1e293b; border-radius: 12px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        `;
    },

    renderCounters() {
        const counters = [
            { icon: '🏋️', number: '128540', label: 'Treinos Gerados' },
            { icon: '👥', number: '35200', label: 'Usuários Ativos' },
            { icon: '👤', number: '1850', label: 'Personal Trainers' },
            { icon: '📍', number: '72400', label: 'Avaliações Físicas' }
        ];

        return `
            <section class="counter-section">
                <div class="container-lp">
                    <div class="counter-grid">
                        ${counters.map(c => `
                            <div class="counter-item reveal">
                                <div class="counter-icon">${c.icon}</div>
                                <div class="counter-info">
                                    <span class="number" data-target="${c.number}">0</span>
                                    <span class="label">${c.label}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
    },

    renderFeaturesGrid() {
        const features = [
            { icon: '🏋️', label: 'Gerar Treino com IA', color: '#22c55e' },
            { icon: '🥗', label: 'Gerar Dieta com IA', color: '#ef4444' },
            { icon: '📸', label: 'Avaliação Física', color: '#3b82f6' },
            { icon: '🥘', label: 'Escanear Prato', color: '#eab308' },
            { icon: '🧘', label: 'Corrigir Postura', color: '#f97316' },
            { icon: '📱', label: 'T-FEED', color: '#a855f7' },
            { icon: '📍', label: 'Waze Fitness', color: '#06b6d4' },
            { icon: '⭐', label: 'T-PONTOS', color: '#facc15' }
        ];

        return `
            <section id="funcionalidades" class="padding-y-xl">
                <div class="container-lp">
                    <div class="features-grid">
                        ${features.map(f => `
                            <div class="feature-card reveal" style="--accent: ${f.color}">
                                <div class="feature-icon-v3" style="color: ${f.color}; background: rgba(${this.hexToRgb(f.color)}, 0.1);">
                                    ${f.icon}
                                </div>
                                <div class="feature-label">${f.label}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
    },

    renderBenefitsSection() {
        return `
            <section class="benefits-section">
                <div class="container-lp">
                    <div class="benefits-grid">
                        <div class="benefit-card-v3 reveal" id="alunos" style="grid-column: span 2;">
                            <h3 class="benefit-header" style="text-align: center;">TUDO QUE VOCÊ PRECISA <span>NO SEU BOLSO</span></h3>
                            <ul class="benefit-list" style="display: flex; flex-direction: column; align-items: center;">
                                <li class="benefit-item-v3">
                                    <span class="benefit-icon">🚀</span> TREINOS GERADOS POR INTELIGÊNCIA ARTIFICIAL
                                </li>
                                <li class="benefit-item-v3">
                                    <span class="benefit-icon">🥗</span> DIETAS PERSONALIZADAS AO SEU OBJETIVO
                                </li>
                                <li class="benefit-item-v3">
                                    <span class="benefit-icon">✅</span> RESULTADOS REAIS E AVALIAÇÃO FÍSICA INTEGRADA
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        `;
    },

    renderFinalCTA() {
        return `
            <section class="final-cta">
                <div class="container-lp">
                    <h2 class="reveal">COMECE SUA <span>EVOLUÇÃO</span> HOJE!</h2>
                    <div class="hero-cta-group reveal" style="max-width: 600px; margin: 0 auto;">
                        <button class="btn-lp btn-lp-primary" style="width: 250px;" onclick="router.navigate('/student/login')">ACESSAR AGORA</button>
                        <button class="btn-lp btn-lp-video" style="width: 250px; background: #000;" onclick="window.open('https://play.google.com', '_blank')">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" style="height: 30px;" alt="Play Store">
                        </button>
                    </div>
                </div>
            </section>
        `;
    },

    renderFooter() {
        return `
            <footer class="footer-lp">
                <div class="container-lp">
                    <div class="footer-links">
                        <a href="#" class="footer-link">Sobre</a>
                        <a href="#" class="footer-link">Contato</a>
                        <a href="#" class="footer-link">Política de Privacidade</a>
                        <a href="#" class="footer-link">Termos de Uso</a>
                    </div>
                    <div class="social-links">
                        <a href="#" class="social-icon">📸</a>
                        <a href="#" class="social-icon">▶</a>
                        <a href="#" class="social-icon">📱</a>
                    </div>
                </div>
            </footer>
        `;
    },

    animateCounters() {
        const counters = document.querySelectorAll('.counter-item .number');
        const options = { threshold: 0.5 };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const counter = entry.target;
                    const target = +counter.getAttribute('data-target');
                    const duration = 2000;
                    const startTime = performance.now();

                    const update = (now) => {
                        const elapsed = now - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const val = Math.floor(progress * target);
                        counter.innerText = val.toLocaleString('pt-BR') + '+';

                        if (progress < 1) requestAnimationFrame(update);
                    };

                    requestAnimationFrame(update);
                    observer.unobserve(counter);
                }
            });
        }, options);

        counters.forEach(c => observer.observe(c));
    },

    initScrollAnimations() {
        const reveals = document.querySelectorAll('.reveal');
        
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        reveals.forEach(reveal => revealObserver.observe(reveal));
    },

    initAdminSecret() {
        let clicks = 0;
        const logo = document.querySelector('.nav-logo');
        if (logo) {
            logo.style.cursor = 'default';
            logo.addEventListener('click', () => {
                clicks++;
                if (clicks >= 5) {
                    UI.showNotification('Acesso Restrito', 'Redirecionando...', 'info');
                    router.navigate('/admin/login');
                }
                clearTimeout(this._secretTimeout);
                this._secretTimeout = setTimeout(() => clicks = 0, 3000);
            });
        }
    },

    // Helper to convert hex to rgb for background opacity
    hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            parseInt(result[1], 16) + "," + parseInt(result[2], 16) + "," + parseInt(result[3], 16) : null;
    }
};
