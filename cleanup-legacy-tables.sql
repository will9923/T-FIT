-- TFIT - CLEANUP OF LEGACY TABLES
-- Este script remove as tabelas antigas que foram substituídas pelo novo sistema de Marketplace.

-- 1. REMOVER TABELAS DE ASSINATURA E PAGAMENTO LEGADAS
-- Estas foram substituídas por 'alunos_planos' e 'pagamentos'.
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.payment_configs_old CASCADE; -- Caso exista alguma versão anterior

-- 2. LIMPEZA DA TABELA 'plans' (Opcional/Seletivo)
-- IMPORTANTE: A tabela 'plans' ainda contém o 'plano_ia_estudante'.
-- Se você quiser remover COMPLETAMENTE a tabela 'plans', primeiro devemos migrar a IA para 'planos_personal'.
-- Por enquanto, vamos apenas remover os planos de Personal que estão na tabela errada.

DELETE FROM public.plans 
WHERE target_audience = 'personal' 
   OR name LIKE '%Personal%'
   OR created_by IS NOT NULL;

-- 3. REMOVER TABELA 'personais' (Se existir como tabela separada)
-- O sistema agora usa 'profiles' com role = 'personal'.
DROP TABLE IF EXISTS public.personais CASCADE;

-- NOTA: Não excluímos a tabela 'plans' inteira ainda para não quebrar a assinatura da IA (T-FIT AI).
-- Mas os conflitos de "Plano do Personal" foram resolvidos removendo os registros duplicados e limpando as tabelas de suporte antigas.
