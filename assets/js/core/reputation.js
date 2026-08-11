export const REPUTATION_LEVELS = [
  { title: "游客", minimum: 0 },
  { title: "新手上路", minimum: 10 },
  { title: "初级会员", minimum: 100 },
  { title: "中级会员", minimum: 500 },
  { title: "高级会员", minimum: 1500 },
  { title: "金牌会员", minimum: 4000 },
  { title: "论坛元老", minimum: 10000 },
  { title: "至尊元老", minimum: 25000 },
  { title: "声望之神", minimum: 50000 },
];

let publicIdentityLoader = null;

function normalizeReputation(reputation) {
  return Math.max(0, Math.floor(Number.isFinite(reputation) ? reputation : 0));
}

export function getLevelInfo(reputation) {
  const value = normalizeReputation(reputation);
  const currentIndex = REPUTATION_LEVELS.reduce(
    (selectedIndex, level, index) => (level.minimum <= value ? index : selectedIndex),
    0,
  );
  const current = REPUTATION_LEVELS[currentIndex];
  const next = REPUTATION_LEVELS[currentIndex + 1] ?? null;

  if (!next) return { current, next: null, progress: 100, remaining: 0 };

  return {
    current,
    next,
    progress: Math.min(100, Math.floor(((value - current.minimum) / (next.minimum - current.minimum)) * 100)),
    remaining: Math.max(0, next.minimum - value),
  };
}

export function getUserTitle(role, reputation) {
  if (role === "ADMIN") return "管理员";
  if (role === "MODERATOR") return "版主";
  return getLevelInfo(reputation).current.title;
}

export function configureReputationBadge({ loadPublicIdentity } = {}) {
  publicIdentityLoader = typeof loadPublicIdentity === "function" ? loadPublicIdentity : null;
}

function updateBadge(element, options) {
  const reputation = normalizeReputation(options.reputation);
  const info = getLevelInfo(reputation);
  const compact = Boolean(options.compact);

  element.replaceChildren();
  element.className = `mkj-reputation-badge${compact ? " mkj-reputation-badge-compact" : ""}`;
  element.dataset.role = options.role || "USER";
  element.dataset.userId = options.userId || "";

  const title = document.createElement("span");
  title.className = "mkj-reputation-title";
  title.textContent = getUserTitle(options.role || "USER", reputation);
  element.append(title);

  if (compact) return element;

  const details = document.createElement("span");
  details.className = "mkj-reputation-details";
  details.textContent = `${reputation.toLocaleString("zh-CN")} 声望`;

  const progress = document.createElement("span");
  progress.className = "mkj-reputation-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", String(info.progress));

  const fill = document.createElement("span");
  fill.className = "mkj-reputation-progress-fill";
  fill.style.width = `${info.progress}%`;
  progress.append(fill);

  const next = document.createElement("span");
  next.className = "mkj-reputation-next";
  next.textContent = info.next ? `距${info.next.title}还需 ${info.remaining}` : "已达到最高等级";

  element.append(details, progress, next);
  return element;
}

export function createReputationBadge(options = {}) {
  const element = document.createElement("span");
  const hasReputation = Number.isFinite(options.reputation);

  if (hasReputation || !options.userId || !publicIdentityLoader) {
    return updateBadge(element, options);
  }

  element.className = "mkj-reputation-badge mkj-reputation-badge-loading";
  element.textContent = "加载声望";
  element.dataset.userId = options.userId;

  publicIdentityLoader(options.userId)
    .then((identity) => {
      if (!identity) return updateBadge(element, options);
      return updateBadge(element, { ...options, ...identity });
    })
    .catch(() => updateBadge(element, options));

  return element;
}

export function renderReputationBadge(container, options = {}) {
  const badge = createReputationBadge(options);
  container.replaceChildren(badge);
  return badge;
}
