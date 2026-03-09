// ============================================
// GOOGLE MAPS CONFIGURATION
// ============================================

/**
 * 🚀 PASSO A PASSO PARA ATIVAR O MAPA:
 * 
 * 1. Acesse o Google Cloud Console: https://console.cloud.google.com/
 * 2. Crie um novo projeto (ex: "TFIT_MAPS").
 * 3. No menu lateral, vá em "APIs e Serviços" > "Biblioteca".
 * 4. Pesquise e ATIVE as seguintes APIs:
 *    - ✅ Maps JavaScript API
 *    - ✅ Places API
 * 5. Vá em "Credenciais" > "+ Criar Credenciais" > "Chave de API".
 * 6. (Recomendado) Clique em "Restringir Chave" e em "Restrições de API" selecione as duas APIs acima.
 * 7. Copie a chave e cole abaixo:
 */

const GOOGLE_MAPS_API_KEY = "AIzaSyCjydYFxHEXtLhzqzR21foNXQeTjfd4flw"; // <--- COLE SUA CHAVE AQUI

// Segurança e Logs
if (GOOGLE_MAPS_API_KEY === "SUA_CHAVE_AQUI") {
    console.error("🚨 CONFIGURAÇÃO PENDENTE: Insira sua chave no arquivo 'google-maps-config.js' para o mapa funcionar.");
} else {
    console.log("✅ Google Maps API Key detectada.");
}
