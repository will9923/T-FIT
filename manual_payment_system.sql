-- ============================================
-- TFIT - MANUAL PAYMENT SYSTEM INFRASTRUCTURE
-- ============================================

-- 1. Updates to 'profiles' table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_payment_link TEXT;

-- 2. Updates to 'plans' table
-- Add creator column to allow personals to have their own plans
-- Note: 'id' in current schema is TEXT, we might keep it or use UUID for new ones.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Storage Setup (Bucket for Proofs)
-- This assumes the user will run this in Supabase SQL Editor which has permissions.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Proofs are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'payment-proofs');

CREATE POLICY "Anyone can upload a proof" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'payment-proofs');

-- 4. Automatic Release Trigger (Optional but good for 'automatic' claim)
-- When a payment is created with a proof_url, we release the access.
CREATE OR REPLACE FUNCTION public.handle_manual_payment_release()
RETURNS TRIGGER AS $$
DECLARE
    plan_data RECORD;
BEGIN
    -- If a proof_url is provided, assume it's paid for now (as requested 'automatic release')
    IF NEW.proof_url IS NOT NULL AND NEW.status = 'pending' THEN
        -- Mark payment as approved
        NEW.status := 'approved';
        NEW.processed_at := NOW();

        -- Get plan duration
        SELECT duration_days INTO plan_data FROM public.plans WHERE id = NEW.plan_id;

        -- Update user profile
        UPDATE public.profiles 
        SET 
            plan_id = NEW.plan_id,
            plan_expiry = NOW() + (COALESCE(plan_data.duration_days, 30) || ' days')::interval,
            status = 'active'
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for the payments table
DROP TRIGGER IF EXISTS on_payment_proof_upload ON public.payments;
CREATE TRIGGER on_payment_proof_upload
BEFORE INSERT OR UPDATE OF proof_url ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_manual_payment_release();
