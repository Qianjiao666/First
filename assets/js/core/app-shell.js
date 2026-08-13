import { renderAvatar, uploadAvatar, validateAvatarFile } from "../profile/avatar.js";
import { THEMES, getTheme, setTheme } from "../theme/theme-controller.js";

const LOGIN_REQUIRED_EVENT = "mkj:login-required";
const EXPIRED_MESSAGE = "登录已失效，请重新登录。";
const DISCLAIMER_TEXT = "本项目仅为学习演示Demo，请勿直接线上投入正式生产使用。";

function mountDisclaimer(documentRef) {
  if (typeof documentRef?.createElement !== "function") return;
  if (documentRef.querySelector("[data-mkj-disclaimer]")) return;
  const existing = [...documentRef.querySelectorAll("footer, p")].find((node) => node.textContent?.trim() === DISCLAIMER_TEXT);
  if (existing) {
    existing.dataset.mkjDisclaimer = "";
    return existing;
  }
  let disclaimer;
  try {
    disclaimer = documentRef.createElement("p");
  } catch {
    return;
  }
  disclaimer.className = "mkj-disclaimer-v11";
  disclaimer.dataset.mkjDisclaimer = "";
  disclaimer.textContent = DISCLAIMER_TEXT;
  const footer = documentRef.querySelector("footer");
  if (footer) footer.append(disclaimer);
  else documentRef.querySelector("main")?.insertAdjacentElement("afterend", disclaimer) || documentRef.body.append(disclaimer);
  return disclaimer;
}

function displayName(state) {
  return state?.user?.user_metadata?.display_name || "航线同学";
}

function accountText(state) {
  if (state?.status === "expired") return EXPIRED_MESSAGE;
  if (state?.status === "signed-in") return `已登录 · ${displayName(state)}`;
  if (state?.status === "unavailable") return state.reason || "账户服务暂不可用";
  return "登录 / 注册";
}

function renderSessionState(documentRef, state) {
  const text = accountText(state);
  const status = state?.status || "signed-out";
  const selectors = [
    "[data-mkj-session-state]",
    "[data-forum-account-link]",
    "[data-task-account-link]",
    "[data-task-reputation-badge]",
  ];

  const nodes = new Set(selectors.flatMap((selector) => [...documentRef.querySelectorAll(selector)]));
  for (const node of nodes) {
    node.textContent = text;
    node.dataset.mkjSessionState = status;
    if (node.dataset.forumAccountState !== undefined) node.dataset.forumAccountState = status;
    node.setAttribute?.("aria-label", text);
  }
}

function createLoginPrompt(documentRef) {
  const backdrop = documentRef.createElement("dialog");
  backdrop.className = "mkj-login-prompt-backdrop";
  backdrop.dataset.mkjLoginPrompt = "";
  backdrop.hidden = true;
  backdrop.setAttribute("aria-label", "登录账户");

  const dialog = documentRef.createElement("section");
  dialog.className = "mkj-login-prompt";
  const title = documentRef.createElement("h2");
  title.textContent = "需要登录";
  const reason = documentRef.createElement("p");
  reason.dataset.mkjLoginReason = "";
  const actions = documentRef.createElement("div");
  actions.className = "mkj-login-prompt-actions";
  const cancel = documentRef.createElement("button");
  cancel.type = "button";
  cancel.textContent = "取消";
  cancel.dataset.mkjLoginClose = "";
  const login = documentRef.createElement("a");
  login.href = "/MKJ/#account";
  login.textContent = "前往登录";
  actions.append(cancel, login);
  dialog.append(title, reason, actions);
  backdrop.append(dialog);
  cancel.addEventListener("click", () => {
    backdrop.close?.();
    backdrop.hidden = true;
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      backdrop.close?.();
      backdrop.hidden = true;
    }
  });
  documentRef.body.append(backdrop);
  return backdrop;
}

