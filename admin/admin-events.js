import { adminGrantPermission, adminRedeemCodes, adminSensitiveWords, adminUsers, moderateForum, transferAccount } from "./admin-api.js";
import { element, formatTime, renderLoading, renderNav, renderRows, showPanel } from "./admin-render.js";
import { guardFormData } from "../assets/js/security/form-guard.js";

const page = document.body?.dataset.adminPage;
let capabilities = [];
let userPage = 1;
let userRows = [];

function can(...names) { return names.some((name) => capabilities.includes(name)); }
function canAccessAdmin() { return can("admin:access") || capabilities.some((capability) => capability.startsWith("admin:")); }
function content() { return document.querySelector("[data-admin-content]"); }
function status(message, error = false) {
  const target = document.querySelector("[data-admin-status]");
  if (!target) return;
  target.hidden = false;
  target.dataset.state = error ? "error" : "success";
  target.textContent = message;
}
function fail(error) { status(error?.message || "Action failed. Please retry.", true); }
function busy(form, value) { form?.querySelectorAll("button, input, select, textarea").forEach((control) => { control.disabled = value; }); }

function addGrantFields(form) {
  if (!form || form.querySelector("[data-admin-grant-fields]")) return;
  const fields = element("fieldset", "admin-grant-fields");
  fields.dataset.adminGrantFields = "";
  fields.append(element("legend", "", "Optional redemption grants"));
  const roleLabel = element("label", "", "Role");
  const role = document.createElement("select");
  role.name = "rewardRole";
  role.append(new Option("No role", ""), new Option("User", "USER"), new Option("Moderator", "MODERATOR"));
  roleLabel.append(role);
  const permissionLabel = element("label", "", "Exact capability");
  const permission = document.createElement("input");
  permission.name = "grantPermission";
  permission.placeholder = "forum:pin_post";
  permission.maxLength = 120;
  permissionLabel.append(permission);
  fields.append(roleLabel, permissionLabel);
  form.querySelector(".admin-form-grid")?.append(fields) || form.append(fields);
}

function userAction(user) {
  const wrapper = element("div", "admin-row-actions");
  if (can("admin:manageUsers")) {
    const role = document.createElement("select");
    ["USER", "MODERATOR", "ADMIN"].forEach((value) => role.append(new Option(value, value, false, value === user.role)));
    const saveRole = element("button", "admin-icon-button", "Save role");
    saveRole.type = "button";
    saveRole.addEventListener("click", async () => {
      if (!window.confirm(`Change ${user.display_name || user.user_id} to ${role.value}?`)) return;
      saveRole.disabled = true;
      try { await adminUsers({ action: "setRole", userId: user.user_id, role: role.value }); status("Role updated."); await loadUsers(); }
      catch (error) { saveRole.disabled = false; fail(error); }
    });
    const mute = element("button", "admin-icon-button", user.muted_until ? "Unmute" : "Mute 24h");
    mute.type = "button";
    mute.addEventListener("click", async () => {
      mute.disabled = true;
      try { await adminUsers({ action: "setMute", userId: user.user_id, mutedUntil: user.muted_until ? null : new Date(Date.now() + 86_400_000).toISOString() }); status(user.muted_until ? "User unmuted." : "User muted for 24 hours."); await loadUsers(); }
      catch (error) { mute.disabled = false; fail(error); }
    });
    wrapper.append(role, saveRole, mute);
    if (can("admin:manageUsers")) {
      (user.permissions || []).forEach((permission) => {
        const granted = element("span", "admin-permission-chip", permission);
        const revokeButton = element("button", "admin-icon-button admin-danger-button", "撤销");
        revokeButton.type = "button";
        revokeButton.setAttribute("aria-label", `撤销权限 ${permission}`);
        revokeButton.addEventListener("click", async () => {
          if (!window.confirm(`确认撤销 ${user.display_name || user.user_id} 的 ${permission} 权限？`)) return;
          revokeButton.disabled = true;
          try {
            await adminGrantPermission({ userId: user.user_id, capability: permission, permission, active: false, reason: "manual_admin_revoke" });
            status("权限已撤销。");
            await loadUsers();
          } catch (error) { revokeButton.disabled = false; fail(error); }
        });
        wrapper.append(granted, revokeButton);
      });
      const grant = document.createElement("input");
      grant.className = "admin-grant-input";
      grant.placeholder = "forum:pin_post";
      grant.setAttribute("aria-label", "Exact capability");
      const grantButton = element("button", "admin-icon-button", "Grant");
      grantButton.type = "button";
      grantButton.addEventListener("click", async () => {
        if (!grant.value.trim()) return;
        grantButton.disabled = true;
        try { await adminGrantPermission({ userId: user.user_id, capability: grant.value.trim(), permission: grant.value.trim(), active: true }); status("Capability granted."); grant.value = ""; }
        catch (error) { fail(error); }
        finally { grantButton.disabled = false; }
      });
      wrapper.append(grant, grantButton);
    }
  }
  return wrapper;
}

