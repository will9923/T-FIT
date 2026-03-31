-- ############################################
-- SCRIPT DE AJUSTE FINAL: CADASTROS & MARKETPLACE (v14.20)
-- Execute este script no SQL Editor do Supabase
-- ############################################

DO $$ 
BEGIN
    -- 1. Garantir que todas as colunas necessárias existam na tabela profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='cref') THEN
        ALTER TABLE public.profiles ADD COLUMN cref TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='specialty') THEN
        ALTER TABLE public.profiles ADD COLUMN specialty TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='goal') THEN
        ALTER TABLE public.profiles ADD COLUMN goal TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='weight') THEN
        ALTER TABLE public.profiles ADD COLUMN weight DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='height') THEN
        ALTER TABLE public.profiles ADD COLUMN height DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='age') THEN
        ALTER TABLE public.profiles ADD COLUMN age INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='sex') THEN
        ALTER TABLE public.profiles ADD COLUMN sex TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='assigned_personal_id') THEN
        ALTER TABLE public.profiles ADD COLUMN assigned_personal_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='personal_name') THEN
        ALTER TABLE public.profiles ADD COLUMN personal_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_type') THEN
        ALTER TABLE public.profiles ADD COLUMN user_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'student';
    END IF;

    -- 2. Compatibilizar tipos de ID em tabelas de planos (UUID vs TEXT)
    -- Primeiro removemos as FKs para permitir a mudança de tipo
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='alunos_planos' AND constraint_name='alunos_planos_plano_id_fkey') THEN
        ALTER TABLE public.alunos_planos DROP CONSTRAINT alunos_planos_plano_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='pagamentos' AND constraint_name='pagamentos_plano_id_fkey') THEN
        ALTER TABLE public.pagamentos DROP CONSTRAINT pagamentos_plano_id_fkey;
    END IF;

    -- Agora mudamos os tipos para TEXT (Permite 'plano_ia_estudante' e UUIDs ao mesmo tempo)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='alunos_planos' AND column_name='plano_id' AND data_type='uuid') THEN
        ALTER TABLE public.alunos_planos ALTER COLUMN plano_id TYPE TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pagamentos' AND column_name='plano_id' AND data_type='uuid') THEN
        ALTER TABLE public.pagamentos ALTER COLUMN plano_id TYPE TEXT;
    END IF;

    -- 3. Remover restrição de FK de profiles.id -> auth.users.id
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='profiles' AND constraint_name='profiles_id_fkey') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;

END $$;

-- 4. Função e Trigger para manter role e user_type sincronizados
CREATE OR REPLACE FUNCTION sync_role_user_type()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS NOT NULL AND NEW.user_type IS NULL THEN
        NEW.user_type = NEW.role;
    ELSIF NEW.user_type IS NOT NULL AND NEW.role IS NULL THEN
        NEW.role = NEW.user_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_role ON public.profiles;
CREATE TRIGGER trigger_sync_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION sync_role_user_type();

-- 5. Atualizar Trigger handle_new_user do Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, user_type, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'Usuário Novo'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(new.raw_user_meta_data->>'name', public.profiles.name),
    role = COALESCE(new.raw_user_meta_data->>'role', public.profiles.role),
    user_type = COALESCE(new.raw_user_meta_data->>'role', public.profiles.role),
    updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Políticas de RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_planos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Alunos Planos
DROP POLICY IF EXISTS "Users can view own enrollment" ON public.alunos_planos;
CREATE POLICY "Users can view own enrollment" ON public.alunos_planos 
FOR SELECT USING (auth.uid() = aluno_id OR auth.uid() = personal_id);

DROP POLICY IF EXISTS "Personals can manage their students enrollments" ON public.alunos_planos;
CREATE POLICY "Personals can manage their students enrollments" ON public.alunos_planos 
FOR ALL USING (auth.uid() = personal_id);

-- 7. Permissões
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT ALL ON public.alunos_planos TO anon, authenticated, service_role;
GRANT ALL ON public.pagamentos TO anon, authenticated, service_role;

SELECT '✅ Script v14.20 executado com sucesso! Restrições de tipo removidas.' as status;
