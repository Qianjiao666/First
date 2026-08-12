import { createEdgeServices } from "../_shared/supabase.ts";
import { guardPublicText } from "../_shared/content-guard.ts";
import { databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";
import { ApiError } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError("VALIDATION_ERROR", 400, `${name}不能为空。`);
  }
  return value.trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();

  try {
    const body = await parseJsonBody(request);
    const action = requiredString(body.action, "操作");
    const permissionAction = action === "create" ? "createComment" : "deleteOwnComment";
    const context = await auth.checkPermission(request, "forum", permissionAction);
    auth.assertNotMuted(context);

    if (action === "delete") {
      const { error } = await adminClient.rpc("delete_own_forum_comment", {
        p_actor_id: context.userId,
        p_comment_id: requiredString(body.commentId, "评论"),
      });
      if (error) throw databaseError(error);
      return jsonResponse({ ok: true });
    }

    if (action !== "create") {
      throw new ApiError("VALIDATION_ERROR", 400, "不支持的评论操作。");
    }

    const content = guardPublicText(requiredString(body.content, "评论"), { required: true, maxLength: 5_000 });
    const { data, error } = await adminClient.rpc("create_forum_comment", {
      p_actor_id: context.userId,
      p_post_id: requiredString(body.postId, "帖子"),
      p_content: content.text,
    });
    if (error) throw databaseError(error);
    return jsonResponse({ comment: data, warnings: content.matches });
  } catch (error) {
    return errorResponse(error);
  }
});
