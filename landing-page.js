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
                ${this.renderTestimonials()}
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
                --lp-primary: #dc2626;
                --lp-primary-rgb: 220, 38, 38;
                --lp-primary-glow: rgba(220, 38, 38, 0.4);
                --lp-secondary: #3b82f6; /* Cyan/Blue for contrast */
                --lp-bg: #000000;
                --lp-card-bg: rgba(15, 23, 42, 0.6);
                --lp-border: rgba(255, 255, 255, 0.08);
                --lp-text: #ffffff;
                --lp-text-muted: #94a3b8;
                --safe-top: env(safe-area-inset-top, 20px);
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
                background: radial-gradient(circle at 70% 30%, rgba(220, 38, 38, 0.15), transparent 50%);
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
                padding: calc(var(--safe-top) + 0.5rem) 1.5rem 1rem;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border-bottom: 1px solid var(--lp-border);
            }

            .nav-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                max-width: 1200px;
                margin: 0 auto;
            }

            .nav-logo img {
                height: 36px;
                filter: drop-shadow(0 0 10px rgba(var(--lp-primary-rgb), 0.3));
            }

            .nav-links {
                display: flex;
                gap: 2rem;
                align-items: center;
            }

            @media screen and (max-width: 768px) {
                .nav-links { display: none; }
                .lp-nav { padding: calc(var(--safe-top) + 0.5rem) 1rem 0.8rem; }
            }

            .nav-link {
                color: #fff;
                text-decoration: none;
                font-weight: 600;
                font-size: 0.8rem;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                transition: all 0.3s;
                position: relative;
                opacity: 0.7;
            }

            .nav-link.active, .nav-link:hover {
                opacity: 1;
                color: var(--lp-primary);
            }

            /* Premium Card Styles */
            .features-grid-v7 {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 2rem;
                margin-top: 4rem;
            }

            @media screen and (max-width: 992px) {
                .features-grid-v7 { grid-template-columns: 1fr; }
            }

            .feature-card-v7 {
                background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
                border: 1px solid var(--lp-border);
                border-radius: 40px;
                padding: 2rem;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }

            .feature-card-v7:hover {
                transform: translateY(-15px);
                border-color: var(--lp-primary);
                background: rgba(var(--lp-primary-rgb), 0.05);
                box-shadow: 0 30px 60px rgba(0,0,0,0.5);
            }

            .feature-img-v7 {
                width: 100%;
                border-radius: 20px;
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 10px 20px rgba(0,0,0,0.3);
            }

            .feature-icon-v7 {
                font-size: 2.5rem;
                margin-bottom: 0.5rem;
            }

            .feature-title-v7 {
                font-size: 1.5rem;
                font-weight: 900;
                color: #fff;
            }

            .feature-desc-v7 {
                font-size: 0.9rem;
                color: var(--lp-text-muted);
                line-height: 1.6;
            }

            /* Buttons */
            .btn-lp {
                padding: 0.8rem 1.8rem;
                border-radius: 16px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: none;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-size: 0.8rem;
                display: flex;
                align-items: center;
                gap: 0.6rem;
                justify-content: center;
            }

            .btn-lp-primary {
                background: linear-gradient(135deg, var(--lp-primary), #991b1b);
                color: #fff;
                box-shadow: 0 8px 25px rgba(var(--lp-primary-rgb), 0.3);
                position: relative;
                overflow: hidden;
            }

            .btn-lp-primary::after {
                content: '';
                position: absolute;
                top: -50%; left: -50%; width: 200%; height: 200%;
                background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
                transform: rotate(45deg);
                transition: 0.6s;
            }

            .btn-lp-primary:hover::after {
                left: 120%;
            }

            .btn-lp-primary:hover {
                transform: translateY(-3px) scale(1.02);
                box-shadow: 0 12px 30px rgba(var(--lp-primary-rgb), 0.5);
            }

            .btn-lp-video {
                background: rgba(255, 255, 255, 0.05);
                color: #fff;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .btn-lp-video:hover {
                background: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
            }

            /* Hero */
            .hero-section {
                padding: calc(var(--safe-top) + 140px) 0 80px;
                position: relative;
                min-height: 90vh;
                display: flex;
                align-items: center;
            }

            .hero-content {
                display: grid;
                grid-template-columns: 1.1fr 0.9fr;
                gap: 4rem;
                align-items: center;
            }

            @media screen and (max-width: 992px) {
                .hero-content { grid-template-columns: 1fr; text-align: center; }
                .hero-visuals { margin-top: 3rem; transform: scale(0.9); }
                .hero-section { padding-top: calc(var(--safe-top) + 100px); }
            }

            .hero-title {
                font-size: clamp(2.2rem, 6vw, 4.5rem);
                font-weight: 950;
                line-height: 1.05;
                margin-bottom: 2rem;
                text-transform: uppercase;
                letter-spacing: -2px;
            }

            .hero-title span {
                background: linear-gradient(to right, var(--lp-primary), #f87171);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 0 15px rgba(var(--lp-primary-rgb), 0.3));
            }

            .hero-subtitle {
                font-size: 1.1rem;
                color: var(--lp-text-muted);
                margin-bottom: 3rem;
                letter-spacing: 1px;
                font-weight: 500;
                max-width: 550px;
            }

            @media screen and (max-width: 992px) {
                .hero-subtitle { margin-left: auto; margin-right: auto; }
            }

            .hero-cta-group {
                display: flex;
                gap: 1.5rem;
                margin-bottom: 3rem;
            }

            @media screen and (max-width: 768px) {
                .hero-cta-group { flex-direction: column; align-items: stretch; gap: 1rem; }
                .btn-lp { width: 100%; }
            }

            .social-proof {
                display: flex;
                align-items: center;
                gap: 1rem;
                color: #fff;
                font-size: 0.85rem;
                background: rgba(255,255,255,0.03);
                padding: 10px 20px;
                border-radius: 100px;
                width: fit-content;
                border: 1px solid rgba(255,255,255,0.05);
            }

            @media screen and (max-width: 992px) { .social-proof { margin: 0 auto; } }

            .stars { color: #facc15; font-size: 1.1rem; letter-spacing: 2px; }

            .hero-visuals {
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .visuals-container {
                position: relative;
                width: 100%;
                max-width: 450px;
            }

            .hero-main-img {
                width: 100%;
                height: auto;
                border-radius: 32px;
                box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 40px rgba(var(--lp-primary-rgb), 0.2);
                border: 1px solid rgba(255,255,255,0.1);
                position: relative;
                z-index: 2;
                transform: perspective(1000px) rotateY(-5deg);
                transition: transform 0.5s;
            }

            .hero-main-img:hover {
                transform: perspective(1000px) rotateY(0deg);
            }

            .glow-effect {
                position: absolute;
                width: 120%; height: 120%;
                background: radial-gradient(circle, rgba(var(--lp-primary-rgb), 0.2), transparent 70%);
                top: -10%; left: -10%;
                z-index: 1;
                pointer-events: none;
            }

            /* Counter Grid */
            .counter-section {
                padding: 60px 0;
            }

            .counter-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1.5rem;
            }

            @media screen and (max-width: 992px) {
                .counter-grid { grid-template-columns: repeat(2, 1fr); }
            }

            .counter-item {
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 24px;
                padding: 2rem;
                text-align: center;
                transition: all 0.3s;
            }

            .counter-item:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: var(--lp-primary);
                transform: translateY(-5px);
            }

            .counter-icon {
                font-size: 2.5rem;
                margin-bottom: 1rem;
                display: block;
            }

            .counter-info .number {
                font-size: 2rem;
                font-weight: 900;
                display: block;
                color: #fff;
                margin-bottom: 0.2rem;
            }

            .counter-info .label {
                font-size: 0.75rem;
                text-transform: uppercase;
                color: var(--lp-text-muted);
                font-weight: 700;
                letter-spacing: 1.5px;
            }

            /* Features Grid */
            .section-header {
                text-align: center;
                margin-bottom: 4rem;
            }

            .section-title {
                font-size: 2.5rem;
                font-weight: 900;
                text-transform: uppercase;
                margin-bottom: 1rem;
            }

            .section-title span { color: var(--lp-primary); }

            .section-desc {
                color: var(--lp-text-muted);
                max-width: 600px;
                margin: 0 auto;
                font-size: 1.1rem;
            }

            .features-grid {
                padding: 20px 0;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1.5rem;
            }

            @media screen and (max-width: 992px) {
                .features-grid { grid-template-columns: repeat(2, 1fr); }
            }

            .feature-card {
                background: rgba(15, 23, 42, 0.4);
                border: 1px solid var(--lp-border);
                border-radius: 24px;
                padding: 2.5rem 1.5rem;
                text-align: center;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }

            .feature-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: linear-gradient(135deg, rgba(var(--lp-primary-rgb), 0.1), transparent);
                opacity: 0;
                transition: 0.4s;
            }

            .feature-card:hover {
                border-color: var(--lp-primary);
                transform: translateY(-10px);
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            }

            .feature-card:hover::before { opacity: 1; }

            .feature-icon-wrapper {
                width: 70px; height: 70px;
                background: rgba(255,255,255,0.03);
                border-radius: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1.5rem;
                font-size: 2.5rem;
                transition: transform 0.4s;
            }

            .feature-card:hover .feature-icon-wrapper {
                transform: scale(1.1) rotate(5deg);
                background: rgba(var(--lp-primary-rgb), 0.1);
            }

            .feature-label {
                font-size: 0.9rem;
                font-weight: 800;
                text-transform: uppercase;
                color: #fff;
                letter-spacing: 1px;
            }

            /* Benefits - New Layout */
            .benefits-section {
                padding: 80px 0;
            }

            .benefits-showcase {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 4rem;
                align-items: center;
            }

            @media screen and (max-width: 992px) {
                .benefits-showcase { grid-template-columns: 1fr; }
            }

            .benefit-list-v4 {
                list-style: none; padding: 0;
            }

            .benefit-item-v4 {
                display: flex;
                gap: 1.5rem;
                margin-bottom: 2.5rem;
                align-items: flex-start;
            }

            .benefit-num {
                width: 40px; height: 40px;
                background: var(--lp-primary);
                color: #fff;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                flex-shrink: 0;
                box-shadow: 0 4px 15px rgba(var(--lp-primary-rgb), 0.3);
            }

            .benefit-content-v4 h4 {
                font-size: 1.2rem;
                font-weight: 800;
                margin-bottom: 0.5rem;
                text-transform: uppercase;
                color: #fff;
            }

            .benefit-content-v4 p {
                color: var(--lp-text-muted);
                font-size: 0.95rem;
                line-height: 1.6;
            }

            /* AI Section */
            .ai-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                background: rgba(59, 130, 246, 0.1);
                color: #3b82f6;
                padding: 6px 15px;
                border-radius: 100px;
                font-weight: 800;
                font-size: 0.75rem;
                text-transform: uppercase;
                margin-bottom: 1.5rem;
                border: 1px solid rgba(59, 130, 246, 0.2);
            }

            /* Final CTA */
            .final-cta {
                padding: 120px 0;
                text-align: center;
                background: radial-gradient(circle at center, rgba(var(--lp-primary-rgb), 0.1), transparent 70%);
            }

            .final-cta h2 {
                font-size: clamp(2rem, 5vw, 3.5rem);
                font-weight: 950;
                text-transform: uppercase;
                margin-bottom: 3rem;
                letter-spacing: -1px;
            }

            .final-cta h2 span { color: var(--lp-primary); }

            /* Footer */
            .footer-lp {
                padding: 80px 0 40px;
                border-top: 1px solid var(--lp-border);
            }

            .footer-grid {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 3rem;
            }

            .footer-links {
                display: flex;
                justify-content: center;
                gap: 3rem;
                flex-wrap: wrap;
            }

            @media screen and (max-width: 600px) {
                .footer-links { flex-direction: column; align-items: center; gap: 1.5rem; }
            }

            .footer-link {
                color: var(--lp-text-muted);
                text-decoration: none;
                font-size: 0.8rem;
                text-transform: uppercase;
                font-weight: 700;
                transition: color 0.3s;
                letter-spacing: 1px;
            }

            .footer-link:hover { color: var(--lp-primary); }

            .social-links {
                display: flex;
                justify-content: center;
                gap: 1.5rem;
            }

            .social-icon {
                width: 50px;
                height: 50px;
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.03);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                color: #fff;
                transition: all 0.3s;
                border: 1px solid rgba(255,255,255,0.05);
            }

            .social-icon:hover {
                transform: translateY(-5px);
                background: var(--lp-primary);
                color: #fff;
                box-shadow: 0 10px 20px rgba(var(--lp-primary-rgb), 0.3);
            }

            /* Reveal Animation */
            .reveal {
                opacity: 0;
                transform: translateY(40px);
                transition: all 1s cubic-bezier(0.23, 1, 0.32, 1);
            }

            .reveal.active {
                opacity: 1;
                transform: translateY(0);
            }

            /* Floating animation */
            @keyframes floating {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-15px); }
                100% { transform: translateY(0px); }
            }

            .floating {
                animation: floating 4s ease-in-out infinite;
            }

        `;
        document.head.appendChild(style);
    },

    renderHeader() {
        return `
            <nav class="lp-nav">
                <div class="nav-content">
                    <div class="nav-logo" style="cursor: pointer;">
                        <img src="./logo.png" alt="T-FIT">
                    </div>
                    <div class="nav-links">
                        <a href="#" class="nav-link active">Início</a>
                        <a href="#funcionalidades" class="nav-link">Recursos</a>
                        <a href="#beneficios" class="nav-link">Benefícios</a>
                        <a href="#contato" class="nav-link">Ajuda</a>
                    </div>
                    <div class="flex gap-md items-center">
                        <button class="btn btn-sm btn-ghost text-white font-bold" style="font-size: 0.75rem;" onclick="router.navigate('/student/login')">ENTRAR</button>
                        <button class="btn-lp btn-lp-primary" style="padding: 0.6rem 1.2rem; font-size: 0.7rem;" onclick="router.navigate('/student/register')">CRIAR CONTA</button>
                    </div>
                </div>
            </nav>
        `;
    },

    renderHero() {
        const heroImg = 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?q=80&w=1200&auto=format&fit=crop';

        return `
            <header class="hero-section">
                <div class="container-lp hero-content">
                    <div class="hero-text reveal">
                        <div class="ai-badge">
                            <span class="pulse">●</span> Inteligência Artificial Ativa
                        </div>
                        <h1 class="hero-title">
                            A REVOLUÇÃO DO<br>
                            <span>TREINO</span><br>
                            GUIADO POR IA
                        </h1>
                        <p class="hero-subtitle">
                            Chega de treinos genéricos. Tenha um sistema inteligente que cria o plano perfeito para seu objetivo, ajusta suas cargas e monitora sua nutrição 24h por dia.
                        </p>
                        <div class="hero-cta-group">
                            <button class="btn-lp btn-lp-primary" onclick="router.navigate('/student/register')">
                                COMEÇAR AGORA <i class="fas fa-arrow-right"></i>
                            </button>
                            <button class="btn-lp btn-lp-video" onclick="window.open('https://youtube.com', '_blank')">
                                <i class="fas fa-play"></i> VER COMO FUNCIONA
                            </button>
                        </div>
                        <div class="social-proof">
                            <div class="stars">★★★★★</div>
                            <span>A plataforma #1 em resultados reais</span>
                        </div>
                    </div>
                    <div class="hero-visuals reveal">
                        <div class="visuals-container">
                            <div class="glow-effect"></div>
                            <img src="${heroImg}" class="hero-main-img floating" alt="AI Fitness Evolution">
                        </div>
                    </div>
                </div>
            </header>
        `;
    },

    renderFeaturesGrid() {
        return `
            <section id="funcionalidades" style="padding: 100px 0 80px; position: relative; overflow: hidden;">
                <!-- Ambient Glowing Orbs -->
                <div style="position:absolute; top: -100px; left: -100px; width: 600px; height: 600px; background: radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%); border-radius: 50%; z-index: 0; pointer-events: none;"></div>
                <div style="position:absolute; bottom: -200px; right: -100px; width: 800px; height: 800px; background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%); border-radius: 50%; z-index: 0; pointer-events: none;"></div>

                <div class="container-lp" style="position: relative; z-index: 1;">
                    <div class="section-header reveal">
                        <div style="display:inline-block; padding: 6px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 100px; font-size: 0.75rem; font-weight: 800; color: #cbd5e1; margin-bottom: 1.5rem; letter-spacing: 2px;">TECNOLOGIA DE PONTA</div>
                        <h2 class="section-title">O ECOSSISTEMA <span>COMPLETO</span></h2>
                        <p class="section-desc">Não é apenas um app. É uma plataforma guiada por IA projetada para revolucionar seus resultados construída em um design espetacular.</p>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:2rem; margin-top:4rem;" class="reveal eco-cards-grid">

                        <!-- WAZE FITNESS -->
                        <div class="eco-card-v9" style="--accent:220,38,38;">
                            <div class="eco-card-hero" style="background: linear-gradient(180deg, rgba(220,38,38,0.15) 0%, rgba(10,15,30,0) 100%);">
                                <div class="eco-hero-bg-blur"></div>
                                <div class="eco-badge" style="background:rgba(220,38,38,0.2); color:#f87171; border: 1px solid rgba(220,38,38,0.4);">📍 AO VIVO</div>
                                <!-- UI Mock: Radar / Map -->
                                <div class="ui-mock-container floating" style="animation-delay: 0s;">
                                    <div class="ui-mock-item" style="border-left: 3px solid #22c55e;">
                                        <div class="ui-mock-dot" style="background:#22c55e;box-shadow:0 0 12px #22c55e;"></div>
                                        <span class="ui-mock-text">Smart Fit Centro</span>
                                        <span class="ui-mock-status" style="color:#22c55e;">VAZIO</span>
                                    </div>
                                    <div class="ui-mock-item" style="border-left: 3px solid #f59e0b;">
                                        <div class="ui-mock-dot" style="background:#f59e0b;box-shadow:0 0 12px #f59e0b;"></div>
                                        <span class="ui-mock-text">Body Tech Norte</span>
                                        <span class="ui-mock-status" style="color:#f59e0b;">MODERADO</span>
                                    </div>
                                    <div class="ui-mock-item" style="border-left: 3px solid #dc2626;">
                                        <div class="ui-mock-dot" style="background:#dc2626;box-shadow:0 0 12px #dc2626;"></div>
                                        <span class="ui-mock-text">Academia Power</span>
                                        <span class="ui-mock-status" style="color:#dc2626;">LOTADA</span>
                                    </div>
                                </div>
                            </div>
                            <div class="eco-card-body">
                                <div class="eco-icon-wrap" style="background: linear-gradient(135deg, rgba(220,38,38,0.2), transparent); border-color: rgba(220,38,38,0.3);">📍</div>
                                <h3 class="eco-card-title">Waze Fitness</h3>
                                <p class="eco-card-desc">O radar da sua evolução. Monitore a lotação térmica da academia em tempo real e nunca mais perca tempo em filas para os aparelhos.</p>
                                <div class="eco-tags-row">
                                    <span class="eco-tag" style="--tc:248,113,113;">Mapa Térmico</span>
                                    <span class="eco-tag" style="--tc:248,113,113;">Rotas Vazias</span>
                                </div>
                            </div>
                        </div>

                        <!-- T-FEED -->
                        <div class="eco-card-v9" style="--accent:59,130,246;">
                            <div class="eco-card-hero" style="background: linear-gradient(180deg, rgba(59,130,246,0.15) 0%, rgba(10,15,30,0) 100%);">
                                <div class="eco-hero-bg-blur"></div>
                                <div class="eco-badge" style="background:rgba(59,130,246,0.2); color:#93c5fd; border: 1px solid rgba(59,130,246,0.4);">🤳 SOCIAL</div>
                                <!-- UI Mock: Social Feed -->
                                <div class="ui-mock-container floating" style="animation-delay: 0.5s;">
                                    <div class="ui-mock-item" style="display:flex; align-items:center;">
                                        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#f87171);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:900;color:#fff;flex-shrink:0;box-shadow:0 4px 10px rgba(220,38,38,0.3);">JC</div>
                                        <div style="margin-left: 10px;">
                                            <div style="font-size:0.75rem;font-weight:800;color:#fff;">João Carlos <span style="color:#60a5fa;">✓</span></div>
                                            <div style="font-size:0.65rem;color:#94a3b8;">Recorde Pessoal: Supino 100kg🔥</div>
                                        </div>
                                    </div>
                                    <div class="ui-mock-item" style="display:flex; align-items:center;">
                                        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:900;color:#fff;flex-shrink:0;box-shadow:0 4px 10px rgba(99,102,241,0.3);">MS</div>
                                        <div style="margin-left: 10px;">
                                            <div style="font-size:0.75rem;font-weight:800;color:#fff;">Maria Silva</div>
                                            <div style="font-size:0.65rem;color:#94a3b8;">Nova Bio Scan: 14% BF ✨</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="eco-card-body">
                                <div class="eco-icon-wrap" style="background: linear-gradient(135deg, rgba(59,130,246,0.2), transparent); border-color: rgba(59,130,246,0.3);">🤳</div>
                                <h3 class="eco-card-title">T-Feed Pro</h3>
                                <p class="eco-card-desc">Muito mais que likes. O T-Feed é um ambiente de alta performance onde você compartilha suas métricas, compete no ranking e destrói seus limites.</p>
                                <div class="eco-tags-row">
                                    <span class="eco-tag" style="--tc:96,165,250;">Ranking Global</span>
                                    <span class="eco-tag" style="--tc:96,165,250;">Métricas Sociais</span>
                                </div>
                            </div>
                        </div>

                        <!-- T-PONTOS -->
                        <div class="eco-card-v9" style="--accent:245,158,11;">
                            <div class="eco-card-hero" style="background: linear-gradient(180deg, rgba(245,158,11,0.15) 0%, rgba(10,15,30,0) 100%);">
                                <div class="eco-hero-bg-blur"></div>
                                <div class="eco-badge" style="background:rgba(245,158,11,0.2); color:#fbbf24; border: 1px solid rgba(245,158,11,0.4);">💎 PRÉMIOS</div>
                                <!-- UI Mock: Gamification -->
                                <div class="ui-mock-container floating" style="animation-delay: 1s;">
                                    <div style="text-align:center; padding: 5px 0 10px;">
                                        <div style="font-size:0.65rem;color:#fbbf24;font-weight:900;letter-spacing:1px;margin-bottom:2px;text-shadow: 0 0 10px rgba(245,158,11,0.5);">SALDO DISPONÍVEL</div>
                                        <div style="font-size:2.4rem;font-weight:900;color:#fff;text-shadow: 0 2px 10px rgba(0,0,0,0.5); line-height: 1;">8.450</div>
                                    </div>
                                    <div style="background:rgba(0,0,0,0.4);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.05);position:relative;overflow:hidden;">
                                        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.7rem; font-weight:800; color:#fff;">
                                            <span>Nível Ouro 🏆</span>
                                            <span style="color:#fbbf24;">84%</span>
                                        </div>
                                        <div style="width:100%;height:8px;background:rgba(255,255,255,0.1);border-radius:99px;box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
                                            <div style="width:84%;height:100%;background:linear-gradient(90deg,#f59e0b,#fef08a);border-radius:99px;box-shadow: 0 0 10px rgba(245,158,11,0.6);"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="eco-card-body">
                                <div class="eco-icon-wrap" style="background: linear-gradient(135deg, rgba(245,158,11,0.2), transparent); border-color: rgba(245,158,11,0.3);">💎</div>
                                <h3 class="eco-card-title">T-Pontos</h3>
                                <p class="eco-card-desc">Seu suor vale dinheiro. Transforme a consistência dos treinos em moedas virtuais de alto valor para trocar em nossa loja premium de prêmios.</p>
                                <div class="eco-tags-row">
                                    <span class="eco-tag" style="--tc:251,191,36;">Cashback Fitness</span>
                                    <span class="eco-tag" style="--tc:251,191,36;">Loja Exclusiva</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- Secondary Intelligence Row -->
                    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; margin-top:1.5rem;">
                        ${[
                            {icon:'🤖', label:'IA Adaptativa', detail:'Modelos matemáticos ajustam cargas baseadas em falhas reais.', color:'220,38,38'},
                            {icon:'🍔', label:'Macro Scanner', detail:'A precisão visual mapeia pratos e calibra seus macronutrientes.', color:'16,185,129'},
                            {icon:'📸', label:'Bio Visão', detail:'Uma varredura computacional de percentual de gordura via câmera.', color:'139,92,246'},
                        ].map(f => `
                            <div class="secondary-feat-v9 reveal">
                                <div class="sec-icon-glow" style="--gc:${f.color};">${f.icon}</div>
                                <div style="flex:1;">
                                    <div style="font-weight:900; color:#fff; font-size:1.05rem; margin-bottom:4px; letter-spacing: -0.5px; text-transform: uppercase;">${f.label}</div>
                                    <p style="font-size:0.8rem; color:#94a3b8; margin:0; line-height:1.5;">${f.detail}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                </div>

                <style>
                    .eco-card-v9 {
                        border-radius: 40px;
                        overflow: hidden;
                        background: rgba(15, 20, 35, 0.4);
                        backdrop-filter: blur(20px);
                        -webkit-backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        display: flex;
                        flex-direction: column;
                        transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 20px 40px rgba(0,0,0,0.4);
                        position: relative;
                    }
                    .eco-card-v9::before {
                        content: ''; position: absolute; inset: 0; border-radius: 40px; padding: 2px;
                        background: linear-gradient(135deg, rgba(var(--accent), 0.5), transparent 60%);
                        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                        -webkit-mask-composite: xor; mask-composite: exclude; opacity: 0; transition: opacity 0.5s;
                    }
                    .eco-card-v9:hover {
                        transform: translateY(-15px) scale(1.02);
                        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 30px 60px rgba(var(--accent), 0.15);
                    }
                    .eco-card-v9:hover::before { opacity: 1; }

                    .eco-card-hero {
                        padding: 2rem 1.5rem;
                        min-height: 240px;
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        border-bottom: 1px solid rgba(255,255,255,0.03);
                    }
                    .eco-hero-bg-blur {
                        position: absolute; width: 120px; height: 120px; border-radius: 50%;
                        background: rgba(var(--accent), 0.4); filter: blur(60px);
                        top: 50%; left: 50%; transform: translate(-50%, -50%);
                        z-index: 0;
                    }

                    .ui-mock-container {
                        width: 100%; max-width: 260px; z-index: 2; margin-top: 1.5rem;
                        background: rgba(10, 15, 25, 0.6); backdrop-filter: blur(10px);
                        border: 1px solid rgba(255,255,255,0.08); border-radius: 20px;
                        padding: 12px; box-shadow: 0 15px 30px rgba(0,0,0,0.5);
                    }
                    .ui-mock-item {
                        display: flex; align-items: center; gap: 12px;
                        background: rgba(255,255,255,0.03); border-radius: 12px;
                        padding: 12px 14px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.04);
                    }
                    .ui-mock-item:last-child { margin-bottom: 0; }
                    .ui-mock-dot { width: 8px; height: 8px; border-radius: 50%; }
                    .ui-mock-text { font-size: 0.8rem; font-weight: 800; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);}
                    .ui-mock-status { margin-left: auto; font-size: 0.65rem; font-weight: 900; letter-spacing: 0.5px;}

                    .floating { animation: float 6s ease-in-out infinite; }
                    @keyframes float {
                        0% { transform: translateY(0px); }
                        50% { transform: translateY(-10px); }
                        100% { transform: translateY(0px); }
                    }

                    .eco-card-body {
                        padding: 2rem; flex: 1; display: flex; flex-direction: column; text-align: center; align-items: center;
                        position: relative; z-index: 2;
                    }
                    .eco-icon-wrap {
                        width: 56px; height: 56px; border-radius: 16px; border: 1px solid;
                        display: flex; align-items: center; justify-content: center; font-size: 1.8rem;
                        margin-top: -46px; margin-bottom: 1rem; background: #0a0f1e;
                        box-shadow: 0 10px 20px rgba(0,0,0,0.5);
                    }
                    .eco-card-title {
                        font-family: 'Inter', sans-serif; font-size: 1.6rem; font-weight: 900; color: #fff; margin: 0 0 1rem;
                        letter-spacing: -1px;
                    }
                    .eco-card-desc { font-size: 0.9rem; color: #94a3b8; line-height: 1.6; margin: 0 0 1.5rem; flex: 1; }
                    .eco-tags-row { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
                    .eco-tag {
                        background: rgba(var(--tc), 0.1); color: rgb(var(--tc)); padding: 6px 12px;
                        border-radius: 100px; font-size: 0.7rem; font-weight: 800; border: 1px solid rgba(var(--tc), 0.2);
                        letter-spacing: 0.5px;
                    }

                    .secondary-feat-v9 {
                        background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03);
                        border-radius: 24px; padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem;
                        transition: all 0.4s; backdrop-filter: blur(10px); cursor: default;
                    }
                    .secondary-feat-v9:hover {
                        background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.1); transform: translateY(-3px);
                    }
                    .sec-icon-glow {
                        width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
                        font-size: 1.8rem; flex-shrink: 0; border: 1px solid rgba(var(--gc), 0.3);
                        background: linear-gradient(135deg, rgba(var(--gc), 0.2), transparent);
                        box-shadow: 0 0 20px rgba(var(--gc), 0.2);
                    }

                    @media screen and (max-width: 900px) {
                        .eco-cards-grid, .eco-cards-grid + div { grid-template-columns: 1fr !important; }
                    }
                </style>
            </section>
        `;
    },

    renderCounters() {
        const counters = [
            { icon: '🏋️', number: '158400', label: 'Treinos Gerados' },
            { icon: '👥', number: '48200', label: 'Alunos Ativos' },
            { icon: '🔥', number: '952000', label: 'Kcal Queimadas' },
            { icon: '📈', number: '85400', label: 'Evoluções Reais' }
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

    renderBenefitsSection() {
        const benefits = [
            { id: '01', title: 'Treinos Adaptativos', desc: 'A IA ajusta as cargas e repetições baseada no seu feedback real após cada série. Evolução garantida sem estagnação.' },
            { id: '02', title: 'Nutrição Sistêmica', desc: 'Sua dieta muda conforme você evolui. Cálculo automático de macros e sugestões de refeições inteligentes.' },
            { id: '03', title: 'Acompanhamento 24h', desc: 'Treine onde e quando quiser. O T-FIT monitora cada movimento seu e garante que você esteja no caminho certo.' }
        ];

        return `
            <section id="beneficios" class="benefits-section">
                <div class="container-lp">
                    <div class="benefits-showcase">
                        <div class="benefits-text reveal">
                            <h2 class="section-title" style="text-align: left;">SINTA A <span>PODEROSA IA</span></h2>
                            <p style="margin-bottom: 3rem; color: #94a3b8;">Nós unimos a ciência do esporte mais avançada com algoritmos de deep learning para criar o seu plano definitivo.</p>
                            
                            <ul class="benefit-list-v4">
                                ${benefits.map(b => `
                                    <li class="benefit-item-v4 reveal">
                                        <div class="benefit-num">${b.id}</div>
                                        <div class="benefit-content-v4">
                                            <h4>${b.title}</h4>
                                            <p>${b.desc}</p>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="benefits-visual reveal">
                            <div style="background: linear-gradient(135deg, rgba(var(--lp-primary-rgb), 0.1), transparent); border: 1px solid rgba(255,255,255,0.1); padding: 40px; border-radius: 40px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                                <i class="fas fa-brain" style="font-size: 5rem; color: var(--lp-primary); margin-bottom: 2rem; filter: drop-shadow(0 0 15px var(--lp-primary-glow));"></i>
                                <h3 style="font-size: 1.5rem; font-weight: 900; margin-bottom: 1rem;">O FIM DOS TREINOS IGUAIS</h3>
                                <p style="font-size: 0.9rem; color: #94a3b8;">Nossa IA analisa mais de 50 variáveis do seu perfil para garantir resultados que você nunca viu antes.</p>
                                <button class="btn-lp btn-lp-primary" style="margin: 2rem auto 0;" onclick="router.navigate('/student/register')">QUERO MINHA EVOLUÇÃO</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
    },

    renderTestimonials() {
        const testimonials = [
            {
                name: 'Ricardo Lima',
                role: 'Aluno há 6 meses',
                initials: 'RL',
                text: 'O T-FIT mudou minha forma de treinar. A IA monta treinos incríveis e eu finalmente vejo resultados reais que nunca tive com personal comum.'
            },
            {
                name: 'Maria Silva',
                role: 'Aluna há 3 meses',
                initials: 'MS',
                text: 'A parte de dieta inteligente é fantástica. O app calcula tudo e me dá opções que eu realmente gosto de comer. Perdi 8kg sem sofrimento!'
            },
            {
                name: 'Junior Santos',
                role: 'Aluno há 1 ano',
                initials: 'JS',
                text: 'O sistema de Bio Scan por foto me motivou demais. Ver minha evolução em gráficos gerados pela IA é viciante. Melhor investimento que fiz.'
            }
        ];

        return `
            <section class="testimonials-section-v4 padding-y-xl" style="background: rgba(255,255,255,0.02);">
                <div class="container-lp">
                    <div class="section-header reveal">
                        <h2 class="section-title">QUEM USA, <span>APROVA!</span> ⭐</h2>
                        <p class="section-desc">Histórias reais de alunos que transformaram seus corpos com nossa tecnologia.</p>
                    </div>
                    <div class="testimonials-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin-top: 4rem;">
                        ${testimonials.map(t => `
                            <div class="testimonial-card-v4 reveal" style="background: var(--lp-card-bg); border: 1px solid var(--lp-border); padding: 2.5rem; border-radius: 32px; transition: transform 0.3s; cursor: default;">
                                <p style="font-style: italic; color: #fff; margin-bottom: 2rem; font-size: 1rem; line-height: 1.6;">"${t.text}"</p>
                                <div class="testimonial-user" style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="testimonial-avatar-v4" style="width: 50px; height: 50px; background: var(--lp-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 1.2rem;">${t.initials}</div>
                                    <div class="testimonial-meta">
                                        <h4 style="font-weight: 800; color: #fff; margin: 0;">${t.name}</h4>
                                        <p style="font-size: 0.8rem; color: var(--lp-text-muted); margin: 0;">${t.role}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
            
            <style>
                @media screen and (max-width: 992px) {
                    .testimonials-grid { grid-template-columns: 1fr !important; }
                    .testimonial-card-v4:hover { transform: translateY(-5px); }
                }
            </style>
        `;
    },
    renderFinalCTA() {
        return `
            <section class="final-cta">
                <div class="container-lp">
                    <h2 class="reveal">PRONTO PARA A SUA<br><span>MELHOR VERSÃO?</span></h2>
                    <div class="hero-cta-group reveal" style="max-width: 600px; margin: 0 auto;">
                        <button class="btn-lp btn-lp-primary" style="min-width: 280px;" onclick="router.navigate('/student/register')">CRIAR MEU PERFIL GRÁTIS</button>
                        <button class="btn-lp btn-lp-video" style="min-width: 280px; background: #000;" onclick="window.open('https://play.google.com', '_blank')">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" style="height: 35px;" alt="Play Store">
                        </button>
                    </div>
                    <p class="reveal" style="margin-top: 2rem; color: #64748b; font-size: 0.8rem; font-weight: 600;">DISPONÍVEL PARA ANDROID E IOS</p>
                </div>
            </section>
        `;
    },

    renderFooter() {
        return `
            <footer class="footer-lp">
                <div class="container-lp footer-grid">
                    <div class="nav-logo">
                        <img src="./logo.png" alt="T-FIT">
                    </div>
                    <div class="footer-links">
                        <a href="#" class="footer-link">Termos de Uso</a>
                        <a href="#" class="footer-link">Privacidade</a>
                        <a href="#" class="footer-link">Suporte AI</a>
                        <a href="#" class="footer-link">Sobre Nós</a>
                    </div>
                    <div class="social-links">
                        <a href="#" class="social-icon"><i class="fab fa-instagram"></i></a>
                        <a href="#" class="social-icon"><i class="fab fa-youtube"></i></a>
                        <a href="#" class="social-icon"><i class="fab fa-tiktok"></i></a>
                    </div>
                    <p class="text-muted" style="font-size: 0.7rem; text-align: center;">
                        © 2026 T-FIT. A Inteligência Artificial a serviço do seu resultado. Todos os direitos reservados.
                    </p>
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
