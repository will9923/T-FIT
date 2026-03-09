importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuração do Firebase (preenchida automaticamente via firebase-config.js ou injetada)
// IMPORTANTE: Mantenha as credenciais sincronizadas com seu firebase-config.js
firebase.initializeApp({
    apiKey: "AIzaSyAv59FxS9vYxiGR698BuCkYy0x2R7oHezE",
    authDomain: "fitpro-d308f.firebaseapp.com",
    projectId: "fitpro-d308f",
    storageBucket: "fitpro-d308f.firebasestorage.app",
    messagingSenderId: "323918736527",
    appId: "1:323918736527:web:2fd5e5d93f66b6793fd4fa"
});

const messaging = firebase.messaging();

// Background Message Handler
// Isso lida com notificações quando o app está fechado ou em segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensagem em segundo plano recebida:', payload);

    const notificationTitle = payload.notification.title || 'T-FIT App';
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/icons/icon-192x192.png', // Ajuste conforme seu caminho de assets
        badge: '/assets/icons/icon-72x72.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
