import { createReputationBadge } from "/MKJ/assets/js/core/reputation.js";

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatDate(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function avatarFor(author) {
  const name = author?.display_name || "航线同学";
  return name.slice(0, 1);
}

export function renderAuthor(author, { compact = false } = {}) {
  const wrapper = element("div", `forum-author${compact ? " forum-author-compact" : ""}`);
  const avatar = element("span", "forum-author-avatar", avatarFor(author));
  avatar.setAttribute("aria-hidden", "true");
  const info = element("span", "forum-author-info");
  info.append(element("strong", "forum-author-name", author?.display_name || "航线同学"));
  if (!compact) {
    info.append(createReputationBadge({
      userId: author?.user_id,
      reputation: author?.reputation,
      role: author?.role,
      compact: true,
    }));
  }
  wrapper.append(avatar, info);
  return wrapper;
}

export function renderPostCard(post) {
  const article = element("article", `forum-post-card${post.is_pinned ? " is-pinned" : ""}`);
  article.dataset.postId = post.id;

  const marker = element("span", "forum-post-marker", post.is_pinned ? "置顶" : "讨论");
  const header = element("div", "forum-post-card-header");
  const category = element("span", "forum-post-category", post.category?.name || "未分类");
  const time = element("time", "forum-post-time", formatDate(post.created_at));
  time.dateTime = post.created_at || "";
  header.append(category, time);

  const title = element("h3", "forum-post-title");
  const link = element("a", "forum-post-link", post.title || "无标题帖子");
  link.href = `/MKJ/forum/p/?id=${encodeURIComponent(post.id)}`;
  title.append(link);

  const excerpt = element("p", "forum-post-excerpt", (post.content || "").slice(0, 130));
  const footer = element("div", "forum-post-card-footer");
  footer.append(renderAuthor(post.author, { compact: true }));

  const stats = element("div", "forum-post-stats");
  stats.append(
    element("span", "forum-stat", `赞 ${post.upvote_count ?? 0}`),
    element("span", "forum-stat", `踩 ${post.downvote_count ?? 0}`),
    element("span", "forum-stat", `评论 ${post.comment_count ?? 0}`),
  );
  footer.append(stats);

  const tags = element("div", "forum-post-tags");
  (post.tags || []).map((entry) => entry.tag).filter(Boolean).slice(0, 4).forEach((tag) => {
    const tagNode = element("span", "forum-tag", `#${tag.name}`);
    tagNode.style.setProperty("--forum-tag-color", tag.color || "#139b72");
    tags.append(tagNode);
  });

  article.append(marker, header, title, excerpt, tags, footer);
  return article;
}

export function renderCategoryList(categories, activeSlug = null) {
  const fragment = document.createDocumentFragment();
  categories.forEach((category) => {
    const link = element("a", `forum-category-link${category.slug === activeSlug ? " is-active" : ""}`);
    link.href = `/MKJ/forum/c/?slug=${encodeURIComponent(category.slug)}`;
    link.append(
      element("strong", "forum-category-name", category.name),
      element("span", "forum-category-description", category.description || "开始一场有用的讨论"),
    );
    fragment.append(link);
  });
  return fragment;
}

export function renderPostDetail(post) {
  const fragment = document.createDocumentFragment();
  const header = element("div", "forum-detail-header");
  const title = element("h1", "forum-detail-title", post.title || "无标题帖子");
  const meta = element("div", "forum-detail-meta");
  meta.append(renderAuthor(post.author), element("time", "forum-post-time", formatDate(post.created_at)));
  header.append(title, meta);

  const status = element("div", "forum-detail-status");
  if (post.is_pinned) status.append(element("span", "forum-status-chip is-pinned", "已置顶"));
  if (post.is_locked) status.append(element("span", "forum-status-chip is-locked", "已锁定"));

  const body = element("div", "forum-detail-body");
  String(post.content || "").split("\n").forEach((line) => body.append(element("p", "forum-body-line", line || "\u00a0")));

  const actions = element("div", "forum-detail-actions");
  actions.append(
    element("button", "forum-vote-button", `赞 ${post.upvote_count ?? 0}`),
    element("button", "forum-vote-button forum-vote-down", `踩 ${post.downvote_count ?? 0}`),
  );
  actions.children[0].dataset.vote = "1";
  actions.children[0].dataset.postId = post.id;
  actions.children[1].dataset.vote = "-1";
  actions.children[1].dataset.postId = post.id;

  fragment.append(header, status, body, actions);
  return fragment;
}

export function renderComment(comment, { canDelete = false } = {}) {
  const article = element("article", "forum-comment");
  const header = element("header", "forum-comment-header");
  header.append(renderAuthor(comment.author, { compact: true }), element("time", "forum-post-time", formatDate(comment.created_at)));
  const body = element("p", "forum-comment-body", comment.content || "");
  const actions = element("div", "forum-comment-actions");
  const upvote = element("button", "forum-vote-button", `赞 ${comment.upvote_count ?? 0}`);
  upvote.dataset.vote = "1";
  upvote.dataset.commentId = comment.id;
  const downvote = element("button", "forum-vote-button forum-vote-down", `踩 ${comment.downvote_count ?? 0}`);
  downvote.dataset.vote = "-1";
  downvote.dataset.commentId = comment.id;
  actions.append(upvote, downvote);
  if (canDelete) {
    const remove = element("button", "forum-vote-button forum-delete-button", "删除");
    remove.type = "button";
    remove.dataset.deleteComment = comment.id;
    actions.append(remove);
  }
  article.append(header, body, actions);
  return article;
}

export function renderEmpty(container, title, body, action = null) {
  container.replaceChildren();
  const empty = element("div", "forum-empty");
  empty.append(element("h2", "forum-empty-title", title), element("p", "forum-empty-body", body));
  if (action) empty.append(action);
  container.append(empty);
}

export function renderError(container, message) {
  container.replaceChildren();
  const error = element("div", "forum-error", message || "页面暂时无法读取，请稍后重试。");
  container.append(error);
}

export function setLoading(container, label = "正在读取") {
  container.replaceChildren(element("div", "forum-loading", label));
}
