// ============================================
// SUPABASE CONFIGURATION
// ============================================

// IMPORTANTE: Credenciais do projeto Supabase
const SUPABASE_URL = 'https://kyxsjdpwvmaewwxtdnxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHNqZHB3dm1hZXd3eHRkbnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTE5NzAsImV4cCI6MjA4NzEyNzk3MH0.gwmQ2KBifGEaiEVHZq1pPAhyGUwK7tPFTe9I8NmDPzU';

console.log("[Supabase Config] URL:", SUPABASE_URL);

// Função de inicialização imediata
(function initializeSupabase() {
    console.log("🚀 Iniciando Supabase...");

    // 1. Verificar se a lib foi carregada (do CDN)
    if (typeof window.supabase === 'undefined') {
        console.error("❌ Supabase SDK não carregado! Verifique a conexão ou o CDN no index.html");
        alert("Erro crítico: Supabase SDK não carregado. Verifique sua internet.");
        return;
    }

    try {
        // 2. Criar cliente
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Substitui a lib global pela instância do cliente para o resto do app usar
        window.supabase = client;

        console.log("✅ Supabase inicializado e exposto globalmente!");

        // 3. Teste silencioso de conexão (async, não bloqueia app)
        client.from('profiles').select('count', { count: 'exact', head: true })
            .then(({ error }) => {
                if (error) console.warn("⚠️ Aviso de conexão:", error.message);
                else console.log("autenticação anônima validada.");
            })
            .catch(err => console.error("Erro de rede Supabase:", err));

    } catch (error) {
        console.error("❌ Erro fatal ao criar cliente Supabase:", error);
        alert("Erro na configuração do Supabase. Veja o console.");
    }
})();
