/**
 * TFIT WAZE FITNESS v2.1
 * Sistema Inteligente de Monitoramento de Academias em Tempo Real
 * Implementado por: Antigravity AI
 */

(function () {
    // 1. CONFIGURATIONS
    const MAPBOX_TOKEN = 'pk.eyJ1Ijoid2lsbGNhcmRvc28iLCJhIjoiY21sbGszcWw2MDlkNTNocTBndjdvbnhteCJ9.-cqbPhB7Xir-LpDteY191Q';
    const CHECKIN_RADIUS = 100; // metros
    const RADAR_RADIUS = 5000; // 5km para o radar inicial

    let map;
    let markers = [];
    let userLocation = null;
    let activeCheckin = null;

    // 2. ROUTING
    if (typeof router !== 'undefined') {
        router.addRoute('/student/mapbox', () => renderLayout());
    }

    // 3. MAIN RENDER
    function renderLayout() {
        const user = auth.getCurrentUser();
        const dashboardPath = user?.type === 'personal' ? '/personal/dashboard' : (user?.type === 'admin' ? '/admin/dashboard' : '/student/dashboard');

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="waze-fitness-page">
                <!-- Header -->
                <header class="waze-header">
                    <div class="header-left">
                        <button class="back-btn" onclick="router.navigate('${dashboardPath}')">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <div class="badge-tfit">TFIT</div>
                    </div>
                    <h1>Waze Fitness</h1>
                    <div class="header-right">
                        <div class="notif-bell">
                            <i class="fas fa-bell"></i>
                            <span class="count">2</span>
                        </div>
                    </div>
                </header>

                <!-- Map Container -->
                <div id="waze-map" class="waze-map-container"></div>

                <!-- Floating Controls -->
                <div class="map-controls">
                    <button class="control-btn" onclick="WazeFitness.locateMe()">
                        <i class="fas fa-crosshairs"></i>
                    </button>
                    <button class="control-btn" onclick="WazeFitness.toggleRadar()">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="control-btn accent" onclick="WazeFitness.showAddGym()">
                        <i class="fas fa-plus"></i>
                        <span>Adicionar Academia</span>
                    </button>
                    <button class="control-btn" onclick="WazeFitness.recenterMap()">
                        <i class="fas fa-bullseye"></i>
                    </button>
                </div>

                <!-- Bottom Panels -->
                <div class="waze-panels" id="waze-panels">
                    <div class="panel-handle"></div>
                    
                    <!-- Nearby List -->
                    <div class="panel-section nearby-section" id="nearby-list-container">
                        <h2 class="section-title">Academias perto de você</h2>
                        <div id="nearby-gyms-list" class="gym-list-horizontal">
                            <div class="loading-state">Localizando...</div>
                        </div>
                    </div>

                    <!-- Gym Detail (Hidden by default) -->
                    <div class="panel-section detail-section hidden" id="gym-detail-card">
                        <!-- Content Injected via JS -->
                    </div>
                </div>
            </div>

            <style>
                .waze-fitness-page {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: #0f172a; display: flex; flex-direction: column;
                    color: white; font-family: 'Inter', sans-serif;
                }
                .waze-header {
                    position: absolute; top: 0; left: 0; width: 100%; z-index: 100;
                    padding: 15px 20px; display: flex; align-items: center;
                    justify-content: space-between; background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
                }
                .header-left { display: flex; align-items: center; gap: 15px; }
                .badge-tfit { background: #1e293b; padding: 4px 12px; border-radius: 20px; font-weight: 800; font-size: 12px; border: 1px solid rgba(255,255,255,0.1); }
                .waze-header h1 { font-size: 18px; font-weight: 700; margin: 0; }
                .notif-bell { position: relative; font-size: 20px; }
                .notif-bell .count { position: absolute; top: -5px; right: -5px; background: #dc2626; color: white; font-size: 10px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #0f172a; }

                .waze-map-container { flex: 1; width: 100%; }

                .map-controls { position: absolute; bottom: 310px; right: 20px; display: flex; flex-direction: column; gap: 12px; z-index: 100; }
                .control-btn { width: 54px; height: 54px; border-radius: 50%; background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: all 0.2s; }
                .control-btn:active { transform: scale(0.9); }
                .control-btn.accent { width: 70px; height: 70px; border-radius: 35px; background: rgba(52, 211, 153, 0.1); border: 2px solid #34d399; color: #34d399; }
                .control-btn.accent i { font-size: 20px; margin-bottom: 2px; }
                .control-btn.accent span { font-size: 6px; text-transform: uppercase; text-align: center; line-height: 1; font-weight:800; }

                .waze-panels { 
                    position: absolute; bottom: 0; left: 0; width: 100%; 
                    background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(20px); 
                    border-radius: 30px 30px 0 0; padding: 20px; padding-bottom: calc(20px + env(safe-area-inset-bottom));
                    box-shadow: 0 -10px 40px rgba(0,0,0,0.5); z-index: 200;
                    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .panel-handle { width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin: 0 auto 20px; }
                .section-title { font-size: 14px; font-weight: 500; color: #94a3b8; margin-bottom: 15px; }

                .gym-list-horizontal { display: flex; flex-direction: column; gap: 10px; max-height: 150px; overflow-y: auto; }
                .nearby-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: rgba(255,255,255,0.03); border-radius: 12px; cursor: pointer; }
                .nearby-card .gym-info { display: flex; align-items: center; gap: 10px; }
                .nearby-card .dot { font-size: 10px; }
                .nearby-card .status-text { font-size: 12px; font-weight: 600; color: #cbd5e1; }
                .nearby-card .dist { color: #64748b; font-size: 12px; }

                .gym-detail-header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px; }
                .gym-detail-header h2 { font-size: 20px; font-weight: 800; margin: 0; }
                .gym-detail-header span { color: #94a3b8; font-size: 14px; }
                .gym-addr { font-size: 14px; color: #94a3b8; margin-bottom: 15px; display: flex; gap: 8px; }
                .gym-status-row { display: flex; align-items: center; gap: 10px; margin-bottom: 25px; }
                .occupancy-info { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; }
                .btn-actions { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; }
                .btn-checkin { background: linear-gradient(to right, #2563eb, #1e40af); color: white; border: none; padding: 16px; border-radius: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 14px; filter: drop-shadow(0 4px 10px rgba(37,99,235,0.3)); cursor: pointer; }
                .btn-checkin.active { background: #16a34a; }
                .btn-waze { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 600; cursor: pointer; }
                
                .hidden { display: none !important; }

                /* Markers */
                .gym-marker { 
                    width: 40px; height: 50px; cursor: pointer; 
                    display: flex; align-items: center; justify-content: center;
                    filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));
                }
                .marker-svg { width: 100%; height: 100%; }

                /* Modals */
                .waze-modal { padding: 25px; background: #0f172a; }
                .modal-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px; }
                .tab-btn { background: rgba(255,255,255,0.05); border: none; color: #94a3b8; padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer; }
                .tab-btn.active { background: #3b82f6; color: white; }
                .form-group { margin-bottom: 15px; }
                .form-group label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
                .form-group input { width: 100%; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; color: white; outline: none; }
                .form-group input:focus { border-color: #3b82f6; }
                .btn-save-gym { width: 100%; padding: 16px; margin-top: 20px; }
                .btn-gps-action { background: #1e293b; border: 2px dashed #3b82f6; width: 100%; padding: 30px; border-radius: 16px; color: #3b82f6; font-weight: 700; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; }
                .btn-gps-action:hover { background: rgba(59, 130, 246, 0.1); }

                /* Occupancy Report Card */
                .occupancy-report-card { padding: 10px; text-align: center; }
                .occupancy-options { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 20px; }
                .occ-option { 
                    padding: 20px 10px; border-radius: 16px; border: 2px solid transparent; 
                    cursor: pointer; transition: all 0.2s; display: flex; 
                    flex-direction: column; align-items: center; gap: 8px; 
                    background: rgba(255,255,255,0.03); 
                }
                .occ-option.selected {
                    border-color: var(--primary);
                    background: rgba(99, 102, 241, 0.1);
                    transform: scale(1.05);
                }
                .occ-option i { font-size: 24px; }
                .occ-option span { font-size: 12px; font-weight: 700; }
                
                .occ-option.vazia { color: #10b981; }
                .occ-option.vazia:hover { background: rgba(16, 185, 129, 0.1); border-color: #10b981; }
                
                .occ-option.moderada { color: #f59e0b; }
                .occ-option.moderada:hover { background: rgba(245, 158, 11, 0.1); border-color: #f59e0b; }
                
                .occ-option.lotada { color: #ef4444; }
                .occ-option.lotada:hover { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; }
                
                .occ-skip-btn { margin-top: 25px; color: #94a3b8; font-size: 13px; text-decoration: underline; background: none; border: none; cursor: pointer; }
            </style>
        `;

        initMap();
        loadNearbyAcademias();
        checkActiveCheckin();
    }

    // 4. MAP LOGIC
    async function initMap() {
        if (typeof mapboxgl === 'undefined') return;

        mapboxgl.accessToken = MAPBOX_TOKEN;
        map = new mapboxgl.Map({
            container: 'waze-map',
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-46.6333, -23.5505], // Sao Paulo
            zoom: 13,
            pitch: 60,
            antialias: true
        });

        map.on('load', () => {
            // Add pulse effect layer (Radar)
            addRadarLayer();
            locateMe();
        });

        map.on('click', () => {
            showPanel('list');
        });
    }

    function addRadarLayer() {
        // Simple circle for radar at user location
        // Actually, custom markers with glows work better for "Waze Style"
    }

    async function locateMe() {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(pos => {
            userLocation = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            };
            map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15 });

            // Add Pulse Marker for User
            new mapboxgl.Marker({ color: '#3b82f6', scale: 0.8 }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);

            loadNearbyAcademias();
        }, err => {
            console.error("GPS Error", err);
            UI.showNotification('GPS', 'Ative sua localização para ver as academias.', 'warning');
        });
    }

    // 5. DATA FETCHING
    async function loadNearbyAcademias() {
        try {
            const { data: gyms, error } = await window.supabase.rpc('get_academias_with_occupancy');
            if (error) throw error;

            renderMarkers(gyms);
            renderList(gyms);
            return gyms;
        } catch (e) {
            console.error("Fetch gyms failed", e);
            return [];
        }
    }

    function renderMarkers(gyms) {
        markers.forEach(m => m.remove());
        markers = [];

        gyms.forEach(gym => {
            const el = document.createElement('div');
            el.className = 'gym-marker';

            const color = getLotacaoColor(gym.status_lotacao);
            el.innerHTML = `
                <svg class="marker-svg" viewBox="0 0 40 50">
                    <path d="M20 0C8.95 0 0 8.95 0 20C0 35 20 50 20 50C20 50 40 35 40 20C40 8.95 31.05 0 20 0Z" fill="${color}" />
                    <circle cx="20" cy="18" r="8" fill="rgba(0,0,0,0.2)" />
                    <path d="M20 12V24M16 20H24" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
            `;

            const marker = new mapboxgl.Marker(el)
                .setLngLat([gym.longitude, gym.latitude])
                .addTo(map);

            el.onclick = (e) => {
                e.stopPropagation();
                showGymDetail(gym);
            }
            marker._gymData = gym;
            markers.push(marker);
        });
    }

    function renderList(gyms) {
        const list = document.getElementById('nearby-gyms-list');
        if (!list) return;

        if (gyms.length === 0) {
            list.innerHTML = '<div class="loading-state">Nenhuma academia encontrada próxima.</div>';
            return;
        }

        // Sort by distance if userLocation exists
        if (userLocation) {
            gyms.forEach(g => {
                g.dist = getDistance(userLocation.lat, userLocation.lng, g.latitude, g.longitude);
            });
            gyms.sort((a, b) => a.dist - b.dist);
        }

        list.innerHTML = gyms.map(gym => `
            <div class="nearby-card" onclick="WazeFitness.showGymDetailById('${gym.id}')">
                <div class="gym-info">
                    <span class="dot" style="color: ${getLotacaoColor(gym.status_lotacao)}">●</span>
                    <span class="gym-name">${gym.nome}</span>
                    <span class="status-text" style="color: ${getLotacaoColor(gym.status_lotacao)}">${gym.status_lotacao}</span>
                </div>
                <span class="dist">${gym.dist ? formatDist(gym.dist) : ''}</span>
            </div>
        `).join('');
    }

    // 6. ACTIONS & UI
    async function showGymDetail(gym) {
        activeSelectedGym = gym;
        const panel = document.getElementById('waze-panels');
        const listSec = document.getElementById('nearby-list-container');
        const detailSec = document.getElementById('gym-detail-card');

        if (listSec) listSec.classList.add('hidden');
        if (detailSec) detailSec.classList.remove('hidden');

        const dist = userLocation ? getDistance(userLocation.lat, userLocation.lng, gym.latitude, gym.longitude) : 0;
        const color = getLotacaoColor(gym.status_lotacao);

        detailSec.innerHTML = `
            <div class="gym-detail-header">
                <h2>${gym.nome}</h2>
                <span>${formatDist(dist)}</span>
            </div>
            <div class="gym-addr">
                <i class="fas fa-map-marker-alt"></i>
                <span>${gym.rua}${gym.numero ? ', ' + gym.numero : ''}</span>
            </div>
            
            <div class="gym-status-row">
                <div class="occupancy-info" style="color: ${color}">
                    <span style="font-size: 16px;">●</span>
                    <span>${gym.status_lotacao}</span>
                </div>
                <div class="occupancy-info">
                    <i class="fas fa-users"></i>
                    <span>${gym.pessoas_treinando || 0} alunos agora</span>
                </div>
            </div>

            <div class="btn-actions">
                <button class="btn-checkin ${activeCheckin && activeCheckin.academia_id === gym.id ? 'active' : ''}" 
                        onclick="WazeFitness.toggleCheckin('${gym.id}')" id="main-checkin-btn">
                    <i class="fas ${activeCheckin && activeCheckin.academia_id === gym.id ? 'fa-check' : 'fa-bolt'}"></i>
                    <span>${activeCheckin && activeCheckin.academia_id === gym.id ? 'Finalizar Treino' : 'Estou Treinando Aqui'}</span>
                </button>
                <button class="btn-waze" onclick="WazeFitness.openWaze(${gym.latitude}, ${gym.longitude})">
                    <i class="fab fa-waze"></i>
                    <span>Ir com Waze</span>
                </button>
            </div>
        `;

        map.flyTo({ center: [gym.longitude, gym.latitude], zoom: 17, pitch: 70 });
    }

    function showPanel(type) {
        const listSec = document.getElementById('nearby-list-container');
        const detailSec = document.getElementById('gym-detail-card');
        const btnBack = document.getElementById('btn-back-waze');
        if (btnBack) {
            btnBack.onclick = () => {
                if (listSec) listSec.classList.remove('hidden');
                if (detailSec) detailSec.classList.add('hidden');
            };
        }
        if (type === 'list') {
            if (listSec) listSec.classList.remove('hidden');
            if (detailSec) detailSec.classList.add('hidden');
        }
    }

    // 7. BUSINESS LOGIC (CHECK-IN)
    async function toggleCheckin(gymId) {
        if (activeCheckin && activeCheckin.academia_id === gymId) {
            return finishCheckin();
        }

        const user = auth.getCurrentUser();
        if (!user) return UI.showNotification('Erro', 'Faça login para fazer check-in.', 'error');

        // 1. Distance Check
        if (!userLocation) {
            UI.showNotification('GPS', 'Aguardando localização...', 'info');
            return;
        }

        const gym = markers.find(m => m._lngLat.lng === activeSelectedGym.longitude)._lngLat; // Not the best way, but for proto:
        const dist = getDistance(userLocation.lat, userLocation.lng, activeSelectedGym.latitude, activeSelectedGym.longitude);

        if (dist > CHECKIN_RADIUS) {
            return UI.showNotification('Distância', 'Você precisa estar próximo da academia para fazer check-in.', 'warning');
        }

        UI.showLoading('Fazendo check-in...');
        try {
            const { data, error } = await window.supabase
                .from('checkins')
                .insert([{
                    usuario_id: user.id,
                    academia_id: gymId,
                    status: 'ativo'
                }])
                .select()
                .single();

            if (error) throw error;

            activeCheckin = data;
            localStorage.setItem('active_checkin', JSON.stringify(data));
            UI.showNotification('Sucesso', 'Check-in realizado! Bom treino! 💪', 'success');

            // Auto-checkout handled by SQL but we can set a local timer too

            // Show optional Crowding Report Card
            setTimeout(() => {
                showOccupancyReportCard(data.id);
            }, 800);
        } catch (e) {
            console.error(e);
            UI.showNotification('Erro', 'Falha ao realizar check-in.', 'error');
        } finally {
            UI.hideLoading();
        }
    }

    async function finishCheckin() {
        if (!activeCheckin) return;

        UI.showLoading('Finalizando treino...');
        try {
            const { error } = await window.supabase
                .from('checkins')
                .update({ status: 'finalizado', hora_checkout: new Date().toISOString() })
                .eq('id', activeCheckin.id);

            if (error) throw error;

            activeCheckin = null;
            localStorage.removeItem('active_checkin');
            UI.showNotification('Treino Finalizado', 'Histórico salvo com sucesso! 🏁', 'success');

            const gyms = await loadNearbyAcademias();
            const updatedGym = (gyms || []).find(g => g.id === activeSelectedGym?.id);
            if (updatedGym) showGymDetail(updatedGym);
            else showGymDetail(activeSelectedGym);
        } catch (e) {
            console.error(e);
        } finally {
            UI.hideLoading();
        }
    }

    function showOccupancyReportCard(checkinId) {
        const content = `
            <div class="occupancy-report-card">
                <p class="mb-md">Como está o movimento na academia agora?</p>
                
                <div class="occupancy-options mb-md">
                    <div class="occ-option vazia" onclick="this.parentElement.querySelectorAll('.occ-option').forEach(el=>el.classList.remove('selected')); this.classList.add('selected'); window._selectedOcc = 'VAZIA'">
                        <i class="fas fa-smile"></i>
                        <span>Vazia</span>
                    </div>
                    <div class="occ-option moderada" onclick="this.parentElement.querySelectorAll('.occ-option').forEach(el=>el.classList.remove('selected')); this.classList.add('selected'); window._selectedOcc = 'MODERADA'">
                        <i class="fas fa-meh"></i>
                        <span>Moderada</span>
                    </div>
                    <div class="occ-option lotada" onclick="this.parentElement.querySelectorAll('.occ-option').forEach(el=>el.classList.remove('selected')); this.classList.add('selected'); window._selectedOcc = 'LOTADA'">
                        <i class="fas fa-frown"></i>
                        <span>Lotada</span>
                    </div>
                </div>

                <div class="form-group mb-md">
                    <label class="form-label text-sm">Quantos alunos treinando aprox.?</label>
                    <input type="number" id="qtd-pessoas-report" class="form-input" placeholder="Ex: 12" min="0">
                </div>
                
                <button class="btn btn-primary btn-block" onclick="WazeFitness.saveOccupancyReport('${checkinId}', window._selectedOcc, document.getElementById('qtd-pessoas-report').value)">
                    Enviar Reporte
                </button>
                <button class="occ-skip-btn" onclick="UI.closeModal()">Pular</button>
            </div>
        `;

        UI.showModal('🏠 Movimento Atual', content);
    }

    async function saveOccupancyReport(checkinId, status, qtd) {
        if (!status && !qtd) {
            UI.showNotification('Atenção', 'Selecione uma opção ou informe a quantidade.', 'warning');
            return;
        }

        UI.showLoading('Salvando reporte...');
        try {
            const dataToUpdate = {};
            if (status) dataToUpdate.lotacao_reportada = status;
            if (qtd) dataToUpdate.qtd_pessoas = parseInt(qtd);

            const { error } = await window.supabase
                .from('checkins')
                .update(dataToUpdate)
                .eq('id', checkinId);

            if (error) throw error;

            UI.showNotification('Obrigado!', 'Seu reporte ajuda outros usuários. 💪', 'success');
            UI.closeModal();

            // Refresh to show updated (maybe) status
            loadNearbyAcademias();
        } catch (e) {
            console.error(e);
            UI.showNotification('Erro', 'Não foi possível salvar seu reporte.', 'error');
        } finally {
            UI.hideLoading();
        }
    }

    function checkActiveCheckin() {
        const stored = localStorage.getItem('active_checkin');
        if (stored) {
            activeCheckin = JSON.parse(stored);
            // Check if older than 2 hours
            const start = new Date(activeCheckin.created_at || activeCheckin.hora_checkin);
            if (Date.now() - start.getTime() > 2 * 60 * 60 * 1000) {
                activeCheckin = null;
                localStorage.removeItem('active_checkin');
            }
        }
    }

    // 8. ADD ACADEMIA
    function showAddGym() {
        const content = `
            <div class="waze-modal">
                <div class="modal-tabs">
                    <button class="tab-btn active" id="tab-manual" onclick="WazeFitness.switchAddTab('manual')">ENDEREÇO MANUAL</button>
                    <button class="tab-btn" id="tab-gps" onclick="WazeFitness.switchAddTab('gps')">USAR LOCALIZAÇÃO</button>
                </div>

                <div id="add-manual-content">
                    <div class="form-group">
                        <label>Nome da academia</label>
                        <input type="text" id="add-gym-name" placeholder="Ex: Smart Fit">
                    </div>
                    <div class="form-group">
                        <label>Rua / Avenida</label>
                        <input type="text" id="add-gym-street" placeholder="Rua Vergueiro">
                    </div>
                    <div class="form-group">
                        <label>Número</label>
                        <input type="text" id="add-gym-num" placeholder="1000">
                    </div>
                    <div class="form-group">
                        <label>Cidade</label>
                        <input type="text" id="add-gym-city" placeholder="São Paulo">
                    </div>
                    <button class="btn btn-primary btn-save-gym" onclick="WazeFitness.saveGymManual()">Salvar Academia</button>
                </div>

                <div id="add-gps-content" class="hidden">
                    <div class="form-group">
                        <label>Nome da academia</label>
                        <input type="text" id="add-gym-name-gps" placeholder="Ex: Smart Fit">
                    </div>
                    <button class="btn-gps-action" onclick="WazeFitness.saveGymGPS()">
                        <i class="fas fa-location-dot" style="font-size: 30px;"></i>
                        <span>Usar minha localização agora</span>
                        <small style="font-weight: 400; opacity: 0.7;">Captura coordenadas exatas</small>
                    </button>
                </div>
            </div>
        `;
        UI.showModal('Adicionar Academia', content);
    }

    async function saveGymManual() {
        const nome = document.getElementById('add-gym-name').value.trim();
        const rua = document.getElementById('add-gym-street').value.trim();
        const num = document.getElementById('add-gym-num').value.trim();
        const cidade = document.getElementById('add-gym-city').value.trim();

        if (!nome || !rua) return UI.showNotification('Ops', 'Nome e rua são obrigatórios.', 'warning');

        UI.showLoading('Buscando coordenadas...');
        try {
            // Geocoding via Mapbox
            const query = encodeURIComponent(`${rua} ${num}, ${cidade}`);
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&limit=1`);
            const json = await res.json();

            if (!json.features || json.features.length === 0) throw new Error("Endereço não encontrado.");

            const [lng, lat] = json.features[0].center;

            await finalizeGymSave(nome, rua, num, cidade, lat, lng);
        } catch (e) {
            UI.showNotification('Erro', e.message, 'error');
        } finally {
            UI.hideLoading();
        }
    }

    async function saveGymGPS() {
        const nome = document.getElementById('add-gym-name-gps').value.trim();
        if (!nome) return UI.showNotification('Ops', 'Dê um nome para a academia.', 'warning');

        if (!userLocation) return UI.showNotification('GPS', 'Aguardando localização...', 'info');

        UI.showLoading('Identificando endereço...');
        try {
            // Reverse geocoding
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${userLocation.lng},${userLocation.lat}.json?access_token=${MAPBOX_TOKEN}&types=address`);
            const json = await res.json();

            let rua = 'Rua Desconhecida', num = '', cidade = '';
            if (json.features && json.features[0]) {
                const feat = json.features[0];
                rua = feat.text || '';
                num = feat.address || '';
                cidade = feat.context?.find(c => c.id.includes('place'))?.text || '';
            }

            await finalizeGymSave(nome, rua, num, cidade, userLocation.lat, userLocation.lng);
        } catch (e) {
            console.error(e);
        } finally {
            UI.hideLoading();
        }
    }

    async function finalizeGymSave(nome, rua, num, cidade, lat, lng) {
        // Anti-duplicate Check
        const { data: existing, error: errCheck } = await window.supabase
            .from('academias')
            .select('*')
            .ilike('nome', nome)
            .ilike('rua', rua)
            .eq('numero', num);

        if (existing && existing.length > 0) {
            UI.closeModal();
            UI.confirmDialog('Academia Existente', `A ${nome} já está cadastrada neste endereço no TFIT.`, () => {
                showGymDetail(existing[0]);
            }, 'Abrir academia existente', null, 'Fechar');
            return;
        }

        const user = auth.getCurrentUser();
        const { error } = await window.supabase
            .from('academias')
            .insert([{
                nome, rua, numero: num, cidade, latitude: lat, longitude: lng, criado_por: user?.id
            }]);

        if (error) throw error;

        UI.showNotification('Sucesso', 'Academia cadastrada!', 'success');
        UI.closeModal();
        loadNearbyAcademias();
    }

    // 9. HELPERS
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // in metres
    }

    function formatDist(m) {
        if (m < 1000) return `${Math.round(m)}m`;
        return `${(m / 1000).toFixed(1)}km`;
    }

    function getLotacaoColor(status) {
        if (status === 'VAZIA') return '#10b981'; // Verde
        if (status === 'NORMAL' || status === 'MODERADA') return '#f59e0b'; // Amarelo
        return '#ef4444'; // Vermelho
    }

    // 10. ADVANCED FEATURES
    function startAdvancedTracking() {
        setInterval(() => {
            if (!userLocation || activeCheckin) return;

            // Search for very close gyms (< 80m)
            markers.forEach(m => {
                const lngLat = m.getLngLat();
                const dist = getDistance(userLocation.lat, userLocation.lng, lngLat.lat, lngLat.lng);

                if (dist < 80) {
                    showArrivalPopup(m._gymData);
                }
            });
        }, 60000); // Check every minute
    }

    function showArrivalPopup(gym) {
        if (window._arrivalShown === gym.id) return;
        window._arrivalShown = gym.id;

        UI.confirmDialog(
            `Você chegou na ${gym.nome}?`,
            `Detectamos que você está na academia. Deseja iniciar seu treino no TFIT?`,
            () => {
                showGymDetail(gym);
                toggleCheckin(gym.id);
            },
            'Fazer Check-in',
            null,
            'Agora não'
        );
    }

    function getPrevisaoMovimento() {
        // Simulação baseada no horário atual
        const hour = new Date().getHours();
        if (hour >= 17 && hour <= 20) return { label: 'Horário de Pico', color: '#ef4444', icon: '🔴' };
        if (hour >= 11 && hour <= 14) return { label: 'Movimento Médio', color: '#f59e0b', icon: '🟡' };
        return { label: 'Tranquilo', color: '#10b981', icon: '🟢' };
    }

    // Expose Globaly
    window.WazeFitness = {
        locateMe,
        showAddGym,
        switchAddTab(type) {
            document.getElementById('tab-manual').classList.toggle('active', type === 'manual');
            document.getElementById('tab-gps').classList.toggle('active', type === 'gps');
            document.getElementById('add-manual-content').classList.toggle('hidden', type !== 'manual');
            document.getElementById('add-gps-content').classList.toggle('hidden', type !== 'gps');
        },
        saveGymManual,
        saveGymGPS,
        showGymDetailById(id) {
            fetchGymById(id);
        },
        toggleCheckin,
        saveOccupancyReport,
        openWaze(lat, lng) {
            window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
        },
        recenterMap() {
            if (userLocation) map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15 });
        },
        toggleRadar() {
            UI.showNotification('Radar', 'Buscando academias em um raio de 5km...', 'info');
            loadNearbyAcademias();
        }
    };

    async function fetchGymById(id) {
        UI.showLoading();
        const { data, error } = await window.supabase.rpc('get_academias_with_occupancy');
        UI.hideLoading();
        const gym = (data || []).find(g => g.id === id);
        if (gym) showGymDetail(gym);
    }

    startAdvancedTracking();
})();
