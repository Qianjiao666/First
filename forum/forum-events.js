import {
  categoryUrl,
  fetchCategories,
  fetchComments,
  fetchPost,
  fetchPosts,
  fetchTags,
  normalizeForumFilters,
  normalizeVote,
  postUrl,
  moderateContent,
  writeComment,
  writePost,
  writeVote,
} from "./forum-api.js";
import { renderAuthor, renderCategoryList, renderComment, renderEmpty, renderError, renderPostCard, renderPostDetail, setLoading } from "./forum-render.js";

const page = document.body?.dataset.forumPage;
let capabilities = [];
let stopAccountSync = null;
let accountSyncVersion = 0;

function can(...names) {
  return names.some((name) => capabilities.includes(name));
}

function runtime() {
  return window.MKJApp;
}

async function loadCapabilities() {
  const app = runtime();
  if (!app?.getCapabilities) throw new Error("Sign in to access community actions.");
  capabilities = await app.getCapabilities();
  return capabilities;
}

function status(message, error = false) {
  const target = document.querySelector("[data-forum-status]");
  if (!target) return;
  target.hidden = false;
  target.dataset.state = error ? "error" : "success";
  target.textContent = message;
}

function setBusy(form, busy) {
  form?.querySelectorAll("button, input, textarea, select").forEach((control) => { control.disabled = busy; });
  form?.classList.toggle("is-busy", busy);
}

function addFilterControls(container, current) {
  if (!container || container.querySelector("[data-forum-filters]")) return;
  const filters = document.createElement("form");
  filters.className = "forum-filters";
  filters.dataset.forumFilters = "";
  filters.setAttribute("role", "search");
  const sortLabel = document.createElement("label");
  sortLabel.className = "forum-filter-control";
  sortLabel.append(document.createElement("span"));
  sortLabel.firstChild.textContent = "Sort";
  const sort = document.createElement("select");
  sort.name = "sort";
  ["latest", "hot", "top"].forEach((value) => sort.append(new Option(value === "latest" ? "Latest" : value === "hot" ? "Hot" : "Top", value, false, value === current.sort)));
  sortLabel.append(sort);
  const tagLabel = document.createElement("label");
  tagLabel.className = "forum-filter-control";
  tagLabel.append(document.createElement("span"));
  tagLabel.firstChild.textContent = "Tag";
  const tag = document.createElement("select");
  tag.name = "tag";
  tag.append(new Option("All tags", "", false, !current.tag));
  tagLabel.append(tag);
  const queryLabel = document.createElement("label");
  queryLabel.className = "forum-filter-search";
  queryLabel.append(document.createElement("span"));
  queryLabel.firstChild.textContent = "Search";
  const query = document.createElement("input");
  query.name = "q";
  query.type = "search";
  query.placeholder = "Find a discussion";
  query.value = current.query;
  queryLabel.append(query);
  const submit = document.createElement("button");
  submit.className = "forum-button forum-button-secondary";
  submit.type = "submit";
  submit.textContent = "Apply";
  filters.append(sortLabel, tagLabel, queryLabel, submit);
  container.prepend(filters);
  filters.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const values = new FormData(filters);
    ["sort", "tag", "q"].forEach((key) => {
      const value = String(values.get(key) || "");
      if (value) params.set(key, value); else params.delete(key);
    });
    window.location.assign(`${window.location.pathname}?${params.toString()}`);
  });
  fetchTags().then((tags) => tags.forEach((item) => tag.append(new Option(`#${item.name}`, item.slug || item.id, false, current.tag === item.slug || current.tag === item.id)))).catch(() => {});
}

async function loadCategoryRail(activeSlug) {
  const container = document.querySelector("[data-forum-categories]");
  if (!container) return;
  try {
    const categories = await fetchCategories();
    container.replaceChildren(renderCategoryList(categories, activeSlug));
  } catch (error) {
    renderError(container, error.message, () => loadCategoryRail(activeSlug));
  }
}

