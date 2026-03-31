-- 1. TABELA DE CONVERSAS (1-on-1 ou Grupo)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_sender_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    participants UUID[] DEFAULT ARRAY[]::UUID[]
);

-- 2. TABELA DE MEMBROS (Join Table)
CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY(conversation_id, user_id)
);

-- 3. TABELA DE MENSAGENS
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'audio', 'image', 'video', 'file', 'repost')),
    content TEXT,
    media_url TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
    reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);

-- 5. POLÍTICAS DE RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participantes_ver_conversas" ON public.conversations;
CREATE POLICY "participantes_ver_conversas" ON public.conversations FOR SELECT USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = public.conversations.id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "qualquer_um_criar_conversa" ON public.conversations;
CREATE POLICY "qualquer_um_criar_conversa" ON public.conversations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ver_membros_conversa" ON public.conversation_members;
CREATE POLICY "ver_membros_conversa" ON public.conversation_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "gerenciar_membros" ON public.conversation_members;
CREATE POLICY "gerenciar_membros" ON public.conversation_members FOR ALL USING (true);

DROP POLICY IF EXISTS "ver_messages_conversa" ON public.messages;
CREATE POLICY "ver_messages_conversa" ON public.messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = public.messages.conversation_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "enviar_mensagens" ON public.messages;
CREATE POLICY "enviar_mensagens" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 6. PERMISSÕES
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- 7. TRIGGER: HANDLE NEW MESSAGE
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET 
        last_message = CASE WHEN NEW.type = 'text' THEN NEW.content ELSE '[' || NEW.type || ']' END,
        last_message_at = NEW.created_at,
        last_message_sender_id = NEW.sender_id,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;

    UPDATE public.conversation_members
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_new_message ON public.messages;
CREATE TRIGGER tr_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- 8. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
