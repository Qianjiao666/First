const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runbook = fs.readFileSync(
  path.resolve(__dirname, "../../docs/COMMUNITY_RELEASE_RUNBOOK.md"),
  "utf8",
);

test("community runbook points to the current r7 artifacts", () => {
  assert.match(runbook, /static-r7\.zip/);
  assert.match(runbook, /backend-r7\.zip/);
  assert.doesNotMatch(runbook, /-r5\.zip/);
});

test("Linux manifest verification normalizes CRLF and hash case", () => {
  assert.match(runbook, /tr -d '\\r'/);
  assert.match(runbook, /tr '\[:upper:\]' '\[:lower:\]'/);
});
