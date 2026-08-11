import { USER_ROLES, type UserRole } from "./permissions.ts";
import { ApiError } from "./http.ts";

export { ApiError } from "./http.ts";

type UserRecord = { id: string } | null;
type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

type SessionClient = {
  auth: {
    getUser: () => Promise<{ data: { user: UserRecord }; error: { message: string } | null }>;
  };
};

type AdminClient = {
  rpc: <T>(name: string, args: Record<string, unknown>) => QueryResult<T>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: <T>() => QueryResult<T>;
      };
    };
  };
};

type ClientFactory = (
  url: string,
  key: string,
  options?: Record<string, unknown>,
) => SessionClient | AdminClient;

export type TrustedContext = {
  userId: string;
  role: UserRole;
  mutedUntil: string | null;
};

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export function createAuthService(input: {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  createClient: ClientFactory;
}) {
  function createAdminClient(): AdminClient {
    return input.createClient(input.url, input.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as AdminClient;
  }

  async function requireContext(request: Request): Promise<TrustedContext> {
    const token = getBearerToken(request);
    if (!token) throw new ApiError("UNAUTHENTICATED", 401, "请先登录后再继续。");

    const sessionClient = input.createClient(input.url, input.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }) as SessionClient;
    const { data: sessionData, error: sessionError } = await sessionClient.auth.getUser();
    if (sessionError || !sessionData.user) {
      throw new ApiError("UNAUTHENTICATED", 401, "登录状态已失效，请重新登录。");
    }

    const adminClient = createAdminClient();
    const { data: publicProfile, error: profileError } = await adminClient
      .from("user_public_profiles")
      .select("user_id, role")
      .eq("user_id", sessionData.user.id)
      .maybeSingle<{ user_id: string; role: UserRole }>();
    if (profileError || !publicProfile || !USER_ROLES.includes(publicProfile.role)) {
      throw new ApiError("FORBIDDEN", 403, "账户全局资料尚未准备完成。");
    }

    const { data: moderationState, error: moderationError } = await adminClient
      .from("user_moderation_state")
      .select("muted_until")
      .eq("user_id", sessionData.user.id)
      .maybeSingle<{ muted_until: string | null }>();
    if (moderationError) {
      throw new ApiError("INTERNAL_ERROR", 500, "无法读取账户状态，请稍后重试。");
    }

    return {
      userId: sessionData.user.id,
      role: publicProfile.role,
      mutedUntil: moderationState?.muted_until ?? null,
    };
  }

  async function checkPermission(
    request: Request,
    resource: string,
    action: string,
  ): Promise<TrustedContext> {
    const context = await requireContext(request);
    const { data: granted, error } = await createAdminClient().rpc<boolean>("has_capability", {
      p_user_id: context.userId,
      p_capability: `${resource}:${action}`,
    });
    if (error) throw new ApiError("INTERNAL_ERROR", 500, "无法校验账户权限，请稍后重试。");
    if (granted !== true) throw new ApiError("FORBIDDEN", 403, "当前账户没有执行此操作的权限。");
    return context;
  }

  function assertNotMuted(context: TrustedContext): void {
    if (!context.mutedUntil) return;

    const mutedUntil = Date.parse(context.mutedUntil);
    if (Number.isFinite(mutedUntil) && mutedUntil > Date.now()) {
      throw new ApiError("MUTED", 403, `当前账户已被禁言至 ${context.mutedUntil}。`);
    }
  }

  return { createAdminClient, requireContext, checkPermission, assertNotMuted };
}
