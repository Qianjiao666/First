import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

test("homepage exposes v1.2 consistently in its changelog entry point", async () => {
  const html = await read("index.html");
  assert.match(html, /id="mkj-log-button"[^>]*title="查看产品更新日志（当前 v1\.2）"/);
  assert.match(html, /id="mkj-log-button"[^>]*aria-label="查看产品更新日志（当前 v1\.2）"/);
  assert.match(html, /<b>更新日志 · v1\.2<\/b>/);
  const entries = [...html.matchAll(/<article class="mkj-changelog-entry"><time>[^<]+ · (v\d+\.\d+)<\/time>/g)].map((match) => match[1]);
  assert.equal(entries[0], "v1.2");
});

test("CHANGELOG is ordered newest to oldest and starts at v1.2", async () => {
  const changelog = await read("CHANGELOG.md");
  const versions = [...changelog.matchAll(/^## (v\d+\.\d+)$/gm)].map((match) => match[1]);
  assert.deepEqual(versions, ["v1.2","v1.1","v1.0","v0.9","v0.8","v0.7","v0.6","v0.5","v0.4","v0.3","v0.2","v0.1"]);
});

test("visual asset alternatives are valid Chinese and never mojibake", async () => {
  const source = await read("assets/js/ui/visual-assets.js");
  for (const text of ["抽象科技网格背景", "社区交流氛围插图", "任务进度辅助插图", "个人中心背景插图"]) {
    assert.match(source, new RegExp(text));
  }
  assert.doesNotMatch(source, /[鎶绉妧缃鏍鑳櫙]/);
});
