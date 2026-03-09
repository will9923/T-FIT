-- TFIT MARKETPLACE - FINAL CLEANUP & SETUP
-- Este script limpa tentativas anteriores e cria a estrutura definitiva.

-- 1. LIMPEZA (Se quiser começar do zero, descomente os DROPs abaixo)
-- DROP TABLE IF EXISTS public.pagamentos CASCADE;
-- DROP TABLE IF EXISTS public.alunos_planos CASCADE;
-- DROP TABLE IF EXISTS public.planos_personal CASCADE;

-- 2. GARANTIR ESTRUTURA: planos_personal
CREATE TABLE IF NOT EXISTS public.planos_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- Adicionar colunas caso a tabela já exista sem elas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='planos_personal' AND column_name='descricao') THEN
        ALTER TABLE public.planos_personal ADD COLUMN descricao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='planos_personal' AND column_name='beneficios') THEN
        ALTER TABLE public.planos_personal ADD COLUMN beneficios JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 3. GARANTIR ESTRUTURA: alunos_planos (Vínculo)
CREATE TABLE IF NOT EXISTS public.alunos_planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    personal_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    plano_id UUID REFERENCES public.planos_personal(id) ON DELETE SET NULL,
    data_inicio TIMESTAMPTZ DEFAULT now(),
    data_proxima_cobranca TIMESTAMPTZ,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(aluno_id, personal_id)
);

-- 4. GARANTIR ESTRUTURA: pagamentos (Transações Marketplace)
CREATE TABLE IF NOT EXISTS public.pagamentos (
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

-- Limpar policies antigas para evitar duplicados
DROP POLICY IF EXISTS "Public plans visible to all" ON public.planos_personal;
DROP POLICY IF EXISTS "Anyone can view active personal plans" ON public.planos_personal;
DROP POLICY IF EXISTS "Personals can manage their own plans" ON public.planos_personal;

CREATE POLICY "Anyone can view active personal plans" 
ON public.planos_personal FOR SELECT 
USING (ativo = true);

CREATE POLICY "Personals can manage their own plans" 
ON public.planos_personal FOR ALL 
USING (auth.uid() = personal_id)
WITH CHECK (auth.uid() = personal_id);

-- Alunos Planos Policies
DROP POLICY IF EXISTS "Students can see their own hired plans" ON public.alunos_planos;
DROP POLICY IF EXISTS "Personals can see their own student relations" ON public.alunos_planos;
DROP POLICY IF EXISTS "Personals can manage their student relations" ON public.alunos_planos;

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

-- Pagamentos Policies
DROP POLICY IF EXISTS "Students can see their marketplace receipts" ON public.pagamentos;
DROP POLICY IF EXISTS "Personals can see their marketplace sales" ON public.pagamentos;

CREATE POLICY "Students can see their marketplace receipts" 
ON public.pagamentos FOR SELECT 
USING (auth.uid() = aluno_id);

CREATE POLICY "Personals can see their marketplace sales" 
ON public.pagamentos FOR SELECT 
USING (auth.uid() = personal_id);

-- 6. PERMISSÕES GERAIS (Para garantir funcionamento em modo Demo/Anon)
GRANT ALL ON public.planos_personal TO anon, authenticated, service_role;
GRANT ALL ON public.alunos_planos TO anon, authenticated, service_role;
GRANT ALL ON public.pagamentos TO anon, authenticated, service_role;
