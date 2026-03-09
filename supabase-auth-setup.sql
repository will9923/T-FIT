-- ============================================
-- T-FIT SUPABASE AUTH & PROFILES SETUP
-- ============================================
-- Execute este script no SQL Editor do Supabase para
-- garantir que o cadastro e login funcionem corretamente.
-- ============================================

-- 1. Habilitar RLS (Row Level Security) na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Profiles são visíveis por todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem editar seu próprio perfil" ON public.profiles;

-- 3. Criar Políticas de Segurança
-- Qualquer um pode ver perfis (necessário para o feed e busca)
CREATE POLICY "Perfis visíveis por todos" 
ON public.profiles FOR SELECT 
USING (true);

-- Usuários podem atualizar apenas seus próprios dados
CREATE POLICY "Usuários editam próprio perfil" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Permissão para o sistema inserir perfis (via Trigger)
CREATE POLICY "Sistema insere perfis" 
ON public.profiles FOR INSERT 
WITH CHECK (true);

-- 4. Função para Criar Perfil Automaticamente (Sync com Auth)
-- Esta função roda sempre que um novo usuário confirma o email ou loga via Google
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, photo_url, status)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'Novo Usuário'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'), -- Default é student se não vier no meta
    new.raw_user_meta_data->>'avatar_url',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    photo_url = COALESCE(EXCLUDED.photo_url, public.profiles.photo_url);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar o Trigger (Gatilho)
-- Dispara a função acima sempre que um usuário for criado no Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Garantir permissões de Schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================
-- SUCESSO: O sistema agora sincroniza Auth com Perfis!
-- ============================================
