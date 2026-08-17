const journey = document.querySelector("[data-image-journey]");

if (journey) {
  const cards = [...journey.querySelectorAll("[data-journey-card]")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const clearPointerState = (card) => {
    card.style.removeProperty("--journey-tilt-x");
    card.style.removeProperty("--journey-tilt-y");
    card.style.removeProperty("--journey-image-x");
    card.style.removeProperty("--journey-image-y");
  };

  const resetMotion = () => {
    cards.forEach((card) => {
      card.classList.remove("is-journey-active");
      clearPointerState(card);
    });
  };

  cards.forEach((card) => {
    const image = card.querySelector("img");
    image?.addEventListener("error", () => card.classList.add("is-image-failed"), { once: true });

    if (!finePointer.matches) return;

    card.addEventListener("pointermove", (event) => {
      if (reduceMotion.matches) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--journey-tilt-x", `${(x * 1.4).toFixed(2)}deg`);
      card.style.setProperty("--journey-tilt-y", `${(-y * 1.4).toFixed(2)}deg`);
      card.style.setProperty("--journey-image-x", `${(x * 2.5).toFixed(2)}%`);
      card.style.setProperty("--journey-image-y", `${(-y * 2.5).toFixed(2)}%`);
    }, { passive: true });
    card.addEventListener("pointerleave", () => clearPointerState(card), { passive: true });
  });

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    cards.forEach((card) => card.classList.add("is-journey-active"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-journey-active");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.18 });
    cards.forEach((card) => observer.observe(card));
  }

  const onMotionPreferenceChange = () => {
    if (reduceMotion.matches) resetMotion();
    else cards.forEach((card) => card.classList.remove("is-journey-active"));
  };
  if (typeof reduceMotion.addEventListener === "function") reduceMotion.addEventListener("change", onMotionPreferenceChange);
}
