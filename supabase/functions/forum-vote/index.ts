import { createEdgeServices } from "../_shared/supabase.ts";
import { databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";
import { ApiError } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();

function optionalVote(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value === 1 || value === -1) return value;
  throw new ApiError("VALIDATION_ERROR", 400, "投票值只能是赞、踩或撤销。");
}

function requiredTarget(body: Record<string, unknown>): { postId: string | null; commentId: string | null } {
  const postId = typeof body.postId === "string" && body.postId.trim() ? body.postId.trim() : null;
  const commentId = typeof body.commentId === "string" && body.commentId.trim() ? body.commentId.trim() : null;
  if ((postId ? 1 : 0) + (commentId ? 1 : 0) !== 1) {
    throw new ApiError("VALIDATION_ERROR", 400, "请选择一个帖子或评论进行投票。");
  }
  return { postId, commentId };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();

  try {
    const context = await auth.checkPermission(request, "forum", "vote");
    auth.assertNotMuted(context);
    const body = await parseJsonBody(request);
    const target = requiredTarget(body);
    const { data, error } = await adminClient.rpc("set_forum_vote", {
      p_actor_id: context.userId,
      p_post_id: target.postId,
      p_comment_id: target.commentId,
      p_value: optionalVote(body.value),
    });
    if (error) throw databaseError(error);
    return jsonResponse({ vote: data });
  } catch (error) {
    return errorResponse(error);
  }
});
