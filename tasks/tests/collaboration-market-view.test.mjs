import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { toCollaborativeTaskModel } from "../../assets/js/tasks/task-view.js";

test("collaborative listings expose capacity and review labels without money fields", () => {
  const model = toCollaborativeTaskModel({ task_mode: "collaboration", application_limit: 3, application_count: 2 });
  assert.equal(model.isCollaboration, true);
  assert.equal(model.capacityLabel, "2 / 3 人已接取");
  assert.equal(model.reviewLabel, "成员互评 + 发布者批改");
  assert.equal("payment" in model, false);
});

test("market page provides collaboration filters and publishing eligibility state", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-task-filter-mode/);
  assert.match(html, /data-task-publishing-eligibility/);
});
