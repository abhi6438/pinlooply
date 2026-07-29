-- Task links: connect tasks with typed relationships
-- link_type semantics (stored on the source side):
--   relates_to  — general relation (symmetric)
--   blocks      — source blocks target
--   blocked_by  — source is blocked by target
--   duplicates  — source duplicates target
--   parent      — source is the parent of target (target is a sub-task)
--   child       — source is a sub-task of target

CREATE TABLE IF NOT EXISTS task_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type       text NOT NULL DEFAULT 'relates_to'
                       CHECK (link_type IN ('relates_to','blocks','blocked_by','duplicates','parent','child')),
  created_by      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate links of the same type between the same two tasks
  UNIQUE (source_task_id, target_task_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_task_links_source ON task_links(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_target ON task_links(target_task_id);

-- RLS
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_links_read"   ON task_links;
DROP POLICY IF EXISTS "task_links_insert" ON task_links;
DROP POLICY IF EXISTS "task_links_delete" ON task_links;

-- Read: any project member can see links on tasks they can access
CREATE POLICY "task_links_read" ON task_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.id = task_links.source_task_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = p.group_id AND gm.user_id = auth.uid())
        )
    )
  );

-- Insert: authenticated users (server validates access)
CREATE POLICY "task_links_insert" ON task_links
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Delete: only the creator can remove a link
CREATE POLICY "task_links_delete" ON task_links
  FOR DELETE USING (created_by = auth.uid());
