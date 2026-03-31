-- =====================================================
-- SISTEMA FINAL T-FEED: MENSAGENS E CHAMADAS PREMIUM (v14.0)
-- Adaptado para usar a tabela 'profiles' existente
-- =====================================================

-- 1. CONVERSAS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir que as colunas existem (caso a tabela já existisse de versões anteriores)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_sender_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participants UUID[] DEFAULT ARRAY[]::UUID[];

-- 2. PARTICIPANTES (JOIN TABLE)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- 3. MENSAGENS (ESTRUTURA COMPLETA)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text','audio','image','video','file')),
    content TEXT,
    media_url TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','read')),
    reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CHAMADAS (SISTEMA WEBRTC)
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('audio','video','group')),
    status TEXT DEFAULT 'calling' CHECK (status IN ('calling','active','ended','missed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.call_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    signal_type TEXT,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FUNÇÕES DE ALTO NÍVEL (RPC)
-- =====================================================

-- Criar ou Obter Conversa 1-on-1
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
    found_conv_id UUID;
BEGIN
    SELECT p1.conversation_id INTO found_conv_id
    FROM public.conversation_participants p1
    JOIN public.conversation_participants p2 ON p1.conversation_id = p2.conversation_id
    WHERE p1.user_id = user1_id AND p2.user_id = user2_id
    LIMIT 1;

    IF found_conv_id IS NULL THEN
        INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO found_conv_id;
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (found_conv_id, user1_id), (found_conv_id, user2_id);
    END IF;

    RETURN found_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enviar Mensagem com Atualização Automática de Conversa
CREATE OR REPLACE FUNCTION public.send_premium_message(
    p_conv_id UUID,
    p_sender_id UUID,
    p_type TEXT,
    p_content TEXT,
    p_media_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    msg_id UUID;
BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, type, content, media_url)
    VALUES (p_conv_id, p_sender_id, p_type, p_content, p_media_url)
    RETURNING id INTO msg_id;

    -- Atualizar Resumo da Conversa
    UPDATE public.conversations
    SET 
        last_message = CASE WHEN p_type = 'text' THEN p_content ELSE '[' || p_type || ']' END,
        last_message_at = NOW(),
        last_message_sender_id = p_sender_id,
        updated_at = NOW()
    WHERE id = p_conv_id;

    -- Incrementar Unreads
    UPDATE public.conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = p_conv_id AND user_id != p_sender_id;

    RETURN msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Marcar como Lido
CREATE OR REPLACE FUNCTION public.mark_all_as_read(p_conv_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.conversation_participants
    SET unread_count = 0, last_read_at = NOW()
    WHERE conversation_id = p_conv_id AND user_id = p_user_id;

    UPDATE public.messages
    SET status = 'read'
    WHERE conversation_id = p_conv_id AND sender_id != p_user_id AND status != 'read';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SEGURANÇA E REALTIME
-- =====================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- Políticas Simplificadas para T-Feed
DROP POLICY IF EXISTS "access_conversations" ON public.conversations;
CREATE POLICY "access_conversations" ON public.conversations FOR SELECT USING (true);

DROP POLICY IF EXISTS "access_participants" ON public.conversation_participants;
CREATE POLICY "access_participants" ON public.conversation_participants FOR ALL USING (true);

DROP POLICY IF EXISTS "access_messages" ON public.messages;
CREATE POLICY "access_messages" ON public.messages FOR ALL USING (true);

DROP POLICY IF EXISTS "access_calls" ON public.calls;
CREATE POLICY "access_calls" ON public.calls FOR ALL USING (true);

DROP POLICY IF EXISTS "access_signals" ON public.call_signals;
CREATE POLICY "access_signals" ON public.call_signals FOR ALL USING (true);

-- Realtime (Nota: Se sua publicação já for 'FOR ALL TABLES', as linhas abaixo não são necessárias)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
