const base = "/MKJ/assets/images/visual-v1.2/";

function mountVisualStylesheet() {
  if (document.querySelector('link[data-visual-v12-runtime]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/MKJ/assets/css/visual-v1.2.css?v=20260815-v1.2-runtime";
  link.dataset.visualV12Runtime = "";
  document.head.append(link);
}

function decorate(selector, src, alt, modifier) {
  const target = document.querySelector(selector);
  if (!target || target.querySelector(`img[data-visual-asset="${src}"]`)) return;
  const image = document.createElement("img");
  image.className = `visual-asset visual-asset--${modifier}`;
  image.alt = alt;
  image.loading = modifier === "hero" ? "eager" : "lazy";
  image.decoding = "async";
  image.src = `${base}${src}`;
  image.dataset.visualAsset = src;
  image.addEventListener("error", () => image.classList.add("is-failed"), { once: true });
  target.prepend(image);
}

function decoratePage() {
  mountVisualStylesheet();
  const path = window.location.pathname;
  if (path.endsWith("/index.html") && path.split("/").length <= 4) {
    decorate(".mkj-hero", "hero/home-hero-grid.png", "抽象科技网格背景", "hero");
    document.querySelectorAll(".mkj-feature-card").forEach((card, index) => {
      const names = ["community", "tasks", "rewards", "redeem", "profile", "security"];
      const name = names[index];
      if (name) decorateCard(card, `features/${name}.png`, `功能插图：${name}`, "feature");
    });
  }
  if (path.includes("/forum")) decorate(".forum-masthead, .forum-category-masthead", "forum/forum-header.png", "社区交流氛围插图", "feature");
  if (path.includes("/tasks")) decorate(".task-main, .task-page main", "tasks/progress.png", "任务进度辅助插图", "feature");
  if (path.includes("/profile") || path.includes("/account")) decorate(".profile-card, .account-card, main", "profile/card-bg.png", "个人中心背景插图", "feature");
}

function decorateCard(card, src, alt, modifier) {
  if (card.querySelector(`img[data-visual-asset="${src}"]`)) return;
  const image = document.createElement("img");
  image.className = `visual-asset visual-asset--${modifier}`;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.src = `${base}${src}`;
  image.dataset.visualAsset = src;
  image.addEventListener("error", () => image.classList.add("is-failed"), { once: true });
  card.prepend(image);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", decoratePage, { once: true });
else decoratePage();
