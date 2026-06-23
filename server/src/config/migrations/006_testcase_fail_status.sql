-- Migration 006: Allow 'fail' as a valid test case status
-- The tasks_status_check constraint from migration 005 covers workflow statuses.
-- We need to add 'fail' for test case pass/fail tracking.
-- Run this in Supabase SQL Editor.

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
CHECK (status IN (
  'pending',       -- To Do / test case pending
  'in_progress',   -- In Progress
  'blocked',       -- Blocked
  'in_review',     -- In Review
  'done',          -- Done / test case pass
  'fail',          -- Test case fail
  'pending_uat',   -- Pending UAT
  'pending_prod',  -- Pending Prod
  'released'       -- Released
));
