/* 
  T-FEED STORIES EDITOR v1.3 - GLOBAL MUSIC SEARCH EDITION
  Powered by iTunes API, interact.js & html2canvas
*/

class TFeedStoryEditor {
    constructor() {
        this.activeMime = 'image/jpeg';
        this.elements = []; 
        this.isDrawingMode = false;
        this.isDrawing = false;
        this.drawColor = '#ffffff';
        this.drawWidth = 5;
        this.bgImage = null;
        this.activeFont = 'font-modern';
        this.activeColor = '#ffffff';
        
        // --- REAL MUSIC ENGINE (API) ---
        this.audioPlayer = new Audio();
        this.selectedMusic = null;
        this.musicStartTime = 0;
        
        this.emojis = ['🔥', '💪', '👟', '✨', '❤️', '🙌', '💯', '🤩', '🎯', '🥑', '⚡', '🏆', '💎', '🚀', '👑', '🥵', '💦', '🥦', '🏋️‍♂️', '🏃‍♀️'];

        this.init();
    }

    init() {
        this.createEditorDOM();
        this.setupInteractivity();
        this.setupDrawing();
    }

    createEditorDOM() {
        const editorHtml = `
            <div id="tf-story-editor-container">
                <!-- 1. Top Bar -->
                <div class="tf-v2-editor-top-bar" style="z-index: 100010;">
                    <button class="tf-v2-editor-tool-btn" onclick="storyEditor.close()"><i class="bi bi-x-lg"></i></button>
                    <div style="display:flex; gap:10px;">
                        <button class="tf-v2-editor-tool-btn" onclick="storyEditor.clear(true)"><i class="bi bi-trash"></i></button>
                    </div>
                </div>

                <!-- 2. Main Workspace -->
                <div id="tf-story-editor-preview-area">
                    <canvas id="tf-story-drawing-canvas"></canvas>
                </div>

                <!-- 3. Sidebar Tools -->
                <div class="tf-v2-editor-tools-sidebar" style="z-index: 100010;">
                    <button class="tf-v2-editor-tool-btn" title="Texto" onclick="storyEditor.addText()"><i class="bi bi-fonts"></i></button>
                    <button class="tf-v2-editor-tool-btn" title="Emojis" onclick="storyEditor.openEmojiPicker()"><i class="bi bi-emoji-smile"></i></button>
                    <button class="tf-v2-editor-tool-btn" title="Link" onclick="storyEditor.addLink()"><i class="bi bi-link-45deg"></i></button>
                    <button class="tf-v2-editor-tool-btn" title="Música" onclick="storyEditor.openMusicSheet()"><i class="bi bi-music-note-beamed"></i></button>
                    <button class="tf-v2-editor-tool-btn" id="btn-draw" title="Desenho" onclick="storyEditor.toggleDrawingMode()"><i class="bi bi-pencil-fill"></i></button>
                </div>

                <!-- Color Tool -->
                <div id="tf-editor-floating-colors" style="position:fixed; left: 15px; top: 50%; transform:translateY(-50%); display:none; flex-direction:column; gap:10px; z-index:10001;">
                    <div class="tf-color-swatch" style="background:#ffffff" onclick="storyEditor.setDrawColor('#ffffff')"></div>
                    <div class="tf-color-swatch" style="background:#ff0000" onclick="storyEditor.setDrawColor('#ff0000')"></div>
                    <div class="tf-color-swatch" style="background:#00ff00" onclick="storyEditor.setDrawColor('#00ff00')"></div>
                    <div class="tf-color-swatch" style="background:#0000ff" onclick="storyEditor.setDrawColor('#0000ff')"></div>
                </div>

                <!-- 4. Bottom Controls & TRIMMER -->
                <div class="tf-v2-editor-bottom-bar flex-col gap-sm" style="z-index: 100010;">
                    <div id="tf-music-trimmer-area" style="display:none; width:100%; background:rgba(0,0,0,0.5); padding:12px; border-radius:15px; backdrop-filter:blur(10px); margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);">
                         <div class="flex justify-between text-xs mb-xs px-sm" style="color:white">
                              <span id="trim-start">0:00</span>
                              <div class="flex items-center gap-xs">
                                   <i class="bi bi-music-note"></i>
                                   <span id="music-title-active" style="font-weight:bold">Música Selecionada</span>
                              </div>
                              <span id="trim-end">0:15</span>
                         </div>
                         <input type="range" min="0" max="100" value="0" class="form-range" id="tf-music-range" oninput="storyEditor.updateTrim()" style="width:100%;">
                    </div>
                    <button class="tf-v2-btn-post-story btn-primary" style="width:100%" onclick="storyEditor.publish()">
                        Compartilhar Story <i class="bi bi-arrow-right-circle-fill"></i>
                    </button>
                </div>

                <!-- 5. Overlay Inputs & Font Bar -->
                <div id="tf-story-input-overlay" class="tf-v2-editor-input-overlay">
                    <textarea id="tf-story-text-input" placeholder="Digite algo..."></textarea>
                    <div class="tf-v2-editor-font-bar">
                        <div class="tf-font-option active" onclick="storyEditor.setFont('font-modern', this)">Modern</div>
                        <div class="tf-font-option" onclick="storyEditor.setFont('font-classic', this)" style="font-family:'Merriweather'">Classic</div>
                        <div class="tf-font-option" onclick="storyEditor.setFont('font-neon', this)" style="font-family:'Codystar'">Neon</div>
                        <div class="tf-font-option" onclick="storyEditor.setFont('font-elegant', this)" style="font-family:'Monsieur La Doulaise'">Elegant</div>
                        <div class="tf-font-option" onclick="storyEditor.setFont('font-impact', this)" style="font-family:'Archivo Black'">Impact</div>
                    </div>
                    <div class="flex gap-md mt-lg" id="tf-text-color-picker-ui"></div>
                    <button class="btn btn-primary mt-xl" onclick="storyEditor.confirmText()">Concluir</button>
                </div>

                <!-- Emoji Picker -->
                <div id="tf-story-emoji-picker">
                    <div class="col-span-full flex justify-between mb-md">
                         <span class="font-bold" style="color:white">Stickers</span>
                         <i class="bi bi-chevron-down" onclick="storyEditor.closeEmojiPicker()" style="color:white; cursor:pointer;"></i>
                    </div>
                    <div id="tf-emoji-list" class="grid grid-cols-5 gap-md"></div>
                </div>

                <!-- Music Sheet -->
                <div id="tf-story-music-sheet">
                    <div class="flex justify-between items-center mb-lg">
                        <h3 class="text-xl font-bold" style="color:white">Músicas do Mundo</h3>
                        <button class="btn btn-ghost" onclick="storyEditor.closeMusicSheet()"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div class="relative mb-lg">
                        <i class="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-muted"></i>
                        <input type="text" id="tf-music-search-input" class="form-input" style="padding-left:45px; background:rgba(255,255,255,0.1); border:none; color:white;" placeholder="Buscar qualquer música..." oninput="storyEditor.searchInternetMusic(this.value)">
                    </div>
                    <div id="tf-music-list" class="flex flex-col gap-md" style="max-height: 400px; overflow-y: auto;">
                        <p class="text-muted text-center p-xl">Digite o nome da música ou artista...</p>
                    </div>
                </div>
            </div>

            <input type="file" id="tf-story-media-input" accept="image/*,video/*" hidden onchange="storyEditor.handleMediaSelect(this)">
        `;
        
        const div = document.createElement('div');
        div.innerHTML = editorHtml;
        document.body.appendChild(div);
        this.container = document.getElementById('tf-story-editor-container');
        
        // Initial Renders
        this.renderEmojiList();
        this.renderTextColorUI();
    }

