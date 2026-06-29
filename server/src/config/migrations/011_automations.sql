-- Migration 011: Automations
-- automation_rules: workspace-level no-code automation rules
-- recurrence fields on tasks for recurring task support

-- ── Automation rules ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  -- Trigger: what starts this rule
  trigger_type TEXT NOT NULL,        -- status_change | discussion_saved | overdue | recurring
  trigger_config JSONB DEFAULT '{}', -- e.g. { "from_status": "in_progress", "to_status": "done" }
  -- Action: what happens
  action_type  TEXT NOT NULL,        -- notify | create_tasks | mark_overdue
  action_config JSONB DEFAULT '{}',  -- e.g. { "notify_role": "owner" } or { "auto_create": true }
  -- Scope
  project_id   UUID REFERENCES public.projects(id) ON DELETE CASCADE DEFAULT NULL, -- null = all projects
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recurrence on tasks ───────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT DEFAULT NULL,   -- daily | weekly | monthly | none
  ADD COLUMN IF NOT EXISTS recurrence_end  DATE DEFAULT NULL,   -- stop spawning after this date
  ADD COLUMN IF NOT EXISTS parent_task_id  UUID DEFAULT NULL REFERENCES public.tasks(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_owner" ON public.automation_rules
  USING (auth.uid() = user_id);
