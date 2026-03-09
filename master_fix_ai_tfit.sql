-- ############################################
-- SCRIPT DE REPARO MESTRE: TFIT AI PRO (v10.0)
-- Garante que todas as colunas de IA existam nas tabelas corretas
-- ############################################

DO $$ 
BEGIN
    -- 1. REPARO DA TABELA: 'workouts'
    -- Adicionando colunas de IA e Metadados
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='duration') THEN
        ALTER TABLE public.workouts ADD COLUMN duration INTEGER DEFAULT 60;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='rationale') THEN
        ALTER TABLE public.workouts ADD COLUMN rationale TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='student_name') THEN
        ALTER TABLE public.workouts ADD COLUMN student_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='personal_name') THEN
        ALTER TABLE public.workouts ADD COLUMN personal_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='muscle_groups') THEN
        ALTER TABLE public.workouts ADD COLUMN muscle_groups JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- 2. REPARO DA TABELA: 'diets'
    -- Adicionando colunas de IA e Macros
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

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='student_name') THEN
        ALTER TABLE public.diets ADD COLUMN student_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='personal_name') THEN
        ALTER TABLE public.diets ADD COLUMN personal_name TEXT;
    END IF;

    -- 3. PERMISSÕES E RLS (Garantir que todos podem escrever nos seus registros)
    ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.diets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can manage own workouts" ON public.workouts;
    CREATE POLICY "Users can manage own workouts" ON public.workouts 
        FOR ALL USING (auth.uid() = student_id OR auth.uid() = personal_id);

    DROP POLICY IF EXISTS "Users can manage own diets" ON public.diets;
    CREATE POLICY "Users can manage own diets" ON public.diets
        FOR ALL USING (auth.uid() = student_id OR auth.uid() = personal_id);

    GRANT ALL ON TABLE public.workouts TO authenticated, service_role;
    GRANT ALL ON TABLE public.diets TO authenticated, service_role;

    -- 4. RECARREGAR O CACHE DO POSTGREST (CRÍTICO)
    NOTIFY pgrst, 'reload schema';

END $$;

SELECT '✅ Sistema TFIT AI PRO reparado com sucesso! Recarregue seu navegador (F5).' as feedback;
