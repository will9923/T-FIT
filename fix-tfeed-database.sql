-- Script para corrigir a tabela de posts e interações do T-Feed

-- 1. Adicionar colunas de contagem na tabela de posts caso não existam
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments INT DEFAULT 0;

-- 2. Garantir que as tabelas de interações existam (com nomes consistentes ao código)
CREATE TABLE IF NOT EXISTS public.post_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar Realtime
-- NOTA: Se o seu Supabase estiver configurado como "FOR ALL TABLES", as tabelas acima ja estao inclusas.
-- Se nao estiver recebendo atualizacoes em tempo real, verifique a aba "Realtime" no painel do Supabase.

-- 4. Funções RPC robustas para contagem
CREATE OR REPLACE FUNCTION public.increment_post_likes(post_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET likes = COALESCE(likes, 0) + 1
  WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_post_likes(post_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET likes = GREATEST(COALESCE(likes, 0) - 1, 0)
  WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_post_comments(post_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET comments = COALESCE(comments, 0) + 1
  WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
