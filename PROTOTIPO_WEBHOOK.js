/**
 * BACKEND PROTOTYPE: Automated Payment Webhook
 * 
 * Este arquivo é uma demonstração de como seria o servidor (Firebase Cloud Function)
 * para processar os pagamentos automaticamente 24 horas por dia.
 */

const functions = require('firebase-functions');
/*
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

exports.mercadoPagoWebhook = functions.https.onRequest(async (req, res) => {
    const { action, data } = req.body;
    if (action !== 'payment.created' && action !== 'payment.updated') return res.status(200).send('Ignorado');

    const paymentId = data.id;
    try {
        const mpResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer YOUR_ACCESS_TOKEN` }
        });
        const payment = mpResponse.data;

        if (payment.status === 'approved') {
            const userId = payment.external_reference.split('_')[1];
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            await admin.database().ref(`students/${userId}`).update({
                status: 'active',
                planExpiry: expiryDate.toISOString()
            });
        }
        res.status(200).send('OK');
    } catch (e) { res.status(500).send('Erro'); }
});
*/
