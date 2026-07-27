-- Migration 020: Two-level menu configuration
-- 1. Add enabled_modules to groups table (team-level config)
-- 2. Ensure site_config table exists for global config

-- ── Groups: add enabled_modules column ───────────────────────────────
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] DEFAULT NULL;

-- NULL means "all modules allowed" (inherits from global admin config)

-- ── site_config: seed default global module config if not present ─────
-- Only inserts if the key doesn't exist yet
INSERT INTO site_config (key, value)
VALUES (
  'global_modules',
  '["projects","tasks","timeline","topics","standup","summary","testcases"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
