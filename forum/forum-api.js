const DEFAULT_PAGE_SIZE = 20;

function runtime() {
  const app = globalThis.window?.MKJApp || globalThis.MKJApp;
  if (!app) throw new Error("Community runtime is unavailable. Please retry.");
  return app;
}

function client() {
  const value = runtime().client;
  if (!value) throw new Error("Community service is unavailable. Please retry.");
  return value;
}

function invoke() {
  const value = runtime().invokeFunction;
  if (typeof value !== "function") throw new Error("Community actions are unavailable. Please retry.");
  return value;
}

export function categoryUrl(slug) {
  return `/MKJ/forum/c/?slug=${encodeURIComponent(slug)}`;
}

export function postUrl(id) {
  return `/MKJ/forum/p/?id=${encodeURIComponent(id)}`;
}

export function readRouteState(url = globalThis.window?.location?.href || "https://local.invalid/MKJ/forum/") {
  const params = new URL(url).searchParams;
  return {
    slug: params.get("slug"),
    postId: params.get("id"),
    sort: params.get("sort") || "latest",
    tag: params.get("tag") || "",
    query: params.get("q") || "",
  };
}

export function normalizeVote(value) {
  if (value === null || value === undefined) return null;
  if (value === 1 || value === -1) return value;
  throw new Error("Vote must be 1, -1, or null.");
}

export function normalizeForumFilters(filters = {}) {
  const sort = ["latest", "hot", "top"].includes(filters.sort) ? filters.sort : "latest";
  const tag = typeof filters.tag === "string" ? filters.tag.trim().slice(0, 80) : "";
  const query = typeof filters.query === "string" ? filters.query.trim().slice(0, 120) : "";
  const category = typeof filters.category === "string" ? filters.category.trim().slice(0, 80) : "";
  return { sort, tag, query, category };
}

async function invokeSensitive(name, value) {
  const app = globalThis.window?.MKJApp || globalThis.MKJApp;
  const helper = globalThis[name] || app?.[name];
  if (typeof helper !== "function") return null;
  try {
    return await helper(value);
  } catch {
    // The authoritative filter runs inside the Edge Function; an unavailable
    // optional browser helper must never bypass that server-side check.
    return null;
  }
}

export async function sanitizeText(value, field = "content") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  const original = value.trim();
  const detection = await invokeSensitive("detect_sensitive", original);
  const level = detection?.level || detection?.severity || detection?.action;
  if (level === "MUTE") throw new Error("This content is blocked and your account may be muted.");
  const replaced = await invokeSensitive("replace_sensitive", original);
  if (typeof replaced === "string") return replaced;
  if (typeof replaced?.text === "string") return replaced.text;
  return original;
}

export async function sanitizeSubmission(payload = {}) {
  const result = { ...payload };
  if ("title" in result) result.title = await sanitizeText(result.title, "title");
  if ("content" in result) result.content = await sanitizeText(result.content, "content");
  return result;
}

async function attachAuthors(records) {
  const ids = [...new Set(records.map((record) => record.author_id).filter(Boolean))];
  if (!ids.length) return records;
  const { data, error } = await client().from("user_public_profiles")
    .select("user_id, display_name, role, reputation, avatar").in("user_id", ids);
  if (error) throw new Error("Unable to load author profiles.");
  const authors = new Map((data || []).map((author) => [author.user_id, author]));
  return records.map((record) => ({ ...record, author: authors.get(record.author_id) || null }));
}

export async function fetchCategories() {
  const { data, error } = await client().from("forum_categories")
    .select("id, slug, name, description, sort_order").order("sort_order", { ascending: true }).order("name");
  if (error) throw new Error("Unable to load forum categories.");
  return data || [];
}

export async function fetchTags() {
  const { data, error } = await client().from("forum_tags")
    .select("id, slug, name, color").order("name");
  if (error) throw new Error("Unable to load forum tags.");
  return data || [];
}

function applyLocalFilters(posts, { tag, query }) {
  const needle = query.toLocaleLowerCase();
  return posts.filter((post) => {
    const tags = (post.tags || []).map((entry) => entry.tag || entry).filter(Boolean);
    const matchesTag = !tag || tags.some((item) => item.slug === tag || item.id === tag);
    const haystack = `${post.title || ""} ${post.content || ""}`.toLocaleLowerCase();
    return matchesTag && (!needle || haystack.includes(needle));
  });
}

export async function fetchPosts(options = {}) {
  const { slug = null, offset = 0, limit = DEFAULT_PAGE_SIZE } = options;
  const filters = normalizeForumFilters({ ...options, category: slug || options.category });
  let category = null;
  if (slug) {
    const result = await client().from("forum_categories").select("id, slug, name, description")
      .eq("slug", slug).maybeSingle();
    if (result.error) throw new Error("Unable to load this forum category.");
    category = result.data;
    if (!category) return { category: null, posts: [], hasMore: false };
  }
  let query = client().from("forum_posts").select(
    "id, category_id, author_id, title, content, status, is_pinned, is_locked, score, upvote_count, downvote_count, comment_count, created_at, updated_at, category:forum_categories(id, slug, name), tags:forum_post_tags(tag:forum_tags(id, slug, name, color))",
  ).eq("status", "PUBLISHED").order("is_pinned", { ascending: false });
  if (category) query = query.eq("category_id", category.id);
  if (filters.sort === "hot") query = query.order("score", { ascending: false }).order("created_at", { ascending: false });
  else if (filters.sort === "top") query = query.order("score", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  const { data, error } = await query.range(offset, offset + limit);
  if (error) throw new Error("Unable to load forum posts.");
  const posts = applyLocalFilters(await attachAuthors(data || []), filters);
  return { category, posts: posts.slice(0, limit), hasMore: posts.length > limit };
}

export async function fetchPost(id) {
  const { data, error } = await client().from("forum_posts").select(
    "id, category_id, author_id, title, content, status, is_pinned, is_locked, score, upvote_count, downvote_count, comment_count, created_at, updated_at, category:forum_categories(id, slug, name), tags:forum_post_tags(tag:forum_tags(id, slug, name, color))",
  ).eq("id", id).eq("status", "PUBLISHED").maybeSingle();
  if (error) throw new Error("Unable to load the forum post.");
  return data ? (await attachAuthors([data]))[0] : null;
}

export async function fetchComments(postId, { offset = 0, limit = 30 } = {}) {
  const { data, error } = await client().from("forum_comments")
    .select("id, post_id, author_id, content, status, score, upvote_count, downvote_count, created_at, updated_at")
    .eq("post_id", postId).eq("status", "PUBLISHED").order("created_at", { ascending: true }).range(offset, offset + limit);
  if (error) throw new Error("Unable to load comments.");
  const comments = await attachAuthors(data || []);
  return { comments: comments.slice(0, limit), hasMore: comments.length > limit };
}

export async function writePost(payload) {
  return invoke()("forum-post", await sanitizeSubmission(payload));
}

export async function writeComment(payload) {
  return invoke()("forum-comment", await sanitizeSubmission(payload));
}

export async function writeVote(payload) {
  return invoke()("forum-vote", { ...payload, value: normalizeVote(payload.value) });
}

export async function moderateContent(payload) {
  return invoke()("forum-moderation", payload);
}
