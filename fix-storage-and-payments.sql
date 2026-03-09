-- ============================================
-- FIX STORAGE BUCKETS AND TABLE PERMISSIONS
-- ============================================

-- 1. Create the 'payment-proofs' bucket
-- Note: In Supabase SQL Editor, this is the standard way to ensure a bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Set Storage Policies for 'payment-proofs'
-- Allow public read access
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'payment-proofs');

-- Allow anyone (authenticated or anon) to upload
DROP POLICY IF EXISTS "Public Upload Access" ON storage.objects;
CREATE POLICY "Public Upload Access" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

-- 3. Fix Table Permissions and RLS
-- We disable RLS for critical tables to ensure the prototype/app works without complex policy management
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans DISABLE ROW LEVEL SECURITY;

-- 4. Add missing columns to profiles (Fix for "column plan_id does not exist")
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='plan_id') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='plan_expiry') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_expiry TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='payment_status') THEN
        ALTER TABLE public.profiles ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='personal_payment_link') THEN
        ALTER TABLE public.profiles ADD COLUMN personal_payment_link TEXT;
    END IF;
END $$;

-- Grant full access to both anonymous and authenticated roles
GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.plans TO anon;
GRANT ALL ON TABLE public.plans TO authenticated;

-- Ensure sequences are accessible for auto-incrementing IDs
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. Fix Plans Table (Missing description, created_by and ID default)
DO $$ 
BEGIN
    -- id default
    ALTER TABLE public.plans ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    
    -- description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='description') THEN
        ALTER TABLE public.plans ADD COLUMN description TEXT;
    END IF;
    
    -- created_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='created_by') THEN
        ALTER TABLE public.plans ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- payment_link
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='payment_link') THEN
        ALTER TABLE public.plans ADD COLUMN payment_link TEXT;
    END IF;

    -- pix_key
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='pix_key') THEN
        ALTER TABLE public.plans ADD COLUMN pix_key TEXT;
    END IF;

    -- personal_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='personal_name') THEN
        ALTER TABLE public.plans ADD COLUMN personal_name TEXT;
    END IF;

    -- type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='type') THEN
        ALTER TABLE public.plans ADD COLUMN type TEXT;
    END IF;

    -- max_students
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='max_students') THEN
        ALTER TABLE public.plans ADD COLUMN max_students INTEGER DEFAULT 0;
    END IF;

    -- created_at (Ensuring it exists as some errors point to it)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='created_at') THEN
        ALTER TABLE public.plans ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Force Supabase to reload the schema cache (Fix for "could not find column in schema cache")
NOTIFY pgrst, 'reload schema';

-- Ensure standard functions are accessible
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================
-- SUCCESS: Permissions and storage fixed!
-- ============================================
