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

function optionalUuidArray(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ApiError("VALIDATION_ERROR", 400, "标签格式不正确。");
  }
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();

  try {
    const body = await parseJsonBody(request);
    const action = requiredString(body.action, "操作");
    const permissionAction = action === "create" ? "createPost" : action === "update" ? "editOwnPost" : "deleteOwnPost";
    const context = await auth.checkPermission(request, "forum", permissionAction);
    auth.assertNotMuted(context);

    if (action === "delete") {
      const { error } = await adminClient.rpc("delete_own_forum_post", {
        p_actor_id: context.userId,
        p_post_id: requiredString(body.postId, "帖子").toLowerCase(),
      });
      if (error) throw databaseError(error);
      return jsonResponse({ ok: true });
    }

    if (!["create", "update"].includes(action)) {
      throw new ApiError("VALIDATION_ERROR", 400, "不支持的帖子操作。");
    }

    const categoryId = requiredString(body.categoryId, "分类");
    const title = guardPublicText(requiredString(body.title, "标题"), { required: true, maxLength: 160 });
    const content = guardPublicText(requiredString(body.content, "正文"), { required: true, maxLength: 50_000 });
    const rpcName = action === "create" ? "create_forum_post" : "update_forum_post";
    const rpcArgs = {
      p_actor_id: context.userId,
      p_category_id: categoryId,
      p_title: title.text,
      p_content: content.text,
      p_tag_ids: optionalUuidArray(body.tagIds),
      ...(action === "update" ? { p_post_id: requiredString(body.postId, "帖子") } : {}),
    };
    const { data, error } = await adminClient.rpc(rpcName, rpcArgs);
    if (error) throw databaseError(error);
    return jsonResponse({
      post: data,
      warnings: [...new Set([...title.matches, ...content.matches])],
    });
  } catch (error) {
    return errorResponse(error);
  }
});
