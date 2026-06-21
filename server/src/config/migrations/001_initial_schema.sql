-- ============================================================
-- Pinlooply — Initial Schema Migration
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- TABLES
-- Note: groups must be created before projects (FK dependency)
-- ============================================================

-- GROUPS (created before projects due to FK)
create table if not exists public.groups (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  owner_id    uuid references public.users(id),
  plan        text default 'free',
  invite_code text unique default substr(md5(random()::text), 1, 10),
  created_at  timestamptz default now()
);

-- USERS (extends Supabase auth.users)
create table if not exists public.users (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text unique not null,
  name       text,
  avatar_url text,
  mode       text default 'personal' check (mode in ('personal','group','team','org')),
  plan       text default 'free'     check (plan in ('free','paid')),
  created_at timestamptz default now()
);

-- Fix groups.owner_id FK now that users exists
alter table public.groups
  add constraint groups_owner_id_fkey
  foreign key (owner_id) references public.users(id)
  not valid;  -- "not valid" skips checking existing rows (safe for fresh tables)

-- PROJECTS
create table if not exists public.projects (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.users(id)  on delete cascade,
  group_id    uuid references public.groups(id) on delete set null,
  name        text not null,
  description text,
  status      text default 'active'   check (status in ('active','archived')),
  color       text default '#6366f1',
  created_at  timestamptz default now()
);

-- GROUP MEMBERS
create table if not exists public.group_members (
  id         uuid default gen_random_uuid() primary key,
  group_id   uuid references public.groups(id)  on delete cascade,
  user_id    uuid references public.users(id)   on delete cascade,
  role       text default 'member' check (role in ('owner','admin','member')),
  joined_at  timestamptz default now(),
  unique(group_id, user_id)
);

-- PROJECT MEMBERS
create table if not exists public.project_members (
  id         uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  user_id    uuid references public.users(id)    on delete cascade,
  role       text default 'member' check (role in ('owner','admin','member')),
  joined_at  timestamptz default now(),
  unique(project_id, user_id)
);

-- DISCUSSIONS
create table if not exists public.discussions (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references public.projects(id) on delete cascade,
  user_id     uuid references public.users(id),
  raw_text    text not null,
  ai_summary  text,
  source      text default 'manual' check (source in ('manual','pasted_slack','pasted_email','pasted_whatsapp')),
  processed   boolean default false,
  created_at  timestamptz default now()
);

-- TOPICS
create table if not exists public.topics (
  id         uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  title      text not null,
  summary    text,
  status     text default 'open' check (status in ('open','resolved')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TOPIC VERSIONS (history)
create table if not exists public.topic_versions (
  id             uuid default gen_random_uuid() primary key,
  topic_id       uuid references public.topics(id) on delete cascade,
  summary        text,
  changed_by     uuid references public.users(id),
  version_number integer,
  created_at     timestamptz default now()
);

-- DISCUSSION TOPIC MAP
create table if not exists public.discussion_topic_map (
  id            uuid default gen_random_uuid() primary key,
  discussion_id uuid references public.discussions(id) on delete cascade,
  topic_id      uuid references public.topics(id)      on delete cascade,
  unique(discussion_id, topic_id)
);

-- TASKS
create table if not exists public.tasks (
  id            uuid default gen_random_uuid() primary key,
  project_id    uuid references public.projects(id)    on delete cascade,
  topic_id      uuid references public.topics(id)      on delete set null,
  discussion_id uuid references public.discussions(id) on delete set null,
  title         text not null,
  description   text,
  type          text default 'task'    check (type     in ('task','test_case','deployment_check','backlog')),
  status        text default 'pending' check (status   in ('pending','in_progress','done')),
  priority      text default 'medium'  check (priority in ('high','medium','low')),
  assigned_to   uuid references public.users(id) on delete set null,
  assigned_by   uuid references public.users(id) on delete set null,
  due_date      date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- CONFLICTS
create table if not exists public.conflicts (
  id                uuid default gen_random_uuid() primary key,
  project_id        uuid references public.projects(id)    on delete cascade,
  topic_id          uuid references public.topics(id)      on delete cascade,
  description       text,
  old_value         text,
  new_value         text,
  discussion_id_old uuid references public.discussions(id),
  discussion_id_new uuid references public.discussions(id),
  detected_at       timestamptz default now()
);

-- AI CONFIG (admin panel)
create table if not exists public.ai_config (
  id          uuid default gen_random_uuid() primary key,
  plan_type   text check (plan_type in ('free','paid')),
  provider    text check (provider  in ('groq','claude','gemini','openai')),
  model_name  text,
  updated_by  uuid references public.users(id),
  updated_at  timestamptz default now(),
  unique(plan_type)
);

-- PUBLISH PAGES
create table if not exists public.publish_pages (
  id         uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  slug       text unique,
  is_active  boolean default true,
  created_at timestamptz default now()
);


-- ============================================================
-- AUTO-CREATE USER TRIGGER
-- Fires after a new row is inserted into auth.users
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users            enable row level security;
alter table public.groups           enable row level security;
alter table public.group_members    enable row level security;
alter table public.projects         enable row level security;
alter table public.project_members  enable row level security;
alter table public.discussions      enable row level security;
alter table public.topics           enable row level security;
alter table public.topic_versions   enable row level security;
alter table public.discussion_topic_map enable row level security;
alter table public.tasks            enable row level security;
alter table public.conflicts        enable row level security;
alter table public.ai_config        enable row level security;
alter table public.publish_pages    enable row level security;


-- -------- USERS --------
create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);


-- -------- GROUPS --------
-- Members can read groups they belong to
create policy "Group members can read group"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = auth.uid()
    )
  );

