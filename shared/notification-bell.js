const NOTIFICATIONS_FUNCTION = "notifications";

export function normalizeNotification(value = {}) {
  const payload = value.payload && typeof value.payload === "object" && !Array.isArray(value.payload)
    ? { ...value.payload }
    : {};
  return {
    id: String(value.id ?? ""),
    type: String(value.type ?? "notification"),
    payload,
    readAt: value.read_at ?? value.readAt ?? null,
    createdAt: value.created_at ?? value.createdAt ?? null,
  };
}

export function formatNotificationCount(value) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  if (!count) return "";
  return count > 99 ? "99+" : String(count);
}

export function notificationEventFilter(userId) {
  return `recipient_id=eq.${String(userId)}`;
}

function notificationTitle(item) {
  return String(item.payload.title ?? item.payload.message ?? item.type);
}

function notificationTime(item) {
  if (!item.createdAt) return "";
  const date = new Date(item.createdAt);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN");
}

function replaceChildren(parent, children) {
  parent.replaceChildren(...children);
}

export function createNotificationBell({ runtime = globalThis.MKJApp, documentRef = globalThis.document } = {}) {
  if (!documentRef) throw new Error("Notification bell requires a document.");

  const root = documentRef.createElement("div");
  root.className = "notification-bell";
  root.dataset.notificationBell = "";

  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = "notification-bell-trigger";
  button.setAttribute("aria-label", "通知");
  button.setAttribute("aria-expanded", "false");
  button.textContent = "通知";
  const badge = documentRef.createElement("span");
  badge.className = "notification-bell-count";
  badge.setAttribute("aria-live", "polite");
  button.append(badge);

  const panel = documentRef.createElement("section");
  panel.className = "notification-bell-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "通知列表");
  const heading = documentRef.createElement("div");
  heading.className = "notification-bell-heading";
  const headingText = documentRef.createElement("strong");
  headingText.textContent = "通知";
  const readAll = documentRef.createElement("button");
  readAll.type = "button";
  readAll.className = "notification-bell-read-all";
  readAll.textContent = "全部已读";
  heading.append(headingText, readAll);
  const list = documentRef.createElement("ul");
  list.className = "notification-bell-list";
  panel.append(heading, list);
  root.append(button, panel);

  let notifications = [];
  let channel = null;
  let currentUserId = null;
  let reconnectTimer = null;
  let destroyed = false;

  const setUnread = (count) => {
    const label = formatNotificationCount(count);
    badge.textContent = label;
    badge.hidden = !label;
    button.dataset.notificationUnread = String(count);
  };

  const render = () => {
    const rows = notifications.map((item) => {
      const row = documentRef.createElement("li");
      row.className = "notification-bell-item";
      if (!item.readAt) row.classList.add("is-unread");
      row.dataset.notificationId = item.id;
      const title = documentRef.createElement("strong");
      title.textContent = notificationTitle(item);
      const time = documentRef.createElement("time");
      time.textContent = notificationTime(item);
      row.append(title, time);
      if (!item.readAt) {
        const mark = documentRef.createElement("button");
        mark.type = "button";
        mark.className = "notification-bell-mark";
        mark.textContent = "标记已读";
        mark.addEventListener("click", () => markRead(item.id));
        row.append(mark);
      }
      return row;
    });
    if (!rows.length) {
      const empty = documentRef.createElement("li");
      empty.className = "notification-bell-empty";
      empty.textContent = "暂无通知";
      rows.push(empty);
    }
    replaceChildren(list, rows);
    setUnread(notifications.filter((item) => !item.readAt).length);
  };

  const invoke = async (body = {}, method = "POST") => {
    if (typeof runtime?.invokeFunction !== "function") throw new Error("通知服务暂不可用。");
    return runtime.invokeFunction(NOTIFICATIONS_FUNCTION, body, method);
  };

  const load = async () => {
    const result = await invoke({}, "GET");
    notifications = Array.isArray(result?.notifications)
      ? result.notifications.map(normalizeNotification)
      : [];
    render();
    return notifications;
  };

  async function markRead(id) {
    await invoke({ action: "read", id });
    const item = notifications.find((entry) => entry.id === id);
    if (item) item.readAt = new Date().toISOString();
    render();
  }

  async function markAllRead() {
    await invoke({ action: "readAll" });
    notifications.forEach((item) => { item.readAt ||= new Date().toISOString(); });
    render();
  }

  const scheduleReconnect = () => {
    if (destroyed || reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      subscribeForUser(currentUserId);
    }, 1500);
  };

  const stopChannel = () => {
    if (channel && runtime?.client?.removeChannel) runtime.client.removeChannel(channel);
    channel = null;
  }

  const subscribeForUser = (userId) => {
    if (destroyed || !runtime?.client?.channel || !userId || channel) return;
    currentUserId = userId;
    channel = runtime.client
      .channel(`notifications:${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications", filter: notificationEventFilter(userId),
      }, () => { void load().catch(() => {}); })
      .subscribe((status) => {
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          channel = null;
          scheduleReconnect();
        }
      });
  };

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
  });
  readAll.addEventListener("click", () => { void markAllRead().catch(() => {}); });

  const destroy = () => {
    destroyed = true;
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    stopChannel();
    currentUserId = null;
  };

  const bootstrap = async () => {
    const user = await runtime?.getCurrentUser?.().catch(() => null);
    if (!user) {
      stopChannel();
      currentUserId = null;
      notifications = [];
      render();
      root.hidden = true;
      return;
    }
    if (currentUserId && currentUserId !== user.id) stopChannel();
    root.hidden = false;
    await load();
    subscribeForUser(user.id);
  };

  return { element: root, load, markRead, markAllRead, bootstrap, destroy };
}

export function mountNotificationBell({ root, runtime = globalThis.MKJApp, documentRef = globalThis.document } = {}) {
  const mount = typeof root === "string" ? documentRef?.querySelector(root) : root;
  if (!mount) return null;
  const bell = createNotificationBell({ runtime, documentRef });
  mount.replaceChildren(bell.element);
  void bell.bootstrap().catch(() => { bell.element.hidden = true; });
  runtime?.onSessionChange?.(() => { void bell.bootstrap().catch(() => {}); });
  return bell;
}
