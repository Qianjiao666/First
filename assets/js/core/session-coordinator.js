const EXPIRED_MESSAGE = "登录已失效，请重新登录。";

function authError(message, code = "UNAUTHENTICATED") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function defaultBroadcastFactory() {
  if (typeof BroadcastChannel !== "function") return null;
  return new BroadcastChannel("mkj-session-v1");
}

export function createSessionCoordinator({
  client = null,
  broadcastFactory = defaultBroadcastFactory,
  openLogin = () => {},
  notify = () => {},
} = {}) {
  let state = Object.freeze({
    status: "checking",
    session: null,
    user: null,
    reason: null,
    revision: 0,
  });
  let generation = 0;
  const listeners = new Set();
  const channel = broadcastFactory?.() ?? null;
  channel?.unref?.();

  function publish(next, { broadcast = false } = {}) {
    state = Object.freeze({ ...next, revision: state.revision + 1 });
    for (const listener of listeners) listener(state);
    if (broadcast) {
      channel?.postMessage?.({
        type: "mkj-session-refresh",
        revision: state.revision,
        status: state.status,
      });
    }
    return state;
  }

  function stateForSession(session, reason = null) {
    return session?.user
      ? { status: "signed-in", session, user: session.user, reason }
      : { status: "signed-out", session: null, user: null, reason };
  }

  function acceptAuthEvent(event, session) {
    generation += 1;
    if (event === "SIGNED_OUT") {
      publish(stateForSession(null), { broadcast: true });
      return;
    }
    publish(stateForSession(session), { broadcast: true });
  }

  const authSubscription = client?.auth?.onAuthStateChange?.(acceptAuthEvent)
    ?.data?.subscription ?? null;

  const initialGeneration = generation;
  const readyPromise = (async () => {
    if (!client?.auth?.getSession) {
      if (generation === initialGeneration) {
        publish({
          status: "unavailable",
          session: null,
          user: null,
          reason: "账户服务暂未连接，请稍后重试。",
        });
      }
      return state;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (generation !== initialGeneration) return state;
      if (error) {
        publish({ status: "expired", session: null, user: null, reason: EXPIRED_MESSAGE });
      } else {
        publish(stateForSession(data?.session ?? null));
      }
    } catch {
      if (generation === initialGeneration) {
        publish({ status: "expired", session: null, user: null, reason: EXPIRED_MESSAGE });
      }
    }
    return state;
  })();

  async function refreshFromStorage() {
    if (!client?.auth?.getSession) return;
    const requestGeneration = ++generation;
    try {
      const { data, error } = await client.auth.getSession();
      if (requestGeneration !== generation) return;
      if (error) publish({ status: "expired", session: null, user: null, reason: EXPIRED_MESSAGE });
      else publish(stateForSession(data?.session ?? null));
    } catch {
      if (requestGeneration === generation) {
        publish({ status: "expired", session: null, user: null, reason: EXPIRED_MESSAGE });
      }
    }
  }

  if (channel) {
    channel.onmessage = (event) => {
      if (event?.data?.type === "mkj-session-refresh") void refreshFromStorage();
    };
  }

  async function requireAuthenticatedAction({ reason = "请先登录后再继续。" } = {}) {
    await readyPromise;
    if (state.status === "signed-in" && state.user) return state.user;
    openLogin(reason);
    throw authError(reason);
  }

  function handleApiAuthFailure(error) {
    if (error?.code !== "UNAUTHENTICATED") return false;
    generation += 1;
    publish({ status: "expired", session: null, user: null, reason: EXPIRED_MESSAGE }, { broadcast: true });
    notify(EXPIRED_MESSAGE);
    openLogin(EXPIRED_MESSAGE);
    return true;
  }

  function subscribe(listener, { immediate = true } = {}) {
    listeners.add(listener);
    if (immediate) listener(state);
    return () => listeners.delete(listener);
  }

  function destroy() {
    authSubscription?.unsubscribe?.();
    channel?.close?.();
    listeners.clear();
  }

  return Object.freeze({
    ready: async () => {
      await readyPromise;
      return state;
    },
    getState: () => state,
    subscribe,
    requireAuthenticatedAction,
    handleApiAuthFailure,
    refresh: refreshFromStorage,
    destroy,
  });
}

export { EXPIRED_MESSAGE };
