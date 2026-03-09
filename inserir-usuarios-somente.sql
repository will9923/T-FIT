-- ============================================
-- INSERIR APENAS OS 3 USUÁRIOS DEMO
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Deletar usuários antigos (se existirem)
DELETE FROM public.profiles WHERE email IN ('admin@tfit.com', 'personal@tfit.com', 'aluno@tfit.com');

-- Inserir Admin
INSERT INTO public.profiles (id, email, name, role, status, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@tfit.com', 'Admin Demo', 'admin', 'active', NOW());

-- Inserir Personal
INSERT INTO public.profiles (id, email, name, role, status, cref, specialties, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000002', 'personal@tfit.com', 'Thays Fit', 'personal', 'active', 
     '123456-G/SP', ARRAY['Musculação', 'Funcional', 'Emagrecimento'], NOW());

-- Inserir Aluno
INSERT INTO public.profiles (id, email, name, role, status, assigned_personal_id, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000003', 'aluno@tfit.com', 'Aluno Demo', 'student', 'active',
     '00000000-0000-0000-0000-000000000002', NOW());

-- Verificar se foram inseridos
SELECT email, name, role FROM public.profiles WHERE role IN ('admin', 'personal', 'student');
