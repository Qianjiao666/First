-- Allow regular members to create, edit and publish their own tasks.
-- Edge Functions still perform the request-time capability check; task RPCs
-- repeat creator ownership checks under a locked row.

create or replace function public.canonical_capability(p_capability text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(trim(p_capability), '')
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
      'forum:deleteOwnPost', 'forum:deleteOwnComment', 'tasks:create', 'tasks:update',
      'tasks:publish', 'tasks:manageCategories', 'tasks:apply', 'tasks:submit', 'tasks:attach'
    ])
  end;
$$;

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
        'admin:manageSensitiveWords', 'admin:transferAccount',
        'tasks:create', 'tasks:update', 'tasks:publish', 'tasks:close', 'tasks:archive', 'tasks:delete',
        'tasks:manageCategories', 'tasks:manage', 'tasks:apply', 'tasks:assign', 'tasks:submit',
        'tasks:complete', 'tasks:attach', 'tasks:arbitrate',
        'task:create', 'task:update', 'task:publish', 'task:manageCategories', 'task:manage',
        'task:apply', 'task:submit', 'task:complete', 'task:attach', 'task:arbitrate',
        'shop:view', 'shop:redeem', 'shop:manageProducts', 'shop:manageOrders',
        'announce:read', 'announce:create', 'announce:update', 'announce:delete', 'announce:publish', 'announce:pin'
      ]
      when 'MODERATOR'::public.user_role then array[
        'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
        'forum:deleteOwnPost', 'forum:deleteOwnComment', 'forum:deleteAnyPost', 'forum:deleteAnyComment',
        'forum:pinPost', 'forum:lockPost', 'admin:access', 'admin:manageForum',
        'tasks:create', 'tasks:update', 'tasks:publish', 'tasks:manageCategories', 'tasks:apply',
        'tasks:submit', 'tasks:attach', 'task:create', 'task:update', 'task:publish',
        'task:manageCategories', 'task:apply', 'task:submit', 'task:attach',
        'shop:view', 'shop:redeem', 'announce:read', 'announce:create', 'announce:update', 'announce:publish', 'announce:pin'
      ]
      else array[
        'forum:createPost', 'forum:createComment', 'forum:vote', 'forum:editOwnPost',
        'forum:deleteOwnPost', 'forum:deleteOwnComment',
        'tasks:create', 'tasks:update', 'tasks:publish', 'tasks:manageCategories', 'tasks:apply',
        'tasks:submit', 'tasks:attach', 'task:create', 'task:update', 'task:publish',
        'task:manageCategories', 'task:apply', 'task:submit', 'task:attach',
        'shop:view', 'shop:redeem', 'announce:read'
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

revoke all on function public.canonical_capability(text) from public, anon, authenticated;
revoke all on function public.role_has_capability(public.user_role, text) from public, anon, authenticated;
revoke all on function public.get_user_capabilities() from public, anon, authenticated;
grant execute on function public.get_user_capabilities() to authenticated;
