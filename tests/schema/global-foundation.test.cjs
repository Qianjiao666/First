const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const schemaPath = path.resolve(__dirname, "../../supabase/schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

test("defines global role and separated public identity tables", () => {
  assert.match(schema, /create type public\.user_role as enum \('USER', 'MODERATOR', 'ADMIN'\)/i);
  assert.match(schema, /create table if not exists public\.user_public_profiles/i);
  assert.match(schema, /create table if not exists public\.user_moderation_state/i);
  assert.match(schema, /role public\.user_role not null default 'USER'/i);
  assert.match(schema, /reputation integer not null default 0 check \(reputation >= 0\)/i);
});

test("defines an idempotent reputation ledger with service-only execution", () => {
  assert.match(schema, /create table if not exists public\.reputation_events/i);
  assert.match(schema, /event_key text not null unique/i);
  assert.match(schema, /create or replace function public\.apply_reputation_event/i);
  assert.match(schema, /on conflict \(event_key\) do nothing/i);
  assert.match(schema, /revoke all on function public\.apply_reputation_event/i);
  assert.match(schema, /grant execute on function public\.apply_reputation_event[\s\S]*to service_role/i);
});
