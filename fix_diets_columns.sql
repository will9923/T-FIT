-- ############################################
-- SCRIPT DE REPARO: COLUNAS DE DIETA (v9.1)
-- Adiciona colunas nutricionais necessárias à tabela diets
-- ############################################

DO $$ 
BEGIN
    -- 1. ADICIONAR COLUNAS NUTRICIONAIS À TABELA DIETS
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='calories') THEN
        ALTER TABLE public.diets ADD COLUMN calories INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='protein') THEN
        ALTER TABLE public.diets ADD COLUMN protein INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='carbs') THEN
        ALTER TABLE public.diets ADD COLUMN carbs INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='fat') THEN
        ALTER TABLE public.diets ADD COLUMN fat INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='water') THEN
        ALTER TABLE public.diets ADD COLUMN water INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='visual_evaluation') THEN
        ALTER TABLE public.diets ADD COLUMN visual_evaluation TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='rationale') THEN
        ALTER TABLE public.diets ADD COLUMN rationale TEXT;
    END IF;

    -- 2. GARANTIR QUE RLS PERMITA INSERT/UPDATE
    ALTER TABLE public.diets ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can manage their own diets" ON public.diets;
    CREATE POLICY "Users can manage their own diets" ON public.diets
        FOR ALL USING (auth.uid() = student_id OR auth.uid() = personal_id);

    GRANT ALL ON TABLE public.diets TO authenticated, service_role;

END $$;

-- 3. RECARREGAR DB CACHE
NOTIFY pgrst, 'reload schema';

SELECT '✅ Colunas de nutrição adicionadas à tabela diets com sucesso!' as feedback;
