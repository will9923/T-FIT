const CACHE_NAME = 'tfit-v14.16';
const ASSETS = [
    './',
    './index.html',
    './style.css?v=14.16',
    './app.js?v=14.16',
    './workout-db.js?v=14.16',
    './nutrition-db.js?v=14.16',
    './media-manager.js?v=14.16',
    './auth-manager.js?v=14.16',
    './student-pages.js?v=14.16',
    './admin-pages.js?v=14.16',
    './personal-features.js?v=14.16',
    './t-feed.js?v=14.16',
    './logo.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // 1. Skip core data APIs
    if (url.includes('supabase') || url.includes('googleapis')) {
        return;
    }

    // 2. Cache-First Strategy for Images and Fonts
    if (event.request.destination === 'image' || event.request.destination === 'font') {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                return cached || fetch(event.request).then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                    return response;
                });
            })
        );
        return;
    }

    // 3. Stale-While-Revalidate for Scripts and Styles
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request).then((networkResponse) => {
                const cloned = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                return networkResponse;
            }).catch(() => null);

            return cached || fetched;
        })
    );
});

self.addEventListener('push', function (event) {
    let data = { title: 'T-FIT App', message: 'Você tem uma nova notificação! ✉️', link: '/' };
    if (event.data) {
        try { data = event.data.json(); } catch (e) { data.message = event.data.text(); }
    }
    const options = {
        body: data.message,
        icon: './logo.png',
        badge: './logo.png',
        vibrate: [100, 50, 100],
        data: { link: data.link || '/' },
        actions: [{ action: 'open', title: 'Ver Agora' }]
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const link = event.notification.data.link;
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) { if (client.url.includes('index.html') && 'focus' in client) return client.focus(); }
        if (clients.openWindow) return clients.openWindow(link || './index.html');
    }));
});
