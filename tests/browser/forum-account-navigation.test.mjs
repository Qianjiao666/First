import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const moduleUrl = new URL("../../assets/js/forum/forum-events.js", import.meta.url);
const source = await fs.readFile(fileURLToPath(moduleUrl), "utf8");
const scriptUrl = new URL("../../script.js", import.meta.url);
const homepageScript = await fs.readFile(fileURLToPath(scriptUrl), "utf8");

test("forum account navigation reflects the shared authentication session", () => {
  assert.match(source, /data-forum-account-link/);
  assert.match(source, /onSessionChange/);
  assert.match(source, /已登录/);
  assert.match(source, /登录 \/ 注册/);
  assert.doesNotMatch(source, /syncForumAccountNavigation\(user = await/);
});

test("the homepage opens the account panel for the forum account route", () => {
  assert.match(homepageScript, /location\.hash === "#account"/);
});
