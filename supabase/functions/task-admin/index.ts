import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { ApiError, createAuthService } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";
import { replaceSensitive } from "../_shared/sensitive-filter.ts";

type ServiceClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => Promise<{ data: Array<{ word: string; level: "WARN" | "MUTE" }> | null; error: { message: string } | null }>;
  };
};

type TaskContentClient = {
  from: (table: "task_listings") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
};

const ADMIN_ACTIONS = new Set([
  "create", "update", "publish", "close", "archive", "delete", "assign", "reject", "manageCategories",
  "arbitrate", "force_complete", "cancel_refund", "edit", "deduct_reputation",
]);

const ACTION_PERMISSIONS: Record<string, string> = {
  reject: "assign",
  force_complete: "manage",
  cancel_refund: "manage",
  edit: "manage",
  deduct_reputation: "manage",
  arbitrate: "manage",
};

// Arbitration RPCs write task_activity_log audit rows in the same transaction.

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
  if (error) throw new ApiError("TASK_WRITE_FAILED", 400, "任务操作未完成，请检查输入后重试。");
  return data;
}

async function filterTaskPayload(client: ServiceClient, actorId: string, payload: Record<string, unknown>) {
  const filteredPayload = { ...payload };
  const matches = new Set<string>();
  let hasSensitiveContent = false;

  for (const field of ["title", "summary", "body"]) {
    const result = await replaceSensitive(client, {
      text: asString(payload[field], field),
      userId: actorId,
      enforceMute: false,
    });
    filteredPayload[field] = result.text;
    result.matches.forEach((match) => matches.add(match));
    hasSensitiveContent ||= result.severity !== "NONE";
  }

  return { filteredPayload, hasSensitiveContent, matches: [...matches] };
}

async function filterReason(client: ServiceClient, actorId: string, value: unknown, field = "reason") {
  const reason = asString(value, field);
  const filtered = await replaceSensitive(client, { text: reason, userId: actorId, enforceMute: true });
  return { text: filtered.text, warnings: filtered.matches };
}

