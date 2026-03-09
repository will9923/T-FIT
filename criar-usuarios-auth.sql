-- ============================================
-- CRIAR USUÁRIOS NO AUTH (VERSÃO DEFINITIVA)
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Limpeza total de IDs demo
DELETE FROM auth.identities WHERE user_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');
DELETE FROM public.profiles WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');
DELETE FROM auth.users WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');

-- 2. Inserir no Auth usando a função CRYPT do Supabase (Senha: 123456)
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, email_change, 
    email_change_token_new, recovery_token
)
VALUES
    -- Admin
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@tfit.com', 
    crypt('123456', gen_salt('bf')), 
    NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Admin Demo","role":"admin"}', 
    NOW(), NOW(), '', '', '', ''),
    
    -- Personal
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'personal@tfit.com', 
    crypt('123456', gen_salt('bf')), 
    NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Thays Fit","role":"personal"}', 
    NOW(), NOW(), '', '', '', ''),
    
    -- Aluno
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'aluno@tfit.com', 
    crypt('123456', gen_salt('bf')), 
    NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Aluno Demo","role":"student"}', 
    NOW(), NOW(), '', '', '', '');

-- 3. Inserir Identidades
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', format('{"sub":"%s","email":"%s"}', '00000000-0000-0000-0000-000000000001', 'admin@tfit.com')::jsonb, 'email', '00000000-0000-0000-0000-000000000001', NOW(), NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', format('{"sub":"%s","email":"%s"}', '00000000-0000-0000-0000-000000000002', 'personal@tfit.com')::jsonb, 'email', '00000000-0000-0000-0000-000000000002', NOW(), NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', format('{"sub":"%s","email":"%s"}', '00000000-0000-0000-0000-000000000003', 'aluno@tfit.com')::jsonb, 'email', '00000000-0000-0000-0000-000000000003', NOW(), NOW(), NOW());

-- SUCESSO! Senha agora é garantidamente 123456
