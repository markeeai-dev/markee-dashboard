-- Migration: RPC functions for atomic operations
-- Run in Supabase SQL Editor after 01_enable_rls.sql
-- Date: 2026-07-02

-- ============================================================
-- 1. Atomic toggle like (replaces read-then-write race)
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_like(p_skill_id INT, p_user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id INT;
  v_liked BOOLEAN;
BEGIN
  SELECT id INTO v_existing_id
  FROM user_likes
  WHERE user_email = p_user_email AND skill_id = p_skill_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    DELETE FROM user_likes WHERE id = v_existing_id;
    UPDATE skill_library SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_skill_id;
    v_liked := false;
  ELSE
    INSERT INTO user_likes (user_email, skill_id) VALUES (p_user_email, p_skill_id);
    UPDATE skill_library SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = p_skill_id;
    v_liked := true;
  END IF;

  RETURN jsonb_build_object('id', p_skill_id, 'liked', v_liked);
END;
$$;

-- ============================================================
-- 2. Atomic append to master_summary (replaces read-modify-write race)
-- ============================================================
CREATE OR REPLACE FUNCTION append_project_summary(p_project_id INT, p_item_json TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current TEXT;
  v_parsed JSONB;
  v_new_item JSONB;
  v_result JSONB;
BEGIN
  SELECT master_summary INTO v_current FROM projects WHERE id = p_project_id;

  BEGIN
    v_new_item := p_item_json::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid JSON input: %', p_item_json;
  END;

  IF v_current IS NULL OR v_current = '' OR v_current = '[]' THEN
    v_parsed := '[]'::jsonb;
  ELSE
    BEGIN
      v_parsed := v_current::jsonb;
      IF jsonb_typeof(v_parsed) != 'array' THEN
        v_parsed := '[]'::jsonb;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_parsed := '[]'::jsonb;
    END;
  END IF;

  v_result := v_parsed || v_new_item;

  UPDATE projects
  SET master_summary = v_result::text,
      last_summarized_at = NOW()
  WHERE id = p_project_id;
END;
$$;

-- ============================================================
-- 3. Keep existing increment/decrement RPCs (if they exist)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_like(skill_id_param INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE skill_library SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = skill_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_like(skill_id_param INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE skill_library SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = skill_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION increment_download(skill_id_param INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE skill_library SET downloads_count = COALESCE(downloads_count, 0) + 1 WHERE id = skill_id_param;
END;
$$;
