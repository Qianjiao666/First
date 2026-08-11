import { adminRedeemCodes, adminSensitiveWords, adminUsers, moderateForum, transferAccount } from "/MKJ/assets/js/admin/admin-api.js";
import { element, formatTime, renderNav, renderRows, showPanel } from "/MKJ/assets/js/admin/admin-render.js";

const page = document.body.dataset.adminPage;
let capabilities = [];
let userPage = 1;
let userRows = [];

function can(capability) {
  return capabilities.includes(capability);
}

function content() {
  return document.querySelector("[data-admin-content]");
}

function status(message, isError = false) {
  const target = document.querySelector("[data-admin-status]");
  if (!target) return;
  target.hidden = false;
  target.textContent = message;
  target.dataset.state = isError ? "error" : "success";
}

function clearStatus() {
  const target = document.querySelector("[data-admin-status]");
  if (target) target.hidden = true;
}

function showFailure(error) {
  status(error?.message || "操作未完成，请稍后重试。", true);
}

async function loadUsers({ append = false } = {}) {
  if (!append) {
    userPage = 1;
    userRows = [];
  }
  const result = await adminUsers({ action: "list", page: userPage });
  userRows = append ? [...userRows, ...(result.users || [])] : result.users || [];
  const container = document.querySelector("[data-admin-table]");
  renderRows(container, [
    { label: "用户", value: (user) => `${user.display_name}\n${user.user_id}` },
    { label: "角色", value: "role" },
    { label: "全局声望", value: (user) => String(user.reputation) },
    { label: "禁言状态", value: (user) => formatTime(user.muted_until) },
    { label: "操作", value: (user) => userAction(user) },
  ], userRows);
  const loadMore = document.querySelector("[data-admin-load-more]");
  if (loadMore) {
    loadMore.hidden = !result.hasMore;
    loadMore.disabled = false;
  }
}

function userAction(user) {
  const wrapper = element("div", "admin-row-actions");
  const role = document.createElement("select");
  ["USER", "MODERATOR", "ADMIN"].forEach((value) => {
    const option = new Option(value, value, false, value === user.role);
    role.append(option);
  });
  const saveRole = element("button", "admin-icon-button", "保存");
  saveRole.type = "button";
  saveRole.addEventListener("click", async () => {
    if (!confirm(`将 ${user.display_name} 的角色改为 ${role.value}？`)) return;
    try {
      await adminUsers({ action: "setRole", userId: user.user_id, role: role.value });
      status("角色已更新。");
      await loadUsers();
    } catch (error) { showFailure(error); }
  });
  const mute = element("button", "admin-icon-button", user.muted_until ? "解禁" : "禁言 24h");
  mute.type = "button";
  mute.addEventListener("click", async () => {
    try {
      await adminUsers({ action: "setMute", userId: user.user_id, mutedUntil: user.muted_until ? null : new Date(Date.now() + 86_400_000).toISOString() });
      status(user.muted_until ? "用户已解禁。" : "用户已禁言 24 小时。");
      await loadUsers();
    } catch (error) { showFailure(error); }
  });
  wrapper.append(role, saveRole, mute);
  return wrapper;
}

async function bootstrapUsers() {
  if (!can("admin:manageUsers")) return showPanel(content(), "无权查看用户管理", "此页面仅对管理员开放。");
  const loadMore = document.querySelector("[data-admin-load-more]");
  loadMore?.addEventListener("click", async () => {
    loadMore.disabled = true;
    userPage += 1;
    try {
      await loadUsers({ append: true });
    } catch (error) {
      userPage -= 1;
      loadMore.disabled = false;
      showFailure(error);
    }
  });
  const form = document.querySelector("[data-admin-reputation-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    clearStatus();
    try {
      await adminUsers({ action: "adjustReputation", userId: data.get("userId"), amount: Number(data.get("amount")), reason: data.get("reason"), eventKey: `admin:${crypto.randomUUID()}` });
      status("声望已通过全局账本调整。");
      form.reset();
      await loadUsers();
    } catch (error) { showFailure(error); }
  });
  await loadUsers();
}

async function loadRedeemCodes() {
  const result = await adminRedeemCodes({ action: "list" });
  renderRows(document.querySelector("[data-admin-table]"), [
    { label: "礼包码", value: "code" },
    { label: "奖励", value: (code) => `+${code.reward_reputation} 声望` },
    { label: "使用", value: (code) => `${code.current_uses} / ${code.max_uses}` },
    { label: "失效", value: (code) => formatTime(code.expires_at) },
    { label: "状态", value: (code) => redeemAction(code) },
  ], result.codes || []);
}

function redeemAction(code) {
  const button = element("button", "admin-icon-button", code.is_active ? "停用" : "启用");
  button.type = "button";
  button.addEventListener("click", async () => {
    try {
      await adminRedeemCodes({ action: "setActive", id: code.id, isActive: !code.is_active });
      status(code.is_active ? "礼包码已停用。" : "礼包码已启用。");
      await loadRedeemCodes();
    } catch (error) { showFailure(error); }
  });
  return button;
}

async function bootstrapRedeem() {
  if (!can("admin:manageRedeemCodes")) return showPanel(content(), "无权管理礼包码", "此页面仅对管理员开放。");
  const form = document.querySelector("[data-admin-redeem-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const result = await adminRedeemCodes({ action: "create", quantity: Number(data.get("quantity")), rewardReputation: Number(data.get("rewardReputation")), maxUses: Number(data.get("maxUses")), expiresAt: data.get("expiresAt") || null, rewardTitle: data.get("rewardTitle") || null });
      status(`已生成 ${result.codes.length} 个礼包码，仅在本次页面中显示。`);
      form.reset();
      await loadRedeemCodes();
    } catch (error) { showFailure(error); }
  });
  await loadRedeemCodes();
}

