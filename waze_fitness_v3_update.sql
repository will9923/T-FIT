-- ============================================
-- WAZE FITNESS v3 - MANUAL OCCUPANCY REPORT
-- ============================================

-- Adiciona a coluna para armazenar o reporte manual do usuário
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS lotacao_reportada TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.checkins.lotacao_reportada IS 'Reporte manual do usuário sobre a lotação: VAZIA, MODERADA, LOTADA';
