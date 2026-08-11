const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const schema = fs.readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8");
const redeem = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/redeem/index.ts"), "utf8");
const adminRedeem = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/admin-redeem-codes/index.ts"), "utf8");
const adminUsers = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/admin-users/index.ts"), "utf8");

test("reward codes can grant exact permissions and persist grants with RLS", () => {
  assert.match(schema, /create table if not exists public\.user_granted_permissions/i);
  assert.match(schema, /capability text[^\n]*check/i);
  assert.match(schema, /alter table public\.user_granted_permissions enable row level security/i);
  assert.match(schema, /grant select on public\.user_granted_permissions to authenticated/i);
  assert.match(schema, /reward_permission/i);
  assert.match(schema, /reward_role/i);
});

test("capability resolution includes active user grants and redemption stays atomic", () => {
  assert.match(schema, /get_user_capabilities[\s\S]*user_granted_permissions/i);
  assert.match(schema, /select public\.canonical_capability\(grants\.capability\)/i);
  assert.match(schema, /redeem_code[\s\S]*user_granted_permissions/i);
  assert.match(schema, /admin_audit_log|audit_log/i);
  assert.match(redeem, /auth\.requireContext\(request\)/);
  assert.match(adminRedeem, /checkPermission\(request, "admin", "manageRedeemCodes"\)/);
  assert.match(adminRedeem, /body\.rewardPermission\s*\?\?\s*body\.grantPermission/);
});

test("admin exact permission changes are authorized, audited, and exposed through the edge function", () => {
  assert.match(schema, /create or replace function public\.admin_set_user_permission/i);
  assert.match(schema, /admin_set_user_permission[\s\S]*assert_actor_capability\(p_actor_id, 'admin:manageUsers'\)/i);
  assert.match(schema, /admin_set_user_permission[\s\S]*permission_grant_audit/i);
  assert.match(schema, /revoke all on function public\.admin_set_user_permission\(uuid, uuid, text, boolean, text\)/i);
  assert.match(schema, /grant execute on function public\.admin_set_user_permission\(uuid, uuid, text, boolean, text\) to service_role/i);
  assert.match(adminUsers, /action === "setPermission"/);
  assert.match(adminUsers, /db\.rpc\("admin_set_user_permission"/);
  assert.match(adminUsers, /from\("user_granted_permissions"\)/);
  assert.match(adminUsers, /permissions:/);
});
