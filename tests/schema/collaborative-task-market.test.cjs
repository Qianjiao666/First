const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const schema = fs.readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8");

test("collaboration conversation messages are service-only and have RLS", () => {
  assert.match(schema, /create table if not exists public\.task_conversation_messages/i);
  assert.match(schema, /alter table public\.task_conversation_messages enable row level security/i);
  assert.match(schema, /grant execute on function public\.send_task_conversation_message/i);
  assert.doesNotMatch(schema, /task_(payments|wallets|refunds)/i);
});
