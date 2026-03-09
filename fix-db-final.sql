-- ############################################
-- SCRIPT DE REPARO DEFINITIVO: DIRECT E STORIES
-- ############################################

DO $$ 
BEGIN
    -- 1. REPARAR TABELA conversations (Erro do Direct)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='updated_at') THEN
        ALTER TABLE public.conversations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='last_message') THEN
        ALTER TABLE public.conversations ADD COLUMN last_message TEXT;
    END IF;

    -- 2. REPARAR TABELA stories (Erro de Visibilidade)
    -- Garantir que as colunas de autor existam para não quebrar o join
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='user_id') THEN
        ALTER TABLE public.stories ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='expires_at') THEN
        ALTER TABLE public.stories ADD COLUMN expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '24 hours');
    END IF;

    -- 3. CRIAR TABELA conversation_members SE NÃO EXISTIR
    CREATE TABLE IF NOT EXISTS public.conversation_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(conversation_id, user_id)
    );

    -- 4. PERMISSÕES ACELERADAS
    ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.conversation_members DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.stories DISABLE ROW LEVEL SECURITY;

    GRANT ALL ON TABLE public.conversations TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.conversation_members TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.messages TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.stories TO anon, authenticated, service_role;

END $$;

SELECT '✅ Tabelas de Direct e Stories reparadas!' as feedback;
