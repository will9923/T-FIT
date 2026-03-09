-- ============================================
-- TFIT HUB - BACKEND SCHEMA UPDATES
-- ============================================

-- 1. TABELA: user_activity_map
-- Rastreamento em tempo real de usuários ativos no mapa
CREATE TABLE IF NOT EXISTS public.user_activity_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lat DECIMAL(9,6) NOT NULL,
    lng DECIMAL(9,6) NOT NULL,
    last_checkin TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activity_type TEXT DEFAULT 'training', -- 'training', 'walking', 'gym'
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_activity_map_location ON public.user_activity_map (lat, lng);
CREATE INDEX IF NOT EXISTS idx_activity_map_user ON public.user_activity_map (user_id);

-- 2. TABELA: hydration_logs
-- Controle de ingestão de água
CREATE TABLE IF NOT EXISTS public.hydration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_ml INTEGER NOT NULL DEFAULT 250,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hydration_user_date ON public.hydration_logs (user_id, logged_at);

-- 3. TABELA: health_checks
-- Ferramentas de Saúde (SOS Postura e Stress Test)
CREATE TABLE IF NOT EXISTS public.health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_type TEXT NOT NULL, -- 'posture', 'stress'
    result_data JSONB NOT NULL,
    score DECIMAL(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_user ON public.health_checks (user_id);

-- 4. ATIVAR REALTIME para as novas tabelas
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;
