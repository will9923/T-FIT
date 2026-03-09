-- ############################################
-- REPARO DEFINITIVO: DIRECT MESSAGES (v10.5)
-- Objetivo: Sincronizar Tabelas, Colunas e RLS para o Chat funcionar
-- ############################################

-- 1. REPARAR TABELA conversations
DO $$ 
BEGIN
    -- Garantir que a tabela existe
    CREATE TABLE IF NOT EXISTS public.conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        last_message TEXT,
        last_message_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Campo participants como redundância para performance do RLS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='participants') THEN
        ALTER TABLE public.conversations ADD COLUMN participants UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
END $$;

-- 2. REPARAR TABELA conversation_members
CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY(conversation_id, user_id)
);

-- 3. REPARAR TABELA messages (Sincronizar com t-feed.js)
DO $$ 
BEGIN
    CREATE TABLE IF NOT EXISTS public.messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        media_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Ajustar colunas antigas se existirem (para compatibilidade com t-feed.js)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sender') THEN
        ALTER TABLE public.messages RENAME COLUMN sender TO sender_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='text') THEN
        ALTER TABLE public.messages RENAME COLUMN text TO content;
    END IF;
END $$;

-- 4. POLÍTICAS DE RLS (Sempre verificando a identidade do usuário)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations RLS
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations" ON public.conversations 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members 
            WHERE conversation_id = public.conversations.id 
            AND user_id = auth.uid()
        )
        OR (participants @> ARRAY[auth.uid()])
    );

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations" ON public.conversations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;
CREATE POLICY "Users can update conversations" ON public.conversations FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members 
        WHERE conversation_id = public.conversations.id 
        AND user_id = auth.uid()
    )
);

-- Members RLS
DROP POLICY IF EXISTS "Anyone can join conversation" ON public.conversation_members;
CREATE POLICY "Anyone can join conversation" ON public.conversation_members FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view members" ON public.conversation_members;
CREATE POLICY "Users can view members" ON public.conversation_members FOR SELECT USING (true);

-- Messages RLS
DROP POLICY IF EXISTS "Users can view chat messages" ON public.messages;
CREATE POLICY "Users can view chat messages" ON public.messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members 
        WHERE conversation_id = public.messages.conversation_id 
        AND user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 5. PERMISSÕES
GRANT ALL ON public.conversations TO authenticated, anon;
GRANT ALL ON public.conversation_members TO authenticated, anon;
GRANT ALL ON public.messages TO authenticated, anon;

-- Notificar para recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT '✅ Sistema de Direct (Chat) reparado e sincronizado!' as feedback;
