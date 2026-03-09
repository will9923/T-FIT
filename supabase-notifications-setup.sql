-- ============================================
-- TFIT + TFEED: SISTEMA DE NOTIFICAÇÕES PUSH
-- SUPABASE + REALTIME + EDGE FUNCTIONS
-- ============================================

-- 1. TABELA DE TOKENS DE DISPOSITIVOS
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT DEFAULT 'pwa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, token)
);

-- 2. TABELA DE NOTIFICAÇÕES (HISTÓRICO)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- feed_like, feed_comment, new_follower, direct_message, app_reminder, system_alert, challenge_invite
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE LEMBRETES AGENDADOS
CREATE TABLE IF NOT EXISTS public.app_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    message TEXT,
    send_at TIMESTAMP WITH TIME ZONE,
    sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. HABILITAR RLS (ROW LEVEL SECURITY)
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_reminders ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACESSO
-- Device Tokens
CREATE POLICY "Usuários podem gerenciar seus próprios tokens" 
ON public.device_tokens FOR ALL USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Usuários podem ver suas próprias notificações" 
ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem marcar como lidas" 
ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- App Reminders
CREATE POLICY "Usuários veem seus lembretes" 
ON public.app_reminders FOR SELECT USING (auth.uid() = user_id);

-- 6. HABILITAR REALTIME
-- Nota: Se seu Supabase for "FOR ALL TABLES", a tabela notifications ja estara inclusa.
-- Se nao estiver recebendo atualizacoes, verifique o painel do Supabase.

-- 7. FUNÇÃO PARA NOTIFICAÇÕES AUTOMÁTICAS (TRIGGER)
-- Esta função será chamada por triggers em messages, likes, comments e followers
CREATE OR REPLACE FUNCTION public.handle_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
    notif_type TEXT;
    notif_title TEXT;
    notif_message TEXT;
    notif_link TEXT;
    sender_name TEXT;
BEGIN
    -- Obter nome de quem gerou a ação (opcional)
    SELECT name INTO sender_name FROM public.profiles WHERE id = auth.uid();
    IF sender_name IS NULL THEN sender_name := 'Alguém'; END IF;

    -- Lógica baseada na tabela
    IF (TG_TABLE_NAME = 'messages') THEN
        target_user_id := NEW.receiver_id;
        notif_type := 'direct_message';
        notif_title := 'Nova Mensagem';
        notif_message := sender_name || ': ' || LEFT(NEW.text, 50);
        notif_link := '/direct/' || NEW.sender_id;
    
    ELSIF (TG_TABLE_NAME = 'post_likes') THEN
        SELECT user_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
        IF target_user_id = NEW.user_id THEN RETURN NEW; END IF; -- Não notificar a si mesmo
        notif_type := 'feed_like';
        notif_title := 'Nova Curtida';
        notif_message := sender_name || ' curtiu sua publicação.';
        notif_link := '/post/' || NEW.post_id;

    ELSIF (TG_TABLE_NAME = 'post_comments') THEN
        SELECT user_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
        IF target_user_id = NEW.user_id THEN RETURN NEW; END IF;
        notif_type := 'feed_comment';
        notif_title := 'Novo Comentário';
        notif_message := sender_name || ' comentou: ' || LEFT(NEW.text, 50);
        notif_link := '/post/' || NEW.post_id;

    ELSIF (TG_TABLE_NAME = 'follows') THEN -- Nome da tabela de seguidores atualizado
        target_user_id := NEW.following;
        notif_type := 'new_follower';
        notif_title := 'Novo Seguidor';
        notif_message := sender_name || ' começou a seguir você.';
        notif_link := '/profile/' || NEW.follower;
    END IF;

    -- 8. INSERIR NA TABELA DE NOTIFICAÇÕES (Isso disparará o Realtime no Front)
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (target_user_id, notif_type, notif_title, notif_message, notif_link);
        
        -- Opcional: Aqui você chamaria a Edge Function via HTTP se quisesse push imediato
        -- Mas para simplicidade e robustez, usaremos a inserção em notifications para disparar.
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. CRIAÇÃO DOS TRIGGERS
DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();

DROP TRIGGER IF EXISTS on_feed_like ON public.post_likes;
CREATE TRIGGER on_feed_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();

DROP TRIGGER IF EXISTS on_feed_comment ON public.post_comments;
CREATE TRIGGER on_feed_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();

DROP TRIGGER IF EXISTS on_new_follower ON public.follows;
CREATE TRIGGER on_new_follower AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();
