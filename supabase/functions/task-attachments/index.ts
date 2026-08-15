import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { ApiError, createAuthService } from "../_shared/auth.ts";
import { guardPublicText } from "../_shared/content-guard.ts";
import { errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

const BUCKET = "task-attachments";
const MAX_BYTES = 50 * 1024 * 1024;
const MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
]);
const ACTIONS = new Set(["prepare", "register", "remove", "delete"]);

type ServiceClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  storage: {
    from: (bucket: string) => {
      createSignedUploadUrl: (path: string) => Promise<{ data: { path: string; token: string } | null; error: { message: string } | null }>;
    };
  };
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_ERROR", 400, `${field} format is invalid.`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError("VALIDATION_ERROR", 400, `${field} is required.`);
  }
  return value.trim();
}

function asPositiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new ApiError("VALIDATION_ERROR", 400, `${field} must be a positive integer.`);
  }
  return number;
}

function extensionFor(mimeType: string): string {
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
  }[mimeType] ?? "";
}

function permissionFor(kind: string): string {
  if (kind === "arbitration") return "manage";
  if (kind === "task") return "create";
  if (kind === "completion") return "complete";
  return "submit";
}

function validateKind(value: unknown): string {
  const kind = typeof value === "string" && value.trim() ? value.trim() : "task";
  if (!["task", "submission", "completion", "arbitration"].includes(kind)) {
    throw new ApiError("VALIDATION_ERROR", 400, "Attachment kind is not supported.");
  }
  return kind;
}

function validateMimeAndSize(payload: Record<string, unknown>): { mimeType: string; sizeBytes: number } {
  const mimeType = asString(payload.mimeType, "mimeType").toLowerCase();
  const sizeBytes = asPositiveInteger(payload.sizeBytes, "sizeBytes");
  if (!MIME_TYPES.has(mimeType) || sizeBytes > MAX_BYTES) {
    throw new ApiError("VALIDATION_ERROR", 400, "Attachments must be images or videos no larger than 50MB.");
  }
  return { mimeType, sizeBytes };
}

async function callRpc(client: ServiceClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new ApiError("TASK_ATTACHMENT_FAILED", 400, "Attachment operation failed.");
  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") {
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Only POST requests are supported." } }, 405);
  }

  try {
    const body = await parseJsonBody(request);
    const action = asString(body.action, "action");
    if (!ACTIONS.has(action)) throw new ApiError("VALIDATION_ERROR", 400, "Attachment action is not supported.");

    const auth = createAuthService({
      url: requiredEnv("SUPABASE_URL"),
      anonKey: requiredEnv("SUPABASE_ANON_KEY"),
      serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      createClient: createClient as never,
    });
    const payload = asRecord(body.payload ?? {}, "payload");
    const kind = validateKind(payload.attachmentKind);
    const context = await auth.checkPermission(request, "tasks", permissionFor(kind));
    auth.assertNotMuted(context);
    const client = auth.createAdminClient() as unknown as ServiceClient;

    if (action === "remove" || action === "delete") {
      const attachmentId = asString(payload.attachmentId, "attachmentId");
      const data = await callRpc(client, "delete_task_attachment", {
        p_actor_id: context.userId,
        p_attachment_id: attachmentId,
      });
      return jsonResponse({ data: { attachmentId: data } });
    }

    const taskId = asString(payload.taskId, "taskId");
    const applicationId = payload.applicationId ? asString(payload.applicationId, "applicationId") : null;
    const { mimeType, sizeBytes } = validateMimeAndSize(payload);

    if (action === "prepare") {
      const path = `${context.userId}/${taskId}/${crypto.randomUUID()}${extensionFor(mimeType)}`;
      const signed = await client.storage.from(BUCKET).createSignedUploadUrl(path);
      if (signed.error || !signed.data) {
        throw new ApiError("TASK_ATTACHMENT_FAILED", 500, "Unable to create an attachment upload URL.");
      }
      return jsonResponse({ data: { bucket: BUCKET, path, token: signed.data.token, mimeType, sizeBytes, attachmentKind: kind } });
    }

    const objectPath = asString(payload.objectPath ?? payload.path, "objectPath");
    const captionResult = payload.caption
      ? guardPublicText(asString(payload.caption, "caption"), { required: true, maxLength: 500 })
      : { text: "", matches: [], severity: "NONE" as const };
    const attachmentId = await callRpc(client, "register_task_attachment", {
      p_actor_id: context.userId,
      p_payload: {
        taskId,
        applicationId,
        attachmentKind: kind,
        bucketId: BUCKET,
        objectPath,
        mimeType,
        sizeBytes,
        caption: captionResult.text,
      },
    });
    return jsonResponse({ data: { attachmentId }, warnings: captionResult.matches });
  } catch (error) {
    return errorResponse(error);
  }
});