function setActiveSort(sort) {
  document.querySelectorAll("[data-forum-sort]").forEach((link) => {
    const active = link.dataset.forumSort === sort;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
}

async function loadPostStream({ slug = null } = {}) {
  const container = document.querySelector("[data-forum-posts]");
  if (!container) return;
  const route = normalizeForumFilters({ sort: new URLSearchParams(window.location.search).get("sort"), tag: new URLSearchParams(window.location.search).get("tag"), query: new URLSearchParams(window.location.search).get("q") });
  setLoading(container);
  setActiveSort(route.sort);
  try {
    const result = await fetchPosts({ slug, ...route });
    if (result.category) {
      const title = document.querySelector("[data-forum-category-title]");
      const description = document.querySelector("[data-forum-category-description]");
      if (title) title.textContent = result.category.name || "Forum";
      if (description) description.textContent = result.category.description || "Share a concrete experience.";
    }
    addFilterControls(container.parentElement, route);
    if (!result.posts.length) {
      const action = document.querySelector("[data-forum-new-link]")?.cloneNode(true) || document.querySelector(".forum-new-post-link")?.cloneNode(true);
      renderEmpty(container, "No discussions match", "Try another tag or search term, or start the first discussion.", action);
    } else container.replaceChildren(...result.posts.map(renderPostCard));
  } catch (error) {
    renderError(container, error.message, () => loadPostStream({ slug }));
  }
}

function appendCommentForm(container, postId) {
  if (!can("forum:createComment")) {
    const notice = document.createElement("p");
    notice.className = "forum-locked-notice";
    notice.textContent = "Sign in with comment permission to join this discussion.";
    container.replaceChildren(notice);
    return;
  }
  const form = document.createElement("form");
  form.className = "forum-comment-form";
  form.dataset.forumCommentForm = "";
  const label = document.createElement("label");
  label.textContent = "Your reply";
  const textarea = document.createElement("textarea");
  textarea.name = "content";
  textarea.minLength = 2;
  textarea.maxLength = 5000;
  textarea.required = true;
  textarea.rows = 4;
  textarea.placeholder = "Share one concrete experience or question";
  const actions = document.createElement("div");
  actions.className = "forum-form-actions";
  const message = document.createElement("span");
  message.dataset.forumStatus = "";
  message.hidden = true;
  const submit = document.createElement("button");
  submit.className = "forum-button forum-button-primary";
  submit.type = "submit";
  submit.textContent = "Publish reply";
  actions.append(message, submit);
  form.append(label, textarea, actions);
  container.replaceChildren(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(form, true);
    try {
      await writeComment({ action: "create", postId, content: new FormData(form).get("content") });
      window.location.reload();
    } catch (error) {
      message.hidden = false;
      message.dataset.state = "error";
      message.textContent = error.message;
      setBusy(form, false);
    }
  });
}

function bindPostActions(post) {
  document.querySelectorAll("[data-forum-vote]").forEach((button) => {
    if (!can("forum:vote")) { button.hidden = true; return; }
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const target = button.dataset.postId ? { postId: post.id } : { commentId: button.dataset.commentId };
        await writeVote({ ...target, value: normalizeVote(Number(button.dataset.forumVote)) });
        window.location.reload();
      } catch (error) { button.disabled = false; status(error.message, true); }
    });
  });
  document.querySelectorAll("[data-delete-comment]").forEach((button) => {
    if (!can("forum:deleteOwnComment")) { button.hidden = true; return; }
    button.addEventListener("click", async () => {
      if (!window.confirm("Delete this reply?")) return;
      button.disabled = true;
      try { await writeComment({ action: "delete", commentId: button.dataset.deleteComment }); window.location.reload(); }
      catch (error) { button.disabled = false; status(error.message, true); }
    });
  });
}

function appendModerationActions(container, post) {
  const actions = container?.querySelector(".forum-detail-actions");
  if (!actions) return;
  const operations = [
    { allowed: can("forum:pinPost", "forum:pin_post"), action: post.is_pinned ? "UNPIN" : "PIN", label: post.is_pinned ? "取消置顶" : "置顶" },
    { allowed: can("forum:lockPost", "forum:lock_post"), action: post.is_locked ? "UNLOCK" : "LOCK", label: post.is_locked ? "解除锁定" : "锁定" },
    { allowed: can("forum:deleteAnyPost", "forum:delete_any_post"), action: "DELETE", label: "删除帖子" },
  ];
  const message = document.createElement("span");
  message.className = "forum-action-message";
  message.setAttribute("aria-live", "polite");
  operations.filter((operation) => operation.allowed).forEach((operation) => {
    const button = document.createElement("button");
    button.className = `forum-button forum-button-secondary${operation.action === "DELETE" ? " forum-delete-button" : ""}`;
    button.type = "button";
    button.textContent = operation.label;
    button.dataset.forumModeration = operation.action;
    button.setAttribute("data-forum-moderation", operation.action);
    button.addEventListener("click", async () => {
      if (operation.action === "DELETE" && !window.confirm("确认删除这个帖子？此操作不可撤销。")) return;
      button.disabled = true;
      message.textContent = "";
      try {
        await moderateContent({ target: "post", targetId: post.id, action: operation.action });
        window.location.reload();
      } catch (error) {
        button.disabled = false;
        message.textContent = error.message;
      }
    });
    actions.append(button);
  });
  if (operations.some((operation) => operation.allowed)) actions.append(message);
}

async function bootstrapIndex(categorySlug = null) {
  await loadCategoryRail(categorySlug);
  await loadPostStream({ slug: categorySlug });
}

