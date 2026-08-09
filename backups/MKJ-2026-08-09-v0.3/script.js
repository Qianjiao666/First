const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const toast = $("#toast");
const roleModal = $("#roleModal");
const infoModal = $("#infoModal");
const authModal = $("#authModal");
const educationModal = $("#educationModal");
const missionModal = $("#missionModal");
const changelogModal = $("#changelogModal");
const notificationMenu = $("#notificationMenu");
const profileMenu = $("#profileMenu");
const themeMenu = $("#themeMenu");
const targetPanel = $("#roles");
const missionList = $("#missionList");
const missionCount = $("#missionCount");
const missionTotal = $("#missionTotal");
const authHint = $("#authHint");
const authMessage = $("#authMessage");
const authTabsContainer = $(".auth-tabs");
const authModalTitle = $("#authModalTitle");
const authModalCopy = $(".modal-copy", authModal);
const resendConfirmationButton = $("#resendConfirmation");
const profileButton = $(".profile-button");
const feedbackForm = $("#feedbackForm");
const feedbackContent = $("#feedbackContent");
const feedbackBoard = $("#feedbackBoard");
const feedbackStatus = $("#feedbackStatus");
const navLinks = $$(".main-nav a, .mobile-nav a");
const authTabs = $$('[data-auth-view]');
const authForms = $$('[data-auth-form]');
const profileNodes = {
  avatar: [$("#profileAvatar"), $("#menuProfileAvatar")],
  name: [$("#profileName"), $("#menuProfileName")],
  meta: [$("#profileMeta"), $("#menuProfileMeta")],
};

const categories = {
  all: "全部",
  technology: "技术研发",
  ai: "数据与 AI",
  product: "产品运营",
  design: "设计内容",
  business: "商业职能",
  engineering: "工程科研",
};

function role(name, category, skills, industry, cities, jobs, completion, score) {
  return { name, category, skills, tags: ["校招", industry, cities], jobs, completion, score, status: score >= 70 ? "高于同阶段 16%" : score >= 64 ? "高于同阶段 9%" : "接近同阶段前 40%" };
}

const roleData = {
  frontend: role("前端开发工程师", "technology", "JavaScript · React · 性能优化", "互联网 / 软件", "上海 · 杭州", 128, 68, 72),
  backend: role("后端开发工程师", "technology", "Java · 数据库 · 分布式系统", "互联网 / 软件", "北京 · 深圳", 156, 62, 68),
  fullstack: role("全栈开发工程师", "technology", "前端 · 服务端 · 云部署", "互联网 / 软件", "上海 · 深圳", 92, 58, 66),
  mobile: role("移动端开发工程师", "technology", "Android / iOS · 性能 · 工程化", "互联网 / 移动应用", "北京 · 杭州", 73, 56, 65),
  test: role("测试开发工程师", "technology", "自动化测试 · CI/CD · 质量工程", "互联网 / 软件", "上海 · 北京", 89, 63, 67),
  security: role("网络安全工程师", "technology", "攻防基础 · 安全审计 · 应急响应", "网络安全", "北京 · 深圳", 61, 52, 64),
  devops: role("DevOps 工程师", "technology", "Linux · 容器 · 自动化运维", "云计算 / 软件", "北京 · 杭州", 78, 55, 65),
  embedded: role("嵌入式开发工程师", "technology", "C/C++ · 单片机 · 操作系统", "智能硬件", "深圳 · 苏州", 103, 57, 66),
  data: role("数据分析师", "ai", "SQL · 统计基础 · 业务分析", "互联网 / 金融", "上海 · 深圳", 84, 57, 63),
  algorithm: role("算法工程师", "ai", "机器学习 · Python · 模型优化", "人工智能", "北京 · 上海", 96, 51, 64),
  ai_product: role("AI 产品经理", "ai", "模型能力 · 场景设计 · 产品验证", "人工智能", "北京 · 杭州", 66, 54, 65),
  data_engineer: role("数据开发工程师", "ai", "数据仓库 · ETL · Spark", "大数据 / 云计算", "北京 · 上海", 88, 55, 65),
  bi: role("商业智能分析师", "ai", "BI 工具 · 指标体系 · 可视化", "咨询 / 互联网", "上海 · 广州", 58, 60, 66),
  research_ai: role("AI 研究员", "ai", "论文复现 · 深度学习 · 科研写作", "科研 / 人工智能", "北京 · 上海", 42, 45, 61),
  product: role("产品经理", "product", "用户研究 · 产品设计 · 项目推动", "互联网 / 消费", "北京 · 上海", 96, 61, 65),
  operations: role("用户运营", "product", "用户分层 · 活动策划 · 数据复盘", "互联网 / 消费", "北京 · 广州", 112, 65, 68),
  growth: role("增长运营", "product", "增长实验 · 渠道 · 数据分析", "互联网 / 电商", "上海 · 杭州", 76, 59, 66),
  content_ops: role("内容运营", "product", "内容策划 · 平台机制 · 数据复盘", "内容 / 平台", "北京 · 广州", 91, 67, 69),
  project_manager: role("项目管理专员", "product", "计划管理 · 沟通 · 风险控制", "互联网 / 制造", "上海 · 苏州", 86, 64, 67),
  ecommerce: role("电商运营", "product", "平台运营 · 转化率 · 供应链协作", "电商 / 零售", "杭州 · 广州", 124, 62, 67),
  design: role("体验设计师", "design", "用户体验 · 交互设计 · 作品集", "互联网 / 硬件", "北京 · 杭州", 72, 64, 69),
  visual: role("视觉设计师", "design", "视觉系统 · 品牌 · 作品集", "品牌 / 互联网", "上海 · 深圳", 69, 66, 69),
  industrial_design: role("工业设计师", "design", "产品造型 · 材料工艺 · 建模", "制造 / 消费电子", "深圳 · 上海", 55, 58, 65),
  content_creator: role("内容策划", "design", "选题 · 写作 · 内容生产", "传媒 / 互联网", "北京 · 上海", 83, 68, 69),
  game_design: role("游戏策划", "design", "系统设计 · 数值 · 玩家体验", "游戏", "上海 · 广州", 64, 55, 64),
  finance: role("财务分析师", "business", "财务建模 · 报表 · 经营分析", "金融 / 企业服务", "上海 · 深圳", 94, 63, 67),
  audit: role("审计助理", "business", "审计程序 · 会计准则 · Excel", "会计师事务所", "北京 · 上海", 118, 69, 70),
  consulting: role("咨询顾问", "business", "结构化分析 · 研究 · 表达", "咨询", "北京 · 上海", 62, 57, 66),
  hr: role("人力资源专员", "business", "招聘 · 组织协作 · 数据分析", "企业服务", "上海 · 广州", 97, 67, 69),
  marketing: role("市场营销", "business", "市场洞察 · 品牌 · 整合营销", "消费 / 品牌", "上海 · 广州", 109, 64, 68),
  sales: role("客户经理", "business", "客户沟通 · 方案 · 商务推进", "企业服务 / 金融", "北京 · 深圳", 137, 66, 69),
  mechanical: role("机械工程师", "engineering", "机械设计 · CAD · 制造工艺", "先进制造", "苏州 · 上海", 121, 60, 67),
  electrical: role("电气工程师", "engineering", "电路 · PLC · 自动控制", "制造 / 能源", "深圳 · 苏州", 116, 59, 66),
  chip: role("芯片设计工程师", "engineering", "数字电路 · Verilog · 验证", "半导体", "上海 · 深圳", 79, 49, 63),
  civil: role("土木工程师", "engineering", "结构设计 · 工程管理 · BIM", "建筑 / 基建", "成都 · 武汉", 105, 65, 68),
  biotech: role("生物医药研发", "engineering", "实验设计 · 文献 · 数据记录", "生物医药", "上海 · 苏州", 71, 53, 64),
};

