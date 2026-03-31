-- Adicionar novos campos de controle de assinatura ao perfil do usuário
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS assinatura_tfit BOOLEAN DEFAULT false;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS assinatura_personal BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.assinatura_tfit IS 'Indica se o aluno possui o plano de IA (T-FIT) ativo';
COMMENT ON COLUMN public.profiles.assinatura_personal IS 'Indica se o aluno possui o plano de Personal Trainer ativo';
