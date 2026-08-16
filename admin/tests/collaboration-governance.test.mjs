import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("task governance page exposes template, publishing-rule and override forms", async () => {
  const html = await readFile(new URL("../tasks/index.html", import.meta.url), "utf8");
  assert.match(html, /data-task-template-form/);
  assert.match(html, /data-task-publishing-rule-form/);
  assert.match(html, /data-task-publishing-override-form/);
});

test("task admin binds governance forms to the narrowed TaskApi methods", async () => {
  const source = await readFile(new URL("../../assets/js/tasks/task-admin.js", import.meta.url), "utf8");
  assert.match(source, /data-task-template-form/);
  assert.match(source, /services\.api\.saveTemplate/);
  assert.match(source, /services\.api\.savePublishingRule/);
  assert.match(source, /services\.api\.savePublishingOverride/);
});
