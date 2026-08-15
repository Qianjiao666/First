const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runbook = fs.readFileSync(
  path.resolve(__dirname, "../../docs/COMMUNITY_RELEASE_RUNBOOK.md"),
  "utf8",
);

test("community runbook points only to the v1.1 artifacts", () => {
  assert.match(runbook, /20260812-static-v1\.1\.zip/);
  assert.match(runbook, /20260812-backend-v1\.1\.zip/);
  assert.doesNotMatch(runbook, /-(?:r[0-9.]+|v1\.0)\.zip/);
});

test("Linux manifest verification normalizes CRLF and hash case", () => {
  assert.match(runbook, /tr -d '\\r'/);
  assert.match(runbook, /tr '\[:upper:\]' '\[:lower:\]'/);
});

test("v1.1 backend gates name Secrets without values and verify avatar RLS and real IMS", () => {
  for (const secret of [
    "TENCENTCLOUD_SECRET_ID",
    "TENCENTCLOUD_SECRET_KEY",
    "TENCENT_IMS_BIZ_TYPE",
  ]) assert.match(runbook, new RegExp(secret));
  assert.match(runbook, /20260812_v1_1_avatar\.sql/);
  assert.match(runbook, /avatar-upload/);
  assert.match(runbook, /Suggestion[^\n]*Pass|Pass[^\n]*Suggestion/i);
  assert.match(runbook, /(?:Review|Block)[^\n]*(?:no object|不创建|无对象)|(?:no object|不创建|无对象)[^\n]*(?:Review|Block)/i);
  assert.match(runbook, /anon[^\n]*(?:insert|update|delete)[^\n]*(?:false|拒绝)/i);
  assert.doesNotMatch(runbook, /TENCENTCLOUD_SECRET_(?:ID|KEY)\s*=\s*[^<\s`]/);
});
