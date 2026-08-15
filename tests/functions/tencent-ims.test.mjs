import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../../supabase/functions/_shared/http.ts";
import { moderateImage } from "../../supabase/functions/_shared/tencent-ims.ts";

const FIXED_NOW = new Date("2020-08-22T12:37:05Z");
const AUTHORIZATION = "TC3-HMAC-SHA256 Credential=unit-test-secret-id/2020-08-22/ims/tc3_request, SignedHeaders=content-type;host, Signature=df040436f4f4e172a0d9fe7d97f5e16419481dde4a4dcb681510b2f584e66c0c";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const options = (fetchImpl) => ({
  bytes: Uint8Array.of(1, 2, 3),
  dataId: "avatar-test",
  fetchImpl,
  now: () => FIXED_NOW,
  secretId: "unit-test-secret-id",
  secretKey: "unit-test-secret-key",
  bizType: "avatar-biz",
  timeoutMs: 20,
  logger: () => {},
});

test("emits allowlisted diagnostics without secrets, identity or image content", async () => {
  const diagnostics = [];
  await assert.rejects(
    () => moderateImage({
      ...options(async () => response({
        Response: {
          Error: { Code: "AuthFailure.SecretIdNotFound", Message: "bad unit-test-secret-key" },
          RequestId: "request-diagnostic-1234567890",
        },
      })),
      logger: (event) => diagnostics.push(event),
    }),
    (error) => error instanceof ApiError && error.code === "AVATAR_REJECTED",
  );

  assert.deepEqual(diagnostics, [{
    event: "ims_api_error",
    errorCode: "AuthFailure.SecretIdNotFound",
    requestId: "request-diagnostic",
  }]);
  const serialized = JSON.stringify(diagnostics);
  assert.doesNotMatch(serialized, /unit-test-secret|avatar-test|AQID|bad secret|Authorization/i);
});

test("extracts only a safe missing parameter name from Tencent API errors", async () => {
  const diagnostics = [];
  await assert.rejects(
    () => moderateImage({
      ...options(async () => response({
        Response: {
          Error: {
            Code: "MissingParameter",
            Message: "The required parameter `BizType` is missing. unit-test-secret-key",
          },
          RequestId: "request-missing-parameter",
        },
      })),
      logger: (event) => diagnostics.push(event),
    }),
    (error) => error instanceof ApiError && error.code === "AVATAR_REJECTED",
  );

  assert.deepEqual(diagnostics, [{
    event: "ims_api_error",
    errorCode: "MissingParameter",
    parameter: "BizType",
    requestId: "request-missing-pa",
  }]);
  assert.doesNotMatch(JSON.stringify(diagnostics), /unit-test-secret|required parameter|missing\./i);
});

test("signs the deterministic TC3 ImageModeration request and accepts exact Pass", async () => {
  let captured;
  const result = await moderateImage(options(async (url, init) => {
    captured = { url, init };
    return response({ Response: { Suggestion: "Pass", Label: "Normal", SubLabel: "", RequestId: "request-1" } });
  }));

  assert.equal(captured.url, "https://ims.tencentcloudapi.com");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["Content-Type"], "application/json; charset=utf-8");
  assert.equal(captured.init.headers.Host, "ims.tencentcloudapi.com");
  assert.equal(captured.init.headers["X-TC-Action"], "ImageModeration");
  assert.equal(captured.init.headers["X-TC-Timestamp"], "1598099825");
  assert.equal(captured.init.headers["X-TC-Version"], "2020-12-29");
  assert.equal(captured.init.headers["X-TC-Region"], "ap-guangzhou");
  assert.equal(captured.init.headers.Authorization, AUTHORIZATION);
  assert.equal(captured.init.body, '{"FileContent":"AQID","DataId":"avatar-test","BizType":"avatar-biz"}');
  assert.deepEqual(result, { suggestion: "Pass", label: "Normal", subLabel: "", requestId: "request-1" });
});

test("fails closed for Review, Block, malformed data and Tencent API errors", async () => {
  const bodies = [
    { Response: { Suggestion: "Review", Label: "Porn", RequestId: "r1" } },
    { Response: { Suggestion: "Block", Label: "Abuse", RequestId: "r2" } },
    { Response: { Label: "Normal", RequestId: "r3" } },
    { Response: { Error: { Code: "AuthFailure.SecretIdNotFound", Message: "bad secret" }, RequestId: "r4" } },
  ];
  for (const body of bodies) {
    await assert.rejects(
      () => moderateImage(options(async () => response(body))),
      (error) => error instanceof ApiError && error.code === "AVATAR_REJECTED" && !/bad secret|unit-test-secret/.test(error.message),
    );
  }
});

test("fails closed for HTTP, network and timeout failures without leaking secrets", async () => {
  const fetches = [
    async () => response({ error: "unavailable" }, 503),
    async () => { throw new Error("network includes unit-test-secret-key"); },
    async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")), { once: true });
    }),
  ];
  for (const fetchImpl of fetches) {
    await assert.rejects(
      () => moderateImage(options(fetchImpl)),
      (error) => error instanceof ApiError
        && error.code === "AVATAR_REJECTED"
        && !/unit-test-secret|network includes/.test(error.message),
    );
  }
});
