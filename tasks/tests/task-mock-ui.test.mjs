import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);
const pages = [
  "tasks/mock/index.html",
  "tasks/mock/create/index.html",
  "tasks/mock/my/index.html",
  "admin/tasks/mock/index.html",
  "admin/tasks/mock/review/index.html",
];

test("task-management mock pages are isolated from the existing task API and database", async () => {
  const source = await readFile(new URL("assets/js/tasks/task-mock-ui.js", ROOT), "utf8");
  const data = await readFile(new URL("assets/js/tasks/task-mock-data.js", ROOT), "utf8");

  assert.match(source, /guardFormData/);
  assert.match(source, /requiredRole === "admin"/);
  assert.match(source, /role === "ADMIN"/);
  assert.doesNotMatch(`${source}\n${data}`, /TaskApi|queryTasks|invokeTaskFunction|supabase\//i);
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|outerHTML|alert\(/);
  assert.match(data, /localStorage/);
  assert.match(data, /downloadMockCsv/);
});

test("all five mock routes load the shared theme-compatible mock layer", async () => {
  for (const path of pages) {
    const html = await readFile(new URL(path, ROOT), "utf8");
    assert.match(html, /assets\/css\/task-mock\.css/);
    assert.match(html, /assets\/js\/tasks\/task-mock-ui\.js/);
    assert.match(html, /assets\/js\/core\/runtime\.js/);
    assert.match(html, /assets\/js\/core\/app-shell\.js/);
    assert.doesNotMatch(html, /data-task-workspace/);
  }
});

test("mock task copy uses reputation terminology and keeps key interactions", async () => {
  const source = await readFile(new URL("assets/js/tasks/task-mock-ui.js", ROOT), "utf8");

  for (const marker of ["拖动卡片", "批量通过", "在线预览", "打回修改必须填写修改原因", "提交审核（通过后+20声望）", "saveDraft", "收藏"]) {
    assert.ok(source.includes(marker), `missing mock interaction: ${marker}`);
  }
  assert.doesNotMatch(source, /积分/);
});
