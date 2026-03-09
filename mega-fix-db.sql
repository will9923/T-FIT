-- ############################################
-- MEGA SCRIPT DE REPARO: T-FIT CORE (v10.0)
-- Objetivo: Garantir que TODAS as colunas essenciais existem
-- ############################################

DO $$ 
BEGIN
    -- 1. REPARAR TABELA profiles (Métricas de Aluno)
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='injuries') THEN
        ALTER TABLE public.profiles ADD COLUMN injuries TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='personal_name') THEN
        ALTER TABLE public.profiles ADD COLUMN personal_name TEXT;
    END IF;

    -- 2. REPARAR TABELA workouts (Metadados de IA)
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

    -- 3. REPARAR TABELA diets
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='calories') THEN
        ALTER TABLE public.diets ADD COLUMN calories INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='rationale') THEN
        ALTER TABLE public.diets ADD COLUMN rationale TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diets' AND column_name='visual_evaluation') THEN
        ALTER TABLE public.diets ADD COLUMN visual_evaluation TEXT;
    END IF;

END $$;

-- 4. POLÍTICAS DE ACESSO (Obrigatoriedade para Personals editarem Alunos)
DROP POLICY IF EXISTS "Personals atualizam seus alunos" ON public.profiles;
CREATE POLICY "Personals atualizam seus alunos" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = assigned_personal_id);

GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.workouts TO authenticated;
GRANT ALL ON TABLE public.diets TO authenticated;

-- Forçar limpeza de cache do PostgREST
NOTIFY pgrst, 'reload schema';

SELECT '✅ Banco de dados T-FIT sincronizado e reparado!' as feedback;
