import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const moduleUrl = new URL("../../assets/js/core/app-shell.js", import.meta.url);

test("the native login dialog does not nest a second dialog role", async () => {
  const source = await fs.readFile(moduleUrl, "utf8");
  assert.doesNotMatch(source, /dialog\.setAttribute\("role", "dialog"\)/);
  assert.doesNotMatch(source, /dialog\.setAttribute\("aria-modal", "true"\)/);
});

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test("the app shell waits for confirmed session state before painting account slots", async () => {
  const { mountAppShell } = await import(moduleUrl);
  const initial = deferred();
  const slot = { dataset: {}, textContent: "unchanged", setAttribute() {} };
  const listeners = new Map();
  const documentRef = {
    body: { append() {} },
    querySelector: () => null,
    querySelectorAll: (selector) => selector === "[data-mkj-session-state]" ? [slot] : [],
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener() {},
    createElement() { throw new Error("login prompt should not mount in this test"); },
  };
  let sessionListener;
  const session = {
    ready: () => initial.promise,
    subscribe(listener) { sessionListener = listener; return () => {}; },
  };

  const mounting = mountAppShell({ documentRef, locationRef: { pathname: "/MKJ/" }, session });
  await Promise.resolve();
  assert.equal(slot.textContent, "unchanged");

  initial.resolve({ status: "signed-out", user: null, reason: null });
  const shell = await mounting;
  assert.equal(slot.dataset.mkjSessionState, "signed-out");
  assert.equal(slot.textContent, "登录 / 注册");

  sessionListener({ status: "expired", user: null, reason: "登录已失效，请重新登录。" });
  assert.equal(slot.textContent, "登录已失效，请重新登录。");
  shell.destroy();
});

test("a protected-action event opens login UI without replacing page content", async () => {
  const { mountAppShell } = await import(moduleUrl);
  const listeners = new Map();
  const main = { textContent: "public forum remains visible" };
  let opened = false;
  const prompt = {
    hidden: true,
    open: false,
    dataset: {},
    querySelector: () => ({ textContent: "" }),
    addEventListener() {},
    setAttribute() {},
    showModal() { opened = true; this.open = true; this.hidden = false; },
  };
  const documentRef = {
    body: { append() {} },
    querySelector(selector) {
      if (selector === "main") return main;
      if (selector === "[data-mkj-login-prompt]") return prompt;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener() {},
  };
  const session = {
    ready: async () => ({ status: "signed-out", user: null, reason: null }),
    subscribe: () => () => {},
  };

  await mountAppShell({ documentRef, locationRef: { pathname: "/MKJ/forum/" }, session });
  listeners.get("mkj:login-required")({ detail: { reason: "发布帖子" } });

  assert.equal(prompt.hidden, false);
  assert.equal(opened, true);
  assert.equal(main.textContent, "public forum remains visible");
});