const defaultMissions = [
  { id: "skill-map", title: "整理个人技术栈", detail: "把会用的工具，写成一页能看懂的能力清单", duration: 25, completed: true, custom: false },
  { id: "deploy-record", title: "给项目补上部署记录", detail: "记录从代码到线上可访问页面的完整过程", duration: 45, completed: false, custom: false },
  { id: "project-review", title: "完成一次项目复盘", detail: "回答：你解决了什么问题？为什么这样解决？", duration: 30, completed: false, custom: false },
];

const themePresets = [
  { name: "云白", canvas: "#f5f5f7", accent: "#0071e3" },
  { name: "薄荷", canvas: "#edf7f2", accent: "#087f5b" },
  { name: "晴空", canvas: "#edf5fb", accent: "#146c94" },
  { name: "樱粉", canvas: "#fbf0f2", accent: "#b63c61" },
  { name: "麦黄", canvas: "#faf5e9", accent: "#80651b" },
];
const fallbackUniversities = ["北京大学", "清华大学", "中国人民大学", "北京师范大学", "北京航空航天大学", "北京理工大学", "中国农业大学", "中央财经大学", "对外经济贸易大学", "北京邮电大学", "复旦大学", "上海交通大学", "同济大学", "华东师范大学", "上海财经大学", "南京大学", "东南大学", "南京航空航天大学", "南京理工大学", "浙江大学", "中国科学技术大学", "合肥工业大学", "武汉大学", "华中科技大学", "中山大学", "华南理工大学", "四川大学", "电子科技大学", "重庆大学", "西安交通大学", "西北工业大学", "哈尔滨工业大学", "吉林大学", "大连理工大学", "天津大学", "南开大学", "山东大学", "中国海洋大学", "厦门大学", "湖南大学", "中南大学", "兰州大学", "华南师范大学", "深圳大学", "暨南大学", "苏州大学", "郑州大学", "云南大学", "广西大学", "海南大学"].map((name) => ({ name, location: "中国", nameEng: "" }));

let selectedRole = localStorage.getItem("career-role") || "frontend";
let selectedCategory = "all";
let missions = restoreMissions();
let education = readJson("career-education", { degree: "本科", undergraduate: "", master: "", doctor: "" });
let universities = fallbackUniversities;
let activeOpener = null;
let currentUser = null;
let remoteDataReady = false;
let resendCooldownTimer = null;

