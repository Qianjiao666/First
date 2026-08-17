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
  assert.match(source, /\.\.\/_shared\/content-guard\.ts/);
  assert.match(source, /checkPermission\(request, "tasks", ACTION_PERMISSIONS\[action\] \?\? action\)/);
  assert.match(source, /\["create", "publish"\]\.includes\(action\)/);
  assert.match(source, /auth\.requireContext\(request\)/);
  assert.match(source, /guardPublicText/);
  assert.match(source, /p_actor_id/);
  assert.match(source, /loadTaskForPublish/);
  assert.match(source, /task_listings/);
  assert.match(source, /reject_applicant/);
  assert.match(source, /reject:\s*"assign"/);
  assert.doesNotMatch(source, /action === "publish" && content\.hasSensitiveContent/);
  assert.match(source, /p_filtered_completion_note:\s*completionNote\.text/);
  assert.doesNotMatch(source, /service_role[^A-Z_]/i);
});

test("task-admin keeps publishing open to authenticated users while retaining moderation guards", async () => {
  const source = await read("supabase/functions/task-admin/index.ts");

  assert.match(source, /auth\.assertNotMuted\(context\)/);
  assert.match(source, /loadTaskForPublish/);
  assert.match(source, /guardPublicText/);
});

test("task-admin keeps the arbitration validation error as valid source text", async () => {
  const source = await read("supabase/functions/task-admin/index.ts");

  assert.match(
    source,
    /throw new ApiError\("VALIDATION_ERROR", 400, "不支持的任务仲裁决定。"\);/,
  );
  assert.doesNotMatch(source, /銆俙/);
});

test("task-admin governs templates and publishing eligibility through service RPCs", async () => {
  const source = await read("supabase/functions/task-admin/index.ts");

  assert.match(source, /"getPublishingEligibility", "manageTemplates", "managePublishingRules", "managePublishingOverrides"/);
  assert.match(source, /"get_task_publishing_eligibility"/);
  assert.match(source, /"save_task_template"/);
  assert.match(source, /"save_task_publishing_rule"/);
  assert.match(source, /"save_task_publishing_override"/);
  assert.match(source, /\["price", "payment", "wallet", "refund", "payout"\]/);
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

test("task-complete includes review and completion-note replacements in warnings", async () => {
  const source = await read("supabase/functions/task-complete/index.ts");

  assert.match(source, /const completionWarnings = new Set<string>\(\)/);
  assert.match(source, /filtered\.matches\.forEach\(\(match\) => completionWarnings\.add\(match\)\)/);
  assert.match(source, /warnings: \[\.\.\.completionWarnings\]/);
});

test("task-complete guards review text before any attachment registration write", async () => {
  const source = await read("supabase/functions/task-complete/index.ts");
  const completeBranch = source.slice(source.indexOf("const review ="));
  const reviewGuard = completeBranch.indexOf('filterUserText(asString(review.content, "review.content")');
  const attachmentWrite = completeBranch.indexOf("registerAttachments(client");

  assert.ok(reviewGuard >= 0, "review content guard must exist in the complete branch");
  assert.ok(attachmentWrite >= 0, "attachment registration must exist in the complete branch");
  assert.ok(reviewGuard < attachmentWrite, "review content must be guarded before attachment records are written");
});
