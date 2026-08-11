import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const moduleUrl = new URL("../../assets/js/core/reputation.js", import.meta.url);
const source = await fs.readFile(fileURLToPath(moduleUrl), "utf8");
const reputation = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test("reputation badge logic reports the next threshold", () => {
  const info = reputation.getLevelInfo(499);

  assert.equal(info.current.title, "初级会员");
  assert.equal(info.next.title, "中级会员");
  assert.equal(info.remaining, 1);
  assert.equal(info.progress, 99);
});

test("reputation badge logic gives moderator title precedence", () => {
  assert.equal(reputation.getUserTitle("MODERATOR", 50000), "版主");
  assert.equal(reputation.getUserTitle("USER", 50000), "声望之神");
});
