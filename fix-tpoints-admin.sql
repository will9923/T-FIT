-- Correção para permitir que o admin crie, edite e delete pacotes de T-Pontos
ALTER TABLE public.t_points_packages DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.t_points_packages TO anon, authenticated, service_role;

-- Correção para boosts se estiver dando problema
ALTER TABLE public.t_boosts DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.t_boosts TO anon, authenticated, service_role;
