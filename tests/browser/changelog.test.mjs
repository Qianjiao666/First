import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const index = await fs.readFile(fileURLToPath(new URL("index.html", root)), "utf8");
const styles = await fs.readFile(fileURLToPath(new URL("styles.css", root)), "utf8");

test("the homepage changelog identifies r8.1 and preserves the release history", () => {
  const r81 = index.indexOf("<time>2026.08.11 · r8.1</time>");
  const r8 = index.indexOf("<time>2026.08.11 · r8</time>");
  const v06 = index.indexOf("<time>2026.08.11 · v0.6</time>");
  assert.ok(r81 >= 0);
  assert.ok(r8 > r81);
  assert.ok(v06 > r8);
  assert.match(index, /当前 r8\.1/);
  assert.match(index, /账户状态与版本辨识优化/);
  assert.match(index, /社区能力与任务协作完整上线/);
});

test("the changelog label remains visible outside the mobile navigation", () => {
  assert.match(styles, /\.mkj-log-button b\{display:inline(?:-flex)?/);
});

test("the homepage versions its updated shell assets", () => {
  assert.match(index, /styles\.css\?v=20260811-r8\.1/);
  assert.match(index, /assets\/js\/core\/runtime\.js\?v=20260811-r8\.1/);
  assert.match(index, /script\.js\?v=20260811-r8\.1/);
});
