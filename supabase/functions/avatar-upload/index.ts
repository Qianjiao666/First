import { ApiError } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";
import { validateAvatarBytes } from "../_shared/image-validation.ts";
import { moderateImage } from "../_shared/tencent-ims.ts";

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_BYTES / 3) * 4;

type StorageAdapter = {
  download(path: string): Promise<Uint8Array | null>;
  upload(path: string, bytes: Uint8Array, options: { contentType: string; upsert: true; cacheControl: string }): Promise<void>;
  publicUrl(path: string): string;
  list(folder: string): Promise<string[]>;
  remove(paths: string[]): Promise<void>;
};

type UploadDependencies = {
  requireContext(request: Request): Promise<{ userId: string }>;
  getAvatar(userId: string): Promise<string | null>;
  updateAvatar(userId: string, avatarUrl: string): Promise<void>;
  moderateImage(input: { bytes: Uint8Array; dataId: string }): Promise<{ suggestion: string }>;
  storage: StorageAdapter;
  now?: () => number;
};

function invalid(message = "头像文件格式不正确，请重新选择。"): never {
  throw new ApiError("INVALID_AVATAR", 400, message);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) invalid();
  return value.trim();
}

export function strictBase64Decode(value: unknown): Uint8Array {
  const encoded = requiredString(value);
  if (encoded.length > MAX_BASE64_LENGTH || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    invalid(encoded.length > MAX_BASE64_LENGTH ? "头像文件不能超过 2MB。" : undefined);
  }
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const decodedLength = (encoded.length / 4) * 3 - padding;
  if (decodedLength > MAX_BYTES) invalid("头像文件不能超过 2MB。");
  try {
    const binary = atob(encoded);
    if (binary.length !== decodedLength) invalid();
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    invalid();
  }
}

async function restorePreviousObject(
  storage: StorageAdapter,
  path: string,
  previousBytes: Uint8Array | null,
  contentType: string,
): Promise<void> {
  try {
    await storage.remove([path]);
  } catch {
    // Continue to restoration: preserving the old avatar is the stronger guarantee.
  }
  if (previousBytes) {
    try {
      await storage.upload(path, previousBytes, { contentType, upsert: true, cacheControl: "31536000" });
    } catch {
      // The request still fails closed; no unreviewed URL is written to the profile.
    }
  }
}

export function createAvatarUploadHandler(dependencies: UploadDependencies) {
  return async function handleAvatarUpload(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "POST") {
      return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。" } }, 405);
    }

    try {
      const context = await dependencies.requireContext(request);
      const body = await parseJsonBody(request);
      const fileName = requiredString(body.fileName);
      const contentType = requiredString(body.contentType).toLowerCase();
      const bytes = strictBase64Decode(body.contentBase64);
      const image = validateAvatarBytes({ bytes, contentType, fileName });
      await dependencies.getAvatar(context.userId);

      const moderation = await dependencies.moderateImage({ bytes, dataId: context.userId });
      if (moderation.suggestion !== "Pass") {
        throw new ApiError("AVATAR_REJECTED", 400, "头像安全审核未通过，请更换图片后重试。");
      }

      const objectPath = `${context.userId}/avatar.${image.extension}`;
      const previousBytes = await dependencies.storage.download(objectPath);
      await dependencies.storage.upload(objectPath, bytes, {
        contentType: image.mimeType,
        upsert: true,
        cacheControl: "31536000",
      });
      const publicUrl = dependencies.storage.publicUrl(objectPath);
      const avatarUrl = `${publicUrl}?v=${dependencies.now?.() ?? Date.now()}`;

      try {
        await dependencies.updateAvatar(context.userId, avatarUrl);
      } catch {
        await restorePreviousObject(dependencies.storage, objectPath, previousBytes, image.mimeType);
        throw new ApiError("AVATAR_UPLOAD_FAILED", 500, "头像暂未保存，请稍后重试。");
      }

      const oldObjects = (await dependencies.storage.list(context.userId))
        .filter((name) => /^avatar\.(?:jpg|png|webp)$/i.test(name) && name !== `avatar.${image.extension}`)
        .map((name) => `${context.userId}/${name}`);
      if (oldObjects.length) {
        try {
          await dependencies.storage.remove(oldObjects);
        } catch {
          // The new reviewed avatar is already authoritative; stale cleanup is best effort.
        }
      }

      return jsonResponse({ avatarUrl });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

type SupabaseResult<T> = { data: T | null; error: { message?: string } | null };

async function createProductionHandler() {
  const { createClient } = await import("npm:@supabase/supabase-js@2.111.0");
  const { createAuthService } = await import("../_shared/auth.ts");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) throw new Error("Supabase function environment is incomplete");

  const auth = createAuthService({ url, anonKey, serviceRoleKey, createClient: createClient as never });
  const client = auth.createAdminClient() as never as {
    from(table: string): any;
    storage: { from(bucket: string): any };
  };
  const bucket = client.storage.from(BUCKET);
  const storage: StorageAdapter = {
    async download(path) {
      const { data, error } = await bucket.download(path) as SupabaseResult<Blob>;
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async upload(path, bytes, options) {
      const { error } = await bucket.upload(path, bytes, options) as SupabaseResult<unknown>;
      if (error) throw new ApiError("AVATAR_UPLOAD_FAILED", 500, "头像暂未保存，请稍后重试。");
    },
    publicUrl(path) {
      return bucket.getPublicUrl(path).data.publicUrl;
    },
    async list(folder) {
      const { data, error } = await bucket.list(folder, { limit: 10 }) as SupabaseResult<Array<{ name: string }>>;
      if (error) return [];
      return (data ?? []).map((item) => item.name);
    },
    async remove(paths) {
      const { error } = await bucket.remove(paths) as SupabaseResult<unknown>;
      if (error) throw new Error("avatar object cleanup failed");
    },
  };

  return createAvatarUploadHandler({
    requireContext: (request) => auth.requireContext(request),
    async getAvatar(userId) {
      const { data, error } = await client.from("user_public_profiles").select("avatar").eq("user_id", userId).maybeSingle();
      if (error || !data) throw new ApiError("AVATAR_UPLOAD_FAILED", 500, "无法读取头像资料，请稍后重试。");
      return data.avatar ?? null;
    },
    async updateAvatar(userId, avatarUrl) {
      const { data, error } = await client.from("user_public_profiles")
        .update({ avatar: avatarUrl, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select("avatar")
        .maybeSingle();
      if (error || !data) throw new Error("avatar profile update failed");
    },
    moderateImage: ({ bytes, dataId }) => moderateImage({ bytes, dataId }),
    storage,
  });
}

if (typeof Deno !== "undefined") {
  const handler = await createProductionHandler();
  Deno.serve(handler);
}
