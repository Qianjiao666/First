import { configureReputationBadge } from "/MKJ/assets/js/core/reputation.js";
import { createSessionCoordinator } from "/MKJ/assets/js/core/session-coordinator.js";

const config = window.SUPABASE_CONFIG || {};
const canCreateClient = Boolean(
  config.url && config.publishableKey && window.supabase?.createClient,
);
const client = canCreateClient
  ? window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  : null;

let capabilitiesCache = null;

function requireClient() {
  if (!client) throw new Error("账户服务暂未连接，请稍后重试。");
  return client;
}

function requestLogin(reason) {
  document.dispatchEvent(new CustomEvent("mkj:login-required", { detail: { reason } }));
}

const session = createSessionCoordinator({ client, openLogin: requestLogin });

async function getSession() {
  requireClient();
  const state = await session.ready();
  if (state.status === "expired") throw new Error(state.reason);
  if (state.status === "unavailable") throw new Error(state.reason);
  return state.session;
}

async function getCurrentUser() {
  requireClient();
  const state = await session.ready();
  return state.user;
}

async function getPublicUserIdentity(userId) {
  const activeClient = requireClient();
  const { data, error } = await activeClient
    .from("user_public_profiles")
    .select("user_id, display_name, role, reputation, avatar")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("无法读取用户公开资料。");
  if (!data) return null;

  return {
    userId: data.user_id,
    displayName: data.display_name,
    role: data.role,
    reputation: data.reputation,
    avatar: data.avatar,
  };
}

async function getCapabilities() {
  if (capabilitiesCache) return capabilitiesCache;

  const session = await getSession();
  if (!session) return [];

  const activeClient = requireClient();
  const { data, error } = await activeClient.rpc("get_user_capabilities");
  if (error) throw new Error("无法读取账户权限。");

  capabilitiesCache = Array.isArray(data) ? data : [];
  return capabilitiesCache;
}

async function invokeFunction(name, payload = {}, method = "POST") {
  const session = await getSession();
  if (!session) throw new Error("请先登录后再继续。");

  const response = await fetch(`${config.url}/functions/v1/${name}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: config.publishableKey,
      "content-type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message || "操作未完成，请稍后重试。";
    const error = new Error(message);
    error.code = result?.error?.code || "INTERNAL_ERROR";
    session.handleApiAuthFailure(error);
    throw error;
  }

  return result;
}

function onSessionChange(callback) {
  return session.subscribe((state) => {
    capabilitiesCache = null;
    callback(state.session);
  }, { immediate: false });
}

const runtime = {
  config,
  client,
  getSession,
  getCurrentUser,
  getPublicUserIdentity,
  getCapabilities,
  invokeFunction,
  onSessionChange,
  session,
  ready: session.ready,
  requireAuthenticatedAction: session.requireAuthenticatedAction,
  handleApiAuthFailure: session.handleApiAuthFailure,
};

configureReputationBadge({ loadPublicIdentity: getPublicUserIdentity });
window.MKJApp = runtime;
window.MKJSession = session;
