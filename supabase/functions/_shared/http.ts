export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
  }

  return jsonResponse(
    { error: { code: "INTERNAL_ERROR", message: "服务暂时不可用，请稍后重试。" } },
    500,
  );
}

export function databaseError(error: { code?: string } | null): ApiError {
  switch (error?.code) {
    case "42501":
      return new ApiError("FORBIDDEN", 403, "当前账户没有执行此操作的权限。");
    case "P0002":
      return new ApiError("NOT_FOUND", 404, "目标内容不存在或已不可用。");
    case "23505":
      return new ApiError("CONFLICT", 409, "该操作与现有记录冲突。");
    case "55000":
      return new ApiError("CONFLICT", 409, "当前内容已锁定，暂时不能继续操作。");
    case "22023":
      return new ApiError("VALIDATION_ERROR", 400, "提交内容不符合要求。");
    default:
      return new ApiError("INTERNAL_ERROR", 500, "服务暂时不可用，请稍后重试。");
  }
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ApiError("VALIDATION_ERROR", 400, "请求内容格式不正确。");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("VALIDATION_ERROR", 400, "请求内容格式不正确。");
  }
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
