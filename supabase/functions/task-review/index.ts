import { createEdgeServices } from "../_shared/supabase.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";
import { assertSensitiveWriteAllowed, replaceSensitive } from "../_shared/sensitive-filter.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;

function integerRating(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) {
    throw new ApiError("VALIDATION_ERROR", 400, `${field}必须是 1 到 5 的整数。`);
  }
  return value as number;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。" } }, 405);

  try {
    const context = await auth.requireContext(request);
    auth.assertNotMuted(context);
    const body = await parseJsonBody(request);
    const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!applicationId || !content) throw new ApiError("VALIDATION_ERROR", 400, "评价对象和内容不能为空。");

    const filtered = await replaceSensitive(db, { text: content, userId: context.userId, enforceMute: true });
    assertSensitiveWriteAllowed(filtered);
    const { data, error } = await db.rpc("submit_task_review", {
      p_actor_id: context.userId,
      p_application_id: applicationId,
      p_communication_rating: integerRating(body.communicationRating, "沟通评价"),
      p_professionalism_rating: integerRating(body.professionalismRating, "专业度评价"),
      p_punctuality_rating: integerRating(body.punctualityRating, "守时评价"),
      p_content: filtered.text,
    });
    if (error) throw databaseError(error);
    return jsonResponse({ review: data, warnings: filtered.matches });
  } catch (error) {
    return errorResponse(error);
  }
});
