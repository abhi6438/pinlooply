-- User feedback submissions
CREATE TABLE IF NOT EXISTS public.feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  name        TEXT,
  email       TEXT,
  category    TEXT        NOT NULL DEFAULT 'general', -- 'bug' | 'feature' | 'general'
  rating      SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form), only service role can read
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (true);
