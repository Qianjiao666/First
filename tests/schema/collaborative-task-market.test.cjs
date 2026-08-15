const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const schema = fs.readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8");
const migrationPath = path.resolve(__dirname, "../../supabase/migrations/20260815_collaborative_task_market.sql");
const collaborationSql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, "utf8") : "";

test("collaboration conversation messages are service-only and have RLS", () => {
  assert.match(schema, /create table if not exists public\.task_conversation_messages/i);
  assert.match(schema, /alter table public\.task_conversation_messages enable row level security/i);
  assert.match(schema, /grant execute on function public\.send_task_conversation_message/i);
  assert.match(schema, /revoke all on function public\.send_task_conversation_message[^;]*from public, anon, authenticated/i);
  assert.match(schema, /grant execute on function public\.send_task_conversation_message[^;]*to service_role/i);
  assert.doesNotMatch(schema, /grant execute on function public\.send_task_conversation_message[^;]*to[^;]*(anon|authenticated|public)/i);
  assert.ok(fs.existsSync(migrationPath), "collaboration migration is required");
  assert.doesNotMatch(collaborationSql, /\b(price|payment|escrow|refund|wallet|payout|withdraw\w*)\b/i);
});

test("collaboration RPCs keep consultation and stale-member access scoped", () => {
  const collaborationFunction = collaborationSql.match(
    /create or replace function public\.get_task_collaboration[\s\S]*?\$\$;/i,
  )?.[0] ?? "";
  const messageFunction = collaborationSql.match(
    /create or replace function public\.send_task_conversation_message[\s\S]*?\$\$;/i,
  )?.[0] ?? "";

  assert.match(collaborationFunction, /v_can_view_shared boolean/i);
  assert.match(collaborationFunction, /'assignments', case when v_can_view_shared/i);
  assert.match(collaborationFunction, /'peerReviews', case when v_can_view_shared/i);
  assert.match(messageFunction, /arbitration_status not in \('force_completed', 'cancelled', 'refunded'\)/i);
});

test("collaboration migration backfills existing application workspaces", () => {
  assert.match(
    collaborationSql,
    /insert into public\.task_conversations \(task_id, kind, application_id(?:, status)?\)[\s\S]*?select[\s\S]*?'application_consultation'[\s\S]*?from public\.task_applications/i,
  );
  assert.match(
    collaborationSql,
    /insert into public\.task_conversation_members[\s\S]*?select[\s\S]*?from public\.task_conversations[\s\S]*?join public\.task_applications/i,
  );
});
