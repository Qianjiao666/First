import { createEdgeServices } from "../_shared/supabase.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;

function normalizedWord(value: unknown): string {
  if (typeof value !== "string") throw new ApiError("VALIDATION_ERROR", 400, "敏感词不正确。");
  const word = value.normalize("NFKC").trim();
  if (!word || word.length > 80) throw new ApiError("VALIDATION_ERROR", 400, "敏感词长度不正确。");
  return word;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  try {
    const context = await auth.checkPermission(request, "admin", "manageSensitiveWords");
    const body = await parseJsonBody(request);

    if (body.action === "list") {
      const { data, error } = await db.from("sensitive_words").select("id, word, level, created_at").order("word", { ascending: true });
      if (error) throw databaseError(error);
      return jsonResponse({ words: data ?? [] });
    }

    if (body.action === "create") {
      const level = body.level === "MUTE" ? "MUTE" : body.level === "WARN" ? "WARN" : null;
      if (!level) throw new ApiError("VALIDATION_ERROR", 400, "敏感词级别不正确。");
      const { data, error } = await db.from("sensitive_words").insert({ word: normalizedWord(body.word), level, created_by_id: context.userId }).select("id, word, level").single();
      if (error) throw databaseError(error);
      await db.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: "sensitive_word.create",
        resource_type: "sensitive_words",
        resource_id: data.id,
        after_state: { word: data.word, level: data.level },
      });
      return jsonResponse({ word: data }, 201);
    }

    if (body.action === "delete") {
      const wordId = typeof body.id === "string" ? body.id : "";
      const { data: deleted, error } = await db.from("sensitive_words").delete().eq("id", wordId).select("id, word, level").maybeSingle();
      if (error) throw databaseError(error);
      if (!deleted) throw new ApiError("NOT_FOUND", 404, "敏感词不存在。");
      await db.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: "sensitive_word.delete",
        resource_type: "sensitive_words",
        resource_id: deleted.id,
        before_state: { word: deleted.word, level: deleted.level },
      });
      return jsonResponse({ ok: true });
    }

    throw new ApiError("VALIDATION_ERROR", 400, "不支持的敏感词操作。");
  } catch (error) {
    return errorResponse(error);
  }
});
