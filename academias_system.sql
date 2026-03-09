-- 1) Extensões necessárias para geofencing e distância
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- 2) Tabela academias
CREATE TABLE IF NOT EXISTS public.academias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    endereco TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    capacidade_maxima INTEGER NOT NULL DEFAULT 100,
    alunos_presentes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ativar Realtime para a tabela academias
ALTER TABLE public.academias REPLICA IDENTITY FULL;
-- Nota: Certifique-se de habilitar o Realtime no Dashboard do Supabase para esta tabela ou via SQL:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.academias;

-- 3) Trigger automático para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_academias_updated_at ON public.academias;
CREATE TRIGGER tr_academias_updated_at
BEFORE UPDATE ON public.academias
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4) View academias_status para cálculo centralizado de lotação
CREATE OR REPLACE VIEW public.academias_status AS
SELECT 
    *,
    CASE 
        WHEN alunos_presentes = 0 THEN 'Vazia'
        WHEN alunos_presentes < capacidade_maxima * 0.6 THEN 'Normal'
        ELSE 'Lotada'
    END as status
FROM public.academias;

-- 5) Função academias_proximas (RPC) para busca por raio
CREATE OR REPLACE FUNCTION public.academias_proximas(
    user_lat FLOAT,
    user_lng FLOAT,
    raio_km FLOAT
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    endereco TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT,
    distancia_km FLOAT,
    alunos_presentes INTEGER,
    capacidade_maxima INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.nome,
        a.endereco,
        a.latitude,
        a.longitude,
        a.status,
        (earth_distance(
            ll_to_earth(user_lat, user_lng),
            ll_to_earth(a.latitude, a.longitude)
        ) / 1000)::FLOAT as distancia_km,
        a.alunos_presentes,
        a.capacidade_maxima
    FROM public.academias_status a
    WHERE earth_box(ll_to_earth(user_lat, user_lng), raio_km * 1000) @> ll_to_earth(a.latitude, a.longitude)
      AND earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(a.latitude, a.longitude)) <= raio_km * 1000
    ORDER BY distancia_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Inserir alguns dados de teste para demonstração inicial se a tabela estiver vazia
/*
INSERT INTO public.academias (nome, endereco, latitude, longitude, capacidade_maxima, alunos_presentes)
VALUES 
('🔥 PowerFit', 'Rua das Flores, 123', -23.55052, -46.633309, 100, 0),
('💪 Iron Gym', 'Av. Paulista, 890', -23.5614, -46.6559, 150, 120),
('🏋️‍♂️ Smart Body', 'Rua Central, 455', -23.5432, -46.6211, 80, 40);
*/
