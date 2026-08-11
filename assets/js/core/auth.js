export async function requireSession() {
  const session = await window.MKJApp?.getSession?.();
  if (!session) throw new Error("请先登录后再继续。");
  return session;
}

export async function getCurrentUser() {
  return window.MKJApp?.getCurrentUser?.() ?? null;
}

export function onSessionChange(callback) {
  return window.MKJApp?.onSessionChange?.(callback) ?? (() => {});
}
