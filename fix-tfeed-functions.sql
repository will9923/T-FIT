-- TABELAS PARA O SISTEMA DE CURTIDAS E COMENTÁRIOS DO T-FEED

-- 1. Tabela de Curtidas (Post Likes)
CREATE TABLE IF NOT EXISTS public.post_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(post_id, user_id)
);

-- 2. Tabela de Comentários (Post Comments)
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Performance e Segurança
CREATE POLICY "Qualquer um pode ver curtidas" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode ver comentários" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Usuários autenticados podem curtir" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem remover sua curtida" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Usuários autenticados podem comentar" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Dono do comentário pode excluir" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

-- 5. Funções RPC para Incremento/Decremento Atômico
-- Incrementa Curtidas
CREATE OR REPLACE FUNCTION public.increment_post_likes(post_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET likes = COALESCE(likes, 0) + 1
  WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrementa Curtidas
CREATE OR REPLACE FUNCTION public.decrement_post_likes(post_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET likes = GREATEST(COALESCE(likes, 0) - 1, 0)
  WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Incrementa Comentários
CREATE OR REPLACE FUNCTION public.increment_post_comments(post_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET comments = COALESCE(comments, 0) + 1
  WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
