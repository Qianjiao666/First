import { createEdgeServices } from "../_shared/supabase.ts";
import { guardPublicText } from "../_shared/content-guard.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;

function positiveInteger(value: unknown, name: string, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    throw new ApiError("VALIDATION_ERROR", 400, `${name}超出允许范围。`);
  }
  return value as number;
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new ApiError("VALIDATION_ERROR", 400, "失效时间不正确。");
  }
  return new Date(value).toISOString();
}

function createCode(): string {
  return `MKJ-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function rewardRole(value: unknown): "USER" | "MODERATOR" | null {
  if (value === undefined || value === null || value === "") return null;
  if (value === "USER" || value === "MODERATOR") return value;
  throw new ApiError("VALIDATION_ERROR", 400, "礼包码角色奖励仅支持 USER 或 MODERATOR。");
}

function rewardPermission(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError("VALIDATION_ERROR", 400, "礼包码权限奖励格式不正确。");
  const permission = value.trim();
  if (!/^(forum|shop|announce|tasks):[A-Za-z0-9_]+$/.test(permission) || permission.startsWith("tasks:manage") || permission.startsWith("tasks:publish") || permission.startsWith("admin:")) {
    throw new ApiError("VALIDATION_ERROR", 400, "礼包码不能授予管理权限。");
  }
  return permission;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  try {
    const context = await auth.checkPermission(request, "admin", "manageRedeemCodes");
    const body = await parseJsonBody(request);
    const action = body.action;

    if (action === "list") {
      const { data, error } = await db
        .from("redeem_codes")
        .select("id, code, reward_reputation, reward_title, reward_role, reward_permission, max_uses, current_uses, is_active, expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw databaseError(error);
      return jsonResponse({ codes: data ?? [] });
    }

    if (action === "create") {
      const quantity = positiveInteger(body.quantity, "生成数量", 100);
      const rewardReputation = positiveInteger(body.rewardReputation, "声望奖励", 10000);
      const maxUses = positiveInteger(body.maxUses, "最大使用次数", 1_000_000);
      const rewardTitle = typeof body.rewardTitle === "string" && body.rewardTitle.trim()
        ? guardPublicText(body.rewardTitle.trim(), { required: true, maxLength: 80 })
        : null;
      const grantRole = rewardRole(body.rewardRole);
      const grantPermission = rewardPermission(body.rewardPermission ?? body.grantPermission);
      if (!grantRole && !grantPermission && !rewardTitle && rewardReputation < 1) {
        throw new ApiError("VALIDATION_ERROR", 400, "礼包码至少需要一种奖励。");
      }
      const expiresAt = optionalDate(body.expiresAt);
      const rows = Array.from({ length: quantity }, () => ({
        code: createCode(),
        reward_reputation: rewardReputation,
        reward_title: rewardTitle?.text ?? null,
        reward_role: grantRole,
        reward_permission: grantPermission,
        max_uses: maxUses,
        expires_at: expiresAt,
        created_by_id: context.userId,
      }));
      const { data, error } = await db.from("redeem_codes").insert(rows).select("id, code, reward_reputation, reward_title, reward_role, reward_permission, max_uses, expires_at");
      if (error) throw databaseError(error);
      await db.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: "redeem_code.create",
        resource_type: "redeem_codes",
        metadata: { quantity, reward_reputation: rewardReputation, reward_role: grantRole, reward_permission: grantPermission },
      });
      return jsonResponse({ codes: data ?? [], warnings: rewardTitle?.matches ?? [] }, 201);
    }

    if (action === "setActive") {
      if (typeof body.isActive !== "boolean") throw new ApiError("VALIDATION_ERROR", 400, "礼包码状态不正确。");
      const { data, error } = await db
        .from("redeem_codes")
        .update({ is_active: body.isActive })
        .eq("id", typeof body.id === "string" ? body.id : "")
        .select("id, is_active")
        .maybeSingle();
      if (error) throw databaseError(error);
      if (!data) throw new ApiError("NOT_FOUND", 404, "礼包码不存在。");
      await db.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: "redeem_code.set_active",
        resource_type: "redeem_codes",
        resource_id: data.id,
        after_state: { is_active: data.is_active },
      });
      return jsonResponse({ code: data });
    }

    throw new ApiError("VALIDATION_ERROR", 400, "不支持的礼包码操作。");
  } catch (error) {
    return errorResponse(error);
  }
});
