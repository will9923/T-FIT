-- ############################################
-- SISTEMA DE CRESCIMENTO T-FIT (REFERRALS & REWARDS)
-- ############################################

-- 1. TABELA DE CONVITES (Track referrals)
CREATE TABLE IF NOT EXISTS public.app_convites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quem_convidou UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    quem_foi_convidado_email TEXT UNIQUE, -- Email for tracking before registration
    quem_foi_convidado_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pendente', -- 'pendente', 'registrado', 'premium_assinado'
    pontos_ganhos INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE RECOMPENSAS (REWARD STORE)
CREATE TABLE IF NOT EXISTS public.tfit_recompensas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    custo_pontos INTEGER NOT NULL,
    tipo TEXT NOT NULL, -- 'desconto', 'item_fisico', 'premium_access'
    imagem_url TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    estoque INTEGER DEFAULT -1, -- -1 for unlimited
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE RESGATES (REDEMPTIONS)
CREATE TABLE IF NOT EXISTS public.tfit_resgates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recompensa_id UUID REFERENCES public.tfit_recompensas(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'realizado', -- 'realizado', 'enviado', 'concluido'
    pontos_gastos INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE MISSÕES DIÁRIAS (DAILY MISSIONS)
CREATE TABLE IF NOT EXISTS public.tfit_missoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    recompensa_pontos INTEGER NOT NULL,
    tipo TEXT NOT NULL, -- 'login', 'treino_concluido', 'post_feed', 'analise_refeicao', 'convidar_amigo'
    meta_quantidade INTEGER DEFAULT 1,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE PROGRESSO DE MISSÕES DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.tfit_missoes_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    missao_id UUID REFERENCES public.tfit_missoes(id) ON DELETE CASCADE,
    progresso INTEGER DEFAULT 0,
    concluido BOOLEAN DEFAULT FALSE,
    data_missao DATE DEFAULT CURRENT_DATE,
    concluido_em TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, missao_id, data_missao)
);

-- 6. ADICIONAR COLUNAS EXTRAS NO PROFILES SE NECESSÁRIO
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='referrer_id') THEN
        ALTER TABLE public.profiles ADD COLUMN referrer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='referral_code') THEN
        ALTER TABLE public.profiles ADD COLUMN referral_code TEXT UNIQUE;
    END IF;
END $$;

-- 7. RLS POLICIES
ALTER TABLE public.app_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tfit_recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tfit_resgates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tfit_missoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tfit_missoes_usuario ENABLE ROW LEVEL SECURITY;

-- Convites
CREATE POLICY "Users can see their sent invitations" ON public.app_convites FOR SELECT USING (auth.uid() = quem_convidou);
CREATE POLICY "Users can create invitations" ON public.app_convites FOR INSERT WITH CHECK (auth.uid() = quem_convidou);

-- Recompensas (All can see)
CREATE POLICY "Anyone can see rewards" ON public.tfit_recompensas FOR SELECT USING (true);

-- Resgates
CREATE POLICY "Users can see their redemptions" ON public.tfit_resgates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create redemptions" ON public.tfit_resgates FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Missões (All can see)
CREATE POLICY "Anyone can see daily missions" ON public.tfit_missoes FOR SELECT USING (true);

-- Progresso de Missões
CREATE POLICY "Users can see their mission progress" ON public.tfit_missoes_usuario FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their mission progress" ON public.tfit_missoes_usuario FOR ALL USING (auth.uid() = user_id);

-- 8. PERMISSÕES
GRANT ALL ON public.app_convites TO authenticated, anon;
GRANT ALL ON public.tfit_recompensas TO authenticated, anon;
GRANT ALL ON public.tfit_resgates TO authenticated, anon;
GRANT ALL ON public.tfit_missoes TO authenticated, anon;
GRANT ALL ON public.tfit_missoes_usuario TO authenticated, anon;

-- Inserir Missões de Exemplo
INSERT INTO public.tfit_missoes (titulo, descricao, recompensa_pontos, tipo) VALUES 
('Login Diário', 'Acesse o app hoje e ganhe pontos', 10, 'login'),
('Superação', 'Finalize o seu treino do dia', 50, 'treino_concluido'),
('Comunidade', 'Faça um post no T-Feed contando sua evolução', 30, 'post_feed'),
('Nutrição Consciente', 'Analise uma refeição com a IA', 20, 'analise_refeicao'),
('Aumente a Squad', 'Convide um amigo para o T-FIT', 100, 'convidar_amigo')
ON CONFLICT DO NOTHING;

-- Inserir Recompensas de Exemplo
INSERT INTO public.tfit_recompensas (nome, descricao, custo_pontos, tipo) VALUES 
('10% OFF Mensalidade', 'Custo reduzido na sua próxima renovação', 500, 'desconto'),
('Cupom Suplementos (Loja Parceira)', 'Desconto de R$ 30,00 canais parceiros', 800, 'desconto'),
('Kit T-FIT (Camiseta + Coqueteleira)', 'Resgate um kit exclusivo em casa', 3000, 'item_fisico'),
('1 Mês de Premium IA Grátis', 'Assinatura AI Full por 30 dias', 1500, 'premium_access')
ON CONFLICT DO NOTHING;