const supabaseConfig = window.SUPABASE_CONFIG || {};
const authRedirectUrl = new URL("./", window.location.href).href;
const canUseSupabase = Boolean(supabaseConfig.url && supabaseConfig.publishableKey && window.supabase?.createClient);
const supabaseClient = canUseSupabase ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function normalizeMission(item, index) {
  if (!item || typeof item !== "object") return { ...defaultMissions[index] };
  const title = String(item.title || "未命名任务").slice(0, 60);
  return {
    id: String(item.id || `task-${Date.now()}-${index}`).slice(0, 80),
    title,
    detail: String(item.detail || "").slice(0, 180),
    duration: Math.min(600, Math.max(5, Number(item.duration) || 30)),
    completed: Boolean(item.completed),
    custom: Boolean(item.custom),
  };
}

function restoreMissions() {
  const saved = readJson("career-missions", null);
  if (Array.isArray(saved) && saved.every((item) => typeof item === "boolean")) {
    return defaultMissions.map((item, index) => ({ ...item, completed: Boolean(saved[index]) }));
  }
  if (Array.isArray(saved)) return saved.slice(0, 50).map(normalizeMission);
  return defaultMissions.map((item) => ({ ...item }));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function closePopovers() {
  notificationMenu.hidden = true;
  profileMenu.hidden = true;
  themeMenu.hidden = true;
}

function openModal(modal, opener) {
  activeOpener = opener;
  closePopovers();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  $("button, input, select, textarea", modal)?.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  document.body.style.overflow = "";
  activeOpener?.focus();
  activeOpener = null;
}

function animateScore(nextScore) {
  const scoreElement = $("#score");
  const startScore = Number(scoreElement.textContent);
  const startTime = performance.now();
  function frame(now) {
    const progress = Math.min((now - startTime) / 420, 1);
    scoreElement.textContent = Math.round(startScore + (nextScore - startScore) * (1 - Math.pow(1 - progress, 3)));
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderRole(roleKey, animate = false) {
  const roleItem = roleData[roleKey] || roleData.frontend;
  selectedRole = roleData[roleKey] ? roleKey : "frontend";
  $("h2", targetPanel).textContent = roleItem.name;
  const tagContainer = $(".role-meta", targetPanel);
  clearNode(tagContainer);
  roleItem.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    tagContainer.append(span);
  });
  $(".role-line strong", targetPanel).textContent = roleItem.jobs;
  $(".role-footer > span", targetPanel).textContent = `目标画像完成度 ${roleItem.completion}%`;
  $(".mini-progress span", targetPanel).style.width = `${roleItem.completion}%`;
  $(".certainty-meter > span").style.width = `${roleItem.score}%`;
  $(".certainty-meter").setAttribute("aria-label", `就业确定性指数 ${roleItem.score} 分`);
  $(".score-status").lastChild.textContent = roleItem.status;
  if (animate) animateScore(roleItem.score);
  else $("#score").textContent = roleItem.score;
}

function renderRoleCategories() {
  const container = $("#roleCategories");
  clearNode(container);
  Object.entries(categories).forEach(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `role-category${selectedCategory === key ? " active" : ""}`;
    button.dataset.category = key;
    button.textContent = label;
    container.append(button);
  });
}

function renderRoleOptions() {
  const container = $("#roleOptions");
  const query = $("#roleSearch").value.trim().toLowerCase();
  const entries = Object.entries(roleData).filter(([, item]) => {
    const inCategory = selectedCategory === "all" || item.category === selectedCategory;
    return inCategory && (!query || `${item.name} ${item.skills}`.toLowerCase().includes(query));
  });
  clearNode(container);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "role-empty";
    empty.textContent = "没有匹配岗位，试试其他关键词。";
    container.append(empty);
    return;
  }
  entries.forEach(([key, item]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `role-option${key === selectedRole ? " selected" : ""}`;
    button.dataset.role = key;
    const icon = document.createElement("span");
    icon.className = "role-option-icon";
    icon.textContent = item.category === "technology" ? "⌘" : item.category === "ai" ? "◒" : item.category === "product" ? "✦" : item.category === "design" ? "◌" : item.category === "business" ? "◇" : "＋";
    const copy = document.createElement("span");
    const strong = document.createElement("strong");
    const small = document.createElement("small");
    strong.textContent = item.name;
    small.textContent = item.skills;
    copy.append(strong, small);
    const check = document.createElement("span");
    check.className = "role-option-check";
    check.textContent = "✓";
    button.append(icon, copy, check);
    container.append(button);
  });
}

