import test from "node:test";
import assert from "node:assert/strict";

import { ApiError, errorResponse, jsonResponse, parseJsonBody } from "../../supabase/functions/_shared/http.ts";

test("API errors expose a stable code and safe message", async () => {
  const response = errorResponse(new ApiError("FORBIDDEN", 403, "没有权限。"));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: { code: "FORBIDDEN", message: "没有权限。" },
  });
});

test("invalid JSON becomes a validation error", async () => {
  const request = new Request("https://functions.example/action", {
    method: "POST",
    body: "not json",
  });

  await assert.rejects(
    () => parseJsonBody(request),
    (error) => error instanceof ApiError && error.code === "VALIDATION_ERROR",
  );
});

test("JSON responses include the common content type", () => {
  const response = jsonResponse({ ok: true }, 201);

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
});
