console.log("🚀 DEBUG STUDENT ROUTE CARREGADO");

// Sobrescreve a rota de dashboard com versão mínima
setTimeout(() => {
    if (window.router) {
        console.log("🛠️ Sobrescrevendo rota /student/dashboard para teste...");

        window.router.addRoute('/student/dashboard', () => {
            console.log("✅ ROTA DEBUG ACIONADA!");

            const app = document.getElementById('app');
            if (!app) {
                console.error("ERRO: Elemento #app não encontrado!");
                return;
            }

            // Renderização Mínima Garantida
            try {
                app.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: white;">
                        <h1 style="color: #2ecc71; font-size: 3rem;">DASHBOARD DEBUG</h1>
                        <p style="font-size: 1.5rem;">Se você vê isso, o sistema de rotas FUNCIONA.</p>
                        <hr style="margin: 20px 0; border-color: #333;">
                        <p>User: ${auth.getCurrentUser()?.email || 'Nenhum'}</p>
                        <button onclick="location.reload()" style="padding: 15px 30px; font-size: 1.2rem; margin-top: 20px;">
                            Recarregar
                        </button>
                    </div>
                `;
                console.log("✅ HTML Injetado no DOM com sucesso.");
            } catch (e) {
                console.error("❌ Erro ao injetar HTML:", e);
                alert("Erro Render: " + e.message);
            }
        });
    } else {
        console.error("❌ ROUTER NÃO ENCONTRADO NO ESCOPO GLOBAL!");
        alert("ERRO CRÍTICO: Router não definido.");
    }
}, 1000); // Espera 1s para garantir que student-pages.js já rodou
