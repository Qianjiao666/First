const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const schema = fs.readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8");

test("defines service-only global administration operations", () => {
  for (const name of [
    "admin_set_user_role",
    "admin_adjust_reputation",
    "redeem_code",
    "transfer_global_account",
  ]) {
    assert.match(schema, new RegExp(`create or replace function public\\.${name}`, "i"));
    assert.match(schema, new RegExp(`revoke all on function public\\.${name}[\\s\\S]*grant execute on function public\\.${name}[\\s\\S]*to service_role`, "i"));
  }
});

test("account transfers lock public profiles and record immutable reputation events", () => {
  assert.match(schema, /transfer_global_account[\s\S]*for update/i);
  assert.match(schema, /transfer_global_account[\s\S]*apply_reputation_event/i);
  assert.match(schema, /insert into public\.account_transfers/i);
});
