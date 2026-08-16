import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

async function source() {
  return readFile(new URL("supabase/functions/task-collaboration/index.ts", ROOT), "utf8");
}

test("task collaboration keeps participant actions behind authenticated service RPCs", async () => {
  const implementation = await source();

  assert.match(implementation, /const ACTIONS = new Set\(\["getCollaboration", "getConsultation", "sendMessage", "assignMember", "submitPeerReview", "getAuditContext"\]\)/);
  assert.match(implementation, /auth\.assertNotMuted\(context\)/);
  assert.match(implementation, /"send_task_conversation_message"/);
  assert.match(implementation, /"assign_task_member"/);
  assert.match(implementation, /"submit_task_peer_review"/);
  assert.match(implementation, /"get_task_collaboration_admin"/);
  assert.match(implementation, /guardPublicText/);
  assert.doesNotMatch(implementation, /(payment|wallet|refund|payout)/i);
});

test("task collaboration requires an audit reason and keeps messages scoped", async () => {
  const implementation = await source();

  assert.match(implementation, /const reason = guardPublicText\(asString\(payload\.reason, "reason"\)/);
  assert.match(implementation, /checkPermission\(request, "tasks", "manage"\)/);
  assert.match(implementation, /p_conversation_id: asString\(payload\.conversationId, "conversationId"\)/);
});
