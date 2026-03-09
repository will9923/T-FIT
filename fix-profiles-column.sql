-- ============================================
-- TFIT - CORREÇÃO DE COLUNA EM PROFILES
-- ============================================

-- Adiciona a coluna last_payment_date se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='last_payment_date') THEN
        ALTER TABLE public.profiles ADD COLUMN last_payment_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
