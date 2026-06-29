-- Migration 010: Workspace Branding
-- Adds accent_color (hex string) to the users table

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT NULL;
