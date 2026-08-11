import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const index = await fs.readFile(fileURLToPath(new URL("index.html", root)), "utf8");
const styles = await fs.readFile(fileURLToPath(new URL("styles.css", root)), "utf8");

test("the homepage changelog identifies the current community release", () => {
  assert.match(index, /2026\.08\.11 · v0\.6/);
  assert.match(index, /社区、论坛与任务协作上线/);
});

test("the changelog label remains visible outside the mobile navigation", () => {
  assert.match(styles, /\.mkj-log-button b\{display:inline(?:-flex)?/);
});
