-- ============================================
-- TESTE RÁPIDO: Verificar se os dados foram inseridos
-- ============================================
-- Execute este SQL no Supabase para verificar

-- Ver TODOS os usuários
SELECT id, email, name, role, status FROM public.profiles;

-- Contar usuários por role
SELECT role, COUNT(*) as total FROM public.profiles GROUP BY role;

-- Ver especificamente o aluno demo
SELECT * FROM public.profiles WHERE role = 'student';