function createSettingsModal(documentRef, runtime) {
  const modal = documentRef.createElement("dialog");
  modal.id = "mkj-settings-modal-v11";
  modal.className = "mkj-settings-modal-v11";
  modal.setAttribute("aria-labelledby", "mkj-settings-title-v11");

  const panel = documentRef.createElement("section");
  panel.className = "mkj-settings-panel-v11";
  const header = documentRef.createElement("header");
  const title = documentRef.createElement("h2");
  title.id = "mkj-settings-title-v11";
  title.textContent = "个人设置";
  const close = documentRef.createElement("button");
  close.type = "button";
  close.className = "mkj-settings-close-v11";
  close.dataset.mkjSettingsClose = "";
  close.setAttribute("aria-label", "关闭个人设置");
  close.title = "关闭";
  close.textContent = "×";
  header.append(title, close);

  const themeSection = documentRef.createElement("fieldset");
  themeSection.className = "mkj-theme-options-v11";
  const themeLegend = documentRef.createElement("legend");
  themeLegend.textContent = "界面主题";
  themeSection.append(themeLegend);
  for (const [value, theme] of Object.entries(THEMES)) {
    const label = documentRef.createElement("label");
    const input = documentRef.createElement("input");
    input.type = "radio";
    input.name = "mkj-theme-v11";
    input.value = value;
    input.checked = value === getTheme();
    const swatch = documentRef.createElement("span");
    swatch.className = `mkj-theme-swatch-v11 is-${value}`;
    swatch.setAttribute("aria-hidden", "true");
    const copy = documentRef.createElement("span");
    copy.textContent = theme.label;
    input.addEventListener("change", () => setTheme(value));
    label.append(input, swatch, copy);
    themeSection.append(label);
  }

  const avatarSection = documentRef.createElement("section");
  avatarSection.className = "mkj-avatar-settings-v11";
  const avatarTitle = documentRef.createElement("h3");
  avatarTitle.textContent = "头像";
  const preview = documentRef.createElement("span");
  preview.className = "mkj-avatar-preview-v11";
  preview.dataset.mkjAvatarPreview = "";
  preview.textContent = "航";
  const input = documentRef.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.className = "mkj-avatar-file-v11";
  const upload = documentRef.createElement("button");
  upload.type = "button";
  upload.className = "mkj-settings-upload-v11";
  upload.textContent = "上传头像";
  upload.disabled = true;
  const status = documentRef.createElement("p");
  status.className = "mkj-settings-status-v11";
  status.setAttribute("role", "status");
  let selectedFile = null;

  input.addEventListener("change", () => {
    status.textContent = "";
    try {
      selectedFile = validateAvatarFile(input.files?.[0]);
      upload.disabled = false;
      const localUrl = URL.createObjectURL(selectedFile);
      preview.replaceChildren();
      const image = documentRef.createElement("img");
      image.src = localUrl;
      image.alt = "头像预览";
      image.addEventListener("load", () => URL.revokeObjectURL(localUrl), { once: true });
      preview.append(image);
    } catch (error) {
      selectedFile = null;
      upload.disabled = true;
      status.textContent = error.message;
      status.dataset.state = "error";
    }
  });

  upload.addEventListener("click", async () => {
    if (!selectedFile) return;
    upload.disabled = true;
    input.disabled = true;
    try {
      const result = await uploadAvatar({
        file: selectedFile,
        runtime,
        onState(state) {
          status.textContent = state.message;
          status.dataset.state = state.status;
        },
      });
      documentRef.querySelectorAll("[data-mkj-avatar-slot]").forEach((slot) => {
        renderAvatar(slot, { avatar: result.avatarUrl, displayName: displayName({ user: runtime?.session?.getState?.()?.user }) });
      });
      documentRef.dispatchEvent(new CustomEvent("mkj:avatar-updated", { detail: { avatarUrl: result.avatarUrl } }));
    } catch {
      // The inline status already contains the recoverable error.
    } finally {
      input.disabled = false;
      upload.disabled = !selectedFile;
    }
  });
  avatarSection.append(avatarTitle, preview, input, upload, status);
  panel.append(header, themeSection, avatarSection);
  modal.append(panel);
  documentRef.body.append(modal);
  return modal;
}

function createSettingsTrigger(documentRef) {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = "mkj-settings-trigger-v11";
  button.dataset.mkjSettingsTrigger = "";
  button.hidden = true;
  const avatar = documentRef.createElement("span");
  avatar.className = "mkj-nav-avatar-v11";
  avatar.dataset.mkjAvatarSlot = "";
  avatar.setAttribute("aria-hidden", "true");
  const label = documentRef.createElement("span");
  label.textContent = "个人设置";
  button.append(avatar, label);
  return button;
}

function createMobileNavTrigger(documentRef, nav) {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = "mkj-mobile-nav-trigger-v11";
  button.dataset.mkjMobileNavTrigger = "";
  button.setAttribute("aria-label", "打开导航菜单");
  button.setAttribute("aria-expanded", "false");
  if (!nav.id) nav.id = "mkj-mobile-nav-v11";
  button.setAttribute("aria-controls", nav.id);
  for (let index = 0; index < 3; index += 1) {
    const line = documentRef.createElement("span");
    line.setAttribute("aria-hidden", "true");
    button.append(line);
  }
  nav.classList.add("mkj-mobile-nav-target-v11");
  nav.setAttribute("data-mkj-mobile-nav-target", "");
  nav.insertAdjacentElement("beforebegin", button);

  const close = () => {
    nav.classList.remove("mkj-mobile-nav-open-v11");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "打开导航菜单");
  };
  const toggle = () => {
    const open = nav.classList.toggle("mkj-mobile-nav-open-v11");
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单");
  };
  button.addEventListener("click", toggle);
  nav.addEventListener("click", (event) => {
    if (event.target?.closest?.("a")) close();
  });
  return { button, close };
}

