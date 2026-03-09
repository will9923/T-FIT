-- ============================================
-- SQL: SISTEMA MARKETPLACE TFIT (PAGAMENTO MENSAL MANUAL)
-- ============================================

-- 1. Tabela personais (se não existir de forma rica ou precisarmos expandir a profiles)
CREATE TABLE IF NOT EXISTS public.personais (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    foto TEXT,
    bio TEXT,
    especialidade TEXT,
    avaliacao NUMERIC(3,1) DEFAULT 5.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.personais ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de Planos do Personal
CREATE TABLE IF NOT EXISTS public.planos_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco NUMERIC(10,2) NOT NULL,
    beneficios JSONB DEFAULT '[]'::jsonb,
    duracao_dias INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.planos_personal ENABLE ROW LEVEL SECURITY;

-- 3. Tabela alunos_planos (Opcional, substitui subscriptions/contracts para este fim)
CREATE TABLE IF NOT EXISTS public.alunos_planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    personal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL, 
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    data_proxima_cobranca TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.alunos_planos ENABLE ROW LEVEL SECURITY;

-- 4. Tabela de Pagamentos (Geral ou Extrato)
CREATE TABLE IF NOT EXISTS public.pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    personal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL,
    mercado_pago_id TEXT UNIQUE NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    taxa_mercado_pago NUMERIC(10,2) DEFAULT 0,
    valor_liquido NUMERIC(10,2) DEFAULT 0,
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pendente', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Security Policies
CREATE POLICY "Public personais visible to all" ON public.personais FOR SELECT USING (true);
CREATE POLICY "Public planos visible to all" ON public.planos_personal FOR SELECT USING (true);
CREATE POLICY "Users view own alunos_planos" ON public.alunos_planos FOR SELECT USING (auth.uid() = aluno_id OR auth.uid() = personal_id);
CREATE POLICY "Users view own pagamentos" ON public.pagamentos FOR SELECT USING (auth.uid() = aluno_id OR auth.uid() = personal_id);