async function loadUsers({ append = false } = {}) {
  const table = document.querySelector("[data-admin-table]");
  if (!append) { userPage = 1; userRows = []; renderLoading(table, "Loading users"); }
  const result = await adminUsers({ action: "list", page: userPage });
  userRows = append ? [...userRows, ...(result.users || [])] : result.users || [];
  renderRows(table, [
    { label: "User", value: (user) => `${user.display_name || "Member"}\n${user.user_id}` },
    { label: "Role", value: "role" },
    { label: "Reputation", value: (user) => String(user.reputation ?? 0) },
    { label: "Mute", value: (user) => formatTime(user.muted_until) },
    { label: "Actions", value: userAction },
  ], userRows);
  const more = document.querySelector("[data-admin-load-more]");
  if (more) { more.hidden = !result.hasMore; more.disabled = false; }
}

async function bootstrapUsers() {
  if (!can("admin:manageUsers")) return showPanel(content(), "Access restricted", "User management requires admin:manageUsers.");
  const more = document.querySelector("[data-admin-load-more]");
  more?.addEventListener("click", async () => { more.disabled = true; userPage += 1; try { await loadUsers({ append: true }); } catch (error) { userPage -= 1; more.disabled = false; fail(error); } });
  const form = document.querySelector("[data-admin-reputation-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    busy(form, true);
    const data = new FormData(form);
    try { await adminUsers({ action: "adjustReputation", userId: data.get("userId"), amount: Number(data.get("amount")), reason: data.get("reason"), eventKey: `admin:${crypto.randomUUID()}` }); status("Reputation updated."); form.reset(); await loadUsers(); }
    catch (error) { fail(error); }
    finally { busy(form, false); }
  });
  await loadUsers();
}

function redeemAction(code) {
  const wrapper = element("div", "admin-row-actions");
  const button = element("button", "admin-icon-button", code.is_active ? "Disable" : "Enable");
  button.type = "button";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try { await adminRedeemCodes({ action: "setActive", id: code.id, isActive: !code.is_active }); status(code.is_active ? "Code disabled." : "Code enabled."); await loadRedeemCodes(); }
    catch (error) { button.disabled = false; fail(error); }
  });
  wrapper.append(button);
  return wrapper;
}

async function loadRedeemCodes() {
  const table = document.querySelector("[data-admin-table]");
  renderLoading(table, "Loading redeem codes");
  const result = await adminRedeemCodes({ action: "list" });
  renderRows(table, [
    { label: "Code", value: "code" },
    { label: "Reward", value: (code) => `+${code.reward_reputation ?? 0} reputation` },
    { label: "Role", value: (code) => code.reward_role || code.reward_title || "-" },
    { label: "Capabilities", value: (code) => code.reward_permission || (code.grant_permissions || code.granted_permissions || []).join(", ") || "-" },
    { label: "Uses", value: (code) => `${code.current_uses ?? 0} / ${code.max_uses ?? 0}` },
    { label: "Status", value: (code) => code.is_active ? "Active" : "Disabled" },
    { label: "Actions", value: redeemAction },
  ], result.codes || []);
}

async function bootstrapRedeem() {
  if (!can("admin:manageRedeemCodes")) return showPanel(content(), "Access restricted", "Redeem code management requires admin:manageRedeemCodes.");
  const form = document.querySelector("[data-admin-redeem-form]");
  addGrantFields(form);
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    busy(form, true);
    const data = new FormData(form);
    try {
      const guarded = guardFormData(form, ["rewardTitle"], document.querySelector("[data-admin-status]"));
      const result = await adminRedeemCodes({ action: "create", quantity: Number(data.get("quantity")), rewardReputation: Number(data.get("rewardReputation")), maxUses: Number(data.get("maxUses")), expiresAt: data.get("expiresAt") || null, rewardTitle: guarded.values.rewardTitle || null, rewardRole: data.get("rewardRole") || null, rewardPermission: data.get("grantPermission") || null, grantPermission: data.get("grantPermission") || null, grantPermissions: data.get("grantPermission") ? [data.get("grantPermission")] : [] });
      status(`Generated ${result.codes?.length || 0} code(s).`); form.reset(); await loadRedeemCodes();
    } catch (error) { fail(error); }
    finally { busy(form, false); }
  });
  await loadRedeemCodes();
}

async function loadSensitiveWords() {
  const table = document.querySelector("[data-admin-table]");
  renderLoading(table, "Loading sensitive words");
  const result = await adminSensitiveWords({ action: "list" });
  renderRows(table, [
    { label: "Word", value: "word" },
    { label: "Level", value: "level" },
    { label: "Created", value: (word) => formatTime(word.created_at) },
    { label: "Actions", value: wordAction },
  ], result.words || []);
}

function wordAction(word) {
  const button = element("button", "admin-icon-button admin-danger-button", "Delete");
  button.type = "button";
  button.addEventListener("click", async () => {
    if (!window.confirm(`Delete sensitive word ${word.word}?`)) return;
    button.disabled = true;
    try { await adminSensitiveWords({ action: "delete", id: word.id }); status("Sensitive word deleted."); await loadSensitiveWords(); }
    catch (error) { button.disabled = false; fail(error); }
  });
  return button;
}

