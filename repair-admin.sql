-- ============================================
-- SCRIPT DE REPARO DEFINITIVO: ACESSO ADMIN (v2 - Corrigido UUID)
-- ============================================

-- 1. Garantir Extensão Necessária
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Limpeza de Segurança (Evitar Conflitos)
DO $$ 
DECLARE 
    admin_email TEXT := 'willcardoso.elo@gmail.com';
    v_user_id UUID;
BEGIN
    -- Removemos qualquer usuário com este email para começar limpo
    FOR v_user_id IN SELECT id FROM auth.users WHERE email = admin_email LOOP
        DELETE FROM auth.identities WHERE user_id = v_user_id;
        DELETE FROM public.profiles WHERE id = v_user_id;
        DELETE FROM auth.users WHERE id = v_user_id;
    END LOOP;
    
    -- Limpar qualquer perfil órfão com esse email
    DELETE FROM public.profiles WHERE email = admin_email;
END $$;

-- 3. Criar Usuário Admin em auth.users
-- UUID formatado corretamente (0-9, a-f)
INSERT INTO auth.users (
    instance_id, 
    id, 
    aud, 
    role, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    recovery_sent_at, 
    last_sign_in_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at, 
    confirmation_token, 
    email_change, 
    email_change_token_new, 
    recovery_token
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'ad000000-1111-2222-3333-444455556666'::UUID, -- UUID Fixo para Admin
    'authenticated',
    'authenticated',
    'willcardoso.elo@gmail.com',
    crypt('99230944', gen_salt('bf')), -- Senha: 99230944
    NOW(),
    NULL,
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Will Cardoso","role":"admin"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- 4. Criar Identidade para o Usuário
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    'ad000000-1111-2222-3333-444455556666'::UUID,
    format('{"sub":"%s","email":"%s"}', 'ad000000-1111-2222-3333-444455556666', 'willcardoso.elo@gmail.com')::jsonb,
    'email',
    'ad000000-1111-2222-3333-444455556666', 
    NOW(),
    NOW(),
    NOW()
);

-- 5. Garantir Perfil Público (profiles)
INSERT INTO public.profiles (id, email, name, role, status, created_at, updated_at)
VALUES (
    'ad000000-1111-2222-3333-444455556666'::UUID,
    'willcardoso.elo@gmail.com',
    'Will Cardoso',
    'admin',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    name = 'Will Cardoso',
    status = 'active',
    updated_at = NOW();

-- 6. Verificação Final
-- SELECT id, email, role FROM auth.users WHERE email = 'willcardoso.elo@gmail.com';
-- SELECT id, email, role FROM public.profiles WHERE email = 'willcardoso.elo@gmail.com';
