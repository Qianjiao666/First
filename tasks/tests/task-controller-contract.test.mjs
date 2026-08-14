import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), "utf8");
}

test("task controllers consume the shared badge without implementing it", async () => {
  const common = await read("assets/js/tasks/task-common.js");

  assert.match(common, /\.\.\/core\/reputation\.js/);
  assert.match(common, /renderReputationBadge/);
  assert.doesNotMatch(common, /customElements\.define/);
  assert.match(common, /await runtime\.waitForSession\?\.\(\)/);
  assert.match(common, /requireAuthenticatedAction/);
});

test("public controllers route writes through the task API wrapper", async () => {
  const [list, detail, mine] = await Promise.all([
    read("assets/js/tasks/task-list.js"),
    read("assets/js/tasks/task-detail.js"),
    read("assets/js/tasks/task-my.js"),
  ]);

  assert.match(list, /listPublished/);
  assert.match(list, /listCategories/);
  assert.match(list, /categorySelect\.replaceChildren/);
  assert.match(list, /data-task-pagination/);
  assert.match(list, /currentPage/);
  assert.match(detail, /api\.apply/);
  assert.match(mine, /api\.submit/);
  assert.match(detail, /requireAuthenticatedAction\(services\.runtime, "申领任务"\)/);
  assert.match(mine, /requireAuthenticatedAction\(services\.runtime, "提交任务"\)/);
  assert.doesNotMatch(`${list}\n${detail}\n${mine}`, /from\s+["'][^"']*forum/);
});

test("admin controller keeps all privileged actions behind the API wrapper", async () => {
  const admin = await read("assets/js/tasks/task-admin.js");

  assert.match(admin, /getAdminTasks/);
  assert.match(admin, /api\.saveTask/);
  assert.match(admin, /api\.assign/);
  assert.match(admin, /api\.complete/);
  assert.match(admin, /api\.reject/);
  assert.match(admin, /review/);
  assert.match(admin, /api\.listCategories/);
  assert.match(admin, /api\.saveCategory/);
  assert.match(admin, /tasks:manage/);
  assert.match(admin, /getCapabilities/);
  assert.match(admin, /saved\.warnings/);
  assert.match(admin, /敏感内容/);
  assert.match(admin, /applicationPanel\.addEventListener\("click"/);
  assert.match(admin, /requireAuthenticatedAction\(services\.runtime, "管理任务"\)/);
});

test("task creation is guarded before the existing save call", async () => {
  const create = await read("assets/js/tasks/task-create.js");
  const guardIndex = create.indexOf('requireAuthenticatedAction(services.runtime, "创建任务")');
  const saveIndex = create.indexOf("services.api.saveTask");

  assert.notEqual(guardIndex, -1);
  assert.ok(guardIndex < saveIndex);
});

test("personal task controller exposes accepted-application cancellation", async () => {
  const mine = await read("assets/js/tasks/task-my.js");

  assert.match(mine, /api\.cancel/);
  assert.match(mine, /cancel/);
});

test("admin editor loads existing task data before submitting an update", async () => {
  const admin = await read("assets/js/tasks/task-admin.js");

  assert.match(admin, /api\.getAdminTask/);
  assert.match(admin, /data-task-editor-form/);
  assert.match(admin, /deadline_at|deadlineAt/);
});

test("task plaza forwards collaboration filters without losing existing filters", async () => {
  const source = await readFile("assets/js/tasks/task-list.js", "utf8");
  assert.match(source, /buildTaskListFilters/);
  assert.match(source, /data-task-filter-status/);
  assert.match(source, /data-task-filter-reward/);
  assert.match(source, /data-task-filter-deadline/);
  assert.match(source, /data-task-filter-skill-tags/);
  assert.match(source, /skillTags/);
});

test("my tasks supports action grouping and supplement delivery", async () => {
  const html = await readFile("tasks/my/index.html", "utf8");
  assert.match(html, /data-task-group-needs-action/);
  assert.match(html, /task-supplement-dialog/);
  assert.match(html, /name="supplementNote"/);
  const source = await readFile("assets/js/tasks/task-my.js", "utf8");
  assert.match(source, /canSupplementApplication/);
  assert.match(source, /services\.api\.attach/);
  assert.match(source, /supplementNote/);
});
