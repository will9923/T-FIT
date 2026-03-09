-- ============================================
-- TFIT - MÓDULO DE PAGAMENTOS MERCADO PAGO V2
-- ============================================

-- 1. TABELA: configuracoes_pagamento
-- Armazena credenciais do Mercado Pago para Admin e Personals
CREATE TABLE IF NOT EXISTS public.configuracoes_pagamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mp_access_token TEXT NOT NULL, -- Recomenda-se criptografia no lado da aplicação
    mp_public_key TEXT NOT NULL,
    tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('admin', 'personal')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. TABELA: planos (Versão Atualizada)
-- Define os planos disponíveis para Alunos e Personals
CREATE TABLE IF NOT EXISTS public.planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL se for admin
    nome TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    periodicidade TEXT NOT NULL CHECK (periodicidade IN ('mensal', 'anual')),
    publico_alvo TEXT NOT NULL CHECK (publico_alvo IN ('aluno', 'personal')),
    features TEXT[], -- Opcional: lista de benefícios do plano
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA: assinaturas
-- Controla o status das assinaturas e trials
CREATE TABLE IF NOT EXISTS public.assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('ativo', 'pendente', 'cancelado')),
    trial_usado BOOLEAN DEFAULT false,
    data_expiracao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuario ON public.assinaturas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON public.assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_planos_publico ON public.planos(publico_alvo);
CREATE INDEX IF NOT EXISTS idx_config_user ON public.configuracoes_pagamento(user_id);

-- Gatilhos para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_config_modtime ON public.configuracoes_pagamento;
CREATE TRIGGER update_config_modtime BEFORE UPDATE ON public.configuracoes_pagamento FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_planos_modtime ON public.planos;
CREATE TRIGGER update_planos_modtime BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_assinaturas_modtime ON public.assinaturas;
CREATE TRIGGER update_assinaturas_modtime BEFORE UPDATE ON public.assinaturas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
