-- ############################################
-- SCRIPT DE REPARO: RLS SOCIAL & USER STATS (v10.0)
-- Objetivo: Corrigir erro de RLS no user_stats e garantir persistência
-- ############################################

-- 1. CONFIGURAÇÕES DE RLS PARA USER_STATS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User stats visible by everyone" ON public.user_stats;
CREATE POLICY "User stats visible by everyone" ON public.user_stats 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own stats" ON public.user_stats;
CREATE POLICY "Users can update their own stats" ON public.user_stats 
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own stats" ON public.user_stats;
CREATE POLICY "Users can insert their own stats" ON public.user_stats 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. GARANTIR QUE AS FUNÇÕES DE TRIGGER TEM PERMISSÃO TOTAL (SECURITY DEFINER)
-- Isso evita erros de RLS quando o trigger tenta inserir/atualizar dados do sistema

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PERMISSÕES DE TABELA
GRANT ALL ON public.user_stats TO anon, authenticated, service_role;
GRANT ALL ON public.xp_history TO anon, authenticated, service_role;

-- 4. CORREÇÃO DE STORIES (Garantir que todos possam ver)
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stories visible by everyone" ON public.stories;
CREATE POLICY "Stories visible by everyone" ON public.stories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own stories" ON public.stories;
CREATE POLICY "Users can insert their own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

SELECT '✅ Correções de RLS aplicadas!' as feedback;
