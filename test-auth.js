
// Test script for Firebase Auth
const firebaseConfig = require('./firebase-config.js');
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');

firebase.initializeApp(firebaseConfig);

const email = `test_user_${Date.now()}@example.com`;
const password = 'TestPassword123!';

console.log(`Tentando criar usuário: ${email}`);

firebase.auth().createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
        console.log("Sucesso! Usuário criado:", userCredential.user.uid);
    })
    .catch((error) => {
        console.error("Erro ao criar usuário:", error.code, error.message);
    });
