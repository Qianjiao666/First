import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeContracts = [
  ["../index.html", ["data-task-workspace", "data-task-filter-drawer", "data-task-workspace-main", "data-task-list"]],
  ["../my/index.html", ["data-task-workspace", "data-task-priority-queue", "data-task-my-list"]],
  ["../create/index.html", ["data-task-workspace", "data-task-workflow-steps", "data-task-create-form"]],
  ["../detail/index.html", ["data-task-workspace", "data-task-stage-nav", "data-task-detail"]],
  ["../../admin/tasks/index.html", ["data-task-workspace", "data-task-admin-metrics", "data-task-admin-table-body"]],
  ["../../admin/tasks/edit/index.html", ["data-task-workspace", "data-task-workflow-steps", "data-task-editor-form"]],
];

test("task surfaces load the workspace layer without removing business contracts", async () => {
  for (const [path, markers] of routeContracts) {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(html, /assets\/css\/task-workspace\.css/);
    assert.match(html, /assets\/js\/tasks\/task-workspace\.js/);
    for (const marker of markers) assert.match(html, new RegExp(marker));
  }
});

test("workspace controller only coordinates presentation state", async () => {
  const source = await readFile(new URL("../../assets/js/tasks/task-workspace.js", import.meta.url), "utf8");
  assert.match(source, /data-task-sidebar-toggle/);
  assert.match(source, /data-task-filter-drawer/);
  assert.doesNotMatch(source, /queryTasks|invokeTaskFunction|supabase|innerHTML/i);
});