async function bootstrapPost() {
  const id = new URLSearchParams(window.location.search).get("id");
  const detail = document.querySelector("[data-forum-detail]");
  const comments = document.querySelector("[data-forum-comments]");
  const formSlot = document.querySelector("[data-forum-comment-form]");
  if (!id) { renderError(detail, "No post was specified."); return; }
  setLoading(detail, "Loading discussion");
  setLoading(comments, "Loading replies");
  try {
    const [post, result] = await Promise.all([fetchPost(id), fetchComments(id)]);
    if (!post) { renderError(detail, "This post is unavailable."); comments.replaceChildren(); return; }
    detail.replaceChildren(renderPostDetail(post));
    appendModerationActions(detail, post);
    const viewer = await runtime().getCurrentUser?.().catch?.(() => null);
    comments.replaceChildren(...result.comments.map((comment) => renderComment(comment, { canDelete: can("forum:deleteOwnComment") && comment.author_id === viewer?.id })));
    if (post.is_locked) {
      const notice = document.createElement("div");
      notice.className = "forum-locked-notice";
      notice.textContent = "This discussion is locked.";
      formSlot?.replaceChildren(notice);
    } else appendCommentForm(formSlot, post.id);
    bindPostActions(post);
    document.title = `${post.title} · Forum`;
  } catch (error) {
    renderError(detail, error.message, () => bootstrapPost());
    comments?.replaceChildren();
  }
}

async function bootstrapNewPost() {
  const form = document.querySelector("[data-forum-new-form]");
  if (!form) return;
  if (!can("forum:createPost")) {
    form.replaceChildren();
    const notice = document.createElement("p");
    notice.className = "forum-locked-notice";
    notice.textContent = "Sign in with post permission to start a discussion.";
    form.append(notice);
    return;
  }
  const editId = new URLSearchParams(window.location.search).get("id");
  try {
    const [categories, tags, post] = await Promise.all([fetchCategories(), fetchTags(), editId ? fetchPost(editId) : null]);
    const category = form.elements.categoryId;
    categories.forEach((item) => category.append(new Option(item.name, item.id)));
    const tagBox = form.querySelector("[data-forum-tags]");
    tags.forEach((tag) => {
      const label = document.createElement("label");
      label.className = "forum-tag-choice";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "tagIds";
      input.value = tag.id;
      label.append(input, document.createTextNode(`#${tag.name}`));
      tagBox?.append(label);
    });
    if (post) {
      form.elements.categoryId.value = post.category_id;
      form.elements.title.value = post.title;
      form.elements.content.value = post.content;
      (post.tags || []).map((entry) => entry.tag?.id).filter(Boolean).forEach((id) => { const input = [...form.querySelectorAll("input[name='tagIds']")].find((candidate) => candidate.value === id); if (input) input.checked = true; });
    }
  } catch (error) { status(error.message, true); setBusy(form, true); return; }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(form, true);
    const data = new FormData(form);
    try {
      const result = await writePost({ action: editId ? "update" : "create", postId: editId, categoryId: data.get("categoryId"), title: data.get("title"), content: data.get("content"), tagIds: data.getAll("tagIds") });
      window.location.assign(postUrl(result.post?.id || editId));
    } catch (error) { status(error.message, true); setBusy(form, false); }
  });
}

function accountDisplayName(user, identity) {
  return identity?.displayName
    || user?.user_metadata?.display_name
    || "航线同学";
}

function accountRoleLabel(role) {
  if (role === "ADMIN") return "管理员";
  if (role === "MODERATOR") return "版主";
  return "账户";
}

async function syncAccount(user) {
  const link = document.querySelector("[data-forum-account-link]");
  if (!link) return;

  const version = ++accountSyncVersion;
  let activeUser = user;
  if (activeUser === undefined) {
    try {
      activeUser = await runtime()?.getCurrentUser?.();
    } catch {
      activeUser = null;
    }
  }
  if (version !== accountSyncVersion) return;

  if (!activeUser) {
    link.textContent = "登录 / 注册";
    link.dataset.forumAccountState = "signed-out";
    link.setAttribute("aria-label", "登录或注册航线账号");
    return;
  }

  let identity = null;
  try {
    identity = await runtime()?.getPublicUserIdentity?.(activeUser.id);
  } catch {
    // A profile lookup must not hide a valid authenticated session.
  }
  if (version !== accountSyncVersion) return;

  const name = accountDisplayName(activeUser, identity);
  const role = accountRoleLabel(identity?.role);
  link.textContent = `已登录 · ${name} · ${role}`;
  link.dataset.forumAccountState = "signed-in";
  link.setAttribute("aria-label", `当前已登录：${name}，${role}。打开我的账户`);
}

function subscribeAccountSync() {
  if (stopAccountSync || !runtime()?.onSessionChange) return;
  stopAccountSync = runtime().onSessionChange((session) => void syncAccount(session?.user || null));
}

async function boot() {
  void syncAccount();
  subscribeAccountSync();
  try {
    await loadCapabilities();
    if (page === "index") await bootstrapIndex();
    if (page === "category") await bootstrapIndex(new URLSearchParams(window.location.search).get("slug"));
    if (page === "post") await bootstrapPost();
    if (page === "new") await bootstrapNewPost();
  } catch (error) {
    const target = document.querySelector("[data-forum-posts], [data-forum-detail], [data-forum-new-form]");
    renderError(target, error.message, () => boot());
  }
}

if (page) void boot();

export { can, addFilterControls, appendCommentForm, bootstrapIndex, bootstrapPost, bootstrapNewPost };
