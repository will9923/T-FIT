-- ############################################
-- SCRIPT DE REPARO: COLUNAS DE ATLETA (v8.2)
-- Adiciona todas as métricas físicas à tabela profiles
-- ############################################

DO $$ 
BEGIN
    -- 1. ADICIONAR COLUNAS FALTANTES PARA ALUNOS NA TABELA PROFILES
    
    -- Peso e Altura
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='weight') THEN
        ALTER TABLE public.profiles ADD COLUMN weight DECIMAL(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='height') THEN
        ALTER TABLE public.profiles ADD COLUMN height DECIMAL(5,2); -- Mudado para decimal para maior precisão
    END IF;
    
    -- Dados Demográficos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='age') THEN
        ALTER TABLE public.profiles ADD COLUMN age INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='sex') THEN
        ALTER TABLE public.profiles ADD COLUMN sex TEXT;
    END IF;
    
    -- Objetivos e Nível
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='goal') THEN
        ALTER TABLE public.profiles ADD COLUMN goal TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='level') THEN
        ALTER TABLE public.profiles ADD COLUMN level TEXT;
    END IF;
    
    -- Saúde e Estilo de Vida
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='sleep') THEN
        ALTER TABLE public.profiles ADD COLUMN sleep TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stress') THEN
        ALTER TABLE public.profiles ADD COLUMN stress TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='injuries') THEN
        ALTER TABLE public.profiles ADD COLUMN injuries TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='health_conditions') THEN
        ALTER TABLE public.profiles ADD COLUMN health_conditions TEXT;
    END IF;
    
    -- Localização e Equipamentos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='location') THEN
        ALTER TABLE public.profiles ADD COLUMN location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='equipment') THEN
        ALTER TABLE public.profiles ADD COLUMN equipment TEXT;
    END IF;
    
    -- Campos de Relacionamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='personal_name') THEN
        ALTER TABLE public.profiles ADD COLUMN personal_name TEXT;
    END IF;
    
END $$;

-- 2. GARANTIR QUE RLS PERMITA UPDATE DESTES CAMPOS
DROP POLICY IF EXISTS "Usuários editam próprio perfil" ON public.profiles;
CREATE POLICY "Usuários editam próprio perfil" ON public.profiles 
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. PERMISSÕES PARA PERSONALS ATUALIZAREM SEUS ALUNOS (Opcional, mas útil)
DROP POLICY IF EXISTS "Personals atualizam seus alunos" ON public.profiles;
CREATE POLICY "Personals atualizam seus alunos" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = assigned_personal_id);

GRANT ALL ON TABLE public.profiles TO authenticated, service_role;

-- 4. RECARREGAR
NOTIFY pgrst, 'reload schema';

SELECT '✅ Colunas de métricas físicas adicionadas com sucesso!' as feedback;
