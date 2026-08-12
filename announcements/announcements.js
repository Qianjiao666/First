const ANNOUNCEMENTS_FUNCTION = "announcements";

export function normalizeAnnouncement(value = {}) {
  return {
    id: String(value.id ?? ""),
    slug: String(value.slug ?? ""),
    title: String(value.title ?? "未命名公告"),
    markdown: String(value.markdown ?? value.body_markdown ?? value.content ?? ""),
    status: String(value.status ?? "published"),
    isPinned: Boolean(value.is_pinned ?? value.isPinned),
    publishedAt: value.published_at ?? value.publishedAt ?? null,
  };
}

export function hasAnnouncementCapability(capabilities, action) {
  return Array.isArray(capabilities) && capabilities.includes(`announce:${action}`);
}

function unwrapItems(result) {
  const items = result?.items ?? result?.announcements ?? result;
  return Array.isArray(items) ? items : [];
}

function fallbackSlug(title, seed = "announcement") {
  const slug = String(title ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || seed || `announcement-${Date.now()}`;
}

async function invokePublic(runtime, body, method = "POST") {
  if (typeof runtime?.invokeFunction === "function") {
    const session = typeof runtime.getSession === "function"
      ? await runtime.getSession().catch(() => null)
      : true;
    if (session) return runtime.invokeFunction(ANNOUNCEMENTS_FUNCTION, method === "GET" ? {} : body, method);
  }
  const config = runtime?.config ?? globalThis.SUPABASE_CONFIG;
  if (!config?.url || !config.publishableKey) throw new Error("公告服务暂不可用，请稍后重试。");
  const response = await fetch(`${config.url}/functions/v1/${ANNOUNCEMENTS_FUNCTION}`, {
    method,
    headers: { apikey: config.publishableKey, "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || "公告服务暂不可用，请稍后重试。");
  return result;
}

export function createAnnouncementsApi(runtime = globalThis.MKJApp) {
  return {
    async list({ management = false } = {}) {
      const session = management && typeof runtime?.getSession === "function"
        ? await runtime.getSession().catch(() => null)
        : null;
      const result = await invokePublic(runtime, { action: "list" }, session ? "POST" : "GET");
      return unwrapItems(result).map(normalizeAnnouncement);
    },
    async create({ title, markdown, slug, status = "published", isPinned = false }) {
      await runtime?.requireAuthenticatedAction?.({ reason: "发布公告" });
      return invokePublic(runtime, {
        action: "upsert",
        slug: String(slug || fallbackSlug(title)),
        title: String(title ?? "").trim(),
        bodyMarkdown: String(markdown ?? ""),
        status,
        isPinned: Boolean(isPinned),
      });
    },
    async update(id, { title, markdown, slug, status = "published", isPinned = false }) {
      await runtime?.requireAuthenticatedAction?.({ reason: "编辑公告" });
      return invokePublic(runtime, {
        action: "upsert",
        id: String(id),
        slug: String(slug || fallbackSlug(title, `announcement-${id}`)),
        title: String(title ?? "").trim(),
        bodyMarkdown: String(markdown ?? ""),
        status,
        isPinned: Boolean(isPinned),
      });
    },
    async setPinned(id, isPinned, current = {}) {
      await runtime?.requireAuthenticatedAction?.({ reason: "管理公告" });
      return invokePublic(runtime, {
        action: "upsert",
        id: String(id),
        slug: String(current.slug || fallbackSlug(current.title, `announcement-${id}`)),
        title: String(current.title ?? "公告"),
        bodyMarkdown: String(current.markdown ?? ""),
        status: String(current.status || "published"),
        isPinned: Boolean(isPinned),
      });
    },
    async remove(id) {
      await runtime?.requireAuthenticatedAction?.({ reason: "删除公告" });
      return invokePublic(runtime, { action: "delete", id: String(id) });
    },
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

function safeHref(value) {
  const href = String(value).trim();
  return /^https?:\/\//i.test(href) ? href : null;
}

function renderInline(value) {
  let output = escapeHtml(value);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const safe = safeHref(href);
    return safe
      ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
  });
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return output;
}

export function renderMarkdownToHtml(markdown = "") {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(4, heading[1].length + 1);
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    } else if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks.join("");
}

function announcementCard(announcement, { capabilities, onEdit, onPin, onDelete, documentRef }) {
  const item = normalizeAnnouncement(announcement);
  const article = documentRef.createElement("article");
  article.className = "announce-card";
  article.dataset.announceId = item.id;
  if (item.isPinned) article.classList.add("is-pinned");
  const header = documentRef.createElement("header");
  header.className = "announce-card-header";
  const title = documentRef.createElement("h2");
  title.className = "announce-card-title";
  title.textContent = item.title;
  header.append(title);
  if (item.isPinned) {
    const pin = documentRef.createElement("span");
    pin.className = "announce-pin-label";
    pin.textContent = "置顶";
    header.append(pin);
  }
  const body = documentRef.createElement("div");
  body.className = "announce-card-body";
  body.innerHTML = renderMarkdownToHtml(item.markdown);
  const footer = documentRef.createElement("footer");
  footer.className = "announce-card-footer";
  const date = documentRef.createElement("time");
  date.className = "announce-card-date";
  if (item.publishedAt) date.dateTime = item.publishedAt;
  date.textContent = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("zh-CN") : "草稿";
  footer.append(date);
  if (hasAnnouncementCapability(capabilities, "update")) {
    const edit = documentRef.createElement("button");
    edit.type = "button";
    edit.className = "announce-button announce-button-quiet";
    edit.dataset.announceCapability = "announce:update";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => onEdit?.(item));
    footer.append(edit);
  }
  if (hasAnnouncementCapability(capabilities, "pin")) {
    const pin = documentRef.createElement("button");
    pin.type = "button";
    pin.className = "announce-button announce-button-quiet";
    pin.textContent = item.isPinned ? "取消置顶" : "置顶";
    pin.addEventListener("click", () => onPin?.(item));
    footer.append(pin);
  }
  if (hasAnnouncementCapability(capabilities, "delete")) {
    const remove = documentRef.createElement("button");
    remove.type = "button";
    remove.className = "announce-button announce-button-danger";
    remove.textContent = "删除";
    remove.addEventListener("click", () => onDelete?.(item));
    footer.append(remove);
  }
  article.append(header, body, footer);
  return article;
}

export function createAnnouncementBanner(announcement, documentRef = document) {
  const item = normalizeAnnouncement(announcement);
  const banner = documentRef.createElement("aside");
  banner.className = "announce-banner";
  banner.dataset.announceBanner = item.id;
  const label = documentRef.createElement("span");
  label.className = "announce-banner-label";
  label.textContent = "公告";
  const title = documentRef.createElement("strong");
  title.className = "announce-banner-title";
  title.textContent = item.title;
  banner.append(label, title);
  const body = documentRef.createElement("div");
  body.className = "announce-banner-body";
  body.innerHTML = renderMarkdownToHtml(item.markdown);
  banner.append(body);
  return banner;
}

export async function mountAnnouncementBanner({ root, runtime = globalThis.MKJApp } = {}) {
  const mount = typeof root === "string" ? document.querySelector(root) : root;
  if (!mount) return null;
  const items = await createAnnouncementsApi(runtime).list();
  const pinned = items.find((item) => item.isPinned);
  mount.replaceChildren(...(pinned ? [createAnnouncementBanner(pinned)] : []));
  return pinned ?? null;
}

async function bootstrap() {
  const root = document.querySelector("[data-announce-root]");
  if (!root) return;
  const runtime = globalThis.MKJApp;
  await runtime?.ready?.();
  const api = createAnnouncementsApi(runtime);
  const capabilities = await runtime?.getCapabilities?.().catch(() => []) ?? [];
  const list = root.querySelector("[data-announce-list]");
  const form = root.querySelector("[data-announce-form]");
  const status = root.querySelector("[data-announce-status]");
  const titleInput = form?.querySelector("[name=title]");
  const markdownInput = form?.querySelector("[name=markdown]");
  const editingId = form?.querySelector("[name=id]");
  const setStatus = (message, tone = "info") => {
    if (!status) return;
    status.hidden = !message;
    status.textContent = message;
    status.dataset.announceTone = tone;
  };
  root.querySelectorAll("[data-announce-capability]").forEach((node) => {
    node.hidden = !hasAnnouncementCapability(capabilities, node.dataset.announceCapability.replace("announce:", ""));
  });
  const canWrite = hasAnnouncementCapability(capabilities, "create");
  if (form && !canWrite) form.hidden = true;

  let items = [];
  const render = () => {
    list?.replaceChildren(...items.map((item) => announcementCard(item, {
      capabilities,
      documentRef: document,
      onEdit: (itemToEdit) => {
        if (!form) return;
        form.hidden = false;
        editingId.value = itemToEdit.id;
        titleInput.value = itemToEdit.title;
        markdownInput.value = itemToEdit.markdown;
        form.querySelector("[type=submit]").textContent = "保存修改";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      onPin: async (itemToPin) => {
        try { await api.setPinned(itemToPin.id, !itemToPin.isPinned, itemToPin); setStatus("置顶状态已更新。", "success"); await load(); }
        catch (error) { setStatus(error?.message || "置顶失败。", "error"); }
      },
      onDelete: async (itemToDelete) => {
        if (!window.confirm(`确定删除公告“${itemToDelete.title}”？`)) return;
        try { await api.remove(itemToDelete.id); setStatus("公告已删除。", "success"); await load(); }
        catch (error) { setStatus(error?.message || "删除失败。", "error"); }
      },
    })));
    if (!items.length && list) {
      const empty = document.createElement("p");
      empty.className = "announce-empty";
      empty.textContent = "还没有公告。";
      list.append(empty);
    }
  };
  async function load() {
    try {
      items = (await api.list({ management: hasAnnouncementCapability(capabilities, "create") }))
        .sort((left, right) => Number(right.isPinned) - Number(left.isPinned));
      render();
    }
    catch (error) { setStatus(error?.message || "公告暂时无法加载。", "error"); }
  }
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const markdown = markdownInput.value.trim();
    if (!title || !markdown) { setStatus("请填写标题和正文。", "error"); return; }
    const id = editingId.value;
    const action = id ? api.update(id, { title, markdown }) : api.create({ title, markdown });
    try {
      await action;
      setStatus(id ? "公告已更新。" : "公告已发布。", "success");
      form.reset();
      editingId.value = "";
      form.querySelector("[type=submit]").textContent = "发布公告";
      await load();
    } catch (error) { setStatus(error?.message || "保存失败。", "error"); }
  });
  await load();
}

if (typeof document !== "undefined") bootstrap();
