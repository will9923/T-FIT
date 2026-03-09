// ============================================
// MEDIA MANAGER - URL to Base64 & Sync
// ============================================
class MediaManager {
    static async urlToBase64(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Erro ao converter URL para Base64:", error, url);
            return null;
        }
    }

    static async syncExerciseMedia() {
        if (typeof window.EXERCISE_VISUALS === 'undefined') {
            console.error("EXERCISE_VISUALS não definido. Certifique-se que student-pages.js está carregado.");
            return;
        }

        UI.showLoading();
        let successCount = 0;
        let total = Object.keys(window.EXERCISE_VISUALS).length;

        console.log(`Iniciando sincronização de ${total} mídias...`);

        for (const [name, url] of Object.entries(window.EXERCISE_VISUALS)) {
            // OPTIMIZATION: If it's a local file, we DON'T need to store it in the heavy DB.
            if (url.includes('assets/')) {
                console.log(`[Media] ${name} já é local. Pulando DB.`);
                successCount++;
                continue;
            }

            console.log(`[Media] Convertendo ${name} para o Banco de Dados...`);
            try {
                const base64 = await this.urlToBase64(url);

                if (base64) {
                    try {
                        db.create('media_assets', {
                            id: name,
                            name: name,
                            url: url,
                            base64: base64
                        });
                        successCount++;
                    } catch (dbError) {
                        if (dbError.name === 'QuotaExceededError' || dbError.code === 22) {
                            console.warn("Limite de armazenamento atingido! Alguns GIFs ficarão apenas locais.");
                            UI.showNotification('Aviso', 'Memória cheia! Alguns arquivos ficarão apenas no disco.', 'warning');
                            break; // Stop syncing to prevent further crashes
                        }
                        console.error("Erro ao salvar no banco:", dbError);
                    }
                }
            } catch (err) {
                console.error(`Erro ao processar ${name}:`, err);
            }
        }

        // Also sync MUSCLE_VISUALS fallbacks
        if (typeof window.MUSCLE_VISUALS !== 'undefined') {
            for (const [group, url] of Object.entries(window.MUSCLE_VISUALS)) {
                const id = `fallback_${group}`;
                const existing = db.getById('media_assets', id);
                if (existing) continue;

                try {
                    const base64 = await this.urlToBase64(url);
                    if (base64) {
                        db.create('media_assets', {
                            id: id,
                            name: group,
                            url: url,
                            base64: base64
                        });
                    }
                } catch (e) {
                    console.warn("Erro/Quota ao salvar fallback:", e);
                }
            }
        }

        UI.hideLoading();
        UI.showNotification('Sincronização Concluída', `${successCount} de ${total} mídias salvas no banco de dados.`, 'success');
    }

    // Alias for compatibility with admin-pages.js
    static async syncExerciseExerciseMedia() {
        return this.syncExerciseMedia();
    }
}

window.MediaManager = MediaManager;
