-- ============================================
-- TFIT - DYNAMIC PAYMENT INFRASTRUCTURE (V3)
-- ============================================

-- 1. TABELA: payment_configs
-- Stores credentials per user (Admin or Personal)
CREATE TABLE IF NOT EXISTS public.payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, -- Encrypted AES-256
    public_key TEXT NOT NULL,
    webhook_secret TEXT, -- Optional MP secret for validation
    status_config TEXT DEFAULT 'active' CHECK (status_config IN ('active', 'inactive', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Ensure consistency between 'planos' and 'assinaturas' if they don't exist
-- (Checking existing schema from mercado_pago_v2.sql)

-- Add index for user_id in payment_configs
CREATE INDEX IF NOT EXISTS idx_payment_configs_user ON public.payment_configs(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payment_configs_modtime') THEN
        CREATE TRIGGER update_payment_configs_modtime 
        BEFORE UPDATE ON public.payment_configs 
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- 3. Migration (Optional: Copy from configuracoes_pagamento if exists)
-- INSERT INTO public.payment_configs (user_id, access_token, public_key, status_config)
-- SELECT user_id, mp_access_token, mp_public_key, 'active'
-- FROM public.configuracoes_pagamento
-- ON CONFLICT (user_id) DO NOTHING;
