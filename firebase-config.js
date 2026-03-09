// ============================================
// FIREBASE CONFIGURATION
// ============================================
//
// 1. Acesse: https://console.firebase.google.com/
// 2. Crie um novo projeto (ex: "FitPro App")
// 3. Vá em "Configurações do Projeto" -> "Geral"
// 4. Role até "Seus aplicativos" e clique no ícone web (</>)
// 5. Copie as credenciais e cole abaixo:
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyAv59FxS9vYxiGR698BuCkYy0x2R7oHezE",
    authDomain: "fitpro-d308f.firebaseapp.com",
    databaseURL: "https://fitpro-d308f-default-rtdb.firebaseio.com",
    projectId: "fitpro-d308f",
    storageBucket: "fitpro-d308f.firebasestorage.app",
    messagingSenderId: "323918736527",
    appId: "1:323918736527:web:2fd5e5d93f66b6793fd4fa",
    measurementId: "G-9VG80HYM0G"
};

console.log("[Firebase Config] Projeto ID:", firebaseConfig.projectId);

// Initialize Firebase
let dbRT;
let authFirebase;

function initializeFirebase() {
    console.log("🚀 Iniciando Firebase (v9 Compat)...");

    if (typeof firebase === 'undefined') {
        console.error("Firebase SDK não carregado. Verifique a conexão com a internet.");
        return;
    }


    try {
        // Prevent multiple initializations
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        dbRT = firebase.database();
        authFirebase = firebase.auth();
        const firestore = firebase.firestore();
        const functions = firebase.functions();

        // Make globally accessible
        window.dbRT = dbRT;
        window.authFirebase = authFirebase;
        window.dbFirestore = firestore;
        window.firebaseFunctions = functions;

        console.log("✅ Firebase Realtime Database, Firestore e Auth inicializados.");

        // Monitor connection status in real-time
        if (dbRT) {
            const connectedRef = dbRT.ref(".info/connected");
            connectedRef.on("value", (snap) => {
                if (snap.val() === true) {
                    console.log("🛰️ Conectado ao Servidor (Online)");
                    if (window.UI && window.UI.updateConnectionStatus) {
                        window.UI.updateConnectionStatus('online');
                    }
                } else {
                    console.warn("📡 Desconectado do Servidor (Offline)");
                    if (window.UI && window.UI.updateConnectionStatus) {
                        window.UI.updateConnectionStatus('offline');
                    }
                }
            });
        }

    } catch (error) {
        console.error("Erro ao conectar Firebase.", error);
        if (window.UI) {
            window.UI.updateConnectionStatus('error');
        }
    }
}

// Start initialization
initializeFirebase();

// FCM logic moved to push-notifications.js and firebase-messaging-sw.js

