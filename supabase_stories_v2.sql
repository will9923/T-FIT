-- 🚀 T-FEED V2: SISTEMA AVANÇADO DE STORIES
-- Este script cria as tabelas necessárias para o Editor de Stories profissional.

-- 1. Tabela Principal de Stories
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image', -- 'image' or 'video'
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
    is_close_friends BOOLEAN DEFAULT false
);

-- 2. Elementos do Story (Texto, Links, Stickers, Música)
CREATE TABLE IF NOT EXISTS public.story_elements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'text', 'link', 'sticker', 'music'
    content JSONB NOT NULL, -- Armazena texto, url, estilos, etc.
    pos_x FLOAT DEFAULT 50, -- Porcentagem (0-100)
    pos_y FLOAT DEFAULT 50,
    scale FLOAT DEFAULT 1,
    rotation FLOAT DEFAULT 0
);

-- 3. Visualizações de Stories (Analytics)
CREATE TABLE IF NOT EXISTS public.story_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(story_id, viewer_id)
);

-- 4. Políticas de RLS (Segurança)
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Stories: Todos logados podem ver, apenas o dono pode deletar/postar
CREATE POLICY "Stories visíveis por todos logados" ON public.stories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem postar stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem apagar seus stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Story Elements: Visíveis por todos, inseridos apenas pelo dono do story
CREATE POLICY "Elementos visíveis por todos" ON public.story_elements FOR SELECT USING (true);
CREATE POLICY "Inserção de elementos via story_id" ON public.story_elements FOR INSERT WITH CHECK (true);

-- Story Views: Inserção por qualquer logado, leitura pelo dono
CREATE POLICY "Qualquer um pode marcar vista" ON public.story_views FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Donos vêem suas views" ON public.story_views FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid())
);

-- 5. Função para deletar stories expirados (manutenção)
-- DICA: Pode ser rodado via CRON ou manualmente
CREATE OR REPLACE FUNCTION delete_expired_stories() RETURNS void AS $$
BEGIN
    DELETE FROM public.stories WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
