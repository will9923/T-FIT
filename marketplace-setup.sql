-- TFIT MARKETPLACE - DATABASE SETUP
-- Execute este script no SQL Editor do seu Supabase para criar as tabelas necessárias.

-- 1. Tabela de Planos dos Personais
CREATE TABLE IF NOT EXISTS public.planos_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    duracao_meses INTEGER DEFAULT 1,
    duracao_dias INTEGER GENERATED ALWAYS AS (duracao_meses * 30) STORED,
    limite_alunos INTEGER,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Vínculo Aluno-Personal (Marketplace)
CREATE TABLE IF NOT EXISTS public.alunos_planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    personal_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plano_id UUID REFERENCES public.planos_personal(id) ON DELETE SET NULL,
    data_inicio TIMESTAMPTZ DEFAULT now(),
    data_proxima_cobranca TIMESTAMPTZ,
    status TEXT DEFAULT 'ativo', -- 'ativo', 'pendente', 'cancelado', 'atrasado'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(aluno_id, personal_id)
);

-- 3. Tabela de Histórico de Pagamentos (Marketplace)
CREATE TABLE IF NOT EXISTS public.pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    personal_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    plano_id UUID REFERENCES public.planos_personal(id) ON DELETE SET NULL,
    mercado_pago_id TEXT UNIQUE,
    valor DECIMAL(10,2) NOT NULL,
    taxa_mercado_pago DECIMAL(10,2) DEFAULT 0,
    valor_liquido DECIMAL(10,2) NOT NULL,
    data_pagamento TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'aprovado',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- HABILITAR RLS
ALTER TABLE public.planos_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS - PLANOS_PERSONAL
CREATE POLICY "Anyone can view active personal plans" 
ON public.planos_personal FOR SELECT 
USING (ativo = true);

CREATE POLICY "Personals can manage their own plans" 
ON public.planos_personal FOR ALL 
USING (auth.uid() = personal_id)
WITH CHECK (auth.uid() = personal_id);

-- POLÍTICAS RLS - ALUNOS_PLANOS
CREATE POLICY "Students can see their own hired plans" 
ON public.alunos_planos FOR SELECT 
USING (auth.uid() = aluno_id);

CREATE POLICY "Personals can see their own student relations" 
ON public.alunos_planos FOR SELECT 
USING (auth.uid() = personal_id);

CREATE POLICY "Personals can manage their student relations" 
ON public.alunos_planos FOR ALL 
USING (auth.uid() = personal_id)
WITH CHECK (auth.uid() = personal_id);

-- POLÍTICAS RLS - PAGAMENTOS
CREATE POLICY "Students can see their marketplace receipts" 
ON public.pagamentos FOR SELECT 
USING (auth.uid() = aluno_id);

CREATE POLICY "Personals can see their marketplace sales" 
ON public.pagamentos FOR SELECT 
USING (auth.uid() = personal_id);

-- Configurações Adicionais (Trigger para updated_at)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_planos_personal_updated_at BEFORE UPDATE ON public.planos_personal FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_alunos_planos_updated_at BEFORE UPDATE ON public.alunos_planos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
