import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { ApiError, createAuthService } from "../_shared/auth.ts";
import { guardPublicText } from "../_shared/content-guard.ts";
import { errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  from: (table: "task_applications") => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { task_id: string; applicant_id: string } | null; error: { message: string } | null }> } } };
};

const ACTIONS = new Set(["getCollaboration", "getConsultation", "sendMessage", "assignMember", "submitPeerReview", "getAuditContext"]);
const WRITE_ACTIONS = new Set(["sendMessage", "assignMember", "submitPeerReview"]);

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("VALIDATION_ERROR", 400, `${field} 格式不正确。`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError("VALIDATION_ERROR", 400, `${field} 不能为空。`);
  return value.trim();
}

function rating(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) {
    throw new ApiError("VALIDATION_ERROR", 400, `${field} 必须是 1 到 5 的整数。`);
  }
  return Number(value);
}

async function rpc(client: RpcClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new ApiError("TASK_COLLABORATION_FAILED", error.code === "42501" ? 403 : 400, "协作操作未完成，请检查当前权限和任务状态。");
  return data;
}

async function application(client: RpcClient, applicationId: string) {
  const { data, error } = await client.from("task_applications").select("task_id, applicant_id").eq("id", applicationId).maybeSingle();
  if (error || !data) throw new ApiError("NOT_FOUND", 404, "未找到任务申请。");
  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。" } }, 405);

  try {
    const body = await parseJsonBody(request);
    const action = asString(body.action, "action");
    if (!ACTIONS.has(action)) throw new ApiError("VALIDATION_ERROR", 400, "不支持的协作操作。");
    const payload = asRecord(body.payload ?? {}, "payload");
    const auth = createAuthService({
      url: requiredEnv("SUPABASE_URL"), anonKey: requiredEnv("SUPABASE_ANON_KEY"),
      serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), createClient: createClient as never,
    });
    const context = action === "getAuditContext"
      ? await auth.checkPermission(request, "tasks", "manage")
      : await auth.requireContext(request);
    if (WRITE_ACTIONS.has(action)) auth.assertNotMuted(context);
    const client = auth.createAdminClient() as unknown as RpcClient;

    if (action === "getAuditContext") {
      const reason = guardPublicText(asString(payload.reason, "reason"), { required: true, maxLength: 800 });
      const collaboration = await rpc(client, "get_task_collaboration_admin", {
        p_actor_id: context.userId, p_task_id: asString(payload.taskId, "taskId"), p_reason: reason.text,
      });
      return jsonResponse({ data: collaboration, warnings: reason.matches });
    }

    if (action === "getCollaboration" || action === "getConsultation") {
      const collaboration = await rpc(client, "get_task_collaboration", {
        p_actor_id: context.userId, p_task_id: asString(payload.taskId, "taskId"),
      });
      return jsonResponse({ data: collaboration });
    }

    if (action === "sendMessage") {
      const message = guardPublicText(asString(payload.content, "content"), { required: true, maxLength: 2_000 });
      const messageId = await rpc(client, "send_task_conversation_message", {
        p_actor_id: context.userId, p_conversation_id: asString(payload.conversationId, "conversationId"), p_content: message.text,
      });
      return jsonResponse({ data: { messageId }, warnings: message.matches });
    }

    const target = await application(client, asString(payload.applicationId, "applicationId"));
    if (action === "assignMember") {
      const responsibility = guardPublicText(asString(payload.responsibility, "responsibility"), { required: true, maxLength: 800 });
      const assignmentId = await rpc(client, "assign_task_member", {
        p_actor_id: context.userId, p_task_id: target.task_id, p_member_id: target.applicant_id, p_filtered_responsibility: responsibility.text,
      });
      return jsonResponse({ data: { assignmentId }, warnings: responsibility.matches });
    }

    const ratings = asRecord(payload.ratings, "ratings");
    const content = guardPublicText(asString(payload.content, "content"), { required: true, maxLength: 1_200 });
    const reviewId = await rpc(client, "submit_task_peer_review", {
      p_actor_id: context.userId, p_task_id: target.task_id, p_reviewee_id: target.applicant_id,
      p_communication: rating(ratings.communication, "ratings.communication"),
      p_contribution: rating(ratings.contribution, "ratings.contribution"),
      p_punctuality: rating(ratings.punctuality, "ratings.punctuality"), p_content: content.text,
    });
    return jsonResponse({ data: { reviewId }, warnings: content.matches });
  } catch (error) {
    return errorResponse(error);
  }
});
