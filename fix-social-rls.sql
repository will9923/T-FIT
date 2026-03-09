-- ############################################
-- SCRIPT DE REPARO: RLS SOCIAL (v9.0)
-- Objetivo: Liberar acesso para posts, stories e interações
-- ############################################

-- 1. DESABILITAR RLS TEMPORARIAMENTE PARA GARANTIR LIMPEZA
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats DISABLE ROW LEVEL SECURITY;

-- 2. RE-HABILITAR RLS COM POLÍTICAS CORRETAS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS PARA POSTS
DROP POLICY IF EXISTS "Posts visible by everyone" ON public.posts;
CREATE POLICY "Posts visible by everyone" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- 4. POLÍTICAS PARA STORIES
DROP POLICY IF EXISTS "Stories visible by everyone" ON public.stories;
CREATE POLICY "Stories visible by everyone" ON public.stories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own stories" ON public.stories;
CREATE POLICY "Users can insert their own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. POLÍTICAS PARA COMENTÁRIOS
DROP POLICY IF EXISTS "Comments visible by everyone" ON public.comments;
CREATE POLICY "Comments visible by everyone" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
CREATE POLICY "Users can insert their own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. POLÍTICAS PARA MENSAGENS E CONVERSAS
DROP POLICY IF EXISTS "Users can see their conversations" ON public.conversations;
CREATE POLICY "Users can see their conversations" ON public.conversations FOR SELECT USING (auth.uid() = ANY(participants));

DROP POLICY IF EXISTS "Users can see messages in their conversations" ON public.messages;
CREATE POLICY "Users can see messages in their conversations" ON public.messages FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id AND auth.uid() = ANY(participants)
));

DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 7. PERMISSÕES DE TABELA
GRANT ALL ON public.posts TO anon, authenticated, service_role;
GRANT ALL ON public.stories TO anon, authenticated, service_role;
GRANT ALL ON public.comments TO anon, authenticated, service_role;
GRANT ALL ON public.conversations TO anon, authenticated, service_role;
GRANT ALL ON public.messages TO anon, authenticated, service_role;
GRANT ALL ON public.user_stats TO anon, authenticated, service_role;

SELECT '✅ Políticas de RLS Social configuradas com sucesso!' as feedback;