function renderMissions() {
  clearNode(missionList);
  missions.forEach((mission) => {
    const row = document.createElement("div");
    row.className = "mission-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mission-item${mission.completed ? " completed" : ""}`;
    button.dataset.action = "toggle-mission";
    button.dataset.id = mission.id;
    button.setAttribute("aria-pressed", String(mission.completed));
    const checkbox = document.createElement("span");
    checkbox.className = "checkbox";
    checkbox.textContent = mission.completed ? "✓" : "";
    const copy = document.createElement("span");
    copy.className = "mission-copy";
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    title.textContent = mission.title;
    detail.textContent = mission.detail || "完成后将它加入你的行动记录";
    copy.append(title, detail);
    const time = document.createElement("span");
    time.className = "mission-time";
    time.textContent = `${mission.duration} min`;
    const arrow = document.createElement("span");
    arrow.className = "mission-arrow";
    arrow.textContent = "↗";
    button.append(checkbox, copy, time, arrow);
    row.append(button);
    if (mission.custom) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "mission-delete";
      remove.dataset.action = "delete-mission";
      remove.dataset.id = mission.id;
      remove.setAttribute("aria-label", `删除任务：${mission.title}`);
      remove.title = "删除任务";
      remove.textContent = "×";
      row.append(remove);
    }
    missionList.append(row);
  });
  if (!missions.length) {
    const empty = document.createElement("p");
    empty.className = "mission-empty";
    empty.textContent = "本周还没有任务，添加一件现在就能开始的事。";
    missionList.append(empty);
  }
  missionCount.textContent = missions.filter((item) => item.completed).length;
  missionTotal.textContent = missions.length;
}

function saveLocalState() {
  localStorage.setItem("career-role", selectedRole);
  localStorage.setItem("career-missions", JSON.stringify(missions));
  localStorage.setItem("career-education", JSON.stringify(education));
}

function setProfileUI(user) {
  const email = user?.email || "";
  const displayName = user?.user_metadata?.display_name || email.split("@")[0] || "登录 / 注册";
  const initial = user ? (displayName.trim().slice(0, 1) || "航") : "访";
  profileNodes.avatar.forEach((node) => { node.textContent = initial; });
  profileNodes.name.forEach((node) => { node.textContent = displayName; });
  profileNodes.meta.forEach((node) => { node.textContent = user ? `${education.degree || "学历未填写"} · ${email}` : "访客模式"; });
  profileButton.title = user ? "打开账户菜单" : "登录或注册";
  $("#accountAction").firstChild.textContent = user ? "退出登录 " : "登录账户 ";
}

function setAuthMessage(message = "", tone = "error") {
  authMessage.textContent = message;
  authMessage.dataset.tone = tone;
  authMessage.setAttribute("role", tone === "error" ? "alert" : "status");
  authMessage.hidden = !message;
}

function setFormBusy(form, busy) {
  form.setAttribute("aria-busy", String(busy));
  $$("input, button", form).forEach((control) => { control.disabled = busy; });
  const submitButton = $("button[type='submit']", form);
  if (submitButton?.dataset.idleLabel) submitButton.textContent = busy ? submitButton.dataset.busyLabel : submitButton.dataset.idleLabel;
}

