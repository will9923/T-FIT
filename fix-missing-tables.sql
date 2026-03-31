-- ############################################
-- CORREÇÕES DE BANCO DE DADOS (MISSING TABLES & COLUMNS)
-- ############################################

-- 1. Tabela de Configuração de Pontos
-- JS espera: pontos_login, pontos_treino, pontos_indicacao, pontos_compartilhar
CREATE TABLE IF NOT EXISTS public.config_pontos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pontos_login INTEGER DEFAULT 10,
    pontos_treino INTEGER DEFAULT 20,
    pontos_indicacao INTEGER DEFAULT 100,
    pontos_compartilhar INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir pelo menos um registro de configuração
INSERT INTO public.config_pontos (id, pontos_login, pontos_treino, pontos_indicacao, pontos_compartilhar)
VALUES ('00000000-0000-0000-0000-000000000001', 10, 20, 100, 30)
ON CONFLICT (id) DO UPDATE SET
    pontos_login = EXCLUDED.pontos_login,
    pontos_treino = EXCLUDED.pontos_treino,
    pontos_indicacao = EXCLUDED.pontos_indicacao,
    pontos_compartilhar = EXCLUDED.pontos_compartilhar;

-- 2. Gamificação
-- JS espera 'recompensas': nome, descricao, pontos, quantidade, tipo, status, imagem
CREATE TABLE IF NOT EXISTS public.recompensas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    pontos INTEGER NOT NULL DEFAULT 0,
    quantidade INTEGER DEFAULT 0,
    tipo TEXT, -- 'produto', 'desconto', 'benefício'
    status TEXT DEFAULT 'ativo',
    imagem TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- JS espera 'missoes': titulo, descricao, pontos, limite_dia, tipo, status
CREATE TABLE IF NOT EXISTS public.missoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    pontos INTEGER NOT NULL DEFAULT 0,
    limite_dia INTEGER DEFAULT 1,
    tipo TEXT,
    status TEXT DEFAULT 'ativa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- JS espera 'indicacoes': usuario_id, pontos_gerados
CREATE TABLE IF NOT EXISTS public.indicacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.profiles(id),
    pontos_gerados INTEGER DEFAULT 0,
    indicado_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Campos de Assinatura no Profile (Caso ainda não existam)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='assinatura_tfit') THEN
        ALTER TABLE public.profiles ADD COLUMN assinatura_tfit BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='assinatura_personal') THEN
        ALTER TABLE public.profiles ADD COLUMN assinatura_personal BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='t_points') THEN
        ALTER TABLE public.profiles ADD COLUMN t_points INTEGER DEFAULT 0;
    END IF;
END $$;

-- 4. RLS & Permissões
ALTER TABLE public.config_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;

-- Políticas simplificadas para garantir funcionamento (Ajustar conforme necessidade de segurança)
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.config_pontos;
CREATE POLICY "Allow all for authenticated" ON public.config_pontos FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.recompensas;
CREATE POLICY "Allow all for authenticated" ON public.recompensas FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.missoes;
CREATE POLICY "Allow all for authenticated" ON public.missoes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.indicacoes;
CREATE POLICY "Allow all for authenticated" ON public.indicacoes FOR ALL USING (true);

GRANT ALL ON public.config_pontos TO authenticated, anon, service_role;
GRANT ALL ON public.recompensas TO authenticated, anon, service_role;
GRANT ALL ON public.missoes TO authenticated, anon, service_role;
GRANT ALL ON public.indicacoes TO authenticated, anon, service_role;
