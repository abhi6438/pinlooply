-- Sequential task number for easy reference in meetings
-- Creates a global auto-incrementing number like #1, #2, #3...

-- 1. Create the sequence
CREATE SEQUENCE IF NOT EXISTS tasks_task_number_seq START 1;

-- 2. Add the column (nullable first so we can backfill)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_number INTEGER;

-- 3. Backfill existing tasks ordered by creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST) AS rn
  FROM tasks
  WHERE task_number IS NULL
)
UPDATE tasks
SET task_number = numbered.rn
FROM numbered
WHERE tasks.id = numbered.id;

-- 4. Advance the sequence past the highest existing number
SELECT setval(
  'tasks_task_number_seq',
  COALESCE((SELECT MAX(task_number) FROM tasks), 0) + 1
);

-- 5. Set the default so new tasks get the next number automatically
ALTER TABLE tasks
  ALTER COLUMN task_number SET DEFAULT nextval('tasks_task_number_seq');

-- 6. Unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_task_number ON tasks (task_number);
