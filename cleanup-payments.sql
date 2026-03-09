-- TFIT - CLEANUP SCRIPT (REMOVE ALL PAYMENT LOGIC)
-- This script deletes tables and columns related to Mercado Pago, Asaas, and local plan management.

-- 1. DROP TABLES
DROP TABLE IF EXISTS public.configuracoes_pagamento CASCADE;
DROP TABLE IF EXISTS public.assinaturas CASCADE;
DROP TABLE IF EXISTS public.planos CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE; -- Usually related to plans/payments

-- 2. REMOVE COLUMNS FROM PROFILES
DO $$ 
BEGIN 
    -- Basic Plan Info
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='plan_id') THEN
        ALTER TABLE public.profiles DROP COLUMN plan_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='plan_name') THEN
        ALTER TABLE public.profiles DROP COLUMN plan_name;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='billing_cycle') THEN
        ALTER TABLE public.profiles DROP COLUMN billing_cycle;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='plan_expiry') THEN
        ALTER TABLE public.profiles DROP COLUMN plan_expiry;
    END IF;

    -- Secondary Plan/Subscription Info
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_id') THEN
        ALTER TABLE public.profiles DROP COLUMN subscription_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_status') THEN
        ALTER TABLE public.profiles DROP COLUMN subscription_status;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='trial_ends_at') THEN
        ALTER TABLE public.profiles DROP COLUMN trial_ends_at;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_payment_at') THEN
        ALTER TABLE public.profiles DROP COLUMN last_payment_at;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='next_payment_at') THEN
        ALTER TABLE public.profiles DROP COLUMN next_payment_at;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='temp_access') THEN
        ALTER TABLE public.profiles DROP COLUMN temp_access;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='trial_used') THEN
        ALTER TABLE public.profiles DROP COLUMN trial_used;
    END IF;

    -- Payment Provider Info
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='pix_key') THEN
        ALTER TABLE public.profiles DROP COLUMN pix_key;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mp_access_token') THEN
        ALTER TABLE public.profiles DROP COLUMN mp_access_token;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mp_public_key') THEN
        ALTER TABLE public.profiles DROP COLUMN mp_public_key;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mp_monthly_link') THEN
        ALTER TABLE public.profiles DROP COLUMN mp_monthly_link;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mp_subscription_link') THEN
        ALTER TABLE public.profiles DROP COLUMN mp_subscription_link;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mp_mensal_link') THEN
        ALTER TABLE public.profiles DROP COLUMN mp_mensal_link;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mp_anual_link') THEN
        ALTER TABLE public.profiles DROP COLUMN mp_anual_link;
    END IF;

END $$;

-- 3. RESET STATUS FOR ALL USERS (Optional but recommended)
-- Set everyone back to 'active' if they were 'blocked' by payment logic
UPDATE public.profiles SET status = 'active' WHERE status = 'blocked';

-- Done. All payment infrastructure removed.
