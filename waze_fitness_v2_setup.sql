-- ============================================
-- NEW WAZE FITNESS SYSTEM (v2)
-- ============================================

-- 1. CLEAN UP PREVIOUS TABLES (BE CAREFUL)
DROP TABLE IF EXISTS public.checkins CASCADE;
DROP TABLE IF EXISTS public.academias CASCADE;

-- 2. CREATE ACADEMIAS TABLE
CREATE TABLE public.academias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    rua TEXT NOT NULL,
    numero TEXT,
    cidade TEXT,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE INDEXES FOR FAST SEARCH
CREATE INDEX idx_academias_nome ON public.academias(nome);
CREATE INDEX idx_academias_rua ON public.academias(rua);
CREATE INDEX idx_academias_numero ON public.academias(numero);

-- 4. CREATE CHECKINS TABLE
CREATE TABLE public.checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL, -- Simplified for local/pwa usage
    academia_id UUID REFERENCES public.academias(id) ON DELETE CASCADE,
    hora_checkin TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    hora_checkout TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'ativo', -- 'ativo', 'finalizado', 'expirado'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. AUTOMATIC EXPIRATION VIEW OR FUNCTION (SIMULATED)
-- Rule: If checkin > 2 hours and status is active -> expired
-- This can be handled by a Postgres Function or simply by the Frontend query.
-- But let's create a function to clean up.

CREATE OR REPLACE FUNCTION expire_old_checkins() 
RETURNS void AS $$
BEGIN
    UPDATE public.checkins
    SET status = 'expirado',
        hora_checkout = created_at + INTERVAL '2 hours'
    WHERE status = 'ativo' 
    AND created_at < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql;

-- 6. RLS POLICIES (BASIC)
ALTER TABLE public.academias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Academias are viewable by everyone" ON public.academias FOR SELECT USING (true);
CREATE POLICY "Users can insert academias" ON public.academias FOR INSERT WITH CHECK (true);

CREATE POLICY "Checkins are viewable by everyone" ON public.checkins FOR SELECT USING (true);
CREATE POLICY "Users can manage their own checkins" ON public.checkins 
    FOR ALL USING (true); -- Simplified for the requested "style Waze" collaborative system

-- 7. FUNCTION TO GET GYMS WITH OCCUPANCY STATUS
CREATE OR REPLACE FUNCTION get_academias_with_occupancy()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    rua TEXT,
    numero TEXT,
    cidade TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    pessoas_treinando BIGINT,
    status_lotacao TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH counts AS (
        SELECT academia_id, COUNT(*) as count
        FROM public.checkins
        WHERE status = 'ativo'
        GROUP BY academia_id
    )
    SELECT 
        a.id, a.nome, a.rua, a.numero, a.cidade, a.latitude, a.longitude,
        COALESCE(c.count, 0) as pessoas_treinando,
        CASE 
            WHEN COALESCE(c.count, 0) BETWEEN 0 AND 10 THEN 'VAZIA'
            WHEN COALESCE(c.count, 0) BETWEEN 11 AND 25 THEN 'NORMAL'
            ELSE 'LOTADA'
        END as status_lotacao
    FROM public.academias a
    LEFT JOIN counts c ON a.id = c.academia_id;
END;
$$ LANGUAGE plpgsql;
