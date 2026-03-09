-- ==============================================
-- SISTEMA DE MENSALIDADE MANUAL/AUTOMÁTICO TFIT
-- ADM e PERSONAL
-- ==============================================

-- 1. ADICIONAR COLUNAS NA TABELA PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tipo_conta TEXT CHECK (tipo_conta IN ('admin', 'personal', 'student')),
ADD COLUMN IF NOT EXISTS plano_ativo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_inicio_plano TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_vencimento TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente', -- (ativo, vencendo, atrasado, bloqueado, pendente)
ADD COLUMN IF NOT EXISTS dias_tolerancia INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS dias_alerta INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS ultimo_pagamento_id UUID,
ADD COLUMN IF NOT EXISTS bloqueado_por_inadimplencia BOOLEAN DEFAULT false;

-- 2. CRIAR TABELA DE PAYMENTS (FATURAS / MENSALIDADES)
CREATE TABLE IF NOT EXISTS public.tfit_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    tipo_conta TEXT, -- 'admin' ou 'personal'
    valor DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado')),
    data_geracao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_confirmacao TIMESTAMP WITH TIME ZONE,
    id_transacao_mercadopago TEXT,
    link_pagamento TEXT,
    webhook_validado BOOLEAN DEFAULT false
);

ALTER TABLE public.profiles ADD CONSTRAINT fk_ultimo_pagamento 
    FOREIGN KEY (ultimo_pagamento_id) REFERENCES public.tfit_payments(id) ON DELETE SET NULL;

-- HÍndices para melhorar busca de vencimento
CREATE INDEX IF NOT EXISTS idx_profiles_pagamento ON public.profiles(status_pagamento, plano_ativo);
CREATE INDEX IF NOT EXISTS idx_tfit_payments_user ON public.tfit_payments(user_id, status);

-- 3. ROTINA DE ATUALIZAÇÃO DE STATUS DE PAGAMENTO (CÁLCULO DE VENCIMENTO)
CREATE OR REPLACE FUNCTION check_mensalidades()
RETURNS VOID AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT id, data_vencimento, dias_alerta, dias_tolerancia, status_pagamento 
        FROM public.profiles 
        WHERE tipo_conta IN ('admin', 'personal') AND plano_ativo = true
    LOOP
        -- Se já passou do vencimento + tolerancia = BLOQUEADO
        IF (NOW() > (r.data_vencimento + (r.dias_tolerancia || ' days')::INTERVAL)) THEN
            UPDATE public.profiles 
            SET status_pagamento = 'bloqueado',
                plano_ativo = false,
                bloqueado_por_inadimplencia = true
            WHERE id = r.id;

        -- Se já passou do vencimento (e está dentro da tolerância) = ATRASADO
        ELSIF (NOW() > r.data_vencimento) THEN
            IF r.status_pagamento != 'atrasado' THEN
                UPDATE public.profiles SET status_pagamento = 'atrasado' WHERE id = r.id;
            END IF;

        -- Se faltam menos que 'dias_alerta' para o vencimento = VENCENDO
        ELSIF (NOW() > (r.data_vencimento - (r.dias_alerta || ' days')::INTERVAL)) THEN
            IF r.status_pagamento != 'vencendo' THEN
                UPDATE public.profiles SET status_pagamento = 'vencendo' WHERE id = r.id;
            END IF;
            
        -- Caso contrário (dentro do prazo ok) = ATIVO
        ELSE
            IF r.status_pagamento != 'ativo' THEN
                UPDATE public.profiles SET status_pagamento = 'ativo', bloqueado_por_inadimplencia = false WHERE id = r.id;
            END IF;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- OBS: Para excutar o check_mensalidades diariamente, você pode usar a extensão pg_cron no Supabase, 
-- rodando a cada 1 da manhã, exemplo: SELECT cron.schedule('0 1 * * *', $$SELECT check_mensalidades()$$);


-- ==============================================
-- 🔒 POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ==============================================
ALTER TABLE public.tfit_payments ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver os próprios pagamentos
DROP POLICY IF EXISTS "Usuário vê próprios pagamentos" ON public.tfit_payments;
CREATE POLICY "Usuário vê próprios pagamentos" ON public.tfit_payments 
    FOR SELECT USING (auth.uid() = user_id);

-- Admins podem ver todos os pagamentos (Pode ser ajustado)
DROP POLICY IF EXISTS "Admins vêem tudo" ON public.tfit_payments;
CREATE POLICY "Admins vêem tudo" ON public.tfit_payments 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND tipo_conta = 'admin'
        )
    );

-- As inserções/atualizações de pagamento devem ser via EDGE FUNCTIONS (Bypass RLS com Service Role)
