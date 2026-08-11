function requireClient() {
  const client = window.MKJApp?.client;
  if (!client) throw new Error("社区服务暂未连接，请稍后重试。");
  return client;
}

function requireFunctionCaller() {
  const caller = window.MKJApp?.invokeFunction;
  if (!caller) throw new Error("账户服务暂未连接，请稍后重试。");
  return caller;
}

export function categoryUrl(slug) {
  return `/MKJ/forum/c/?slug=${encodeURIComponent(slug)}`;
}

export function postUrl(postId) {
  return `/MKJ/forum/p/?id=${encodeURIComponent(postId)}`;
}

export function readRouteState(url = window.location.href) {
  const params = new URL(url).searchParams;
  return {
    slug: params.get("slug"),
    postId: params.get("id"),
    sort: params.get("sort") || "latest",
  };
}

export function normalizeVote(value) {
  if (value === null || value === undefined) return null;
  if (value === 1 || value === -1) return value;
  throw new Error("投票值只能是赞、踩或撤销。");
}

async function attachAuthors(records) {
  const authorIds = [...new Set(records.map((record) => record.author_id).filter(Boolean))];
  if (!authorIds.length) return records;

  const client = requireClient();
  const { data, error } = await client
    .from("user_public_profiles")
    .select("user_id, display_name, role, reputation")
    .in("user_id", authorIds);
  if (error) throw new Error("无法读取作者公开资料。");

  const authors = new Map((data || []).map((author) => [author.user_id, author]));
  return records.map((record) => ({ ...record, author: authors.get(record.author_id) || null }));
}

export async function fetchCategories() {
  const client = requireClient();
  const { data, error } = await client
    .from("forum_categories")
    .select("id, slug, name, description, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error("无法读取论坛分类。");
  return data || [];
}

export async function fetchTags() {
  const client = requireClient();
  const { data, error } = await client
    .from("forum_tags")
    .select("id, slug, name, color")
    .order("name", { ascending: true });
  if (error) throw new Error("无法读取论坛标签。");
  return data || [];
}

export async function fetchPosts({ slug = null, sort = "latest", offset = 0, limit = 20 } = {}) {
  const client = requireClient();
  let category = null;
  if (slug) {
    const { data, error: categoryError } = await client
      .from("forum_categories")
      .select("id, slug, name, description")
      .eq("slug", slug)
      .maybeSingle();
    if (categoryError) throw new Error("无法读取论坛分类。");
    category = data;
    if (!category) return { category: null, posts: [], hasMore: false };
  }

  let query = client
    .from("forum_posts")
    .select("id, category_id, author_id, title, content, is_pinned, is_locked, score, upvote_count, downvote_count, comment_count, created_at, updated_at, category:forum_categories(id, slug, name), tags:forum_post_tags(tag:forum_tags(id, slug, name, color))")
    .order("is_pinned", { ascending: false });

  if (category) query = query.eq("category_id", category.id);
  if (sort === "hot") query = query.order("score", { ascending: false }).order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query.range(offset, offset + limit);
  if (error) throw new Error("无法读取论坛帖子。");

  const records = await attachAuthors(data || []);
  return {
    category,
    posts: records.slice(0, limit),
    hasMore: records.length > limit,
  };
}

export async function fetchPost(postId) {
  const client = requireClient();
  const { data, error } = await client
    .from("forum_posts")
    .select("id, category_id, author_id, title, content, is_pinned, is_locked, score, upvote_count, downvote_count, comment_count, created_at, updated_at, category:forum_categories(id, slug, name), tags:forum_post_tags(tag:forum_tags(id, slug, name, color))")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error("无法读取帖子内容。");
  if (!data) return null;

  return (await attachAuthors([data]))[0];
}

export async function fetchComments(postId, { offset = 0, limit = 30 } = {}) {
  const client = requireClient();
  const { data, error } = await client
    .from("forum_comments")
    .select("id, post_id, author_id, content, score, upvote_count, downvote_count, created_at, updated_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw new Error("无法读取评论。");

  const records = await attachAuthors(data || []);
  return { comments: records.slice(0, limit), hasMore: records.length > limit };
}

export async function writePost(payload) {
  return requireFunctionCaller()("forum-post", payload);
}

export async function writeComment(payload) {
  return requireFunctionCaller()("forum-comment", payload);
}

export async function writeVote(payload) {
  return requireFunctionCaller()("forum-vote", payload);
}

export async function moderateContent(payload) {
  return requireFunctionCaller()("forum-moderation", payload);
}
