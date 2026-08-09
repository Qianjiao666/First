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

alter table public.profiles
  add column if not exists education jsonb not null default '{}'::jsonb;

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  content text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint feedback_author_name_length check (char_length(author_name) between 1 and 40),
  constraint feedback_content_length check (char_length(content) between 2 and 500),
  constraint feedback_status_value check (status in ('open', 'reviewed', 'planned', 'closed'))
);

create index if not exists feedback_messages_user_id_idx
  on public.feedback_messages (user_id);

create index if not exists feedback_messages_created_at_idx
  on public.feedback_messages (created_at desc);

alter table public.profiles enable row level security;
alter table public.career_progress enable row level security;
alter table public.feedback_messages enable row level security;

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

drop policy if exists "feedback_select_authenticated" on public.feedback_messages;
create policy "feedback_select_authenticated"
  on public.feedback_messages for select to authenticated
  using (true);

drop policy if exists "feedback_insert_own" on public.feedback_messages;
create policy "feedback_insert_own"
  on public.feedback_messages for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "feedback_delete_own" on public.feedback_messages;
create policy "feedback_delete_own"
  on public.feedback_messages for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.career_progress to authenticated;
revoke all on public.feedback_messages from anon;
revoke update on public.feedback_messages from authenticated;
grant select, insert, delete on public.feedback_messages to authenticated;
