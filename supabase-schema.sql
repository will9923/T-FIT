-- ============================================
-- Versão SEM AUTENTICAÇÃO para MVP funcional
-- Execute este script no Supabase SQL Editor
-- ============================================

-- REPARO: Garantir que colunas novas existam em tabelas antigas
DO $$ 
BEGIN
    -- profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='assigned_personal_id') THEN
        ALTER TABLE public.profiles ADD COLUMN assigned_personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='ai_active') THEN
        ALTER TABLE public.profiles ADD COLUMN ai_active BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='cref') THEN
        ALTER TABLE public.profiles ADD COLUMN cref TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='specialties') THEN
        ALTER TABLE public.profiles ADD COLUMN specialties TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='pix_key') THEN
        ALTER TABLE public.profiles ADD COLUMN pix_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='mp_monthly_link') THEN
        ALTER TABLE public.profiles ADD COLUMN mp_monthly_link TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='mp_subscription_link') THEN
        ALTER TABLE public.profiles ADD COLUMN mp_subscription_link TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='instagram') THEN
        ALTER TABLE public.profiles ADD COLUMN instagram TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='whatsapp') THEN
        ALTER TABLE public.profiles ADD COLUMN whatsapp TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='birth_date') THEN
        ALTER TABLE public.profiles ADD COLUMN birth_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='instagram_pass') THEN
        ALTER TABLE public.profiles ADD COLUMN instagram_pass TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='workout_stats') THEN
        ALTER TABLE public.profiles ADD COLUMN workout_stats JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='following') THEN
        ALTER TABLE public.profiles ADD COLUMN following UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='followers') THEN
        ALTER TABLE public.profiles ADD COLUMN followers UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='saved_posts') THEN
        ALTER TABLE public.profiles ADD COLUMN saved_posts UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='plan_id') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='plan_expiry') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_expiry TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='trial_started_at') THEN
        ALTER TABLE public.profiles ADD COLUMN trial_started_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='trial_used') THEN
        ALTER TABLE public.profiles ADD COLUMN trial_used BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='payment_status') THEN
        ALTER TABLE public.profiles ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;

    -- workouts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='workouts') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workouts' AND column_name='personal_id') THEN
            ALTER TABLE public.workouts ADD COLUMN personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- payments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='personal_id') THEN
            ALTER TABLE public.payments ADD COLUMN personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- diets, assessments, contracts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='diets') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='diets' AND column_name='personal_id') THEN
        ALTER TABLE public.diets ADD COLUMN personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='assessments') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessments' AND column_name='personal_id') THEN
        ALTER TABLE public.assessments ADD COLUMN personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contracts') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contracts' AND column_name='personal_id') THEN
        ALTER TABLE public.contracts ADD COLUMN personal_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000002' REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- plans (Reparo de camelCase para snake_case)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='plans') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='billingCycle') THEN
            ALTER TABLE public.plans RENAME COLUMN "billingCycle" TO billing_cycle;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='durationDays') THEN
            ALTER TABLE public.plans RENAME COLUMN "durationDays" TO duration_days;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='targetAudience') THEN
            ALTER TABLE public.plans RENAME COLUMN "targetAudience" TO target_audience;
        END IF;

        -- Caso as colunas nem existam (nem camel nem snake)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='billing_cycle') THEN
            ALTER TABLE public.plans ADD COLUMN billing_cycle TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='duration_days') THEN
            ALTER TABLE public.plans ADD COLUMN duration_days INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='target_audience') THEN
            ALTER TABLE public.plans ADD COLUMN target_audience TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='features') THEN
            ALTER TABLE public.plans ADD COLUMN features TEXT[];
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='active') THEN
            ALTER TABLE public.plans ADD COLUMN active BOOLEAN DEFAULT true;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='description') THEN
            ALTER TABLE public.plans ADD COLUMN description TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='created_by') THEN
            ALTER TABLE public.plans ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='payment_link') THEN
            ALTER TABLE public.plans ADD COLUMN payment_link TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='pix_key') THEN
            ALTER TABLE public.plans ADD COLUMN pix_key TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='personal_name') THEN
            ALTER TABLE public.plans ADD COLUMN personal_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='type') THEN
            ALTER TABLE public.plans ADD COLUMN type TEXT;
        END IF;
        
        -- Garante o default no ID
        ALTER TABLE public.plans ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;

    -- REMOVER vínculo obrigatório com auth.users (necessário para o Modo Simplificado / Demo)
    -- Isso permite que usuários de demonstração existam sem estarem no sistema de Auth oficial.
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='profiles' AND constraint_name='profiles_id_fkey') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
END $$;


