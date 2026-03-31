-- ============================================
-- WAZE FITNESS v4 - QUANTIDADE E ÚLTIMO REPORTE
-- ============================================

-- Adiciona a coluna para quantidade numérica de pessoas reportada
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS qtd_pessoas INTEGER;

-- Comentário para documentação
COMMENT ON COLUMN public.checkins.qtd_pessoas IS 'Quantidade exata de pessoas reportada pelo usuário';

-- DROP da função antiga para permitir a mudança do tipo de retorno (signature)
-- O PostgreSQL exige o drop quando as colunas de retorno mudam
DROP FUNCTION IF EXISTS public.get_academias_with_occupancy();

-- Atualiza a função para priorizar o último reporte manual
CREATE OR REPLACE FUNCTION get_academias_with_occupancy()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    rua TEXT,
    numero TEXT,
    cidade TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    pessoas_treinando INTEGER,
    status_lotacao TEXT,
    ultimo_reporte TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH last_reports AS (
        SELECT DISTINCT ON (academia_id)
            academia_id,
            lotacao_reportada,
            qtd_pessoas,
            created_at
        FROM public.checkins
        WHERE (lotacao_reportada IS NOT NULL OR qtd_pessoas IS NOT NULL)
          AND created_at > NOW() - INTERVAL '3 hours' -- Considera apenas reportes recentes (3h)
        ORDER BY academia_id, created_at DESC
    ),
    active_counts AS (
        SELECT academia_id, COUNT(*) as count
        FROM public.checkins
        WHERE status = 'ativo'
        GROUP BY academia_id
    )
    SELECT 
        a.id, a.nome, a.rua, a.numero, a.cidade, a.latitude, a.longitude,
        COALESCE(r.qtd_pessoas, ac.count::integer, 0) as pessoas_treinando,
        COALESCE(r.lotacao_reportada, 
            CASE 
                WHEN COALESCE(ac.count, 0) <= 10 THEN 'VAZIA'
                WHEN COALESCE(ac.count, 0) <= 25 THEN 'NORMAL'
                ELSE 'LOTADA'
            END
        ) as status_lotacao,
        r.created_at as ultimo_reporte
    FROM public.academias a
    LEFT JOIN last_reports r ON a.id = r.academia_id
    LEFT JOIN active_counts ac ON a.id = ac.academia_id;
END;
$$ LANGUAGE plpgsql;
