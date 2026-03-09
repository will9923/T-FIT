-- ============================================
-- T-FEED V2: DATABASE FIXES & ENHANCEMENTS (V3)
-- ============================================

-- 1. Ensure Profiles have necessary social columns
DO $$ 
BEGIN
    -- Verification Badge
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_verified') THEN
        ALTER TABLE public.profiles ADD COLUMN is_verified BOOLEAN DEFAULT false;
    END IF;

    -- Standardize photo field (many code parts use photo_url or avatar_url)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='photo_url') THEN
        ALTER TABLE public.profiles ADD COLUMN photo_url TEXT;
    END IF;

    -- Sync photo_url from photo or avatar_url
    UPDATE public.profiles 
    SET photo_url = COALESCE(photo, avatar_url, 'https://raw.githubusercontent.com/willclever/tfit-assets/main/logo.png')
    WHERE photo_url IS NULL;

END $$;

-- 2. Refine Stories Expiry (Ensure default works)
ALTER TABLE public.stories ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

-- 3. Update Social Counts (Repair just in case)
UPDATE public.profiles p
SET 
    posts_count = (SELECT count(*) FROM public.posts WHERE user_id = p.id),
    followers_count = (SELECT count(*) FROM public.followers WHERE following_id = p.id),
    following_count = (SELECT count(*) FROM public.followers WHERE follower_id = p.id);

-- 4. Ensure Correct RLS for Followers View
DROP POLICY IF EXISTS "Public followers view" ON public.followers;
CREATE POLICY "Public followers view" ON public.followers FOR SELECT USING (true);

-- 5. Saved Posts logic (Ensure table or array exists)
-- Using a separate table 'saves' is better for scalability
CREATE TABLE IF NOT EXISTS public.saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User save manage" ON public.saves;
CREATE POLICY "User save manage" ON public.saves FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public saves view" ON public.saves;
CREATE POLICY "Public saves view" ON public.saves FOR SELECT USING (auth.uid() = user_id);

-- 6. T-Points History Table
CREATE TABLE IF NOT EXISTS public.t_points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'purchase', 'earn', 'spend'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.t_points_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their history" ON public.t_points_history FOR SELECT USING (auth.uid() = user_id);

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
