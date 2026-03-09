-- TFIT MARKETPLACE - DEFINITIVE CLEANUP & SETUP
-- Este script remove tabelas conflitantes e cria a estrutura final.

-- 1. REMOVER TABELAS LEGADAS/CONFLITANTES
-- Removemos personais (se for tabela separada), e limpamos as novas para garantir integridade.
DROP TABLE IF EXISTS public.personais CASCADE;
DROP TABLE IF EXISTS public.pagamentos CASCADE;
DROP TABLE IF EXISTS public.alunos_planos CASCADE;
DROP TABLE IF EXISTS public.planos_personal CASCADE;

-- 2. CRIAR TABELA DEFINITIVA: planos_personal
CREATE TABLE public.planos_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL,
    beneficios JSONB DEFAULT '[]'::jsonb,
    duracao_meses INTEGER DEFAULT 1,
    duracao_dias INTEGER DEFAULT 30,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CRIAR TABELA DEFINITIVA: alunos_planos (Vínculo Aluno-Personal)
CREATE TABLE public.alunos_planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    personal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plano_id UUID REFERENCES public.planos_personal(id) ON DELETE SET NULL,
    data_inicio TIMESTAMPTZ DEFAULT now(),
    data_proxima_cobranca TIMESTAMPTZ,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(aluno_id, personal_id)
);

-- 4. CRIAR TABELA DEFINITIVA: pagamentos (Histórico Marketplace)
CREATE TABLE public.pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    plano_id UUID REFERENCES public.planos_personal(id) ON DELETE SET NULL,
    mercado_pago_id TEXT UNIQUE,
    valor DECIMAL(10,2) NOT NULL,
    taxa_mercado_pago DECIMAL(10,2) DEFAULT 0,
    valor_liquido DECIMAL(10,2) NOT NULL,
    data_pagamento TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'aprovado',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. SEGURANÇA (RLS)
ALTER TABLE public.planos_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Policies: planos_personal
CREATE POLICY "Public profiles can view plans" ON public.planos_personal FOR SELECT USING (ativo = true);
CREATE POLICY "Personals can manage own plans" ON public.planos_personal FOR ALL USING (auth.uid() = personal_id);

-- Policies: alunos_planos
CREATE POLICY "Users can view own relations" ON public.alunos_planos FOR SELECT USING (auth.uid() = aluno_id OR auth.uid() = personal_id);
CREATE POLICY "Personals can manage relations" ON public.alunos_planos FOR ALL USING (auth.uid() = personal_id);

-- Policies: pagamentos
CREATE POLICY "Users can view own payments" ON public.pagamentos FOR SELECT USING (auth.uid() = aluno_id OR auth.uid() = personal_id);

-- 6. PERMISSÕES PARA MODO DEMO/ANON
GRANT ALL ON public.planos_personal TO anon, authenticated, service_role;
GRANT ALL ON public.alunos_planos TO anon, authenticated, service_role;
GRANT ALL ON public.pagamentos TO anon, authenticated, service_role;
