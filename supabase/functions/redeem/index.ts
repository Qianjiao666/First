import { createEdgeServices } from "../_shared/supabase.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  try {
    const context = await auth.requireContext(request);
    const body = await parseJsonBody(request);
    if (typeof body.code !== "string" || !body.code.trim()) {
      throw new ApiError("VALIDATION_ERROR", 400, "请输入礼包码。");
    }
    const { data, error } = await db.rpc("redeem_code", {
      p_user_id: context.userId,
      p_code: body.code.trim().toUpperCase(),
    });
    if (error) throw databaseError(error);
    return jsonResponse({ reward: data?.[0] ?? null });
  } catch (error) {
    return errorResponse(error);
  }
});
