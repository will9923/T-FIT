const NativeApp = {
    isNative: () => !!window.Capacitor && window.Capacitor.isNativePlatform(),

    init: async function () {
        if (!this.isNative()) {
            console.log("[Native] Running in Web/PWA mode.");
            return;
        }

        console.log("[Native] Running in Native mode (" + window.Capacitor.getPlatform() + ").");

        await this.setupOneSignal();
        this.setupStatusbar();
        this.setupAppListeners();
    },

    setupOneSignal: async function () {
        try {
            const ONESIGNAL_APP_ID = "f846c4f5-51cb-490f-bd3a-f2299883909d"; // Configurado o ID real do usuário

            if (window.plugins && window.plugins.OneSignal) {
                const OneSignal = window.plugins.OneSignal;
                OneSignal.initialize(ONESIGNAL_APP_ID);

                OneSignal.Notifications.requestPermission(true).then((accepted) => {
                    console.log("[Native] Push notification permission: " + accepted);
                });

                OneSignal.User.getOnesignalId().then(id => {
                    if (id) this.syncNativeToken(id);
                });
            }
        } catch (err) {
            console.error("[Native] Error OneSignal:", err);
        }
    },

    syncNativeToken: async function (token) {
        if (!window.supabase) return;
        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) return;

        await window.supabase.from('device_tokens').upsert({
            user_id: user.id,
            token: token,
            device_type: window.Capacitor.getPlatform(),
            last_seen: new Date().toISOString()
        }, { onConflict: 'user_id, token' });
    },

    // Bridge para Geolocation
    getCurrentPosition: async function () {
        if (this.isNative() && window.Capacitor.Plugins.Geolocation) {
            return await window.Capacitor.Plugins.Geolocation.getCurrentPosition();
        }
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
    },

    // Bridge para Câmera
    takePicture: async function (options = {}) {
        if (this.isNative() && window.Capacitor.Plugins.Camera) {
            try {
                return await window.Capacitor.Plugins.Camera.getPhoto({
                    quality: 90,
                    allowEditing: true,
                    resultType: "uri", // "CameraResultType.Uri"
                    ...options
                });
            } catch (err) {
                console.warn("[Native] Camera cancelled or failed:", err);
                return null;
            }
        }
        alert("Recurso disponível apenas no aplicativo nativo ou via navegador moderno.");
    },

    // Abertura de links externos (importante para evitar Apple/Google rejections)
    openExternal: async function (url) {
        if (this.isNative() && window.Capacitor.Plugins.Browser) {
            await window.Capacitor.Plugins.Browser.open({ url });
        } else {
            window.open(url, '_blank');
        }
    },

    setupStatusbar: async function () {
        if (this.isNative() && window.Capacitor.Plugins.StatusBar) {
            const StatusBar = window.Capacitor.Plugins.StatusBar;
            StatusBar.setBackgroundColor({ color: '#dc2626' });
        }
    },

    setupAppListeners: function () {
        if (this.isNative()) {
            window.Capacitor.Plugins.App.addListener('appUrlOpen', (data) => {
                console.log('App opened with URL:', data.url);
                // Lógica de Deep Link pode ser adicionada aqui
            });
        }
    }
};

// Start initialization
document.addEventListener('DOMContentLoaded', () => {
    NativeApp.init();
});

window.NativeApp = NativeApp;
