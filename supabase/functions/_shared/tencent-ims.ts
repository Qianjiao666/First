import { ApiError } from "./http.ts";

const ENDPOINT = "https://ims.tencentcloudapi.com";
const HOST = "ims.tencentcloudapi.com";
const SERVICE = "ims";
const ACTION = "ImageModeration";
const VERSION = "2020-12-29";
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

export async function moderateImage(input: ModerateImageInput): Promise<ModerationResult> {
  const secretId = input.secretId ?? environment("TENCENTCLOUD_SECRET_ID");
  const secretKey = input.secretKey ?? environment("TENCENTCLOUD_SECRET_KEY");
  if (!secretId || !secretKey) throw rejected();

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
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Version": VERSION,
        Authorization: authorization,
      },
      body,
      signal: AbortSignal.timeout(input.timeoutMs ?? 10_000),
    });
    if (!response.ok) throw rejected();
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
    if (!result || result.Error || result.Suggestion !== "Pass" || typeof result.RequestId !== "string") {
      throw rejected(400);
    }
    return {
      suggestion: "Pass",
      label: typeof result.Label === "string" ? result.Label : "",
      subLabel: typeof result.SubLabel === "string" ? result.SubLabel : "",
      requestId: result.RequestId,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw rejected();
  }
}
