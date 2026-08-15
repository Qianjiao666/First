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
declare v_id uuid;
begin
  if p_actor_id is null or coalesce(char_length(trim(p_payload ->> 'title')), 0) = 0 then
    raise exception using errcode = '22023', message = 'Template title is required.';
  end if;
  insert into public.task_templates(id, owner_id, title, summary, body, skill_tags, category_id, subcategory_id,
    default_reward_points, default_application_limit, default_duration_days, is_public)
  values (coalesce(p_template_id, gen_random_uuid()), p_actor_id, trim(p_payload->>'title'), trim(p_payload->>'summary'),
    trim(p_payload->>'body'), coalesce(p_payload->'skillTags','[]'::jsonb), (p_payload->>'categoryId')::uuid,
    nullif(p_payload->>'subcategoryId','')::uuid, coalesce((p_payload->>'defaultRewardPoints')::integer,0),
    coalesce((p_payload->>'defaultApplicationLimit')::integer,1), coalesce((p_payload->>'defaultDurationDays')::integer,7),
    coalesce((p_payload->>'isPublic')::boolean,false))
  on conflict (id) do update set title=excluded.title, summary=excluded.summary, body=excluded.body,
    skill_tags=excluded.skill_tags, category_id=excluded.category_id, subcategory_id=excluded.subcategory_id,
    default_reward_points=excluded.default_reward_points, default_application_limit=excluded.default_application_limit,
    default_duration_days=excluded.default_duration_days, is_public=excluded.is_public, updated_at=now()
    where public.task_templates.owner_id = p_actor_id
  returning id into v_id;
  if v_id is null then raise exception using errcode='42501', message='Template is not owned by actor.'; end if;
  return v_id;
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
