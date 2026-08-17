import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const index = await fs.readFile(new URL("index.html", root), "utf8");
const styles = await fs.readFile(new URL("styles.css", root), "utf8");
const changelog = await fs.readFile(new URL("CHANGELOG.md", root), "utf8");

test("CHANGELOG versions are continuous, newest first, and never three-part", () => {
  const versions = [...changelog.matchAll(/^## (v\d+\.\d+)$/gm)].map((match) => match[1]);
  assert.deepEqual(versions, ["v1.5", "v1.4", "v1.3", "v1.2", "v1.1", "v1.0", "v0.9", "v0.8", "v0.7", "v0.6", "v0.5", "v0.4", "v0.3", "v0.2", "v0.1"]);
  assert.doesNotMatch(changelog, /v\d+\.\d+\.\d+/);
});

test("the homepage changelog uses public semantic versions and preserves release history", () => {
  const versions = [...index.matchAll(/<time>[^<]+ · (v\d+\.\d+)<\/time>/g)].map((match) => match[1]);
  assert.equal(versions[0], "v1.5");
  assert.deepEqual(versions.slice(0, 6), ["v1.5", "v1.4", "v1.3", "v1.2", "v1.1", "v1.0"]);
  assert.match(index, /当前 v1\.5/);
  assert.doesNotMatch(index, /更新日志[^<]*·\s*r\d|<time>[^<]*·\s*r\d/);
});

test("the changelog label remains visible outside mobile navigation", () => {
  assert.match(styles, /\.mkj-log-button b\{display:inline(?:-flex)?/);
});

test("the homepage keeps its versioned shell assets", () => {
  assert.match(index, /styles\.css\?v=20260812-v1\.1/);
  assert.match(index, /assets\/css\/visual-v1\.css\?v=20260812-v1\.1/);
  assert.match(index, /assets\/js\/core\/runtime\.js\?v=20260812-v1\.1/);
  assert.match(index, /script\.js\?v=20260812-v1\.1/);
});
