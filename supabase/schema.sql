-- Run this file once in the Supabase SQL Editor.
-- The browser only needs the project's Publishable key; never expose service_role keys.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '航线同学',
  grade text not null default '大二',
  major text not null default '计算机',
  target_role text not null default 'frontend',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mission_state jsonb not null default '[true, false, false]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.career_progress enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "career_progress_select_own" on public.career_progress;
create policy "career_progress_select_own"
  on public.career_progress for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "career_progress_insert_own" on public.career_progress;
create policy "career_progress_insert_own"
  on public.career_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "career_progress_update_own" on public.career_progress;
create policy "career_progress_update_own"
  on public.career_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.career_progress to authenticated;
