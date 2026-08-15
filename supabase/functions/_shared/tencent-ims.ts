import { ApiError } from "./http.ts";

const ENDPOINT = "https://ims.tencentcloudapi.com";
const HOST = "ims.tencentcloudapi.com";
const SERVICE = "ims";
const ACTION = "ImageModeration";
const VERSION = "2020-12-29";
const REGION = "ap-guangzhou";
const ALGORITHM = "TC3-HMAC-SHA256";

type ModerateImageInput = {
  bytes: Uint8Array;
  dataId: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  secretId?: string;
  secretKey?: string;
  bizType?: string;
  timeoutMs?: number;
  logger?: (event: ImsDiagnostic) => void;
};

type ImsDiagnostic = {
  event: "ims_api_error" | "ims_http_error" | "ims_invalid_response" | "ims_missing_config" | "ims_network_error" | "ims_pass" | "ims_rejected";
  errorCode?: string;
  httpStatus?: number;
  parameter?: string;
  requestId?: string;
  suggestion?: "Block" | "Review" | "Unknown";
};

export type ModerationResult = {
  suggestion: "Pass";
  label: string;
  subLabel: string;
  requestId: string;
};

function environment(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno;
  return deno?.env?.get?.(name);
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmac(key: string | Uint8Array, value: string): Promise<Uint8Array> {
  const rawKey = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const imported = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, new TextEncoder().encode(value)));
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function rejected(status = 503): ApiError {
  return new ApiError("AVATAR_REJECTED", status, "头像安全审核未通过，请更换图片后重试。");
}

function safeToken(value: unknown, maxLength: number, fallback?: string): string | undefined {
  if (typeof value !== "string") return fallback;
  const token = value.match(/^[A-Za-z0-9._-]+$/)?.[0];
  return token ? token.slice(0, maxLength) : fallback;
}

function missingParameterName(errorCode: string | undefined, message: unknown): string | undefined {
  if (errorCode !== "MissingParameter" || typeof message !== "string") return undefined;
  const token = "([A-Za-z][A-Za-z0-9]{0,31})";
  const patterns = [
    new RegExp(`(?:required\\s+)?parameter\\s+[\u0060'\"]?${token}[\u0060'\"]?\\s+is\\s+missing`, "i"),
    new RegExp(`(?:缺少|缺失)(?:必填)?参数[：:\\s]+[\u0060'\"]?${token}[\u0060'\"]?`),
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

function emitDiagnostic(input: ModerateImageInput, event: ImsDiagnostic): void {
  try {
    (input.logger ?? ((payload) => console.warn(JSON.stringify(payload))))(event);
  } catch {
    // Diagnostics must never change the fail-closed moderation decision.
  }
}

export async function moderateImage(input: ModerateImageInput): Promise<ModerationResult> {
  const secretId = input.secretId ?? environment("TENCENTCLOUD_SECRET_ID");
  const secretKey = input.secretKey ?? environment("TENCENTCLOUD_SECRET_KEY");
  if (!secretId || !secretKey) {
    emitDiagnostic(input, { event: "ims_missing_config" });
    throw rejected();
  }

  const now = input.now?.() ?? new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const date = now.toISOString().slice(0, 10);
  const bizType = input.bizType ?? environment("TENCENT_IMS_BIZ_TYPE");
  const payload: Record<string, string> = {
    FileContent: base64(input.bytes),
    DataId: input.dataId,
  };
  if (bizType) payload.BizType = bizType;
  const body = JSON.stringify(payload);

  const canonicalHeaders = "content-type:application/json; charset=utf-8\nhost:ims.tencentcloudapi.com\n";
  const signedHeaders = "content-type;host";
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${await sha256(body)}`;
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = `${ALGORITHM}\n${timestamp}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  const secretDate = await hmac(`TC3${secretKey}`, date);
  const secretService = await hmac(secretDate, SERVICE);
  const secretSigning = await hmac(secretService, "tc3_request");
  const signature = hex((await hmac(secretSigning, stringToSign)).buffer);
  const authorization = `${ALGORITHM} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const response = await (input.fetchImpl ?? fetch)(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Host: HOST,
        "X-TC-Action": ACTION,
        "X-TC-Region": REGION,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Version": VERSION,
        Authorization: authorization,
      },
      body,
      signal: AbortSignal.timeout(input.timeoutMs ?? 10_000),
    });
    if (!response.ok) {
      emitDiagnostic(input, { event: "ims_http_error", httpStatus: response.status });
      throw rejected();
    }
    const envelope = await response.json() as {
      Response?: {
        Suggestion?: unknown;
        Label?: unknown;
        SubLabel?: unknown;
        RequestId?: unknown;
        Error?: unknown;
      };
    };
    const result = envelope?.Response;
    const requestId = safeToken(result?.RequestId, 18);
    if (result?.Error) {
      const apiError = result.Error as { Code?: unknown; Message?: unknown };
      const errorCode = safeToken(apiError.Code, 64, "Unknown");
      const parameter = missingParameterName(errorCode, apiError.Message);
      emitDiagnostic(input, {
        event: "ims_api_error",
        errorCode,
        ...(parameter ? { parameter } : {}),
        requestId,
      });
      throw rejected(400);
    }
    if (result?.Suggestion === "Review" || result?.Suggestion === "Block") {
      emitDiagnostic(input, { event: "ims_rejected", requestId, suggestion: result.Suggestion });
      throw rejected(400);
    }
    if (!result || result.Suggestion !== "Pass" || typeof result.RequestId !== "string") {
      emitDiagnostic(input, { event: "ims_invalid_response", requestId });
      throw rejected(400);
    }
    emitDiagnostic(input, { event: "ims_pass", requestId });
    return {
      suggestion: "Pass",
      label: typeof result.Label === "string" ? result.Label : "",
      subLabel: typeof result.SubLabel === "string" ? result.SubLabel : "",
      requestId: result.RequestId,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    emitDiagnostic(input, { event: "ims_network_error" });
    throw rejected();
  }
}
