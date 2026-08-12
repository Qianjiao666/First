const LOGIN_REQUIRED_EVENT = "mkj:login-required";
const EXPIRED_MESSAGE = "登录已失效，请重新登录。";

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

export async function mountAppShell({
  documentRef = document,
  locationRef = window.location,
  session = window.MKJSession || window.MKJApp?.session,
} = {}) {
  if (!session?.ready) return { destroy() {} };

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

  const applyState = (state) => {
    renderSessionState(documentRef, state);
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
    },
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.MKJSession = window.MKJApp?.session || window.MKJSession;
  void mountAppShell();
}

export { EXPIRED_MESSAGE, LOGIN_REQUIRED_EVENT, renderSessionState };
