import {
  categoryUrl,
  fetchCategories,
  fetchComments,
  fetchPost,
  fetchPosts,
  fetchTags,
  normalizeVote,
  postUrl,
  writeComment,
  writePost,
  writeVote,
} from "/MKJ/assets/js/forum/forum-api.js";
import { getCurrentUser, onSessionChange } from "/MKJ/assets/js/core/auth.js";
import {
  renderAuthor,
  renderCategoryList,
  renderComment,
  renderEmpty,
  renderError,
  renderPostCard,
  renderPostDetail,
  setLoading,
} from "/MKJ/assets/js/forum/forum-render.js";

const page = document.body.dataset.forumPage;

function bindCommonNavigation() {
  document.querySelectorAll("[data-forum-back]").forEach((link) => {
    link.addEventListener("click", () => window.history.back());
  });
}

function accountDisplayName(user, identity) {
  return identity?.displayName
    || user?.user_metadata?.display_name
    || user?.email?.split("@")[0]
    || "航线同学";
}

async function syncForumAccountNavigation(user) {
  const link = document.querySelector("[data-forum-account-link]");
  if (!link) return;

  const activeUser = user === undefined ? await getCurrentUser() : user;

  if (!activeUser) {
    link.dataset.forumAccountState = "signed-out";
    link.textContent = "登录 / 注册";
    link.setAttribute("aria-label", "登录或注册航线账号");
    return;
  }

  let identity = null;
  try {
    identity = await window.MKJApp?.getPublicUserIdentity?.(activeUser.id);
  } catch {
    // The visible session remains valid when the optional public profile is unavailable.
  }
  const displayName = accountDisplayName(activeUser, identity);
  const roleLabel = identity?.role === "ADMIN" ? "管理员" : identity?.role === "MODERATOR" ? "版主" : "账户";
  link.dataset.forumAccountState = "signed-in";
  link.textContent = `已登录 · ${displayName} · ${roleLabel}`;
  link.setAttribute("aria-label", `当前登录：${displayName}，${roleLabel}。打开我的账户`);
}

function showActionError(message) {
  const status = document.querySelector("[data-forum-status]");
  if (status) {
    status.hidden = false;
    status.textContent = message || "操作未完成，请稍后重试。";
  }
}

