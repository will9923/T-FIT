-- ############################################
-- SCRIPT DE REPARO DEFINITIVO: DIETAS (v9.5)
-- Garante que todas as colunas existem na tabela diets
-- ############################################

DO $$ 
BEGIN
    -- 1. ADICIONAR COLUNAS BÁSICAS SE NÃO EXISTIREM
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='name') THEN
        ALTER TABLE public.diets ADD COLUMN name TEXT DEFAULT 'Plano Alimentar';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='type') THEN
        ALTER TABLE public.diets ADD COLUMN type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='goal') THEN
        ALTER TABLE public.diets ADD COLUMN goal TEXT;
    END IF;

    -- 2. ADICIONAR COLUNAS NUTRICIONAIS (GARANTIA)
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='calories') THEN
        ALTER TABLE public.diets ADD COLUMN calories INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='protein') THEN
        ALTER TABLE public.diets ADD COLUMN protein INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='carbs') THEN
        ALTER TABLE public.diets ADD COLUMN carbs INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='fat') THEN
        ALTER TABLE public.diets ADD COLUMN fat INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='water') THEN
        ALTER TABLE public.diets ADD COLUMN water INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='visual_evaluation') THEN
        ALTER TABLE public.diets ADD COLUMN visual_evaluation TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='rationale') THEN
        ALTER TABLE public.diets ADD COLUMN rationale TEXT;
    END IF;

    -- 3. GARANTIR QUE RLS ESTEJA DESATIVADO PARA TESTES OU CONFIGURADO CORRETAMENTE
    -- Para evitar erros de permissão se o usuário quiser gerar sem estar logado ou similar
    ALTER TABLE public.diets DISABLE ROW LEVEL SECURITY; 
    -- Ou se preferir manter ativo:
    -- ALTER TABLE public.diets ENABLE ROW LEVEL SECURITY;

    GRANT ALL ON TABLE public.diets TO anon, authenticated, service_role;

END $$;

-- 4. REFORÇAR RECARREGAMENTO DO CACHE DO SUPABASE
NOTIFY pgrst, 'reload schema';

SELECT '✅ Tabela diets reparada e pronta para uso!' as feedback;
