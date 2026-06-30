-- Migration 009: Custom Task Fields
-- Creates workspace_custom_fields table (field definitions per user/workspace)
-- and task_custom_values table (field values per task)

-- ── Field definitions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_custom_fields (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,           -- snake_case identifier, e.g. "client_name"
  label       TEXT NOT NULL,           -- display label, e.g. "Client Name"
  field_type  TEXT NOT NULL DEFAULT 'text',  -- text | number | date | select | checkbox
  options     JSONB DEFAULT NULL,      -- for select type: ["Option A","Option B"]
  position    INTEGER DEFAULT 0,       -- display order
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, key)
);

-- ── Field values per task ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_custom_values (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  field_key   TEXT NOT NULL,
  value       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (task_id, field_key)
);

-- RLS
ALTER TABLE public.workspace_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_custom_values       ENABLE ROW LEVEL SECURITY;

-- Field definitions: owner can read/write
DROP POLICY IF EXISTS "fields_owner" ON public.workspace_custom_fields;
CREATE POLICY "fields_owner" ON public.workspace_custom_fields
  USING (auth.uid() = user_id);

-- Task values: task owner's workspace members can read/write
-- Simple approach: allow if the task belongs to a project the user can see
DROP POLICY IF EXISTS "task_values_access" ON public.task_custom_values;
CREATE POLICY "task_values_access" ON public.task_custom_values
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_custom_values.task_id
        AND (p.user_id = auth.uid() OR t.assigned_to = auth.uid())
    )
  );