    renderEmojiList() {
        const container = document.getElementById('tf-emoji-list');
        if (container) {
            container.innerHTML = this.emojis.map(e => `<div class="tf-emoji-item" onclick="storyEditor.addEmoji('${e}')">${e}</div>`).join('');
        }
    }

    renderTextColorUI() {
        const container = document.getElementById('tf-text-color-picker-ui');
        const colors = ['#ffffff', '#fe2c55', '#2ecc71', '#f1c40f', '#3498db', '#9b59b6'];
        if (container) {
            container.innerHTML = colors.map(c => `
                <div class="tf-color-swatch" style="background:${c}" onclick="storyEditor.setTextColor('${c}')"></div>
            `).join('');
        }
    }

    // --- SPOTIFY MUSIC SEARCH ---
    async searchInternetMusic(query) {
        if (!query || query.length < 2) return;
        
        const container = document.getElementById('tf-music-list');
        container.innerHTML = `<div class="text-center p-xl"><i class="bi bi-arrow-repeat spin"></i> Buscando no Spotify...</div>`;
        
        try {
             // Use the global spotifyManager
             const tracks = await spotifyManager.search(query);
             
             if (tracks && tracks.length > 0) {
                  const list = tracks.map(track => ({
                       id: track.id,
                       title: track.name,
                       artist: track.artists.map(a => a.name).join(', '),
                       art: track.album.images[0].url,
                       url: track.preview_url, // For preview if available
                       uri: track.uri // Spotify URI for playback
                  }));
                  this.renderMusicList(list);
             } else {
                  container.innerHTML = `<p class="text-muted text-center p-xl">Nenhuma música encontrada no Spotify.</p>`;
             }
        } catch (err) {
             console.error('[MusicSearch] Error:', err);
             container.innerHTML = `<p class="text-danger text-center p-xl">Erro ao buscar música. Verifique sua conexão com o Spotify.</p>`;
        }
    }

