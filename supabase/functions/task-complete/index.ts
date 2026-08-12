import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { ApiError, createAuthService } from "../_shared/auth.ts";
import { guardPublicText } from "../_shared/content-guard.ts";
import { errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

type ServiceClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const COMPLETION_ACTIONS = new Set(["apply", "submit", "cancel", "complete", "attach", "arbitrate"]);

const ACTION_PERMISSIONS: Record<string, string> = {
  cancel: "submit",
  attach: "submit",
  arbitrate: "submit",
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_ERROR", 400, `${field} 格式不正确。`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError("VALIDATION_ERROR", 400, `${field} 不能为空。`);
  }
  return value.trim();
}

async function callTaskRpc(client: ServiceClient, functionName: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw new ApiError("TASK_WRITE_FAILED", 400, "任务操作未完成，请检查当前状态后重试。");
  return data;
}

function filterUserText(text: string, maxLength = 5_000) {
  return guardPublicText(text, { required: true, maxLength });
}

async function registerAttachments(client: ServiceClient, actorId: string, payload: Record<string, unknown>) {
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (attachments.length > 10) throw new ApiError("VALIDATION_ERROR", 400, "最多只能提交 10 个附件。");
  const registered = [];
  const warnings = new Set<string>();
  for (const item of attachments) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ApiError("VALIDATION_ERROR", 400, "附件元数据格式不正确。");
    }
    const attachment = item as Record<string, unknown>;
    const caption = attachment.caption ? filterUserText(asString(attachment.caption, "attachment.caption"), 500) : null;
    caption?.matches.forEach((match) => warnings.add(match));
    const id = await callTaskRpc(client, "register_task_attachment", {
      p_actor_id: actorId,
      p_payload: {
        taskId: asString(payload.taskId ?? attachment.taskId, "taskId"),
        applicationId: payload.applicationId ?? attachment.applicationId ?? null,
        attachmentKind: attachment.attachmentKind ?? payload.attachmentKind ?? "submission",
        bucketId: "task-attachments",
        objectPath: asString(attachment.objectPath ?? attachment.path, "attachment.path"),
        mimeType: asString(attachment.mimeType, "attachment.mimeType"),
        sizeBytes: Number(attachment.sizeBytes ?? attachment.size),
        caption: caption?.text ?? "",
      },
    });
    registered.push(id);
  }
  return { registered, warnings: [...warnings] };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。" } }, 405);

  try {
    const body = await parseJsonBody(request);
    const action = asString(body.action, "action");
    if (!COMPLETION_ACTIONS.has(action)) {
      throw new ApiError("VALIDATION_ERROR", 400, "不支持的任务执行操作。");
    }

    const auth = createAuthService({
      url: requiredEnv("SUPABASE_URL"),
      anonKey: requiredEnv("SUPABASE_ANON_KEY"),
      serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      createClient: createClient as never,
    });
    const context = await auth.checkPermission(request, "tasks", ACTION_PERMISSIONS[action] ?? action);
    auth.assertNotMuted(context);
    const client = auth.createAdminClient() as unknown as ServiceClient;
    const payload = asRecord(body.payload, "payload");

    if (action === "cancel") {
      const applicationId = await callTaskRpc(client, "cancel_application", {
        p_actor_id: context.userId,
        p_application_id: asString(payload.applicationId, "applicationId"),
      });
      return jsonResponse({ data: { applicationId, status: "cancelled" } });
    }

    if (action === "apply") {
      const filtered = filterUserText(asString(payload.applicationNote, "applicationNote"), 1_200);
      const applicationId = await callTaskRpc(client, "apply_task", {
        p_actor_id: context.userId,
        p_task_id: asString(payload.taskId, "taskId"),
        p_filtered_application_note: filtered.text,
      });
      return jsonResponse({ data: { applicationId }, warnings: filtered.matches });
    }

    if (action === "attach") {
      const result = await registerAttachments(client, context.userId, payload);
      return jsonResponse({ data: { attachmentIds: result.registered }, warnings: result.warnings });
    }

    if (action === "arbitrate") {
      const filtered = filterUserText(asString(payload.reason, "reason"), 2_000);
      const applicationId = await callTaskRpc(client, "open_task_arbitration", {
        p_actor_id: context.userId,
        p_application_id: asString(payload.applicationId, "applicationId"),
        p_filtered_reason: filtered.text,
      });
      return jsonResponse({ data: { applicationId, status: "pending" }, warnings: filtered.matches });
    }

    if (action === "submit") {
      const filtered = filterUserText(asString(payload.submissionNote, "submissionNote"), 1_200);
      const applicationId = await callTaskRpc(client, "submit_task", {
        p_actor_id: context.userId,
        p_application_id: asString(payload.applicationId, "applicationId"),
        p_filtered_submission_note: filtered.text,
      });
      return jsonResponse({ data: { applicationId }, warnings: filtered.matches });
    }

    const review = payload.review && typeof payload.review === "object" ? payload.review as Record<string, unknown> : null;
    let filteredReview: Record<string, unknown> | null = null;
    const completionWarnings = new Set<string>();
    if (review?.content) {
      const filtered = filterUserText(asString(review.content, "review.content"), 2_000);
      filteredReview = { ...review, content: filtered.text };
      filtered.matches.forEach((match) => completionWarnings.add(match));
    }
    const completionNote = !filteredReview && payload.completionNote
      ? filterUserText(asString(payload.completionNote, "completionNote"), 2_000)
      : null;
    completionNote?.matches.forEach((match) => completionWarnings.add(match));
    const attachmentResult = await registerAttachments(client, context.userId, payload);
    attachmentResult.warnings.forEach((match) => completionWarnings.add(match));
    const applicationId = await callTaskRpc(client, "complete_task", {
      p_actor_id: context.userId,
      p_application_id: asString(payload.applicationId, "applicationId"),
      p_filtered_review: filteredReview ?? (completionNote ? { content: completionNote.text } : null),
    });
    return jsonResponse({ data: { applicationId, status: "completed", attachmentIds: attachmentResult.registered }, warnings: [...completionWarnings] });
  } catch (error) {
    return errorResponse(error);
  }
});
