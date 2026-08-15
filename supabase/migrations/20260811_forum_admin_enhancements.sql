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
      'admin:access', 'admin:manageForum', 'tasks:apply', 'tasks:submit'
    ])
    else public.canonical_capability(p_capability) = any(array[
      'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
      'forum:deleteOwnPost', 'forum:deleteOwnComment', 'tasks:apply', 'tasks:submit'
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
        'tasks:manage', 'tasks:apply', 'tasks:assign', 'tasks:submit', 'tasks:complete',
        'shop:view', 'shop:redeem', 'shop:manageProducts', 'shop:manageOrders',
        'announce:read', 'announce:create', 'announce:update', 'announce:delete', 'announce:publish', 'announce:pin'
      ]
      when 'MODERATOR'::public.user_role then array[
        'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
        'forum:deleteOwnPost', 'forum:deleteOwnComment', 'forum:deleteAnyPost', 'forum:deleteAnyComment',
        'forum:pinPost', 'forum:lockPost', 'admin:access', 'admin:manageForum', 'tasks:apply', 'tasks:submit',
        'shop:view', 'shop:redeem', 'announce:read', 'announce:create', 'announce:update', 'announce:publish', 'announce:pin'
      ]
      else array[
        'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
        'forum:deleteOwnPost', 'forum:deleteOwnComment', 'tasks:apply', 'tasks:submit', 'shop:view', 'shop:redeem', 'announce:read'
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
