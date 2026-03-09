(() => {
    // ============================================
    // STUDENT - GYM LOCATOR (Google Maps + Places)
    // ============================================

    let gMap;
    let service;
    let infowindow;
    let userLocation = null;
    let markers = [];

    router.addRoute('/student/map', () => {
        // Check Config
        if (typeof GOOGLE_MAPS_API_KEY === 'undefined' || GOOGLE_MAPS_API_KEY === 'SUA_CHAVE_AQUI') {
            UI.showNotification('Configuração Necessária', 'Chave do Google Maps não configurada. Contate o suporte.', 'warning');
            return router.navigate('/student/dashboard');
        }

        const content = `
        <div class="page flex flex-col h-screen" style="background: var(--bg-body);">
             <!-- Header -->
            <div class="page-header sticky top-0 bg-body z-10 px-md py-sm border-b flex justify-between items-center">
                <div>
                    <h1 class="page-title text-lg mb-0">Academias Próximas 📍</h1>
                    <p class="text-xs text-muted">Encontre um local para treinar</p>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="router.navigate('/student/dashboard')">✕</button>
            </div>

            <!-- Map Container -->
            <div id="google-map-container" style="height: 45vh; width: 100%; background: #1a1a1a;"></div>

            <!-- List Container -->
            <div class="flex-1 overflow-y-auto p-md" style="background: var(--bg-card); border-top-left-radius: 24px; border-top-right-radius: 24px; box-shadow: 0 -8px 24px rgba(0,0,0,0.2); margin-top: -24px; position: relative; z-index: 5; border-top: 1px solid rgba(255,255,255,0.05);">
                <div class="flex justify-center mb-md">
                    <div style="width: 48px; height: 5px; background: var(--border); border-radius: 10px; opacity: 0.5;"></div>
                </div>
                <div class="flex justify-between items-center mb-md">
                    <h3 class="text-md font-bold">Resultados Próximos (8km)</h3>
                    <span id="google-result-count" class="badge badge-primary-soft">0 encontradas</span>
                </div>
                <div id="gym-list" class="flex flex-col gap-md pb-xl">
                    <div class="text-center p-xl text-muted">
                        <div class="spinner mb-md mx-auto"></div>
                        <p>Buscando sua localização...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

        // Render Basic Layout
        document.getElementById('app').innerHTML = content;

        // Load Maps API dynamically if not loaded
        loadGoogleMapsScript();
    });

    function loadGoogleMapsScript() {
        if (window.google && window.google.maps && window.google.maps.places) {
            initGoogleMap();
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGoogleMap`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            UI.showNotification('Erro', 'Falha ao carregar Google Maps API.', 'error');
            document.getElementById('gym-list').innerHTML = '<p class="text-danger text-center">Erro ao carregar mapa.</p>';
        };
        document.body.appendChild(script);
    }

    window.initGoogleMap = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setupMapContext(userLocation);
                },
                (error) => {
                    console.error("Error getting location", error);
                    let msg = "Precisamos da sua localização para encontrar academias.";
                    if (error.code === 1) msg = "Permissão de localização negada.";
                    UI.showNotification('Localização Necessária', msg, 'warning');

                    const fallback = { lat: -23.55052, lng: -46.633309 };
                    setupMapContext(fallback, true);
                }
            );
        } else {
            UI.showNotification('Erro', 'Seu navegador não suporta geolocalização.', 'error');
        }
    };

    function setupMapContext(location, isFallback = false) {
        const mapContainer = document.getElementById("google-map-container");
        if (!mapContainer) return;

        gMap = new google.maps.Map(mapContainer, {
            center: location,
            zoom: 14,
            disableDefaultUI: true,
            styles: [
                { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#ffffff" }] },
                { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "on" }, { "color": "#1a1a1a" }, { "weight": 2 }] },
                { "featureType": "landscape", "stylers": [{ "color": "#242424" }] },
                { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
                { "featureType": "road", "stylers": [{ "color": "#333333" }] },
                { "featureType": "water", "stylers": [{ "color": "#111111" }] }
            ]
        });

        if (!isFallback) {
            new google.maps.Marker({
                position: location,
                map: gMap,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#00f2fe",
                    fillOpacity: 1,
                    strokeColor: "white",
                    strokeWeight: 2,
                },
                title: "Você está aqui"
            });
        }

        infowindow = new google.maps.InfoWindow();
        performMultiTermSearch(location);
    }

    async function performMultiTermSearch(location) {
        const terms = ['academia', 'gym', 'fitness', 'crossfit', 'pilates'];
        const listContainer = document.getElementById('gym-list');
        const countBadge = document.getElementById('google-result-count');
        const allPlaces = [];

        service = new google.maps.places.PlacesService(gMap);

        const searchPromises = terms.map(term => {
            return new Promise((resolve) => {
                service.nearbySearch({
                    location: location,
                    radius: '8000', // 8km
                    keyword: term
                }, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        resolve(results);
                    } else {
                        resolve([]);
                    }
                });
            });
        });

        const resultsArrays = await Promise.all(searchPromises);
        resultsArrays.forEach(results => allPlaces.push(...results));

        // Deduplicate by place_id
        const seen = new Set();
        const uniquePlaces = allPlaces.filter(p => {
            if (seen.has(p.place_id)) return false;
            seen.add(p.place_id);
            return true;
        });

        if (uniquePlaces.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center p-xl text-muted">
                    <p>Nenhuma academia encontrada num raio de 8km.</p>
                </div>
            `;
            countBadge.innerText = '0 encontradas';
            return;
        }

        // Sort by distance (simplified distance from user loc)
        uniquePlaces.sort((a, b) => {
            const distA = getFlatDistance(location, a.geometry.location.toJSON());
            const distB = getFlatDistance(location, b.geometry.location.toJSON());
            return distA - distB;
        });

        renderGymResults(uniquePlaces.slice(0, 20), location);
        countBadge.innerText = `${uniquePlaces.length > 20 ? '20+' : uniquePlaces.length} encontradas`;
    }

    function getFlatDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lng - p1.lng, 2));
    }

    function renderGymResults(places, userLoc) {
        const listContainer = document.getElementById('gym-list');
        listContainer.innerHTML = '';

        places.forEach((place) => {
            createMarker(place);

            let photoUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=200&auto=format&fit=crop';
            if (place.photos && place.photos.length > 0) {
                photoUrl = place.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 });
            }

            const ratingHtml = place.rating
                ? `<span class="text-warning font-bold">★ ${place.rating}</span> <span class="text-xs text-muted">(${place.user_ratings_total})</span>`
                : `<span class="text-xs text-muted">Sem avaliações</span>`;

            const isOpen = place.opening_hours?.open_now ? '<span class="text-success text-xs font-bold">Aberto agora</span>' : '';

            const card = document.createElement('div');
            card.className = "card p-sm flex gap-md hover-scale";
            card.style.background = "rgba(255,255,255,0.03)";
            card.style.border = "1px solid rgba(255,255,255,0.05)";

            card.onclick = () => {
                gMap.panTo(place.geometry.location);
                gMap.setZoom(17);
                // Trigger marker click to show info window
                google.maps.event.trigger(markers[place.place_id], 'click');
            };

            card.innerHTML = `
                <div style="width: 85px; height: 85px; flex-shrink: 0; border-radius: 12px; overflow: hidden; background: #222;">
                    <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.9;">
                </div>
                <div class="flex-1 flex flex-col justify-between py-xs">
                    <div>
                         <h4 class="mb-xs text-sm font-bold line-clamp-1">${place.name}</h4>
                         <p class="text-xs text-muted line-clamp-1 mb-xs">${place.vicinity}</p>
                         <div class="flex items-center gap-xs">
                            ${ratingHtml}
                         </div>
                    </div>
                    <div class="flex justify-between items-end mt-xs">
                        ${isOpen}
                        <button class="btn btn-xs btn-primary-soft" onclick="event.stopPropagation(); window.open('https://www.google.com/maps/dir/?api=1&destination_place_id=${place.place_id}', '_blank')">
                            Ver Rota ➔
                        </button>
                    </div>
                </div>
            `;

            listContainer.appendChild(card);
        });
    }

    function createMarker(place) {
        if (!place.geometry || !place.geometry.location) return;

        const marker = new google.maps.Marker({
            map: gMap,
            position: place.geometry.location,
            title: place.name,
            animation: google.maps.Animation.DROP,
            icon: {
                url: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png',
                scaledSize: new google.maps.Size(35, 35)
            }
        });

        markers[place.place_id] = marker;

        google.maps.event.addListener(marker, "click", () => {
            const content = `
                <div style="padding: 10px; color: #333; min-width: 180px;">
                    <strong style="display: block; font-size: 14px; margin-bottom: 5px;">${place.name}</strong>
                    <p style="margin: 0; font-size: 12px; color: #666;">${place.vicinity}</p>
                    <div style="margin-top: 5px; font-weight: bold; color: #f39c12;">⭐ ${place.rating || 'N/A'}</div>
                </div>
            `;
            infowindow.setContent(content);
            infowindow.open(gMap, marker);
        });
    }

})();
