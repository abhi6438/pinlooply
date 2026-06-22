-- ============================================================
-- Fix: infinite recursion in group_members RLS policies
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- Drop the recursive policies
drop policy if exists "Members can read group membership"    on public.group_members;
drop policy if exists "Group owners/admins can manage members" on public.group_members;

-- Simple non-recursive SELECT: users can see their own memberships only
create policy "Users can read own group memberships"
  on public.group_members for select
  using (user_id = auth.uid());

-- INSERT: use a security-definer function to avoid recursion
create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid
      and user_id  = auth.uid()
      and role in ('owner', 'admin')
  )
$$;

create policy "Group owners/admins can insert members"
  on public.group_members for insert
  with check (
    public.is_group_admin(group_id)
    or auth.uid() = user_id  -- allow joining via invite (handled server-side)
  );
