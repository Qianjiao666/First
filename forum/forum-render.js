import { renderAvatar } from "/MKJ/assets/js/profile/avatar.js";

function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

export function setLoading(container, label = "Loading") {
  if (!container) return;
  container.replaceChildren(node("p", "forum-loading", label));
}

export function renderError(container, message, onRetry) {
  if (!container) return;
  const panel = node("div", "forum-error");
  panel.setAttribute("role", "alert");
  panel.append(node("strong", "forum-error-title", "Unable to load this view"), node("p", "forum-error-copy", message || "Please retry."));
  if (onRetry) {
    const retry = node("button", "forum-button forum-button-secondary", "Retry");
    retry.type = "button";
    retry.dataset.forumRetry = "";
    retry.setAttribute("data-forum-retry", "");
    retry.addEventListener("click", onRetry, { once: true });
    panel.append(retry);
  }
  container.replaceChildren(panel);
}

export function renderEmpty(container, title, body, action) {
  if (!container) return;
  const panel = node("div", "forum-empty");
  panel.append(node("h3", "forum-empty-title", title || "Nothing here yet"), node("p", "forum-empty-body", body || "Start with a concrete question."));
  if (action) panel.append(action);
  container.replaceChildren(panel);
}

function authorName(author) {
  return author?.display_name || "Community member";
}

export function renderAuthor(author, compact = false) {
  const wrapper = node("span", `forum-author${compact ? " forum-author-compact" : ""}`);
  const avatar = node("span", "forum-author-avatar");
  avatar.setAttribute("aria-hidden", "true");
  renderAvatar(avatar, author);
  const info = node("span", "forum-author-info");
  info.append(node("span", "forum-author-name", authorName(author)));
  if (author?.role || author?.reputation !== undefined) info.append(node("span", "forum-author-meta", `${author?.role || "USER"} · ${author?.reputation ?? 0} rep`));
  wrapper.append(avatar, info);
  return wrapper;
}

export function renderCategoryList(categories, activeSlug = null, onSelect) {
  const fragment = document.createDocumentFragment();
  categories.forEach((category) => {
    const link = node("a", `forum-category-link${category.slug === activeSlug ? " is-active" : ""}`);
    link.href = `/MKJ/forum/c/?slug=${encodeURIComponent(category.slug)}`;
    link.dataset.forumCategory = category.slug;
    if (category.slug === activeSlug) link.setAttribute("aria-current", "page");
    link.append(node("strong", "forum-category-name", category.name), node("span", "forum-category-description", category.description || ""));
    if (onSelect) link.addEventListener("click", (event) => onSelect(event, category));
    fragment.append(link);
  });
  return fragment;
}

function renderTags(post) {
  const tags = (post.tags || []).map((entry) => entry.tag || entry).filter(Boolean);
  const wrapper = node("div", "forum-post-tags");
  tags.forEach((tag) => {
    const label = node("a", "forum-tag", `#${tag.name}`);
    label.href = `/MKJ/forum/?tag=${encodeURIComponent(tag.slug || tag.id)}`;
    label.style.setProperty("--forum-tag-color", tag.color || "#2b6ef0");
    wrapper.append(label);
  });
  return wrapper;
}

export function renderPostCard(post) {
  const card = node("article", `forum-post-card${post.is_pinned ? " is-pinned" : ""}`);
  card.dataset.forumPostId = post.id;
  if (post.is_pinned) card.append(node("span", "forum-post-marker", "PINNED"));
  const header = node("div", "forum-post-card-header");
  header.append(node("span", "forum-post-category", post.category?.name || "Forum"), node("time", "forum-post-time", formatTime(post.created_at)));
  const link = node("a", "forum-post-link", post.title || "Untitled discussion");
  link.href = `/MKJ/forum/p/?id=${encodeURIComponent(post.id)}`;
  const title = node("h3", "forum-post-title");
  title.append(link);
  const excerpt = node("p", "forum-post-excerpt", String(post.content || "").slice(0, 220));
  const footer = node("div", "forum-post-card-footer");
  footer.append(renderAuthor(post.author, true), node("span", "forum-post-stats", `${post.score ?? 0} score · ${post.comment_count ?? 0} replies`));
  card.append(header, title, excerpt, renderTags(post), footer);
  return card;
}

export function renderPostDetail(post) {
  const wrapper = node("div", "forum-detail-header");
  wrapper.append(node("p", "forum-post-category", post.category?.name || "Forum"), node("h1", "forum-detail-title", post.title || "Untitled discussion"));
  const meta = node("div", "forum-detail-meta");
  meta.append(renderAuthor(post.author), node("time", "forum-post-time", formatTime(post.created_at)));
  const status = node("div", "forum-detail-status");
  if (post.is_pinned) status.append(node("span", "forum-status-chip is-pinned", "Pinned"));
  if (post.is_locked) status.append(node("span", "forum-status-chip is-locked", "Locked"));
  const body = node("div", "forum-detail-body");
  String(post.content || "").split(/\r?\n/).filter(Boolean).forEach((line) => body.append(node("p", "forum-body-line", line)));
  const actions = node("div", "forum-detail-actions");
  [1, -1].forEach((value) => {
    const button = node("button", `forum-vote-button${value < 0 ? " forum-vote-down" : ""}`, value > 0 ? "Upvote" : "Downvote");
    button.type = "button";
    button.dataset.forumVote = String(value);
    button.dataset.postId = post.id;
    actions.append(button);
  });
  wrapper.append(meta, status, body, renderTags(post), actions);
  return wrapper;
}

export function renderComment(comment, { canDelete = false } = {}) {
  const article = node("article", "forum-comment");
  article.dataset.forumCommentId = comment.id;
  const header = node("header", "forum-comment-header");
  header.append(renderAuthor(comment.author, true), node("time", "forum-post-time", formatTime(comment.created_at)));
  const body = node("p", "forum-comment-body", comment.content || "");
  const actions = node("div", "forum-comment-actions");
  [1, -1].forEach((value) => {
    const button = node("button", `forum-vote-button${value < 0 ? " forum-vote-down" : ""}`, value > 0 ? "Upvote" : "Downvote");
    button.type = "button";
    button.dataset.forumVote = String(value);
    button.dataset.commentId = comment.id;
    actions.append(button);
  });
  if (canDelete) {
    const button = node("button", "forum-vote-button forum-delete-button", "Delete");
    button.type = "button";
    button.dataset.deleteComment = comment.id;
    actions.append(button);
  }
  article.append(header, body, actions);
  return article;
}

export function formatTime(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
