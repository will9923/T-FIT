/* 
  SPOTIFY MANAGER v2.0 - T-FIT SUPER APP ENGINE
  Auth via PKCE (Proof Key for Code Exchange) - 100% client-side, no backend needed
*/

class SpotifyManager {
    constructor() {
        this.clientId = '6dc0e5d8a5544b5e941f1cda99aa8f37';

        // Redirect URI FIXO — deve bater EXATAMENTE com o cadastrado no Spotify Dashboard
        // Produção: https://tfit.com.br/   |   Local: http://localhost:3000/
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.redirectUri = isLocal
            ? `http://localhost:${window.location.port || 3000}/`
            : 'https://tfit.com.br/';

        this.accessToken = localStorage.getItem('tf_spotify_token');
        this.tokenExpiry = parseInt(localStorage.getItem('tf_spotify_expiry') || '0');
        this.player = null;
        this.deviceId = null;
        this.scopes = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing streaming playlist-read-private';
        
        console.log('[Spotify] v2.0 Init - RedirectURI:', this.redirectUri);
        this.init();
    }

    init() {
        // Verifica se o token está expirado
        if (this.accessToken && Date.now() > this.tokenExpiry) {
            console.warn('[Spotify] Token expirado, limpando sessão...');
            this.clearSession();
        }
        this.checkCallback();
        this.initSDK();
    }

