import { createEdgeServices } from "../_shared/supabase.ts";
import { databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";
import { ApiError } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();

const ACTIONS = new Set(["PIN", "UNPIN", "LOCK", "UNLOCK", "DELETE"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();

  try {
    const body = await parseJsonBody(request);
    const target = body.target === "comment" ? "comment" : body.target === "post" ? "post" : null;
    const action = typeof body.action === "string" ? body.action : null;
    if (!target || !action || !ACTIONS.has(action)) {
      throw new ApiError("VALIDATION_ERROR", 400, "管理操作参数不正确。");
    }

    const capability = action === "DELETE" && target === "comment" ? "forum:deleteAnyComment" : action === "DELETE" ? "forum:deleteAnyPost" : action === "PIN" || action === "UNPIN" ? "forum:pinPost" : "forum:lockPost";
    const context = await auth.requireContext(request);
    const { data: allowed, error: permissionError } = await adminClient.rpc("has_capability", {
      p_user_id: context.userId,
      p_capability: capability,
    });
    if (permissionError) throw databaseError(permissionError);
    if (!allowed) throw new ApiError("FORBIDDEN", 403, "当前账户没有执行此操作的权限。");
    const { error } = await adminClient.rpc("moderate_forum_content", {
      p_actor_id: context.userId,
      p_target: target,
      p_target_id: typeof body.targetId === "string" ? body.targetId : "",
      p_action: action,
    });
    if (error) throw databaseError(error);
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
