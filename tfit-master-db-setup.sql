-- ================================================================
-- TFIT SOCIAL CORE - MASTER DATABASE RESET (v16.0 DEFINITIVO)
-- RODE ESTE SCRIPT NO EDITOR SQL DO SUPABASE
-- ================================================================

-- ============================
-- 1. LIMPEZA TOTAL (CASCADE)
-- ============================
DROP TABLE IF EXISTS user_activity         CASCADE;
DROP TABLE IF EXISTS user_push_tokens      CASCADE;
DROP TABLE IF EXISTS notifications         CASCADE;
DROP TABLE IF EXISTS calls                 CASCADE;
DROP TABLE IF EXISTS messages              CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations         CASCADE;
DROP TABLE IF EXISTS saved_posts           CASCADE;
DROP TABLE IF EXISTS saves                 CASCADE;
DROP TABLE IF EXISTS comments              CASCADE;
DROP TABLE IF EXISTS likes                 CASCADE;
DROP TABLE IF EXISTS posts                 CASCADE;
DROP TABLE IF EXISTS stories               CASCADE;
DROP TABLE IF EXISTS followers             CASCADE;
DROP TABLE IF EXISTS user_status           CASCADE;

-- Remover policies antigas (se existirem)
DO $$ BEGIN
  -- Limpa policies antigas automaticamente com CASCADE no DROP TABLE
  RAISE NOTICE 'Limpeza concluída';
END $$;

-- ============================
-- 2. TABELAS CORE
-- ============================

-- PROFILES (Mantemos se já existe, apenas adicionamos colunas ausentes)
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY,
    name        TEXT,
    email       TEXT,
    photo_url   TEXT,
    photo       TEXT,
    bio         TEXT,
    role        TEXT DEFAULT 'student',
    is_verified BOOLEAN DEFAULT false,
    t_points    INT DEFAULT 0,
    following   UUID[] DEFAULT '{}',
    followers   UUID[] DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS t_points    INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio         TEXT;

-- FOLLOWERS
CREATE TABLE IF NOT EXISTS followers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE(follower_id, following_id)
);

-- POSTS
CREATE TABLE IF NOT EXISTS posts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    caption        TEXT,
    content        TEXT,
    media_url      TEXT,
    media_type     TEXT CHECK (media_type IN ('image', 'video', 'none')),
    likes_count    INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    is_highlighted BOOLEAN DEFAULT false,
    is_premium_only BOOLEAN DEFAULT false,
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_user_id    ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_highlighted ON posts(is_highlighted DESC);

-- LIKES
CREATE TABLE IF NOT EXISTS likes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);

-- SAVES (compatível com o código que usa 'saves')
CREATE TABLE IF NOT EXISTS saves (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

-- COMMENTS
CREATE TABLE IF NOT EXISTS comments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_id    UUID REFERENCES comments(id) ON DELETE CASCADE,
    comment_text TEXT,
    text         TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

-- STORIES
CREATE TABLE IF NOT EXISTS stories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    media_url  TEXT NOT NULL,
    media_type TEXT DEFAULT 'image',
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- CONVERSATION_PARTICIPANTS
CREATE TABLE IF NOT EXISTS conversation_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_part_user      ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_part_conv      ON conversation_participants(conversation_id);

-- MESSAGES (com suporte a metadata para reações, respostas e mídias)
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content         TEXT DEFAULT '',
    metadata        JSONB DEFAULT '{"type": "text"}'::jsonb,
    seen            BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv_id    ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);

-- CALLS
CREATE TABLE IF NOT EXISTS calls (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type       TEXT CHECK (type IN ('video', 'audio')),
    status     TEXT DEFAULT 'calling', -- calling, accepted, ended, rejected
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calls_target_id ON calls(target_id);

-- USER_STATUS (presença online)
CREATE TABLE IF NOT EXISTS user_status (
    user_id   UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type       TEXT, -- like, comment, follow, message, call
    post_id    UUID REFERENCES posts(id) ON DELETE SET NULL,
    content    TEXT,
    is_read    BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_id ON notifications(user_id);

-- USER_PUSH_TOKENS (Firebase)
CREATE TABLE IF NOT EXISTS user_push_tokens (
    user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    token      TEXT NOT NULL,
    platform   TEXT, -- ios, android, web
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- USER_ACTIVITY (Engajamento & Algoritmo)
CREATE TABLE IF NOT EXISTS user_activity (
    user_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    last_active_at TIMESTAMPTZ DEFAULT now(),
    total_interactions INT DEFAULT 0
);

-- ============================
-- 3. RLS (SEGURANÇA)
-- ============================
ALTER TABLE posts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE saves                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_push_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_status              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity            ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para autenticados (ajuste conforme necessário)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'auth_all_posts') THEN
    CREATE POLICY auth_all_posts           ON posts                    FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'auth_all_messages') THEN
    CREATE POLICY auth_all_messages        ON messages                 FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() = sender_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'auth_all_conversations') THEN
    CREATE POLICY auth_all_conversations   ON conversations            FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_participants' AND policyname = 'auth_all_conv_parts') THEN
    CREATE POLICY auth_all_conv_parts      ON conversation_participants FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'auth_all_notifications') THEN
    CREATE POLICY auth_all_notifications   ON notifications            FOR ALL TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_status' AND policyname = 'auth_all_status') THEN
    CREATE POLICY auth_all_status          ON user_status              FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calls' AND policyname = 'auth_all_calls') THEN
    CREATE POLICY auth_all_calls           ON calls                    FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'likes' AND policyname = 'auth_all_likes') THEN
    CREATE POLICY auth_all_likes           ON likes                    FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saves' AND policyname = 'auth_all_saves') THEN
    CREATE POLICY auth_all_saves           ON saves                    FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'followers' AND policyname = 'auth_all_followers') THEN
    CREATE POLICY auth_all_followers       ON followers                FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'auth_all_comments') THEN
    CREATE POLICY auth_all_comments        ON comments                 FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'auth_all_stories') THEN
    CREATE POLICY auth_all_stories         ON stories                  FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_push_tokens' AND policyname = 'auth_own_tokens') THEN
    CREATE POLICY auth_own_tokens          ON user_push_tokens         FOR ALL TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_activity' AND policyname = 'auth_own_activity') THEN
    CREATE POLICY auth_own_activity        ON user_activity            FOR ALL TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================
-- 4. REALTIME (PUBLICATION)
-- ============================
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    posts, messages, conversations, conversation_participants,
    notifications, calls, user_status, likes, comments, followers, stories;
COMMIT;

-- ============================
-- 5. STORAGE BUCKETS
-- ============================
-- Execute via Dashboard > Storage > Create Bucket:
-- Nome: chat-media     | Público: SIM
-- Nome: posts_media    | Público: SIM
-- Nome: stories_media  | Público: SIM
-- OU execute via psql com permissão de service_role:
INSERT INTO storage.buckets (id, name, public)
  VALUES ('chat-media', 'chat-media', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('posts_media', 'posts_media', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('stories_media', 'stories_media', true)
  ON CONFLICT (id) DO NOTHING;

-- PRONTO! Sistema completo instalado.
SELECT 'TFIT Social Core v16.0 instalado com sucesso!' AS status;
