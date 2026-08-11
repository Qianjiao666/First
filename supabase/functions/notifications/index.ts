import { createEdgeServices } from "../_shared/supabase.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  try {
    const context = await auth.requireContext(request);
    if (request.method === "GET") {
      const { data, error } = await db.from("notifications").select("id, event_key, actor_id, type, payload, read_at, created_at").eq("recipient_id", context.userId).order("created_at", { ascending: false }).limit(100);
      if (error) throw databaseError(error);
      return jsonResponse({ notifications: data ?? [], unreadCount: (data ?? []).filter((item: any) => !item.read_at).length });
    }
    if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 GET 或 POST 请求。" } }, 405);
    const body = await parseJsonBody(request);
    const action = body.action;
    if (action === "read") {
      if (typeof body.id !== "string" || !body.id.trim()) throw new ApiError("VALIDATION_ERROR", 400, "通知 id 不能为空。");
      const { data, error } = await db.rpc("mark_notification_read", { p_actor_id: context.userId, p_notification_id: body.id.trim() });
      if (error) throw databaseError(error);
      return jsonResponse({ read: data });
    }
    if (action === "readAll") {
      const { data, error } = await db.rpc("mark_all_notifications_read", { p_actor_id: context.userId });
      if (error) throw databaseError(error);
      return jsonResponse({ count: data });
    }
    throw new ApiError("VALIDATION_ERROR", 400, "不支持的通知操作。");
  } catch (error) {
    return errorResponse(error);
  }
});
