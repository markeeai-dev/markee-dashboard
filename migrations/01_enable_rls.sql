-- Migration: Enable RLS on all unprotected tables
-- Run in Supabase SQL Editor
-- Date: 2026-07-02

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_update_admin_only"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.email = auth.jwt() ->> 'email'
        AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.email = auth.jwt() ->> 'email'
        AND u.role = 'admin'
    )
  );

CREATE POLICY "users_insert_admin_only"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.email = auth.jwt() ->> 'email'
        AND u.role = 'admin'
    )
  );

-- ============================================================
-- 2. SKILL_LIBRARY TABLE
-- ============================================================
ALTER TABLE skill_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_library_select_authenticated"
  ON skill_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "skill_library_insert_own"
  ON skill_library FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.jwt() ->> 'email');

CREATE POLICY "skill_library_update_own_or_admin"
  ON skill_library FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "skill_library_delete_own_or_admin"
  ON skill_library FOR DELETE
  TO authenticated
  USING (
    author_id = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

-- ============================================================
-- 3. AI_SESSIONS TABLE
-- ============================================================
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_sessions_select_own_or_admin"
  ON ai_sessions FOR SELECT
  TO authenticated
  USING (
    author_id = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "ai_sessions_insert_own"
  ON ai_sessions FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.jwt() ->> 'email');

-- ============================================================
-- 4. PROJECTS TABLE
-- ============================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_authenticated"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "projects_insert_admin_only"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "projects_update_admin_only"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "projects_delete_admin_only"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

-- ============================================================
-- 5. CHAT_SESSIONS TABLE
-- ============================================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_own"
  ON chat_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.jwt() ->> 'email')
  WITH CHECK (user_id = auth.jwt() ->> 'email');

CREATE POLICY "chat_sessions_admin_read"
  ON chat_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

-- ============================================================
-- 6. CHAT_MESSAGES TABLE
-- ============================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_own_session"
  ON chat_messages FOR ALL
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.jwt() ->> 'email'
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "chat_messages_admin_read"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

-- ============================================================
-- 7. AI_LICENSES TABLE
-- ============================================================
ALTER TABLE ai_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_licenses_select_own_or_admin"
  ON ai_licenses FOR SELECT
  TO authenticated
  USING (
    email = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "ai_licenses_admin_write"
  ON ai_licenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "ai_licenses_admin_update"
  ON ai_licenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "ai_licenses_admin_delete"
  ON ai_licenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

-- ============================================================
-- 8. AI_USAGE_STATS TABLE
-- ============================================================
ALTER TABLE ai_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_stats_select_own_or_admin"
  ON ai_usage_stats FOR SELECT
  TO authenticated
  USING (
    email = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "ai_usage_stats_insert_admin"
  ON ai_usage_stats FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

-- ============================================================
-- 9. USER_LIKES TABLE
-- ============================================================
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_likes_select_authenticated"
  ON user_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "user_likes_insert_own"
  ON user_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_email = auth.jwt() ->> 'email');

CREATE POLICY "user_likes_delete_own"
  ON user_likes FOR DELETE
  TO authenticated
  USING (user_email = auth.jwt() ->> 'email');
