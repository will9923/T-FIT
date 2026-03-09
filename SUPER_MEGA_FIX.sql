-- ########################################################
-- SUPER MEGA FIX: WORKOUTS, DIETS & STUDENT METRICS (v11.0)
-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- ########################################################

DO $$ 
BEGIN
    -- 1. REPARAR TABELA DE TREINOS (WORKOUTS)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='rationale') THEN
        ALTER TABLE public.workouts ADD COLUMN rationale TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='duration') THEN
        ALTER TABLE public.workouts ADD COLUMN duration INTEGER DEFAULT 60;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='student_name') THEN
        ALTER TABLE public.workouts ADD COLUMN student_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='personal_name') THEN
        ALTER TABLE public.workouts ADD COLUMN personal_name TEXT;
    END IF;

    -- 2. REPARAR TABELA DE DIETAS (DIETS)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='name') THEN
        ALTER TABLE public.diets ADD COLUMN name TEXT DEFAULT 'Plano Alimentar';
    END IF;
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='student_name') THEN
        ALTER TABLE public.diets ADD COLUMN student_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='personal_name') THEN
        ALTER TABLE public.diets ADD COLUMN personal_name TEXT;
    END IF;

    -- 3. REPARAR PERFIL DO ALUNO (PROFILES)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='weight') THEN
        ALTER TABLE public.profiles ADD COLUMN weight DECIMAL(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='height') THEN
        ALTER TABLE public.profiles ADD COLUMN height DECIMAL(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='age') THEN
        ALTER TABLE public.profiles ADD COLUMN age INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='sex') THEN
        ALTER TABLE public.profiles ADD COLUMN sex TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='goal') THEN
        ALTER TABLE public.profiles ADD COLUMN goal TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='level') THEN
        ALTER TABLE public.profiles ADD COLUMN level TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='sleep') THEN
        ALTER TABLE public.profiles ADD COLUMN sleep TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stress') THEN
        ALTER TABLE public.profiles ADD COLUMN stress TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='injuries') THEN
        ALTER TABLE public.profiles ADD COLUMN injuries TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='health_conditions') THEN
        ALTER TABLE public.profiles ADD COLUMN health_conditions TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='location') THEN
        ALTER TABLE public.profiles ADD COLUMN location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='equipment') THEN
        ALTER TABLE public.profiles ADD COLUMN equipment TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='personal_name') THEN
        ALTER TABLE public.profiles ADD COLUMN personal_name TEXT;
    END IF;

    -- 4. DESATIVAR RLS TEMPORARIAMENTE PARA GARANTIR GRAVACAO
    ALTER TABLE public.workouts DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.diets DISABLE ROW LEVEL SECURITY;
    
    -- 5. PERMISSOES GLOBAIS
    GRANT ALL ON TABLE public.workouts TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.diets TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

END $$;

-- 6. RECARREGAR DB CACHE
NOTIFY pgrst, 'reload schema';

SELECT 'BANCO DE DADOS ATUALIZADO COM SUCESSO' as feedback;
