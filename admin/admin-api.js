function app() {
  const value = window.MKJApp;
  if (!value?.invokeFunction) throw new Error("Admin service is unavailable. Please retry.");
  return value;
}

function invoke(name, payload) {
  return app().invokeFunction(name, payload);
}

export const adminUsers = (payload) => invoke("admin-users", payload);
export const adminSensitiveWords = (payload) => invoke("admin-sensitive-words", payload);
export const transferAccount = (payload) => invoke("admin-transfer-account", payload);
export const moderateForum = (payload) => invoke("forum-moderation", payload);

export function normalizeGrantPayload(payload = {}) {
  const grantPermission = typeof payload.grantPermission === "string" ? payload.grantPermission.trim() : "";
  const grantPermissions = Array.isArray(payload.grantPermissions)
    ? payload.grantPermissions.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
    : grantPermission ? [grantPermission] : [];
  const rewardRole = ["USER", "MODERATOR"].includes(payload.rewardRole) ? payload.rewardRole : null;
  return { ...payload, rewardRole, grantPermissions };
}

export const adminRedeemCodes = (payload) => invoke("admin-redeem-codes", normalizeGrantPayload(payload));
export const adminGrantPermission = (payload) => adminUsers({ action: "setPermission", ...normalizeGrantPayload(payload) });
export const redeemCode = (code) => invoke("redeem", { code: String(code || "").trim().toUpperCase() });