function setActiveSort(sort) {
  document.querySelectorAll("[data-forum-sort]").forEach((link) => {
    const active = link.dataset.forumSort === sort;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

async function loadCategoryRail(activeSlug = null) {
  const container = document.querySelector("[data-forum-categories]");
  if (!container) return;
  try {
    const categories = await fetchCategories();
    container.replaceChildren(renderCategoryList(categories, activeSlug));
  } catch (error) {
    container.replaceChildren();
    showActionError(error.message);
  }
}

async function bootstrapIndex() {
  const postsContainer = document.querySelector("[data-forum-posts]");
  const sort = new URLSearchParams(window.location.search).get("sort") || "latest";
  setLoading(postsContainer);
  setActiveSort(sort);
  await loadCategoryRail();
  try {
    const result = await fetchPosts({ sort });
    if (!result.posts.length) {
      const action = document.createElement("a");
      action.className = "forum-button forum-button-primary";
      action.href = "/MKJ/forum/new/";
      action.textContent = "发起第一条讨论";
      renderEmpty(postsContainer, "这里还没有讨论", "从一个具体的求职问题开始，让经验留下来。", action);
      return;
    }
    postsContainer.replaceChildren(...result.posts.map(renderPostCard));
  } catch (error) {
    renderError(postsContainer, error.message);
  }
}

async function bootstrapCategory() {
  const params = new URLSearchParams(window.location.search);
  const categorySlug = params.get("slug");
  const currentSort = params.get("sort") || "latest";
  const postsContainer = document.querySelector("[data-forum-posts]");
  setLoading(postsContainer);
  setActiveSort(currentSort);
  await loadCategoryRail(categorySlug);
  try {
    const result = await fetchPosts({ slug: categorySlug, sort: currentSort });
    const title = document.querySelector("[data-forum-category-title]");
    const description = document.querySelector("[data-forum-category-description]");
    if (!result.category) {
      renderError(postsContainer, "这个分类不存在或暂未开放。");
      return;
    }
    if (title) title.textContent = result.category.name || "分类讨论";
    if (description) description.textContent = result.category.description || "围绕这个方向交流具体经验。";
    if (!result.posts.length) renderEmpty(postsContainer, "还没有帖子", "成为第一个把问题说清楚的人。", document.querySelector("[data-forum-new-link]")?.cloneNode(true));
    else postsContainer.replaceChildren(...result.posts.map(renderPostCard));
  } catch (error) {
    renderError(postsContainer, error.message);
  }
}

function appendCommentForm(container) {
  const form = document.createElement("form");
  form.className = "forum-comment-form";
  const label = document.createElement("label");
  label.htmlFor = "forum-comment-input";
  label.textContent = "写下你的补充";

  const textarea = document.createElement("textarea");
  textarea.id = "forum-comment-input";
  textarea.name = "content";
  textarea.rows = 4;
  textarea.minLength = 2;
  textarea.maxLength = 5000;
  textarea.required = true;
  textarea.placeholder = "分享一个具体的经验或问题。";

  const actions = document.createElement("div");
  actions.className = "forum-form-actions";
  const status = document.createElement("span");
  status.dataset.forumStatus = "";
  status.hidden = true;
  const submit = document.createElement("button");
  submit.className = "forum-button forum-button-primary";
  submit.type = "submit";
  submit.textContent = "发布评论";
  actions.append(status, submit);
  form.append(label, textarea, actions);
  container.append(form);
  return form;
}

function renderLockedCommentNotice(container) {
  const notice = document.createElement("div");
  notice.className = "forum-locked-notice";
  notice.setAttribute("role", "status");
  notice.textContent = "此帖已锁定，暂不接受新的评论。";
  container.replaceChildren(notice);
}

function appendPostOwnerActions(container, post) {
  const actions = document.createElement("div");
  actions.className = "forum-owner-actions";

  const edit = document.createElement("a");
  edit.className = "forum-button forum-button-secondary";
  edit.href = `/MKJ/forum/new/?id=${encodeURIComponent(post.id)}`;
  edit.textContent = "编辑帖子";

  const remove = document.createElement("button");
  remove.className = "forum-button forum-delete-button";
  remove.type = "button";
  remove.dataset.deletePost = post.id;
  remove.textContent = "删除帖子";

  const status = document.createElement("span");
  status.dataset.forumStatus = "";
  status.hidden = true;
  actions.append(edit, remove, status);
  container.append(actions);
}

async function bootstrapPost() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");
  const detail = document.querySelector("[data-forum-detail]");
  const comments = document.querySelector("[data-forum-comments]");
  if (!postId) {
    renderError(detail, "没有指定要查看的帖子。");
    return;
  }
  setLoading(detail, "正在读取帖子");
  setLoading(comments, "正在读取评论");
  try {
    const [post, commentResult, currentUser] = await Promise.all([fetchPost(postId), fetchComments(postId), getCurrentUser()]);
    if (!post) {
      comments.replaceChildren();
      renderError(detail, "帖子不存在或已被删除。");
      return;
    }
    detail.replaceChildren(renderPostDetail(post));
    if (currentUser?.id === post.author_id) appendPostOwnerActions(detail, post);
    comments.replaceChildren(...commentResult.comments.map((comment) => renderComment(comment, {
      canDelete: currentUser?.id === comment.author_id,
    })));
    const commentFormSlot = document.querySelector("[data-forum-comment-form]") || comments.parentElement;
    if (post.is_locked) renderLockedCommentNotice(commentFormSlot);
    else appendCommentForm(commentFormSlot);
    bindPostActions(postId);
    document.title = `${post.title}｜航线论坛`;
  } catch (error) {
    renderError(detail, error.message);
  }
}

function bindPostActions(postId) {
  document.querySelectorAll("[data-vote]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const target = button.dataset.postId ? { postId } : { commentId: button.dataset.commentId };
        await writeVote({ ...target, value: normalizeVote(Number(button.dataset.vote)) });
        window.location.reload();
      } catch (error) {
        showActionError(error.message);
        button.disabled = false;
      }
    });
  });

  document.querySelector("[data-delete-post]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!window.confirm("删除后无法恢复，确认删除这篇帖子？")) return;
    button.disabled = true;
    try {
      await writePost({ action: "delete", postId: button.dataset.deletePost });
      window.location.assign("/MKJ/forum/");
    } catch (error) {
      showActionError(error.message);
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-delete-comment]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("确认删除这条评论？")) return;
      button.disabled = true;
      try {
        await writeComment({ action: "delete", commentId: button.dataset.deleteComment });
        window.location.reload();
      } catch (error) {
        showActionError(error.message);
        button.disabled = false;
      }
    });
  });

  const form = document.querySelector(".forum-comment-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    const content = new FormData(form).get("content");
    submit.disabled = true;
    try {
      await writeComment({ action: "create", postId, content });
      window.location.reload();
    } catch (error) {
      showActionError(error.message);
      submit.disabled = false;
    }
  });
}

