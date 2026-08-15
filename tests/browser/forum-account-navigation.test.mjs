import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const moduleUrl = new URL("../../forum/forum-events.js", import.meta.url);
const source = await fs.readFile(fileURLToPath(moduleUrl), "utf8");
const scriptUrl = new URL("../../script.js", import.meta.url);
const homepageScript = await fs.readFile(fileURLToPath(scriptUrl), "utf8");

test("the real forum controller synchronizes the shared authentication session", () => {
  assert.match(source, /data-forum-account-link/);
  assert.match(source, /onSessionChange/);
  assert.match(source, /getPublicUserIdentity/);
  assert.match(source, /已登录 ·/);
  assert.match(source, /登录 \/ 注册/);
  assert.doesNotMatch(source, /user\?\.email\?\.split\("@"\)\[0\]/);
  assert.match(source, /航线同学/);
  assert.match(source, /await runtime\(\)\?\.ready\?\.\(\);[\s\S]*?await syncAccount\(\);[\s\S]*?await loadCapabilities\(\)/);
  assert.match(source, /session\?\.user \|\| null/);
  assert.match(source, /await runtime\(\)\?\.ready\?\.\(\)/);
  assert.match(source, /requireAuthenticatedAction/);
});

test("forum boot does not paint a signed-out account before session readiness resolves", async () => {
  const attributes = new Map();
  const link = {
    textContent: "unchanged",
    dataset: {},
    setAttribute(name, value) { attributes.set(name, value); },
  };
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const context = {
    URLSearchParams,
    document: {
      body: { dataset: { forumPage: "" } },
      querySelector(selector) {
        return selector === "[data-forum-account-link]" ? link : null;
      },
      querySelectorAll() { return []; },
    },
    window: {
      MKJApp: {
        ready: () => ready,
        getCurrentUser: async () => ({ id: "ready-user", user_metadata: { display_name: "就绪用户" } }),
        getPublicUserIdentity: async () => ({ displayName: "就绪用户", role: "MEMBER" }),
        getCapabilities: async () => [],
        onSessionChange: () => () => {},
      },
    },
  };
  const executable = source
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replace(/^export \{[^}]+\};\r?\n?$/gm, "");

  vm.runInNewContext(`${executable}\nglobalThis.__forumReadyTest = { boot };`, context);
  const booting = context.__forumReadyTest.boot();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(link.textContent, "unchanged");

  resolveReady({ status: "signed-in" });
  await booting;
  assert.equal(link.textContent, "已登录 · 就绪用户 · 账户");
  assert.equal(attributes.get("aria-label"), "当前已登录：就绪用户，账户。打开我的账户");
});

test("the forum account link follows login and logout session changes without exposing email", async () => {
  const attributes = new Map();
  const link = {
    textContent: "",
    dataset: {},
    setAttribute(name, value) { attributes.set(name, value); },
  };
  let sessionListener;
  let currentUser = {
    id: "admin-user",
    email: "private-email@example.com",
    user_metadata: {},
  };
  const identities = new Map([
    ["admin-user", { displayName: "林同学", role: "ADMIN" }],
    ["member-user", null],
  ]);
  const context = {
    URLSearchParams,
    document: {
      body: { dataset: { forumPage: "" } },
      querySelector(selector) {
        return selector === "[data-forum-account-link]" ? link : null;
      },
      querySelectorAll() { return []; },
    },
    window: {
      MKJApp: {
        getCurrentUser: async () => currentUser,
        getPublicUserIdentity: async (userId) => {
          const identity = identities.get(userId);
          if (identity === null) throw new Error("Public profile unavailable");
          return identity;
        },
        getCapabilities: async () => [],
        onSessionChange(listener) {
          sessionListener = listener;
          return () => {};
        },
      },
    },
  };
  const executable = source
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replace(/^export \{[^}]+\};\r?\n?$/gm, "");

  vm.runInNewContext(`${executable}\nglobalThis.__forumAccountTest = { boot };`, context);
  await context.__forumAccountTest.boot();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(link.textContent, "已登录 · 林同学 · 管理员");
  assert.equal(link.dataset.forumAccountState, "signed-in");
  assert.match(attributes.get("aria-label"), /当前已登录：林同学，管理员/);
  assert.equal(typeof sessionListener, "function");

  sessionListener(null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(link.textContent, "登录 / 注册");
  assert.equal(link.dataset.forumAccountState, "signed-out");

  currentUser = { id: "member-user", email: "private-email@example.com", user_metadata: {} };
  sessionListener({ user: currentUser });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(link.textContent, "已登录 · 航线同学 · 账户");
  assert.doesNotMatch(link.textContent, /private-email/);
});

test("the homepage opens the account panel for the forum account route", () => {
  assert.match(homepageScript, /location\.hash === "#account"/);
});
