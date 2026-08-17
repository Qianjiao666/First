import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sqlPath = new URL("../../supabase/modules/tasks.sql", import.meta.url);

test("task SQL declares isolated tables and RLS", async () => {
  const sql = await readFile(sqlPath, "utf8");
  for (const table of [
    "task_categories",
    "task_subcategories",
    "task_listings",
    "task_applications",
    "task_reviews",
    "task_post_links",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("task writes use service-only actor RPCs instead of public auth RPCs", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /create or replace function public\.create_task\(p_actor_id uuid, p_filtered_payload jsonb\)/);
  assert.match(sql, /create or replace function public\.apply_task\(p_actor_id uuid, p_task_id uuid, p_filtered_application_note text\)/);
  assert.match(sql, /create or replace function public\.complete_task\(p_actor_id uuid, p_application_id uuid, p_filtered_review jsonb/);
  assert.match(sql, /revoke all on function public\.create_task/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /create or replace function public\.create_task[\s\S]*?auth\.uid\(\)/i);
});

test("task publishing is not blocked by reputation or completion thresholds", async () => {
  const sql = await readFile(sqlPath, "utf8");
  const publish = sql.match(/create or replace function public\.publish_task[\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(publish, /Only the task creator may publish this task/);
  assert.doesNotMatch(publish, /get_task_publishing_eligibility|Actor is not eligible/);
});

test("task completion passes the locked reward amount to the global reputation event", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /reward_points/);
  assert.match(sql, /format\('task:%s:user:%s:completion:v1', v_task\.id, v_application\.applicant_id\)/);
  assert.match(sql, /apply_reputation_event/);
  assert.match(sql, /p_amount\s*=>\s*v_task\.reward_points/);
  assert.match(sql, /if v_task\.reward_points > 0 then[\s\S]*?apply_reputation_event/);
});

test("task SQL exposes service-only reject and cancel application transitions", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /create or replace function public\.reject_applicant\(p_actor_id uuid, p_application_id uuid\)/);
  assert.match(sql, /status = 'rejected'/);
  assert.match(sql, /create or replace function public\.cancel_application\(p_actor_id uuid, p_application_id uuid\)/);
  assert.match(sql, /status = 'cancelled'/);
  assert.match(sql, /revoke all on function public\.reject_applicant\(uuid, uuid\)/);
  assert.match(sql, /grant execute on function public\.cancel_application\(uuid, uuid\) to service_role/);
});

test("task capability extension documents the approved action markers", async () => {
  const sql = await readFile(sqlPath, "utf8");
  for (const capability of ["tasks:create", "tasks:apply", "tasks:manageCategories"]) {
    assert.match(sql, new RegExp(capability));
  }
});

test("task reads expose only published data, own application data, or admin data", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /task_listings_read_published/);
  assert.match(sql, /task_listings_read_own_application/);
  assert.match(sql, /task_listings_read_admin/);
  assert.match(sql, /task_applications_read_admin/);
});

test("canonical schema contains the task module and transfers task ownership", async () => {
  const schema = await readFile(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
  for (const table of ["task_categories", "task_listings", "task_applications", "task_reviews", "task_post_links"]) {
    assert.match(schema, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(schema, /update public\.task_applications[\s\S]*applicant_id = p_to_user_id/);
  assert.match(schema, /update public\.task_reviews[\s\S]*reviewer_id = case/);
});

test("canonical schema keeps the reviewable task module in sync", async () => {
  const moduleSql = await readFile(sqlPath, "utf8");
  const schema = await readFile(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
  const moduleStart = "create table if not exists public.task_categories";
  const schemaMarker = "-- Task publishing module merged from supabase/modules/tasks.sql.";
  const moduleStartIndex = moduleSql.indexOf(moduleStart);
  const moduleBodyWithExtensions = moduleSql.slice(moduleStartIndex).trim();
  const moduleLifecycleMarker = moduleBodyWithExtensions.indexOf("-- Task lifecycle v2.");
  const moduleBody = (moduleLifecycleMarker >= 0
    ? moduleBodyWithExtensions.slice(0, moduleLifecycleMarker)
    : moduleBodyWithExtensions).trim();
  const canonicalBody = schema.slice(schema.indexOf(schemaMarker) + schemaMarker.length);
  const canonicalStart = canonicalBody.indexOf(moduleStart);
  const lifecycleMarker = canonicalBody.indexOf("-- Task lifecycle v2.", canonicalStart);
  const canonicalEnd = lifecycleMarker >= 0 ? lifecycleMarker : canonicalBody.length;
  const canonicalModule = canonicalBody.slice(canonicalStart, canonicalEnd).trim();

  assert.equal(canonicalModule, moduleBody);
});

test("task writes lock user profiles before account transfer can migrate them", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /create or replace function public\.apply_task[\s\S]*?p_actor_id[\s\S]*?for update/);
  assert.match(sql, /create or replace function public\.submit_task[\s\S]*?p_actor_id[\s\S]*?for update/);
  assert.match(sql, /create or replace function public\.complete_task[\s\S]*?p_actor_id[\s\S]*?v_applicant_id[\s\S]*?for update/);
});

test("task SQL seeds an active default category idempotently", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /insert into public\.task_categories[\s\S]*?values[\s\S]*?'career-actions'[\s\S]*?on conflict \(slug\) do nothing/);
});

test("task write RPCs validate active category ownership", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /create or replace function public\.validate_task_taxonomy\(/);
  for (const functionName of ["create_task", "update_task", "publish_task"]) {
    const functionBody = sql.match(new RegExp(`create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$;`))?.[0] ?? "";
    assert.match(functionBody, /perform public\.validate_task_taxonomy/);
  }
});

test("all task database functions use an empty security definer search path", async () => {
  const sql = await readFile(sqlPath, "utf8");
  const functions = [...sql.matchAll(/create or replace function public\.[\s\S]*?\$\$;/g)].map((match) => match[0]);
  assert.ok(functions.length > 0);
  for (const functionBody of functions) assert.match(functionBody, /set search_path = ''/);
  assert.doesNotMatch(sql, /set search_path = public, pg_temp/);
});