async function bootstrapNewPost() {
  const form = document.querySelector("[data-forum-new-form]");
  if (!form) return;
  const editPostId = new URLSearchParams(window.location.search).get("id");
  try {
    const [categories, tags, editPost, currentUser] = await Promise.all([
      fetchCategories(),
      fetchTags(),
      editPostId ? fetchPost(editPostId) : null,
      editPostId ? getCurrentUser() : null,
    ]);
    if (editPostId && (!editPost || editPost.author_id !== currentUser?.id)) {
      throw new Error("无法编辑这篇帖子，请确认已登录作者账号。");
    }
    const category = form.elements.categoryId;
    categories.forEach((item) => category.append(new Option(item.name, item.id)));
    const tagBox = form.querySelector("[data-forum-tags]");
    const selectedTagIds = new Set((editPost?.tags || []).map((entry) => entry.tag?.id).filter(Boolean));
    tags.forEach((tag) => {
      const label = document.createElement("label");
      label.className = "forum-tag-choice";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "tagIds";
      input.value = tag.id;
      input.checked = selectedTagIds.has(tag.id);
      const name = document.createElement("span");
      name.textContent = `#${tag.name}`;
      label.append(input, name);
      tagBox.append(label);
    });
    if (editPost) {
      form.elements.categoryId.value = editPost.category_id;
      form.elements.title.value = editPost.title;
      form.elements.content.value = editPost.content;
      document.querySelector(".forum-editor-main .forum-kicker").textContent = "EDIT DISCUSSION";
      document.querySelector(".forum-editor-main h1").textContent = "把这次补充，写得更准确。";
      form.querySelector("button[type='submit']").textContent = "保存修改";
      document.title = "编辑讨论｜航线论坛";
    }
  } catch (error) {
    showActionError(error.message);
    if (editPostId) form.querySelectorAll("input, textarea, select, button").forEach((control) => { control.disabled = true; });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    submit.disabled = true;
    try {
      const result = await writePost({
        action: editPostId ? "update" : "create",
        postId: editPostId,
        categoryId: data.get("categoryId"),
        title: data.get("title"),
        content: data.get("content"),
        tagIds: data.getAll("tagIds"),
      });
      window.location.assign(postUrl(result.post?.id || editPostId));
    } catch (error) {
      showActionError(error.message);
      submit.disabled = false;
    }
  });
}

bindCommonNavigation();
void syncForumAccountNavigation();
onSessionChange((session) => void syncForumAccountNavigation(session?.user || null));
if (page === "index") bootstrapIndex();
if (page === "category") bootstrapCategory();
if (page === "post") bootstrapPost();
if (page === "new") bootstrapNewPost();
