const toast = document.querySelector("#toast");
const missions = [...document.querySelectorAll("[data-mission]")];
const missionCount = document.querySelector("#missionCount");
const roleModal = document.querySelector("#roleModal");
const infoModal = document.querySelector("#infoModal");
const authModal = document.querySelector("#authModal");
const notificationMenu = document.querySelector("#notificationMenu");
const profileMenu = document.querySelector("#profileMenu");
const roleOptions = [...document.querySelectorAll("[data-role]")];
const targetPanel = document.querySelector("#roles");
const navLinks = [...document.querySelectorAll(".main-nav a")];
const authTabs = [...document.querySelectorAll("[data-auth-view]")];
const authForms = [...document.querySelectorAll("[data-auth-form]")];
const authHint = document.querySelector("#authHint");
const authError = document.querySelector("#authError");
const profileButton = document.querySelector(".profile-button");
const profileNodes = {
  avatar: [document.querySelector("#profileAvatar"), document.querySelector("#menuProfileAvatar")],
  name: [document.querySelector("#profileName"), document.querySelector("#menuProfileName")],
  meta: [document.querySelector("#profileMeta"), document.querySelector("#menuProfileMeta")],
};

let selectedRole = localStorage.getItem("career-role") || "frontend";
let activeOpener = null;
let currentUser = null;
let remoteDataReady = false;

