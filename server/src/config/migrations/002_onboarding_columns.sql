-- Migration 002 — Add onboarding columns to users
-- Run in Supabase Dashboard > SQL Editor

alter table public.users
  add column if not exists onboarding_complete boolean default false,
  add column if not exists onboarding_step     integer default 1;