    renderMusicList(list) {
        const container = document.getElementById('tf-music-list');
        if (!container) return;
        
        if (list.length === 0) {
            container.innerHTML = `<p class="text-muted text-center p-xl">Digite o nome da música ou artista...</p>`;
            return;
        }

        container.innerHTML = list.map(m => `
            <div class="tf-music-item" style="color:white" onclick="storyEditor.playMusic(${JSON.stringify(m).replace(/"/g, '&quot;')})">
                <img src="${m.art}" class="tf-music-art">
                <div style="flex:1; overflow:hidden">
                    <div class="font-bold text-ellipsis">${m.title}</div>
                    <div class="text-xs text-muted text-ellipsis">${m.artist}</div>
                </div>
                <button class="btn btn-primary btn-sm" style="border-radius:20px; padding: 5px 12px; font-size:12px;" onclick="event.stopPropagation(); storyEditor.addMusicSticker(${JSON.stringify(m).replace(/"/g, '&quot;')})">Usar</button>
            </div>
        `).join('');
    }

    // --- Audio Control ---
    playMusic(music) {
        this.selectedMusic = music;

        // Try Spotify first if logged in
        if (spotifyManager.accessToken) {
             spotifyManager.play(music.uri);
        } else {
             // Fallback to preview if available
             if (music.url) {
                  this.audioPlayer.src = music.url;
                  this.audioPlayer.play();
             } else {
                  UI.showNotification('Spotify', 'Conecte sua conta para ouvir a música completa!', 'info');
             }
        }
        
        const trimmer = document.getElementById('tf-music-trimmer-area');
        if (trimmer) trimmer.style.display = 'block';
        
        const titleEl = document.getElementById('music-title-active');
        if (titleEl) titleEl.textContent = music.title;
    }

    // --- SINGLE MUSIC STICKER LOGIC ---
    addMusicSticker(music) {
        // 1. Find and Remove existing music element
        const oldMusic = this.elements.find(el => el.type === 'music');
        if (oldMusic) {
             const oldDom = document.getElementById(oldMusic.id);
             if (oldDom) oldDom.remove();
             this.elements = this.elements.filter(el => el.id !== oldMusic.id);
        }

        // 2. Add New Music Sticker
        const id = 'el-' + Date.now();
        const html = `
            <div id="${id}" class="tf-story-element tf-story-link-sticker" style="background:#1DB954; color:#fff; display:flex; align-items:center; gap:8px;">
                <i class="bi bi-spotify"></i> 
                <span class="text-ellipsis" style="max-width:150px">${music.title}</span>
                <i class="bi bi-x-circle-fill ml-xs" style="cursor:pointer; opacity:0.8" onclick="storyEditor.removeElement('${id}')"></i>
            </div>
        `;
        document.getElementById('tf-story-editor-preview-area').insertAdjacentHTML('beforeend', html);
        this.elements.push({ id, type: 'music', content: music.title, uri: music.uri });
        this.closeMusicSheet();
    }

    removeElement(id) {
         const dom = document.getElementById(id);
         const elData = this.elements.find(el => el.id === id);
         
         if (dom) dom.remove();
         this.elements = this.elements.filter(el => el.id !== id);
         
         // If we removed the music, stop player
         if (elData && elData.type === 'music') {
              this.audioPlayer.pause();
              this.selectedMusic = null;
              const trimmer = document.getElementById('tf-music-trimmer-area');
              if (trimmer) trimmer.style.display = 'none';
         }
    }

    // --- Media Loading ---
    open() { document.getElementById('tf-story-media-input').click(); }
    close() { 
        this.container.style.display = 'none'; 
        this.audioPlayer.pause();
        this.clear(true); 
    }

