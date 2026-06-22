-- Migration 003: Add delete policy for tasks
-- Run in Supabase Dashboard > SQL Editor

create policy "Project owners can delete tasks"
  on public.tasks for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
    or assigned_by = auth.uid()
  );