async function loadSensitiveWords() {
  const result = await adminSensitiveWords({ action: "list" });
  renderRows(document.querySelector("[data-admin-table]"), [
    { label: "敏感词", value: "word" },
    { label: "处理等级", value: "level" },
    { label: "添加时间", value: (word) => formatTime(word.created_at) },
    { label: "操作", value: (word) => wordAction(word) },
  ], result.words || []);
}

function wordAction(word) {
  const button = element("button", "admin-icon-button admin-danger-button", "删除");
  button.type = "button";
  button.addEventListener("click", async () => {
    if (!confirm(`删除敏感词“${word.word}”？`)) return;
    try {
      await adminSensitiveWords({ action: "delete", id: word.id });
      status("敏感词已删除。");
      await loadSensitiveWords();
    } catch (error) { showFailure(error); }
  });
  return button;
}

async function bootstrapSensitive() {
  if (!can("admin:manageSensitiveWords")) return showPanel(content(), "无权管理敏感词", "此页面仅对管理员开放。");
  const form = document.querySelector("[data-admin-sensitive-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await adminSensitiveWords({ action: "create", word: data.get("word"), level: data.get("level") });
      status("敏感词已加入全局过滤规则。");
      form.reset();
      await loadSensitiveWords();
    } catch (error) { showFailure(error); }
  });
  await loadSensitiveWords();
}

async function bootstrapTransfer() {
  if (!can("admin:transferAccount")) return showPanel(content(), "无权转移账号数据", "此页面仅对管理员开放。");
  const form = document.querySelector("[data-admin-transfer-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (!confirm("这会转移论坛内容与全局声望，且不可撤销。确认继续？")) return;
    try {
      const result = await transferAccount({ fromUserId: data.get("fromUserId"), toUserId: data.get("toUserId") });
      status(`转移已记录：${result.transfer?.reputation_transferred ?? 0} 声望。`);
      form.reset();
    } catch (error) { showFailure(error); }
  });
}

function forumPostAction(post) {
  const wrapper = element("div", "admin-row-actions");
  const actions = [
    { label: post.is_pinned ? "取消置顶" : "置顶", action: post.is_pinned ? "UNPIN" : "PIN" },
    { label: post.is_locked ? "解锁" : "锁定", action: post.is_locked ? "UNLOCK" : "LOCK" },
    { label: "删除", action: "DELETE", danger: true },
  ];

  actions.forEach(({ label, action, danger }) => {
    const button = element("button", `admin-icon-button${danger ? " admin-danger-button" : ""}`, label);
    button.type = "button";
    button.addEventListener("click", async () => {
      if (action === "DELETE" && !confirm(`删除帖子“${post.title}”？`)) return;
      button.disabled = true;
      try {
        await moderateForum({ target: "post", targetId: post.id, action });
        status("论坛管理操作已完成。");
        await loadForumPosts();
      } catch (error) {
        button.disabled = false;
        showFailure(error);
      }
    });
    wrapper.append(button);
  });
  return wrapper;
}

async function loadForumPosts() {
  const client = window.MKJApp?.client;
  if (!client) throw new Error("社区服务暂未连接，请稍后重试。");
  const { data, error } = await client
    .from("forum_posts")
    .select("id, title, is_pinned, is_locked, score, comment_count, created_at")
    .eq("status", "PUBLISHED")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("无法读取论坛帖子列表。");

  renderRows(document.querySelector("[data-admin-forum-table]"), [
    { label: "帖子", value: (post) => `${post.title}\n${post.id}` },
    { label: "分数", value: (post) => String(post.score ?? 0) },
    { label: "评论", value: (post) => String(post.comment_count ?? 0) },
    { label: "发布时间", value: (post) => formatTime(post.created_at) },
    { label: "操作", value: (post) => forumPostAction(post) },
  ], data || []);
}

async function bootstrapForum() {
  if (!can("admin:manageForum")) return showPanel(content(), "无权管理论坛", "此页面仅对版主和管理员开放。");
  const form = document.querySelector("[data-admin-forum-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await moderateForum({ target: data.get("target"), targetId: data.get("targetId"), action: data.get("action") });
      status("论坛管理操作已完成。");
      form.reset();
      await loadForumPosts();
    } catch (error) { showFailure(error); }
  });
  await loadForumPosts();
}

function bootstrapDashboard() {
  if (!can("admin:access")) return showPanel(content(), "无权访问后台", "请使用具备版主或管理员权限的账号登录。");
  const target = document.querySelector("[data-admin-summary]");
  target.textContent = can("admin:manageUsers") ? "管理员可管理全局账号、声望、礼包码、敏感词和数据转移。" : "版主可进行论坛内容管理；全局账号与配置由管理员维护。";
}

async function bootstrap() {
  try {
    capabilities = await window.MKJApp?.getCapabilities?.() ?? [];
    if (!can("admin:access")) return showPanel(content(), "无权访问后台", "请先登录具备版主或管理员权限的账号。");
    renderNav(document.querySelector("[data-admin-nav]"), capabilities);
    if (page === "dashboard") bootstrapDashboard();
    if (page === "users") await bootstrapUsers();
    if (page === "redeem") await bootstrapRedeem();
    if (page === "sensitive") await bootstrapSensitive();
    if (page === "transfer") await bootstrapTransfer();
    if (page === "forum") await bootstrapForum();
  } catch (error) {
    showPanel(content(), "后台暂时不可用", error?.message || "请稍后重试。");
  }
}

bootstrap();
