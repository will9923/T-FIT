-- ############################################
-- SISTEMA T-PONTO (POINTS & BOOSTS)
-- ############################################

-- 1. TABELA DE PACOTES DE PONTOS (Gerenciada pelo ADM)
CREATE TABLE IF NOT EXISTS public.t_points_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    points INTEGER NOT NULL,
    price_brl DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);

-- 2. TABELA DE IMPULSIONAMENTOS (BOOSTS)
CREATE TABLE IF NOT EXISTS public.t_boosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL, -- ID do Post ou Story
    item_type TEXT NOT NULL, -- 'post' ou 'story'
    points_spent INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ADICIONAR COLUNA NO PROFILES SE NÃO EXISTIR
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='t_points') THEN
        ALTER TABLE public.profiles ADD COLUMN t_points INTEGER DEFAULT 0;
    END IF;
END $$;

-- 4. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_boosts_item ON public.t_boosts(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_boosts_expiry ON public.t_boosts(expires_at);

-- 5. RLS POLICIES
ALTER TABLE public.t_points_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can see packages" ON public.t_points_packages;
CREATE POLICY "Anyone can see packages" ON public.t_points_packages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can see their boosts" ON public.t_boosts;
CREATE POLICY "Users can see their boosts" ON public.t_boosts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create boosts" ON public.t_boosts;
CREATE POLICY "Users can create boosts" ON public.t_boosts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. PERMISSÕES
GRANT ALL ON public.t_points_packages TO authenticated, anon;
GRANT ALL ON public.t_boosts TO authenticated, anon;

-- Inserir pacotes iniciais de exemplo
INSERT INTO public.t_points_packages (name, points, price_brl) VALUES 
('Pack Básico', 100, 2.00),
('Pack Intermediário', 500, 5.00),
('Pack Premium', 1500, 10.00)
ON CONFLICT DO NOTHING;

SELECT '✅ Sistema T-Ponto inicializado com sucesso!' as feedback;