function setAuthView(view) {
  const isRecovery = view === "update";
  authTabs.forEach((tab) => {
    const active = tab.dataset.authView === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  authForms.forEach((form) => { form.hidden = form.dataset.authForm !== view; });
  authTabsContainer.hidden = isRecovery;
  authModalTitle.textContent = isRecovery ? "为账户设置新密码。" : "把你的进度，带到每一次打开。";
  authModalCopy.textContent = isRecovery ? "恢复链接已验证。保存后即可使用新密码登录。" : "注册后，目标岗位、学习经历和任务记录会安全保存到你的账户。";
  setAuthMessage("");
}

function openAuthModal(view = "login", opener = profileButton) {
  setAuthView(view);
  authHint.textContent = canUseSupabase ? "你的账号数据将通过 Supabase 安全保存。" : "当前未配置公开密钥，网页仍可使用本地演示模式。";
  openModal(authModal, opener);
}

function startResendCooldown(seconds = 60) {
  window.clearInterval(resendCooldownTimer);
  let remaining = seconds;
  resendConfirmationButton.disabled = true;
  resendConfirmationButton.textContent = `${remaining} 秒后可重新发送`;
  resendCooldownTimer = window.setInterval(() => {
    remaining -= 1;
    if (remaining > 0) resendConfirmationButton.textContent = `${remaining} 秒后可重新发送`;
    else {
      window.clearInterval(resendCooldownTimer);
      resendConfirmationButton.disabled = false;
      resendConfirmationButton.textContent = "重新发送验证邮件";
    }
  }, 1000);
}

function isMissingSchemaError(error) {
  return ["42P01", "42703", "PGRST204"].includes(error?.code) || /does not exist|schema cache|education/i.test(error?.message || "");
}

async function persistRemoteState() {
  if (!supabaseClient || !currentUser || !remoteDataReady) return;
  const now = new Date().toISOString();
  const [profileResult, progressResult] = await Promise.all([
    supabaseClient.from("profiles").upsert({ id: currentUser.id, display_name: currentUser.user_metadata?.display_name || "航线同学", target_role: selectedRole, education, updated_at: now }),
    supabaseClient.from("career_progress").upsert({ user_id: currentUser.id, mission_state: missions, updated_at: now }),
  ]);
  const error = profileResult.error || progressResult.error;
  if (error) {
    remoteDataReady = false;
    showToast(isMissingSchemaError(error) ? "请先在 Supabase 执行最新版 schema.sql" : "云端保存失败，已保留本地记录");
  }
}

async function loadRemoteState() {
  if (!supabaseClient || !currentUser) return;
  const [profileResult, progressResult] = await Promise.all([
    supabaseClient.from("profiles").select("display_name, target_role, education").eq("id", currentUser.id).maybeSingle(),
    supabaseClient.from("career_progress").select("mission_state").eq("user_id", currentUser.id).maybeSingle(),
  ]);
  const error = profileResult.error || progressResult.error;
  if (error) {
    remoteDataReady = false;
    showToast(isMissingSchemaError(error) ? "请先在 Supabase 执行最新版 schema.sql" : "云端读取失败，暂时使用本地记录");
    return;
  }
  remoteDataReady = true;
  if (profileResult.data?.target_role && roleData[profileResult.data.target_role]) selectedRole = profileResult.data.target_role;
  if (profileResult.data?.education && typeof profileResult.data.education === "object") education = { ...education, ...profileResult.data.education };
  const remoteMissions = progressResult.data?.mission_state;
  if (Array.isArray(remoteMissions)) {
    missions = remoteMissions.every((item) => typeof item === "boolean")
      ? defaultMissions.map((item, index) => ({ ...item, completed: Boolean(remoteMissions[index]) }))
      : remoteMissions.slice(0, 50).map(normalizeMission);
  }
  saveLocalState();
  renderRole(selectedRole);
  renderMissions();
  setProfileUI(currentUser);
  await persistRemoteState();
  await loadFeedback();
}

async function handleAuthSession(session) {
  currentUser = session?.user || null;
  remoteDataReady = false;
  setProfileUI(currentUser);
  updateFeedbackAccess();
  if (currentUser) await loadRemoteState();
}

function getAuthErrorMessage(error) {
  for (const value of [error?.message, error?.error_description, error?.msg, error?.error, error?.cause?.message]) {
    if (typeof value !== "string") continue;
    const message = value.trim();
    if (message && message !== "{}" && message !== "[object Object]") return message;
  }
  return "";
}

function formatAuthError(error, fallback = "操作失败，请稍后再试") {
  const message = getAuthErrorMessage(error);
  if (/invalid login credentials/i.test(message)) return "邮箱或密码不正确";
  if (/email not confirmed/i.test(message)) return "邮箱还未验证，请先查收验证邮件";
  if (/user already registered/i.test(message)) return "这个邮箱已经注册过了，请直接登录";
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(message)) return "邮件发送过于频繁，请稍后再试";
  if (/smtp|535|authentication failed|username and password not accepted/i.test(message)) return "发件邮箱认证失败，请检查 Gmail 地址和应用专用密码";
  if (/error sending|failed to send|confirmation email|recovery email/i.test(message)) return "邮件发送失败，请检查 SMTP 配置或稍后再试";
  if (/failed to fetch|network|load failed/i.test(message)) return "网络连接失败，请检查网络后重试";
  return message || fallback;
}

async function submitLogin(event) {
  event.preventDefault();
  if (!supabaseClient) return setAuthMessage("请先把 Supabase 的 Publishable key 填入 supabase-config.js");
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  setAuthMessage("");
  setFormBusy(formElement, true);
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email: String(form.get("email")).trim(), password: String(form.get("password")) });
    if (error) return setAuthMessage(formatAuthError(error, "登录失败，请稍后再试"));
    closeModal(authModal);
    showToast("登录成功，正在同步你的航线");
  } catch (error) {
    setAuthMessage(formatAuthError(error, "登录失败，请稍后再试"));
  } finally {
    setFormBusy(formElement, false);
  }
}

async function submitRegister(event) {
  event.preventDefault();
  if (!supabaseClient) return setAuthMessage("请先把 Supabase 的 Publishable key 填入 supabase-config.js");
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const displayName = String(form.get("displayName")).trim() || "航线同学";
  const email = String(form.get("email")).trim();
  setAuthMessage("");
  setFormBusy(formElement, true);
  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password: String(form.get("password")), options: { data: { display_name: displayName }, emailRedirectTo: authRedirectUrl } });
    if (error) return setAuthMessage(formatAuthError(error, "注册失败，验证邮件未能发送，请检查 SMTP 配置"));
    if (data.session) {
      closeModal(authModal);
      showToast("账户创建成功");
    } else {
      setAuthMessage("注册成功，请查收验证邮件后再登录。", "success");
      startResendCooldown();
    }
  } catch (error) {
    setAuthMessage(formatAuthError(error, "注册失败，验证邮件未能发送，请检查 SMTP 配置"));
  } finally {
    setFormBusy(formElement, false);
    if (resendConfirmationButton.textContent !== "重新发送验证邮件") resendConfirmationButton.disabled = true;
  }
}

async function submitReset(event) {
  event.preventDefault();
  if (!supabaseClient) return setAuthMessage("请先把 Supabase 的 Publishable key 填入 supabase-config.js");
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  setAuthMessage("");
  setFormBusy(formElement, true);
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(String(form.get("email")).trim(), { redirectTo: authRedirectUrl });
    if (error) return setAuthMessage(formatAuthError(error, "重置邮件发送失败，请检查 SMTP 配置"));
    setAuthMessage("重置邮件已发送，请检查邮箱。", "success");
  } catch (error) {
    setAuthMessage(formatAuthError(error, "重置邮件发送失败，请检查 SMTP 配置"));
  } finally {
    setFormBusy(formElement, false);
  }
}