create policy "Owner can update group"
  on public.groups for update
  using (owner_id = auth.uid());

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() is not null);


-- -------- GROUP MEMBERS --------
create policy "Members can read group membership"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

create policy "Group owners/admins can manage members"
  on public.group_members for insert
  with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id
        and gm.user_id = auth.uid()
        and gm.role in ('owner','admin')
    )
  );

create policy "Members can leave group"
  on public.group_members for delete
  using (user_id = auth.uid());


-- -------- PROJECTS --------
-- User owns it, or is a project member, or is in the linked group
create policy "Users can read their projects"
  on public.projects for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can create projects"
  on public.projects for insert
  with check (user_id = auth.uid());

create policy "Owners can update projects"
  on public.projects for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = id and pm.user_id = auth.uid() and pm.role in ('owner','admin')
    )
  );

create policy "Owners can delete projects"
  on public.projects for delete
  using (user_id = auth.uid());


-- -------- PROJECT MEMBERS --------
create policy "Project members can read membership"
  on public.project_members for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "Project owner/admin can manage members"
  on public.project_members for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin')
    )
  );


-- -------- DISCUSSIONS --------
create policy "Project members can read discussions"
  on public.discussions for select
  using (
    exists (
      select 1 from public.projects p
      left join public.project_members pm on pm.project_id = p.id
      where p.id = project_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );

create policy "Project members can insert discussions"
  on public.discussions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      left join public.project_members pm on pm.project_id = p.id
      where p.id = project_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );

create policy "Owner can update discussion"
  on public.discussions for update
  using (user_id = auth.uid());


-- -------- TOPICS --------
create policy "Project members can read topics"
  on public.topics for select
  using (
    exists (
      select 1 from public.projects p
      left join public.project_members pm on pm.project_id = p.id
      where p.id = project_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );

create policy "Project members can insert topics"
  on public.topics for insert
  with check (
    exists (
      select 1 from public.projects p
      left join public.project_members pm on pm.project_id = p.id
      where p.id = project_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );

create policy "Project members can update topics"
  on public.topics for update
  using (
    exists (
      select 1 from public.projects p
      left join public.project_members pm on pm.project_id = p.id
      where p.id = project_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );


-- -------- TOPIC VERSIONS --------
create policy "Project members can read topic versions"
  on public.topic_versions for select
  using (
    exists (
      select 1 from public.topics t
      join public.projects p on p.id = t.project_id
      left join public.project_members pm on pm.project_id = p.id
      where t.id = topic_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );

create policy "Project members can insert topic versions"
  on public.topic_versions for insert
  with check (changed_by = auth.uid());


-- -------- DISCUSSION TOPIC MAP --------
create policy "Project members can read discussion topic map"
  on public.discussion_topic_map for select
  using (
    exists (
      select 1 from public.discussions d
      join public.projects p on p.id = d.project_id
      left join public.project_members pm on pm.project_id = p.id
      where d.id = discussion_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );

create policy "Project members can insert discussion topic map"
  on public.discussion_topic_map for insert
  with check (
    exists (
      select 1 from public.discussions d
      join public.projects p on p.id = d.project_id
      left join public.project_members pm on pm.project_id = p.id
      where d.id = discussion_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );


-- -------- TASKS --------
create policy "Project members can read tasks"
  on public.tasks for select
  using (
    exists (
      select 1 from public.projects p
      left join public.project_members pm on pm.project_id = p.id
      where p.id = project_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );

create policy "Project members can insert tasks"
  on public.tasks for insert
  with check (
    exists (
      select 1 from public.projects p
      left join public.project_members pm on pm.project_id = p.id
      where p.id = project_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );

create policy "Assigned users and project owners can update tasks"
  on public.tasks for update
  using (
    assigned_to = auth.uid()
    or assigned_by = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );


-- -------- CONFLICTS --------
create policy "Project members can read conflicts"
  on public.conflicts for select
  using (
    exists (
      select 1 from public.projects p
      left join public.project_members pm on pm.project_id = p.id
      where p.id = project_id
        and (p.user_id = auth.uid() or pm.user_id = auth.uid())
    )
  );


-- -------- AI CONFIG --------
-- Only service role (server) can write; reading is restricted to admin email
create policy "Admin can read ai_config"
  on public.ai_config for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.email = current_setting('app.admin_email', true)
    )
  );

-- Server-side writes use service role which bypasses RLS — no insert/update policy needed


-- -------- PUBLISH PAGES --------
-- Anyone (including anon) can read active published pages
create policy "Public can read active publish pages"
  on public.publish_pages for select
  using (is_active = true);

create policy "Project owners can manage publish pages"
  on public.publish_pages for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );


-- ============================================================
-- DEFAULT AI CONFIG
-- ============================================================

insert into public.ai_config (plan_type, provider, model_name)
values
  ('free', 'groq',   'llama3-8b-8192'),
  ('paid', 'claude', 'claude-sonnet-4-6')
on conflict (plan_type) do update
  set provider   = excluded.provider,
      model_name = excluded.model_name,
      updated_at = now();


-- ============================================================
-- UPDATED_AT TRIGGER (topics + tasks)
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_topics_updated_at on public.topics;
create trigger set_topics_updated_at
  before update on public.topics
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();