async function bootstrapSensitive() {
  if (!can("admin:manageSensitiveWords")) return showPanel(content(), "Access restricted", "Sensitive word management requires admin:manageSensitiveWords.");
  const form = document.querySelector("[data-admin-sensitive-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    busy(form, true);
    const data = new FormData(form);
    try { await adminSensitiveWords({ action: "create", word: data.get("word"), level: data.get("level") }); status("Sensitive word added."); form.reset(); await loadSensitiveWords(); }
    catch (error) { fail(error); }
    finally { busy(form, false); }
  });
  await loadSensitiveWords();
}

async function bootstrapTransfer() {
  if (!can("admin:transferAccount")) return showPanel(content(), "Access restricted", "Account transfer requires admin:transferAccount.");
  const form = document.querySelector("[data-admin-transfer-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.confirm("Transfer posts and reputation? This cannot be undone.")) return;
    busy(form, true);
    const data = new FormData(form);
    try { const result = await transferAccount({ fromUserId: data.get("fromUserId"), toUserId: data.get("toUserId") }); status(`Transfer recorded (${result.transfer?.reputation_transferred ?? 0} reputation).`); form.reset(); }
    catch (error) { fail(error); }
    finally { busy(form, false); }
  });
}

function forumPostAction(post) {
  const wrapper = element("div", "admin-row-actions");
  [[post.is_pinned ? "Unpin" : "Pin", post.is_pinned ? "UNPIN" : "PIN", "admin:manageForum"], [post.is_locked ? "Unlock" : "Lock", post.is_locked ? "UNLOCK" : "LOCK", "admin:manageForum"], ["Delete", "DELETE", "admin:manageForum"]].forEach(([label, action, capability]) => {
    const button = element("button", `admin-icon-button${action === "DELETE" ? " admin-danger-button" : ""}`, label);
    button.type = "button";
    button.disabled = !can(capability);
    button.addEventListener("click", async () => {
      if (action === "DELETE" && !window.confirm(`Delete ${post.title || "this post"}?`)) return;
      button.disabled = true;
      try { await moderateForum({ target: "post", targetId: post.id, action }); status("Forum action completed."); await loadForumPosts(); }
      catch (error) { button.disabled = false; fail(error); }
    });
    wrapper.append(button);
  });
  return wrapper;
}

async function loadForumPosts() {
  const table = document.querySelector("[data-admin-forum-table]");
  renderLoading(table, "Loading forum posts");
  const client = window.MKJApp?.client;
  if (!client) throw new Error("Community service is unavailable.");
  const { data, error } = await client.from("forum_posts").select("id, title, is_pinned, is_locked, score, comment_count, created_at").eq("status", "PUBLISHED").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Unable to load forum posts.");
  renderRows(table, [
    { label: "Post", value: (post) => `${post.title || "Untitled"}\n${post.id}` },
    { label: "Score", value: (post) => String(post.score ?? 0) },
    { label: "Replies", value: (post) => String(post.comment_count ?? 0) },
    { label: "Created", value: (post) => formatTime(post.created_at) },
    { label: "Actions", value: forumPostAction },
  ], data || []);
}

async function bootstrapForum() {
  if (!can("admin:manageForum")) return showPanel(content(), "Access restricted", "Forum moderation requires admin:manageForum.");
  const form = document.querySelector("[data-admin-forum-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    busy(form, true);
    const data = new FormData(form);
    try { await moderateForum({ target: data.get("target"), targetId: data.get("targetId"), action: data.get("action") }); status("Forum action completed."); form.reset(); await loadForumPosts(); }
    catch (error) { fail(error); }
    finally { busy(form, false); }
  });
  await loadForumPosts();
}

function bootstrapDashboard() {
  if (!canAccessAdmin()) return showPanel(content(), "Access restricted", "An admin capability is required.");
  const summary = document.querySelector("[data-admin-summary]");
  if (summary) summary.textContent = can("admin:manageUsers") ? "Manage users, reputation, grants, sensitive words and community content." : "Moderate forum content with the capabilities assigned to your account.";
}

async function boot() {
  try {
    await window.MKJApp?.ready?.();
    capabilities = await window.MKJApp?.getCapabilities?.() || [];
    if (!canAccessAdmin()) return showPanel(content(), "Access restricted", "Sign in with an admin capability to continue.");
    renderNav(document.querySelector("[data-admin-nav]"), capabilities);
    if (page === "dashboard") bootstrapDashboard();
    if (page === "users") await bootstrapUsers();
    if (page === "redeem") await bootstrapRedeem();
    if (page === "sensitive") await bootstrapSensitive();
    if (page === "transfer") await bootstrapTransfer();
    if (page === "forum") await bootstrapForum();
  } catch (error) { showPanel(content(), "Admin temporarily unavailable", error.message, () => boot()); }
}

if (page) void boot();

export { addGrantFields, can, loadUsers, loadRedeemCodes, loadSensitiveWords, loadForumPosts };
