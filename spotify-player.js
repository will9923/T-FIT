class SpotifyPlayerUI {
    constructor() {
        this.isOpen = false;
        this.currentTrack = null;
        this.isPlaying = false;
        this.progressTimer = null;
        this.progressMs = 0;
        this.durationMs = 0;

        this.init();
    }

    init() {
        this.renderPlayerDOM();
        this.bindEvents();
        this.listenToManager();
        this.checkInitialState();
    }

    checkInitialState() {
        // Initial UI check
        setTimeout(() => {
            this.updateEmptyState();
        }, 500);
    }

    renderPlayerDOM() {
        if (document.getElementById('tf-spotify-container-root')) {
            console.log('[Spotify] Player UI already exists, skipping injection.');
            return;
        }

        const playerHtml = `
            <!-- Mini Player -->
            <div id="tf-spotify-mini-player" class="hidden" onclick="spotifyUI.toggleFullPlayer(true)">
                <img src="" class="tf-mini-art" id="mini-track-art">
                <div class="tf-mini-info">
                    <div class="tf-mini-title" id="mini-track-title">--</div>
                    <div class="tf-mini-artist" id="mini-track-artist">--</div>
                </div>
                <div class="tf-mini-controls">
                    <i class="bi bi-play-fill tf-mini-btn" id="mini-play-btn" onclick="event.stopPropagation(); spotifyManager.togglePlay()"></i>
                    <i class="bi bi-chevron-right tf-mini-btn" style="font-size:16px; opacity:0.5;"></i>
                </div>
            </div>

            <!-- Full Expanded Player -->
            <div id="tf-spotify-full-player">
                <canvas id="tf-spotify-bg-canvas"></canvas>
                
                <div class="tf-full-header">
                    <i class="bi bi-chevron-down text-2xl" onclick="spotifyUI.toggleFullPlayer(false)"></i>
                    <div class="text-xs font-bold uppercase tracking-widest text-muted">T-Músicas</div>
                    <i class="bi bi-three-dots text-2xl" onclick="spotifyUI.showPlayerMenu()" style="cursor: pointer;"></i>
                </div>

                <!-- Empty State / Login View -->
                <div id="tf-player-empty-state" class="flex flex-col items-center justify-center text-center px-xl" style="height: 60%; display: none;">
                    <div class="spotify-logo-anim mb-xl">
                        <i class="bi bi-spotify text-success" style="font-size: 80px; filter: drop-shadow(0 0 20px rgba(29, 185, 84, 0.4));"></i>
                    </div>
                    <h2 class="text-2xl font-black mb-md" id="empty-state-title">Conecte sua batida!</h2>
                    <p class="text-muted mb-xl" id="empty-state-desc">Sincronize sua conta do Spotify para ouvir música enquanto treina.</p>
                    <button id="btn-spotify-connect" type="button" class="btn btn-primary btn-lg px-xl py-lg" style="border-radius: 40px; background: #1DB954; border: none; font-weight: 800;" onclick="event.preventDefault(); spotifyManager.login()">
                        CONECTAR SPOTIFY
                    </button>
                    <div id="nav-to-feed-hint" class="mt-xl text-xs text-muted font-bold uppercase tracking-widest hidden">
                        Escolha uma música no <span class="text-primary">T-Feed</span> ou <span class="text-primary">Hub</span>
                    </div>
                </div>

                <!-- Content View (Track Info) -->
                <div id="tf-player-content-view">
                    <div class="tf-full-art-container">
                        <img src="" class="tf-full-art" id="full-track-art">
                    </div>

                    <div class="tf-full-info">
                        <div class="tf-full-title" id="full-track-title">--</div>
                        <div class="tf-full-artist" id="full-track-artist">--</div>
                    </div>

                    <!-- Progress Bar -->
                    <div class="tf-full-progress">
                        <input type="range" class="form-range" id="full-track-slider" min="0" max="100" value="0">
                        <div class="progress-time">
                            <span id="txt-curr-time">0:00</span>
                            <span id="txt-total-time">0:00</span>
                        </div>
                    </div>

                    <!-- Controls -->
                    <div class="tf-full-controls">
                        <i class="bi bi-shuffle tf-accent-btn"></i>
                        <i class="bi bi-skip-start-fill tf-ctl-btn" onclick="spotifyManager.prev()"></i>
                        <i class="bi bi-play-circle-fill tf-play-main" id="full-play-btn" onclick="spotifyManager.togglePlay()"></i>
                        <i class="bi bi-skip-end-fill tf-ctl-btn" onclick="spotifyManager.next()"></i>
                        <i class="bi bi-repeat tf-accent-btn"></i>
                    </div>
                </div>
                
                <div class="tf-player-footer px-sm">
                     <div class="flex items-center gap-xs text-muted" style="font-size: 13px;">
                        <i class="bi bi-laptop"></i> Dispositivos T-FIT
                     </div>
                     <i class="bi bi-share text-muted"></i>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.id = 'tf-spotify-container-root';
        div.innerHTML = playerHtml;
        document.body.appendChild(div);
    }

    bindEvents() {
        // Range slider interaction
        const slider = document.getElementById('full-track-slider');
        if (slider) {
            slider.addEventListener('change', (e) => {
                if (spotifyManager.player) {
                    spotifyManager.player.seek(e.target.value);
                }
            });
        }
    }

    listenToManager() {
        window.addEventListener('tfSpotifyStateChanged', (e) => {
            const state = e.detail;
            this.updateUIChannels(state);
        });
    }

    updateEmptyState() {
        const hasToken = !!spotifyManager.accessToken;
        const emptyState = document.getElementById('tf-player-empty-state');
        const contentView = document.getElementById('tf-player-content-view');
        const connectBtn = document.getElementById('btn-spotify-connect');
        const hint = document.getElementById('nav-to-feed-hint');

        if (!hasToken) {
            emptyState.style.display = 'flex';
            contentView.style.display = 'none';
            connectBtn.style.display = 'block';
            hint.classList.add('hidden');
            document.getElementById('empty-state-title').innerText = 'Conecte sua batida!';
            document.getElementById('empty-state-desc').innerText = 'Sincronize sua conta do Spotify para ouvir música enquanto treina.';
        } else if (!this.currentTrack) {
            emptyState.style.display = 'flex';
            contentView.style.display = 'none';
            connectBtn.style.display = 'none';
            hint.classList.remove('hidden');
            document.getElementById('empty-state-title').innerText = 'Pronto para o play?';
            document.getElementById('empty-state-desc').innerText = 'Inicie sua playlist favorita ou escolha uma música no feed.';
        } else {
            emptyState.style.display = 'none';
            contentView.style.display = 'block';
        }
    }

    updateUIChannels(state) {
        if (!state) {
            this.updateEmptyState();
            return;
        }

        const track = state.track_window.current_track;
        if (!track) {
            this.currentTrack = null;
            this.updateEmptyState();
            return;
        }

        this.currentTrack = track;
        this.isPlaying = !state.paused;
        this.durationMs = state.duration;
        this.progressMs = state.position;

        // Hide empty state
        document.getElementById('tf-player-empty-state').style.display = 'none';
        document.getElementById('tf-player-content-view').style.display = 'block';

        // Show Mini Player
        document.getElementById('tf-spotify-mini-player').classList.remove('hidden');

        // Update UI elements
        document.getElementById('mini-track-title').innerText = track.name;
        document.getElementById('full-track-title').innerText = track.name;
        
        const artist = track.artists.map(a => a.name).join(', ');
        document.getElementById('mini-track-artist').innerText = artist;
        document.getElementById('full-track-artist').innerText = artist;

        const art = track.album.images[0].url;
        document.getElementById('mini-track-art').src = art;
        document.getElementById('full-track-art').src = art;

        // Icons
        const playBtn = this.isPlaying ? 'bi-pause-fill' : 'bi-play-fill';
        document.getElementById('mini-play-btn').className = `bi ${playBtn} tf-mini-btn`;
        
        const mainPlayBtn = this.isPlaying ? 'bi-pause-circle-fill' : 'bi-play-circle-fill';
        document.getElementById('full-play-btn').className = `bi ${mainPlayBtn} tf-play-main`;

        this.updateProgress();
    }

    updateProgress() {
        if (this.progressTimer) clearInterval(this.progressTimer);
        
        const slider = document.getElementById('full-track-slider');
        const currTxt = document.getElementById('txt-curr-time');
        const totalTxt = document.getElementById('txt-total-time');

        slider.max = this.durationMs;
        totalTxt.innerText = this.formatTime(this.durationMs);

        if (this.isPlaying) {
            this.progressTimer = setInterval(() => {
                this.progressMs += 1000;
                if (this.progressMs > this.durationMs) this.progressMs = this.durationMs;
                
                slider.value = this.progressMs;
                currTxt.innerText = this.formatTime(this.progressMs);
            }, 1000);
        } else {
            slider.value = this.progressMs;
            currTxt.innerText = this.formatTime(this.progressMs);
        }
    }

    formatTime(ms) {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    toggleFullPlayer(open) {
        this.isOpen = open;
        const panel = document.getElementById('tf-spotify-full-player');
        if (open) {
            panel.classList.add('open');
            this.updateEmptyState();
        } else {
            panel.classList.remove('open');
        }
    }

    showPlayerMenu() {
        if (!spotifyManager.accessToken) {
            UI.showNotification('Spotify', 'Conecte sua conta para ver as opções.', 'info');
            return;
        }

        UI.confirmDialog(
            'Opções do Spotify 🟢',
            'Deseja desconectar sua conta e encerrar a sessão de música?',
            () => {
                spotifyManager.logout();
                this.toggleFullPlayer(false);
            },
            'Sim, desconectar',
            null,
            'Voltar'
        );
    }
}

const spotifyUI = new SpotifyPlayerUI();
window.spotifyUI = spotifyUI;
