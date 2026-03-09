-- Melhora a tabela de mensagens para suportar mídias (Instagram Style)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Garante que a tabela de conversas tenha as colunas certas para o Inbox
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Cria políticas de acesso simples se não existirem (reforço)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can send messages in their conversations') THEN
        CREATE POLICY "Users can send messages in their conversations" ON messages FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view messages in their conversations') THEN
        CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT USING (true);
    END IF;
END $$;
