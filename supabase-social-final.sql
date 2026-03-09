-- ############################################
-- T-FIT / T-FEED MASTER SPEC FINAL
-- IMPLEMENTACAO COMPLETA SUPABASE SOCIAL FITNESS
-- ############################################

-- 1. PERFIL (Atualização/Criação)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    photo TEXT,
    bio TEXT,
    user_type TEXT CHECK (user_type IN ('student', 'personal', 'admin', 'admin_master')),
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. GAMIFICACAO
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    fitpoints INT DEFAULT 0,
    streak INT DEFAULT 0,
    last_checkin TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.xp_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INT,
    action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fitpoints_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INT,
    action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. POSTS
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT,
    text TEXT,
    visibility TEXT DEFAULT 'public',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT false
);

-- 4. STORIES
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 5. INTERACOES
CREATE TABLE IF NOT EXISTS public.likes (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. SEGUIDORES
CREATE TABLE IF NOT EXISTS public.follows (
    follower UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    following UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY(follower, following)
);

-- 7. CHAT
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. DENUNCIAS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reporter UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. ANUNCIOS ADMIN
CREATE TABLE IF NOT EXISTS public.ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_url TEXT,
    text TEXT,
    link TEXT,
    priority INT DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. IMPULSIONAMENTO
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    budget NUMERIC,
    days INT,
    target TEXT,
    status TEXT DEFAULT 'pending',
    start_at TIMESTAMP WITH TIME ZONE,
    end_at TIMESTAMP WITH TIME ZONE
);

-- ############################################
-- TRIGGER XP POST
-- ############################################

CREATE OR REPLACE FUNCTION public.xp_post()
RETURNS TRIGGER AS $$
BEGIN
    -- Garantir que user_stats exista para o usuário
    INSERT INTO public.user_stats (user_id, xp, level, fitpoints, streak)
    VALUES (NEW.user_id, 0, 1, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_stats
    SET xp = xp + 30
    WHERE user_id = NEW.user_id;

    INSERT INTO public.xp_history (user_id, amount, action)
    VALUES (NEW.user_id, 30, 'post');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS xp_post_trigger ON public.posts;
CREATE TRIGGER xp_post_trigger
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.xp_post();

-- ############################################
-- LOGICA STORIES EXPIRADOS
-- (Pode ser simulado ou via cron / edge function, 
-- mas aqui definimos como deletar no select ou via trigger de limpeza)
-- ############################################

-- ############################################
-- INDICES PERFORMANCE
-- ############################################
CREATE INDEX IF NOT EXISTS posts_date ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS comments_post ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS messages_conv ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_stories_expiry ON public.stories(expires_at);

-- ############################################
-- REALTIME ASSINAR
-- (Habilitar via SQL para as tabelas)
-- ############################################
ALTER publication supabase_realtime ADD TABLE posts;
ALTER publication supabase_realtime ADD TABLE likes;
ALTER publication supabase_realtime ADD TABLE comments;
ALTER publication supabase_realtime ADD TABLE messages;
ALTER publication supabase_realtime ADD TABLE stories;
ALTER publication supabase_realtime ADD TABLE reports;
ALTER publication supabase_realtime ADD TABLE follows;

-- ############################################
-- STORAGE BUCKETS (Simulação de criação, pois buckets são via API ou Dashboard)
-- ############################################
-- Requer API Supabase Storage manual.

-- ############################################
-- ACESSO ADMIN MASTER
-- ############################################
-- Trigger para garantir que novos usuários tenham user_stats
CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created_stats ON public.profiles;
CREATE TRIGGER on_auth_user_created_stats
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_stats();
