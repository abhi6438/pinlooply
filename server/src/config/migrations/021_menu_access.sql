-- ── 021: DB-driven menu access control ───────────────────────────────
-- Creates menus (master registry) and menu_access (per-level disable rules).
-- Migrates from site_config.global_modules to menu_access level='global'.
--
-- Run in Supabase SQL Editor.

-- ── 1. Master menu registry ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menus (
  key         TEXT        PRIMARY KEY,
  label       TEXT        NOT NULL,
  icon        TEXT,
  nav_group   TEXT        NOT NULL DEFAULT 'main',
  sort_order  INT         NOT NULL DEFAULT 0,
  always_on   BOOLEAN     NOT NULL DEFAULT false,
  description TEXT
);

-- ── 2. Seed all nav items (idempotent) ────────────────────────────────
INSERT INTO menus (key, label, icon, nav_group, sort_order, always_on, description) VALUES
  ('dashboard',   'Dashboard',       '🏠', 'main',     10,  true,  'Home dashboard with overview'),
  ('log',         'Log Discussion',  '💬', 'main',     20,  true,  'Log meeting notes and discussions'),
  ('mytasks',     'My Tasks',        '✔️', 'main',     30,  true,  'Personal task inbox'),
  ('projects',    'Projects',        '📁', 'main',     40,  false, 'Project boards and tracking'),
  ('tasks',       'Tasks',           '✅', 'main',     50,  false, 'Task lists and assignments'),
  ('timeline',    'Timeline',        '📅', 'main',     60,  false, 'Gantt / calendar view'),
  ('topics',      'Topics',          '🏷️', 'main',     70,  false, 'Decisions and discussion topics'),
  ('standup',     'Standup',         '📋', 'main',     80,  false, 'Daily standup generator'),
  ('summary',     'Summary',         '📊', 'main',     90,  false, 'Auto weekly / monthly report'),
  ('testcases',   'Test Cases',      '🧪', 'main',     100, false, 'QA test case management'),
  ('timereports', 'Time Reports',    '⏱️', 'main',     110, true,  'Time tracking and reports'),
  ('team',        'Team',            '👥', 'team',     10,  true,  'Team members (team mode only)'),
  ('manager',     'Manager',         '📈', 'team',     20,  true,  'Manager overview (team mode only)'),
  ('help',        'Help',            '❓', 'settings', 10,  true,  'Help and support'),
  ('settings',    'Settings',        '⚙️', 'settings', 20,  true,  'Workspace settings')
ON CONFLICT (key) DO UPDATE SET
  label       = EXCLUDED.label,
  icon        = EXCLUDED.icon,
  nav_group   = EXCLUDED.nav_group,
  sort_order  = EXCLUDED.sort_order,
  always_on   = EXCLUDED.always_on,
  description = EXCLUDED.description;

-- ── 3. Access rules table ─────────────────────────────────────────────
-- A row here means that level/target has DISABLED that menu key.
-- No row = not disabled (default: enabled).
-- always_on menus are never disabled regardless of rules.
CREATE TABLE IF NOT EXISTS menu_access (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key    TEXT        NOT NULL REFERENCES menus(key) ON DELETE CASCADE,
  level       TEXT        NOT NULL CHECK (level IN ('global', 'group', 'user')),
  target_id   UUID,          -- NULL for global; group_id for group; user_id for user
  enabled     BOOLEAN     NOT NULL DEFAULT false,  -- always false (we only store disabled rules)
  updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: one rule per (menu_key, level) pair per target
CREATE UNIQUE INDEX IF NOT EXISTS menu_access_global_uniq
  ON menu_access(menu_key, level) WHERE target_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS menu_access_targeted_uniq
  ON menu_access(menu_key, level, target_id) WHERE target_id IS NOT NULL;

-- ── 4. Migrate from site_config.global_modules → menu_access ─────────
-- Only runs if no global rules exist yet (idempotent).
DO $$
DECLARE
  cfg_value    JSONB;
  all_keys     TEXT[] := ARRAY['projects','tasks','timeline','topics','standup','summary','testcases'];
  enabled_keys TEXT[];
  k            TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM menu_access WHERE level = 'global' LIMIT 1) THEN
    RETURN;  -- already migrated
  END IF;

  SELECT value INTO cfg_value
    FROM site_config WHERE key = 'global_modules';

  IF cfg_value IS NOT NULL THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(cfg_value)) INTO enabled_keys;
    FOREACH k IN ARRAY all_keys LOOP
      IF NOT (k = ANY(enabled_keys)) THEN
        INSERT INTO menu_access (menu_key, level, target_id, enabled)
          VALUES (k, 'global', NULL, false)
          ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- ── 5. RLS ────────────────────────────────────────────────────────────
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menus_read_all" ON menus;
CREATE POLICY "menus_read_all" ON menus FOR SELECT USING (true);

ALTER TABLE menu_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_access_service_only" ON menu_access;
CREATE POLICY "menu_access_service_only" ON menu_access USING (false);
