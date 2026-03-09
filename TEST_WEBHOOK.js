/**
 * Mock Webhook Tester
 * Run this to simulate a Mercado Pago notification.
 * 
 * Usage: node TEST_WEBHOOK.js <PAYMENT_ID> <USER_ID>
 */

const axios = require('axios');

async function testWebhook() {
    const paymentId = process.argv[2] || '999999999';
    const userId = process.argv[3] || 'TEST_USER';

    console.log(`Simulando pagamento ${paymentId} para usuário ${userId}...`);

    try {
        // This is a simulation of what MP sends to your function
        const response = await axios.post('http://localhost:5001/fitpro-d308f/us-central1/mercadoPagoWebhook', {
            action: 'payment.updated',
            data: { id: paymentId },
            metadata: {
                user_id: userId,
                plan_id: 'standard'
            }
        });

        console.log('Resposta do Webhook:', response.status, response.data);
    } catch (error) {
        console.error('Erro ao testar webhook:', error.message);
        console.log('Dica: Certifique-se de que o firebase serve está rodando localmente.');
    }
}

testWebhook();
