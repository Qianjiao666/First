import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), "utf8");
}

test("public task routes expose the expected page shells", async () => {
  const pages = await Promise.all([
    read("tasks/index.html"),
    read("tasks/detail/index.html"),
    read("tasks/my/index.html"),
  ]);

  for (const html of pages) {
    assert.match(html, /assets\/css\/tasks\.css/);
    assert.match(html, /rel="icon" href="data:,"/);
    assert.match(html, /class="task-/);
    assert.match(html, /data-task-reputation-badge/);
    assert.match(html, /assets\/vendor\/supabase-2\.111\.0\.js/);
    assert.match(html, /assets\/js\/core\/runtime\.js/);
    assert.match(html, /assets\/js\/core\/task-integration\.js/);
    assert.doesNotMatch(html, /<script[^>]+forum/i);
  }
});

test("task creation route exposes capability-gated taxonomy and attachment controls", async () => {
  const [html, controller] = await Promise.all([
    read("tasks/create/index.html"),
    read("assets/js/tasks/task-create.js"),
  ]);
  assert.match(html, /data-task-create-form/);
  assert.match(html, /data-task-category-select/);
  assert.match(html, /data-task-subcategory-select/);
  assert.match(html, /type="file"[^>]+accept="[^"]*(?:image|video)/);
  assert.match(html, /data-task-attachment-input/);
  assert.match(controller, /hasTaskCapability/);
  assert.match(controller, /task:create/);
  assert.match(controller, /attachmentMetadata/);
});

test("admin task routes stay inside the assigned module", async () => {
  const index = await read("admin/tasks/index.html");
  const edit = await read("admin/tasks/edit/index.html");

  assert.match(index, /data-task-admin-list/);
  assert.match(edit, /id="task-editor-form"/);
  assert.match(index, /data-task-admin-write/);
  assert.match(edit, /data-task-admin-write/);
  assert.match(index, /data-task-category-form/);
  assert.match(index, /data-task-review-form/);
  assert.match(index, /rel="icon" href="data:,"/);
  assert.match(edit, /rel="icon" href="data:,"/);
    assert.match(index, /assets\/js\/tasks\/task-admin\.js/);
    assert.match(edit, /assets\/js\/tasks\/task-admin\.js/);
    assert.match(index, /assets\/js\/core\/task-integration\.js/);
    assert.match(edit, /assets\/js\/core\/task-integration\.js/);
});

test("task styles include keyboard focus and responsive layout guards", async () => {
  const css = await read("assets/css/tasks.css");

  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /task-pagination-button/);
});
