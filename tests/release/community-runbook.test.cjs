const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runbook = fs.readFileSync(
  path.resolve(__dirname, "../../docs/COMMUNITY_RELEASE_RUNBOOK.md"),
  "utf8",
);

test("community runbook points only to the v1.3 artifacts", () => {
  assert.match(runbook, /20260816-static-v1\.3\.zip/);
  assert.match(runbook, /20260816-backend-v1\.3\.zip/);
  assert.doesNotMatch(runbook, /-(?:r[0-9.]+|v1\.[012])\.zip/);
});

test("Linux manifest verification normalizes CRLF and hash case", () => {
  assert.match(runbook, /strip `\\r`/);
  assert.match(runbook, /normalize the expected hash to lowercase/i);
});

test("v1.3 backend gates cover collaboration migration, isolation, audit, and no-finance flows", () => {
  assert.match(runbook, /20260815_collaborative_task_market\.sql/);
  assert.match(runbook, /task-collaboration/);
  assert.match(runbook, /non-member cannot read/i);
  assert.match(runbook, /get_task_collaboration_admin/);
  assert.match(runbook, /empty reason/i);
  assert.match(runbook, /price.*payment.*wallet.*refund.*payout/i);
});
