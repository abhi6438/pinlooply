-- Migration 008: Per-project custom status pipelines
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS custom_statuses JSONB DEFAULT NULL;

-- Example custom_statuses value stored per project:
-- [
--   { "key": "open",        "label": "Open",        "color": "warm",   "is_done": false },
--   { "key": "in_progress", "label": "In Progress", "color": "blue",   "is_done": false },
--   { "key": "closed",      "label": "Closed",      "color": "green",  "is_done": true  }
-- ]
