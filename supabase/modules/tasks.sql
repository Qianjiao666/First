-- Task publishing module schema draft.
-- 6.1 reviews and merges this file into supabase/schema.sql. Do not run this file directly.
-- Shared prerequisites owned by 6.1:
--   user_public_profiles, user_moderation_state, sensitive_words,
--   apply_reputation_event(...), and service-role Edge Function credentials.

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
select distinct a.task_id, 'collaboration', null,
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
revoke all on function public.submit_task_peer_review(uuid, uuid, uuid, smallint, smallint, smallint, text) from public, anon, authenticated;

grant execute on function public.get_task_publishing_eligibility(uuid) to service_role;
grant execute on function public.save_task_template(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_task_publishing_rule(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_task_publishing_override(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.get_task_collaboration(uuid, uuid) to service_role;
grant execute on function public.send_task_conversation_message(uuid, uuid, text) to service_role;
grant execute on function public.assign_task_member(uuid, uuid, uuid, text) to service_role;
grant execute on function public.submit_task_peer_review(uuid, uuid, uuid, smallint, smallint, smallint, text) to service_role;
