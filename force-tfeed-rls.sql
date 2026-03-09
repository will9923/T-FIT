-- FORÇA TOTAL no T-Feed e Stories

-- 1. Garante colunas base na tabela stories (para segurança na hora do fetch)
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS user_avatar TEXT;

-- 2. Garante RLS aberto para visualização base de rede social
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Posts
DROP POLICY IF EXISTS "Posts visible to all" ON public.posts;
CREATE POLICY "Posts visible to all" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Stories
DROP POLICY IF EXISTS "Stories visible to all" ON public.stories;
CREATE POLICY "Stories visible to all" ON public.stories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create stories" ON public.stories;
CREATE POLICY "Stories can be created by authed users" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Grant perms
GRANT ALL ON public.posts TO authenticated, anon;
GRANT ALL ON public.stories TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
