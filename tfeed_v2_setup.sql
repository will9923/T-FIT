-- ============================================
-- T-FEED V2: INSTAGRAM-STYLE SOCIAL MODULE
-- Migration Script (V2.1 - Corrected)
-- ============================================

-- 1. CLEANUP SOCIAL ONLY (Keep shared notifications/messaging if possible, but user asked for full reset)
-- We will RESET social but keep the notification table structure for app alerts.
DROP TABLE IF EXISTS public.stories CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE; -- Old name
DROP TABLE IF EXISTS public.likes CASCADE;      -- New name (just in case)
DROP TABLE IF EXISTS public.post_comments CASCADE; -- Old name
DROP TABLE IF EXISTS public.comments CASCADE;   -- New name
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.follows CASCADE;   -- Old follow table
DROP TABLE IF EXISTS public.followers CASCADE; -- New follow table
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

-- 2. PROFILE ENHANCEMENTS
DO $$ 
BEGIN
    -- Username (Único)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;
    END IF;
    -- Bio
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio TEXT;
    END IF;
    -- Avatar URL (Compatibility with Instagram terminology)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
    -- Counts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='followers_count') THEN
        ALTER TABLE public.profiles ADD COLUMN followers_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='following_count') THEN
        ALTER TABLE public.profiles ADD COLUMN following_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='posts_count') THEN
        ALTER TABLE public.profiles ADD COLUMN posts_count INTEGER DEFAULT 0;
    END IF;
    
    -- Sync avatar_url with existing photo if available
    UPDATE public.profiles SET avatar_url = photo WHERE avatar_url IS NULL AND photo IS NOT NULL;
    -- Generate usernames for existing users if missing
    UPDATE public.profiles SET username = LOWER(REPLACE(name, ' ', '.')) || '_' || SUBSTR(id::text, 1, 4) WHERE username IS NULL;
END $$;

-- 3. NEW TABLES (V2)

-- POSTS
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    caption TEXT,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LIKES
CREATE TABLE public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- COMMENTS
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SAVES
CREATE TABLE public.saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- FOLLOWERS
CREATE TABLE public.followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

-- STORIES
CREATE TABLE public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- DIRECT (V2 Structure)
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.conversation_participants (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'audio', 'image', 'video')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TRIGGERS FOR SOCIAL COUNTS

-- Update Posts Count
CREATE OR REPLACE FUNCTION update_posts_count() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.profiles SET posts_count = posts_count + 1 WHERE id = NEW.user_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.profiles SET posts_count = posts_count - 1 WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_posts_count AFTER INSERT OR DELETE ON public.posts FOR EACH ROW EXECUTE PROCEDURE update_posts_count();

-- Update Likes Count
CREATE OR REPLACE FUNCTION update_likes_count() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_likes_count AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE PROCEDURE update_likes_count();

-- Update Comments Count
CREATE OR REPLACE FUNCTION update_comments_count() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_comments_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE PROCEDURE update_comments_count();

-- Update Followers Count
CREATE OR REPLACE FUNCTION update_follow_counts() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
        UPDATE public.profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_follow_counts AFTER INSERT OR DELETE ON public.followers FOR EACH ROW EXECUTE PROCEDURE update_follow_counts();

-- 5. NOTIFICATION TRIGGERS (Re-Linking to v2 Social)

CREATE OR REPLACE FUNCTION public.handle_v2_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
    notif_type TEXT;
    notif_title TEXT;
    notif_message TEXT;
    notif_link TEXT;
    sender_name TEXT;
BEGIN
    SELECT name INTO sender_name FROM public.profiles WHERE id = auth.uid();
    IF sender_name IS NULL THEN sender_name := 'Alguém'; END IF;

    IF (TG_TABLE_NAME = 'messages') THEN
        SELECT user_id INTO target_user_id FROM public.conversation_participants WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id LIMIT 1;
        notif_type := 'direct_message';
        notif_title := 'Nova Mensagem';
        notif_message := sender_name || ': ' || LEFT(NEW.content, 50);
        notif_link := '/direct/' || NEW.conversation_id;
    
    ELSIF (TG_TABLE_NAME = 'likes') THEN
        SELECT user_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
        IF target_user_id = NEW.user_id THEN RETURN NEW; END IF;
        notif_type := 'feed_like';
        notif_title := 'Nova Curtida';
        notif_message := sender_name || ' curtiu sua publicação.';
        notif_link := '/post/' || NEW.post_id;

    ELSIF (TG_TABLE_NAME = 'comments') THEN
        SELECT user_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
        IF target_user_id = NEW.user_id THEN RETURN NEW; END IF;
        notif_type := 'feed_comment';
        notif_title := 'Novo Comentário';
        notif_message := sender_name || ' comentou: ' || LEFT(NEW.comment_text, 50);
        notif_link := '/post/' || NEW.post_id;

    ELSIF (TG_TABLE_NAME = 'followers') THEN
        target_user_id := NEW.following_id;
        notif_type := 'new_follower';
        notif_title := 'Novo Seguidor';
        notif_message := sender_name || ' começou a seguir você.';
        notif_link := '/profile/' || NEW.follower_id;
    END IF;

    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (target_user_id, notif_type, notif_title, notif_message, notif_link);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Triggers for new v2 tables
DROP TRIGGER IF EXISTS on_new_message_v2 ON public.messages;
CREATE TRIGGER on_new_message_v2 AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION handle_v2_notification_trigger();

DROP TRIGGER IF EXISTS on_like_v2 ON public.likes;
CREATE TRIGGER on_like_v2 AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION handle_v2_notification_trigger();

DROP TRIGGER IF EXISTS on_comment_v2 ON public.comments;
CREATE TRIGGER on_comment_v2 AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION handle_v2_notification_trigger();

DROP TRIGGER IF EXISTS on_follower_v2 ON public.followers;
CREATE TRIGGER on_follower_v2 AFTER INSERT ON public.followers FOR EACH ROW EXECUTE FUNCTION handle_v2_notification_trigger();

-- 6. RLS POLICIES

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified)
CREATE POLICY "Public posts view" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Owner post CRUD" ON public.posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public interactions view" ON public.likes FOR SELECT USING (true);
CREATE POLICY "User like manage" ON public.likes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public comments view" ON public.comments FOR SELECT USING (true);
CREATE POLICY "User comment manage" ON public.comments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public followers view" ON public.followers FOR SELECT USING (true);
CREATE POLICY "User follow manage" ON public.followers FOR ALL USING (auth.uid() = follower_id);
CREATE POLICY "Owner story CRUD" ON public.stories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Story view" ON public.stories FOR SELECT USING (expires_at > NOW());
CREATE POLICY "Chat access" ON public.conversation_participants FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Message view" ON public.messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));
CREATE POLICY "Message send" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 7. PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 8. REALTIME
-- (Comentado pois a publicação 'supabase_realtime' já está definida como FOR ALL TABLES)
-- alter publication supabase_realtime add table posts, likes, comments, followers, stories, messages;
