-- ============================================
-- REPARO DE BANCO E ACESSO ADMINISTRATIVO
-- E-mail: willcardoso.elo@gmail.com
-- ============================================

-- PASSO 0: REPARAR TABELA PROFILES (Adicionar colunas se estiverem faltando)
-- Isso resolve o erro 42703 (coluna "name" não existe)
DO $$ 
BEGIN 
    -- Adicionar 'name' se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='profiles' AND column_name='name') THEN
        ALTER TABLE public.profiles ADD COLUMN name TEXT;
    END IF;

    -- Adicionar 'email' se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='profiles' AND column_name='email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;

    -- Adicionar 'status' se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='profiles' AND column_name='status') THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
    
    -- Adicionar 'created_at' se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='profiles' AND column_name='created_at') THEN
        ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- PASSO 1: CORRIGIR/ATUALIZAR A TRIGGER DE AUTOMAÇÃO
-- Adicionamos ON CONFLICT para evitar erros se o perfil já existir
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'Usuário Novo'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    'active',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-vincular a trigger para garantir que está ativa
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- PASSO 2: Limpar tentativas anteriores para garantir sucesso
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'willcardoso.elo@gmail.com');
DELETE FROM public.profiles WHERE email = 'willcardoso.elo@gmail.com';
DELETE FROM auth.users WHERE email = 'willcardoso.elo@gmail.com';


-- PASSO 3: Inserir novo usuário na tabela de Autenticação do Supabase
-- A trigger reparada acima agora funcionará perfeitamente
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, email_change, 
    email_change_token_new, recovery_token
)
VALUES
    ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'willcardoso.elo@gmail.com', 
    crypt('99230944', gen_salt('bf')), 
    NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Will Cardoso","role":"admin"}', 
    NOW(), NOW(), '', '', '', '');


-- PASSO 4: Criar a identidade para permitir o login
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT 
    id, id, format('{"sub":"%s","email":"%s"}', id, email)::jsonb, 'email', id, NOW(), NOW(), NOW()
FROM auth.users 
WHERE email = 'willcardoso.elo@gmail.com';


-- PASSO 5: Garantir que o nome e papel estejam corretos no perfil público
UPDATE public.profiles 
SET role = 'admin', name = 'Will Cardoso', status = 'active'
WHERE email = 'willcardoso.elo@gmail.com';


-- VERIFICAÇÃO FINAL: Deve retornar uma linha com 'admin' e 'Will Cardoso'
SELECT email, name, role, status FROM public.profiles WHERE email = 'willcardoso.elo@gmail.com';
