-- Donor thank-you details submitted after donating
CREATE TABLE IF NOT EXISTS public.donor_details (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  method      TEXT        NOT NULL DEFAULT 'upi', -- 'upi' | 'paypal' | 'buymeacoffee'
  amount      TEXT,       -- optional, self-reported
  message     TEXT,       -- optional thank-you note from donor
  thanked     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.donor_details ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form), only service role can read
CREATE POLICY "Anyone can submit donor details"
  ON public.donor_details FOR INSERT
  WITH CHECK (true);
