export const TASK_ATTACHMENT_BUCKET = "task-attachments";
export const TASK_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
export const TASK_ATTACHMENT_ACCEPT = "image/*,video/*";

const ALLOWED_TYPES = /^(image|video)\//i;

function safeSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

export function validateTaskAttachment(file, { maxBytes = TASK_ATTACHMENT_MAX_BYTES } = {}) {
  if (!file || typeof file !== "object") return { ok: false, reason: "missing" };
  if (!ALLOWED_TYPES.test(String(file.type ?? ""))) return { ok: false, reason: "type" };
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) return { ok: false, reason: "empty" };
  if (Number(file.size) > maxBytes) return { ok: false, reason: "size", maxBytes };
  return { ok: true, kind: String(file.type).toLowerCase().startsWith("video/") ? "video" : "image" };
}

export function buildTaskAttachmentPath({ userId, resourceId, fileName, objectId } = {}) {
  return [safeSegment(userId), safeSegment(resourceId), `${safeSegment(objectId || "attachment")}-${safeSegment(fileName)}`].join("/");
}

export async function uploadTaskAttachment({ storage, userId, resourceId, file, objectId, bucket = TASK_ATTACHMENT_BUCKET } = {}) {
  const validation = validateTaskAttachment(file);
  if (!validation.ok) {
    const error = new Error(`Invalid task attachment: ${validation.reason}`);
    error.code = `TASK_ATTACHMENT_${String(validation.reason).toUpperCase()}`;
    throw error;
  }
  if (!storage?.from) throw new TypeError("Task attachment storage is required");

  const path = buildTaskAttachmentPath({ userId, resourceId, fileName: file.name, objectId });
  const { data, error } = await storage.from(bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return {
    path: data?.path ?? path,
    name: String(file.name ?? "attachment"),
    mimeType: String(file.type),
    size: Number(file.size),
    kind: validation.kind,
    bucket,
  };
}

export function attachmentInputAccept() {
  return TASK_ATTACHMENT_ACCEPT;
}
