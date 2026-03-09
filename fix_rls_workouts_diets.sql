-- ############################################
-- SCRIPT DE REPARO: RLS WORKOUTS & DIETS (v1.0)
-- Objetivo: Liberar acesso para geração e consulta de treinos/dietas
-- ############################################

-- 1. GARANTIR QUE RLS ESTÁ HABILITADO
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS PARA WORKOUTS (TREINOS)
DROP POLICY IF EXISTS "Users can manage their own workouts" ON public.workouts;
CREATE POLICY "Users can manage their own workouts" ON public.workouts
    FOR ALL 
    USING (auth.uid() = student_id OR auth.uid() = personal_id)
    WITH CHECK (auth.uid() = student_id OR auth.uid() = personal_id);

-- 3. POLÍTICAS PARA DIETAS (DIETAS)
DROP POLICY IF EXISTS "Users can manage their own diets" ON public.diets;
CREATE POLICY "Users can manage their own diets" ON public.diets
    FOR ALL 
    USING (auth.uid() = student_id OR auth.uid() = personal_id)
    WITH CHECK (auth.uid() = student_id OR auth.uid() = personal_id);

-- 4. POLÍTICAS PARA PAGAMENTOS (FINANCEIRO)
DROP POLICY IF EXISTS "Users can manage their own payments" ON public.payments;
CREATE POLICY "Users can manage their own payments" ON public.payments
    FOR ALL 
    USING (auth.uid() = user_id OR auth.uid() = personal_id)
    WITH CHECK (auth.uid() = user_id OR auth.uid() = personal_id);

-- 5. POLÍTICAS PARA COMPLETION (HISTÓRICO)
DROP POLICY IF EXISTS "Users can manage their own completions" ON public.workout_completions;
CREATE POLICY "Users can manage their own completions" ON public.workout_completions
    FOR ALL 
    USING (auth.uid() = student_id);

-- 6. PERMISSÕES GERAIS
GRANT ALL ON TABLE public.workouts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.diets TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.workout_completions TO anon, authenticated, service_role;

-- 7. RECARREGAR CACHE
NOTIFY pgrst, 'reload schema';

SELECT '✅ Políticas de RLS para Treinos e Dietas configuradas com sucesso!' as feedback;
