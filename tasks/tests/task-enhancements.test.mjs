import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), "utf8");
}

async function readMigrationSources() {
  const directory = new URL("supabase/migrations/", ROOT);
  const entries = await readdir(directory, { withFileTypes: true });
  const migrationSources = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => read(`supabase/migrations/${entry.name}`)),
  );
  return [await read("supabase/modules/tasks.sql"), ...migrationSources, await read("supabase/schema.sql")].join("\n");
}

test("task persistence defines constrained attachments, activity history, and cleanup", async () => {
  const sql = await readMigrationSources();

  assert.match(sql, /create table if not exists public\.task_attachments\b/i);
  assert.match(sql, /task_attachments[\s\S]*\b(?:task_id|application_id)\s+uuid/i);
  assert.match(sql, /task_attachments[\s\S]*(?:object_path|storage_path|path)\s+text/i);
  assert.match(sql, /task_attachments[\s\S]*mime_type[\s\S]*(?:image\/|video\/)/i);
  assert.match(sql, /task_attachments[\s\S]*size_bytes[\s\S]*(?:52428800|50\s*\*\s*1024\s*\*\s*1024|50000000)/i);
  assert.match(sql, /storage\.buckets[\s\S]*(?:task-attachments|task_attachments)/i);
  assert.match(sql, /storage\.objects[\s\S]*(?:task_attachments|task-attachments)/i);
  assert.match(sql, /(?:trigger|function)[\s\S]*(?:delete|cleanup)[\s\S]*storage\.objects/i);

  assert.match(sql, /create table if not exists public\.task_activity_log\b/i);
  assert.match(sql, /task_activity_log[\s\S]*\btask_id\s+uuid/i);
  assert.match(sql, /task_activity_log[\s\S]*(?:event_type|action|activity_type)\s+text/i);
  assert.match(sql, /alter table public\.task_activity_log enable row level security/i);
  assert.match(sql, /(?:append|record|write|log)_task_activity/i);
});

test("task SQL records completion explanations and timeout arbitration atomically", async () => {
  const sql = await readMigrationSources();

  assert.match(sql, /task_applications[\s\S]*(?:completion_note|completion_explanation|completion_description)\s+text/i);
  assert.match(sql, /(?:timeout|expired|overdue|arbitrat|dispute)/i);
  assert.match(sql, /create or replace function public\.(?:force_complete_task|arbitrate_task|admin_force_complete_task)/i);
  assert.match(sql, /create or replace function public\.(?:cancel_task_refund|cancel_refund_task|admin_cancel_refund|admin_cancel_task_refund)/i);
  assert.match(sql, /create or replace function public\.(?:edit_task|admin_edit_task)/i);
  assert.match(sql, /create or replace function public\.(?:deduct_task_reputation|admin_deduct_task_reputation)/i);
  assert.match(sql, /(?:refund|reputation)[\s\S]*(?:for update|apply_reputation_event|reputation_events)/i);
  assert.match(sql, /task_activity_log[\s\S]*(?:force|refund|arbitrat|deduct)/i);
});

test("task Edge Functions expose attachment-aware completion and privileged arbitration", async () => {
  const [complete, admin] = await Promise.all([
    read("supabase/functions/task-complete/index.ts"),
    read("supabase/functions/task-admin/index.ts"),
  ]);

  assert.match(complete, /\.\.\/_shared\/auth\.ts/);
  assert.match(complete, /\.\.\/_shared\/sensitive-filter\.ts/);
  assert.match(complete, /checkPermission\(request, "tasks",/);
  assert.match(complete, /(?:submissionNote|completion(?:Note|Explanation|Description))/i);
  assert.match(complete, /attachment|task_attachments|storage/i);
  assert.match(complete, /(?:timeout|expired|overdue|arbitrat)/i);
  assert.match(complete, /enforceMute:\s*true/);

  assert.match(admin, /\.\.\/_shared\/auth\.ts/);
  assert.match(admin, /\.\.\/_shared\/sensitive-filter\.ts/);
  assert.match(admin, /checkPermission\(request, "tasks",/);
  assert.match(admin, /(?:force[_-]?complete|cancel[_-]?refund|deduct[_-]?reputation|arbitrat)/i);
  assert.match(admin, /(?:task_activity_log|activity|audit)/i);
  assert.match(admin, /(?:transaction|rpc\(|callTaskRpc)/i);
  assert.doesNotMatch(`${complete}\n${admin}`, /service_role\s*[:=]\s*["'`]/i);
});

test("task detail and completion forms expose timeline and constrained attachment input", async () => {
  const [detailHtml, myHtml, detailController, myController] = await Promise.all([
    read("tasks/detail/index.html"),
    read("tasks/my/index.html"),
    read("assets/js/tasks/task-detail.js"),
    read("assets/js/tasks/task-my.js"),
  ]);
  const html = `${detailHtml}\n${myHtml}`;
  const controllers = `${detailController}\n${myController}`;

  assert.match(html, /(?:task-timeline|task-activity|data-task-(?:timeline|activity))/i);
  assert.match(html, /type=["']file["'][^>]*(?:accept=["'][^"']*(?:image|video)|data-task-attachment)/i);
  assert.match(html, /(?:completionNote|completionExplanation|submissionNote)/i);
  assert.match(controllers, /(?:timeline|activity|attachment)/i);
  assert.match(controllers, /api\.submit\([\s\S]*(?:attachment|completion|submission)/i);
  assert.match(controllers, /(?:getAll\(["']attachments|api\.attach|uploadTaskAttachment)/i);
});

test("task API forwards completion attachments and exposes administrative arbitration actions", async () => {
  const apiSource = await read("assets/js/tasks/task-api.js");

  assert.match(apiSource, /submit[\s\S]*attachments/i);
  assert.match(apiSource, /complete[\s\S]*(?:completionNote|completionExplanation|attachments)/i);
  assert.match(apiSource, /arbitrat/i);
  assert.match(apiSource, /decision/i);
});