async function resendConfirmation() {
  const email = String($("#registerForm [name='email']").value).trim();
  if (!email) {
    setAuthMessage("请先填写需要验证的邮箱。");
    $("#registerForm [name='email']").focus();
    return;
  }
  if (!supabaseClient) return setAuthMessage("请先把 Supabase 的 Publishable key 填入 supabase-config.js");
  resendConfirmationButton.disabled = true;
  resendConfirmationButton.textContent = "正在发送…";
  setAuthMessage("");
  try {
    const { error } = await supabaseClient.auth.resend({ type: "signup", email, options: { emailRedirectTo: authRedirectUrl } });
    if (error) throw error;
    setAuthMessage("验证邮件已重新发送，请检查收件箱和垃圾邮件。", "success");
    startResendCooldown();
  } catch (error) {
    setAuthMessage(formatAuthError(error, "验证邮件发送失败，请稍后再试"));
    resendConfirmationButton.disabled = false;
    resendConfirmationButton.textContent = "重新发送验证邮件";
  }
}

async function submitUpdatePassword(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const password = String(form.get("password"));
  if (password !== String(form.get("passwordConfirm"))) return setAuthMessage("两次输入的密码不一致，请重新确认。");
  if (!supabaseClient) return setAuthMessage("当前无法连接账户服务，请稍后重试。");
  setAuthMessage("");
  setFormBusy(formElement, true);
  try {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) return setAuthMessage(formatAuthError(error, "密码更新失败，请重新打开恢复链接"));
    formElement.reset();
    closeModal(authModal);
    showToast("密码已更新，可以使用新密码登录");
  } catch (error) {
    setAuthMessage(formatAuthError(error, "密码更新失败，请重新打开恢复链接"));
  } finally {
    setFormBusy(formElement, false);
  }
}

async function signOut() {
  closePopovers();
  if (!supabaseClient || !currentUser) return openAuthModal("login");
  const { error } = await supabaseClient.auth.signOut();
  if (error) return showToast(formatAuthError(error));
  showToast("已退出登录");
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function mixWithWhite(hex, ratio = 0.82) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#f5f5f7";
  return `#${rgb.map((value) => Math.round(value + (255 - value) * ratio).toString(16).padStart(2, "0")).join("")}`;
}

function applyTheme(theme, persist = true) {
  const canvas = /^#[0-9a-f]{6}$/i.test(theme.canvas) ? theme.canvas : "#f5f5f7";
  const accent = /^#[0-9a-f]{6}$/i.test(theme.accent) ? theme.accent : "#0071e3";
  document.documentElement.style.setProperty("--canvas", mixWithWhite(canvas, 0.18));
  document.documentElement.style.setProperty("--blue", accent);
  document.documentElement.style.setProperty("--blue-soft", mixWithWhite(accent, 0.88));
  $("#canvasColor").value = canvas;
  $("#accentColor").value = accent;
  $(".theme-preview").style.background = mixWithWhite(canvas, 0.18);
  $(".theme-preview").style.borderColor = accent;
  if (persist) localStorage.setItem("career-theme", JSON.stringify({ canvas, accent }));
  renderThemeSwatches(canvas, accent);
}

function renderThemeSwatches(activeCanvas, activeAccent) {
  const container = $("#themeSwatches");
  clearNode(container);
  themePresets.forEach((theme) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `theme-swatch${theme.canvas === activeCanvas && theme.accent === activeAccent ? " selected" : ""}`;
    button.style.setProperty("--swatch", theme.canvas);
    button.dataset.canvas = theme.canvas;
    button.dataset.accent = theme.accent;
    button.title = theme.name;
    button.setAttribute("aria-label", theme.name);
    container.append(button);
  });
}

function fillEducationForm() {
  const form = $("#educationForm");
  form.elements.degree.value = education.degree || "本科";
  form.elements.undergraduate.value = education.undergraduate || "";
  form.elements.master.value = education.master || "";
  form.elements.doctor.value = education.doctor || "";
}

async function loadUniversities() {
  try {
    const response = await fetch("./assets/data/chinese-universities.json", { cache: "force-cache" });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data) && data.length) universities = data.filter((item) => typeof item?.name === "string");
  } catch {
    universities = fallbackUniversities;
  }
}

function renderSchoolResults(input) {
  const results = $(`[data-school-results='${input.name}']`);
  const query = input.value.trim().toLowerCase();
  clearNode(results);
  if (!query) {
    results.hidden = true;
    return;
  }
  const matches = universities.filter((item) => `${item.name} ${item.nameEng || ""} ${item.location || ""}`.toLowerCase().includes(query)).slice(0, 8);
  matches.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "school-result";
    button.dataset.school = item.name;
    const name = document.createElement("span");
    const location = document.createElement("small");
    name.textContent = item.name;
    location.textContent = item.location || "";
    button.append(name, location);
    results.append(button);
  });
  results.hidden = !matches.length;
}

