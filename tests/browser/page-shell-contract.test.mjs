import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PRODUCTION_PAGES } from "./production-pages.mjs";

const root = new URL("../../", import.meta.url);

test("the production page inventory is stable and unique", () => {
  assert.equal(PRODUCTION_PAGES.length, 20);
  assert.equal(new Set(PRODUCTION_PAGES).size, PRODUCTION_PAGES.length);
});

test("the homepage starts the v1.1 release with versioned shell assets", async () => {
  const source = await fs.readFile(fileURLToPath(new URL("index.html", root)), "utf8");
  assert.match(source, /styles\.css\?v=20260812-v1\.1/);
  assert.match(source, /assets\/css\/visual-v1\.css\?v=20260812-v1\.1/);
  assert.match(source, /assets\/js\/core\/runtime\.js\?v=20260812-v1\.1/);
  assert.match(source, /script\.js\?v=20260812-v1\.1/);
});

test("every production page loads the v1.1 runtime before the shared app shell", async () => {
  for (const relativePath of PRODUCTION_PAGES) {
    const source = await fs.readFile(fileURLToPath(new URL(relativePath, root)), "utf8");
    const runtime = '/MKJ/assets/js/core/runtime.js?v=20260812-v1.1';
    const shell = '/MKJ/assets/js/core/app-shell.js?v=20260812-v1.1';
    const runtimeIndex = source.indexOf(runtime);
    const shellIndex = source.indexOf(shell);

    assert.notEqual(runtimeIndex, -1, `${relativePath} is missing the versioned runtime`);
    assert.notEqual(shellIndex, -1, `${relativePath} is missing the versioned app shell`);
    assert.ok(runtimeIndex < shellIndex, `${relativePath} must load runtime before app shell`);
  }
});

test("production pages load the controllers that Task 4 adapts", async () => {
  const expectedControllers = new Map([
    ["forum/index.html", "/MKJ/forum/forum-events.js"],
    ["forum/c/index.html", "/MKJ/forum/forum-events.js"],
    ["forum/p/index.html", "/MKJ/forum/forum-events.js"],
    ["forum/new/index.html", "/MKJ/forum/forum-events.js"],
    ["tasks/create/index.html", "/MKJ/assets/js/tasks/task-create.js"],
    ["tasks/detail/index.html", "/MKJ/assets/js/tasks/task-detail.js"],
    ["tasks/my/index.html", "/MKJ/assets/js/tasks/task-my.js"],
    ["admin/tasks/index.html", "/MKJ/assets/js/tasks/task-admin.js"],
    ["admin/tasks/edit/index.html", "/MKJ/assets/js/tasks/task-admin.js"],
    ["admin/index.html", "/MKJ/admin/admin-events.js"],
    ["announcements/index.html", "/MKJ/announcements/announcements.js"],
    ["shop/index.html", "/MKJ/shop/shop.js"],
  ]);

  for (const [relativePath, controller] of expectedControllers) {
    const source = await fs.readFile(fileURLToPath(new URL(relativePath, root)), "utf8");
    assert.match(source, new RegExp(controller.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${relativePath} does not load ${controller}`);
  }
});

test("the shared shell owns the single disclaimer contract", async () => {
  const source = await fs.readFile(fileURLToPath(new URL("assets/js/core/app-shell.js", root)), "utf8");
  assert.match(source, /data-mkj-disclaimer/);
  assert.match(source, /本项目仅为学习演示Demo，请勿直接线上投入正式生产使用。/);
});
