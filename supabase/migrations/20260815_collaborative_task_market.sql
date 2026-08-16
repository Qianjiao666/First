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
  v_is_admin boolean := false;
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

create or replace function public.get_task_collaboration_admin(
  p_actor_id uuid, p_task_id uuid, p_reason text
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if coalesce(char_length(trim(p_reason)), 0) not between 1 and 800 then
    raise exception using errcode = '22023', message = 'A non-empty audit reason is required.';
  end if;
  perform public.assert_task_admin(p_actor_id);
  select jsonb_build_object('taskId', p_task_id,
    'conversations', coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'applicationId', c.application_id, 'status', c.status,
      'members', (select coalesce(jsonb_agg(to_jsonb(m) order by m.joined_at), '[]'::jsonb) from public.task_conversation_members m where m.conversation_id = c.id),
      'messages', (select coalesce(jsonb_agg(to_jsonb(msg) order by msg.created_at), '[]'::jsonb) from public.task_conversation_messages msg where msg.conversation_id = c.id)
    ) order by c.created_at), '[]'::jsonb)) into v_result
  from public.task_conversations c where c.task_id = p_task_id;
  insert into public.admin_audit_log(actor_id, action, resource_type, resource_id, metadata)
  values (p_actor_id, 'task.collaboration.admin_read', 'task', p_task_id, jsonb_build_object('reason', trim(p_reason)));
  return v_result;
end; $$;

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
      and (
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
revoke all on function public.keep_published_task_template_snapshot() from public, anon, authenticated;
revoke all on function public.sync_task_application_conversations() from public, anon, authenticated;
revoke all on function public.sync_task_listing_conversations() from public, anon, authenticated;
revoke all on function public.get_task_collaboration(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_task_collaboration_admin(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.send_task_conversation_message(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.assign_task_member(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.submit_task_peer_review(uuid, uuid, uuid, smallint, smallint, smallint, text) from public, anon, authenticated;

grant execute on function public.get_task_publishing_eligibility(uuid) to service_role;
grant execute on function public.save_task_template(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_task_publishing_rule(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_task_publishing_override(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.get_task_collaboration(uuid, uuid) to service_role;
grant execute on function public.get_task_collaboration_admin(uuid, uuid, text) to service_role;
grant execute on function public.send_task_conversation_message(uuid, uuid, text) to service_role;
grant execute on function public.assign_task_member(uuid, uuid, uuid, text) to service_role;
grant execute on function public.submit_task_peer_review(uuid, uuid, uuid, smallint, smallint, smallint, text) to service_role;
