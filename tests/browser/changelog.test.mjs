import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const index = await fs.readFile(fileURLToPath(new URL("index.html", root)), "utf8");
const styles = await fs.readFile(fileURLToPath(new URL("styles.css", root)), "utf8");
const changelog = await fs.readFile(fileURLToPath(new URL("CHANGELOG.md", root)), "utf8");

test("CHANGELOG versions are continuous and never use three-part releases", () => {
  const versions = [...changelog.matchAll(/^## (v\d+\.\d+)$/gm)].map((match) => match[1]);
  assert.deepEqual(versions, ["v0.1","v0.2","v0.3","v0.4","v0.5","v0.6","v0.7","v0.8","v0.9","v1.0","v1.1","v1.2"]);
  assert.doesNotMatch(changelog, /v\d+\.\d+\.\d+/);
});

test("the homepage changelog uses public semantic versions and preserves the release history", () => {
  const v12 = index.indexOf("<time>2026.08.14 · v1.2</time>");
  const v11 = index.indexOf("<time>2026.08.12 · v1.1</time>");
  const v10 = index.indexOf("<time>2026.08.12 · v1.0</time>");
  const v09 = index.indexOf("<time>2026.08.12 · v0.9</time>");
  const v08 = index.indexOf("<time>2026.08.11 · v0.8</time>");
  const v07 = index.indexOf("<time>2026.08.11 · v0.7</time>");
  const v06 = index.indexOf("<time>2026.08.11 · v0.6</time>");
  assert.ok(v12 >= 0);
  assert.ok(v11 > v12);
  assert.ok(v10 > v11);
  assert.ok(v09 > v10);
  assert.ok(v08 > v09);
  assert.ok(v07 > v08);
  assert.ok(v06 > v07);
  assert.match(index, /当前 v1\.2/);
  assert.doesNotMatch(index, /更新日志[^<]*·\s*r\d|<time>[^<]*·\s*r\d/);
  assert.match(index, /任务协作与仲裁流程增强/);
  assert.match(index, /全站视觉系统升级/);
  assert.match(index, /发布矩阵与视觉规范准备/);
  assert.match(index, /账户状态与版本辨识优化/);
  assert.match(index, /社区能力与任务协作完整上线/);
});

test("the changelog label remains visible outside the mobile navigation", () => {
  assert.match(styles, /\.mkj-log-button b\{display:inline(?:-flex)?/);
});

test("the homepage versions its updated shell assets", () => {
  assert.match(index, /styles\.css\?v=20260814-v1\.2/);
  assert.match(index, /assets\/css\/visual-v1\.css\?v=20260814-v1\.2/);
  assert.match(index, /assets\/js\/core\/runtime\.js\?v=20260814-v1\.2/);
  assert.match(index, /script\.js\?v=20260814-v1\.2/);
});

test("the homepage keeps a visible learning-demo disclaimer", () => {
  assert.match(index, /data-mkj-disclaimer/);
  assert.match(index, /学习演示免责声明/);
  assert.match(index, /请勿提交真实敏感身份信息/);
  assert.match(styles, /\.mkj-footer-disclaimer\{/);
});
