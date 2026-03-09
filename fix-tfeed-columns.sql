-- ############################################
-- SCRIPT DE REPARO: T-FEED (v8.2)
-- Compatibilidade de colunas Social e Core
-- ############################################

DO $$ 
BEGIN
    -- 1. REPARAR TABELA profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='photo') THEN
        ALTER TABLE public.profiles ADD COLUMN photo TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_type') THEN
        ALTER TABLE public.profiles ADD COLUMN user_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='verified') THEN
        ALTER TABLE public.profiles ADD COLUMN verified BOOLEAN DEFAULT false;
    END IF;

    -- Sincronizar dados existentes
    UPDATE public.profiles SET photo = photo_url WHERE photo IS NULL AND photo_url IS NOT NULL;
    UPDATE public.profiles SET user_type = role WHERE user_type IS NULL AND role IS NOT NULL;

    -- 2. REPARAR TABELA posts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='text') THEN
        ALTER TABLE public.posts ADD COLUMN text TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='deleted') THEN
        ALTER TABLE public.posts ADD COLUMN deleted BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='visibility') THEN
        ALTER TABLE public.posts ADD COLUMN visibility TEXT DEFAULT 'public';
    END IF;

    -- Sincronizar content -> text se necessário
    UPDATE public.posts SET text = content WHERE text IS NULL AND content IS NOT NULL;

    -- 3. REPARAR TABELA stories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='text') THEN
        ALTER TABLE public.stories ADD COLUMN text TEXT;
    END IF;

END $$;

-- Garantir que as tabelas estão na publicação realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'posts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE posts;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'stories') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE stories;
    END IF;
EXCEPTION WHEN OTHERS THEN 
    -- Se a publicação não existir, ignore ou crie
END $$;

SELECT '✅ Colunas do T-Feed sincronizadas com sucesso!' as feedback;