function mountMobileNavigation(documentRef) {
  if (documentRef.querySelector("#mkj-menu-button")) return null;
  const nav = documentRef.querySelector(".forum-site-nav, .task-nav, .shop-nav, .announce-nav");
  return nav ? createMobileNavTrigger(documentRef, nav) : null;
}

export async function mountAppShell({
  documentRef = document,
  locationRef = window.location,
  session = window.MKJSession || window.MKJApp?.session,
} = {}) {
  mountDisclaimer(documentRef);
  const mobileNavigation = mountMobileNavigation(documentRef);
  const closeMobileNavigation = (event) => {
    if (event.key === "Escape") mobileNavigation?.close();
  };
  documentRef.addEventListener("keydown", closeMobileNavigation);
  if (!session?.ready) {
    return {
      destroy() { documentRef.removeEventListener("keydown", closeMobileNavigation); },
    };
  }

  let prompt = documentRef.querySelector("[data-mkj-login-prompt]");
  const openLogin = (reason = "请先登录后再继续。") => {
    if (documentRef.querySelector("#mkj-auth-modal") || locationRef.pathname === "/MKJ/" || locationRef.pathname === "/MKJ/index.html") {
      locationRef.hash = "#account";
      documentRef.querySelector("#mkj-account-button")?.click?.();
      return;
    }
    prompt ||= createLoginPrompt(documentRef);
    const reasonNode = prompt.querySelector?.("[data-mkj-login-reason]");
    if (reasonNode) reasonNode.textContent = reason;
    prompt.hidden = false;
    if (!prompt.open) prompt.showModal?.();
  };
  const onLoginRequired = (event) => openLogin(event?.detail?.reason);
  documentRef.addEventListener(LOGIN_REQUIRED_EVENT, onLoginRequired);

  const runtime = globalThis.window?.MKJApp;
  const accountTarget = documentRef.querySelector("#mkj-account-button, [data-mkj-session-state], [data-forum-account-link], [data-task-account-link]");
  const trigger = accountTarget ? createSettingsTrigger(documentRef) : null;
  accountTarget?.insertAdjacentElement?.("afterend", trigger);
  let settingsModal = null;
  let settingsOpener = null;
  const closeSettings = () => {
    settingsModal?.close?.();
    settingsModal?.setAttribute?.("hidden", "");
    settingsOpener?.focus?.();
  };
  trigger?.addEventListener("click", () => {
    settingsOpener = trigger;
    settingsModal ||= createSettingsModal(documentRef, runtime);
    settingsModal.removeAttribute?.("hidden");
    if (!settingsModal.open) settingsModal.showModal?.();
    settingsModal.querySelector?.("input:checked, button")?.focus?.();
  });
  documentRef.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-mkj-settings-close]")) closeSettings();
  });
  documentRef.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && settingsModal?.open) closeSettings();
  });

  const applyState = (state) => {
    renderSessionState(documentRef, state);
    if (trigger) trigger.hidden = state?.status !== "signed-in";
    renderAvatar(trigger?.querySelector?.("[data-mkj-avatar-slot]"), {
      displayName: displayName(state),
      avatar: state?.identity?.avatar,
    });
    if (state?.status === "signed-in" && state?.user?.id && runtime?.getPublicUserIdentity) {
      void runtime.getPublicUserIdentity(state.user.id).then((identity) => {
        if (identity) renderAvatar(trigger?.querySelector?.("[data-mkj-avatar-slot]"), identity);
      }).catch(() => {});
    }
    if (state?.status === "expired") openLogin(EXPIRED_MESSAGE);
  };
  const initialState = await session.ready();
  applyState(initialState);
  const unsubscribe = session.subscribe(applyState, { immediate: false });

  return {
    openLogin,
    destroy() {
      unsubscribe?.();
      documentRef.removeEventListener(LOGIN_REQUIRED_EVENT, onLoginRequired);
      documentRef.removeEventListener("keydown", closeMobileNavigation);
    },
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.MKJSession = window.MKJApp?.session || window.MKJSession;
  void mountAppShell();
}

export { EXPIRED_MESSAGE, LOGIN_REQUIRED_EVENT, renderSessionState };
