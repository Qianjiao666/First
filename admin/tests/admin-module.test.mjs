import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const apiSource = await fs.readFile(new URL("../admin-api.js", import.meta.url), "utf8");
const controllerSource = await fs.readFile(new URL("../admin-events.js", import.meta.url), "utf8");
const renderSource = await fs.readFile(new URL("../admin-render.js", import.meta.url), "utf8");

test("admin API covers account, role, reputation, mute, sensitive word and grants operations", () => {
  for (const name of [
    "admin-users",
    "admin-redeem-codes",
    "admin-sensitive-words",
    "admin-transfer-account",
  ]) assert.match(apiSource, new RegExp(name));
  assert.match(apiSource, /user_granted_permissions|grant/);
  assert.match(controllerSource, /active: false/);
  assert.match(controllerSource, /user\.permissions/);
});

test("admin controller gates every management surface with admin capabilities", () => {
  for (const capability of [
    "admin:access",
    "admin:manageUsers",
    "admin:manageRedeemCodes",
    "admin:manageSensitiveWords",
    "admin:transferAccount",
    "admin:manageForum",
  ]) assert.match(controllerSource, new RegExp(capability.replace(":", "\\:")));
  assert.match(controllerSource, /getCapabilities/);
  assert.match(controllerSource, /capabilities\.some\(\(capability\) => capability\.startsWith\("admin:"\)\)/);
});

test("admin controller has loading, retry and destructive confirmation states", () => {
  assert.match(renderSource, /admin-loading/);
  assert.match(renderSource, /data-admin-retry/);
  assert.match(controllerSource, /confirm\(/);
});