const supabaseConfig = window.SUPABASE_CONFIG || {};
const authRedirectUrl = new URL("./", window.location.href).href;
const canUseSupabase = Boolean(
  supabaseConfig.url &&
  supabaseConfig.publishableKey &&
  window.supabase?.createClient,
);
const supabaseClient = canUseSupabase
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const roleData = {
  frontend: {
    name: "前端开发工程师",
    tags: ["校招", "互联网 / 软件", "上海 · 杭州"],
    jobs: 128,
    completion: 68,
    score: 72,
    status: "高于同阶段 18%",
  },
  product: {
    name: "产品经理",
    tags: ["校招", "互联网 / 消费", "北京 · 上海"],
    jobs: 96,
    completion: 61,
    score: 65,
    status: "高于同阶段 11%",
  },
  data: {
    name: "数据分析师",
    tags: ["校招", "互联网 / 金融", "上海 · 深圳"],
    jobs: 84,
    completion: 57,
    score: 63,
    status: "接近同阶段前 40%",
  },
  design: {
    name: "体验设计师",
    tags: ["校招", "互联网 / 硬件", "北京 · 杭州"],
    jobs: 72,
    completion: 64,
    score: 69,
    status: "高于同阶段 14%",
  },
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function closePopovers() {
  notificationMenu.hidden = true;
  profileMenu.hidden = true;
}

function openModal(modal, opener) {
  activeOpener = opener;
  closePopovers();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector("button")?.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  document.body.style.overflow = "";
  activeOpener?.focus();
  activeOpener = null;
}

function animateScore(nextScore) {
  const scoreElement = document.querySelector("#score");
  const startScore = Number(scoreElement.textContent);
  const startTime = performance.now();
  const duration = 420;

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    scoreElement.textContent = Math.round(startScore + (nextScore - startScore) * eased);
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function renderRole(roleKey, animate = false) {
  const role = roleData[roleKey] || roleData.frontend;
  selectedRole = roleData[roleKey] ? roleKey : "frontend";
  targetPanel.querySelector("h2").textContent = role.name;
  const tagContainer = targetPanel.querySelector(".role-meta");
  tagContainer.innerHTML = role.tags.map((tag) => `<span>${tag}</span>`).join("");
  targetPanel.querySelector(".role-line strong").textContent = role.jobs;
  targetPanel.querySelector(".role-footer > span").textContent = `目标画像完成度 ${role.completion}%`;
  targetPanel.querySelector(".mini-progress span").style.width = `${role.completion}%`;
  document.querySelector(".certainty-meter > span").style.width = `${role.score}%`;
  document.querySelector(".certainty-meter").setAttribute("aria-label", `就业确定性指数 ${role.score} 分`);
  document.querySelector(".score-status").lastChild.textContent = role.status;
  roleOptions.forEach((option) => option.classList.toggle("selected", option.dataset.role === selectedRole));
  if (animate) animateScore(role.score);
  else document.querySelector("#score").textContent = role.score;
}

function updateMissionCount() {
  const completed = missions.filter((mission) => mission.classList.contains("completed")).length;
  missionCount.textContent = completed;
}

function getMissionState() {
  return missions.map((mission) => mission.classList.contains("completed"));
}

function applyMissionState(state) {
  const safeState = Array.isArray(state) && state.length === missions.length
    ? state.map(Boolean)
    : [true, false, false];
  missions.forEach((mission, index) => {
    mission.classList.toggle("completed", safeState[index]);
    mission.querySelector(".checkbox").textContent = safeState[index] ? "✓" : "";
    mission.setAttribute("aria-pressed", String(safeState[index]));
  });
  updateMissionCount();
}

function saveLocalState() {
  localStorage.setItem("career-role", selectedRole);
  localStorage.setItem("career-missions", JSON.stringify(getMissionState()));
}

function restoreLocalState() {
  let state = [true, false, false];
  try {
    const saved = JSON.parse(localStorage.getItem("career-missions"));
    if (Array.isArray(saved) && saved.length === missions.length) state = saved;
  } catch {
    localStorage.removeItem("career-missions");
  }
  applyMissionState(state);
}

function setProfileUI(user) {
  const email = user?.email || "";
  const displayName = user?.user_metadata?.display_name || email.split("@")[0] || "林同学";
  const initial = displayName.trim().slice(0, 1) || "林";
  profileNodes.avatar.forEach((node) => { node.textContent = initial; });
  profileNodes.name.forEach((node) => { node.textContent = displayName; });
  profileNodes.meta.forEach((node) => { node.textContent = user ? email : "大二 · 计算机"; });
  profileButton.title = user ? "打开账户菜单" : "登录或注册";
}

function setAuthError(message = "") {
  authError.textContent = message;
  authError.hidden = !message;
}

function setAuthView(view) {
  authTabs.forEach((tab) => {
    const active = tab.dataset.authView === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  authForms.forEach((form) => { form.hidden = form.dataset.authForm !== view; });
  setAuthError("");
}

function openAuthModal(view = "login", opener = profileButton) {
  setAuthView(view);
  authHint.textContent = canUseSupabase
    ? "你的账号数据将通过 Supabase 安全保存。"
    : "当前未配置公开密钥，网页仍可使用本地演示模式。";
  openModal(authModal, opener);
}

function isMissingTableError(error) {
  return error?.code === "42P01" || /relation .* does not exist|schema cache/i.test(error?.message || "");
}

async function persistRemoteState() {
  if (!supabaseClient || !currentUser || !remoteDataReady) return;
  const now = new Date().toISOString();
  const [profileResult, progressResult] = await Promise.all([
    supabaseClient.from("profiles").upsert({
      id: currentUser.id,
      display_name: currentUser.user_metadata?.display_name || "航线同学",
      target_role: selectedRole,
      updated_at: now,
    }),
    supabaseClient.from("career_progress").upsert({
      user_id: currentUser.id,
      mission_state: getMissionState(),
      updated_at: now,
    }),
  ]);
  const error = profileResult.error || progressResult.error;
  if (error) {
    remoteDataReady = false;
    showToast(isMissingTableError(error) ? "请先在 Supabase 执行 schema.sql" : "云端保存失败，已保留本地记录");
  }
}

async function loadRemoteState() {
  if (!supabaseClient || !currentUser) return;
  const [profileResult, progressResult] = await Promise.all([
    supabaseClient.from("profiles").select("display_name, target_role").eq("id", currentUser.id).maybeSingle(),
    supabaseClient.from("career_progress").select("mission_state").eq("user_id", currentUser.id).maybeSingle(),
  ]);
  const error = profileResult.error || progressResult.error;
  if (error) {
    remoteDataReady = false;
    showToast(isMissingTableError(error) ? "请先在 Supabase 执行 schema.sql" : "云端读取失败，暂时使用本地记录");
    return;
  }
  remoteDataReady = true;
  if (profileResult.data?.target_role && roleData[profileResult.data.target_role]) {
    selectedRole = profileResult.data.target_role;
    localStorage.setItem("career-role", selectedRole);
  }
  if (progressResult.data?.mission_state) {
    applyMissionState(progressResult.data.mission_state);
    localStorage.setItem("career-missions", JSON.stringify(getMissionState()));
  }
  renderRole(selectedRole);
  await persistRemoteState();
}

async function handleAuthSession(session) {
  currentUser = session?.user || null;
  setProfileUI(currentUser);
  remoteDataReady = false;
  if (currentUser) {
    await loadRemoteState();
  }
}

function formatAuthError(error) {
  const message = error?.message || "操作失败，请稍后再试";
  if (/invalid login credentials/i.test(message)) return "邮箱或密码不正确";
  if (/email not confirmed/i.test(message)) return "邮箱还未验证，请先查收验证邮件";
  if (/user already registered/i.test(message)) return "这个邮箱已经注册过了，请直接登录";
  return message;
}

async function submitLogin(event) {
  event.preventDefault();
  if (!supabaseClient) {
    setAuthError("请先把 Supabase 的 Publishable key 填入 supabase-config.js");
    return;
  }
  const form = new FormData(event.currentTarget);
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: String(form.get("email")).trim(),
    password: String(form.get("password")),
  });
  if (error) {
    setAuthError(formatAuthError(error));
    return;
  }
  closeModal(authModal);
  showToast("登录成功，正在同步你的航线");
}

async function submitRegister(event) {
  event.preventDefault();
  if (!supabaseClient) {
    setAuthError("请先把 Supabase 的 Publishable key 填入 supabase-config.js");
    return;
  }
  const form = new FormData(event.currentTarget);
  const displayName = String(form.get("displayName")).trim() || "航线同学";
  const { data, error } = await supabaseClient.auth.signUp({
    email: String(form.get("email")).trim(),
    password: String(form.get("password")),
    options: {
      data: { display_name: displayName },
      emailRedirectTo: authRedirectUrl,
    },
  });
  if (error) {
    setAuthError(formatAuthError(error));
    return;
  }
  if (data.session) {
    closeModal(authModal);
    showToast("账户创建成功");
  } else {
    setAuthError("注册成功，请查收验证邮件后再登录。");
  }
}

async function submitReset(event) {
  event.preventDefault();
  if (!supabaseClient) {
    setAuthError("请先把 Supabase 的 Publishable key 填入 supabase-config.js");
    return;
  }
  const form = new FormData(event.currentTarget);
  const { error } = await supabaseClient.auth.resetPasswordForEmail(String(form.get("email")).trim(), {
    redirectTo: authRedirectUrl,
  });
  if (error) {
    setAuthError(formatAuthError(error));
    return;
  }
  setAuthError("重置邮件已发送，请检查邮箱。");
}

async function signOut() {
  closePopovers();
  if (!supabaseClient || !currentUser) {
    openAuthModal("login");
    return;
  }
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast(formatAuthError(error));
    return;
  }
  showToast("已退出登录");
}

missions.forEach((mission) => {
  mission.addEventListener("click", async () => {
    const completed = mission.classList.toggle("completed");
    mission.querySelector(".checkbox").textContent = completed ? "✓" : "";
    mission.setAttribute("aria-pressed", String(completed));
    updateMissionCount();
    saveLocalState();
    await persistRemoteState();
    showToast(completed ? "已加入你的完成记录" : "已移回本周待办");
  });
});

document.querySelector("#changeRole").addEventListener("click", (event) => {
  selectedRole = localStorage.getItem("career-role") || selectedRole;
  roleOptions.forEach((option) => option.classList.toggle("selected", option.dataset.role === selectedRole));
  openModal(roleModal, event.currentTarget);
});

roleOptions.forEach((option) => {
  option.addEventListener("click", () => {
    selectedRole = option.dataset.role;
    roleOptions.forEach((item) => item.classList.toggle("selected", item === option));
  });
});

document.querySelector("#confirmRole").addEventListener("click", async () => {
  saveLocalState();
  renderRole(selectedRole, true);
  closeModal(roleModal);
  await persistRemoteState();
  showToast(`已切换为「${roleData[selectedRole].name}」`);
});

document.querySelector(".more-button").addEventListener("click", (event) => openModal(infoModal, event.currentTarget));

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop")));
});

