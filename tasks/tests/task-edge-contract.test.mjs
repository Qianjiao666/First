import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), "utf8");
}

test("task-admin delegates permissions and content filtering to shared services", async () => {
  const source = await read("supabase/functions/task-admin/index.ts");

  assert.match(source, /\.\.\/_shared\/auth\.ts/);
  assert.match(source, /\.\.\/_shared\/sensitive-filter\.ts/);
  assert.match(source, /checkPermission\(request, "tasks", ACTION_PERMISSIONS\[action\] \?\? action\)/);
  assert.match(source, /replaceSensitive/);
  assert.match(source, /p_actor_id/);
  assert.match(source, /loadTaskForPublish/);
  assert.match(source, /task_listings/);
  assert.match(source, /reject_applicant/);
  assert.match(source, /reject:\s*"assign"/);
  assert.doesNotMatch(source, /service_role[^A-Z_]/i);
});

test("task-complete keeps application and verification writes behind task RPCs", async () => {
  const source = await read("supabase/functions/task-complete/index.ts");

  assert.match(source, /assertNotMuted/);
  assert.match(source, /checkPermission\(request, "tasks", ACTION_PERMISSIONS\[action\] \?\? action\)/);
  assert.match(source, /"apply_task"/);
  assert.match(source, /"submit_task"/);
  assert.match(source, /"complete_task"/);
  assert.match(source, /"cancel_application"/);
  assert.match(source, /cancel:\s*"submit"/);
  assert.match(source, /p_filtered_application_note/);
  assert.match(source, /p_filtered_submission_note/);
  assert.doesNotMatch(source, /apply_reputation_event/);
});

test("task-complete returns application warnings at the response envelope", async () => {
  const source = await read("supabase/functions/task-complete/index.ts");

  assert.match(source, /jsonResponse\(\{ data: \{ applicationId \}, warnings: filtered\.matches \}\)/);
  assert.doesNotMatch(source, /data: \{ applicationId, warnings: filtered\.matches \}/);
});
