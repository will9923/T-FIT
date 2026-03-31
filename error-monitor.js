/**
 * TFIT Error Monitoring & Diagnosis System
 * Handles manual reporting and automatic error detection.
 */

const ErrorMonitor = {
    sessionActions: [],
    maxSessionActions: 50,
    startTime: new Date(),
    
    init() {
        console.log("🛠️ Inicializando TFIT Error Monitor...");
        this.setupGlobalHandlers();
        this.setupActionTracker();
        this.checkDeviceSync();
    },

    setupGlobalHandlers() {
        const self = this;
        
        // Oversee window errors
        const originalOnError = window.onerror;
        window.onerror = function (msg, url, line, col, error) {
            // Call previous handler if any
            if (typeof originalOnError === 'function') {
                originalOnError(msg, url, line, col, error);
            }

            // Automated logging for non-noise errors
            if (!msg.includes('Extension') && !msg.includes('ResizeObserver') && !msg.includes('Script error')) {
                self.logAutomatic('JS_ERROR', {
                    message: msg,
                    url: url,
                    line: line,
                    col: col,
                    stack: error ? error.stack : ''
                }, 'Global window.onerror');
            }
            return false;
        };

        // Oversee promise rejections
        window.onunhandledrejection = function (event) {
            self.logAutomatic('PROMISE_REJECTION', {
                reason: event.reason ? (event.reason.message || event.reason) : 'Unknown reason',
                stack: event.reason ? event.reason.stack : ''
            }, 'Global window.onunhandledrejection');
        };

        // Monitor Supabase connection drops
        if (window.supabase) {
            // We can't easily hook into every supabase call without a proxy,
            // but we can monitor connectivity
            window.addEventListener('offline', () => {
                self.logAutomatic('CONNECTION_LOST', { status: 'offline' }, 'Browser Network Event');
            });
        }
    },

    setupActionTracker() {
        const self = this;
        // Track clicks
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            // Security: Don't track if it's a sensitive field
            const id = (target.id || '').toLowerCase();
            if (target.type === 'password' || id.includes('card') || id.includes('cvv') || id.includes('pix')) return;

            const action = {
                type: 'click',
                tag: target.tagName,
                id: target.id,
                class: target.className,
                text: self.sanitize(target.innerText ? target.innerText.substring(0, 30) : ''),
                timestamp: new Date().toISOString(),
                path: window.location.hash || window.location.pathname
            };
            self.addAction(action);
        }, true);

        // Track navigation (hash changes or router hits)
        window.addEventListener('hashchange', () => {
            self.addAction({
                type: 'navigation',
                to: window.location.hash,
                timestamp: new Date().toISOString()
            });
        });
    },

    addAction(action) {
        this.sessionActions.push(action);
        if (this.sessionActions.length > this.maxSessionActions) {
            this.sessionActions.shift();
        }
    },

    sanitize(data) {
        if (!data) return data;
        let str = typeof data === 'string' ? data : JSON.stringify(data);
        
        // Mask passwords, tokens, card numbers
        const pswdRegex = /(password|senha|token|apikey|secret|key)["']?\s*[:=]\s*["']?([^"']+)["']?/gi;
        const cardRegex = /\b(?:\d[ -]*?){13,16}\b/g;
        
        str = str.replace(pswdRegex, (match, p1) => `${p1}: [MASCARADO]`);
        str = str.replace(cardRegex, "****-****-****-****");
        
        try {
            return typeof data === 'string' ? str : JSON.parse(str);
        } catch (e) {
            return str;
        }
    },

    async logAutomatic(type, errorData, context = '') {
        try {
            const user = typeof auth !== 'undefined' ? auth.getCurrentUser() : null;
            const deviceInfo = this.getDeviceInfo();
            
            // Sanitize error data
            const cleanErrorData = this.sanitize(errorData);
            
            const logEntry = {
                user_id: user ? user.id : null,
                tipo_usuario: user ? user.role : 'guest',
                tipo_erro: type,
                tela: window.location.hash || 'dashboard',
                funcao_afetada: context,
                mensagem_erro: this.sanitize(cleanErrorData.message || cleanErrorData.reason || JSON.stringify(cleanErrorData)),
                codigo_erro: cleanErrorData.code || '',
                versao_app: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '7.0',
                dispositivo: deviceInfo.model,
                sistema_operacional: deviceInfo.os,
                navegador: deviceInfo.browser,
                resolucao_tela: `${window.innerWidth}x${window.innerHeight}`,
                gravidade: this.calculateSeverity(type, cleanErrorData),
                status: 'novo'
            };

            console.warn(`[ErrorMonitor] Registrando erro automático: ${type}`, logEntry);
            
            if (window.supabase) {
                const { error } = await window.supabase.from('app_logs_erros').insert(logEntry);
                if (error) console.error("Erro ao salvar log no Supabase:", error);
                
                // If critical, save session too
                if (logEntry.gravidade === 'crítico') {
                    this.saveSessionLogs(null); // Attach to last error automatically if possible
                }
            }
        } catch (e) {
            console.error("Falha fatal no ErrorMonitor.logAutomatic:", e);
        }
    },

    async saveSessionLogs(reportId = null) {
        try {
            const user = typeof auth !== 'undefined' ? auth.getCurrentUser() : null;
            const deviceInfo = this.getDeviceInfo();
            
            const sessionEntry = {
                user_id: user ? user.id : null,
                tipo_usuario: user ? user.role : 'guest',
                erro_id: reportId,
                session_data: this.sessionActions,
                tela_erro: window.location.hash || 'dashboard',
                dispositivo: deviceInfo.model,
                sistema_operacional: deviceInfo.os,
                versao_app: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '7.0'
            };

            if (window.supabase) {
                await window.supabase.from('app_session_logs').insert(sessionEntry);
            }
        } catch (e) {
            console.error("Erro ao salvar session logs:", e);
        }
    },

    async submitManualReport(data) {
        try {
            UI.showLoading('Enviando reporte...');
            const user = typeof auth !== 'undefined' ? auth.getCurrentUser() : null;
            const deviceInfo = this.getDeviceInfo();
            
            let imageUrl = '';
            if (data.imageFile) {
                imageUrl = await this.uploadScreenshot(data.imageFile);
            }

            const reportEntry = {
                user_id: user ? user.id : null,
                nome_usuario: user ? user.name : 'Anônimo',
                tipo_usuario: user ? user.role : 'guest',
                tipo_problema: data.type,
                descricao: data.description,
                imagem_url: imageUrl,
                versao_app: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '7.0',
                dispositivo: deviceInfo.model,
                sistema_operacional: deviceInfo.os,
                navegador: deviceInfo.browser,
                resolucao_tela: `${window.innerWidth}x${window.innerHeight}`,
                tela_erro: window.location.hash || 'dashboard',
                status: 'pendente'
            };

            if (window.supabase) {
                const { data: inserted, error } = await window.supabase.from('app_reportes').insert(reportEntry).select();
                if (error) throw error;
                
                // Save session history for this manual report
                if (inserted && inserted[0]) {
                    await this.saveSessionLogs(inserted[0].id);
                }

                UI.hideLoading();
                UI.showNotification('Sucesso', 'Obrigado! Seu reporte foi enviado com sucesso.', 'success');
                UI.closeModal();
            } else {
                throw new Error("Conexão com banco de dados indisponível.");
            }
        } catch (e) {
            console.error("Erro ao enviar reporte manual:", e);
            UI.hideLoading();
            UI.showNotification('Erro', 'Não foi possível enviar o reporte. Tente novamente mais tarde.', 'error');
        }
    },

    async uploadScreenshot(file) {
        try {
            const user = auth.getCurrentUser();
            const fileName = `report_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
            const filePath = `${user ? user.id : 'anonymous'}/${fileName}`;

            const { data, error } = await window.supabase.storage
                .from('error-reports')
                .upload(filePath, file);

            if (error) throw error;

            const { data: urlData } = window.supabase.storage
                .from('error-reports')
                .getPublicUrl(filePath);

            return urlData.publicUrl;
        } catch (e) {
            console.error("Erro no upload do print:", e);
            return '';
        }
    },

    getDeviceInfo() {
        const ua = navigator.userAgent;
        let os = "Web";
        let model = "Desktop";
        let browser = "Chrome";

        if (/Android/i.test(ua)) {
            os = "Android";
            model = "Mobile Device";
        } else if (/iPhone|iPad|iPod/i.test(ua)) {
            os = "iOS";
            model = "Apple Device";
        }

        if (/Chrome/i.test(ua)) browser = "Chrome";
        else if (/Safari/i.test(ua)) browser = "Safari";
        else if (/Firefox/i.test(ua)) browser = "Firefox";
        else if (/Edg/i.test(ua)) browser = "Edge";

        return { os, model, browser };
    },

    calculateSeverity(type, data) {
        const criticalKeywords = ['payment', 'auth', 'database', 'failed to fetch', 'access denied', ' Mercado Pago'];
        const msg = (data.message || '').toLowerCase();
        
        if (type === 'JS_ERROR' && (msg.includes('null') || msg.includes('undefined'))) return 'médio';
        if (criticalKeywords.some(k => msg.includes(k))) return 'crítico';
        if (type === 'CONNECTION_LOST') return 'médio';
        
        return 'baixo';
    },

    checkDeviceSync() {
        // Basic check for UI responsiveness
        let lastTouch = Date.now();
        document.addEventListener('touchstart', () => lastTouch = Date.now());
        
        setInterval(() => {
            // If app is active but no touch for 30s and no animations? 
            // Hard to detect hang, but we can log "Long Inactivity"
        }, 60000);
    },

    // UI Helper for the report Modal
    showReportModal() {
        const content = `
            <div class="report-form p-md">
                <p class="text-muted mb-lg">Descreva o problema para que possamos corrigi-lo o mais rápido possível.</p>
                
                <div class="form-group mb-md">
                    <label class="form-label">Tipo do Problema</label>
                    <select id="report-type" class="form-input">
                        <option value="Erro na tela">Erro na tela</option>
                        <option value="Pagamento">Pagamento</option>
                        <option value="Bug no sistema">Bug no sistema</option>
                        <option value="Lentidão">Lentidão</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>

                <div class="form-group mb-md">
                    <label class="form-label">Descrição detalhada</label>
                    <textarea id="report-description" class="form-input" rows="4" placeholder="O que aconteceu? Como podemos reproduzir o erro?"></textarea>
                </div>

                <div class="form-group mb-xl">
                    <label class="form-label">Anexar Print (Opcional)</label>
                    <div class="flex items-center gap-md">
                        <button class="btn btn-outline btn-sm" onclick="document.getElementById('report-image').click()">
                            <i class="fas fa-camera mr-xs"></i> Selecionar Imagem
                        </button>
                        <span id="file-name-label" class="text-xs text-muted">Nenhum arquivo...</span>
                    </div>
                    <input type="file" id="report-image" hidden accept="image/*" onchange="document.getElementById('file-name-label').innerText = this.files[0].name">
                </div>

                <button class="btn btn-primary btn-block" onclick="ErrorMonitor.handleFormSubmit()">
                    ENVIAR REPORTE 🚀
                </button>
            </div>
        `;

        UI.showModal('Reportar Problema', content);
    },

    handleFormSubmit() {
        const type = document.getElementById('report-type').value;
        const description = document.getElementById('report-description').value;
        const imageFile = document.getElementById('report-image').files[0];

        if (!description) {
            UI.showNotification('Atenção', 'Por favor, descreva o problema.', 'warning');
            return;
        }

        this.submitManualReport({ type, description, imageFile });
    }
};

// UI Extension for the Error Banner
if (typeof UI !== 'undefined') {
    UI.getErrorBannerHTML = () => {
        return `
            <div class="card mb-xl shadow-sm animate-in report-error-banner" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid var(--border); border-left: 5px solid var(--primary); border-radius: 16px; overflow: hidden;">
                <div class="card-body flex justify-between items-center p-lg p-sm-mobile">
                    <div class="flex items-center gap-lg gap-sm-mobile">
                        <div class="banner-icon-bg" style="font-size: 2.2rem; background: rgba(99, 102, 241, 0.1); width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 12px;">🛠️</div>
                        <div>
                            <h3 class="font-bold mb-xs" style="font-size: 1.1rem; color: #1e293b;">Encontrou algum erro no app?</h3>
                            <p class="text-sm text-muted mb-0 banner-desc" style="max-width: 300px;">Como o aplicativo ainda está em fase de testes, nos ajude enviando qualquer erro ou problema que encontrar.</p>
                        </div>
                    </div>
                    <button class="btn btn-primary shadow-glow banner-btn" onclick="ErrorMonitor.showReportModal()" style="border-radius: 12px; padding: 12px 24px; font-weight: 700;">
                        Reportar Problema
                    </button>
                </div>
            </div>
            <style>
                @media (max-width: 600px) {
                    .report-error-banner .card-body { flex-direction: column; text-align: center; gap: 1rem; }
                    .report-error-banner .banner-icon-bg { display: none; }
                    .report-error-banner .banner-btn { width: 100%; }
                    .report-error-banner .banner-desc { max-width: 100%; }
                }
            </style>
        `;
    };
}

// Initialize after a small delay to ensure all modules are ready
setTimeout(() => ErrorMonitor.init(), 2000);
