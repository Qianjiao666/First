import { createEdgeServices } from "../_shared/supabase.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;

function userId(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError("VALIDATION_ERROR", 400, `${name}不正确。`);
  return value.trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  try {
    const context = await auth.checkPermission(request, "admin", "transferAccount");
    const body = await parseJsonBody(request);
    const { data, error } = await db.rpc("transfer_global_account", {
      p_actor_id: context.userId,
      p_from_user_id: userId(body.fromUserId, "源用户"),
      p_to_user_id: userId(body.toUserId, "目标用户"),
    });
    if (error) throw databaseError(error);
    return jsonResponse({ transfer: data });
  } catch (error) {
    return errorResponse(error);
  }
});
