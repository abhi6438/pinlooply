-- ── 027: Add Work Log to menu registry ───────────────────────
-- Adds the 'worklog' menu item so it appears in admin menu config
-- and can be enabled/disabled per workspace/group/user.

INSERT INTO menus (key, label, icon, nav_group, sort_order, always_on, description)
VALUES
  ('worklog', 'Work Log', '🕐', 'main', 115, false, 'Daily work log — time spent and updates per task')
ON CONFLICT (key) DO UPDATE SET
  label       = EXCLUDED.label,
  icon        = EXCLUDED.icon,
  nav_group   = EXCLUDED.nav_group,
  sort_order  = EXCLUDED.sort_order,
  always_on   = EXCLUDED.always_on,
  description = EXCLUDED.description;
