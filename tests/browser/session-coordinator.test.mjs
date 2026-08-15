import test from "node:test";
import assert from "node:assert/strict";

import { createSessionCoordinator } from "../../assets/js/core/session-coordinator.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeClient(initialSession) {
  let authListener = null;
  return {
    auth: {
      getSession: () => initialSession.promise,
      onAuthStateChange(listener) {
        authListener = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    emit(event, session) { authListener?.(event, session); },
  };
}

test("ready waits for the initial Supabase session result", async () => {
  const initial = deferred();
  const coordinator = createSessionCoordinator({ client: fakeClient(initial) });
  let resolved = false;
  coordinator.ready().then(() => { resolved = true; });

  await Promise.resolve();
  assert.equal(resolved, false);
  assert.equal(coordinator.getState().status, "checking");

  initial.resolve({ data: { session: null }, error: null });
  const state = await coordinator.ready();
  assert.equal(state.status, "signed-out");
});

test("a newer auth event wins over a stale initial session lookup", async () => {
  const initial = deferred();
  const client = fakeClient(initial);
  const coordinator = createSessionCoordinator({ client });
  const freshSession = { access_token: "fresh-token", user: { id: "new-user" } };

  client.emit("SIGNED_IN", freshSession);
  initial.resolve({ data: { session: null }, error: null });
  await coordinator.ready();

  assert.equal(coordinator.getState().status, "signed-in");
  assert.equal(coordinator.getState().user.id, "new-user");
});

test("ready returns the latest state after a later auth event", async () => {
  const initial = deferred();
  const client = fakeClient(initial);
  const coordinator = createSessionCoordinator({ client });
  initial.resolve({ data: { session: null }, error: null });
  await coordinator.ready();

  client.emit("SIGNED_IN", { user: { id: "user-after-ready" } });

  const state = await coordinator.ready();
  assert.equal(state.status, "signed-in");
  assert.equal(state.user.id, "user-after-ready");
});

test("cross-tab broadcasts contain status metadata but never session tokens", async () => {
  const initial = deferred();
  const messages = [];
  const channel = { postMessage(value) { messages.push(value); }, close() {} };
  const client = fakeClient(initial);
  const coordinator = createSessionCoordinator({
    client,
    broadcastFactory: () => channel,
  });
  initial.resolve({ data: { session: null }, error: null });
  await coordinator.ready();

  client.emit("SIGNED_IN", {
    access_token: "must-not-leak",
    refresh_token: "must-not-leak-either",
    user: { id: "user-1" },
  });

  const serialized = JSON.stringify(messages);
  assert.match(serialized, /mkj-session-refresh/);
  assert.doesNotMatch(serialized, /must-not-leak|access_token|refresh_token/);
});

test("UNAUTHENTICATED failures expire the session and expose a re-login action", async () => {
  const initial = deferred();
  const opened = [];
  const notices = [];
  const coordinator = createSessionCoordinator({
    client: fakeClient(initial),
    openLogin: (reason) => opened.push(reason),
    notify: (message) => notices.push(message),
  });
  initial.resolve({ data: { session: { user: { id: "user-1" } } }, error: null });
  await coordinator.ready();

  const handled = coordinator.handleApiAuthFailure({ code: "UNAUTHENTICATED" });

  assert.equal(handled, true);
  assert.equal(coordinator.getState().status, "expired");
  assert.equal(coordinator.getState().reason, "登录已失效，请重新登录。");
  assert.deepEqual(opened, ["登录已失效，请重新登录。"]);
  assert.deepEqual(notices, ["登录已失效，请重新登录。"]);
});

test("protected actions open login instead of throwing a raw page error", async () => {
  const initial = deferred();
  const opened = [];
  const coordinator = createSessionCoordinator({
    client: fakeClient(initial),
    openLogin: (reason) => opened.push(reason),
  });
  initial.resolve({ data: { session: null }, error: null });
  await coordinator.ready();

  await assert.rejects(
    () => coordinator.requireAuthenticatedAction({ reason: "发布帖子" }),
    (error) => error.code === "UNAUTHENTICATED",
  );
  assert.deepEqual(opened, ["发布帖子"]);
});
