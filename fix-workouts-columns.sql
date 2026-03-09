-- FIX: Add missing columns to workouts table
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 60;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS personal_name TEXT;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS rationale TEXT;

-- FIX: Add missing columns to diets table
ALTER TABLE public.diets ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.diets ADD COLUMN IF NOT EXISTS personal_name TEXT;

-- ============================================
-- WAZE FITNESS TABLES
-- ============================================

-- Table for cached gym locations
CREATE TABLE IF NOT EXISTS public.locations (
    id TEXT PRIMARY KEY, -- Google Place ID
    name TEXT NOT NULL,
    address TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for real-time presence
CREATE TABLE IF NOT EXISTS public.live_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    gps_accuracy FLOAT,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- RLS and Permissions
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view locations" ON public.locations;
CREATE POLICY "Public view locations" ON public.locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert locations" ON public.locations;
CREATE POLICY "Public insert locations" ON public.locations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update locations" ON public.locations;
CREATE POLICY "Public update locations" ON public.locations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can view all presence" ON public.live_presence;
CREATE POLICY "Users can view all presence" ON public.live_presence FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own presence" ON public.live_presence;
CREATE POLICY "Users can manage own presence" ON public.live_presence FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.locations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.live_presence TO anon, authenticated, service_role;

-- Notify Supabase to refresh schema cache
NOTIFY pgrst, 'reload schema';
