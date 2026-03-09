-- ============================================
-- TFIT - ATUALIZAÇÃO PARA ASSINATURAS RECORRENTES
-- ============================================

-- 1. Ampliar a tabela de assinaturas (subscriptions)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS mp_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_day INTEGER;

-- 2. Garantir que a tabela profiles tenha campos de status de pagamento consistentes
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_payment_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT false;

-- 3. Função para verificar renovação/bloqueio (pode ser chamada via RPC ou verificada no login)
-- Esta função será usada pelo app para decidir se bloqueia o usuário
CREATE OR REPLACE FUNCTION check_subscription_status(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    sub_record RECORD;
    now_date TIMESTAMP WITH TIME ZONE := NOW();
    result JSONB;
BEGIN
    SELECT * INTO sub_record FROM public.subscriptions WHERE user_id = user_uuid;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'none', 'message', 'Sem assinatura');
    END IF;

    -- Se estiver cancelada
    IF sub_record.status = 'cancelled' THEN
        IF sub_record.expiry_date > now_date THEN
            RETURN jsonb_build_object('status', 'active', 'message', 'Cancelada (atrás de expiração)', 'expiry', sub_record.expiry_date);
        ELSE
            RETURN jsonb_build_object('status', 'expired', 'message', 'Assinatura expirada');
        END IF;
    END IF;

    -- Regra do dia 21, 22 (Aviso) e 23 (Bloqueio)
    -- Se o pagamento falhou (status não é ativo no MP ou data de cobrança passou e não foi atualizada)
    IF sub_record.next_billing_date < now_date THEN
        -- Se estiver no período de carência (até 3 dias após o vencimento)
        IF now_date <= (sub_record.next_billing_date + INTERVAL '3 days') THEN
            -- Dia 21 e 22 mostramos aviso
            RETURN jsonb_build_object(
                'status', 'grace_period', 
                'message', 'Pagamento não confirmado. Verifique sua forma de pagamento.',
                'days_left', EXTRACT(DAY FROM (sub_record.next_billing_date + INTERVAL '3 days' - now_date))
            );
        ELSE
            -- Dia 23+ bloqueamos
            RETURN jsonb_build_object('status', 'blocked', 'message', 'Assinatura suspensa por falta de pagamento.');
        END IF;
    END IF;

    RETURN jsonb_build_object('status', 'active', 'expiry', sub_record.expiry_date, 'next_billing', sub_record.next_billing_date);
END;
$$ LANGUAGE plpgsql;
