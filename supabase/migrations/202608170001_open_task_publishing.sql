-- Every authenticated, unmuted account may publish its own task.
-- Ownership, draft state, content validation, taxonomy, and deadline checks remain enforced.

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

revoke all on function public.publish_task(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.publish_task(uuid, uuid, jsonb) to service_role;
