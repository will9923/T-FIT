-- ============================================
-- SCRIPT DE CORREÇÃO DE PERMISSÕES (RLS) - COMPLETO
-- Execute este script INTEIRO no Supabase SQL Editor
-- Isso resolve TODOS os erros de "não foi possível salvar"
-- ============================================

-- ============================================
-- 1. DESABILITAR RLS EM TODAS AS TABELAS
-- (Modo Demo / MVP - sem autenticação)
-- ============================================
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl.tablename);
        RAISE NOTICE 'RLS desabilitado em: %', tbl.tablename;
    END LOOP;
END $$;

-- ============================================
-- 2. GARANTIR PERMISSÕES DE LEITURA E ESCRITA
-- para o role 'anon' (usado pelo publishable key)
-- e 'authenticated' (usado por usuários logados)
-- ============================================

-- Permissões no schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Permissões em TODAS as tabelas existentes
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- Permissões em TODAS as sequences (auto-increment)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Permissões para tabelas FUTURAS (criadas depois deste script)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- ============================================
-- 3. CRIAR TABELAS FALTANTES (se não existem)
-- ============================================

-- Tabela de configurações de pagamento (Mercado Pago V2)
CREATE TABLE IF NOT EXISTS public.configuracoes_pagamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mp_access_token TEXT NOT NULL DEFAULT '',
    mp_public_key TEXT NOT NULL DEFAULT '',
    tipo_usuario TEXT NOT NULL DEFAULT 'admin' CHECK (tipo_usuario IN ('admin', 'personal')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Desabilitar RLS nas novas tabelas também
ALTER TABLE public.configuracoes_pagamento DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.configuracoes_pagamento TO anon;
GRANT ALL ON public.configuracoes_pagamento TO authenticated;

-- ============================================
-- 4. ADICIONAR COLUNAS DE PAGAMENTO NA TABELA PROFILES
-- (Se já existirem, o IF NOT EXISTS ignora)
-- ============================================
DO $$
BEGIN
    -- Chave PIX
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='pix_key') THEN
        ALTER TABLE public.profiles ADD COLUMN pix_key TEXT DEFAULT '';
    END IF;
    -- Link MP Mensal (Admin)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='mp_mensal_link') THEN
        ALTER TABLE public.profiles ADD COLUMN mp_mensal_link TEXT DEFAULT '';
    END IF;
    -- Link MP Anual/Assinatura (Admin)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='mp_anual_link') THEN
        ALTER TABLE public.profiles ADD COLUMN mp_anual_link TEXT DEFAULT '';
    END IF;
    -- Link MP Monthly (Personal)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='mp_monthly_link') THEN
        ALTER TABLE public.profiles ADD COLUMN mp_monthly_link TEXT DEFAULT '';
    END IF;
    -- Link MP Subscription (Personal)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='mp_subscription_link') THEN
        ALTER TABLE public.profiles ADD COLUMN mp_subscription_link TEXT DEFAULT '';
    END IF;

    RAISE NOTICE 'Colunas de pagamento adicionadas/verificadas em profiles!';
END $$;

-- ============================================
-- 5. VERIFICAR RESULTADO
-- ============================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Habilitado"
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT '✅ PERMISSÕES CORRIGIDAS COM SUCESSO!' as status;
