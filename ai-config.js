// Configuração de IA do T-FIT
const AI_CONFIG = {
    provider: 'deepseek',
    deepseek: {
        model: 'deepseek-chat',
        apiKey: 'sk-c2fbc71f1a244b15a92aa0bbae48f6d4',
        baseUrl: 'https://api.deepseek.com/v1/chat/completions'
    },
    gemini: {
        model: 'gemini-1.5-flash',
        apiKey: 'AIzaSyDMkN0bJAvBQ5kEUeyEOKsegYsJotWnFZs'
    }
};

window.AI_CONFIG = AI_CONFIG;
