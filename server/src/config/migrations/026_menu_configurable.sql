-- ── 026: Make all sidebar items configurable + add missing ones ───────
-- 1. Add Data Management to the registry (was missing entirely)
-- 2. Set always_on = false for items that should be hide/show-able
-- Keep dashboard + settings + help always_on so the app remains usable

INSERT INTO menus (key, label, icon, nav_group, sort_order, always_on, description)
VALUES
  ('datamanagement', 'Data Management', '🗄️', 'settings', 30, false, 'Import / export and data tools')
ON CONFLICT (key) DO UPDATE SET
  label       = EXCLUDED.label,
  icon        = EXCLUDED.icon,
  nav_group   = EXCLUDED.nav_group,
  sort_order  = EXCLUDED.sort_order,
  always_on   = EXCLUDED.always_on,
  description = EXCLUDED.description;

-- Make previously locked items configurable
UPDATE menus SET always_on = false
WHERE key IN ('log', 'mytasks', 'timereports', 'team', 'manager');

-- Ensure core items stay always-on (safety net)
UPDATE menus SET always_on = true
WHERE key IN ('dashboard', 'settings', 'help');
