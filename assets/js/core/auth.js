export async function requireSession() {
  const session = await window.MKJApp?.getSession?.();
  if (!session) throw new Error("请先登录后再继续。");
  return session;
}

export async function requireAuthenticatedAction(options) {
  if (window.MKJApp?.requireAuthenticatedAction) {
    return window.MKJApp.requireAuthenticatedAction(options);
  }
  const session = await requireSession();
  return session.user;
}

export async function getCurrentUser() {
  return window.MKJApp?.getCurrentUser?.() ?? null;
}

export function onSessionChange(callback) {
  return window.MKJApp?.onSessionChange?.(callback) ?? (() => {});
}