document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal(backdrop);
  });
});

authTabs.forEach((tab) => tab.addEventListener("click", () => setAuthView(tab.dataset.authView)));
document.querySelector("#loginForm").addEventListener("submit", submitLogin);
document.querySelector("#registerForm").addEventListener("submit", submitRegister);
document.querySelector("#resetForm").addEventListener("submit", submitReset);

document.querySelector("#viewAll").addEventListener("click", (event) => {
  const extraEvidence = [...document.querySelectorAll(".extra-evidence")];
  const willShow = extraEvidence.some((item) => item.hidden);
  extraEvidence.forEach((item) => { item.hidden = !willShow; });
  event.currentTarget.innerHTML = willShow ? "收起详情 <span>↑</span>" : "查看全部 <span>→</span>";
  showToast(willShow ? "已展开全部 6 项能力证据" : "已收起次要能力");
});

document.querySelector(".icon-button").addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = notificationMenu.hidden;
  closePopovers();
  notificationMenu.hidden = !willOpen;
});

profileButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!currentUser) {
    openAuthModal("login", event.currentTarget);
    return;
  }
  const willOpen = profileMenu.hidden;
  closePopovers();
  profileMenu.hidden = !willOpen;
});

document.querySelectorAll("[data-notification]").forEach((button) => {
  button.addEventListener("click", () => {
    button.remove();
    document.querySelector(".notification-dot").hidden = true;
    showToast("已标记为已读");
  });
});

document.querySelectorAll("[data-profile-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.profileAction;
    if (action === "logout") {
      await signOut();
      return;
    }
    closePopovers();
    showToast(action === "profile" ? "个人资料会随账户数据一起保存" : "偏好设置将在下一步开放");
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".popover") && !event.target.closest(".top-actions")) closePopovers();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closePopovers();
  const openModalElement = document.querySelector(".modal-backdrop:not([hidden])");
  if (openModalElement) closeModal(openModalElement);
});

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
  });
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((item) => item.classList.toggle("active", item === link));
  });
});

const observedSections = [...document.querySelectorAll("#dashboard, #evidence, #roles, #missions")];
const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  const href = `#${visible.target.id}`;
  navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === href));
}, { rootMargin: "-20% 0px -60% 0px", threshold: [0, .25, .5] });

observedSections.forEach((section) => sectionObserver.observe(section));

restoreLocalState();
renderRole(selectedRole);
setProfileUI(null);

if (supabaseClient) {
  authHint.textContent = "你的账号数据将通过 Supabase 安全保存。";
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => handleAuthSession(session), 0);
  });
  supabaseClient.auth.getSession().then(({ data }) => handleAuthSession(data.session));
}