function updateFeedbackAccess() {
  const submit = $("button[type='submit']", feedbackForm);
  feedbackContent.disabled = !currentUser;
  submit.disabled = !currentUser;
  feedbackStatus.textContent = currentUser ? "已连接账户" : "登录后可留言";
  if (!currentUser) {
    clearNode(feedbackBoard);
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "登录后即可查看并发布留言。";
    feedbackBoard.append(empty);
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "刚刚" : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function renderFeedback(items) {
  clearNode(feedbackBoard);
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "还没有留言，写下第一个想法。";
    feedbackBoard.append(empty);
    return;
  }
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "feedback-entry";
    const avatar = document.createElement("span");
    avatar.className = "feedback-entry-avatar";
    avatar.textContent = String(item.author_name || "航").trim().slice(0, 1) || "航";
    const header = document.createElement("span");
    const author = document.createElement("strong");
    const time = document.createElement("small");
    author.textContent = String(item.author_name || "航线同学");
    time.textContent = formatDate(item.created_at);
    header.append(author, time);
    article.append(avatar, header);
    if (item.user_id === currentUser?.id) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "feedback-delete";
      remove.dataset.feedbackId = item.id;
      remove.title = "删除留言";
      remove.setAttribute("aria-label", "删除自己的留言");
      remove.textContent = "×";
      article.append(remove);
    } else {
      article.append(document.createElement("span"));
    }
    const content = document.createElement("p");
    content.textContent = String(item.content || "");
    article.append(content);
    feedbackBoard.append(article);
  });
}

async function loadFeedback() {
  if (!supabaseClient || !currentUser) return;
  feedbackStatus.textContent = "正在读取…";
  const { data, error } = await supabaseClient.from("feedback_messages").select("id,user_id,author_name,content,created_at").order("created_at", { ascending: false }).limit(50);
  if (error) {
    feedbackStatus.textContent = "留言板待初始化";
    clearNode(feedbackBoard);
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = isMissingSchemaError(error) ? "请先在 Supabase 执行最新版 schema.sql。" : "留言读取失败，请稍后重试。";
    feedbackBoard.append(empty);
    return;
  }
  feedbackStatus.textContent = `${data.length} 条留言`;
  renderFeedback(data);
}

missionList.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const index = missions.findIndex((item) => item.id === action.dataset.id);
  if (index < 0) return;
  if (action.dataset.action === "toggle-mission") {
    missions[index].completed = !missions[index].completed;
    showToast(missions[index].completed ? "已加入你的完成记录" : "已移回本周待办");
  } else if (action.dataset.action === "delete-mission" && missions[index].custom) {
    missions.splice(index, 1);
    showToast("自定义任务已删除");
  }
  renderMissions();
  saveLocalState();
  await persistRemoteState();
});

$("#addMissionButton").addEventListener("click", (event) => openModal(missionModal, event.currentTarget));
$("#missionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  missions.push(normalizeMission({ id: `custom-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`, title: String(form.get("title")).trim(), detail: String(form.get("detail")).trim(), duration: Number(form.get("duration")), completed: false, custom: true }, missions.length));
  event.currentTarget.reset();
  event.currentTarget.elements.duration.value = "30";
  renderMissions();
  saveLocalState();
  closeModal(missionModal);
  await persistRemoteState();
  showToast("任务已添加到本周");
});

$("#changeRole").addEventListener("click", (event) => {
  selectedRole = localStorage.getItem("career-role") || selectedRole;
  selectedCategory = "all";
  $("#roleSearch").value = "";
  renderRoleCategories();
  renderRoleOptions();
  openModal(roleModal, event.currentTarget);
});
$("#roleSearch").addEventListener("input", renderRoleOptions);
$("#roleCategories").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderRoleCategories();
  renderRoleOptions();
});
$("#roleOptions").addEventListener("click", (event) => {
  const option = event.target.closest("[data-role]");
  if (!option) return;
  selectedRole = option.dataset.role;
  renderRoleOptions();
});
$("#confirmRole").addEventListener("click", async () => {
  saveLocalState();
  renderRole(selectedRole, true);
  closeModal(roleModal);
  await persistRemoteState();
  showToast(`已切换为「${roleData[selectedRole].name}」`);
});

$("#educationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  education = { degree: String(form.get("degree")), undergraduate: String(form.get("undergraduate")).trim(), master: String(form.get("master")).trim(), doctor: String(form.get("doctor")).trim() };
  saveLocalState();
  setProfileUI(currentUser);
  closeModal(educationModal);
  await persistRemoteState();
  showToast("学习经历已保存");
});
$$('.school-field input').forEach((input) => input.addEventListener("input", () => renderSchoolResults(input)));
$$('[data-school-results]').forEach((results) => results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-school]");
  if (!button) return;
  const input = $(`[name='${results.dataset.schoolResults}']`, educationModal);
  input.value = button.dataset.school;
  results.hidden = true;
}));

$("#themeButton").addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = themeMenu.hidden;
  closePopovers();
  themeMenu.hidden = !willOpen;
});
$("#themeSwatches").addEventListener("click", (event) => {
  const swatch = event.target.closest("[data-canvas]");
  if (swatch) applyTheme({ canvas: swatch.dataset.canvas, accent: swatch.dataset.accent });
});
$("#canvasColor").addEventListener("input", (event) => applyTheme({ canvas: event.target.value, accent: $("#accentColor").value }));
$("#accentColor").addEventListener("input", (event) => applyTheme({ canvas: $("#canvasColor").value, accent: event.target.value }));
$("#resetTheme").addEventListener("click", () => applyTheme(themePresets[0]));
$("#changelogButton").addEventListener("click", (event) => openModal(changelogModal, event.currentTarget));
$(".more-button").addEventListener("click", (event) => openModal(infoModal, event.currentTarget));

