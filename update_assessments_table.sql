-- ============================================
-- ATUALIZAÇÃO: Tabela de Avaliações Físicas PRO
-- Adicionando suporte para 3 fotos e análise de IA
-- ============================================

-- Adicionar novas colunas se não existirem
DO $$ 
BEGIN
    -- Foto Frontal
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='photo_front') THEN
        ALTER TABLE public.assessments ADD COLUMN photo_front TEXT;
    END IF;

    -- Foto Lado Direito
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='photo_side_right') THEN
        ALTER TABLE public.assessments ADD COLUMN photo_side_right TEXT;
    END IF;

    -- Foto Lado Esquerdo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='photo_side_left') THEN
        ALTER TABLE public.assessments ADD COLUMN photo_side_left TEXT;
    END IF;

    -- Resultado da IA (Explicação técnica)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='ai_analysis') THEN
        ALTER TABLE public.assessments ADD COLUMN ai_analysis TEXT;
    END IF;

    -- Recomendações da IA (O que mudar/fazer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='recommendations') THEN
        ALTER TABLE public.assessments ADD COLUMN recommendations TEXT;
    END IF;

    -- Status da avaliação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='status') THEN
        ALTER TABLE public.assessments ADD COLUMN status TEXT DEFAULT 'completed';
    END IF;

    -- Identificador se foi gerado por IA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='is_ai_generated') THEN
        ALTER TABLE public.assessments ADD COLUMN is_ai_generated BOOLEAN DEFAULT true;
    END IF;

    -- Pontos Fortes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='strengths') THEN
        ALTER TABLE public.assessments ADD COLUMN strengths TEXT;
    END IF;

    -- Pontos de Melhoria
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='improvements') THEN
        ALTER TABLE public.assessments ADD COLUMN improvements TEXT;
    END IF;
END $$;

-- Garantir acesso ao ADM
GRANT ALL ON TABLE public.assessments TO service_role;
GRANT SELECT ON TABLE public.assessments TO anon, authenticated;
