import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const moduleUrl = new URL("../../assets/js/tasks/task-detail.js", import.meta.url);
const source = await fs.readFile(fileURLToPath(moduleUrl), "utf8");

test("task application feedback reports successful sensitive-word replacements", () => {
  assert.match(source, /Array\.isArray\(result\?\.warnings\)/);
  assert.match(source, /已替换/);
});

test("task detail exposes next-step and collaboration activity slots", async () => {
  const html = await fs.readFile("tasks/detail/index.html", "utf8");
  assert.match(html, /data-task-next-step/);
  assert.match(html, /data-task-activity/);
  assert.match(source, /taskNextAction/);
  assert.match(source, /toActivitySummary/);
  assert.match(source, /data-task-next-step/);
  assert.match(source, /data-task-activity/);
});
