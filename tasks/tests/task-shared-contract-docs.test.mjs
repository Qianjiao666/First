import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), "utf8");
}

test("task documentation names the implemented trusted shared interfaces", async () => {
  const documents = await Promise.all([
    read("docs/task-publishing/CONTRACT.md"),
    read("docs/task-publishing/ARCHITECTURE.md"),
    read("docs/task-publishing/IMPLEMENTATION_PLAN.md"),
  ]);
  const source = documents.join("\n");

  assert.match(source, /TrustedContext/);
  assert.match(source, /checkPermission\(request, "tasks", action\)/);
  assert.match(source, /auth\.assertNotMuted\(context\)/);
  assert.match(source, /replaceSensitive\(adminClient, \{ text, userId, enforceMute \}\)/);
  assert.match(source, /severity: "NONE" \| "WARN" \| "MUTE"/);
  assert.match(source, /recordReputationEvent\(client, \{/);
  assert.match(source, /eventKey, userId, amount, reason, sourceResource, sourceId, actorId/);
  assert.match(source, /complete_task -> apply_reputation_event/);

  assert.doesNotMatch(source, /isUserMuted/);
  assert.doesNotMatch(source, /processContent/);
  assert.doesNotMatch(source, /replace_sensitive/);
});

test("task scope contract defines envelopes, search, guards, and reachable actions", async () => {
  const [edge, contract] = await Promise.all([
    read("docs/task-publishing/EDGE_API.md"),
    read("docs/task-publishing/CONTRACT.md"),
  ]);
  const source = `${edge}\n${contract}`;

  assert.match(source, /TaskQueryResult/);
  assert.match(source, /data.*warnings/s);
  assert.match(source, /title.*skill_tags/s);
  assert.match(source, /tasks:manage/);
  assert.match(source, /reject_applicant/);
  assert.match(source, /cancel_application/);
  assert.match(source, /manageCategories/);
  assert.match(source, /rating.*content/s);
});
