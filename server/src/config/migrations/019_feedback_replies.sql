-- ── Migration 019: Feedback replies + expand notification types ──────────────

-- 1. Expand notification type check to allow new types
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'task_completed',
    'task_overdue',
    'system_message',
    'feedback_reply'
  ));

-- 2. Add related_feedback_id to notifications (optional link back to feedback)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_feedback_id UUID REFERENCES public.feedback(id) ON DELETE SET NULL;

-- 3. Threaded replies for feedback (admin ↔ user conversation)
CREATE TABLE IF NOT EXISTS public.feedback_replies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id  UUID        NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  sender       TEXT        NOT NULL DEFAULT 'system', -- 'system' | 'admin' | 'user'
  message      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback_id
  ON public.feedback_replies(feedback_id);

ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;

-- Service role handles all inserts/selects (bypasses RLS)
-- Users can read replies for their own feedback via service role API
CREATE POLICY "Anyone can read replies"
  ON public.feedback_replies FOR SELECT
  USING (true);
