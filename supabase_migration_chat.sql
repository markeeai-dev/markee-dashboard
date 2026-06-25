-- Run this in Supabase SQL Editor to add chat support tables

CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'Hoi thoai moi',
  project_id INT,
  model TEXT DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  injected_assets JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations: users can read/write their own
CREATE POLICY "Users can manage own conversations" ON conversations
  FOR ALL USING (user_id = auth.jwt() ->> 'email')
  WITH CHECK (user_id = auth.jwt() ->> 'email');

-- Messages: users can read/write messages in their own conversations
CREATE POLICY "Users can manage messages in own conversations" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.jwt() ->> 'email'
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.jwt() ->> 'email'
    )
  );

-- Admins can read all conversations
CREATE POLICY "Admins can read all conversations" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

-- Admins can read all messages
CREATE POLICY "Admins can read all messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );
