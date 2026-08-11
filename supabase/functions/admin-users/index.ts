import { createEdgeServices } from "../_shared/supabase.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;
const USER_PAGE_SIZE = 100;

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError("VALIDATION_ERROR", 400, `${name}不能为空。`);
  return value.trim();
}

function userRole(value: unknown): "USER" | "MODERATOR" | "ADMIN" {
  if (value === "USER" || value === "MODERATOR" || value === "ADMIN") return value;
  throw new ApiError("VALIDATION_ERROR", 400, "用户角色不正确。");
}

function integer(value: unknown, name: string): number {
  if (!Number.isInteger(value)) throw new ApiError("VALIDATION_ERROR", 400, `${name}必须是整数。`);
  return value as number;
}

function pageNumber(value: unknown): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 100000) {
    throw new ApiError("VALIDATION_ERROR", 400, "Page number is invalid.");
  }
  return value as number;
}

function capability(value: unknown): string {
  const permission = requiredString(value, "权限");
  if (!/^(forum|admin|tasks|shop|announce):[A-Za-z0-9_]+$/.test(permission)) {
    throw new ApiError("VALIDATION_ERROR", 400, "权限格式不正确。");
  }
  return permission;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  try {
    const context = await auth.checkPermission(request, "admin", "manageUsers");
    const body = await parseJsonBody(request);
    const action = requiredString(body.action, "操作");

    if (action === "list") {
      const page = pageNumber(body.page);
      const offset = (page - 1) * USER_PAGE_SIZE;
      const { data: profiles, error: profileError } = await db
        .from("user_public_profiles")
        .select("user_id, display_name, role, reputation, created_at")
        .order("created_at", { ascending: false })
        .order("user_id", { ascending: false })
        .range(offset, offset + USER_PAGE_SIZE);
      if (profileError) throw databaseError(profileError);
      const pageProfiles = (profiles ?? []).slice(0, USER_PAGE_SIZE);
      const userIds = pageProfiles.map((profile: { user_id: string }) => profile.user_id);
      const { data: moderation, error: moderationError } = userIds.length
        ? await db.from("user_moderation_state").select("user_id, muted_until").in("user_id", userIds)
        : { data: [], error: null };
      if (moderationError) throw databaseError(moderationError);
      const { data: permissionRows, error: permissionError } = userIds.length
        ? await db.from("user_granted_permissions").select("user_id, capability, expires_at, revoked_at").in("user_id", userIds)
        : { data: [], error: null };
      if (permissionError) throw databaseError(permissionError);
      const mutes = new Map((moderation ?? []).map((entry: { user_id: string; muted_until: string | null }) => [entry.user_id, entry.muted_until]));
      const permissions = new Map<string, string[]>();
      const now = Date.now();
      for (const entry of permissionRows ?? []) {
        if (entry.revoked_at || (entry.expires_at && Date.parse(entry.expires_at) <= now)) continue;
        const values = permissions.get(entry.user_id) ?? [];
        values.push(entry.capability);
        permissions.set(entry.user_id, values);
      }
      return jsonResponse({
        users: pageProfiles.map((profile: { user_id: string }) => ({
          ...profile,
          muted_until: mutes.get(profile.user_id) ?? null,
          permissions: (permissions.get(profile.user_id) ?? []).sort(),
        })),
        page,
        hasMore: (profiles ?? []).length > USER_PAGE_SIZE,
      });
    }

    if (action === "setRole") {
      const { data, error } = await db.rpc("admin_set_user_role", {
        p_actor_id: context.userId,
        p_user_id: requiredString(body.userId, "用户"),
        p_role: userRole(body.role),
      });
      if (error) throw databaseError(error);
      return jsonResponse({ user: data });
    }

    if (action === "setPermission") {
      if (typeof body.active !== "boolean") {
        throw new ApiError("VALIDATION_ERROR", 400, "权限状态不正确。");
      }
      const { data, error } = await db.rpc("admin_set_user_permission", {
        p_actor_id: context.userId,
        p_user_id: requiredString(body.userId, "用户"),
        p_capability: capability(body.capability ?? body.permission),
        p_active: body.active,
        p_reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "manual_admin",
      });
      if (error) throw databaseError(error);
      return jsonResponse({ permission: data });
    }

    if (action === "adjustReputation") {
      const { data, error } = await db.rpc("admin_adjust_reputation", {
        p_event_key: requiredString(body.eventKey, "事件标识"),
        p_actor_id: context.userId,
        p_user_id: requiredString(body.userId, "用户"),
        p_amount: integer(body.amount, "声望调整"),
        p_reason: requiredString(body.reason, "调整原因"),
      });
      if (error) throw databaseError(error);
      return jsonResponse({ reputation: data?.[0] ?? null });
    }

    if (action === "setMute") {
      const value = body.mutedUntil;
      const mutedUntil = value === null ? null : requiredString(value, "禁言结束时间");
      if (mutedUntil && !Number.isFinite(Date.parse(mutedUntil))) {
        throw new ApiError("VALIDATION_ERROR", 400, "禁言结束时间不正确。");
      }
      const { data, error } = await db.rpc("set_user_mute", {
        p_user_id: requiredString(body.userId, "用户"),
        p_muted_until: mutedUntil,
        p_actor_id: context.userId,
      });
      if (error) throw databaseError(error);
      return jsonResponse({ moderation: data });
    }

    throw new ApiError("VALIDATION_ERROR", 400, "不支持的用户管理操作。");
  } catch (error) {
    return errorResponse(error);
  }
});
