const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'functions', '.env') });

async function verifyBackend() {
    console.log('--- Iniciando Teste de Integração Backend ---');

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
        console.error('❌ ERRO: MERCADOPAGO_ACCESS_TOKEN não encontrado no seu arquivo functions/.env');
        return;
    }

    console.log('✅ Token encontrado:', token.substring(0, 15) + '...');

    try {
        console.log('🛰️ Testando conexão com a API do Mercado Pago...');
        const response = await axios.get('https://api.mercadopago.com/v1/payment_methods', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`✅ Conexão MP OK! Recebidos ${response.data.length} métodos de pagamento.`);
    } catch (error) {
        console.error('❌ ERRO ao conectar com Mercado Pago:', error.response ? error.response.data : error.message);
    }
}

async function verifyFrontend() {
    console.log('\n--- Dicas para Teste Frontend ---');
    console.log('1. Abra o console do navegador no seu app.');
    console.log('2. Digite "mp" e dê enter. Se aparecer o objeto MercadoPago, o SDK carregou OK.');
    console.log('3. Tente clicar em "Ativar T-FIT Premium". Se abrir a tela de checkout, a Cloud Function está OK.');
}

verifyBackend().then(() => verifyFrontend());
