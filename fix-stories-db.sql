-- ############################################
-- REPARO STORIES: TABELAS E COLUNAS (v11.0)
-- Objetivo: Sincronizar stories com o que o t-feed.js envia e corrigir layout
-- ############################################

-- 1. ADICIONAR COLUNAS DE REDUNDÂNCIA NO STORIES
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='user_name') THEN
        ALTER TABLE public.stories ADD COLUMN user_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='user_avatar') THEN
        ALTER TABLE public.stories ADD COLUMN user_avatar TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='user_type') THEN
        ALTER TABLE public.stories ADD COLUMN user_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='type') THEN
        ALTER TABLE public.stories ADD COLUMN type TEXT DEFAULT 'image';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='viewed_by') THEN
        ALTER TABLE public.stories ADD COLUMN viewed_by JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. GARANTIR RLS PARA STORIES
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stories visible by everyone" ON public.stories;
CREATE POLICY "Stories visible by everyone" ON public.stories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own stories" ON public.stories;
CREATE POLICY "Users can insert their own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their stories" ON public.stories;
CREATE POLICY "Users can update their stories" ON public.stories FOR UPDATE USING (true); -- Permitir atualizar viewed_by por qualquer um (simplificado)

-- 3. STORAGE BUCKET
-- Certifique-se de que o bucket 'stories_media' existe com acesso público.
-- GRANT ALL ON TABLE public.stories TO authenticated, anon;

SELECT '✅ Tabelas de Stories sincronizadas com sucesso!' as feedback;
