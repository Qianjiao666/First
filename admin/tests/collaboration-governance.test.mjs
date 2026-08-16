import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("task governance page exposes template, publishing-rule and override forms", async () => {
  const html = await readFile(new URL("../tasks/index.html", import.meta.url), "utf8");
  assert.match(html, /data-task-template-form/);
  assert.match(html, /data-task-publishing-rule-form/);
  assert.match(html, /data-task-publishing-override-form/);
});
