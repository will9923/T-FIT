-- ============================================
-- TFIT: SISTEMA DE MONITORAMENTO E REPORTES
-- ============================================

-- 1. Tabela para Reportes Manuais
CREATE TABLE IF NOT EXISTS public.app_reportes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    nome_usuario TEXT,
    tipo_usuario TEXT, -- 'student', 'personal', 'admin'
    tipo_problema TEXT, -- 'Erro na tela', 'Pagamento', 'Bug no sistema', 'Lentidão', 'Outro'
    descricao TEXT,
    imagem_url TEXT,
    versao_app TEXT,
    dispositivo TEXT,
    sistema_operacional TEXT,
    navegador TEXT,
    resolucao_tela TEXT,
    tela_erro TEXT,
    status TEXT DEFAULT 'pendente', -- 'pendente', 'resolvido'
    data_envio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    data_resolucao TIMESTAMP WITH TIME ZONE
);

-- 2. Tabela para Logs Automáticos de Erro
CREATE TABLE IF NOT EXISTS public.app_logs_erros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tipo_usuario TEXT,
    tipo_erro TEXT, -- 'JS', 'API', 'Render', 'Database', etc.
    tela TEXT,
    funcao_afetada TEXT,
    mensagem_erro TEXT,
    codigo_erro TEXT,
    versao_app TEXT,
    dispositivo TEXT,
    sistema_operacional TEXT,
    navegador TEXT,
    resolucao_tela TEXT,
    gravidade TEXT DEFAULT 'baixo', -- 'baixo', 'médio', 'crítico'
    status TEXT DEFAULT 'novo',
    data_erro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela para Sessões (Replay/Logs de Navegação)
CREATE TABLE IF NOT EXISTS public.app_session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tipo_usuario TEXT,
    erro_id UUID, -- Link para app_logs_erros ou app_reportes (opcional)
    session_data JSONB, -- Histórico de ações (últimos 30-60s)
    tela_erro TEXT,
    dispositivo TEXT,
    sistema_operacional TEXT,
    versao_app TEXT,
    data_registro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. HABILITAR RLS (ROW LEVEL SECURITY)
ALTER TABLE public.app_reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs_erros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_session_logs ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACESSO
-- Permissões para usuários autenticados (Criar logs/reportes)
DROP POLICY IF EXISTS "Anyone can insert reports" ON public.app_reportes;
CREATE POLICY "Anyone can insert reports" ON public.app_reportes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.app_logs_erros;
CREATE POLICY "Anyone can insert error logs" ON public.app_logs_erros FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert session logs" ON public.app_session_logs;
CREATE POLICY "Anyone can insert session logs" ON public.app_session_logs FOR INSERT WITH CHECK (true);

-- Permissões para Admins (Ver tudo e resolver)
DROP POLICY IF EXISTS "Admins can manage all reports" ON public.app_reportes;
CREATE POLICY "Admins can manage all reports" ON public.app_reportes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can manage all error logs" ON public.app_logs_erros;
CREATE POLICY "Admins can manage all error logs" ON public.app_logs_erros FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can manage all session logs" ON public.app_session_logs;
CREATE POLICY "Admins can manage all session logs" ON public.app_session_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Permissões para usuários verem seus próprios reportes
DROP POLICY IF EXISTS "Users can view own reports" ON public.app_reportes;
CREATE POLICY "Users can view own reports" ON public.app_reportes FOR SELECT USING (auth.uid() = user_id);

-- 6. Trigger para Notificação de Resolução
CREATE OR REPLACE FUNCTION public.notify_error_resolved()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status = 'pendente' AND NEW.status = 'resolvido') THEN
        INSERT INTO public.notifications (user_id, type, title, message, link, read, created_at)
        VALUES (
            NEW.user_id, 
            'system_alert',
            'Seu problema foi resolvido', 
            'O problema que você reportou foi analisado e resolvido pela equipe.', 
            '/student/dashboard', -- Ou link para detalhes se implementado
            false,
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_error_resolved ON public.app_reportes;
CREATE TRIGGER tr_notify_error_resolved
AFTER UPDATE ON public.app_reportes
FOR EACH ROW EXECUTE FUNCTION public.notify_error_resolved();
