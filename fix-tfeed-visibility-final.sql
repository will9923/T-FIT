-- ############################################
-- FIX: T-FEED & STORIES VISIBILITY (FINAL)
-- Objetivo: Garantir que os dados apareçam para os usuários
-- ############################################

-- 1. Garantir que as tabelas essenciais tenham RLS configurado corretamente
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de Leitura Pública (SELECT)
-- Posts: Todos podem ver
DROP POLICY IF EXISTS "Posts visible by everyone" ON public.posts;
CREATE POLICY "Posts visible by everyone" ON public.posts FOR SELECT USING (true);

-- Stories: Todos podem ver (desde que não expirados)
DROP POLICY IF EXISTS "Stories visible by everyone" ON public.stories;
CREATE POLICY "Stories visible by everyone" ON public.stories FOR SELECT USING (expires_at > NOW());

-- Perfis: Todos podem ver dados básicos
DROP POLICY IF EXISTS "Profiles visible by everyone" ON public.profiles;
CREATE POLICY "Profiles visible by everyone" ON public.profiles FOR SELECT USING (true);

-- Anúncios: Todos podem ver
DROP POLICY IF EXISTS "Ads visible by everyone" ON public.ads;
CREATE POLICY "Ads visible by everyone" ON public.ads FOR SELECT USING (active = true);

-- 3. Permissões de Acesso (Grants)
GRANT SELECT ON public.posts TO anon, authenticated;
GRANT SELECT ON public.stories TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.ads TO anon, authenticated;

-- 4. Habilitar Realtime para estas tabelas (caso não esteja)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'stories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
  END IF;
END $$;

SELECT '✅ Visibilidade do T-Feed corrigida no Banco de Dados!' as status;
