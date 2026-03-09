-- ============================================
-- AUTOMAÇÃO DE CADASTRO (TRIGGERS)
-- Execute este script no Supabase SQL Editor
-- ============================================

-- 1. Função que roda quando um novo usuário é criado no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, photo_url, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'Usuário Novo'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'), -- Default role is student
    new.raw_user_meta_data->>'avatar_url',
    NOW()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger que dispara a função acima
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Habilitar provedores (opcional, mas bom garantir)
-- Nota: A configuração de Google/Email deve ser feita no painel do Supabase (Authentication -> Providers)

-- ============================================
-- SUCESSO!
-- Agora, quando você usar supabase.auth.signUp() ou Google Login, 
-- o usuário será criado automaticamente na tabela 'profiles'.
-- ============================================
