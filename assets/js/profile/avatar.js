const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Map([
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
  ["image/webp", new Set(["webp"])],
]);

export function isApprovedAvatarUrl(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && /(?:^|\.)supabase\.co$/i.test(url.hostname)
      && /^\/storage\/v1\/object\/public\/avatars\/[0-9a-f-]{36}\/avatar\.(?:jpg|png|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function displayName(identity) {
  return String(identity?.displayName ?? identity?.display_name ?? "航线同学").trim() || "航线同学";
}

export function renderAvatar(target, identity = {}) {
  if (!target) return null;
  const avatarUrl = identity?.avatar;
  if (isApprovedAvatarUrl(avatarUrl)) {
    const image = target.ownerDocument.createElement("img");
    image.src = avatarUrl;
    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    target.replaceChildren(image);
    target.dataset.mkjAvatarState = "image";
    return image;
  }

  target.replaceChildren();
  target.textContent = [...displayName(identity)][0]?.toUpperCase() || "航";
  target.dataset.mkjAvatarState = "fallback";
  return null;
}

export function validateAvatarFile(file) {
  if (!file || typeof file.name !== "string" || typeof file.type !== "string") {
    throw new Error("请选择头像图片。");
  }
  const extension = file.name.trim().match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (!ACCEPTED_TYPES.get(file.type.toLowerCase())?.has(extension)) {
    throw new Error("头像仅支持 JPG、PNG 或 WebP 格式。");
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    throw new Error("头像文件不能超过 2MB。");
  }
  return file;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export async function uploadAvatar({ file, runtime = globalThis.window?.MKJApp, onState = () => {} } = {}) {
  const accepted = validateAvatarFile(file);
  if (typeof runtime?.invokeFunction !== "function") throw new Error("头像服务暂未连接，请稍后重试。");
  onState({ status: "busy", message: "正在安全审核头像…" });
  try {
    const bytes = new Uint8Array(await accepted.arrayBuffer());
    if (bytes.length !== accepted.size || bytes.length > MAX_AVATAR_BYTES) throw new Error("头像文件不能超过 2MB。");
    const result = await runtime.invokeFunction("avatar-upload", {
      fileName: accepted.name,
      contentType: accepted.type.toLowerCase(),
      contentBase64: bytesToBase64(bytes),
    });
    if (!isApprovedAvatarUrl(result?.avatarUrl)) throw new Error("头像返回地址无效，请稍后重试。");
    onState({ status: "success", message: "头像已更新。", avatarUrl: result.avatarUrl });
    return result;
  } catch (error) {
    onState({ status: "error", message: error?.message || "头像上传失败，请稍后重试。" });
    throw error;
  }
}
