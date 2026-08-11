const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");

test("defines audited user-granted permissions with RLS and explicit grants", () => {
  assert.match(schema, /create table if not exists public\.user_granted_permissions/i);
  assert.match(schema, /alter table public\.user_granted_permissions enable row level security/i);
  assert.match(schema, /create table if not exists public\.permission_grant_audit/i);
  assert.match(schema, /revoke all on public\.user_granted_permissions from (?:public, )?anon, authenticated/i);
  assert.match(schema, /grant select on public\.user_granted_permissions to authenticated/i);
});

test("redeem codes support role and exact capability rewards", () => {
  assert.match(schema, /reward_role public\.user_role/i);
  assert.match(schema, /reward_permission text/i);
  assert.match(schema, /insert into public\.user_granted_permissions/i);
  assert.match(schema, /on conflict \(redeem_code_id, user_id\) do nothing/i);
  assert.match(schema, /already_redeemed/i);
});

test("capabilities include active grants and privileged RPCs recheck the actor", () => {
  assert.match(schema, /from public\.user_granted_permissions[\s\S]*revoked_at is null/i);
  assert.match(schema, /create or replace function public\.assert_actor_capability/i);
  for (const fn of [
    "create_forum_post",
    "update_forum_post",
    "delete_own_forum_post",
    "create_forum_comment",
    "delete_own_forum_comment",
    "set_forum_vote",
    "moderate_forum_content",
    "admin_set_user_role",
    "admin_adjust_reputation",
    "transfer_global_account",
  ]) {
    assert.match(schema, new RegExp(`function public\\.${fn}[\\s\\S]*assert_actor_capability`, "i"));
  }
});

test("admin actions write a durable audit record", () => {
  assert.match(schema, /create table if not exists public\.admin_audit_log/i);
  assert.match(schema, /insert into public\.admin_audit_log/i);
  assert.match(schema, /transfer_global_account[\s\S]*admin_audit_log/i);
});

test("admin exact capability grants are service-only, canonicalized, and audited", () => {
  assert.match(schema, /create or replace function public\.admin_set_user_permission/i);
  assert.match(schema, /admin_set_user_permission[\s\S]*canonical_capability\(p_capability\)/i);
  assert.match(schema, /admin_set_user_permission[\s\S]*permission_grant_audit/i);
  assert.match(schema, /revoke all on function public\.admin_set_user_permission\(uuid, uuid, text, boolean, text\)/i);
  assert.match(schema, /grant execute on function public\.admin_set_user_permission\(uuid, uuid, text, boolean, text\) to service_role/i);
});
