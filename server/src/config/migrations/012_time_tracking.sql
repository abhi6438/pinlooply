-- Migration 012: Time Tracking
-- time_entries: manual or timer-logged time blocks per task

CREATE TABLE IF NOT EXISTS public.time_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_mins INTEGER NOT NULL DEFAULT 0,   -- total minutes logged
  notes         TEXT DEFAULT NULL,            -- optional description of work done
  logged_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS time_entries_task_id  ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS time_entries_user_id  ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS time_entries_logged_at ON public.time_entries(logged_at);

-- RLS: users can only see/edit their own entries
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_entries_owner" ON public.time_entries;
CREATE POLICY "time_entries_owner" ON public.time_entries
  USING (auth.uid() = user_id);
