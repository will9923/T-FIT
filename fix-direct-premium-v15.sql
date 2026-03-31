-- =====================================================
-- SISTEMA FINAL T-FEED (REPARO TOTAL v15.0)
-- Garante que todas as colunas existem (mesmo em tabelas já criadas)
-- =====================================================

-- 1. CONVERSAS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_sender_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participants UUID[] DEFAULT ARRAY[]::UUID[];

-- 2. PARTICIPANTES (JOIN TABLE)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. MENSAGENS
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- CORREÇÃO DE CONFLITOS DE VERSÕES ANTERIORES
DO $$ 
BEGIN
    -- 1. Se existir message_type e não existir type, renomeia
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'type') THEN
        ALTER TABLE public.messages RENAME COLUMN message_type TO type;
    END IF;

    -- 2. Se message_type existir e for NOT NULL, remova a restrição (evita erros colaterais)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
        ALTER TABLE public.messages ALTER COLUMN message_type DROP NOT NULL;
    END IF;
    
    -- 3. Garante que type não bloqueie envios
    ALTER TABLE public.messages ALTER COLUMN type DROP NOT NULL;
END $$;

-- 4. CHAMADAS
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'calling';

CREATE TABLE IF NOT EXISTS public.call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.call_participants ADD COLUMN IF NOT EXISTS call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE;
ALTER TABLE public.call_participants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.call_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.call_signals ADD COLUMN IF NOT EXISTS call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE;
ALTER TABLE public.call_signals ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.call_signals ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.call_signals ADD COLUMN IF NOT EXISTS signal_type TEXT;
ALTER TABLE public.call_signals ADD COLUMN IF NOT EXISTS data JSONB;

-- 5. REPARO DE NOTIFICAÇÕES (Garante compatibilidade com Triggers do sistema)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "access_notifications" ON public.notifications;
CREATE POLICY "access_notifications" ON public.notifications FOR ALL USING (true);

-- =====================================================
-- FUNÇÕES DE ALTO NÍVEL (RPC)
-- =====================================================

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

    UPDATE public.conversations
    SET 
        last_message = CASE WHEN p_type = 'text' THEN p_content ELSE '[' || p_type || ']' END,
        last_message_at = NOW(),
        last_message_sender_id = p_sender_id,
        updated_at = NOW()
    WHERE id = p_conv_id;

    UPDATE public.conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = p_conv_id AND user_id != p_sender_id;

    RETURN msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
