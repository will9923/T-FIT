-- ############################################
-- SCRIPT DE REPARO: CADASTRO DE ALUNOS (v8.1)
-- Adiciona colunas faltantes na tabela profiles
-- ############################################

DO $$ 
BEGIN
    -- 1. ADICIONAR COLUNAS FALTANTES EM PROFILES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='goal') THEN
        ALTER TABLE public.profiles ADD COLUMN goal TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='weight') THEN
        ALTER TABLE public.profiles ADD COLUMN weight DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='height') THEN
        ALTER TABLE public.profiles ADD COLUMN height INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='age') THEN
        ALTER TABLE public.profiles ADD COLUMN age INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='sex') THEN
        ALTER TABLE public.profiles ADD COLUMN sex TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='personal_name') THEN
        ALTER TABLE public.profiles ADD COLUMN personal_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='payment_status') THEN
        ALTER TABLE public.profiles ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='payment_cycle') THEN
        ALTER TABLE public.profiles ADD COLUMN payment_cycle TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_type') THEN
        ALTER TABLE public.profiles ADD COLUMN user_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'student';
    END IF;

    -- 2. GARANTIR QUE user_type E role ESTEJAM SINCRONIZADOS
    -- Se um for nulo e o outro não, preenche.
    UPDATE public.profiles SET user_type = role WHERE user_type IS NULL AND role IS NOT NULL;
    UPDATE public.profiles SET role = user_type WHERE role IS NULL AND user_type IS NOT NULL;

END $$;

-- 3. CRIAR TRIGGER PARA MANTER ROLE E USER_TYPE SINCRONIZADOS (Opcional mas recomendado)
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

-- 4. DESABILITAR RLS TEMPORARIAMENTE PARA TESTES (se necessário)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

SELECT '✅ Colunas de aluno adicionadas com sucesso!' as feedback;
