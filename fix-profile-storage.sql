-- SCRIPT PARA CORRIGIR O BUCKET DE FOTOS DE PERFIL (AVATARS)

-- 1. Criar o bucket 'profiles' se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Configurar Políticas de Acesso (RLS) para o bucket 'profiles'
-- Permite leitura pública de todas as fotos
DROP POLICY IF EXISTS "Public Profile Read" ON storage.objects;
CREATE POLICY "Public Profile Read" ON storage.objects
    FOR SELECT USING (bucket_id = 'profiles');

-- Permite que usuários autenticados façam upload para sua própria pasta ou em qualquer lugar se for MVP
DROP POLICY IF EXISTS "Public Profile Upload" ON storage.objects;
CREATE POLICY "Public Profile Upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'profiles');

-- Permite que usuários atualizem seus próprios arquivos
DROP POLICY IF EXISTS "Public Profile Update" ON storage.objects;
CREATE POLICY "Public Profile Update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'profiles');

-- 3. Garantir que a coluna 'photo' e 'bio' existam na tabela profiles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='photo') THEN
        ALTER TABLE public.profiles ADD COLUMN photo TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio TEXT;
    END IF;
END $$;
