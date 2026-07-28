-- Task updates / activity feed
CREATE TABLE IF NOT EXISTS task_updates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  update_type text NOT NULL DEFAULT 'update'
                   CHECK (update_type IN ('update','blocker','opinion','resolved')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_created ON task_updates(task_id, created_at DESC);

-- RLS
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;

-- Allow task-project members to read updates
CREATE POLICY "task_updates_read" ON task_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.id = task_updates.task_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = p.group_id AND gm.user_id = auth.uid()
          )
        )
    )
  );

-- Allow any authenticated user to insert (server validates access)
CREATE POLICY "task_updates_insert" ON task_updates
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow author to delete their own update
CREATE POLICY "task_updates_delete" ON task_updates
  FOR DELETE USING (user_id = auth.uid());
