import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("task creation exposes server-resolved template and collaboration controls", async () => {
  const html = await readFile(new URL("../create/index.html", import.meta.url), "utf8");
  assert.match(html, /data-task-template-select/);
  assert.match(html, /name="taskMode"/);
  assert.match(html, /data-task-publishing-eligibility/);
});
