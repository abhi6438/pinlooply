-- Migration 009: Drop hard-coded task status constraint
-- Migration 008 introduced per-project custom status pipelines, making the
-- static check constraint obsolete. Any text value is now a valid status key.
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;