-- ============================================
-- TABELA: profiles
-- Usuários do sistema (admins, personals, alunos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'personal', 'student')),
    
    -- Campos comuns
    photo_url TEXT,
    cpf TEXT,
    phone TEXT,
    whatsapp TEXT,
    bio TEXT,
    birth_date DATE,
    instagram TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'pending')),
    
    -- Assinatura
    plan_id TEXT,
    plan_expiry TIMESTAMP WITH TIME ZONE,
    temp_access BOOLEAN DEFAULT false,
    trial_used BOOLEAN DEFAULT false,
    ai_active BOOLEAN DEFAULT false,
    
    -- T-Feed Social
    following UUID[] DEFAULT ARRAY[]::UUID[],
    followers UUID[] DEFAULT ARRAY[]::UUID[],
    saved_posts UUID[] DEFAULT ARRAY[]::UUID[],
    instagram_pass TEXT,
    workout_stats JSONB,
    
    -- Dados do Personal
    cref TEXT,
    specialties TEXT[],
    pix_key TEXT,
    mp_monthly_link TEXT,
    mp_subscription_link TEXT,
    personal_payment_link TEXT,
    
    -- Dados do Aluno
    assigned_personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Métricas e Perfil Físico (v8.2)
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    age INTEGER,
    sex TEXT,
    goal TEXT,
    level TEXT,
    sleep TEXT,
    stress TEXT,
    injuries TEXT,
    health_conditions TEXT,
    location TEXT,
    equipment TEXT,
    personal_name TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- ============================================
-- TABELA: plans
-- Planos de assinatura
-- ============================================
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    billing_cycle TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    target_audience TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    payment_link TEXT,
    pix_key TEXT,
    personal_name TEXT,
    type TEXT,
    features TEXT[],
    max_students INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABELA: workouts
-- Treinos dos alunos
-- ============================================
CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT,
    personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    personal_name TEXT,
    
    name TEXT NOT NULL,
    type TEXT,
    duration INTEGER DEFAULT 60,
    muscle_groups TEXT[],
    exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    rationale TEXT, -- Estratégia do treino (v8.2)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_student ON public.workouts(student_id);
CREATE INDEX IF NOT EXISTS idx_workouts_personal ON public.workouts(personal_id);

-- ============================================
-- TABELA: diets
-- Dietas dos alunos
-- ============================================
CREATE TABLE IF NOT EXISTS public.diets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT,
    personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    personal_name TEXT,
    
    name TEXT NOT NULL,
    type TEXT,
    goal TEXT,
    meals JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Colunas Nutricionais e AI
    calories INTEGER DEFAULT 0,
    protein INTEGER DEFAULT 0,
    carbs INTEGER DEFAULT 0,
    fat INTEGER DEFAULT 0,
    water INTEGER DEFAULT 0,
    visual_evaluation TEXT,
    rationale TEXT,
    photos JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diets_student ON public.diets(student_id);

-- ============================================
-- TABELA: assessments
-- Avaliações físicas
-- ============================================
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    body_fat_percentage DECIMAL(4,2),
    measurements JSONB DEFAULT '{}'::jsonb,
    photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_student ON public.assessments(student_id);

-- ============================================
-- TABELA: payments
-- Pagamentos
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES public.plans(id),
    
    amount DECIMAL(10,2) NOT NULL,
    method TEXT,
    status TEXT DEFAULT 'pending',
    proof_url TEXT,
    transaction_id TEXT,
    mp_payment_id TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES public.profiles(id),
    personal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ============================================
