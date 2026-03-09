-- ============================================
-- TFIT - SETUP MERCADO PAGO AUTOMATIZADO
-- ============================================

-- 1. TABELA: payment_configs
-- Armazena credenciais do Mercado Pago para Admin e Personals (AccessToken criptografado)
CREATE TABLE IF NOT EXISTS public.payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, 
    public_key TEXT NOT NULL,
    webhook_secret TEXT,
    status_config TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own payment config" ON public.payment_configs;
CREATE POLICY "Users can view their own payment config" ON public.payment_configs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can updates their own payment config" ON public.payment_configs;
CREATE POLICY "Users can updates their own payment config" ON public.payment_configs
    FOR ALL USING (auth.uid() = user_id);

-- Service role access
GRANT ALL ON TABLE public.payment_configs TO service_role;
GRANT SELECT ON TABLE public.payment_configs TO anon, authenticated;

-- 2. TABELA: assinaturas (Unificada para inglês: subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL, -- Referência ao ID de plans (que é TEXT no schema mestre)
    status TEXT NOT NULL DEFAULT 'pending',
    trial_used BOOLEAN DEFAULT false,
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Note: No standard REFERENCES because plans.id is TEXT and we use gen_random_uuid()::text there.

-- RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- 3. GATILHOS
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_payment_configs_update ON public.payment_configs;
CREATE TRIGGER tr_payment_configs_update BEFORE UPDATE ON public.payment_configs FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

DROP TRIGGER IF EXISTS tr_subscriptions_update ON public.subscriptions;
CREATE TRIGGER tr_subscriptions_update BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- 4. RELOAD
NOTIFY pgrst, 'reload schema';
