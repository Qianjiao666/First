const toast = document.querySelector("#toast");
const missions = [...document.querySelectorAll("[data-mission]")];
const missionCount = document.querySelector("#missionCount");
const roleModal = document.querySelector("#roleModal");
const infoModal = document.querySelector("#infoModal");
const notificationMenu = document.querySelector("#notificationMenu");
const profileMenu = document.querySelector("#profileMenu");
const roleOptions = [...document.querySelectorAll("[data-role]")];
const targetPanel = document.querySelector("#roles");
const navLinks = [...document.querySelectorAll(".main-nav a")];
let selectedRole = localStorage.getItem("career-role") || "frontend";
let activeOpener = null;

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
  const role = roleData[roleKey];
  targetPanel.querySelector("h2").textContent = role.name;
  const tagContainer = targetPanel.querySelector(".role-meta");
  tagContainer.innerHTML = role.tags.map((tag) => `<span>${tag}</span>`).join("");
  targetPanel.querySelector(".role-line strong").textContent = role.jobs;
  targetPanel.querySelector(".role-footer > span").textContent = `目标画像完成度 ${role.completion}%`;
  targetPanel.querySelector(".mini-progress span").style.width = `${role.completion}%`;
  document.querySelector(".certainty-meter > span").style.width = `${role.score}%`;
  document.querySelector(".certainty-meter").setAttribute("aria-label", `就业确定性指数 ${role.score} 分`);
  document.querySelector(".score-status").lastChild.textContent = role.status;
  roleOptions.forEach((option) => option.classList.toggle("selected", option.dataset.role === roleKey));
  if (animate) animateScore(role.score);
  else document.querySelector("#score").textContent = role.score;
}

function updateMissionCount() {
  const completed = missions.filter((mission) => mission.classList.contains("completed")).length;
  missionCount.textContent = completed;
}

function saveMissions() {
  const state = missions.map((mission) => mission.classList.contains("completed"));
  localStorage.setItem("career-missions", JSON.stringify(state));
}

function restoreMissions() {
  let state = [true, false, false];
  try {
    const saved = JSON.parse(localStorage.getItem("career-missions"));
    if (Array.isArray(saved) && saved.length === missions.length) state = saved;
  } catch {
    localStorage.removeItem("career-missions");
  }

  missions.forEach((mission, index) => {
    mission.classList.toggle("completed", state[index]);
    mission.querySelector(".checkbox").textContent = state[index] ? "✓" : "";
    mission.setAttribute("aria-pressed", String(state[index]));
  });
  updateMissionCount();
}

missions.forEach((mission) => {
  mission.addEventListener("click", () => {
    const completed = mission.classList.toggle("completed");
    mission.querySelector(".checkbox").textContent = completed ? "✓" : "";
    mission.setAttribute("aria-pressed", String(completed));
    updateMissionCount();
    saveMissions();
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

document.querySelector("#confirmRole").addEventListener("click", () => {
  localStorage.setItem("career-role", selectedRole);
  renderRole(selectedRole, true);
  closeModal(roleModal);
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

document.querySelector("#viewAll").addEventListener("click", (event) => {
  const extraEvidence = [...document.querySelectorAll(".extra-evidence")];
  const willShow = extraEvidence.some((item) => item.hidden);
  extraEvidence.forEach((item) => { item.hidden = !willShow; });
  event.currentTarget.innerHTML = willShow ? '收起详情 <span>↑</span>' : '查看全部 <span>→</span>';
  showToast(willShow ? "已展开全部 6 项能力证据" : "已收起次要能力");
});

document.querySelector(".icon-button").addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = notificationMenu.hidden;
  closePopovers();
  notificationMenu.hidden = !willOpen;
});

document.querySelector(".profile-button").addEventListener("click", (event) => {
  event.stopPropagation();
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
  button.addEventListener("click", () => {
    const messages = {
      profile: "个人资料编辑将在账户系统接入后开放",
      settings: "偏好设置已准备好接入真实账户数据",
      logout: "当前是演示模式，无需退出",
    };
    closePopovers();
    showToast(messages[button.dataset.profileAction]);
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

restoreMissions();
renderRole(selectedRole);
