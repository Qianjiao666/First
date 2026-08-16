import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("task detail reserves consultation and participant collaboration regions", async () => {
  const html = await readFile(new URL("../detail/index.html", import.meta.url), "utf8");
  for (const marker of ["data-task-consultation", "data-task-collaboration", "data-task-member-list", "data-task-message-form", "data-task-peer-review-form", "data-task-creator-review-checklist"]) {
    assert.match(html, new RegExp(marker));
  }
});
