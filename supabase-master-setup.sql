-- ============================================
-- T-FIT MASTER DATABASE SETUP (PRODUÇÃO)
-- ============================================
-- Este script cria TODO o banco de dados do zero.
-- Tabelas, Triggers, RLS e dados iniciais.
-- ============================================

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE PERFIS (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'personal', 'student')),
    
    photo_url TEXT,
    cpf TEXT,
    phone TEXT,
    whatsapp TEXT,
    bio TEXT,
    birth_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'pending')),
    
    -- Assinatura
    plan_id TEXT,
    plan_expiry TIMESTAMP WITH TIME ZONE,
    temp_access BOOLEAN DEFAULT false,
    trial_used BOOLEAN DEFAULT false,
    
    -- Sociais
    following UUID[] DEFAULT ARRAY[]::UUID[],
    followers UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Dados de Profissionais/Alunos
    cref TEXT,
    specialties TEXT[],
    assigned_personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE PLANOS (PLANS)
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    billing_cycle TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    target_audience TEXT NOT NULL,
    features TEXT[],
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TREINOS (WORKOUTS)
CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT,
    personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    personal_name TEXT,
    name TEXT NOT NULL,
    type TEXT,
    duration INTEGER DEFAULT 60,
    muscle_groups TEXT[],
    exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. DIETAS (DIETS)
CREATE TABLE IF NOT EXISTS public.diets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT,
    personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    personal_name TEXT,
    name TEXT NOT NULL,
    type TEXT,
    goal TEXT,
    meals JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PAGAMENTOS (PAYMENTS)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES public.plans(id),
    amount DECIMAL(10,2) NOT NULL,
    method TEXT,
    status TEXT DEFAULT 'pending',
    proof_url TEXT,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES public.profiles(id)
);

-- 6. T-FEED (POSTS, COMMENTS, STORIES)
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT,
    media_url TEXT,
    likes INTEGER DEFAULT 0,
    liked_by JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CHAT (CONVERSATIONS, MESSAGES)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participants UUID[] NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. NOTIFICAÇÕES (NOTIFICATIONS)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    from_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Limpar Políticas
DROP POLICY IF EXISTS "Perfis visíveis por todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários editam próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Sistema insere perfis" ON public.profiles;

-- Criar Políticas
CREATE POLICY "Perfis visíveis por todos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuários editam próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Sistema insere perfis" ON public.profiles FOR INSERT WITH CHECK (true);

-- 10. GATILHO DE SINCRO (MAGIC SYNC)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, photo_url, status)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'Novo Usuário'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'avatar_url',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    photo_url = COALESCE(EXCLUDED.photo_url, public.profiles.photo_url);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- WAZE FITNESS TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.live_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    gps_accuracy FLOAT,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Public insert locations" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update locations" ON public.locations FOR UPDATE USING (true);
CREATE POLICY "Users can view all presence" ON public.live_presence FOR SELECT USING (true);
CREATE POLICY "Users can manage own presence" ON public.live_presence FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.locations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.live_presence TO anon, authenticated, service_role;

-- 11. DADOS INICIAIS
INSERT INTO public.plans (id, name, price, billing_cycle, duration_days, target_audience, features)
VALUES
    ('plano_ia_estudante', 'T-FIT IA Aluno', 29.90, 'Mensal', 30, 'student_ai', ARRAY['Treinos IA', 'Dieta IA']),
    ('plano_personal_mensal', 'T-FIT Personal Pro', 49.90, 'Mensal', 30, 'personal', ARRAY['Alunos Ilimitados'])
ON CONFLICT (id) DO NOTHING;

-- 12. PERMISSÕES
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
