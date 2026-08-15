import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PRODUCTION_PAGES } from "./production-pages.mjs";

const root = new URL("../../", import.meta.url);
const read = (relativePath) => fs.readFile(fileURLToPath(new URL(relativePath, root)), "utf8");

test("the shared shell mounts one learning-demo disclaimer on every production page", async () => {
  const source = await read("assets/js/core/app-shell.js");
  const styles = await read("assets/css/visual-v1.1.css");
  assert.match(source, /data-mkj-disclaimer/);
  assert.match(source, /本项目仅为学习演示Demo，请勿直接线上投入正式生产使用。/);
  assert.match(styles, /\.mkj-disclaimer-v11\s*\{/);
  for (const relativePath of PRODUCTION_PAGES) {
    const page = await read(relativePath);
    assert.match(page, /app-shell\.js\?v=20260812-v1\.1/);
  }
});

test("admin task rows expose stable labels for mobile reflow without changing values", async () => {
  const source = await read("assets/js/tasks/task-admin.js");
  assert.match(source, /cell\.dataset\.label\s*=\s*labels\[index\]/);
  assert.match(source, /actions\.dataset\.label\s*=\s*["']操作["']/);
  assert.match(await read("admin/tasks/index.html"), /class="[^"]*task-table[^"]*"/);
});

test("assessment answer transition stays within the documented visual timing", async () => {
  const source = await read("script.js");
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*?\}, 220\);/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => \{[\s\S]*?\}, 360\);/);
});

test("mobile task-table reflow is implemented in the v1.1 visual layer", async () => {
  const source = await read("assets/css/visual-v1.1.css");
  assert.match(source, /@media\s*\(max-width:\s*780px\)[\s\S]*?\.task-table\s*,\s*\.task-table\s+tbody/);
  assert.match(source, /td::before\s*\{[\s\S]*?content:\s*attr\(data-label\)/);
});
