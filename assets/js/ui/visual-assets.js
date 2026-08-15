const base = "/MKJ/assets/images/visual-v1.2/";

function addImage(target, src, alt, modifier) {
  if (!target || target.querySelector(`img[data-visual-asset="${src}"]`)) return;
  const image = document.createElement("img");
  image.className = `visual-asset visual-asset--${modifier}`;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.src = `${base}${src}`;
  image.dataset.visualAsset = src;
  image.addEventListener("error", () => image.classList.add("is-failed"), { once: true });
  target.prepend(image);
}

function decorateFeatureCards() {
  const names = [
    ["community", "社区协作功能插图"],
    ["tasks", "任务系统功能插图"],
    ["rewards", "积分奖励功能插图"],
  ];
  document.querySelectorAll(".mkj-feature-card").forEach((card, index) => {
    const item = names[index];
    if (item) addImage(card, `features/${item[0]}.png`, item[1], "feature");
  });
}

function createParticleField(target) {
  if (!target || target.querySelector(".hx-particle-field")) return;
  const canvas = document.createElement("canvas");
  canvas.className = "hx-particle-field";
  canvas.setAttribute("aria-hidden", "true");
  target.prepend(canvas);
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = matchMedia("(pointer: coarse)");
  let width = 0;
  let height = 0;
  let ratio = 1;
  let frame = 0;
  let running = true;
  let pointerX = 0;
  let pointerY = 0;
  let particles = [];

  function resize() {
    const rect = target.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.max(36, Math.min(coarse.matches ? 56 : 94, Math.round(width / 7)));
    particles = Array.from({ length: count }, (_, index) => ({
      angle: (index / count) * Math.PI * 2 + Math.random() * .2,
      orbit: .24 + Math.random() * .58,
      size: .7 + Math.random() * 1.9,
      speed: (.0007 + Math.random() * .0015) * (index % 3 === 0 ? -1 : 1),
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function draw(time = 0) {
    context.clearRect(0, 0, width, height);
    const cx = width * .5 + pointerX * 14;
    const cy = height * .46 + pointerY * 10;
    const rx = Math.min(width, height) * .42;
    const ry = rx * .54;
    context.globalCompositeOperation = "lighter";
    particles.forEach((particle, index) => {
      const angle = particle.angle + time * particle.speed;
      const ripple = Math.sin(time * .0012 + particle.phase) * 5;
      const x = cx + Math.cos(angle) * (rx * particle.orbit + ripple);
      const y = cy + Math.sin(angle) * (ry * particle.orbit + ripple * .4);
      const alpha = .24 + (Math.sin(time * .001 + particle.phase) + 1) * .22;
      context.beginPath();
      context.fillStyle = index % 7 === 0 ? `rgba(186,255,50,${alpha})` : `rgba(93,230,207,${alpha})`;
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fill();
      if (index % 9 === 0) {
        context.beginPath();
        context.strokeStyle = `rgba(89,202,187,${alpha * .22})`;
        context.moveTo(cx, cy);
        context.lineTo(x, y);
        context.stroke();
      }
    });
    context.globalCompositeOperation = "source-over";
    if (running && !reduceMotion.matches) frame = requestAnimationFrame(draw);
  }

  const observer = new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting;
    cancelAnimationFrame(frame);
    if (running && !reduceMotion.matches) frame = requestAnimationFrame(draw);
  });
  const resizeObserver = new ResizeObserver(resize);
  target.addEventListener("pointermove", (event) => {
    const rect = target.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - .5;
    pointerY = (event.clientY - rect.top) / rect.height - .5;
  }, { passive: true });
  target.addEventListener("pointerleave", () => { pointerX = 0; pointerY = 0; }, { passive: true });
  reduceMotion.addEventListener("change", () => { cancelAnimationFrame(frame); draw(0); });
  resizeObserver.observe(target);
  observer.observe(target);
  resize();
  draw(0);
}

function decoratePage() {
  const path = window.location.pathname;
  if (document.querySelector(".mkj-hero")) {
    decorateFeatureCards();
    createParticleField(document.querySelector(".mkj-hero-visual"));
  }
  if (path.includes("/forum")) createParticleField(document.querySelector(".forum-masthead, .forum-category-masthead"));
  if (path.includes("/profile") || path.includes("/account")) {
    addImage(document.querySelector(".profile-card, .account-card, main"), "profile/card-bg.png", "个人中心信号背景", "feature");
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", decoratePage, { once: true });
else decoratePage();