-- TABELA: contracts
-- Contratos entre personal e aluno
-- ============================================
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    status TEXT DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    monthly_fee DECIMAL(10,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_personal ON public.contracts(personal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_student ON public.contracts(student_id);

-- ============================================
-- T-FEED: Posts
-- ============================================
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- UI Metadata (Self-contained for performance)
    user_name TEXT,
    user_avatar TEXT,
    user_type TEXT,
    is_verified BOOLEAN DEFAULT false,

    type TEXT NOT NULL,
    content TEXT,
    media_url TEXT,
    workout_stats JSONB,
    
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    liked_by JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- ============================================
-- T-FEED: Comments
-- ============================================
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);

-- ============================================
-- T-FEED: Stories
-- ============================================
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- UI Metadata
    user_name TEXT,
    user_avatar TEXT,
    user_type TEXT,
    is_verified BOOLEAN DEFAULT false,

    type TEXT,
    media_url TEXT NOT NULL,
    viewed_by JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_user ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON public.stories(expires_at);

-- ============================================
-- T-FEED: Ads
-- ============================================
CREATE TABLE IF NOT EXISTS public.ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image TEXT NOT NULL,
    link TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_active ON public.ads(active);

-- ============================================
-- T-FEED: Conversations
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participants UUID[] NOT NULL,
    
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations USING GIN(participants);

-- ============================================
-- T-FEED: Messages
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    type TEXT DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    read BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- ============================================
-- T-FEED: Notifications
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    from_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- ============================================
-- T-FIT: Exercise Videos
-- ============================================
CREATE TABLE IF NOT EXISTS public.exercise_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_name TEXT NOT NULL UNIQUE,
    youtube_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_videos_name ON public.exercise_videos(exercise_name);

-- ============================================
-- T-FIT: Workout Completions
-- ============================================
CREATE TABLE IF NOT EXISTS public.workout_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workout_id TEXT,
    workout_name TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_completions_student ON public.workout_completions(student_id);

-- ============================================
-- T-FIT: Media Assets (Offline Support)
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_assets (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    base64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- T-FIT: Activity Logs
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    steps INTEGER DEFAULT 0,
    calories INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_student ON public.activity_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON public.activity_logs(date);

-- ============================================
-- SEED: Planos Padrão
-- ============================================
INSERT INTO public.plans (id, name, price, billing_cycle, duration_days, target_audience, features)
VALUES
    ('plano_ia_estudante', 'Assinatura T-FIT IA', 29.90, 'Mensal', 30, 'student_ai', 
     ARRAY['Treinos Automáticos', 'Dieta de IA', 'Avaliação Visual', 'Suporte do App']),
    ('plano_personal_mensal', 'T-FIT Personal Pro', 49.90, 'Mensal', 30, 'personal', 
     ARRAY['Alunos Ilimitados', 'Gerador de Treinos IA', 'Sincronização Nuvem', 'Marketplace Ativo']),
    ('plano_personal_anual', 'T-FIT Personal Elite (Anual)', 399.90, 'Anual', 365, 'personal', 
     ARRAY['Economize 30%', 'Suporte Prioritário', 'Selo Personal VIP', 'Todas as funções Pro'])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SEED: Usuários de Demonstração
-- ============================================
-- Admin
INSERT INTO public.profiles (id, email, name, role, status)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@tfit.com', 'Admin Demo', 'admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- Personal
INSERT INTO public.profiles (id, email, name, role, status, cref, specialties)
VALUES
    ('00000000-0000-0000-0000-000000000002', 'personal@tfit.com', 'Thays Fit', 'personal', 'active', 
     '123456-G/SP', ARRAY['Musculação', 'Funcional', 'Emagrecimento'])
ON CONFLICT (email) DO NOTHING;

-- Aluno
INSERT INTO public.profiles (id, email, name, role, status, assigned_personal_id)
VALUES
    ('00000000-0000-0000-0000-000000000003', 'aluno@tfit.com', 'Aluno Demo', 'student', 'active',
     '00000000-0000-0000-0000-000000000002')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- TABELA: payment_configs
-- Armazena credenciais do Mercado Pago para Admin e Personals
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, 
    public_key TEXT NOT NULL,
    webhook_secret TEXT,
    status_config TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own payment config" ON public.payment_configs;
CREATE POLICY "Users can view their own payment config" ON public.payment_configs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can updates their own payment config" ON public.payment_configs;
CREATE POLICY "Users can updates their own payment config" ON public.payment_configs
    FOR ALL USING (auth.uid() = user_id);

-- Service role access
GRANT ALL ON TABLE public.payment_configs TO service_role;
GRANT SELECT ON TABLE public.payment_configs TO anon, authenticated;

-- ============================================
-- TABELA: subscriptions
-- Controla o status das assinaturas e trials
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL, 
    status TEXT NOT NULL DEFAULT 'pending',
    trial_used BOOLEAN DEFAULT false,
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Gatilhos para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_payment_configs_update ON public.payment_configs;
CREATE TRIGGER tr_payment_configs_update BEFORE UPDATE ON public.payment_configs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_subscriptions_update ON public.subscriptions;
CREATE TRIGGER tr_subscriptions_update BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

DROP POLICY IF EXISTS "Public view locations" ON public.locations;
CREATE POLICY "Public view locations" ON public.locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert locations" ON public.locations;
CREATE POLICY "Public insert locations" ON public.locations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update locations" ON public.locations;
CREATE POLICY "Public update locations" ON public.locations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can view all presence" ON public.live_presence;
CREATE POLICY "Users can view all presence" ON public.live_presence FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own presence" ON public.live_presence;
CREATE POLICY "Users can manage own presence" ON public.live_presence FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.locations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.live_presence TO anon, authenticated, service_role;

-- ============================================
-- SUCESSO!
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Depois forneça a URL e ANON KEY do seu projeto
-- ============================================
