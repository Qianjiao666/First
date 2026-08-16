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

-- Global community foundation. These records are intentionally separate from
-- profiles because authenticated users can update their own private profile.
do $$
begin
  create type public.user_role as enum ('USER', 'MODERATOR', 'ADMIN');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.sensitive_word_level as enum ('WARN', 'MUTE');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.user_public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '航线同学',
  role public.user_role not null default 'USER',
  reputation integer not null default 0 check (reputation >= 0),
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_moderation_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  muted_until timestamptz,
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount integer not null check (amount <> 0),
  reason text not null check (char_length(reason) between 1 and 160),
  source_resource text not null check (char_length(source_resource) between 1 and 64),
  source_id uuid,
  created_by_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sensitive_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique check (char_length(word) between 1 and 80),
  level public.sensitive_word_level not null default 'WARN',
  created_by_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.redeem_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 4 and 64),
  reward_reputation integer not null check (reward_reputation between 1 and 10000),
  reward_title text check (reward_title is null or char_length(reward_title) between 1 and 80),
  max_uses integer not null check (max_uses > 0),
  current_uses integer not null default 0 check (current_uses between 0 and max_uses),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.redeem_code_usages (
  id uuid primary key default gen_random_uuid(),
  redeem_code_id uuid not null references public.redeem_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reputation_event_id uuid references public.reputation_events(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (redeem_code_id, user_id)
);

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete restrict,
  to_user_id uuid not null references auth.users(id) on delete restrict,
  reputation_transferred integer not null default 0 check (reputation_transferred >= 0),
  operated_by_id uuid not null references auth.users(id) on delete restrict,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index if not exists reputation_events_user_created_idx
  on public.reputation_events (user_id, created_at desc);

create index if not exists sensitive_words_level_idx
  on public.sensitive_words (level);

create index if not exists redeem_codes_active_expiry_idx
  on public.redeem_codes (is_active, expires_at);

create index if not exists redeem_code_usages_user_idx
  on public.redeem_code_usages (user_id, redeemed_at desc);

create index if not exists account_transfers_from_user_idx
  on public.account_transfers (from_user_id, created_at desc);

create or replace function public.touch_global_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.initialize_global_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_public_profiles (user_id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '航线同学'))
  on conflict (user_id) do nothing;

  insert into public.user_moderation_state (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_public_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_public_profiles (user_id, display_name)
  values (new.id, new.display_name)
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists profiles_sync_public_display_name on public.profiles;
create trigger profiles_sync_public_display_name
after insert or update of display_name on public.profiles
for each row execute function public.sync_public_display_name();

drop trigger if exists on_auth_user_created_global_profile on auth.users;
create trigger on_auth_user_created_global_profile
after insert on auth.users
for each row execute function public.initialize_global_user_profile();

drop trigger if exists user_public_profiles_touch_updated_at on public.user_public_profiles;
create trigger user_public_profiles_touch_updated_at
before update on public.user_public_profiles
for each row execute function public.touch_global_updated_at();

drop trigger if exists user_moderation_state_touch_updated_at on public.user_moderation_state;
create trigger user_moderation_state_touch_updated_at
before update on public.user_moderation_state
for each row execute function public.touch_global_updated_at();

drop trigger if exists sensitive_words_touch_updated_at on public.sensitive_words;
create trigger sensitive_words_touch_updated_at
before update on public.sensitive_words
for each row execute function public.touch_global_updated_at();

drop trigger if exists redeem_codes_touch_updated_at on public.redeem_codes;
create trigger redeem_codes_touch_updated_at
before update on public.redeem_codes
for each row execute function public.touch_global_updated_at();

insert into public.user_public_profiles (user_id, display_name)
select
  users.id,
  coalesce(nullif(profiles.display_name, ''), nullif(users.raw_user_meta_data ->> 'display_name', ''), '航线同学')
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
on conflict (user_id) do update
set display_name = excluded.display_name,
    updated_at = now();

insert into public.user_moderation_state (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.user_public_profiles enable row level security;
alter table public.user_moderation_state enable row level security;
alter table public.reputation_events enable row level security;
alter table public.sensitive_words enable row level security;
alter table public.redeem_codes enable row level security;
alter table public.redeem_code_usages enable row level security;
alter table public.account_transfers enable row level security;

drop policy if exists "public_profiles_read" on public.user_public_profiles;
create policy "public_profiles_read"
  on public.user_public_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "moderation_state_read_own" on public.user_moderation_state;
create policy "moderation_state_read_own"
  on public.user_moderation_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_public_profiles from anon, authenticated;
revoke all on public.user_moderation_state from anon, authenticated;
revoke all on public.reputation_events from anon, authenticated;
revoke all on public.sensitive_words from anon, authenticated;
revoke all on public.redeem_codes from anon, authenticated;
revoke all on public.redeem_code_usages from anon, authenticated;
revoke all on public.account_transfers from anon, authenticated;
grant select on public.user_public_profiles to anon, authenticated;
grant select on public.user_moderation_state to authenticated;

create or replace function public.apply_reputation_event(
  p_event_key text,
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_source_resource text,
  p_source_id uuid,
  p_actor_id uuid
)
returns table (applied boolean, event_id uuid, reputation integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_event_id uuid;
  current_reputation integer;
begin
  if p_event_key is null or char_length(trim(p_event_key)) = 0 then
    raise exception 'event_key is required' using errcode = '22023';
  end if;

  if p_amount = 0 then
    raise exception 'amount must not be zero' using errcode = '22023';
  end if;

  insert into public.reputation_events (
    event_key,
    user_id,
    amount,
    reason,
    source_resource,
    source_id,
    created_by_id
  )
  values (
    p_event_key,
    p_user_id,
    p_amount,
    p_reason,
    p_source_resource,
    p_source_id,
    p_actor_id
  )
  on conflict (event_key) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    select user_public_profiles.reputation
    into current_reputation
    from public.user_public_profiles
    where user_id = p_user_id;

    return query select false, null::uuid, coalesce(current_reputation, 0);
    return;
  end if;

  update public.user_public_profiles
  set reputation = greatest(0, reputation + p_amount),
      updated_at = now()
  where user_id = p_user_id
  returning user_public_profiles.reputation into current_reputation;

  if current_reputation is null then
    raise exception 'public profile not found for user' using errcode = '23503';
  end if;

  return query select true, inserted_event_id, current_reputation;
end;
$$;

create or replace function public.set_user_mute(
  p_user_id uuid,
  p_muted_until timestamptz,
  p_actor_id uuid
)
returns public.user_moderation_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.user_moderation_state;
begin
  insert into public.user_moderation_state (user_id, muted_until, updated_by_id)
  values (p_user_id, p_muted_until, p_actor_id)
  on conflict (user_id) do update
  set muted_until = excluded.muted_until,
      updated_by_id = excluded.updated_by_id,
      updated_at = now()
  returning * into result;

  return result;
end;
$$;

create or replace function public.get_public_user_identity(p_user_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role public.user_role,
  reputation integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    profiles.user_id,
    profiles.display_name,
    profiles.role,
    profiles.reputation
  from public.user_public_profiles as profiles
  where profiles.user_id = p_user_id;
$$;

create or replace function public.get_user_capabilities()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select case profiles.role
    when 'ADMIN'::public.user_role then array[
      'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
      'forum:deleteOwnPost', 'forum:deleteOwnComment', 'forum:deleteAnyPost', 'forum:deleteAnyComment',
      'forum:pinPost', 'forum:lockPost', 'forum:manageCategories', 'forum:manageTags',
      'admin:access', 'admin:manageForum', 'admin:manageUsers', 'admin:manageRedeemCodes',
      'admin:manageSensitiveWords', 'admin:transferAccount', 'tasks:create', 'tasks:update',
      'tasks:publish', 'tasks:close', 'tasks:archive', 'tasks:delete',
      'tasks:manageCategories', 'tasks:manage', 'tasks:apply', 'tasks:assign',
      'tasks:submit', 'tasks:complete'
    ]
    when 'MODERATOR'::public.user_role then array[
      'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
      'forum:deleteOwnPost', 'forum:deleteOwnComment', 'forum:deleteAnyPost', 'forum:deleteAnyComment',
      'forum:pinPost', 'forum:lockPost', 'admin:access', 'admin:manageForum',
      'tasks:apply', 'tasks:submit'
    ]
    else array[
      'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
      'forum:deleteOwnPost', 'forum:deleteOwnComment', 'tasks:apply', 'tasks:submit'
    ]
  end
  from public.user_public_profiles as profiles
  where profiles.user_id = (select auth.uid());
$$;

revoke all on function public.apply_reputation_event(text, uuid, integer, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_reputation_event(text, uuid, integer, text, text, uuid, uuid)
  to service_role;

revoke all on function public.set_user_mute(uuid, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.set_user_mute(uuid, timestamptz, uuid)
  to service_role;

grant execute on function public.get_public_user_identity(uuid)
  to anon, authenticated;
grant execute on function public.get_user_capabilities()
  to authenticated;

do $$
begin
  create type public.forum_content_status as enum ('PUBLISHED', 'DELETED');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 240),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name text not null check (char_length(name) between 1 and 32),
  color text not null default '#139b72' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.forum_categories (slug, name, description, sort_order, is_active)
values
  ('career-planning', '职业规划', '讨论方向选择、成长路径与求职节奏。', 10, true),
  ('resume-projects', '简历与项目', '交流简历表达、项目经历与作品集打磨。', 20, true),
  ('interview-review', '面试复盘', '沉淀真实面试问题、回答思路与复盘经验。', 30, true),
  ('campus-opportunities', '校招机会', '分享校招、实习、竞赛与校园机会。', 40, true)
on conflict (slug) do nothing;

insert into public.forum_tags (slug, name, color)
values
  ('planning', '规划', '#2B6EF0'),
  ('resume', '简历', '#139B72'),
  ('interview', '面试', '#8A5CF5'),
  ('internship', '实习', '#D06B32')
on conflict (slug) do nothing;

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 160),
  content text not null check (char_length(content) between 3 and 10000),
  status public.forum_content_status not null default 'PUBLISHED',
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  score integer not null default 0,
  upvote_count integer not null default 0 check (upvote_count >= 0),
  downvote_count integer not null default 0 check (downvote_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  content text not null check (char_length(content) between 2 and 5000),
  status public.forum_content_status not null default 'PUBLISHED',
  score integer not null default 0,
  upvote_count integer not null default 0 check (upvote_count >= 0),
  downvote_count integer not null default 0 check (downvote_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.forum_post_tags (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  tag_id uuid not null references public.forum_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);

create table if not exists public.forum_votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references auth.users(id) on delete restrict,
  post_id uuid references public.forum_posts(id) on delete restrict,
  comment_id uuid references public.forum_comments(id) on delete restrict,
  value smallint not null check (value in (-1, 1)),
  is_active boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((post_id is not null)::integer + (comment_id is not null)::integer = 1)
);

create unique index if not exists forum_votes_unique_post_voter_idx
  on public.forum_votes (voter_id, post_id)
  where post_id is not null;

create unique index if not exists forum_votes_unique_comment_voter_idx
  on public.forum_votes (voter_id, comment_id)
  where comment_id is not null;

create index if not exists forum_categories_active_sort_idx
  on public.forum_categories (is_active, sort_order, name);

create index if not exists forum_posts_category_listing_idx
  on public.forum_posts (category_id, is_pinned desc, created_at desc, id desc)
  where status = 'PUBLISHED';

create index if not exists forum_posts_author_idx
  on public.forum_posts (author_id, created_at desc);

create index if not exists forum_comments_post_listing_idx
  on public.forum_comments (post_id, created_at asc, id asc)
  where status = 'PUBLISHED';

create index if not exists forum_comments_author_idx
  on public.forum_comments (author_id, created_at desc);

create index if not exists forum_post_tags_tag_idx
  on public.forum_post_tags (tag_id, post_id);

drop trigger if exists forum_categories_touch_updated_at on public.forum_categories;
create trigger forum_categories_touch_updated_at
before update on public.forum_categories
for each row execute function public.touch_global_updated_at();

drop trigger if exists forum_tags_touch_updated_at on public.forum_tags;
create trigger forum_tags_touch_updated_at
before update on public.forum_tags
for each row execute function public.touch_global_updated_at();

drop trigger if exists forum_posts_touch_updated_at on public.forum_posts;
create trigger forum_posts_touch_updated_at
before update on public.forum_posts
for each row execute function public.touch_global_updated_at();

drop trigger if exists forum_comments_touch_updated_at on public.forum_comments;
create trigger forum_comments_touch_updated_at
before update on public.forum_comments
for each row execute function public.touch_global_updated_at();

drop trigger if exists forum_votes_touch_updated_at on public.forum_votes;
create trigger forum_votes_touch_updated_at
before update on public.forum_votes
for each row execute function public.touch_global_updated_at();

alter table public.forum_categories enable row level security;
alter table public.forum_tags enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_post_tags enable row level security;
alter table public.forum_votes enable row level security;

drop policy if exists "forum_categories_public_read" on public.forum_categories;
create policy "forum_categories_public_read"
  on public.forum_categories for select to anon, authenticated
  using (is_active);

drop policy if exists "forum_tags_public_read" on public.forum_tags;
create policy "forum_tags_public_read"
  on public.forum_tags for select to anon, authenticated
  using (true);

drop policy if exists "forum_posts_public_read" on public.forum_posts;
create policy "forum_posts_public_read"
  on public.forum_posts for select to anon, authenticated
  using (status = 'PUBLISHED');

drop policy if exists "forum_comments_public_read" on public.forum_comments;
create policy "forum_comments_public_read"
  on public.forum_comments for select to anon, authenticated
  using (
    status = 'PUBLISHED'
    and exists (
      select 1
      from public.forum_posts as posts
      where posts.id = forum_comments.post_id
        and posts.status = 'PUBLISHED'
    )
  );

drop policy if exists "forum_post_tags_public_read" on public.forum_post_tags;
create policy "forum_post_tags_public_read"
  on public.forum_post_tags for select to anon, authenticated
  using (
    exists (
      select 1
      from public.forum_posts as posts
      where posts.id = forum_post_tags.post_id
        and posts.status = 'PUBLISHED'
    )
  );

revoke all on public.forum_categories from anon, authenticated;
revoke all on public.forum_tags from anon, authenticated;
revoke all on public.forum_posts from anon, authenticated;
revoke all on public.forum_comments from anon, authenticated;
revoke all on public.forum_post_tags from anon, authenticated;
revoke all on public.forum_votes from anon, authenticated;
grant select on public.forum_categories, public.forum_tags, public.forum_posts,
  public.forum_comments, public.forum_post_tags to anon, authenticated;

create or replace function public.create_forum_post(
  p_actor_id uuid,
  p_category_id uuid,
  p_title text,
  p_content text,
  p_tag_ids uuid[] default '{}'::uuid[]
)
returns public.forum_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_post public.forum_posts;
begin
  if not exists (
    select 1 from public.forum_categories
    where id = p_category_id and is_active
  ) then
    raise exception 'forum category is unavailable' using errcode = '23503';
  end if;

  insert into public.forum_posts (category_id, author_id, title, content)
  values (p_category_id, p_actor_id, trim(p_title), trim(p_content))
  returning * into created_post;

  insert into public.forum_post_tags (post_id, tag_id)
  select created_post.id, tags.id
  from public.forum_tags as tags
  where tags.id = any(coalesce(p_tag_ids, '{}'::uuid[]))
  on conflict do nothing;

  return created_post;
end;
$$;

create or replace function public.update_forum_post(
  p_actor_id uuid,
  p_post_id uuid,
  p_category_id uuid,
  p_title text,
  p_content text,
  p_tag_ids uuid[] default '{}'::uuid[]
)
returns public.forum_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_post public.forum_posts;
begin
  select * into updated_post
  from public.forum_posts
  where id = p_post_id
  for update;

  if updated_post.id is null or updated_post.status <> 'PUBLISHED' then
    raise exception 'forum post not found' using errcode = 'P0002';
  end if;

  if updated_post.author_id <> p_actor_id then
    raise exception 'forum post ownership required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.forum_categories
    where id = p_category_id and is_active
  ) then
    raise exception 'forum category is unavailable' using errcode = '23503';
  end if;

  update public.forum_posts
  set category_id = p_category_id,
      title = trim(p_title),
      content = trim(p_content),
      updated_at = now()
  where id = p_post_id
  returning * into updated_post;

  delete from public.forum_post_tags where post_id = p_post_id;
  insert into public.forum_post_tags (post_id, tag_id)
  select p_post_id, tags.id
  from public.forum_tags as tags
  where tags.id = any(coalesce(p_tag_ids, '{}'::uuid[]))
  on conflict do nothing;

  return updated_post;
end;
$$;

create or replace function public.delete_own_forum_post(
  p_actor_id uuid,
  p_post_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.forum_posts
  set status = 'DELETED',
      deleted_at = now(),
      is_pinned = false,
      updated_at = now()
  where id = p_post_id
    and author_id = p_actor_id
    and status = 'PUBLISHED';

  if not found then
    raise exception 'forum post ownership required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.create_forum_comment(
  p_actor_id uuid,
  p_post_id uuid,
  p_content text
)
returns public.forum_comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_record public.forum_posts;
  created_comment public.forum_comments;
begin
  select * into post_record
  from public.forum_posts
  where id = p_post_id
  for update;

  if post_record.id is null or post_record.status <> 'PUBLISHED' then
    raise exception 'forum post not found' using errcode = 'P0002';
  end if;

  if post_record.is_locked then
    raise exception 'forum post is locked' using errcode = '55000';
  end if;

  insert into public.forum_comments (post_id, author_id, content)
  values (p_post_id, p_actor_id, trim(p_content))
  returning * into created_comment;

  update public.forum_posts
  set comment_count = comment_count + 1,
      updated_at = now()
  where id = p_post_id;

  return created_comment;
end;
$$;

create or replace function public.delete_own_forum_comment(
  p_actor_id uuid,
  p_comment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  comment_record public.forum_comments;
begin
  select * into comment_record
  from public.forum_comments
  where id = p_comment_id
  for update;

  if comment_record.id is null or comment_record.status <> 'PUBLISHED' then
    raise exception 'forum comment not found' using errcode = 'P0002';
  end if;

  if comment_record.author_id <> p_actor_id then
    raise exception 'forum comment ownership required' using errcode = '42501';
  end if;

  update public.forum_comments
  set status = 'DELETED',
      deleted_at = now(),
      updated_at = now()
  where id = p_comment_id;

  update public.forum_posts
  set comment_count = greatest(0, comment_count - 1),
      updated_at = now()
  where id = comment_record.post_id;
end;
$$;

create or replace function public.set_forum_vote(
  p_actor_id uuid,
  p_post_id uuid,
  p_comment_id uuid,
  p_value smallint
)
returns table (
  target_id uuid,
  vote_value smallint,
  score integer,
  upvote_count integer,
  downvote_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  vote_record public.forum_votes;
  target_author_id uuid;
  target_score integer;
  target_upvotes integer;
  target_downvotes integer;
  old_value smallint := 0;
  new_value smallint := coalesce(p_value, 0);
  reputation_change integer := 0;
begin
  if (p_post_id is not null)::integer + (p_comment_id is not null)::integer <> 1 then
    raise exception 'vote requires exactly one target' using errcode = '22023';
  end if;

  if p_value is not null and p_value not in (-1, 1) then
    raise exception 'vote must be -1, 1, or null' using errcode = '22023';
  end if;

  if p_post_id is not null then
    select author_id, score, upvote_count, downvote_count
    into target_author_id, target_score, target_upvotes, target_downvotes
    from public.forum_posts
    where id = p_post_id and status = 'PUBLISHED'
    for update;
  else
    select comments.author_id, comments.score, comments.upvote_count, comments.downvote_count
    into target_author_id, target_score, target_upvotes, target_downvotes
    from public.forum_comments as comments
    join public.forum_posts as posts on posts.id = comments.post_id
    where comments.id = p_comment_id
      and comments.status = 'PUBLISHED'
      and posts.status = 'PUBLISHED'
    for update of comments;
  end if;

  if target_author_id is null then
    raise exception 'vote target not found' using errcode = 'P0002';
  end if;

  if target_author_id = p_actor_id then
    raise exception 'self voting is not allowed' using errcode = '42501';
  end if;

  if p_post_id is not null then
    select * into vote_record
    from public.forum_votes
    where voter_id = p_actor_id and post_id = p_post_id
    for update;
  else
    select * into vote_record
    from public.forum_votes
    where voter_id = p_actor_id and comment_id = p_comment_id
    for update;
  end if;

  if vote_record.id is null and p_value is null then
    raise exception 'active vote not found' using errcode = 'P0002';
  end if;

  if vote_record.id is null then
    insert into public.forum_votes (voter_id, post_id, comment_id, value, is_active)
    values (p_actor_id, p_post_id, p_comment_id, p_value, true)
    returning * into vote_record;
  else
    if vote_record.is_active then old_value := vote_record.value; end if;

    update public.forum_votes
    set value = coalesce(p_value, value),
        is_active = p_value is not null,
        revision = revision + 1,
        updated_at = now()
    where id = vote_record.id
    returning * into vote_record;
  end if;

  if vote_record.revision = 1 then old_value := 0; end if;

  reputation_change :=
    (case new_value when 1 then 10 when -1 then -2 else 0 end) -
    (case old_value when 1 then 10 when -1 then -2 else 0 end);

  if p_post_id is not null then
    update public.forum_posts
    set score = score + new_value - old_value,
        upvote_count = greatest(0, upvote_count + (case when new_value = 1 then 1 else 0 end) - (case when old_value = 1 then 1 else 0 end)),
        downvote_count = greatest(0, downvote_count + (case when new_value = -1 then 1 else 0 end) - (case when old_value = -1 then 1 else 0 end)),
        updated_at = now()
    where id = p_post_id
    returning score, upvote_count, downvote_count
    into target_score, target_upvotes, target_downvotes;
  else
    update public.forum_comments
    set score = score + new_value - old_value,
        upvote_count = greatest(0, upvote_count + (case when new_value = 1 then 1 else 0 end) - (case when old_value = 1 then 1 else 0 end)),
        downvote_count = greatest(0, downvote_count + (case when new_value = -1 then 1 else 0 end) - (case when old_value = -1 then 1 else 0 end)),
        updated_at = now()
    where id = p_comment_id
    returning score, upvote_count, downvote_count
    into target_score, target_upvotes, target_downvotes;
  end if;

  if reputation_change <> 0 then
    perform public.apply_reputation_event(
      format('forum-vote:%s:%s', vote_record.id, vote_record.revision),
      target_author_id,
      reputation_change,
      '论坛投票声望变动',
      'forum_vote',
      coalesce(p_post_id, p_comment_id),
      p_actor_id
    );
  end if;

  return query select
    coalesce(p_post_id, p_comment_id),
    case when vote_record.is_active then vote_record.value else null end,
    target_score,
    target_upvotes,
    target_downvotes;
end;
$$;

create or replace function public.moderate_forum_content(
  p_actor_id uuid,
  p_target text,
  p_target_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_target = 'post' and p_action in ('PIN', 'UNPIN', 'LOCK', 'UNLOCK', 'DELETE') then
    update public.forum_posts
    set is_pinned = case
          when p_action = 'PIN' then true
          when p_action = 'UNPIN' then false
          else is_pinned
        end,
        is_locked = case
          when p_action = 'LOCK' then true
          when p_action = 'UNLOCK' then false
          else is_locked
        end,
        status = case when p_action = 'DELETE' then 'DELETED'::public.forum_content_status else status end,
        deleted_at = case when p_action = 'DELETE' then now() else deleted_at end,
        updated_at = now()
    where id = p_target_id and status = 'PUBLISHED';
  elsif p_target = 'comment' and p_action = 'DELETE' then
    update public.forum_comments
    set status = 'DELETED', deleted_at = now(), updated_at = now()
    where id = p_target_id and status = 'PUBLISHED';
  else
    raise exception 'unsupported moderation action' using errcode = '22023';
  end if;

  if not found then
    raise exception 'forum target not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_forum_post(uuid, uuid, text, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.update_forum_post(uuid, uuid, uuid, text, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.delete_own_forum_post(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.create_forum_comment(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.delete_own_forum_comment(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.set_forum_vote(uuid, uuid, uuid, smallint)
  from public, anon, authenticated;
revoke all on function public.moderate_forum_content(uuid, text, uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_forum_post(uuid, uuid, text, text, uuid[])
  to service_role;
grant execute on function public.update_forum_post(uuid, uuid, uuid, text, text, uuid[])
  to service_role;
grant execute on function public.delete_own_forum_post(uuid, uuid)
  to service_role;
grant execute on function public.create_forum_comment(uuid, uuid, text)
  to service_role;
grant execute on function public.delete_own_forum_comment(uuid, uuid)
  to service_role;
grant execute on function public.set_forum_vote(uuid, uuid, uuid, smallint)
  to service_role;
grant execute on function public.moderate_forum_content(uuid, text, uuid, text)
  to service_role;

create or replace function public.admin_set_user_role(
  p_actor_id uuid,
  p_user_id uuid,
  p_role public.user_role
)
returns public.user_public_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.user_public_profiles;
  admin_count integer;
begin
  if p_actor_id = p_user_id then
    raise exception 'administrators cannot change their own role' using errcode = '22023';
  end if;

  select * into target_profile
  from public.user_public_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'public profile not found' using errcode = 'P0002';
  end if;

  if target_profile.role = 'ADMIN'::public.user_role and p_role <> 'ADMIN'::public.user_role then
    perform 1
    from public.user_public_profiles
    where role = 'ADMIN'::public.user_role
    for update;

    select count(*) into admin_count
    from public.user_public_profiles
    where role = 'ADMIN'::public.user_role;

    if admin_count <= 1 then
      raise exception 'the final administrator cannot be demoted' using errcode = '55000';
    end if;
  end if;

  update public.user_public_profiles
  set role = p_role,
      updated_at = now()
  where user_id = p_user_id
  returning * into target_profile;

  return target_profile;
end;
$$;

create or replace function public.admin_adjust_reputation(
  p_event_key text,
  p_actor_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_reason text
)
returns table (applied boolean, event_id uuid, reputation integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount = 0 or p_amount is null then
    raise exception 'reputation amount must not be zero' using errcode = '22023';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reputation reason is required' using errcode = '22023';
  end if;

  return query
  select * from public.apply_reputation_event(
    p_event_key,
    p_user_id,
    p_amount,
    trim(p_reason),
    'admin_manual',
    p_user_id,
    p_actor_id
  );
end;
$$;

create or replace function public.redeem_code(
  p_user_id uuid,
  p_code text
)
returns table (reputation integer, reward_title text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_record public.redeem_codes;
  usage_id uuid;
  reputation_result record;
begin
  select * into code_record
  from public.redeem_codes
  where code = upper(trim(p_code))
  for update;

  if not found or not code_record.is_active
    or code_record.current_uses >= code_record.max_uses
    or (code_record.expires_at is not null and code_record.expires_at <= now()) then
    raise exception 'redeem code is unavailable' using errcode = 'P0002';
  end if;

  insert into public.redeem_code_usages (redeem_code_id, user_id)
  values (code_record.id, p_user_id)
  returning id into usage_id;

  update public.redeem_codes
  set current_uses = current_uses + 1,
      updated_at = now()
  where id = code_record.id;

  select * into reputation_result
  from public.apply_reputation_event(
    format('redeem:%s:user:%s', code_record.id, p_user_id),
    p_user_id,
    code_record.reward_reputation,
    'redeem_code',
    'redeem_code',
    code_record.id,
    p_user_id
  );

  update public.redeem_code_usages
  set reputation_event_id = reputation_result.event_id
  where id = usage_id;

  return query select reputation_result.reputation, code_record.reward_title;
end;
$$;

create or replace function public.transfer_global_account(
  p_actor_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid
)
returns public.account_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_id uuid := gen_random_uuid();
  source_reputation integer;
  target_reputation integer;
  post_count integer := 0;
  comment_count integer := 0;
  task_count integer := 0;
  application_count integer := 0;
  review_count integer := 0;
  task_link_count integer := 0;
  result public.account_transfers;
begin
  if p_from_user_id = p_to_user_id then
    raise exception 'source and destination users must differ' using errcode = '22023';
  end if;

  perform 1
  from public.user_public_profiles
  where user_id in (p_from_user_id, p_to_user_id)
  order by user_id
  for update;

  if (select count(*) from public.user_public_profiles where user_id in (p_from_user_id, p_to_user_id)) <> 2 then
    raise exception 'transfer user not found' using errcode = 'P0002';
  end if;

  select reputation into source_reputation
  from public.user_public_profiles
  where user_id = p_from_user_id;

  select reputation into target_reputation
  from public.user_public_profiles
  where user_id = p_to_user_id;

  if exists (
    select 1
    from public.task_applications as source_applications
    join public.task_applications as target_applications
      on target_applications.task_id = source_applications.task_id
     and target_applications.applicant_id = p_to_user_id
    where source_applications.applicant_id = p_from_user_id
  ) then
    raise exception 'account transfer conflicts with an existing task application' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.task_reviews as source_reviews
    where source_reviews.reviewer_id = p_from_user_id
      and exists (
        select 1
        from public.task_reviews as target_reviews
        where target_reviews.application_id = source_reviews.application_id
          and target_reviews.reviewer_id = p_to_user_id
      )
  ) then
    raise exception 'account transfer conflicts with an existing task review' using errcode = '23505';
  end if;

  update public.task_listings
  set creator_id = p_to_user_id,
      updated_at = now()
  where creator_id = p_from_user_id;
  get diagnostics task_count = row_count;

  update public.task_post_links
  set created_by = p_to_user_id
  where created_by = p_from_user_id;
  get diagnostics task_link_count = row_count;

  update public.task_applications
  set applicant_id = p_to_user_id,
      updated_at = now()
  where applicant_id = p_from_user_id;
  get diagnostics application_count = row_count;

  update public.task_reviews
  set reviewer_id = case when reviewer_id = p_from_user_id then p_to_user_id else reviewer_id end,
      reviewee_id = case when reviewee_id = p_from_user_id then p_to_user_id else reviewee_id end,
      updated_at = now()
  where reviewer_id = p_from_user_id
     or reviewee_id = p_from_user_id;
  get diagnostics review_count = row_count;

  update public.forum_posts
  set author_id = p_to_user_id,
      updated_at = now()
  where author_id = p_from_user_id;
  get diagnostics post_count = row_count;

  update public.forum_comments
  set author_id = p_to_user_id,
      updated_at = now()
  where author_id = p_from_user_id;
  get diagnostics comment_count = row_count;

  if source_reputation > 0 then
    perform * from public.apply_reputation_event(
      format('account-transfer:%s:source', transfer_id),
      p_from_user_id,
      -source_reputation,
      'account_transfer_out',
      'account_transfer',
      transfer_id,
      p_actor_id
    );
    perform * from public.apply_reputation_event(
      format('account-transfer:%s:destination', transfer_id),
      p_to_user_id,
      source_reputation,
      'account_transfer_in',
      'account_transfer',
      transfer_id,
      p_actor_id
    );
  end if;

  insert into public.account_transfers (
    id,
    from_user_id,
    to_user_id,
    reputation_transferred,
    operated_by_id,
    result_summary
  )
  values (
    transfer_id,
    p_from_user_id,
    p_to_user_id,
    source_reputation,
    p_actor_id,
    jsonb_build_object(
      'forum_posts', post_count,
      'forum_comments', comment_count,
      'task_listings', task_count,
      'task_post_links', task_link_count,
      'task_applications', application_count,
      'task_reviews', review_count,
      'destination_reputation_before', target_reputation
    )
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, uuid, public.user_role)
  from public, anon, authenticated;
revoke all on function public.admin_adjust_reputation(text, uuid, uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.redeem_code(uuid, text)
  from public, anon, authenticated;
revoke all on function public.transfer_global_account(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.admin_set_user_role(uuid, uuid, public.user_role)
  to service_role;
grant execute on function public.admin_adjust_reputation(text, uuid, uuid, integer, text)
  to service_role;
grant execute on function public.redeem_code(uuid, text)
  to service_role;
grant execute on function public.transfer_global_account(uuid, uuid, uuid)
  to service_role;

-- Task publishing module merged from supabase/modules/tasks.sql.
-- The module file remains the reviewable source copy for future changes.

create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint task_categories_name_length check (char_length(name) between 1 and 60)
);

create table if not exists public.task_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.task_categories(id) on delete restrict,
  slug text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug),
  constraint task_subcategories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint task_subcategories_name_length check (char_length(name) between 1 and 60)
);

insert into public.task_categories (slug, name, description, sort_order, is_active)
values ('career-actions', '求职行动', '求职准备、作品完善与实践任务', 0, true)
on conflict (slug) do nothing;

create table if not exists public.task_listings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete restrict,
  category_id uuid not null references public.task_categories(id) on delete restrict,
  subcategory_id uuid references public.task_subcategories(id) on delete set null,
  title text not null,
  summary text not null,
  body text not null,
  skill_tags jsonb not null default '[]'::jsonb,
  reward_points integer not null,
  application_limit integer not null,
  deadline_at timestamptz not null,
  status text not null default 'draft',
  published_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_listings_title_length check (char_length(title) between 1 and 120),
  constraint task_listings_summary_length check (char_length(summary) between 1 and 280),
  constraint task_listings_body_length check (char_length(body) between 1 and 8000),
  constraint task_listings_tags_array check (jsonb_typeof(skill_tags) = 'array'),
  constraint task_listings_reward_range check (reward_points between 0 and 10000),
  constraint task_listings_application_limit_range check (application_limit between 1 and 1000),
  constraint task_listings_status_value check (status in ('draft', 'published', 'closed', 'archived'))
);

create table if not exists public.task_applications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_listings(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  application_note text not null,
  submission_note text,
  status text not null default 'pending',
  assigned_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  reward_event_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, applicant_id),
  constraint task_applications_note_length check (char_length(application_note) between 1 and 800),
  constraint task_applications_submission_length check (submission_note is null or char_length(submission_note) between 1 and 1200),
  constraint task_applications_status_value check (status in ('pending', 'accepted', 'rejected', 'submitted', 'completed', 'cancelled'))
);

create table if not exists public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_listings(id) on delete cascade,
  application_id uuid not null references public.task_applications(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, reviewer_id),
  constraint task_reviews_rating_range check (rating between 1 and 5),
  constraint task_reviews_content_length check (char_length(content) between 1 and 1200)
);

create table if not exists public.task_post_links (
  task_id uuid not null references public.task_listings(id) on delete cascade,
  post_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (task_id, post_id)
);

create index if not exists task_categories_active_sort_idx
  on public.task_categories (is_active, sort_order, name);
create index if not exists task_subcategories_category_active_sort_idx
  on public.task_subcategories (category_id, is_active, sort_order, name);
create index if not exists task_listings_published_deadline_idx
  on public.task_listings (published_at desc, deadline_at asc)
  where status = 'published';
create index if not exists task_listings_category_published_idx
  on public.task_listings (category_id, published_at desc)
  where status = 'published';
create index if not exists task_applications_applicant_status_idx
  on public.task_applications (applicant_id, status, updated_at desc);
create index if not exists task_applications_task_status_idx
  on public.task_applications (task_id, status, created_at asc);
create index if not exists task_reviews_task_idx
  on public.task_reviews (task_id, created_at desc);
create index if not exists task_post_links_post_idx
  on public.task_post_links (post_id);

alter table public.task_categories enable row level security;
alter table public.task_subcategories enable row level security;
alter table public.task_listings enable row level security;
alter table public.task_applications enable row level security;
alter table public.task_reviews enable row level security;
alter table public.task_post_links enable row level security;

revoke all on public.task_categories from anon, authenticated;
revoke all on public.task_subcategories from anon, authenticated;
revoke all on public.task_listings from anon, authenticated;
revoke all on public.task_applications from anon, authenticated;
revoke all on public.task_reviews from anon, authenticated;
revoke all on public.task_post_links from anon, authenticated;

grant select on public.task_categories to anon, authenticated;
grant select on public.task_subcategories to anon, authenticated;
grant select on public.task_listings to anon, authenticated;
grant select on public.task_applications to authenticated;
grant select on public.task_reviews to authenticated;
grant select on public.task_post_links to anon, authenticated;

drop policy if exists task_categories_read_active on public.task_categories;
create policy task_categories_read_active on public.task_categories
  for select to anon, authenticated using (is_active);

drop policy if exists task_subcategories_read_active on public.task_subcategories;
create policy task_subcategories_read_active on public.task_subcategories
  for select to anon, authenticated using (is_active);

drop policy if exists task_listings_read_published on public.task_listings;
create policy task_listings_read_published on public.task_listings
  for select to anon, authenticated using (status = 'published');

drop policy if exists task_listings_read_own_application on public.task_listings;
create policy task_listings_read_own_application on public.task_listings
  for select to authenticated using (
    exists (
      select 1 from public.task_applications
      where task_applications.task_id = task_listings.id
        and task_applications.applicant_id = (select auth.uid())
    )
  );

drop policy if exists task_listings_read_admin on public.task_listings;
create policy task_listings_read_admin on public.task_listings
  for select to authenticated using (
    exists (
      select 1 from public.user_public_profiles
      where user_public_profiles.user_id = (select auth.uid())
        and user_public_profiles.role = 'ADMIN'
    )
  );

drop policy if exists task_applications_read_own on public.task_applications;
create policy task_applications_read_own on public.task_applications
  for select to authenticated using ((select auth.uid()) = applicant_id);

drop policy if exists task_applications_read_admin on public.task_applications;
create policy task_applications_read_admin on public.task_applications
  for select to authenticated using (
    exists (
      select 1 from public.user_public_profiles
      where user_public_profiles.user_id = (select auth.uid())
        and user_public_profiles.role = 'ADMIN'
    )
  );

drop policy if exists task_reviews_read_participant on public.task_reviews;
create policy task_reviews_read_participant on public.task_reviews
  for select to authenticated using ((select auth.uid()) in (reviewer_id, reviewee_id));

drop policy if exists task_reviews_read_admin on public.task_reviews;
create policy task_reviews_read_admin on public.task_reviews
  for select to authenticated using (
    exists (
      select 1 from public.user_public_profiles
      where user_public_profiles.user_id = (select auth.uid())
        and user_public_profiles.role = 'ADMIN'
    )
  );

drop policy if exists task_post_links_read_published on public.task_post_links;
create policy task_post_links_read_published on public.task_post_links
  for select to anon, authenticated using (
    exists (
      select 1 from public.task_listings
      where task_listings.id = task_post_links.task_id
        and task_listings.status = 'published'
    )
  );

drop policy if exists task_post_links_read_admin on public.task_post_links;
create policy task_post_links_read_admin on public.task_post_links
  for select to authenticated using (
    exists (
      select 1 from public.user_public_profiles
      where user_public_profiles.user_id = (select auth.uid())
        and user_public_profiles.role = 'ADMIN'
    )
  );

create or replace function public.validate_task_taxonomy(p_category_id uuid, p_subcategory_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_category_id is null or not exists (
    select 1 from public.task_categories
    where id = p_category_id and is_active
  ) then
    raise exception using errcode = 'P0001', message = 'Active task category not found.';
  end if;

  if p_subcategory_id is not null and not exists (
    select 1 from public.task_subcategories
    where id = p_subcategory_id
      and category_id = p_category_id
      and is_active
  ) then
    raise exception using errcode = 'P0001', message = 'Active task subcategory does not belong to the category.';
  end if;
end;
$$;

create or replace function public.create_task(p_actor_id uuid, p_filtered_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_deadline timestamptz;
begin
  if p_actor_id is null then
    raise exception using errcode = 'P0001', message = 'Trusted actor is required.';
  end if;

  if coalesce(char_length(trim(p_filtered_payload ->> 'title')), 0) = 0
    or coalesce(char_length(trim(p_filtered_payload ->> 'summary')), 0) = 0
    or coalesce(char_length(trim(p_filtered_payload ->> 'body')), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Task title, summary, and body are required.';
  end if;

  v_deadline := nullif(p_filtered_payload ->> 'deadlineAt', '')::timestamptz;
  if v_deadline is null then
    raise exception using errcode = 'P0001', message = 'Task deadline is required.';
  end if;

  perform public.validate_task_taxonomy(
    (p_filtered_payload ->> 'categoryId')::uuid,
    nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid
  );

  insert into public.task_listings (
    creator_id, category_id, subcategory_id, title, summary, body, skill_tags,
    reward_points, application_limit, deadline_at, status
  ) values (
    p_actor_id,
    (p_filtered_payload ->> 'categoryId')::uuid,
    nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid,
    trim(p_filtered_payload ->> 'title'),
    trim(p_filtered_payload ->> 'summary'),
    trim(p_filtered_payload ->> 'body'),
    coalesce(p_filtered_payload -> 'skillTags', '[]'::jsonb),
    (p_filtered_payload ->> 'rewardPoints')::integer,
    (p_filtered_payload ->> 'applicationLimit')::integer,
    v_deadline,
    'draft'
  ) returning id into v_task_id;

  return v_task_id;
end;
$$;

create or replace function public.update_task(p_actor_id uuid, p_task_id uuid, p_filtered_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_listings;
begin
  select * into v_task from public.task_listings where id = p_task_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Task not found.';
  end if;
  if v_task.creator_id <> p_actor_id and not exists (
    select 1 from public.user_public_profiles where user_id = p_actor_id and role = 'ADMIN'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'Only the task creator may edit this task.';
  end if;
  if v_task.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'Archived tasks cannot be edited.';
  end if;

  perform public.validate_task_taxonomy(
    (p_filtered_payload ->> 'categoryId')::uuid,
    nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid
  );

  update public.task_listings
  set category_id = (p_filtered_payload ->> 'categoryId')::uuid,
      subcategory_id = nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid,
      title = trim(p_filtered_payload ->> 'title'),
      summary = trim(p_filtered_payload ->> 'summary'),
      body = trim(p_filtered_payload ->> 'body'),
      skill_tags = coalesce(p_filtered_payload -> 'skillTags', '[]'::jsonb),
      reward_points = (p_filtered_payload ->> 'rewardPoints')::integer,
      application_limit = (p_filtered_payload ->> 'applicationLimit')::integer,
      deadline_at = (p_filtered_payload ->> 'deadlineAt')::timestamptz,
      updated_at = now()
  where id = v_task.id;

  return v_task.id;
end;
$$;

create or replace function public.publish_task(p_actor_id uuid, p_task_id uuid, p_filtered_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_listings;
begin
  select * into v_task from public.task_listings where id = p_task_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Task not found.';
  end if;
  if v_task.creator_id <> p_actor_id and not exists (
    select 1 from public.user_public_profiles where user_id = p_actor_id and role = 'ADMIN'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'Only the task creator may publish this task.';
  end if;
  if v_task.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'Only draft tasks can be published.';
  end if;
  if not exists (select 1 from public.user_public_profiles where user_id = p_actor_id and role = 'ADMIN'::public.user_role)
    and coalesce((public.get_task_publishing_eligibility(p_actor_id) ->> 'eligible')::boolean, false) is not true then
    raise exception using errcode = '42501', message = 'Actor is not eligible to publish tasks.';
  end if;
  if (p_filtered_payload ->> 'deadlineAt')::timestamptz <= now() then
    raise exception using errcode = 'P0001', message = 'Task deadline must be in the future.';
  end if;

  perform public.validate_task_taxonomy(
    (p_filtered_payload ->> 'categoryId')::uuid,
    nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid
  );

  update public.task_listings
  set category_id = (p_filtered_payload ->> 'categoryId')::uuid,
      subcategory_id = nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid,
      title = trim(p_filtered_payload ->> 'title'),
      summary = trim(p_filtered_payload ->> 'summary'),
      body = trim(p_filtered_payload ->> 'body'),
      skill_tags = coalesce(p_filtered_payload -> 'skillTags', '[]'::jsonb),
      reward_points = (p_filtered_payload ->> 'rewardPoints')::integer,
      application_limit = (p_filtered_payload ->> 'applicationLimit')::integer,
      deadline_at = (p_filtered_payload ->> 'deadlineAt')::timestamptz,
      status = 'published',
      published_at = now(),
      updated_at = now()
  where id = v_task.id;

  return v_task.id;
end;
$$;

create or replace function public.close_task(p_actor_id uuid, p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_listings
  set status = 'closed', closed_at = now(), updated_at = now()
  where id = p_task_id and status = 'published';
  if not found then
    raise exception using errcode = 'P0001', message = 'Published task not found.';
  end if;
  return p_task_id;
end;
$$;

create or replace function public.archive_task(p_actor_id uuid, p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_listings
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = p_task_id and status in ('draft', 'closed', 'published');
  if not found then
    raise exception using errcode = 'P0001', message = 'Task cannot be archived.';
  end if;
  return p_task_id;
end;
$$;

create or replace function public.delete_task(p_actor_id uuid, p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_listings where id = p_task_id and status = 'draft';
  if not found then
    raise exception using errcode = 'P0001', message = 'Only draft tasks can be deleted.';
  end if;
  return p_task_id;
end;
$$;

create or replace function public.apply_task(p_actor_id uuid, p_task_id uuid, p_filtered_application_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_listings;
  v_application_id uuid;
  v_assigned_count integer;
begin
  perform 1 from public.user_public_profiles where user_id = p_actor_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Applicant profile not found.';
  end if;
  select * into v_task from public.task_listings where id = p_task_id for update;
  if not found or v_task.status <> 'published' or v_task.deadline_at <= now() then
    raise exception using errcode = 'P0001', message = 'Task is not accepting applications.';
  end if;

  select count(*) into v_assigned_count
  from public.task_applications
  where task_id = v_task.id and status in ('accepted', 'submitted', 'completed');
  if v_assigned_count >= v_task.application_limit then
    raise exception using errcode = 'P0001', message = 'Task capacity has been reached.';
  end if;

  insert into public.task_applications (task_id, applicant_id, application_note)
  values (v_task.id, p_actor_id, trim(p_filtered_application_note))
  returning id into v_application_id;

  return v_application_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'You have already applied for this task.';
end;
$$;

create or replace function public.assign_applicant(p_actor_id uuid, p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.task_applications;
  v_task public.task_listings;
  v_assigned_count integer;
begin
  select * into v_application from public.task_applications where id = p_application_id for update;
  if not found or v_application.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'Pending application not found.';
  end if;
  select * into v_task from public.task_listings where id = v_application.task_id for update;
  if v_task.status <> 'published' or v_task.deadline_at <= now() then
    raise exception using errcode = 'P0001', message = 'Task is no longer available.';
  end if;
  select count(*) into v_assigned_count
  from public.task_applications
  where task_id = v_task.id and status in ('accepted', 'submitted', 'completed');
  if v_assigned_count >= v_task.application_limit then
    raise exception using errcode = 'P0001', message = 'Task capacity has been reached.';
  end if;

  update public.task_applications
  set status = 'accepted', assigned_at = now(), updated_at = now()
  where id = v_application.id;
  return v_application.id;
end;
$$;

create or replace function public.reject_applicant(p_actor_id uuid, p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_applications
  set status = 'rejected', updated_at = now()
  where id = p_application_id and status = 'pending';
  if not found then
    raise exception using errcode = 'P0001', message = 'Pending application not found.';
  end if;
  return p_application_id;
end;
$$;

create or replace function public.submit_task(p_actor_id uuid, p_application_id uuid, p_filtered_submission_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.task_applications;
begin
  perform 1 from public.user_public_profiles where user_id = p_actor_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Applicant profile not found.';
  end if;
  select * into v_application from public.task_applications where id = p_application_id for update;
  if not found or v_application.applicant_id <> p_actor_id then
    raise exception using errcode = 'P0001', message = 'Application not found.';
  end if;
  if v_application.status <> 'accepted' then
    raise exception using errcode = 'P0001', message = 'Only accepted applications can be submitted.';
  end if;

  update public.task_applications
  set status = 'submitted', submission_note = trim(p_filtered_submission_note), submitted_at = now(), updated_at = now()
  where id = v_application.id;
  return v_application.id;
end;
$$;

create or replace function public.cancel_application(p_actor_id uuid, p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.user_public_profiles where user_id = p_actor_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Applicant profile not found.';
  end if;

  update public.task_applications
  set status = 'cancelled', updated_at = now()
  where id = p_application_id
    and applicant_id = p_actor_id
    and status = 'accepted';
  if not found then
    raise exception using errcode = 'P0001', message = 'Accepted application not found.';
  end if;
  return p_application_id;
end;
$$;

create or replace function public.complete_task(p_actor_id uuid, p_application_id uuid, p_filtered_review jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.task_applications;
  v_task public.task_listings;
  v_event_key text;
  v_rating smallint;
  v_review_content text;
  v_is_admin boolean := false;
  v_applicant_id uuid;
begin
  select applicant_id into v_applicant_id
  from public.task_applications
  where id = p_application_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Submitted application not found.';
  end if;
  perform 1
  from public.user_public_profiles
  where user_id in (p_actor_id, v_applicant_id)
  order by user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Task participant profile not found.';
  end if;
  select * into v_application from public.task_applications where id = p_application_id for update;
  if v_application.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'Submitted application not found.';
  end if;
  select * into v_task from public.task_listings where id = v_application.task_id for update;
  select exists (
    select 1 from public.user_public_profiles
    where user_id = p_actor_id and role = 'ADMIN'
  ) into v_is_admin;
  if v_task.creator_id <> p_actor_id and not v_is_admin then
    raise exception using errcode = 'P0001', message = 'Only the task creator or an administrator can verify completion.';
  end if;

  v_event_key := format('task:%s:user:%s:completion:v1', v_task.id, v_application.applicant_id);
  update public.task_applications
  set status = 'completed', completed_at = now(), reward_event_key = v_event_key, updated_at = now()
  where id = v_application.id;

  if v_task.reward_points > 0 then
    perform public.apply_reputation_event(
      p_event_key => v_event_key,
      p_user_id => v_application.applicant_id,
      p_amount => v_task.reward_points,
      p_reason => 'task_completion',
      p_source_resource => 'tasks',
      p_source_id => v_task.id,
      p_actor_id => p_actor_id
    );
  end if;

  if p_filtered_review is not null and coalesce(char_length(trim(p_filtered_review ->> 'content')), 0) > 0 then
    v_rating := coalesce((p_filtered_review ->> 'rating')::smallint, 5);
    v_review_content := trim(p_filtered_review ->> 'content');
    insert into public.task_reviews (task_id, application_id, reviewer_id, reviewee_id, rating, content)
    values (v_task.id, v_application.id, p_actor_id, v_application.applicant_id, v_rating, v_review_content);
  end if;

  return v_application.id;
end;
$$;

create or replace function public.upsert_task_category(p_actor_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_id uuid;
begin
  if coalesce(p_payload ->> 'kind', 'category') = 'subcategory' then
    insert into public.task_subcategories (category_id, slug, name, sort_order, is_active)
    values (
      (p_payload ->> 'categoryId')::uuid,
      trim(p_payload ->> 'slug'),
      trim(p_payload ->> 'name'),
      coalesce((p_payload ->> 'sortOrder')::integer, 0),
      coalesce((p_payload ->> 'isActive')::boolean, true)
    )
    on conflict (category_id, slug) do update
    set name = excluded.name, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
    returning id into v_category_id;
  else
    insert into public.task_categories (slug, name, description, sort_order, is_active)
    values (
      trim(p_payload ->> 'slug'),
      trim(p_payload ->> 'name'),
      coalesce(trim(p_payload ->> 'description'), ''),
      coalesce((p_payload ->> 'sortOrder')::integer, 0),
      coalesce((p_payload ->> 'isActive')::boolean, true)
    )
    on conflict (slug) do update
    set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order,
        is_active = excluded.is_active, updated_at = now()
    returning id into v_category_id;
  end if;
  return v_category_id;
end;
$$;

revoke all on function public.create_task(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.validate_task_taxonomy(uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_task(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.publish_task(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.close_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.archive_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_task(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.assign_applicant(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reject_applicant(uuid, uuid) from public, anon, authenticated;
revoke all on function public.submit_task(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_application(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_task(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.upsert_task_category(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.create_task(uuid, jsonb) to service_role;
grant execute on function public.validate_task_taxonomy(uuid, uuid) to service_role;
grant execute on function public.update_task(uuid, uuid, jsonb) to service_role;
grant execute on function public.publish_task(uuid, uuid, jsonb) to service_role;
grant execute on function public.close_task(uuid, uuid) to service_role;
grant execute on function public.archive_task(uuid, uuid) to service_role;
grant execute on function public.delete_task(uuid, uuid) to service_role;
grant execute on function public.apply_task(uuid, uuid, text) to service_role;
grant execute on function public.assign_applicant(uuid, uuid) to service_role;
grant execute on function public.reject_applicant(uuid, uuid) to service_role;
grant execute on function public.submit_task(uuid, uuid, text) to service_role;
grant execute on function public.cancel_application(uuid, uuid) to service_role;
grant execute on function public.complete_task(uuid, uuid, jsonb) to service_role;
grant execute on function public.upsert_task_category(uuid, jsonb) to service_role;

-- 6.1 integration example for get_user_capabilities(user_id):
-- jsonb_build_object(
--   'tasks:create', canRole(role, 'tasks', 'create'),
--   'tasks:update', canRole(role, 'tasks', 'update'),
--   'tasks:publish', canRole(role, 'tasks', 'publish'),
--   'tasks:close', canRole(role, 'tasks', 'close'),
--   'tasks:archive', canRole(role, 'tasks', 'archive'),
--   'tasks:delete', canRole(role, 'tasks', 'delete'),
--   'tasks:apply', canRole(role, 'tasks', 'apply'),
--   'tasks:assign', canRole(role, 'tasks', 'assign'),
--   'tasks:submit', canRole(role, 'tasks', 'submit'),
--   'tasks:complete', canRole(role, 'tasks', 'complete'),
--   'tasks:manageCategories', canRole(role, 'tasks', 'manageCategories'),
--   'tasks:manage', canRole(role, 'tasks', 'manage')
-- )
-- Task lifecycle v2. Idempotent migration for attachments, audit history and arbitration.
-- All write RPCs are intended to be called by task Edge Functions with a service-role client
-- after get_user_capabilities()/replaceSensitive() checks. The RPCs repeat admin checks server-side.

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_listings(id) on delete cascade,
  application_id uuid references public.task_applications(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'task-attachments',
  object_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  attachment_kind text not null default 'task',
  sha256 text,
  caption text not null default '',
  created_at timestamptz not null default now(),
  constraint task_attachments_bucket_check check (bucket_id = 'task-attachments'),
  constraint task_attachments_path_check check (
    object_path !~ '(^|/)\\.\\.?(/|$)' and object_path !~ '[[:space:]]'
  ),
  constraint task_attachments_kind_check check (attachment_kind in ('task', 'submission', 'completion', 'arbitration')),
  constraint task_attachments_application_kind_check check (
    (attachment_kind = 'task' and application_id is null)
    or (attachment_kind <> 'task' and application_id is not null)
  ),
  constraint task_attachments_mime_check check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime')
  ),
  constraint task_attachments_size_check check (size_bytes between 1 and 52428800),
  constraint task_attachments_caption_length check (char_length(caption) <= 240),
  unique (bucket_id, object_path)
);

alter table public.task_listings
  add column if not exists arbitration_status text not null default 'none',
  add column if not exists arbitration_reason text,
  add column if not exists arbitrated_by uuid references auth.users(id) on delete set null,
  add column if not exists arbitrated_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refund_event_key text;

alter table public.task_applications
  add column if not exists completion_note text,
  add column if not exists completion_submitted_at timestamptz,
  add column if not exists completion_due_at timestamptz,
  add column if not exists arbitration_status text not null default 'none',
  add column if not exists arbitration_reason text,
  add column if not exists arbitrated_by uuid references auth.users(id) on delete set null,
  add column if not exists arbitrated_at timestamptz,
  add column if not exists refund_event_key text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_listings_arbitration_status_check') then
    alter table public.task_listings add constraint task_listings_arbitration_status_check
      check (arbitration_status in ('none', 'pending', 'force_completed', 'cancelled', 'refunded'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_applications_completion_note_length') then
    alter table public.task_applications add constraint task_applications_completion_note_length
      check (completion_note is null or char_length(completion_note) between 1 and 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_applications_arbitration_status_check') then
    alter table public.task_applications add constraint task_applications_arbitration_status_check
      check (arbitration_status in ('none', 'pending', 'force_completed', 'cancelled', 'refunded'));
  end if;
end;
$$;

create index if not exists task_attachments_task_created_idx
  on public.task_attachments (task_id, created_at desc);
create index if not exists task_attachments_application_kind_idx
  on public.task_attachments (application_id, attachment_kind, created_at desc);
create index if not exists task_applications_arbitration_due_idx
  on public.task_applications (completion_due_at, arbitration_status)
  where status in ('accepted', 'submitted');
create unique index if not exists task_listings_refund_event_key_idx
  on public.task_listings (refund_event_key)
  where refund_event_key is not null;
create unique index if not exists task_applications_refund_event_key_idx
  on public.task_applications (refund_event_key)
  where refund_event_key is not null;

create table if not exists public.task_activity_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_listings(id) on delete cascade,
  application_id uuid references public.task_applications(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_key text not null unique,
  event_type text not null,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint task_activity_event_type_check check (event_type ~ '^[a-z][a-z0-9_.-]{1,80}$'),
  constraint task_activity_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists task_activity_log_task_created_idx
  on public.task_activity_log (task_id, created_at desc);
create index if not exists task_activity_log_application_created_idx
  on public.task_activity_log (application_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_task_storage(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.task_listings as t
      where t.id = p_task_id and t.status = 'published'
    )
    or (p_user_id is not null and exists (
      select 1 from public.task_listings as t
      where t.id = p_task_id and t.creator_id = p_user_id
    ))
    or (p_user_id is not null and exists (
      select 1 from public.task_applications as a
      where a.task_id = p_task_id and a.applicant_id = p_user_id
    ))
    or (p_user_id is not null and exists (
      select 1 from public.task_applications as a
      join public.task_listings as t on t.id = a.task_id
      where a.id = p_task_id
        and (a.applicant_id = p_user_id or t.creator_id = p_user_id or exists (
          select 1 from public.user_public_profiles as p
          where p.user_id = p_user_id and p.role = 'ADMIN'::public.user_role
        ))
    ))
    or (p_user_id is not null and exists (
      select 1 from public.user_public_profiles as p
      where p.user_id = p_user_id and p.role = 'ADMIN'::public.user_role
    ));
$$;

grant execute on function public.can_access_task_storage(uuid, uuid) to anon, authenticated;

create or replace function public.write_task_activity(
  p_actor_id uuid,
  p_task_id uuid,
  p_event_type text,
  p_application_id uuid default null,
  p_from_status text default null,
  p_to_status text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_event_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_event_key text := coalesce(nullif(trim(p_event_key), ''), format('task:%s:%s', p_task_id, gen_random_uuid()));
begin
  insert into public.task_activity_log (
    task_id, application_id, actor_id, event_key, event_type,
    from_status, to_status, metadata
  ) values (
    p_task_id, p_application_id, p_actor_id, v_event_key, trim(p_event_type),
    p_from_status, p_to_status, coalesce(p_metadata, '{}'::jsonb)
  ) on conflict (event_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.task_activity_log where event_key = v_event_key;
  end if;
  return v_id;
end;
$$;

create or replace function public.record_task_activity(
  p_actor_id uuid,
  p_task_id uuid,
  p_event_type text,
  p_application_id uuid default null,
  p_from_status text default null,
  p_to_status text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_event_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null then
    raise exception using errcode = 'P0001', message = 'Trusted task actor is required.';
  end if;
  if not exists (select 1 from public.user_public_profiles where user_id = p_actor_id) then
    raise exception using errcode = 'P0002', message = 'Task actor profile not found.';
  end if;
  return public.write_task_activity(
    p_actor_id, p_task_id, p_event_type, p_application_id,
    p_from_status, p_to_status, p_metadata, p_event_key
  );
end;
$$;

create or replace function public.task_listing_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_event_type text;
  v_event_key text;
begin
  begin
    v_actor_id := nullif(current_setting('app.task_actor_id', true), '')::uuid;
  exception when invalid_text_representation then
    v_actor_id := null;
  end;
  v_actor_id := coalesce(v_actor_id, new.creator_id);
  if tg_op = 'INSERT' then
    v_event_type := 'task.created';
    v_event_key := format('task:%s:created', new.id);
  elsif old.status is distinct from new.status then
    v_event_type := 'task.status_changed';
    v_event_key := format('task:%s:status:%s:%s', new.id, old.status, new.status);
  else
    v_event_type := 'task.updated';
    v_event_key := format('task:%s:updated:%s', new.id, new.updated_at);
  end if;
  perform public.write_task_activity(
    v_actor_id, new.id, v_event_type, null,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    jsonb_build_object('operation', tg_op), v_event_key
  );
  return new;
end;
$$;

create or replace function public.task_application_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_task_creator uuid;
  v_event_type text;
  v_event_key text;
begin
  begin
    v_actor_id := nullif(current_setting('app.task_actor_id', true), '')::uuid;
  exception when invalid_text_representation then
    v_actor_id := null;
  end;
  select creator_id into v_task_creator from public.task_listings where id = new.task_id;
  v_actor_id := coalesce(
    v_actor_id,
    case when tg_op = 'INSERT' or new.status in ('submitted', 'cancelled') then new.applicant_id else v_task_creator end
  );
  if tg_op = 'INSERT' then
    v_event_type := 'application.created';
    v_event_key := format('application:%s:created', new.id);
  elsif old.status is distinct from new.status then
    v_event_type := 'application.status_changed';
    v_event_key := format('application:%s:status:%s:%s', new.id, old.status, new.status);
  elsif old.completion_note is distinct from new.completion_note then
    v_event_type := 'application.completion_updated';
    v_event_key := format('application:%s:completion:%s', new.id, new.updated_at);
  else
    v_event_type := 'application.updated';
    v_event_key := format('application:%s:updated:%s', new.id, new.updated_at);
  end if;
  perform public.write_task_activity(
    v_actor_id, new.task_id, v_event_type, new.id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    jsonb_build_object('operation', tg_op, 'arbitrationStatus', new.arbitration_status), v_event_key
  );
  return new;
end;
$$;

drop trigger if exists task_listings_activity_log on public.task_listings;
create trigger task_listings_activity_log
after insert or update on public.task_listings
for each row execute function public.task_listing_activity_trigger();

drop trigger if exists task_applications_activity_log on public.task_applications;
create trigger task_applications_activity_log
after insert or update on public.task_applications
for each row execute function public.task_application_activity_trigger();

create or replace function public.task_application_completion_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'accepted' and new.completion_due_at is null then
    select deadline_at into new.completion_due_at from public.task_listings where id = new.task_id;
  end if;
  if new.status = 'submitted' and new.completion_submitted_at is null then
    new.completion_submitted_at := coalesce(new.submitted_at, now());
  end if;
  if new.status = 'completed' and new.completion_note is null then
    new.completion_note := nullif(trim(new.submission_note), '');
  end if;
  return new;
end;
$$;

drop trigger if exists task_applications_completion_defaults on public.task_applications;
create trigger task_applications_completion_defaults
before insert or update on public.task_applications
for each row execute function public.task_application_completion_defaults();

create or replace function public.cleanup_task_attachment_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from storage.objects
  where bucket_id = old.bucket_id and name = old.object_path;
  return old;
end;
$$;

drop trigger if exists task_attachments_cleanup_object on public.task_attachments;
create trigger task_attachments_cleanup_object
after delete on public.task_attachments
for each row execute function public.cleanup_task_attachment_object();

create or replace function public.register_task_attachment(p_actor_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_task_id uuid := (p_payload ->> 'taskId')::uuid;
  v_application_id uuid := nullif(p_payload ->> 'applicationId', '')::uuid;
  v_kind text := coalesce(nullif(trim(p_payload ->> 'attachmentKind'), ''), 'task');
  v_path text := trim(p_payload ->> 'objectPath');
  v_bucket text := coalesce(nullif(trim(p_payload ->> 'bucketId'), ''), 'task-attachments');
  v_mime text := lower(trim(p_payload ->> 'mimeType'));
  v_size bigint := (p_payload ->> 'sizeBytes')::bigint;
begin
  if p_actor_id is null or not exists (select 1 from public.user_public_profiles where user_id = p_actor_id) then
    raise exception using errcode = 'P0002', message = 'Task actor profile not found.';
  end if;
  if v_bucket <> 'task-attachments' or v_path = '' or v_path ~ '(^|/)\\.\\.?(/|$)' or v_path ~ '[[:space:]]' then
    raise exception using errcode = 'P0001', message = 'Invalid task attachment object path.';
  end if;
  if v_kind not in ('task', 'submission', 'completion', 'arbitration') then
    raise exception using errcode = 'P0001', message = 'Invalid task attachment kind.';
  end if;
  if v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime')
    or v_size is null or v_size not between 1 and 52428800 then
    raise exception using errcode = 'P0001', message = 'Task attachment type or size is not allowed.';
  end if;
  if not public.can_access_task_storage(v_task_id, p_actor_id) then
    raise exception using errcode = '42501', message = 'Task attachment access denied.';
  end if;
  if v_kind = 'task' and v_application_id is not null then
    raise exception using errcode = 'P0001', message = 'Task attachments cannot reference an application.';
  end if;
  if v_kind <> 'task' and not exists (
    select 1 from public.task_applications
    where id = v_application_id and task_id = v_task_id
      and (applicant_id = p_actor_id or exists (
        select 1 from public.task_listings where id = v_task_id and creator_id = p_actor_id
      ))
  ) then
    raise exception using errcode = '42501', message = 'Application attachment access denied.';
  end if;
  if split_part(v_path, '/', 1) <> p_actor_id::text or split_part(v_path, '/', 2) <> v_task_id::text then
    raise exception using errcode = 'P0001', message = 'Task attachment path must be task/user scoped.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = v_bucket and name = v_path) then
    raise exception using errcode = 'P0001', message = 'Storage object must be uploaded before registration.';
  end if;

  perform set_config('app.task_actor_id', p_actor_id::text, true);
  insert into public.task_attachments (
    task_id, application_id, uploader_id, bucket_id, object_path,
    mime_type, size_bytes, attachment_kind, sha256, caption
  ) values (
    v_task_id, v_application_id, p_actor_id, v_bucket, v_path,
    v_mime, v_size, v_kind, nullif(trim(p_payload ->> 'sha256'), ''),
    coalesce(trim(p_payload ->> 'caption'), '')
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_task_attachment(p_actor_id uuid, p_attachment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.task_attachments;
begin
  perform set_config('app.task_actor_id', p_actor_id::text, true);
  select * into v_attachment from public.task_attachments where id = p_attachment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'Task attachment not found.'; end if;
  if v_attachment.uploader_id <> p_actor_id and not exists (
    select 1 from public.user_public_profiles where user_id = p_actor_id and role = 'ADMIN'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'Task attachment delete denied.';
  end if;
  delete from public.task_attachments where id = v_attachment.id;
  return v_attachment.id;
end;
$$;

create or replace function public.assert_task_admin(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or not exists (
    select 1 from public.user_public_profiles
    where user_id = p_actor_id and role = 'ADMIN'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'Task administrator capability required.';
  end if;
end;
$$;

create or replace function public.open_task_arbitration(
  p_actor_id uuid,
  p_application_id uuid,
  p_filtered_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.task_applications;
  v_task public.task_listings;
begin
  if coalesce(char_length(trim(p_filtered_reason)), 0) not between 1 and 1200 then
    raise exception using errcode = 'P0001', message = 'Arbitration reason is required.';
  end if;
  select * into v_application from public.task_applications where id = p_application_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'Application not found.'; end if;
  select * into v_task from public.task_listings where id = v_application.task_id for update;
  if p_actor_id <> v_application.applicant_id and p_actor_id <> v_task.creator_id then
    raise exception using errcode = '42501', message = 'Only task participants may open arbitration.';
  end if;
  perform set_config('app.task_actor_id', p_actor_id::text, true);
  update public.task_applications
  set arbitration_status = 'pending', arbitration_reason = trim(p_filtered_reason),
      arbitrated_by = p_actor_id, arbitrated_at = now(), updated_at = now()
  where id = v_application.id;
  return v_application.id;
end;
$$;

create or replace function public.admin_force_complete_task(
  p_actor_id uuid,
  p_application_id uuid,
  p_filtered_completion_note text,
  p_filtered_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.task_applications;
  v_task public.task_listings;
  v_event_key text;
begin
  perform public.assert_task_admin(p_actor_id);
  if coalesce(char_length(trim(p_filtered_completion_note)), 0) not between 1 and 2000 then
    raise exception using errcode = 'P0001', message = 'Completion note is required.';
  end if;
  select * into v_application from public.task_applications where id = p_application_id for update;
  if not found or v_application.status not in ('accepted', 'submitted') then
    raise exception using errcode = 'P0001', message = 'Application cannot be force-completed.';
  end if;
  select * into v_task from public.task_listings where id = v_application.task_id for update;
  perform set_config('app.task_actor_id', p_actor_id::text, true);
  v_event_key := format('task:%s:user:%s:completion:v1', v_task.id, v_application.applicant_id);
  update public.task_applications
  set status = 'completed', completion_note = trim(p_filtered_completion_note),
      completion_submitted_at = coalesce(completion_submitted_at, now()), completed_at = now(),
      arbitration_status = 'force_completed', arbitration_reason = nullif(trim(p_filtered_reason), ''),
      arbitrated_by = p_actor_id, arbitrated_at = now(), reward_event_key = v_event_key, updated_at = now()
  where id = v_application.id;
  perform public.write_task_activity(
    p_actor_id, v_task.id, 'task.admin_force_completed', v_application.id,
    v_application.status, 'completed', jsonb_build_object('reason', nullif(trim(p_filtered_reason), '')),
    format('task:%s:application:%s:force-complete', v_task.id, v_application.id)
  );
  if v_task.reward_points > 0 then
    perform public.apply_reputation_event(
      p_event_key => v_event_key, p_user_id => v_application.applicant_id,
      p_amount => v_task.reward_points, p_reason => 'task_completion',
      p_source_resource => 'tasks', p_source_id => v_task.id, p_actor_id => p_actor_id
    );
  end if;
  return v_application.id;
end;
$$;

create or replace function public.admin_cancel_task_refund(
  p_actor_id uuid,
  p_task_id uuid,
  p_filtered_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_listings;
  v_application public.task_applications;
  v_refund_key text;
begin
  perform public.assert_task_admin(p_actor_id);
  if coalesce(char_length(trim(p_filtered_reason)), 0) not between 1 and 1200 then
    raise exception using errcode = 'P0001', message = 'Refund reason is required.';
  end if;
  select * into v_task from public.task_listings where id = p_task_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'Task not found.'; end if;
  perform set_config('app.task_actor_id', p_actor_id::text, true);
  update public.task_listings
  set status = 'closed', arbitration_status = 'cancelled', arbitration_reason = trim(p_filtered_reason),
      arbitrated_by = p_actor_id, arbitrated_at = now(), cancelled_at = now(),
      refund_event_key = format('task:%s:cancel-refund:v1', v_task.id), updated_at = now()
  where id = v_task.id;
  perform public.write_task_activity(
    p_actor_id, v_task.id, 'task.admin_cancelled_refund', null,
    v_task.status, 'closed', jsonb_build_object('reason', trim(p_filtered_reason)),
    format('task:%s:cancel-refund', v_task.id)
  );

  for v_application in
    select * from public.task_applications where task_id = v_task.id for update
  loop
    if v_application.status = 'completed' then
      v_refund_key := format('task:%s:application:%s:refund:v1', v_task.id, v_application.id);
      if v_task.reward_points > 0 then
        perform public.apply_reputation_event(
          p_event_key => v_refund_key, p_user_id => v_application.applicant_id,
          p_amount => -v_task.reward_points, p_reason => 'task_refund',
          p_source_resource => 'tasks', p_source_id => v_task.id, p_actor_id => p_actor_id
        );
      end if;
      update public.task_applications
      set arbitration_status = 'refunded', arbitration_reason = trim(p_filtered_reason),
          arbitrated_by = p_actor_id, arbitrated_at = now(), refund_event_key = v_refund_key, updated_at = now()
      where id = v_application.id;
    elsif v_application.status in ('pending', 'accepted', 'submitted') then
      update public.task_applications
      set status = 'cancelled', arbitration_status = 'cancelled', arbitration_reason = trim(p_filtered_reason),
          arbitrated_by = p_actor_id, arbitrated_at = now(), updated_at = now()
      where id = v_application.id;
    end if;
  end loop;
  return v_task.id;
end;
$$;

create or replace function public.admin_edit_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_filtered_payload jsonb,
  p_filtered_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_listings;
  v_category_id uuid;
  v_subcategory_id uuid;
  v_deadline timestamptz;
begin
  perform public.assert_task_admin(p_actor_id);
  select * into v_task from public.task_listings where id = p_task_id for update;
  if not found or v_task.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'Task cannot be edited.';
  end if;
  v_category_id := coalesce(nullif(p_filtered_payload ->> 'categoryId', '')::uuid, v_task.category_id);
  v_subcategory_id := coalesce(nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid, v_task.subcategory_id);
  v_deadline := coalesce(nullif(p_filtered_payload ->> 'deadlineAt', '')::timestamptz, v_task.deadline_at);
  perform public.validate_task_taxonomy(v_category_id, v_subcategory_id);
  perform set_config('app.task_actor_id', p_actor_id::text, true);
  update public.task_listings
  set category_id = v_category_id,
      subcategory_id = v_subcategory_id,
      title = coalesce(nullif(trim(p_filtered_payload ->> 'title'), ''), title),
      summary = coalesce(nullif(trim(p_filtered_payload ->> 'summary'), ''), summary),
      body = coalesce(nullif(trim(p_filtered_payload ->> 'body'), ''), body),
      skill_tags = coalesce(p_filtered_payload -> 'skillTags', skill_tags),
      reward_points = coalesce(nullif(p_filtered_payload ->> 'rewardPoints', '')::integer, reward_points),
      application_limit = coalesce(nullif(p_filtered_payload ->> 'applicationLimit', '')::integer, application_limit),
      deadline_at = v_deadline, updated_at = now()
  where id = v_task.id;
  perform public.write_task_activity(
    p_actor_id, v_task.id, 'task.admin_edited', null, v_task.status, v_task.status,
    jsonb_build_object('reason', nullif(trim(p_filtered_reason), '')), format('task:%s:admin-edit:%s', v_task.id, now())
  );
  return v_task.id;
end;
$$;

create or replace function public.admin_deduct_task_reputation(
  p_actor_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_task_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_key text := format('task:admin-deduct:%s:%s:%s:%s', coalesce(p_task_id::text, 'global'), p_user_id, p_amount, md5(coalesce(trim(p_reason), '')));
  v_reputation integer;
begin
  perform public.assert_task_admin(p_actor_id);
  if p_amount is null or p_amount <= 0 or coalesce(char_length(trim(p_reason)), 0) not between 1 and 1200 then
    raise exception using errcode = 'P0001', message = 'A positive deduction and reason are required.';
  end if;
  perform public.apply_reputation_event(
    p_event_key => v_event_key, p_user_id => p_user_id, p_amount => -p_amount,
    p_reason => trim(p_reason), p_source_resource => 'tasks', p_source_id => p_task_id, p_actor_id => p_actor_id
  );
  select reputation into v_reputation from public.user_public_profiles where user_id = p_user_id;
  if v_reputation is null then raise exception using errcode = 'P0002', message = 'Target profile not found.'; end if;
  if p_task_id is not null then
    perform public.write_task_activity(
      p_actor_id, p_task_id, 'task.reputation_deducted', null, null, null,
      jsonb_build_object('userId', p_user_id, 'amount', p_amount, 'reason', trim(p_reason)), v_event_key
    );
  end if;
  return v_reputation;
end;
$$;

alter table public.task_attachments enable row level security;
alter table public.task_activity_log enable row level security;

revoke all on public.task_attachments from anon, authenticated;
revoke all on public.task_activity_log from anon, authenticated;
grant select on public.task_attachments to anon, authenticated;
grant select on public.task_activity_log to anon, authenticated;

drop policy if exists task_attachments_read_visible on public.task_attachments;
create policy task_attachments_read_visible on public.task_attachments
  for select to anon, authenticated using (public.can_access_task_storage(task_id, (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)));

drop policy if exists task_activity_log_read_visible on public.task_activity_log;
create policy task_activity_log_read_visible on public.task_activity_log
  for select to anon, authenticated using (
    public.can_access_task_storage(task_id, (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid))
  );

drop policy if exists task_attachments_storage_read on storage.objects;
create policy task_attachments_storage_read on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
    and public.can_access_task_storage(((storage.foldername(name))[2])::uuid, (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid))
  );

drop policy if exists task_attachments_storage_insert on storage.objects;
create policy task_attachments_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
    and ((storage.foldername(name))[1])::uuid = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
    and public.can_access_task_storage(((storage.foldername(name))[2])::uuid, (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid))
  );

drop policy if exists task_attachments_storage_delete on storage.objects;
create policy task_attachments_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and ((storage.foldername(name))[1])::uuid = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
  );

revoke all on function public.write_task_activity(uuid, uuid, text, uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.record_task_activity(uuid, uuid, text, uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.register_task_attachment(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.delete_task_attachment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.assert_task_admin(uuid) from public, anon, authenticated;
revoke all on function public.open_task_arbitration(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_force_complete_task(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_cancel_task_refund(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_edit_task(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.admin_deduct_task_reputation(uuid, uuid, integer, text, uuid) from public, anon, authenticated;

grant execute on function public.record_task_activity(uuid, uuid, text, uuid, text, text, jsonb, text) to service_role;
grant execute on function public.register_task_attachment(uuid, jsonb) to service_role;
grant execute on function public.delete_task_attachment(uuid, uuid) to service_role;
grant execute on function public.open_task_arbitration(uuid, uuid, text) to service_role;
grant execute on function public.admin_force_complete_task(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_cancel_task_refund(uuid, uuid, text) to service_role;
grant execute on function public.admin_edit_task(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.admin_deduct_task_reputation(uuid, uuid, integer, text, uuid) to service_role;

-- Category creation remains an Edge Function capability decision (task:manageCategories).
-- This service-only wrapper lets that capability be granted to non-admin roles without
-- exposing a direct table write; the actor/profile check is repeated in the database.
create or replace function public.upsert_task_category(p_actor_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_id uuid;
  v_kind text := coalesce(p_payload ->> 'kind', 'category');
  v_category_id_input uuid := nullif(p_payload ->> 'categoryId', '')::uuid;
begin
  if p_actor_id is null or not exists (select 1 from public.user_public_profiles where user_id = p_actor_id) then
    raise exception using errcode = 'P0002', message = 'Task actor profile not found.';
  end if;
  perform set_config('app.task_actor_id', p_actor_id::text, true);
  if v_kind = 'subcategory' then
    if not exists (select 1 from public.task_categories where id = v_category_id_input and is_active) then
      raise exception using errcode = 'P0001', message = 'Active task category not found.';
    end if;
    insert into public.task_subcategories (category_id, slug, name, sort_order, is_active)
    values (
      v_category_id_input, trim(p_payload ->> 'slug'), trim(p_payload ->> 'name'),
      coalesce((p_payload ->> 'sortOrder')::integer, 0), coalesce((p_payload ->> 'isActive')::boolean, true)
    )
    on conflict (category_id, slug) do update
      set name = excluded.name, sort_order = excluded.sort_order,
          is_active = excluded.is_active, updated_at = now()
    returning id into v_category_id;
  else
    insert into public.task_categories (slug, name, description, sort_order, is_active)
    values (
      trim(p_payload ->> 'slug'), trim(p_payload ->> 'name'), coalesce(trim(p_payload ->> 'description'), ''),
      coalesce((p_payload ->> 'sortOrder')::integer, 0), coalesce((p_payload ->> 'isActive')::boolean, true)
    )
    on conflict (slug) do update
      set name = excluded.name, description = excluded.description,
          sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
    returning id into v_category_id;
  end if;
  return v_category_id;
end;
$$;

-- Capability/API contract: Edge Functions authorize these task:* markers before calling RPCs.
-- task:attach, task:submit, task:complete, task:arbitrate, task:manageCategories, task:manage
-- Legacy resource names tasks:* remain accepted by the current permissions adapter.
-- Module 3 merged from supabase/migrations/20260811_module3.sql.
-- Module 3: reviews, realtime notifications, task discovery/templates, shop and announcements.
-- Idempotent migration. All mutations are service-only RPCs; Edge Functions enforce auth,
-- sensitive filtering and role checks before invoking these functions.

-- 1. Multidimensional task reviews and reputation aggregates.
alter table if exists public.task_reviews
  add column if not exists communication_rating smallint not null default 5,
  add column if not exists professionalism_rating smallint not null default 5,
  add column if not exists punctuality_rating smallint not null default 5;

do $$
begin
  alter table public.task_reviews
    add constraint task_reviews_communication_rating_range check (communication_rating between 1 and 5);
exception when duplicate_object or undefined_object then null;
end;
$$;
do $$
begin
  alter table public.task_reviews
    add constraint task_reviews_professionalism_rating_range check (professionalism_rating between 1 and 5);
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter table public.task_reviews
    add constraint task_reviews_punctuality_rating_range check (punctuality_rating between 1 and 5);
exception when duplicate_object then null;
end;
$$;

create index if not exists task_reviews_reviewee_created_idx
  on public.task_reviews (reviewee_id, created_at desc);

create or replace function public.submit_task_review(
  p_actor_id uuid,
  p_application_id uuid,
  p_communication_rating smallint,
  p_professionalism_rating smallint,
  p_punctuality_rating smallint,
  p_content text
)
returns public.task_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.task_applications;
  v_review public.task_reviews;
  v_task public.task_listings;
  v_reviewee uuid;
begin
  if p_actor_id is null or p_content is null or char_length(trim(p_content)) < 1 then
    raise exception using errcode = '22023', message = 'Review content is required.';
  end if;
  if p_communication_rating not between 1 and 5
    or p_professionalism_rating not between 1 and 5
    or p_punctuality_rating not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Review ratings must be between 1 and 5.';
  end if;

  select * into v_application from public.task_applications where id = p_application_id for update;
  if not found or v_application.status <> 'completed' then
    raise exception using errcode = 'P0002', message = 'Completed application not found.';
  end if;
  select * into v_task from public.task_listings where id = v_application.task_id;
  if v_task.creator_id = p_actor_id then
    v_reviewee := v_application.applicant_id;
  elsif v_application.applicant_id = p_actor_id then
    v_reviewee := v_task.creator_id;
  else
    raise exception using errcode = '42501', message = 'Only task participants may review this application.';
  end if;

  insert into public.task_reviews (
    task_id, application_id, reviewer_id, reviewee_id, rating,
    communication_rating, professionalism_rating, punctuality_rating, content
  ) values (
    v_task.id, v_application.id, p_actor_id, v_reviewee,
    round((p_communication_rating + p_professionalism_rating + p_punctuality_rating) / 3.0)::smallint,
    p_communication_rating, p_professionalism_rating, p_punctuality_rating, trim(p_content)
  ) returning * into v_review;
  perform public.create_notification(
    format('task-review:%s:%s', v_review.application_id, v_review.reviewer_id),
    v_reviewee, p_actor_id, 'task.review.created',
    jsonb_build_object('taskId', v_task.id, 'applicationId', v_application.id, 'reviewId', v_review.id)
  );
  return v_review;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'A review for this application already exists.';
end;
$$;

create or replace function public.get_user_reputation_summary(p_user_id uuid)
returns table (
  user_id uuid,
  reputation integer,
  review_count bigint,
  communication_average numeric,
  professionalism_average numeric,
  punctuality_average numeric,
  overall_average numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.reputation,
    count(r.id),
    round(coalesce(avg(r.communication_rating), 0), 2),
    round(coalesce(avg(r.professionalism_rating), 0), 2),
    round(coalesce(avg(r.punctuality_rating), 0), 2),
    round(coalesce(avg(r.rating), 0), 2)
  from public.user_public_profiles p
  left join public.task_reviews r on r.reviewee_id = p.user_id
  where p.user_id = p_user_id
  group by p.user_id, p.reputation;
$$;

revoke all on function public.submit_task_review(uuid, uuid, smallint, smallint, smallint, text) from public, anon, authenticated;
grant execute on function public.submit_task_review(uuid, uuid, smallint, smallint, smallint, text) to service_role;
revoke all on function public.get_user_reputation_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_user_reputation_summary(uuid) to anon, authenticated;

-- 2. Notifications with idempotency, read state and Realtime publication.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type ~ '^[a-z0-9_.:-]{2,80}$'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc) where read_at is null;
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated
  using ((select auth.uid()) = recipient_id);
drop policy if exists notifications_mark_own on public.notifications;
create policy notifications_mark_own on public.notifications for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

create or replace function public.create_notification(
  p_event_key text, p_recipient_id uuid, p_actor_id uuid, p_type text, p_payload jsonb
)
returns public.notifications
language plpgsql security definer set search_path = ''
as $$
declare v_notification public.notifications;
begin
  if p_event_key is null or p_recipient_id is null or p_type is null then
    raise exception using errcode = '22023', message = 'Notification fields are required.';
  end if;
  insert into public.notifications(event_key, recipient_id, actor_id, type, payload)
  values (p_event_key, p_recipient_id, p_actor_id, p_type, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_key) do update set event_key = excluded.event_key
  returning * into v_notification;
  return v_notification;
end;
$$;

create or replace function public.mark_notification_read(p_actor_id uuid, p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_id = p_actor_id;
  return found;
end;
$$;
create or replace function public.mark_all_notifications_read(p_actor_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.notifications set read_at = now()
  where recipient_id = p_actor_id and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.create_notification(text, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_notification(text, uuid, uuid, text, jsonb) to service_role;
revoke all on function public.mark_notification_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_notification_read(uuid, uuid) to service_role;
revoke all on function public.mark_all_notifications_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to service_role;

do $$
begin
  execute 'alter publication supabase_realtime add table public.notifications';
exception when duplicate_object or undefined_object then null;
end;
$$;

-- Notify task creator/applicant on application lifecycle changes.
create or replace function public.notify_task_application_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_creator uuid; v_recipient uuid; v_type text; v_event text;
begin
  select creator_id into v_creator from public.task_listings where id = new.task_id;
  if tg_op = 'INSERT' then
    v_recipient := v_creator; v_type := 'task.application.created';
  elsif new.status is distinct from old.status then
    v_recipient := case when new.status in ('accepted','rejected','cancelled','submitted','completed') then
      case when new.status = 'submitted' or new.status = 'completed' then v_creator else new.applicant_id end
      else null end;
    v_type := 'task.application.' || new.status;
  end if;
  if v_recipient is not null and v_recipient <> new.applicant_id or (v_recipient is not null and v_recipient <> v_creator) then
    v_event := format('task-application:%s:%s', new.id, coalesce(new.status, 'created'));
    perform public.create_notification(v_event, v_recipient, null, v_type,
      jsonb_build_object('taskId', new.task_id, 'applicationId', new.id, 'status', new.status));
  end if;
  return new;
end;
$$;
drop trigger if exists task_applications_notification on public.task_applications;
create trigger task_applications_notification after insert or update of status on public.task_applications
for each row execute function public.notify_task_application_change();

-- 3. Explainable task recommendations and reusable templates.
alter table if exists public.task_listings add column if not exists min_reputation integer not null default 0;
do $$ begin
  alter table public.task_listings add constraint task_listings_min_reputation_range check (min_reputation between 0 and 1000000);
exception when duplicate_object then null; end $$;

create or replace function public.recommend_task_listings(p_user_id uuid, p_limit integer default 20)
returns table (
  task_id uuid, title text, summary text, reward_points integer, deadline_at timestamptz,
  score numeric, explanation text
)
language plpgsql stable security definer set search_path = '' as $$
declare v_reputation integer; v_role text;
begin
  if p_user_id is null or (select auth.uid()) is distinct from p_user_id then
    raise exception using errcode = '42501', message = 'Only the current user can request recommendations.';
  end if;
  select reputation into v_reputation from public.user_public_profiles where user_id = p_user_id;
  select target_role into v_role from public.profiles where id = p_user_id;
  return query
  with history as (
    select tl.category_id, count(*)::numeric as uses
    from public.task_applications ta join public.task_listings tl on tl.id = ta.task_id
    where ta.applicant_id = p_user_id group by tl.category_id
  )
  select tl.id, tl.title, tl.summary, tl.reward_points, tl.deadline_at,
    round((case when coalesce(tl.skill_tags, '[]'::jsonb) @> to_jsonb(array[coalesce(v_role, '')]::text[]) then 50 else 0 end
      + least(30, coalesce(h.uses, 0) * 5) + least(20, tl.reward_points / 500.0))::numeric, 2),
    concat_ws('; ',
      case when coalesce(tl.skill_tags, '[]'::jsonb) @> to_jsonb(array[coalesce(v_role, '')]::text[]) then '匹配目标岗位' end,
      case when h.uses is not null then '与你参与过的分类相近' end,
      '奖励与截止时间综合排序')
  from public.task_listings tl left join history h on h.category_id = tl.category_id
  where tl.status = 'published' and tl.deadline_at > now() and tl.min_reputation <= coalesce(v_reputation, 0)
  order by score desc, tl.deadline_at asc limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;
revoke all on function public.recommend_task_listings(uuid, integer) from public, anon;
grant execute on function public.recommend_task_listings(uuid, integer) to authenticated;

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null, summary text not null, body text not null, skill_tags jsonb not null default '[]'::jsonb,
  category_id uuid not null references public.task_categories(id) on delete restrict,
  subcategory_id uuid references public.task_subcategories(id) on delete set null,
  default_reward_points integer not null default 0 check (default_reward_points between 0 and 10000),
  default_application_limit integer not null default 1 check (default_application_limit between 1 and 1000),
  default_duration_days integer not null default 7 check (default_duration_days between 1 and 365),
  is_public boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 120), check (char_length(summary) between 1 and 280), check (char_length(body) between 1 and 8000),
  check (jsonb_typeof(skill_tags) = 'array')
);
create index if not exists task_templates_owner_idx on public.task_templates(owner_id, updated_at desc);
create index if not exists task_templates_public_idx on public.task_templates(updated_at desc) where is_public;
alter table public.task_templates enable row level security;
revoke all on public.task_templates from anon, authenticated;
grant select on public.task_templates to anon, authenticated;
drop policy if exists task_templates_read on public.task_templates;
create policy task_templates_read on public.task_templates for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()));

create or replace function public.upsert_task_template(p_actor_id uuid, p_template_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return public.save_task_template(p_actor_id, p_template_id, p_payload);
end;
$$;
create or replace function public.delete_task_template(p_actor_id uuid, p_template_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin delete from public.task_templates where id=p_template_id and owner_id=p_actor_id; return found; end; $$;
revoke all on function public.upsert_task_template(uuid, uuid, jsonb), public.delete_task_template(uuid, uuid) from public, anon, authenticated;
grant execute on function public.upsert_task_template(uuid, uuid, jsonb), public.delete_task_template(uuid, uuid) to service_role;

-- 4. Points shop: atomic stock/points redemption and immutable audit.
create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(), sku text not null unique, name text not null,
  description text not null default '', points_cost integer not null check (points_cost > 0 and points_cost <= 1000000),
  stock_quantity integer not null default 0 check (stock_quantity >= 0), metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true, created_by_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (char_length(sku) between 1 and 80), check (char_length(name) between 1 and 120), check (char_length(description) <= 2000)
);
create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(), order_key text not null, user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.shop_products(id) on delete restrict, quantity integer not null check (quantity between 1 and 100),
  unit_cost integer not null check (unit_cost > 0), total_cost integer not null check (total_cost > 0), status text not null default 'fulfilled' check (status in ('fulfilled','cancelled')),
  created_at timestamptz not null default now(), unique (user_id, order_key)
);
create table if not exists public.shop_order_events (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.shop_orders(id) on delete cascade,
  event_type text not null, actor_id uuid references auth.users(id) on delete set null, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.shop_orders drop constraint if exists shop_orders_order_key_key;
exception when undefined_table then null;
end; $$;
create unique index if not exists shop_orders_user_order_key_idx on public.shop_orders(user_id, order_key);
create index if not exists shop_products_active_idx on public.shop_products(is_active, created_at desc);
create index if not exists shop_orders_user_created_idx on public.shop_orders(user_id, created_at desc);
alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_events enable row level security;
revoke all on public.shop_products, public.shop_orders, public.shop_order_events from anon, authenticated;
grant select on public.shop_products to anon, authenticated;
grant select on public.shop_orders, public.shop_order_events to authenticated;
drop policy if exists shop_products_public_read on public.shop_products;
create policy shop_products_public_read on public.shop_products for select to anon, authenticated using (is_active);
drop policy if exists shop_orders_own_read on public.shop_orders;
create policy shop_orders_own_read on public.shop_orders for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists shop_order_events_own_read on public.shop_order_events;
create policy shop_order_events_own_read on public.shop_order_events for select to authenticated using (exists (select 1 from public.shop_orders o where o.id = order_id and o.user_id = (select auth.uid())));

create or replace function public.redeem_shop_product(p_user_id uuid, p_product_id uuid, p_quantity integer, p_order_key text)
returns public.shop_orders language plpgsql security definer set search_path = '' as $$
declare v_product public.shop_products; v_order public.shop_orders; v_total integer; v_reputation integer; v_order_id uuid;
begin
  if p_user_id is null or p_quantity is null or p_quantity < 1 or p_quantity > 100 or char_length(trim(coalesce(p_order_key,''))) < 8 then
    raise exception using errcode='22023', message='Invalid redemption request.';
  end if;
  select * into v_order from public.shop_orders where user_id = p_user_id and order_key = trim(p_order_key);
  if found then return v_order; end if;
  select * into v_product from public.shop_products where id = p_product_id and is_active for update;
  if not found or v_product.stock_quantity < p_quantity then raise exception using errcode='P0001', message='Product is out of stock.'; end if;
  v_total := v_product.points_cost * p_quantity;
  select reputation into v_reputation from public.user_public_profiles where user_id = p_user_id for update;
  if v_reputation is null or v_reputation < v_total then raise exception using errcode='P0001', message='Insufficient points.'; end if;
  update public.shop_products set stock_quantity = stock_quantity - p_quantity, updated_at = now() where id = v_product.id;
  update public.user_public_profiles set reputation = reputation - v_total, updated_at = now() where user_id = p_user_id;
  insert into public.shop_orders(order_key,user_id,product_id,quantity,unit_cost,total_cost) values(trim(p_order_key),p_user_id,v_product.id,p_quantity,v_product.points_cost,v_total) returning * into v_order;
  insert into public.shop_order_events(order_id,event_type,actor_id,details) values(v_order.id,'redeemed',p_user_id,jsonb_build_object('sku',v_product.sku,'quantity',p_quantity,'totalCost',v_total));
  insert into public.reputation_events(event_key,user_id,amount,reason,source_resource,source_id,created_by_id)
    values('shop:' || v_order.id,p_user_id,-v_total,'shop_redemption','shop',v_order.id,p_user_id);
  return v_order;
exception when unique_violation then
  select * into v_order from public.shop_orders where user_id = p_user_id and order_key = trim(p_order_key); if found then return v_order; end if; raise;
end;
$$;

create or replace function public.upsert_shop_product(p_actor_id uuid, p_product_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.user_public_profiles where user_id=p_actor_id and role='ADMIN') then raise exception using errcode='42501', message='Admin permission required.'; end if;
  insert into public.shop_products(id,sku,name,description,points_cost,stock_quantity,metadata,is_active,created_by_id)
  values(coalesce(p_product_id,gen_random_uuid()),trim(p_payload->>'sku'),trim(p_payload->>'name'),coalesce(trim(p_payload->>'description'),''),(p_payload->>'pointsCost')::integer,coalesce((p_payload->>'stockQuantity')::integer,0),coalesce(p_payload->'metadata','{}'::jsonb),coalesce((p_payload->>'isActive')::boolean,true),p_actor_id)
  on conflict(id) do update set sku=excluded.sku,name=excluded.name,description=excluded.description,points_cost=excluded.points_cost,stock_quantity=excluded.stock_quantity,metadata=excluded.metadata,is_active=excluded.is_active,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.redeem_shop_product(uuid, uuid, integer, text), public.upsert_shop_product(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.redeem_shop_product(uuid, uuid, integer, text), public.upsert_shop_product(uuid, uuid, jsonb) to service_role;

-- 5. Markdown announcements with role-gated management.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  body_markdown text not null, status text not null default 'draft' check (status in ('draft','published','archived')),
  is_pinned boolean not null default false, published_at timestamptz, created_by_id uuid not null references auth.users(id) on delete restrict,
  updated_by_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), check (char_length(title) between 1 and 160), check (char_length(body_markdown) between 1 and 20000),
  check (body_markdown !~* '<\s*script' and body_markdown !~* 'javascript:')
);
create index if not exists announcements_published_pin_idx on public.announcements(is_pinned desc, published_at desc) where status='published';
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to anon, authenticated;
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements for select to anon, authenticated using (status='published');

create or replace function public.upsert_announcement(p_actor_id uuid, p_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.user_public_profiles where user_id=p_actor_id and role in ('MODERATOR','ADMIN')) then raise exception using errcode='42501', message='Announcement permission required.'; end if;
  if coalesce(p_payload->>'bodyMarkdown','') ~* '<\s*script|javascript:' then raise exception using errcode='22023', message='Unsafe markdown.'; end if;
  insert into public.announcements(id,slug,title,body_markdown,status,is_pinned,published_at,created_by_id,updated_by_id)
  values(coalesce(p_id,gen_random_uuid()),trim(p_payload->>'slug'),trim(p_payload->>'title'),trim(p_payload->>'bodyMarkdown'),coalesce(p_payload->>'status','draft'),coalesce((p_payload->>'isPinned')::boolean,false),case when coalesce(p_payload->>'status','draft')='published' then coalesce((p_payload->>'publishedAt')::timestamptz,now()) end,p_actor_id,p_actor_id)
  on conflict(id) do update set slug=excluded.slug,title=excluded.title,body_markdown=excluded.body_markdown,status=excluded.status,is_pinned=excluded.is_pinned,published_at=excluded.published_at,updated_by_id=p_actor_id,updated_at=now()
    where public.announcements.created_by_id=p_actor_id or exists(select 1 from public.user_public_profiles where user_id=p_actor_id and role='ADMIN')
  returning id into v_id;
  if v_id is null then raise exception using errcode='42501', message='Announcement is not editable by actor.'; end if; return v_id;
end;
$$;
create or replace function public.delete_announcement(p_actor_id uuid, p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.user_public_profiles where user_id=p_actor_id and role in ('MODERATOR','ADMIN')) then raise exception using errcode='42501', message='Announcement permission required.'; end if;
  delete from public.announcements where id=p_id and (created_by_id=p_actor_id or exists(select 1 from public.user_public_profiles where user_id=p_actor_id and role='ADMIN')); return found;
end;
$$;
create or replace function public.set_announcement_pinned(p_actor_id uuid, p_id uuid, p_is_pinned boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.user_public_profiles where user_id=p_actor_id and role in ('MODERATOR','ADMIN')) then
    raise exception using errcode='42501', message='Announcement permission required.';
  end if;
  update public.announcements set is_pinned = p_is_pinned, updated_by_id = p_actor_id, updated_at = now() where id = p_id;
  return found;
end;
$$;
revoke all on function public.upsert_announcement(uuid, uuid, jsonb), public.delete_announcement(uuid, uuid), public.set_announcement_pinned(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.upsert_announcement(uuid, uuid, jsonb), public.delete_announcement(uuid, uuid), public.set_announcement_pinned(uuid, uuid, boolean) to service_role;

-- Forum/admin capability hardening and redeem rewards.
-- This migration is idempotent and keeps all privileged writes service-only.

alter table if exists public.redeem_codes
  add column if not exists reward_role public.user_role,
  add column if not exists reward_permission text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.redeem_codes'::regclass
      and conname = 'redeem_codes_reward_permission_format'
  ) then
    alter table public.redeem_codes
      add constraint redeem_codes_reward_permission_format
      check (reward_permission is null or reward_permission ~ '^(forum|admin|tasks|shop|announce):[A-Za-z0-9_]+$');
  end if;
end;
$$;

create table if not exists public.user_granted_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability ~ '^(forum|admin|tasks|shop|announce):[A-Za-z0-9_]+$'),
  granted_by_id uuid references auth.users(id) on delete set null,
  source_redeem_code_id uuid references public.redeem_codes(id) on delete set null,
  reason text not null default 'manual' check (char_length(reason) between 1 and 160),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (user_id, capability)
);

create index if not exists user_granted_permissions_active_idx
  on public.user_granted_permissions (user_id, capability)
  where revoked_at is null;

create table if not exists public.permission_grant_audit (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid references public.user_granted_permissions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null,
  action text not null check (action in ('GRANT', 'REVOKE')),
  actor_id uuid references auth.users(id) on delete set null,
  source_redeem_code_id uuid references public.redeem_codes(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 80),
  target_user_id uuid references auth.users(id) on delete set null,
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id uuid,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_granted_permissions enable row level security;
alter table public.permission_grant_audit enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "user_granted_permissions_select_own" on public.user_granted_permissions;
create policy "user_granted_permissions_select_own"
  on public.user_granted_permissions for select to authenticated
  using ((select auth.uid()) = user_id and revoked_at is null);

revoke all on public.user_granted_permissions from public, anon, authenticated;
grant select on public.user_granted_permissions to authenticated;
revoke all on public.permission_grant_audit from public, anon, authenticated;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select, insert, update, delete on public.user_granted_permissions to service_role;
grant select, insert on public.permission_grant_audit to service_role;
grant select, insert on public.admin_audit_log to service_role;

create or replace function public.canonical_capability(p_capability text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(trim(p_capability), '')
    when 'forum:pin_post' then 'forum:pinPost'
    when 'forum:lock_post' then 'forum:lockPost'
    when 'forum:create_post' then 'forum:createPost'
    when 'forum:create_comment' then 'forum:createComment'
    when 'forum:delete_any_post' then 'forum:deleteAnyPost'
    when 'forum:delete_any_comment' then 'forum:deleteAnyComment'
    when 'forum:delete_own_post' then 'forum:deleteOwnPost'
    when 'forum:delete_own_comment' then 'forum:deleteOwnComment'
    when 'forum:edit_own_post' then 'forum:editOwnPost'
    when 'task:create' then 'tasks:create'
    when 'task:update' then 'tasks:update'
    when 'task:publish' then 'tasks:publish'
    when 'task:manageCategories' then 'tasks:manageCategories'
    when 'task:manage' then 'tasks:manage'
    when 'task:apply' then 'tasks:apply'
    when 'task:submit' then 'tasks:submit'
    when 'task:complete' then 'tasks:complete'
    when 'task:attach' then 'tasks:attach'
    when 'task:arbitrate' then 'tasks:arbitrate'
    else trim(p_capability)
  end;
$$;

create or replace function public.role_has_capability(p_role public.user_role, p_capability text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_role = 'ADMIN'::public.user_role then true
    when p_role = 'MODERATOR'::public.user_role then public.canonical_capability(p_capability) = any(array[
      'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
      'forum:deleteOwnPost', 'forum:deleteOwnComment', 'forum:deleteAnyPost',
      'forum:deleteAnyComment', 'forum:pinPost', 'forum:lockPost',
      'admin:access', 'admin:manageForum', 'tasks:create', 'tasks:update', 'tasks:publish',
      'tasks:manageCategories', 'tasks:apply', 'tasks:submit', 'tasks:attach'
    ])
    else public.canonical_capability(p_capability) = any(array[
      'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
      'forum:deleteOwnPost', 'forum:deleteOwnComment', 'tasks:create', 'tasks:update', 'tasks:publish',
      'tasks:manageCategories', 'tasks:apply', 'tasks:submit', 'tasks:attach'
    ])
  end;
$$;

create or replace function public.has_capability(p_user_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_public_profiles as profile
    where profile.user_id = p_user_id
      and public.role_has_capability(profile.role, p_capability)
  )
  or exists (
    select 1
    from public.user_granted_permissions as grant_row
    where grant_row.user_id = p_user_id
      and grant_row.revoked_at is null
      and (grant_row.expires_at is null or grant_row.expires_at > now())
      and public.canonical_capability(grant_row.capability) = public.canonical_capability(p_capability)
  );
$$;

create or replace function public.assert_actor_capability(p_actor_id uuid, p_capability text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or not public.has_capability(p_actor_id, p_capability) then
    raise exception 'actor lacks capability' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.canonical_capability(text) from public, anon, authenticated;
revoke all on function public.role_has_capability(public.user_role, text) from public, anon, authenticated;
revoke all on function public.has_capability(uuid, text) from public, anon, authenticated;
revoke all on function public.assert_actor_capability(uuid, text) from public, anon, authenticated;
grant execute on function public.get_user_capabilities() to authenticated;
grant execute on function public.has_capability(uuid, text) to service_role;
grant execute on function public.assert_actor_capability(uuid, text) to service_role;

create or replace function public.get_user_capabilities()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  with profile_caps as (
    select case profiles.role
      when 'ADMIN'::public.user_role then array[
        'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
        'forum:deleteOwnPost', 'forum:deleteOwnComment', 'forum:deleteAnyPost', 'forum:deleteAnyComment',
        'forum:pinPost', 'forum:lockPost', 'forum:manageCategories', 'forum:manageTags',
        'admin:access', 'admin:manageForum', 'admin:manageUsers', 'admin:manageRedeemCodes',
        'admin:manageSensitiveWords', 'admin:transferAccount', 'tasks:create', 'tasks:update',
        'tasks:publish', 'tasks:close', 'tasks:archive', 'tasks:delete', 'tasks:manageCategories',
        'tasks:manage', 'tasks:apply', 'tasks:assign', 'tasks:submit', 'tasks:complete', 'tasks:attach', 'tasks:arbitrate',
        'task:create', 'task:update', 'task:publish', 'task:manageCategories', 'task:manage', 'task:apply', 'task:submit', 'task:complete', 'task:attach', 'task:arbitrate',
        'shop:view', 'shop:redeem', 'shop:manageProducts', 'shop:manageOrders',
        'announce:read', 'announce:create', 'announce:update', 'announce:delete', 'announce:publish', 'announce:pin'
      ]
      when 'MODERATOR'::public.user_role then array[
        'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
        'forum:deleteOwnPost', 'forum:deleteOwnComment', 'forum:deleteAnyPost', 'forum:deleteAnyComment',
        'forum:pinPost', 'forum:lockPost', 'admin:access', 'admin:manageForum', 'tasks:create', 'tasks:update', 'tasks:publish', 'tasks:manageCategories', 'tasks:apply', 'tasks:submit', 'tasks:attach',
        'task:create', 'task:update', 'task:publish', 'task:manageCategories', 'task:apply', 'task:submit', 'task:attach',
        'shop:view', 'shop:redeem', 'announce:read', 'announce:create', 'announce:update', 'announce:publish', 'announce:pin'
      ]
      else array[
        'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
        'forum:deleteOwnPost', 'forum:deleteOwnComment', 'tasks:create', 'tasks:update', 'tasks:publish', 'tasks:manageCategories', 'tasks:apply', 'tasks:submit', 'tasks:attach',
        'task:create', 'task:update', 'task:publish', 'task:manageCategories', 'task:apply', 'task:submit', 'task:attach', 'shop:view', 'shop:redeem', 'announce:read'
      ]
    end as capabilities
    from public.user_public_profiles as profiles
    where profiles.user_id = (select auth.uid())
  ), merged as (
    select unnest(capabilities) as capability from profile_caps
    union
    select public.canonical_capability(grants.capability)
    from public.user_granted_permissions as grants
    where grants.user_id = (select auth.uid())
      and grants.revoked_at is null
      and (grants.expires_at is null or grants.expires_at > now())
  )
  select coalesce(array_agg(capability order by capability), '{}'::text[])
  from merged;
$$;

revoke all on function public.get_user_capabilities() from public, anon, authenticated;
grant execute on function public.get_user_capabilities() to authenticated;

-- Add actor checks to existing service-only forum mutations.
create or replace function public.create_forum_post(
  p_actor_id uuid, p_category_id uuid, p_title text, p_content text,
  p_tag_ids uuid[] default '{}'::uuid[]
) returns public.forum_posts language plpgsql security definer set search_path = '' as $$
declare created_post public.forum_posts;
begin
  perform public.assert_actor_capability(p_actor_id, 'forum:createPost');
  if not exists (select 1 from public.forum_categories where id = p_category_id and is_active) then
    raise exception 'forum category is unavailable' using errcode = '23503';
  end if;
  insert into public.forum_posts (category_id, author_id, title, content)
  values (p_category_id, p_actor_id, trim(p_title), trim(p_content)) returning * into created_post;
  insert into public.forum_post_tags (post_id, tag_id)
  select created_post.id, tags.id from public.forum_tags as tags
  where tags.id = any(coalesce(p_tag_ids, '{}'::uuid[])) on conflict do nothing;
  return created_post;
end; $$;

create or replace function public.update_forum_post(
  p_actor_id uuid, p_post_id uuid, p_category_id uuid, p_title text, p_content text,
  p_tag_ids uuid[] default '{}'::uuid[]
) returns public.forum_posts language plpgsql security definer set search_path = '' as $$
declare updated_post public.forum_posts;
begin
  perform public.assert_actor_capability(p_actor_id, 'forum:editOwnPost');
  select * into updated_post from public.forum_posts where id = p_post_id for update;
  if updated_post.id is null or updated_post.status <> 'PUBLISHED' then raise exception 'forum post not found' using errcode = 'P0002'; end if;
  if updated_post.author_id <> p_actor_id then raise exception 'forum post ownership required' using errcode = '42501'; end if;
  if not exists (select 1 from public.forum_categories where id = p_category_id and is_active) then raise exception 'forum category is unavailable' using errcode = '23503'; end if;
  update public.forum_posts set category_id = p_category_id, title = trim(p_title), content = trim(p_content), updated_at = now()
  where id = p_post_id returning * into updated_post;
  delete from public.forum_post_tags where post_id = p_post_id;
  insert into public.forum_post_tags (post_id, tag_id)
  select p_post_id, tags.id from public.forum_tags as tags
  where tags.id = any(coalesce(p_tag_ids, '{}'::uuid[])) on conflict do nothing;
  return updated_post;
end; $$;

create or replace function public.delete_own_forum_post(p_actor_id uuid, p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_actor_capability(p_actor_id, 'forum:deleteOwnPost');
  update public.forum_posts set status = 'DELETED', deleted_at = now(), is_pinned = false, updated_at = now()
  where id = p_post_id and author_id = p_actor_id and status = 'PUBLISHED';
  if not found then raise exception 'forum post ownership required' using errcode = '42501'; end if;
end; $$;

create or replace function public.create_forum_comment(p_actor_id uuid, p_post_id uuid, p_content text)
returns public.forum_comments language plpgsql security definer set search_path = '' as $$
declare post_record public.forum_posts; created_comment public.forum_comments;
begin
  perform public.assert_actor_capability(p_actor_id, 'forum:createComment');
  select * into post_record from public.forum_posts where id = p_post_id for update;
  if post_record.id is null or post_record.status <> 'PUBLISHED' or post_record.is_locked then
    raise exception 'forum post is unavailable' using errcode = 'P0002';
  end if;
  insert into public.forum_comments (post_id, author_id, content)
  values (p_post_id, p_actor_id, trim(p_content)) returning * into created_comment;
  update public.forum_posts set comment_count = comment_count + 1, updated_at = now() where id = p_post_id;
  return created_comment;
end; $$;

create or replace function public.delete_own_forum_comment(p_actor_id uuid, p_comment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare comment_record public.forum_comments;
begin
  perform public.assert_actor_capability(p_actor_id, 'forum:deleteOwnComment');
  select * into comment_record from public.forum_comments where id = p_comment_id for update;
  if comment_record.id is null or comment_record.status <> 'PUBLISHED' then raise exception 'forum comment not found' using errcode = 'P0002'; end if;
  if comment_record.author_id <> p_actor_id then raise exception 'forum comment ownership required' using errcode = '42501'; end if;
  update public.forum_comments set status = 'DELETED', deleted_at = now(), updated_at = now() where id = p_comment_id;
  update public.forum_posts set comment_count = greatest(0, comment_count - 1), updated_at = now() where id = comment_record.post_id;
end; $$;

create or replace function public.set_forum_vote(
  p_actor_id uuid, p_post_id uuid, p_comment_id uuid, p_value smallint
) returns table (target_id uuid, vote_value smallint, score integer, upvote_count integer, downvote_count integer)
language plpgsql security definer set search_path = '' as $$
declare vote_record public.forum_votes; target_author_id uuid; target_score integer; target_upvotes integer; target_downvotes integer;
  old_value smallint := 0; new_value smallint := coalesce(p_value, 0); reputation_change integer := 0;
begin
  perform public.assert_actor_capability(p_actor_id, 'forum:vote');
  if (p_post_id is not null)::integer + (p_comment_id is not null)::integer <> 1 then raise exception 'vote requires exactly one target' using errcode = '22023'; end if;
  if p_value is not null and p_value not in (-1, 1) then raise exception 'vote must be -1, 1, or null' using errcode = '22023'; end if;
  if p_post_id is not null then
    select author_id, score, upvote_count, downvote_count into target_author_id, target_score, target_upvotes, target_downvotes from public.forum_posts where id = p_post_id and status = 'PUBLISHED' for update;
    select * into vote_record from public.forum_votes where voter_id = p_actor_id and post_id = p_post_id for update;
  else
    select comments.author_id, comments.score, comments.upvote_count, comments.downvote_count into target_author_id, target_score, target_upvotes, target_downvotes
    from public.forum_comments as comments join public.forum_posts as posts on posts.id = comments.post_id
    where comments.id = p_comment_id and comments.status = 'PUBLISHED' and posts.status = 'PUBLISHED' for update;
    select * into vote_record from public.forum_votes where voter_id = p_actor_id and comment_id = p_comment_id for update;
  end if;
  if target_author_id is null then raise exception 'vote target not found' using errcode = 'P0002'; end if;
  if target_author_id = p_actor_id then raise exception 'self voting is not allowed' using errcode = '42501'; end if;
  if vote_record.id is null and p_value is null then raise exception 'active vote not found' using errcode = 'P0002'; end if;
  if vote_record.id is null then
    insert into public.forum_votes (voter_id, post_id, comment_id, value, is_active) values (p_actor_id, p_post_id, p_comment_id, p_value, true) returning * into vote_record;
  else
    if vote_record.is_active then old_value := vote_record.value; end if;
    update public.forum_votes set value = coalesce(p_value, value), is_active = p_value is not null, revision = revision + 1, updated_at = now() where id = vote_record.id returning * into vote_record;
  end if;
  if vote_record.revision = 1 then old_value := 0; end if;
  reputation_change := (case new_value when 1 then 10 when -1 then -2 else 0 end) - (case old_value when 1 then 10 when -1 then -2 else 0 end);
  if p_post_id is not null then
    update public.forum_posts set score = score + new_value - old_value,
      upvote_count = greatest(0, upvote_count + (case when new_value = 1 then 1 else 0 end) - (case when old_value = 1 then 1 else 0 end)),
      downvote_count = greatest(0, downvote_count + (case when new_value = -1 then 1 else 0 end) - (case when old_value = -1 then 1 else 0 end)), updated_at = now()
    where id = p_post_id returning score, upvote_count, downvote_count into target_score, target_upvotes, target_downvotes;
  else
    update public.forum_comments set score = score + new_value - old_value,
      upvote_count = greatest(0, upvote_count + (case when new_value = 1 then 1 else 0 end) - (case when old_value = 1 then 1 else 0 end)),
      downvote_count = greatest(0, downvote_count + (case when new_value = -1 then 1 else 0 end) - (case when old_value = -1 then 1 else 0 end)), updated_at = now()
    where id = p_comment_id returning score, upvote_count, downvote_count into target_score, target_upvotes, target_downvotes;
  end if;
  if reputation_change <> 0 then perform public.apply_reputation_event(format('forum-vote:%s:%s', vote_record.id, vote_record.revision), target_author_id, reputation_change, '璁哄潧鎶曠エ澹版湜鍙樺姩', 'forum_vote', coalesce(p_post_id, p_comment_id), p_actor_id); end if;
  return query select coalesce(p_post_id, p_comment_id), case when vote_record.is_active then vote_record.value else null end, target_score, target_upvotes, target_downvotes;
end; $$;

create or replace function public.moderate_forum_content(p_actor_id uuid, p_target text, p_target_id uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare capability text;
begin
  capability := case when p_target = 'post' and p_action in ('PIN','UNPIN') then 'forum:pinPost'
    when p_target = 'post' and p_action in ('LOCK','UNLOCK') then 'forum:lockPost'
    when p_target = 'post' and p_action = 'DELETE' then 'forum:deleteAnyPost'
    when p_target = 'comment' and p_action = 'DELETE' then 'forum:deleteAnyComment' end;
  if capability is null then raise exception 'unsupported moderation action' using errcode = '22023'; end if;
  perform public.assert_actor_capability(p_actor_id, capability);
  if p_target = 'post' then
    update public.forum_posts set is_pinned = case when p_action = 'PIN' then true when p_action = 'UNPIN' then false else is_pinned end,
      is_locked = case when p_action = 'LOCK' then true when p_action = 'UNLOCK' then false else is_locked end,
      status = case when p_action = 'DELETE' then 'DELETED'::public.forum_content_status else status end,
      deleted_at = case when p_action = 'DELETE' then now() else deleted_at end, updated_at = now()
    where id = p_target_id and status = 'PUBLISHED';
  else
    update public.forum_comments set status = 'DELETED', deleted_at = now(), updated_at = now() where id = p_target_id and status = 'PUBLISHED';
  end if;
  if not found then raise exception 'forum target not found' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id, metadata)
  values (p_actor_id, lower(format('forum.%s.%s', p_target, p_action)), 'forum_' || p_target, p_target_id, jsonb_build_object('action', p_action));
end; $$;

create or replace function public.admin_set_user_role(p_actor_id uuid, p_user_id uuid, p_role public.user_role)
returns public.user_public_profiles language plpgsql security definer set search_path = '' as $$
declare target_profile public.user_public_profiles; before_role public.user_role; admin_count integer;
begin
  perform public.assert_actor_capability(p_actor_id, 'admin:manageUsers');
  if p_actor_id = p_user_id then raise exception 'administrators cannot change their own role' using errcode = '22023'; end if;
  select * into target_profile from public.user_public_profiles where user_id = p_user_id for update;
  if not found then raise exception 'public profile not found' using errcode = 'P0002'; end if;
  before_role := target_profile.role;
  if target_profile.role = 'ADMIN'::public.user_role and p_role <> 'ADMIN'::public.user_role then
    select count(*) into admin_count from public.user_public_profiles where role = 'ADMIN'::public.user_role;
    if admin_count <= 1 then raise exception 'the final administrator cannot be demoted' using errcode = '55000'; end if;
  end if;
  update public.user_public_profiles set role = p_role, updated_at = now() where user_id = p_user_id returning * into target_profile;
  insert into public.admin_audit_log (actor_id, action, target_user_id, resource_type, resource_id, before_state, after_state)
  values (p_actor_id, 'user.role.set', p_user_id, 'user_public_profiles', p_user_id, jsonb_build_object('role', before_role), jsonb_build_object('role', p_role));
  return target_profile;
end; $$;

create or replace function public.admin_set_user_permission(
  p_actor_id uuid,
  p_user_id uuid,
  p_capability text,
  p_active boolean,
  p_reason text default 'manual_admin'
)
returns public.user_granted_permissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_capability text := public.canonical_capability(p_capability);
  normalized_reason text := coalesce(nullif(trim(p_reason), ''), 'manual_admin');
  grant_record public.user_granted_permissions;
begin
  perform public.assert_actor_capability(p_actor_id, 'admin:manageUsers');

  if p_user_id is null or p_active is null then
    raise exception 'invalid permission change' using errcode = '22023';
  end if;
  if normalized_capability is null
    or normalized_capability !~ '^(forum|admin|tasks|shop|announce):[A-Za-z0-9_]+$'
    or char_length(normalized_reason) > 160 then
    raise exception 'invalid capability or reason' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_public_profiles where user_id = p_user_id) then
    raise exception 'public profile not found' using errcode = 'P0002';
  end if;

  if p_active then
    insert into public.user_granted_permissions (
      user_id, capability, granted_by_id, reason, granted_at,
      expires_at, revoked_at, revoked_by_id, updated_at
    ) values (
      p_user_id, normalized_capability, p_actor_id, normalized_reason, now(),
      null, null, null, now()
    )
    on conflict (user_id, capability) do update
      set granted_by_id = excluded.granted_by_id,
          reason = excluded.reason,
          granted_at = now(),
          expires_at = null,
          revoked_at = null,
          revoked_by_id = null,
          updated_at = now()
    returning * into grant_record;
  else
    select * into grant_record
    from public.user_granted_permissions
    where user_id = p_user_id
      and public.canonical_capability(capability) = normalized_capability
      and revoked_at is null
    order by granted_at desc
    limit 1
    for update;
    if not found then
      raise exception 'active permission grant not found' using errcode = 'P0002';
    end if;
    update public.user_granted_permissions
    set revoked_at = now(), revoked_by_id = p_actor_id, updated_at = now()
    where id = grant_record.id
    returning * into grant_record;
  end if;

  insert into public.permission_grant_audit (
    grant_id, user_id, capability, action, actor_id, metadata
  ) values (
    grant_record.id, p_user_id, normalized_capability,
    case when p_active then 'GRANT' else 'REVOKE' end,
    p_actor_id, jsonb_build_object('reason', normalized_reason)
  );
  insert into public.admin_audit_log (
    actor_id, action, target_user_id, resource_type, resource_id, after_state, metadata
  ) values (
    p_actor_id,
    case when p_active then 'user.permission.grant' else 'user.permission.revoke' end,
    p_user_id, 'user_granted_permissions', grant_record.id,
    jsonb_build_object('capability', normalized_capability, 'active', p_active),
    jsonb_build_object('reason', normalized_reason)
  );

  return grant_record;
end;
$$;

create or replace function public.admin_adjust_reputation(p_event_key text, p_actor_id uuid, p_user_id uuid, p_amount integer, p_reason text)
returns table (applied boolean, event_id uuid, reputation integer)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_actor_capability(p_actor_id, 'admin:manageUsers');
  if p_amount = 0 or p_amount is null or p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'invalid reputation adjustment' using errcode = '22023'; end if;
  insert into public.admin_audit_log (actor_id, action, target_user_id, resource_type, metadata) values (p_actor_id, 'user.reputation.adjust', p_user_id, 'reputation_events', jsonb_build_object('event_key', p_event_key, 'amount', p_amount, 'reason', trim(p_reason)));
  return query select * from public.apply_reputation_event(p_event_key, p_user_id, p_amount, trim(p_reason), 'admin_manual', p_user_id, p_actor_id);
end; $$;

create or replace function public.set_user_mute(p_user_id uuid, p_muted_until timestamptz, p_actor_id uuid)
returns public.user_moderation_state language plpgsql security definer set search_path = '' as $$
declare result public.user_moderation_state;
begin
  if p_actor_id is distinct from p_user_id then perform public.assert_actor_capability(p_actor_id, 'admin:manageUsers'); end if;
  insert into public.user_moderation_state (user_id, muted_until, updated_by_id) values (p_user_id, p_muted_until, p_actor_id)
  on conflict (user_id) do update set muted_until = excluded.muted_until, updated_by_id = excluded.updated_by_id, updated_at = now() returning * into result;
  if p_actor_id is distinct from p_user_id then
    insert into public.admin_audit_log (actor_id, action, target_user_id, resource_type, resource_id, after_state) values (p_actor_id, 'user.mute.set', p_user_id, 'user_moderation_state', p_user_id, jsonb_build_object('muted_until', p_muted_until));
  end if;
  return result;
end; $$;

drop function if exists public.redeem_code(uuid, text);
create function public.redeem_code(p_user_id uuid, p_code text)
returns table (reputation integer, reward_title text, reward_role public.user_role, reward_permission text, already_redeemed boolean)
language plpgsql security definer set search_path = '' as $$
declare code_record public.redeem_codes; usage_record public.redeem_code_usages; reputation_result record; grant_record public.user_granted_permissions;
begin
  select * into code_record from public.redeem_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'redeem code is unavailable' using errcode = 'P0002'; end if;
  select * into usage_record from public.redeem_code_usages where redeem_code_id = code_record.id and user_id = p_user_id for update;
  if found then
    select profile.reputation into reputation from public.user_public_profiles as profile where profile.user_id = p_user_id;
    return query select coalesce(reputation, 0), code_record.reward_title, code_record.reward_role, code_record.reward_permission, true;
    return;
  end if;
  if not code_record.is_active or code_record.current_uses >= code_record.max_uses or (code_record.expires_at is not null and code_record.expires_at <= now()) then raise exception 'redeem code is unavailable' using errcode = 'P0002'; end if;
  if code_record.reward_role = 'ADMIN'::public.user_role or code_record.reward_permission like 'admin:%' then raise exception 'redeem reward is not allowed' using errcode = '42501'; end if;
  insert into public.redeem_code_usages (redeem_code_id, user_id) values (code_record.id, p_user_id)
  on conflict (redeem_code_id, user_id) do nothing returning * into usage_record;
  if usage_record.id is null then
    select * into usage_record from public.redeem_code_usages where redeem_code_id = code_record.id and user_id = p_user_id for update;
    select profile.reputation into reputation from public.user_public_profiles as profile where profile.user_id = p_user_id;
    return query select coalesce(reputation, 0), code_record.reward_title, code_record.reward_role, code_record.reward_permission, true;
    return;
  end if;
  update public.redeem_codes set current_uses = current_uses + 1, updated_at = now() where id = code_record.id;
  select * into reputation_result from public.apply_reputation_event(format('redeem:%s:user:%s', code_record.id, p_user_id), p_user_id, code_record.reward_reputation, 'redeem_code', 'redeem_code', code_record.id, p_user_id);
  if code_record.reward_role is not null then
    update public.user_public_profiles set role = case when role = 'ADMIN'::public.user_role or (role = 'MODERATOR'::public.user_role and code_record.reward_role = 'USER'::public.user_role) then role else code_record.reward_role end, updated_at = now() where user_id = p_user_id;
    insert into public.admin_audit_log (actor_id, action, target_user_id, resource_type, resource_id, after_state, metadata)
    values (p_user_id, 'redeem_code.role_grant', p_user_id, 'user_public_profiles', p_user_id, jsonb_build_object('role', code_record.reward_role), jsonb_build_object('redeem_code_id', code_record.id));
  end if;
  if code_record.reward_permission is not null then
    insert into public.user_granted_permissions (user_id, capability, granted_by_id, source_redeem_code_id, reason)
    values (p_user_id, code_record.reward_permission, p_user_id, code_record.id, 'redeem_code')
    on conflict (user_id, capability) do update set revoked_at = null, revoked_by_id = null,
      expires_at = null, granted_by_id = excluded.granted_by_id,
      source_redeem_code_id = excluded.source_redeem_code_id, updated_at = now()
    returning * into grant_record;
    insert into public.permission_grant_audit (grant_id, user_id, capability, action, actor_id, source_redeem_code_id, metadata)
    values (grant_record.id, p_user_id, grant_record.capability, 'GRANT', p_user_id, code_record.id, jsonb_build_object('reason', 'redeem_code'));
  end if;
  update public.redeem_code_usages set reputation_event_id = reputation_result.event_id where id = usage_record.id;
  return query select reputation_result.reputation, code_record.reward_title, code_record.reward_role, code_record.reward_permission, false;
end; $$;

create or replace function public.transfer_global_account(p_actor_id uuid, p_from_user_id uuid, p_to_user_id uuid)
returns public.account_transfers language plpgsql security definer set search_path = '' as $$
declare transfer_id uuid := gen_random_uuid(); source_reputation integer; target_reputation integer; post_count integer := 0; comment_count integer := 0; task_count integer := 0; application_count integer := 0; review_count integer := 0; task_link_count integer := 0; result public.account_transfers;
begin
  perform public.assert_actor_capability(p_actor_id, 'admin:transferAccount');
  if p_from_user_id = p_to_user_id then raise exception 'source and destination users must differ' using errcode = '22023'; end if;
  perform 1 from public.user_public_profiles where user_id in (p_from_user_id, p_to_user_id) order by user_id for update;
  if (select count(*) from public.user_public_profiles where user_id in (p_from_user_id, p_to_user_id)) <> 2 then raise exception 'transfer user not found' using errcode = 'P0002'; end if;
  select reputation into source_reputation from public.user_public_profiles where user_id = p_from_user_id;
  select reputation into target_reputation from public.user_public_profiles where user_id = p_to_user_id;
  if exists (select 1 from public.task_applications source_applications join public.task_applications target_applications on target_applications.task_id = source_applications.task_id and target_applications.applicant_id = p_to_user_id where source_applications.applicant_id = p_from_user_id) then raise exception 'account transfer conflicts with an existing task application' using errcode = '23505'; end if;
  if exists (select 1 from public.task_reviews source_reviews where source_reviews.reviewer_id = p_from_user_id and exists (select 1 from public.task_reviews target_reviews where target_reviews.application_id = source_reviews.application_id and target_reviews.reviewer_id = p_to_user_id)) then raise exception 'account transfer conflicts with an existing task review' using errcode = '23505'; end if;
  update public.task_listings set creator_id = p_to_user_id, updated_at = now() where creator_id = p_from_user_id; get diagnostics task_count = row_count;
  update public.task_post_links set created_by = p_to_user_id where created_by = p_from_user_id; get diagnostics task_link_count = row_count;
  update public.task_applications set applicant_id = p_to_user_id, updated_at = now() where applicant_id = p_from_user_id; get diagnostics application_count = row_count;
  delete from public.task_conversation_members source using public.task_conversation_members target
    where source.user_id = p_from_user_id and target.user_id = p_to_user_id
      and target.conversation_id = source.conversation_id;
  update public.task_conversation_members set user_id = p_to_user_id where user_id = p_from_user_id;
  update public.task_conversation_messages set sender_id = p_to_user_id where sender_id = p_from_user_id;
  delete from public.task_member_assignments source using public.task_member_assignments target
    where source.member_id = p_from_user_id and target.member_id = p_to_user_id and target.task_id = source.task_id;
  update public.task_member_assignments set member_id = p_to_user_id where member_id = p_from_user_id;
  update public.task_member_assignments set assigned_by_id = p_to_user_id where assigned_by_id = p_from_user_id;
  delete from public.task_peer_reviews source using public.task_peer_reviews target
    where source.task_id = target.task_id and source.reviewer_id = p_from_user_id and target.reviewer_id = p_to_user_id
      and source.reviewee_id = target.reviewee_id;
  update public.task_peer_reviews set reviewer_id = p_to_user_id where reviewer_id = p_from_user_id;
  update public.task_peer_reviews set reviewee_id = p_to_user_id where reviewee_id = p_from_user_id;
  update public.task_reviews set reviewer_id = case when reviewer_id = p_from_user_id then p_to_user_id else reviewer_id end, reviewee_id = case when reviewee_id = p_from_user_id then p_to_user_id else reviewee_id end, updated_at = now() where reviewer_id = p_from_user_id or reviewee_id = p_from_user_id; get diagnostics review_count = row_count;
  update public.forum_posts set author_id = p_to_user_id, updated_at = now() where author_id = p_from_user_id; get diagnostics post_count = row_count;
  update public.forum_comments set author_id = p_to_user_id, updated_at = now() where author_id = p_from_user_id; get diagnostics comment_count = row_count;
  if source_reputation > 0 then perform * from public.apply_reputation_event(format('account-transfer:%s:source', transfer_id), p_from_user_id, -source_reputation, 'account_transfer_out', 'account_transfer', transfer_id, p_actor_id); perform * from public.apply_reputation_event(format('account-transfer:%s:destination', transfer_id), p_to_user_id, source_reputation, 'account_transfer_in', 'account_transfer', transfer_id, p_actor_id); end if;
  insert into public.account_transfers (id, from_user_id, to_user_id, reputation_transferred, operated_by_id, result_summary) values (transfer_id, p_from_user_id, p_to_user_id, source_reputation, p_actor_id, jsonb_build_object('forum_posts', post_count, 'forum_comments', comment_count, 'task_listings', task_count, 'task_post_links', task_link_count, 'task_applications', application_count, 'task_reviews', review_count, 'destination_reputation_before', target_reputation)) returning * into result;
  insert into public.admin_audit_log (actor_id, action, target_user_id, resource_type, resource_id, before_state, after_state, metadata) values (p_actor_id, 'account.transfer', p_to_user_id, 'account_transfers', transfer_id, jsonb_build_object('source_reputation', source_reputation, 'destination_reputation', target_reputation), result.result_summary, jsonb_build_object('from_user_id', p_from_user_id));
  return result;
end; $$;

revoke all on function public.redeem_code(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_code(uuid, text) to service_role;
revoke all on function public.admin_set_user_permission(uuid, uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_set_user_permission(uuid, uuid, text, boolean, text) to service_role;
revoke all on function public.transfer_global_account(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_global_account(uuid, uuid, uuid) to service_role;

-- v1.1 reviewed avatar storage contract.
-- Browser roles may read approved avatars, but all writes remain service-role only.
alter table public.user_public_profiles
  add column if not exists avatar text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
);

-- Intentionally no avatars INSERT, UPDATE or DELETE policy for browser roles.
-- The authenticated avatar-upload Edge Function performs reviewed writes with service role.

-- Collaborative task market extension. The base task and template tables are
-- created by earlier canonical migrations.

alter table public.task_templates
  add column if not exists version integer not null default 1,
  add column if not exists task_mode text not null default 'individual';

alter table public.task_listings
  add column if not exists template_id uuid references public.task_templates(id) on delete set null,
  add column if not exists template_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists task_mode text not null default 'individual';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_templates_version_range'
      and conrelid = 'public.task_templates'::regclass
  ) then
    alter table public.task_templates add constraint task_templates_version_range check (version > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_templates_mode_value'
      and conrelid = 'public.task_templates'::regclass
  ) then
    alter table public.task_templates add constraint task_templates_mode_value
      check (task_mode in ('individual', 'collaboration'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_listings_template_snapshot_object'
      and conrelid = 'public.task_listings'::regclass
  ) then
    alter table public.task_listings add constraint task_listings_template_snapshot_object
      check (jsonb_typeof(template_snapshot) = 'object');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_listings_mode_value'
      and conrelid = 'public.task_listings'::regclass
  ) then
    alter table public.task_listings add constraint task_listings_mode_value
      check (task_mode in ('individual', 'collaboration'));
  end if;
end;
$$;

create index if not exists task_listings_template_idx
  on public.task_listings (template_id) where template_id is not null;

create table if not exists public.task_publishing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  minimum_reputation integer not null default 0,
  minimum_completed_tasks integer not null default 0,
  is_active boolean not null default true,
  created_by_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_publishing_rules_key_format check (rule_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  constraint task_publishing_rules_reputation_range check (minimum_reputation between 0 and 1000000),
  constraint task_publishing_rules_completed_range check (minimum_completed_tasks between 0 and 100000)
);

create table if not exists public.task_publishing_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  is_eligible boolean not null,
  reason text not null,
  expires_at timestamptz,
  created_by_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_publishing_overrides_reason_length check (char_length(reason) between 1 and 800)
);

create table if not exists public.task_conversations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_listings(id) on delete cascade,
  kind text not null check (kind in ('application_consultation', 'collaboration')),
  application_id uuid references public.task_applications(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'read_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (task_id, kind, application_id),
  constraint task_conversations_application_kind check (
    (kind = 'application_consultation' and application_id is not null)
    or (kind = 'collaboration' and application_id is null)
  )
);

create table if not exists public.task_conversation_members (
  conversation_id uuid not null references public.task_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('creator', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.task_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.task_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint task_conversation_messages_content_length check (char_length(trim(content)) between 1 and 4000)
);

create table if not exists public.task_member_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_listings(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  assigned_by_id uuid not null references auth.users(id) on delete restrict,
  responsibility text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, member_id),
  constraint task_member_assignments_responsibility_length check (char_length(trim(responsibility)) between 1 and 800)
);

create table if not exists public.task_peer_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_listings(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  communication smallint not null default 1 check (communication between 1 and 5),
  contribution smallint not null default 1 check (contribution between 1 and 5),
  punctuality smallint not null default 1 check (punctuality between 1 and 5),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, reviewer_id, reviewee_id),
  constraint task_peer_reviews_distinct_members check (reviewer_id <> reviewee_id),
  constraint task_peer_reviews_content_length check (char_length(trim(content)) between 1 and 1200)
);

create index if not exists task_publishing_rules_active_idx
  on public.task_publishing_rules (is_active, updated_at desc);
create index if not exists task_publishing_overrides_expiry_idx
  on public.task_publishing_overrides (expires_at) where expires_at is not null;
create index if not exists task_conversations_task_idx
  on public.task_conversations (task_id, kind, created_at);
create index if not exists task_conversations_application_idx
  on public.task_conversations (application_id) where application_id is not null;
create index if not exists task_conversation_members_user_idx
  on public.task_conversation_members (user_id, conversation_id);
create index if not exists task_conversation_messages_conversation_idx
  on public.task_conversation_messages (conversation_id, created_at);
create index if not exists task_conversation_messages_sender_idx
  on public.task_conversation_messages (sender_id, created_at desc);
create index if not exists task_member_assignments_member_idx
  on public.task_member_assignments (member_id, updated_at desc);
create index if not exists task_peer_reviews_reviewee_idx
  on public.task_peer_reviews (reviewee_id, created_at desc);
create index if not exists task_peer_reviews_reviewer_idx
  on public.task_peer_reviews (reviewer_id, created_at desc);

alter table public.task_publishing_rules enable row level security;
alter table public.task_publishing_overrides enable row level security;
alter table public.task_conversations enable row level security;
alter table public.task_conversation_members enable row level security;
alter table public.task_conversation_messages enable row level security;
alter table public.task_member_assignments enable row level security;
alter table public.task_peer_reviews enable row level security;
alter table public.task_peer_reviews add column if not exists communication smallint not null default 1;
alter table public.task_peer_reviews add column if not exists contribution smallint not null default 1;
alter table public.task_peer_reviews add column if not exists punctuality smallint not null default 1;

revoke all on public.task_publishing_rules from anon, authenticated;
revoke all on public.task_publishing_overrides from anon, authenticated;
revoke all on public.task_conversations from anon, authenticated;
revoke all on public.task_conversation_members from anon, authenticated;
revoke all on public.task_conversation_messages from anon, authenticated;
revoke all on public.task_member_assignments from anon, authenticated;
revoke all on public.task_peer_reviews from anon, authenticated;

grant select on public.task_conversations to authenticated;
grant select on public.task_conversation_members to authenticated;
grant select on public.task_conversation_messages to authenticated;
grant select on public.task_member_assignments to authenticated;
grant select on public.task_peer_reviews to authenticated;

drop policy if exists task_conversations_read_participant on public.task_conversations;
create policy task_conversations_read_participant on public.task_conversations
  for select to authenticated using (
    exists (
      select 1 from public.task_listings as t
      where t.id = task_conversations.task_id
        and (
          t.creator_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
          or (task_conversations.kind = 'application_consultation' and exists (
            select 1 from public.task_applications as a
            where a.id = task_conversations.application_id and a.applicant_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
          ))
          or (task_conversations.kind = 'collaboration' and exists (
            select 1 from public.task_applications as a
            where a.task_id = task_conversations.task_id and a.applicant_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
              and a.status in ('accepted', 'submitted', 'completed')
              and a.arbitration_status not in ('force_completed', 'cancelled', 'refunded')
          ))
        )
    )
  );

drop policy if exists task_conversation_members_read_participant on public.task_conversation_members;
create policy task_conversation_members_read_participant on public.task_conversation_members
  for select to authenticated using (
    exists (
      select 1 from public.task_conversations as c
      join public.task_listings as t on t.id = c.task_id
      where c.id = task_conversation_members.conversation_id
        and (
          t.creator_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
          or (c.kind = 'application_consultation' and exists (
            select 1 from public.task_applications as a
            where a.id = c.application_id and a.applicant_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
          ))
          or (c.kind = 'collaboration' and exists (
            select 1 from public.task_applications as a
            where a.task_id = c.task_id and a.applicant_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
              and a.status in ('accepted', 'submitted', 'completed')
              and a.arbitration_status not in ('force_completed', 'cancelled', 'refunded')
          ))
        )
    )
  );

drop policy if exists task_conversation_messages_read_participant on public.task_conversation_messages;
create policy task_conversation_messages_read_participant on public.task_conversation_messages
  for select to authenticated using (
    exists (
      select 1 from public.task_conversations as c
      join public.task_conversation_members as m on m.conversation_id = c.id
      where c.id = task_conversation_messages.conversation_id and m.user_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
    )
  );

drop policy if exists task_member_assignments_read_participant on public.task_member_assignments;
create policy task_member_assignments_read_participant on public.task_member_assignments
  for select to authenticated using (
    member_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
    or exists (select 1 from public.task_listings as t
      where t.id = task_member_assignments.task_id and t.creator_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid))
    or exists (select 1 from public.task_applications as a
      where a.task_id = task_member_assignments.task_id and a.applicant_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
        and a.status in ('accepted', 'submitted', 'completed')
        and a.arbitration_status not in ('force_completed', 'cancelled', 'refunded'))
  );

drop policy if exists task_peer_reviews_read_participant on public.task_peer_reviews;
create policy task_peer_reviews_read_participant on public.task_peer_reviews
  for select to authenticated using (
    reviewer_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
    or reviewee_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
    or exists (select 1 from public.task_listings as t
      where t.id = task_peer_reviews.task_id and t.creator_id = (select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid))
  );

create or replace function public.get_task_template_snapshot(p_actor_id uuid, p_template_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
begin
  if p_template_id is null then return '{}'::jsonb; end if;
  select jsonb_build_object(
    'id', t.id, 'version', t.version, 'title', t.title, 'summary', t.summary,
    'body', t.body, 'skillTags', t.skill_tags, 'categoryId', t.category_id,
    'subcategoryId', t.subcategory_id, 'defaultRewardPoints', t.default_reward_points,
    'defaultApplicationLimit', t.default_application_limit,
    'defaultDurationDays', t.default_duration_days, 'taskMode', t.task_mode
  ) into v_snapshot
  from public.task_templates as t
  where t.id = p_template_id and (t.owner_id = p_actor_id or t.is_public);
  if v_snapshot is null then
    raise exception using errcode = '42501', message = 'Task template is not available to actor.';
  end if;
  return v_snapshot;
end;
$$;

create or replace function public.create_task(p_actor_id uuid, p_filtered_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_deadline timestamptz;
  v_template_id uuid := nullif(p_filtered_payload ->> 'templateId', '')::uuid;
  v_task_mode text := coalesce(nullif(p_filtered_payload ->> 'taskMode', ''), 'individual');
begin
  if p_actor_id is null then
    raise exception using errcode = 'P0001', message = 'Trusted actor is required.';
  end if;
  if coalesce(char_length(trim(p_filtered_payload ->> 'title')), 0) = 0
    or coalesce(char_length(trim(p_filtered_payload ->> 'summary')), 0) = 0
    or coalesce(char_length(trim(p_filtered_payload ->> 'body')), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Task title, summary, and body are required.';
  end if;
  v_deadline := nullif(p_filtered_payload ->> 'deadlineAt', '')::timestamptz;
  if v_deadline is null then
    raise exception using errcode = 'P0001', message = 'Task deadline is required.';
  end if;
  perform public.validate_task_taxonomy(
    (p_filtered_payload ->> 'categoryId')::uuid,
    nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid
  );
  insert into public.task_listings (
    creator_id, category_id, subcategory_id, title, summary, body, skill_tags,
    reward_points, application_limit, deadline_at, status,
    template_id, template_snapshot, task_mode
  ) values (
    p_actor_id, (p_filtered_payload ->> 'categoryId')::uuid,
    nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid,
    trim(p_filtered_payload ->> 'title'), trim(p_filtered_payload ->> 'summary'),
    trim(p_filtered_payload ->> 'body'), coalesce(p_filtered_payload -> 'skillTags', '[]'::jsonb),
    (p_filtered_payload ->> 'rewardPoints')::integer,
    (p_filtered_payload ->> 'applicationLimit')::integer, v_deadline, 'draft',
    v_template_id, public.get_task_template_snapshot(p_actor_id, v_template_id), v_task_mode
  ) returning id into v_task_id;
  return v_task_id;
end;
$$;

create or replace function public.update_task(p_actor_id uuid, p_task_id uuid, p_filtered_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_listings;
  v_template_id uuid;
  v_template_snapshot jsonb;
  v_task_mode text;
begin
  select * into v_task from public.task_listings where id = p_task_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'Task not found.'; end if;
  if v_task.creator_id <> p_actor_id and not exists (
    select 1 from public.user_public_profiles where user_id = p_actor_id and role = 'ADMIN'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'Only the task creator may edit this task.';
  end if;
  if v_task.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'Archived tasks cannot be edited.';
  end if;
  perform public.validate_task_taxonomy(
    (p_filtered_payload ->> 'categoryId')::uuid,
    nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid
  );
  v_template_id := case when p_filtered_payload ? 'templateId'
    then nullif(p_filtered_payload ->> 'templateId', '')::uuid else v_task.template_id end;
  v_task_mode := coalesce(nullif(p_filtered_payload ->> 'taskMode', ''), v_task.task_mode);
  v_template_snapshot := case when v_task.published_at is null
    then public.get_task_template_snapshot(p_actor_id, v_template_id) else v_task.template_snapshot end;
  update public.task_listings
  set category_id = (p_filtered_payload ->> 'categoryId')::uuid,
      subcategory_id = nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid,
      title = trim(p_filtered_payload ->> 'title'), summary = trim(p_filtered_payload ->> 'summary'),
      body = trim(p_filtered_payload ->> 'body'), skill_tags = coalesce(p_filtered_payload -> 'skillTags', '[]'::jsonb),
      reward_points = (p_filtered_payload ->> 'rewardPoints')::integer,
      application_limit = (p_filtered_payload ->> 'applicationLimit')::integer,
      deadline_at = (p_filtered_payload ->> 'deadlineAt')::timestamptz,
      template_id = v_template_id, template_snapshot = v_template_snapshot,
      task_mode = v_task_mode, updated_at = now()
  where id = v_task.id;
  return v_task.id;
end;
$$;

create or replace function public.publish_task(p_actor_id uuid, p_task_id uuid, p_filtered_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_listings;
  v_template_id uuid;
begin
  select * into v_task from public.task_listings where id = p_task_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'Task not found.'; end if;
  if v_task.creator_id <> p_actor_id and not exists (
    select 1 from public.user_public_profiles where user_id = p_actor_id and role = 'ADMIN'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'Only the task creator may publish this task.';
  end if;
  if v_task.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'Only draft tasks can be published.';
  end if;
  if (p_filtered_payload ->> 'deadlineAt')::timestamptz <= now() then
    raise exception using errcode = 'P0001', message = 'Task deadline must be in the future.';
  end if;
  perform public.validate_task_taxonomy(
    (p_filtered_payload ->> 'categoryId')::uuid,
    nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid
  );
  if not exists (select 1 from public.user_public_profiles where user_id = p_actor_id and role = 'ADMIN'::public.user_role)
    and coalesce((public.get_task_publishing_eligibility(p_actor_id) ->> 'eligible')::boolean, false) is not true then
    raise exception using errcode = '42501', message = 'Actor is not eligible to publish tasks.';
  end if;
  v_template_id := case when p_filtered_payload ? 'templateId'
    then nullif(p_filtered_payload ->> 'templateId', '')::uuid else v_task.template_id end;
  update public.task_listings
  set category_id = (p_filtered_payload ->> 'categoryId')::uuid,
      subcategory_id = nullif(p_filtered_payload ->> 'subcategoryId', '')::uuid,
      title = trim(p_filtered_payload ->> 'title'), summary = trim(p_filtered_payload ->> 'summary'),
      body = trim(p_filtered_payload ->> 'body'), skill_tags = coalesce(p_filtered_payload -> 'skillTags', '[]'::jsonb),
      reward_points = (p_filtered_payload ->> 'rewardPoints')::integer,
      application_limit = (p_filtered_payload ->> 'applicationLimit')::integer,
      deadline_at = (p_filtered_payload ->> 'deadlineAt')::timestamptz,
      template_id = v_template_id,
      template_snapshot = public.get_task_template_snapshot(p_actor_id, v_template_id),
      task_mode = coalesce(nullif(p_filtered_payload ->> 'taskMode', ''), v_task.task_mode),
      status = 'published', published_at = now(), updated_at = now()
  where id = v_task.id;
  return v_task.id;
end;
$$;

create or replace function public.keep_published_task_template_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.published_at is not null and (
    old.template_id is distinct from new.template_id
    or old.template_snapshot is distinct from new.template_snapshot
    or old.task_mode is distinct from new.task_mode
  ) then
    raise exception using errcode = '55000', message = 'Published task template data is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists task_listings_keep_template_snapshot on public.task_listings;
create trigger task_listings_keep_template_snapshot
before update on public.task_listings
for each row execute function public.keep_published_task_template_snapshot();

create or replace function public.get_task_publishing_eligibility(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reputation integer;
  v_completed integer;
  v_minimum_reputation integer;
  v_minimum_completed integer;
  v_override public.task_publishing_overrides;
  v_eligible boolean;
begin
  if p_actor_id is null then raise exception using errcode = '22023', message = 'Trusted actor is required.'; end if;
  select reputation into v_reputation from public.user_public_profiles where user_id = p_actor_id;
  if not found then raise exception using errcode = 'P0002', message = 'Task actor profile not found.'; end if;
  select count(*) into v_completed from public.task_applications
    where applicant_id = p_actor_id and status = 'completed';
  select coalesce(max(minimum_reputation), 0), coalesce(max(minimum_completed_tasks), 0)
    into v_minimum_reputation, v_minimum_completed
    from public.task_publishing_rules where is_active;
  select * into v_override from public.task_publishing_overrides
    where user_id = p_actor_id and (expires_at is null or expires_at > now());
  v_eligible := case when found then v_override.is_eligible
    else v_reputation >= v_minimum_reputation and v_completed >= v_minimum_completed end;
  return jsonb_build_object(
    'eligible', v_eligible, 'reputation', v_reputation, 'completedTasks', v_completed,
    'minimumReputation', v_minimum_reputation, 'minimumCompletedTasks', v_minimum_completed,
    'override', case when v_override.id is null then null else jsonb_build_object(
      'id', v_override.id, 'isEligible', v_override.is_eligible,
      'reason', v_override.reason, 'expiresAt', v_override.expires_at) end
  );
end;
$$;

create or replace function public.save_task_template(p_actor_id uuid, p_template_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_is_public boolean := coalesce((p_payload ->> 'isPublic')::boolean, false);
begin
  if p_actor_id is null or coalesce(char_length(trim(p_payload ->> 'title')), 0) = 0 then
    raise exception using errcode = '22023', message = 'Template title is required.';
  end if;
  if v_is_public and not exists (
    select 1 from public.user_public_profiles where user_id = p_actor_id and role = 'ADMIN'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'Only an administrator may publish a shared template.';
  end if;
  perform public.validate_task_taxonomy(
    (p_payload ->> 'categoryId')::uuid, nullif(p_payload ->> 'subcategoryId', '')::uuid
  );
  insert into public.task_templates (
    id, owner_id, title, summary, body, skill_tags, category_id, subcategory_id,
    default_reward_points, default_application_limit, default_duration_days,
    is_public, task_mode
  ) values (
    coalesce(p_template_id, gen_random_uuid()), p_actor_id, trim(p_payload ->> 'title'),
    trim(p_payload ->> 'summary'), trim(p_payload ->> 'body'),
    coalesce(p_payload -> 'skillTags', '[]'::jsonb), (p_payload ->> 'categoryId')::uuid,
    nullif(p_payload ->> 'subcategoryId', '')::uuid,
    coalesce((p_payload ->> 'defaultRewardPoints')::integer, 0),
    coalesce((p_payload ->> 'defaultApplicationLimit')::integer, 1),
    coalesce((p_payload ->> 'defaultDurationDays')::integer, 7), v_is_public,
    coalesce(nullif(p_payload ->> 'taskMode', ''), 'individual')
  )
  on conflict (id) do update set
    title = excluded.title, summary = excluded.summary, body = excluded.body,
    skill_tags = excluded.skill_tags, category_id = excluded.category_id,
    subcategory_id = excluded.subcategory_id,
    default_reward_points = excluded.default_reward_points,
    default_application_limit = excluded.default_application_limit,
    default_duration_days = excluded.default_duration_days,
    is_public = excluded.is_public, task_mode = excluded.task_mode,
    version = public.task_templates.version + 1, updated_at = now()
  where public.task_templates.owner_id = p_actor_id
  returning id into v_id;
  if v_id is null then raise exception using errcode = '42501', message = 'Template is not owned by actor.'; end if;
  return v_id;
end;
$$;

create or replace function public.save_task_publishing_rule(p_actor_id uuid, p_rule_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform public.assert_task_admin(p_actor_id);
  insert into public.task_publishing_rules (
    id, rule_key, minimum_reputation, minimum_completed_tasks, is_active, created_by_id
  ) values (
    coalesce(p_rule_id, gen_random_uuid()), trim(p_payload ->> 'ruleKey'),
    coalesce((p_payload ->> 'minimumReputation')::integer, 0),
    coalesce((p_payload ->> 'minimumCompletedTasks')::integer, 0),
    coalesce((p_payload ->> 'isActive')::boolean, true), p_actor_id
  ) on conflict (id) do update set
    rule_key = excluded.rule_key, minimum_reputation = excluded.minimum_reputation,
    minimum_completed_tasks = excluded.minimum_completed_tasks,
    is_active = excluded.is_active, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.save_task_publishing_override(
  p_actor_id uuid, p_override_id uuid, p_user_id uuid, p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform public.assert_task_admin(p_actor_id);
  if p_user_id is null or coalesce(char_length(trim(p_payload ->> 'reason')), 0) = 0 then
    raise exception using errcode = '22023', message = 'Override user and reason are required.';
  end if;
  insert into public.task_publishing_overrides (
    id, user_id, is_eligible, reason, expires_at, created_by_id
  ) values (
    coalesce(p_override_id, gen_random_uuid()), p_user_id,
    coalesce((p_payload ->> 'isEligible')::boolean, false), trim(p_payload ->> 'reason'),
    nullif(p_payload ->> 'expiresAt', '')::timestamptz, p_actor_id
  ) on conflict (user_id) do update set
    is_eligible = excluded.is_eligible, reason = excluded.reason,
    expires_at = excluded.expires_at, created_by_id = excluded.created_by_id, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.sync_task_application_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
  v_conversation_id uuid;
begin
  select creator_id into v_creator_id from public.task_listings where id = new.task_id;
  if tg_op = 'INSERT' then
    insert into public.task_conversations (task_id, kind, application_id)
    values (new.task_id, 'application_consultation', new.id)
    on conflict (task_id, kind, application_id) do update set updated_at = now()
    returning id into v_conversation_id;
    insert into public.task_conversation_members (conversation_id, user_id, member_role)
    values (v_conversation_id, v_creator_id, 'creator'), (v_conversation_id, new.applicant_id, 'member')
    on conflict (conversation_id, user_id) do nothing;
  end if;
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.task_conversations (task_id, kind, application_id)
    values (new.task_id, 'collaboration', null)
    on conflict (task_id, kind, application_id) do update set updated_at = now()
    returning id into v_conversation_id;
    insert into public.task_conversation_members (conversation_id, user_id, member_role)
    values (v_conversation_id, v_creator_id, 'creator'), (v_conversation_id, new.applicant_id, 'member')
    on conflict (conversation_id, user_id) do nothing;
  end if;
  if new.status in ('rejected', 'cancelled')
    or new.arbitration_status in ('force_completed', 'cancelled', 'refunded') then
    update public.task_conversations set status = 'read_only', updated_at = now()
    where application_id = new.id and kind = 'application_consultation';
    delete from public.task_conversation_members as m
    using public.task_conversations as c
    where m.conversation_id = c.id and c.task_id = new.task_id
      and c.kind = 'collaboration' and m.user_id = new.applicant_id;
  end if;
  return new;
end;
$$;

create or replace function public.sync_task_listing_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('closed', 'archived')
    or new.arbitration_status in ('force_completed', 'cancelled', 'refunded') then
    update public.task_conversations set status = 'read_only', updated_at = now()
    where task_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

insert into public.task_conversations (task_id, kind, application_id, status)
select a.task_id, 'application_consultation', a.id,
  case
    when a.status in ('rejected', 'cancelled')
      or a.arbitration_status in ('force_completed', 'cancelled', 'refunded')
      or t.status in ('closed', 'archived')
      or t.arbitration_status in ('force_completed', 'cancelled', 'refunded')
    then 'read_only' else 'active'
  end
from public.task_applications as a
join public.task_listings as t on t.id = a.task_id
on conflict (task_id, kind, application_id) do nothing;

insert into public.task_conversations (task_id, kind, application_id, status)
select distinct a.task_id, 'collaboration', null::uuid,
  case
    when t.status in ('closed', 'archived')
      or t.arbitration_status in ('force_completed', 'cancelled', 'refunded')
    then 'read_only' else 'active'
  end
from public.task_applications as a
join public.task_listings as t on t.id = a.task_id
where a.status in ('accepted', 'submitted', 'completed')
  and a.arbitration_status not in ('force_completed', 'cancelled', 'refunded')
on conflict (task_id, kind, application_id) do nothing;

insert into public.task_conversation_members (conversation_id, user_id, member_role)
select c.id, members.user_id, members.member_role
from public.task_conversations as c
join public.task_applications as a on a.id = c.application_id
join public.task_listings as t on t.id = c.task_id
cross join lateral (values (t.creator_id, 'creator'), (a.applicant_id, 'member'))
  as members(user_id, member_role)
where c.kind = 'application_consultation'
on conflict (conversation_id, user_id) do nothing;

insert into public.task_conversation_members (conversation_id, user_id, member_role)
select c.id, t.creator_id, 'creator'
from public.task_conversations as c
join public.task_listings as t on t.id = c.task_id
where c.kind = 'collaboration'
on conflict (conversation_id, user_id) do nothing;

insert into public.task_conversation_members (conversation_id, user_id, member_role)
select c.id, a.applicant_id, 'member'
from public.task_conversations as c
join public.task_applications as a on a.task_id = c.task_id
where c.kind = 'collaboration'
  and a.status in ('accepted', 'submitted', 'completed')
  and a.arbitration_status not in ('force_completed', 'cancelled', 'refunded')
on conflict (conversation_id, user_id) do nothing;

drop trigger if exists task_applications_sync_conversations on public.task_applications;
create trigger task_applications_sync_conversations
after insert or update of status, arbitration_status on public.task_applications
for each row execute function public.sync_task_application_conversations();

drop trigger if exists task_listings_sync_conversations on public.task_listings;
create trigger task_listings_sync_conversations
after update of status, arbitration_status on public.task_listings
for each row execute function public.sync_task_listing_conversations();

create or replace function public.get_task_collaboration(p_actor_id uuid, p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_is_admin boolean;
  v_is_creator boolean;
  v_can_view_shared boolean;
begin
  select exists (select 1 from public.task_listings as t
    where t.id = p_task_id and t.creator_id = p_actor_id) into v_is_creator;
  select v_is_admin or v_is_creator or exists (
    select 1 from public.task_applications as a
    where a.task_id = p_task_id and a.applicant_id = p_actor_id
      and a.status in ('accepted', 'submitted', 'completed')
      and a.arbitration_status not in ('force_completed', 'cancelled', 'refunded')
  ) into v_can_view_shared;
  if not exists (
    select 1 from public.task_conversations as c
    left join public.task_conversation_members as m on m.conversation_id = c.id and m.user_id = p_actor_id
    where c.task_id = p_task_id and (
      m.user_id is not null
    )
  ) then
    raise exception using errcode = '42501', message = 'Task collaboration is not available to actor.';
  end if;
  select jsonb_build_object(
    'taskId', p_task_id,
    'conversations', coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'applicationId', c.application_id, 'status', c.status,
      'members', (select coalesce(jsonb_agg(to_jsonb(m) order by m.joined_at), '[]'::jsonb)
        from public.task_conversation_members as m where m.conversation_id = c.id),
      'messages', (select coalesce(jsonb_agg(to_jsonb(msg) order by msg.created_at), '[]'::jsonb)
        from public.task_conversation_messages as msg where msg.conversation_id = c.id)
    ) order by c.created_at), '[]'::jsonb),
    'assignments', case when v_can_view_shared then
      (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
        from public.task_member_assignments as a where a.task_id = p_task_id)
      else '[]'::jsonb end,
    'applications', case when v_can_view_shared then
      (select coalesce(jsonb_agg(jsonb_build_object(
        'applicationId', a.id, 'memberId', a.applicant_id, 'status', a.status
      ) order by a.created_at), '[]'::jsonb)
        from public.task_applications as a where a.task_id = p_task_id
          and a.status in ('accepted', 'submitted', 'completed')
          and a.arbitration_status not in ('force_completed', 'cancelled', 'refunded'))
      else '[]'::jsonb end,
    'peerReviews', case when v_can_view_shared then
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
        from public.task_peer_reviews as r
        where r.task_id = p_task_id and (
          v_is_admin or v_is_creator or p_actor_id in (r.reviewer_id, r.reviewee_id)
        ))
      else '[]'::jsonb end
  ) into v_result
  from public.task_conversations as c
  where c.task_id = p_task_id
    and (c.kind = 'application_consultation' or v_can_view_shared)
    and (exists (select 1 from public.task_conversation_members as m
      where m.conversation_id = c.id and m.user_id = p_actor_id));
  return v_result;
end;
$$;

create or replace function public.send_task_conversation_message(
  p_actor_id uuid, p_conversation_id uuid, p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_message_id uuid;
begin
  if coalesce(char_length(trim(p_content)), 0) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'Conversation message is required.';
  end if;
  if not exists (
    select 1 from public.task_conversations as c
    where c.id = p_conversation_id and c.status = 'active' and (
      exists (select 1 from public.user_public_profiles as p
        where p.user_id = p_actor_id and p.role = 'ADMIN'::public.user_role)
      or (
        exists (select 1 from public.task_conversation_members as m
          where m.conversation_id = c.id and m.user_id = p_actor_id)
        and (
          c.kind = 'application_consultation'
          or exists (select 1 from public.task_listings as t
            where t.id = c.task_id and t.creator_id = p_actor_id)
          or exists (select 1 from public.task_applications as a
            where a.task_id = c.task_id and a.applicant_id = p_actor_id
              and a.status in ('accepted', 'submitted', 'completed')
              and a.arbitration_status not in ('force_completed', 'cancelled', 'refunded'))
        )
      )
    )
  ) then
    raise exception using errcode = '42501', message = 'Active task conversation is not available to actor.';
  end if;
  insert into public.task_conversation_messages (conversation_id, sender_id, content)
  values (p_conversation_id, p_actor_id, trim(p_content))
  returning id into v_message_id;
  return v_message_id;
end;
$$;

create or replace function public.assign_task_member(
  p_actor_id uuid, p_task_id uuid, p_member_id uuid, p_filtered_responsibility text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
  v_conversation_id uuid;
begin
  if coalesce(char_length(trim(p_filtered_responsibility)), 0) not between 1 and 800 then
    raise exception using errcode = '22023', message = 'Member responsibility is required.';
  end if;
  if not exists (select 1 from public.task_listings as t where t.id = p_task_id and (
    t.creator_id = p_actor_id or exists (select 1 from public.user_public_profiles as p
      where p.user_id = p_actor_id and p.role = 'ADMIN'::public.user_role)
  )) then
    raise exception using errcode = '42501', message = 'Only the task creator may assign members.';
  end if;
  if not exists (select 1 from public.task_applications
    where task_id = p_task_id and applicant_id = p_member_id
      and status in ('accepted', 'submitted', 'completed')
      and arbitration_status not in ('force_completed', 'cancelled', 'refunded')) then
    raise exception using errcode = '22023', message = 'Accepted task member not found.';
  end if;
  insert into public.task_member_assignments (task_id, member_id, assigned_by_id, responsibility)
  values (p_task_id, p_member_id, p_actor_id, trim(p_filtered_responsibility))
  on conflict (task_id, member_id) do update set
    assigned_by_id = excluded.assigned_by_id, responsibility = excluded.responsibility,
    status = 'active', updated_at = now()
  returning id into v_assignment_id;
  select id into v_conversation_id from public.task_conversations
    where task_id = p_task_id and kind = 'collaboration' and application_id is null;
  if v_conversation_id is not null then
    insert into public.task_conversation_members (conversation_id, user_id, member_role)
    values (v_conversation_id, p_member_id, 'member')
    on conflict (conversation_id, user_id) do nothing;
  end if;
  return v_assignment_id;
end;
$$;

create or replace function public.submit_task_peer_review(
  p_actor_id uuid, p_task_id uuid, p_reviewee_id uuid, p_communication smallint,
  p_contribution smallint, p_punctuality smallint, p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_review_id uuid;
begin
  if p_actor_id = p_reviewee_id or p_communication not between 1 and 5
    or p_contribution not between 1 and 5 or p_punctuality not between 1 and 5
    or coalesce(char_length(trim(p_content)), 0) not between 1 and 1200 then
    raise exception using errcode = '22023', message = 'A valid peer review is required.';
  end if;
  if not exists (select 1 from public.task_applications
      where task_id = p_task_id and applicant_id = p_actor_id
        and status in ('accepted', 'submitted', 'completed') and arbitration_status not in ('force_completed', 'cancelled', 'refunded'))
    or not exists (select 1 from public.task_applications
      where task_id = p_task_id and applicant_id = p_reviewee_id
        and status in ('accepted', 'submitted', 'completed') and arbitration_status not in ('force_completed', 'cancelled', 'refunded')) then
    raise exception using errcode = '42501', message = 'Peer reviews are limited to accepted task members.';
  end if;
  insert into public.task_peer_reviews (task_id, reviewer_id, reviewee_id, rating, communication, contribution, punctuality, content)
  values (p_task_id, p_actor_id, p_reviewee_id, ((p_communication + p_contribution + p_punctuality + 1) / 3)::smallint,
    p_communication, p_contribution, p_punctuality, trim(p_content))
  on conflict (task_id, reviewer_id, reviewee_id) do update set
    rating = excluded.rating, communication = excluded.communication, contribution = excluded.contribution,
    punctuality = excluded.punctuality, content = excluded.content, updated_at = now()
  returning id into v_review_id;
  return v_review_id;
end;
$$;

revoke all on function public.get_task_template_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_task_publishing_eligibility(uuid) from public, anon, authenticated;
revoke all on function public.save_task_template(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_task_publishing_rule(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_task_publishing_override(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_task_collaboration(uuid, uuid) from public, anon, authenticated;
revoke all on function public.send_task_conversation_message(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.assign_task_member(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.submit_task_peer_review(uuid, uuid, uuid, smallint, text) from public, anon, authenticated;

grant execute on function public.get_task_publishing_eligibility(uuid) to service_role;
grant execute on function public.save_task_template(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_task_publishing_rule(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_task_publishing_override(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.get_task_collaboration(uuid, uuid) to service_role;
grant execute on function public.send_task_conversation_message(uuid, uuid, text) to service_role;
grant execute on function public.assign_task_member(uuid, uuid, uuid, text) to service_role;
grant execute on function public.submit_task_peer_review(uuid, uuid, uuid, smallint, text) to service_role;