async function loadTaskForPublish(client: ServiceClient, taskId: string): Promise<Record<string, unknown>> {
  const database = client as unknown as TaskContentClient;
  const { data, error } = await database
    .from("task_listings")
    .select("id, category_id, subcategory_id, title, summary, body, skill_tags, reward_points, application_limit, deadline_at")
    .eq("id", taskId)
    .maybeSingle();

  if (error || !data) throw new ApiError("NOT_FOUND", 404, "未找到待发布任务。");

  return {
    id: data.id,
    categoryId: data.category_id,
    subcategoryId: data.subcategory_id,
    title: data.title,
    summary: data.summary,
    body: data.body,
    skillTags: data.skill_tags,
    rewardPoints: data.reward_points,
    applicationLimit: data.application_limit,
    deadlineAt: data.deadline_at,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。" } }, 405);

  try {
    const body = await parseJsonBody(request);
    const action = asString(body.action, "action");
    if (!ADMIN_ACTIONS.has(action)) {
      throw new ApiError("VALIDATION_ERROR", 400, "不支持的任务管理操作。");
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
    const payload = asRecord(body.payload ?? {}, "payload");

    if (["create", "update", "publish", "edit"].includes(action)) {
      const existingTaskId = action === "create" ? null : asString(payload.id ?? payload.taskId, "taskId");
      const taskPayload = action === "publish" ? await loadTaskForPublish(client, existingTaskId) : payload;
      const content = await filterTaskPayload(client, context.userId, taskPayload);
      if (action === "publish" && content.hasSensitiveContent) {
        throw new ApiError("SENSITIVE_CONTENT", 400, "任务内容命中敏感词，修改后才能发布。");
      }
      const resultTaskId = action === "create"
        ? await callTaskRpc(client, "create_task", { p_actor_id: context.userId, p_filtered_payload: content.filteredPayload })
        : await callTaskRpc(client, action === "update" ? "update_task" : action === "edit" ? "admin_edit_task" : "publish_task", {
          p_actor_id: context.userId,
          p_task_id: existingTaskId,
          p_filtered_payload: content.filteredPayload,
          ...(action === "edit" ? { p_filtered_reason: null } : {}),
        });
      return jsonResponse({ data: { taskId: resultTaskId }, warnings: content.matches });
    }

    if (action === "arbitrate") {
      const decision = asString(payload.decision, "decision");
      const reason = await filterReason(client, context.userId, payload.reason, "reason");
      const taskId = asString(payload.taskId, "taskId");
      const applicationId = payload.applicationId ? asString(payload.applicationId, "applicationId") : null;
      let result: unknown;
      if (decision === "force_complete") {
        result = await callTaskRpc(client, "admin_force_complete_task", {
          p_actor_id: context.userId,
          p_application_id: asString(applicationId, "applicationId"),
          p_filtered_completion_note: asString(payload.completionNote ?? payload.note, "completionNote"),
          p_filtered_reason: reason.text,
        });
      } else if (decision === "cancel_refund") {
        result = await callTaskRpc(client, "admin_cancel_task_refund", {
          p_actor_id: context.userId,
          p_task_id: taskId,
          p_filtered_reason: reason.text,
        });
      } else if (decision === "deduct_reputation") {
        result = await callTaskRpc(client, "admin_deduct_task_reputation", {
          p_actor_id: context.userId,
          p_user_id: asString(payload.userId, "userId"),
          p_amount: Number(payload.amount),
          p_reason: reason.text,
          p_task_id: taskId,
        });
      } else {
        throw new ApiError("VALIDATION_ERROR", 400, "涓嶆敮鎸佺殑浠诲姟仲鍐冲畾銆俙);
      }
      return jsonResponse({ data: { decision, taskId, applicationId, result }, warnings: reason.warnings });
    }

    if (["force_complete", "cancel_refund", "deduct_reputation"].includes(action)) {
      const decision = action;
      const reason = await filterReason(client, context.userId, payload.reason, "reason");
      const taskId = asString(payload.taskId, "taskId");
      let result: unknown;
      if (decision === "force_complete") {
        result = await callTaskRpc(client, "admin_force_complete_task", {
          p_actor_id: context.userId,
          p_application_id: asString(payload.applicationId, "applicationId"),
          p_filtered_completion_note: asString(payload.completionNote ?? payload.note, "completionNote"),
          p_filtered_reason: reason.text,
        });
      } else if (decision === "cancel_refund") {
        result = await callTaskRpc(client, "admin_cancel_task_refund", {
          p_actor_id: context.userId,
          p_task_id: taskId,
          p_filtered_reason: reason.text,
        });
      } else {
        result = await callTaskRpc(client, "admin_deduct_task_reputation", {
          p_actor_id: context.userId,
          p_user_id: asString(payload.userId, "userId"),
          p_amount: Number(payload.amount),
          p_reason: reason.text,
          p_task_id: taskId,
        });
      }
      return jsonResponse({ data: { decision, taskId, result }, warnings: reason.warnings });
    }

    if (["assign", "reject"].includes(action)) {
      const applicationId = asString(payload.applicationId, "applicationId");
      const application = await callTaskRpc(client, action === "assign" ? "assign_applicant" : "reject_applicant", {
        p_actor_id: context.userId,
        p_application_id: applicationId,
      });
      return jsonResponse({ data: { applicationId: application, status: action === "assign" ? "accepted" : "rejected" } });
    }

    if (action === "manageCategories") {
      const categoryId = await callTaskRpc(client, "upsert_task_category", {
        p_actor_id: context.userId,
        p_payload: payload,
      });
      return jsonResponse({ data: { categoryId } });
    }

    const taskId = asString(payload.taskId, "taskId");
    const functionName = {
      close: "close_task",
      archive: "archive_task",
      delete: "delete_task",
    }[action];
    if (!functionName) {
      throw new ApiError("VALIDATION_ERROR", 400, "不支持的任务管理操作。");
    }
    const updatedTaskId = await callTaskRpc(client, functionName, {
      p_actor_id: context.userId,
      p_task_id: taskId,
    });
    return jsonResponse({ data: { taskId: updatedTaskId } });
  } catch (error) {
    return errorResponse(error);
  }
});
