import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const moduleUrl = new URL("../../assets/js/core/permissions.js", import.meta.url);
const source = await fs.readFile(fileURLToPath(moduleUrl), "utf8");
const permissions = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test("capability helper matches resource and action", () => {
  const capabilities = ["forum:createPost", "tasks:apply"];

  assert.equal(permissions.hasCapability(capabilities, "forum", "createPost"), true);
  assert.equal(permissions.hasCapability(capabilities, "forum", "deleteAnyPost"), false);
  assert.equal(permissions.hasCapability(capabilities, "tasks", "apply"), true);
});
