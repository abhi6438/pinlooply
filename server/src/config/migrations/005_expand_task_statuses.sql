-- Migration 005: Expand task status values for Jira-like Kanban workflow
-- Run this in Supabase SQL Editor

-- Drop the old restrictive check constraint
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add expanded constraint with all Kanban workflow statuses
-- 'pending' stays as the DB value for the "To Do" column
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_status_check
CHECK (status IN (
  'pending',       -- To Do (frontend alias: 'todo')
  'in_progress',   -- In Progress
  'blocked',       -- Blocked
  'in_review',     -- In Review
  'done',          -- Done
  'pending_uat',   -- Pending UAT
  'pending_prod',  -- Pending Prod
  'released'       -- Released
));