    // --- PKCE HELPERS ---
    generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(values).map(x => possible[x % possible.length]).join('');
    }

    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    // --- AUTH FLOW (PKCE) ---
    async login() {
        try {
            console.log('[Spotify] Iniciando fluxo PKCE...');

            // Salva rota atual para retornar depois do login
            const currentRoute = window.location.hash || '#/student/dashboard';
            localStorage.setItem('tf_spotify_return_route', currentRoute);

            // Gera code_verifier e challenge
            const codeVerifier = this.generateRandomString(64);
            const codeChallenge = await this.generateCodeChallenge(codeVerifier);
            localStorage.setItem('tf_spotify_verifier', codeVerifier);

            const params = new URLSearchParams({
                client_id: this.clientId,
                response_type: 'code',
                redirect_uri: this.redirectUri,
                scope: this.scopes,
                code_challenge_method: 'S256',
                code_challenge: codeChallenge,
                show_dialog: 'true'
            });

            const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
            console.log('[Spotify] Redirecionando para:', authUrl);
            window.location.assign(authUrl);

        } catch (err) {
            console.error('[Spotify] Erro crítico no login:', err);
            if (window.UI) UI.showNotification('Erro Spotify', 'Não foi possível abrir o portal de login.', 'error');
        }
    }

    logout() {
        console.log('[Spotify] Encerrando sessão...');
        this.clearSession();

        if (this.player) {
            this.player.disconnect();
            this.player = null;
        }
        this.deviceId = null;

        this.updateUI(null);
        if (window.UI) UI.showNotification('Spotify Desconectado', 'Sua sessão de música foi encerrada.', 'info');

        if (window.spotifyUI) {
            window.spotifyUI.currentTrack = null;
            window.spotifyUI.updateEmptyState();
        }
    }

    clearSession() {
        this.accessToken = null;
        localStorage.removeItem('tf_spotify_token');
        localStorage.removeItem('tf_spotify_expiry');
        localStorage.removeItem('tf_spotify_verifier');
    }

    async checkCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        // Só processa se houver um verifier salvo — confirma que o ?code é do Spotify
        const hasVerifier = !!localStorage.getItem('tf_spotify_verifier');

        if (error && hasVerifier) {
            console.error('[Spotify] Login negado pelo usuário:', error);
            localStorage.removeItem('tf_spotify_verifier');
            window.history.replaceState({}, document.title, window.location.pathname);
            return false;
        }

        if (code && hasVerifier) {
            // Salva flag para o auth-manager não interferir
            window._spotifyCallbackInProgress = true;
            localStorage.setItem('tf_spotify_callback_pending', '1');

            try {
                console.log('[Spotify] Código de autorização recebido! Trocando por token (PKCE)...');
                await this.exchangeToken(code);
                console.log('[Spotify] Token obtido! Redirecionando de volta ao app...');

                // Pega a rota salva antes do login
                const returnRoute = localStorage.getItem('tf_spotify_return_route') || '#/student/dashboard';
                localStorage.removeItem('tf_spotify_return_route');
                localStorage.removeItem('tf_spotify_callback_pending');

                // ✅ Faz reload completo na rota correta — garante que o router e o auth estão prontos
                window.location.replace(window.location.origin + '/' + returnRoute);

                return true;
            } catch (e) {
                window._spotifyCallbackInProgress = false;
                localStorage.removeItem('tf_spotify_callback_pending');
                console.error('[Spotify] Falha no callback:', e);
                // Em caso de erro, vai para o dashboard sem o ?code
                window.location.replace(window.location.origin + '/#/student/dashboard');
                return false;
            }
        }

        // Se vier do reload pós-callback, notifica sucesso
        if (localStorage.getItem('tf_spotify_just_connected')) {
            localStorage.removeItem('tf_spotify_just_connected');
            setTimeout(() => {
                if (window.UI) UI.showNotification('Spotify Conectado! 🟢', 'Sua conta foi vinculada com sucesso.', 'success');
                if (window.spotifyUI) spotifyUI.updateEmptyState();
                this.initSDK();
            }, 1200);
        }
        return false;
    }

    async exchangeToken(code) {
        const codeVerifier = localStorage.getItem('tf_spotify_verifier');
        if (!codeVerifier) {
            throw new Error('Code verifier não encontrado. Tente fazer login novamente.');
        }

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: this.clientId,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.redirectUri,
                code_verifier: codeVerifier
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(`Spotify API Error: ${data.error} - ${data.error_description}`);
        }

        if (data.access_token) {
            this.saveSession(data.access_token, data.expires_in);
            console.log('[Spotify] Token obtido com sucesso via PKCE! ✅');
        } else {
            throw new Error('Resposta inválida da API Spotify');
        }
    }

    saveSession(token, expiresIn) {
        this.accessToken = token;
        const expiryTime = Date.now() + (expiresIn * 1000) - 60000;
        this.tokenExpiry = expiryTime;
        localStorage.setItem('tf_spotify_token', token);
        localStorage.setItem('tf_spotify_expiry', expiryTime.toString());
        localStorage.setItem('tf_spotify_just_connected', '1'); // Notifica sucesso após reload
        console.log('[Spotify] Sessão salva! Expira em:', new Date(expiryTime).toLocaleTimeString());
    }

    // --- PLAYER SDK ---
    initSDK() {
        if (!this.accessToken) {
            console.log('[Spotify] SDK não iniciado: sem token de acesso.');
            return;
        }

        // Se SDK já está disponível, inicializa player diretamente
        if (window.Spotify) {
            this._createPlayer();
            return;
        }

        // Aguarda SDK carregar
        window.onSpotifyWebPlaybackSDKReady = () => {
            this._createPlayer();
        };
    }

    _createPlayer() {
        if (this.player) {
            console.log('[Spotify] Player já existe.');
            return;
        }

        console.log('[Spotify] Criando Spotify.Player...');
        this.player = new Spotify.Player({
            name: 'T-FIT Super App',
            getOAuthToken: cb => { cb(this.accessToken); },
            volume: 0.7
        });

        this.player.addListener('initialization_error', ({ message }) => {
            console.error('[Spotify] Init error:', message);
        });
        this.player.addListener('authentication_error', ({ message }) => {
            console.error('[Spotify] Auth error:', message);
            this.clearSession();
            if (window.spotifyUI) spotifyUI.updateEmptyState();
        });
        this.player.addListener('account_error', ({ message }) => {
            console.error('[Spotify] Account error (precisa Spotify Premium):', message);
            if (window.UI) UI.showNotification('Spotify Premium', 'O player interativo requer uma conta Spotify Premium.', 'warning');
        });
        this.player.addListener('playback_error', ({ message }) => {
            console.error('[Spotify] Playback error:', message);
        });

        this.player.addListener('player_state_changed', state => {
            if (!state) return;
            this.updateUI(state);
        });

        this.player.addListener('ready', ({ device_id }) => {
            console.log('[Spotify] Player pronto! Device ID:', device_id);
            this.deviceId = device_id;
        });

        this.player.addListener('not_ready', ({ device_id }) => {
            console.warn('[Spotify] Device ficou offline:', device_id);
            this.deviceId = null;
        });

        this.player.connect().then(success => {
            if (success) {
                console.log('[Spotify] Player conectado com sucesso! 🎵');
            }
        });
    }

    // --- API WRAPPERS ---
    async search(query) {
        if (!this.accessToken) return [];
        try {
            const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const data = await res.json();
            return data.tracks?.items || [];
        } catch (e) {
            console.error('[Spotify] Search error:', e);
            return [];
        }
    }

    async getPlaylists() {
        if (!this.accessToken) return [];
        try {
            const res = await fetch(`https://api.spotify.com/v1/me/playlists`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const data = await res.json();
            return data.items || [];
        } catch (e) {
            console.error('[Spotify] Playlists error:', e);
            return [];
        }
    }

    async play(uri) {
        if (!this.deviceId || !this.accessToken) {
            console.warn('[Spotify] Sem device_id ou token para reproduzir.');
            return;
        }
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [uri] }),
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async togglePlay() { if (this.player) this.player.togglePlay(); }
    async next() { if (this.player) this.player.nextTrack(); }
    async prev() { if (this.player) this.player.previousTrack(); }

    isAuthenticated() {
        return !!this.accessToken && Date.now() < this.tokenExpiry;
    }

    updateUI(state) {
        const event = new CustomEvent('tfSpotifyStateChanged', { detail: state });
        window.dispatchEvent(event);
    }
}

const spotifyManager = new SpotifyManager();
window.spotifyManager = spotifyManager;
