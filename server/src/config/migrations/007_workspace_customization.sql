-- Migration 007 — Workspace customization (profession, vocabulary, modules, custom statuses)
-- Run in Supabase Dashboard > SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profession        TEXT         DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS vocabulary        JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enabled_modules   TEXT[]       DEFAULT ARRAY['tasks','projects','discussions','topics','timeline','standup','summary','testcases'],
  ADD COLUMN IF NOT EXISTS custom_statuses   JSONB        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workspace_name    TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workspace_logo_url TEXT        DEFAULT NULL;

-- Index for profession-based queries (admin analytics)
CREATE INDEX IF NOT EXISTS users_profession_idx ON public.users(profession);
