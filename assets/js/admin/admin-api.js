function invoke(name, payload) {
  const caller = window.MKJApp?.invokeFunction;
  if (!caller) throw new Error("账户服务暂未连接，请稍后重试。");
  return caller(name, payload);
}

export const adminUsers = (payload) => invoke("admin-users", payload);
export const adminRedeemCodes = (payload) => invoke("admin-redeem-codes", payload);
export const adminSensitiveWords = (payload) => invoke("admin-sensitive-words", payload);
export const transferAccount = (payload) => invoke("admin-transfer-account", payload);
export const moderateForum = (payload) => invoke("forum-moderation", payload);