    handleMediaSelect(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.bgImage = e.target.result;
            this.container.style.display = 'flex';
            this.renderBackground();
            this.setupCanvas();
        };
        reader.readAsDataURL(file);
    }

    renderBackground() {
        const area = document.getElementById('tf-story-editor-preview-area');
        if (area) area.style.backgroundImage = `url(${this.bgImage})`;
    }

    // --- Text Tool ---
    setFont(fontName, el) {
        this.activeFont = fontName;
        document.querySelectorAll('.tf-font-option').forEach(opt => opt.classList.remove('active'));
        if (el) el.classList.add('active');
        const input = document.getElementById('tf-story-text-input');
        if (input) input.className = fontName;
    }

    setTextColor(color) {
        this.activeColor = color;
        const input = document.getElementById('tf-story-text-input');
        if (input) input.style.color = color;
    }

    addText() {
        const overlay = document.getElementById('tf-story-input-overlay');
        if (overlay) overlay.style.display = 'flex';
        const input = document.getElementById('tf-story-text-input');
        if (input) input.focus();
    }

    confirmText() {
        const text = document.getElementById('tf-story-text-input').value;
        if (!text) { this.closeTextOverlay(); return; }

        const id = 'el-' + Date.now();
        const html = `
            <div id="${id}" class="tf-story-element tf-story-text-element ${this.activeFont}" style="color:${this.activeColor}; position:relative">
                ${text}
                <div class="tf-element-remove-btn" onclick="storyEditor.removeElement('${id}')">×</div>
            </div>
        `;
        document.getElementById('tf-story-editor-preview-area').insertAdjacentHTML('beforeend', html);
        this.elements.push({ id, type: 'text', content: text, color: this.activeColor, font: this.activeFont });
        this.closeTextOverlay();
    }

    closeTextOverlay() {
        const input = document.getElementById('tf-story-text-input');
        if (input) input.value = '';
        const overlay = document.getElementById('tf-story-input-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // --- Stickers & Links ---
    addEmoji(emoji) {
        const id = 'el-' + Date.now();
        const html = `<div id="${id}" class="tf-story-element" style="font-size:70px; position:relative;">
            ${emoji}
            <div class="tf-element-remove-btn" onclick="storyEditor.removeElement('${id}')">×</div>
        </div>`;
        document.getElementById('tf-story-editor-preview-area').insertAdjacentHTML('beforeend', html);
        this.elements.push({ id, type: 'emoji', content: emoji });
        this.closeEmojiPicker();
    }

    addLink() {
        const url = prompt("URL do link:");
        if (!url) return;
        const text = prompt("Nome do link:", "Ver Link");
        const id = 'el-' + Date.now();
        const html = `
            <div id="${id}" class="tf-story-element tf-story-link-sticker" style="background:${this.activeColor}; color: ${this.activeColor === '#ffffff' ? '#000' : '#fff'}; display:flex; align-items:center; gap:5px;">
                <i class="bi bi-link-45deg"></i> <span>${text}</span>
                <i class="bi bi-x-circle-fill ml-xs" style="cursor:pointer; opacity:0.8" onclick="storyEditor.removeElement('${id}')"></i>
            </div>
        `;
        document.getElementById('tf-story-editor-preview-area').insertAdjacentHTML('beforeend', html);
        this.elements.push({ id, type: 'link', content: { url, text } });
    }

    // --- Drawing Tool ---
    setupCanvas() {
        const canvas = document.getElementById('tf-story-drawing-canvas');
        if (canvas) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            this.ctx = canvas.getContext('2d');
        }
    }

    toggleDrawingMode() {
        this.isDrawingMode = !this.isDrawingMode;
        const btn = document.getElementById('btn-draw');
        const colorPalette = document.getElementById('tf-editor-floating-colors');
        const canvas = document.getElementById('tf-story-drawing-canvas');

        if (this.isDrawingMode) {
            if (canvas) canvas.classList.add('active');
            if (btn) btn.style.background = '#fe2c55';
            if (colorPalette) colorPalette.style.display = 'flex';
        } else {
            if (canvas) canvas.classList.remove('active');
            if (btn) btn.style.background = 'none';
            if (colorPalette) colorPalette.style.display = 'none';
        }
    }

    setDrawColor(color) { this.drawColor = color; }

    setupDrawing() {
        const canvas = document.getElementById('tf-story-drawing-canvas');
        if (!canvas) return;

        const start = (e) => { 
            if (!this.isDrawingMode) return;
            this.isDrawing = true;
            this.ctx.beginPath();
            const pos = this.getCanvasPos(e);
            this.ctx.moveTo(pos.x, pos.y);
        };
        const move = (e) => {
            if (!this.isDrawing || !this.isDrawingMode) return;
            const pos = this.getCanvasPos(e);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.strokeStyle = this.drawColor;
            this.ctx.lineWidth = this.drawWidth;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        };
        const end = () => { this.isDrawing = false; };

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        canvas.addEventListener('mouseup', end);
        canvas.addEventListener('touchstart', (e) => { start(e.touches[0]); e.preventDefault(); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { move(e.touches[0]); e.preventDefault(); }, { passive: false });
        canvas.addEventListener('touchend', end);
    }

    getCanvasPos(e) {
        const canvas = document.getElementById('tf-story-drawing-canvas');
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    // --- General Helpers ---
    openMusicSheet() {
        const sheet = document.getElementById('tf-story-music-sheet');
        if (sheet) sheet.classList.add('open');
    }
    closeMusicSheet() { 
        const sheet = document.getElementById('tf-story-music-sheet');
        if (sheet) sheet.classList.remove('open'); 
    }
    openEmojiPicker() { 
        const ep = document.getElementById('tf-story-emoji-picker');
        if (ep) ep.classList.add('open'); 
    }
    closeEmojiPicker() { 
        const ep = document.getElementById('tf-story-emoji-picker');
        if (ep) ep.classList.remove('open'); 
    }
    
    setupInteractivity() {
        interact('.tf-story-element')
            .draggable({
                listeners: {
                    move(event) {
                        const target = event.target;
                        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                        target.style.transform = `translate(${x}px, ${y}px) rotate(${target.getAttribute('data-angle') || 0}deg) scale(${target.getAttribute('data-scale') || 1})`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);
                    }
                }
            })
            .gesturable({
                listeners: {
                    move(event) {
                        const target = event.target;
                        const angle = (parseFloat(target.getAttribute('data-angle')) || 0) + event.da;
                        const scale = (parseFloat(target.getAttribute('data-scale')) || 1) * (1 + event.ds);
                        const x = parseFloat(target.getAttribute('data-x')) || 0;
                        const y = parseFloat(target.getAttribute('data-y')) || 0;
                        target.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scale})`;
                        target.setAttribute('data-angle', angle);
                        target.setAttribute('data-scale', scale);
                    }
                }
            });
    }

    clear(force = false) {
        if (force || confirm("Limpar toda a edição?")) {
            document.querySelectorAll('.tf-story-element').forEach(el => el.remove());
            if (this.ctx) this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
            this.elements = [];
            this.selectedMusic = null;
            this.audioPlayer.pause();
            const trimmer = document.getElementById('tf-music-trimmer-area');
            if (trimmer) trimmer.style.display = 'none';
        }
    }

    async publish() {
        UI.showLoading('Sincronizando Story...');
        this.audioPlayer.pause();
        try {
            const target = document.getElementById('tf-story-editor-preview-area');
            
            // Remove helper elements before snapshot
            document.querySelectorAll('.tf-element-remove-btn').forEach(btn => btn.style.display = 'none');
            
            const canvas = await html2canvas(target, { useCORS: true, allowTaint: true, scale: 2 });
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

            const fileName = `story_${Date.now()}.jpg`;
            const blob = await (await fetch(dataUrl)).blob();
            const { data: up, error: upErr } = await window.supabase.storage.from('posts_media').upload(`${auth.getCurrentUser().id}/${fileName}`, blob);
            if (upErr) throw upErr;

            const { data: { publicUrl } } = window.supabase.storage.from('posts_media').getPublicUrl(`${auth.getCurrentUser().id}/${fileName}`);

            await window.supabase.from('stories').insert({ 
                 user_id: auth.getCurrentUser().id, 
                 media_url: publicUrl,
                 caption: this.selectedMusic ? JSON.stringify({ 
                      music: this.selectedMusic.title, 
                      start: this.musicStartTime 
                 }) : null
            });
            
            UI.hideLoading();
            UI.showNotification('Sucesso!', 'Seu story premium foi publicado! 🔥', 'success');
            
            setTimeout(() => {
                this.close();
                if (window.tfeed) window.tfeed.renderView('home'); 
            }, 500);
        } catch (err) {
            UI.hideLoading();
            UI.showNotification('Erro', 'Falha ao postar story.', 'error');
        }
    }
}

const storyEditor = new TFeedStoryEditor();
window.storyEditor = storyEditor;