feedbackContent.addEventListener("input", () => { $("#feedbackCounter").textContent = `${feedbackContent.value.length} / 500`; });
feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !supabaseClient) return openAuthModal("login", $("button[type='submit']", feedbackForm));
  const content = feedbackContent.value.trim();
  if (content.length < 2) return showToast("留言至少需要 2 个字");
  const button = $("button[type='submit']", feedbackForm);
  button.disabled = true;
  const authorName = currentUser.user_metadata?.display_name || currentUser.email?.split("@")[0] || "航线同学";
  const { error } = await supabaseClient.from("feedback_messages").insert({ user_id: currentUser.id, author_name: authorName.slice(0, 40), content });
  button.disabled = false;
  if (error) return showToast(isMissingSchemaError(error) ? "请先在 Supabase 执行最新版 schema.sql" : "留言发布失败，请稍后重试");
  feedbackForm.reset();
  $("#feedbackCounter").textContent = "0 / 500";
  showToast("留言已发布");
  await loadFeedback();
});
feedbackBoard.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-feedback-id]");
  if (!button || !currentUser || !supabaseClient) return;
  button.disabled = true;
  const { error } = await supabaseClient.from("feedback_messages").delete().eq("id", button.dataset.feedbackId).eq("user_id", currentUser.id);
  if (error) return showToast("留言删除失败");
  showToast("留言已删除");
  await loadFeedback();
});

$$('[data-close-modal]').forEach((button) => button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop"))));
$$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(backdrop); }));
authTabs.forEach((tab) => tab.addEventListener("click", () => setAuthView(tab.dataset.authView)));
$("#loginForm").addEventListener("submit", submitLogin);
$("#registerForm").addEventListener("submit", submitRegister);
$("#resetForm").addEventListener("submit", submitReset);
$("#updatePasswordForm").addEventListener("submit", submitUpdatePassword);
resendConfirmationButton.addEventListener("click", resendConfirmation);

$("#viewAll").addEventListener("click", (event) => {
  const extraEvidence = $$(".extra-evidence");
  const willShow = extraEvidence.some((item) => item.hidden);
  extraEvidence.forEach((item) => { item.hidden = !willShow; });
  event.currentTarget.textContent = willShow ? "收起详情 ↑" : "查看全部 →";
  showToast(willShow ? "已展开全部 6 项能力证据" : "已收起次要能力");
});
$(".icon-button").addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = notificationMenu.hidden;
  closePopovers();
  notificationMenu.hidden = !willOpen;
});
profileButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = profileMenu.hidden;
  closePopovers();
  profileMenu.hidden = !willOpen;
});
$$('[data-notification]').forEach((button) => button.addEventListener("click", () => {
  button.remove();
  $(".notification-dot").hidden = true;
  showToast("已标记为已读");
}));
$$('[data-profile-action]').forEach((button) => button.addEventListener("click", async () => {
  const action = button.dataset.profileAction;
  if (action === "logout") return signOut();
  if (action === "profile") {
    fillEducationForm();
    openModal(educationModal, profileButton);
    return;
  }
  closePopovers();
  themeMenu.hidden = false;
}));
document.addEventListener("click", (event) => {
  if (!event.target.closest(".popover") && !event.target.closest(".top-actions")) closePopovers();
  if (!event.target.closest(".school-field")) $$("[data-school-results]").forEach((item) => { item.hidden = true; });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closePopovers();
  const openModalElement = $(".modal-backdrop:not([hidden])");
  if (openModalElement) closeModal(openModalElement);
});
$$('[data-scroll]').forEach((button) => button.addEventListener("click", () => $(button.dataset.scroll)?.scrollIntoView({ behavior: "smooth" })));
navLinks.forEach((link) => link.addEventListener("click", () => navLinks.forEach((item) => item.classList.toggle("active", item.getAttribute("href") === link.getAttribute("href")))));

const observedSections = $$("#dashboard, #evidence, #roles, #missions, #feedback");
const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  const href = `#${visible.target.id}`;
  navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === href));
}, { rootMargin: "-20% 0px -60% 0px", threshold: [0, .25, .5] });
observedSections.forEach((section) => sectionObserver.observe(section));

applyTheme(readJson("career-theme", themePresets[0]), false);
renderMissions();
renderRole(selectedRole);
renderRoleCategories();
renderRoleOptions();
setProfileUI(null);
updateFeedbackAccess();
loadUniversities();

if (supabaseClient) {
  authHint.textContent = "你的账号数据将通过 Supabase 安全保存。";
  supabaseClient.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => {
      handleAuthSession(session);
      if (event === "PASSWORD_RECOVERY") openAuthModal("update", null);
    }, 0);
  });
  supabaseClient.auth.getSession().then(({ data }) => handleAuthSession(data.session));
}
