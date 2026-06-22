-- ── Migration 002: Task Assignment + Notifications ──────────────────────────

-- Add assigned_to_name to tasks (AI-suggested name before UUID lookup)
alter table public.tasks
  add column if not exists assigned_to_name text;

-- ── Notifications table ─────────────────────────────────────────────────────
create table if not exists public.notifications (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.users(id) on delete cascade not null,
  type            text not null check (type in ('task_assigned', 'task_completed', 'task_overdue')),
  title           text not null,
  body            text,
  related_task_id uuid references public.tasks(id) on delete cascade,
  is_read         boolean default false,
  created_at      timestamptz default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_unread  on public.notifications(user_id, is_read) where is_read = false;

-- RLS
alter table public.notifications enable row level security;

drop policy if exists "Users see own notifications"  on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;

create policy "Users see own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Service role inserts notifications (done via supabaseAdmin, bypasses RLS)

-- Enable realtime for notifications
alter publication supabase_realtime add table public.notifications;
