import { createEdgeServices } from "../_shared/supabase.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";
import { assertSensitiveWriteAllowed, replaceSensitive } from "../_shared/sensitive-filter.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError("VALIDATION_ERROR", 400, `${field}不能为空。`);
  return value.trim();
}
function assertAnnouncementRole(role: string): void {
  if (!(role === "MODERATOR" || role === "ADMIN")) throw new ApiError("FORBIDDEN", 403, "当前账户没有公告管理权限。");
}
function sanitizeMarkdown(value: string): string {
  if (/<\s*script\b|javascript\s*:|on[a-z]+\s*=/i.test(value)) throw new ApiError("VALIDATION_ERROR", 400, "公告 Markdown 含有不安全内容。");
  return value;
}
function slugFromTitle(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
  return `${base || "announcement"}-${crypto.randomUUID().slice(0, 8)}`;
}
async function listPublished() {
  const { data, error } = await db.from("announcements")
    .select("id, slug, title, body_markdown, is_pinned, published_at, created_at, updated_at")
    .eq("status", "published").order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50);
  if (error) throw databaseError(error);
  return jsonResponse({ announcements: data ?? [] });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  try {
    if (request.method === "GET") return listPublished();
    if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 GET 或 POST 请求。" } }, 405);
    const body = await parseJsonBody(request);
    const action = requiredString(body.action, "action");

    if (action === "list" && !request.headers.get("authorization")?.startsWith("Bearer ")) return listPublished();

    const context = await auth.requireContext(request);
    auth.assertNotMuted(context);

    if (action === "list") {
      if (context.role !== "MODERATOR" && context.role !== "ADMIN") return listPublished();
      assertAnnouncementRole(context.role);
      const { data, error } = await db.from("announcements")
        .select("id, slug, title, body_markdown, status, is_pinned, published_at, created_at, updated_at")
        .order("updated_at", { ascending: false }).limit(200);
      if (error) throw databaseError(error);
      return jsonResponse({ announcements: data ?? [] });
    }

    if (action === "delete") {
      assertAnnouncementRole(context.role);
      const { data, error } = await db.rpc("delete_announcement", { p_actor_id: context.userId, p_id: requiredString(body.id, "id") });
      if (error) throw databaseError(error);
      return jsonResponse({ deleted: data });
    }
    if (action === "setPinned") {
      assertAnnouncementRole(context.role);
      const id = requiredString(body.id, "id");
      if (typeof body.isPinned !== "boolean") throw new ApiError("VALIDATION_ERROR", 400, "置顶状态不正确。");
      const { data, error } = await db.rpc("set_announcement_pinned", {
        p_actor_id: context.userId, p_id: id, p_is_pinned: body.isPinned,
      });
      if (error) throw databaseError(error);
      if (!data) throw new ApiError("NOT_FOUND", 404, "公告不存在或无权修改。");
      return jsonResponse({ pinned: data });
    }
    if (!(action === "upsert" || action === "create" || action === "update")) {
      throw new ApiError("VALIDATION_ERROR", 400, "不支持的公告操作。");
    }
    assertAnnouncementRole(context.role);
    const title = await replaceSensitive(db, { text: requiredString(body.title, "title"), userId: context.userId, enforceMute: true });
    const markdown = await replaceSensitive(db, { text: sanitizeMarkdown(requiredString(body.bodyMarkdown ?? body.markdown, "bodyMarkdown")), userId: context.userId, enforceMute: true });
    assertSensitiveWriteAllowed(title); assertSensitiveWriteAllowed(markdown);
    const status = ["draft", "published", "archived"].includes(String(body.status))
      ? body.status
      : action === "upsert" ? "draft" : "published";
    const payload = {
      slug: typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : slugFromTitle(title.text), title: title.text, bodyMarkdown: markdown.text,
      status, isPinned: body.isPinned === true,
      ...(typeof body.publishedAt === "string" ? { publishedAt: body.publishedAt } : {}),
    };
    const { data, error } = await db.rpc("upsert_announcement", { p_actor_id: context.userId, p_id: typeof body.id === "string" ? body.id : null, p_payload: payload });
    if (error) throw databaseError(error);
    return jsonResponse({ announcementId: data, warnings: [...title.matches, ...markdown.matches] });
  } catch (error) {
    return errorResponse(error);
  }
});
