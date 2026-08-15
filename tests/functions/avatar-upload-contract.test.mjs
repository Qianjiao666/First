import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  createAvatarUploadHandler,
  strictBase64Decode,
} from "../../supabase/functions/avatar-upload/index.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2jVQAAAAASUVORK5CYII=";

function request(payload = {}) {
  return new Request("https://example.supabase.co/functions/v1/avatar-upload", {
    method: "POST",
    headers: {
      authorization: "Bearer test-jwt",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fileName: "avatar.png",
      contentType: "image/png",
      contentBase64: PNG_BASE64,
      userId: "attacker-controlled-id",
      ...payload,
    }),
  });
}

function fixture(overrides = {}) {
  const events = [];
  const storage = {
    async download(path) {
      events.push(`download:${path}`);
      return null;
    },
    async upload(path, bytes, options) {
      events.push(`upload:${path}`);
      assert.ok(bytes instanceof Uint8Array);
      assert.deepEqual(options, { contentType: "image/png", upsert: true, cacheControl: "31536000" });
    },
    publicUrl(path) {
      return `https://project.supabase.co/storage/v1/object/public/avatars/${path}`;
    },
    async list(folder) {
      events.push(`list:${folder}`);
      return ["avatar.jpg", "avatar.png", "notes.txt"];
    },
    async remove(paths) {
      events.push(`remove:${paths.join(",")}`);
    },
  };
  const dependencies = {
    async requireContext() {
      events.push("auth");
      return { userId: USER_ID, role: "USER", mutedUntil: null };
    },
    async getAvatar() {
      events.push("profile:get");
      return "https://project.supabase.co/storage/v1/object/public/avatars/11111111-1111-4111-8111-111111111111/avatar.jpg?v=old";
    },
    async updateAvatar(userId, avatarUrl) {
      events.push(`profile:update:${userId}:${avatarUrl}`);
    },
    async moderateImage({ dataId }) {
      events.push(`ims:${dataId}`);
      return { suggestion: "Pass", label: "Normal", subLabel: "", requestId: "ims-1" };
    },
    storage,
    now: () => 1_700_000_000_000,
    ...overrides,
  };
  return { handler: createAvatarUploadHandler(dependencies), dependencies, events, storage };
}

test("authenticates before reading the body and ignores a client userId", async () => {
  const { handler, events } = fixture();
  const input = request();
  const originalJson = input.json.bind(input);
  input.json = async () => {
    events.push("body");
    return originalJson();
  };

  const response = await handler(input);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(events[0], "auth");
  assert.equal(events[1], "body");
  assert.ok(events.includes(`ims:${USER_ID}`));
  assert.ok(events.includes(`upload:${USER_ID}/avatar.png`));
  assert.doesNotMatch(JSON.stringify(events), /attacker-controlled-id/);
  assert.equal(body.avatarUrl, `https://project.supabase.co/storage/v1/object/public/avatars/${USER_ID}/avatar.png?v=1700000000000`);
});

test("runs IMS before the first Storage write and cleans old extensions only after profile success", async () => {
  const { handler, events } = fixture();
  const response = await handler(request());

  assert.equal(response.status, 200);
  const imsIndex = events.indexOf(`ims:${USER_ID}`);
  const uploadIndex = events.indexOf(`upload:${USER_ID}/avatar.png`);
  const profileIndex = events.findIndex((event) => event.startsWith("profile:update:"));
  const cleanupIndex = events.indexOf(`remove:${USER_ID}/avatar.jpg`);
  assert.ok(imsIndex >= 0 && imsIndex < uploadIndex);
  assert.ok(uploadIndex < profileIndex && profileIndex < cleanupIndex);
  assert.equal(events.some((event) => event.includes("notes.txt")), false);
});

test("profile failure removes the new object and restores overwritten bytes", async () => {
  const oldBytes = Uint8Array.of(9, 8, 7);
  const { handler, events, storage } = fixture({
    async updateAvatar() {
      events.push("profile:update:failed");
      throw new Error("database unavailable");
    },
  });
  storage.download = async (path) => {
    events.push(`download:${path}`);
    return oldBytes;
  };
  storage.upload = async (path, bytes) => {
    events.push(`upload:${path}:${[...bytes].join("-")}`);
  };

  const response = await handler(request());
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error.code, "AVATAR_UPLOAD_FAILED");
  assert.deepEqual(events.slice(-3), [
    "profile:update:failed",
    `remove:${USER_ID}/avatar.png`,
    `upload:${USER_ID}/avatar.png:9-8-7`,
  ]);
  assert.equal(events.some((event) => event === `remove:${USER_ID}/avatar.jpg`), false);
});

test("invalid base64 and decoded payloads over 2MB fail before moderation", async () => {
  assert.throws(() => strictBase64Decode("%%%"), (error) => error?.code === "INVALID_AVATAR");
  assert.throws(
    () => strictBase64Decode("A".repeat(2_796_204)),
    (error) => error?.code === "INVALID_AVATAR" && /2MB/.test(error.message),
  );

  const { handler, events } = fixture();
  const response = await handler(request({ contentBase64: "%%%" }));
  assert.equal(response.status, 400);
  assert.equal(events.some((event) => event.startsWith("ims:")), false);
  assert.equal(events.some((event) => event.startsWith("upload:")), false);
});

test("Edge source keeps authentication and IMS ahead of body/storage writes", async () => {
  const source = await fs.readFile(new URL("../../supabase/functions/avatar-upload/index.ts", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("export function createAvatarUploadHandler"), source.indexOf("type SupabaseResult"));
  assert.ok(handler.indexOf("requireContext(request)") < handler.indexOf("parseJsonBody(request)"));
  assert.ok(handler.indexOf("moderateImage({") < handler.indexOf("dependencies.storage.upload("));
  assert.doesNotMatch(source, /body\.userId|payload\.userId/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("existing public identity readers expose the approved avatar field", async () => {
  const paths = [
    "../../assets/js/core/runtime.js",
    "../../assets/js/forum/forum-api.js",
    "../../forum/forum-api.js",
    "../../assets/js/core/task-integration.js",
  ];
  for (const path of paths) {
    const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /select\("[^"]*\bavatar\b[^"]*"\)/, path);
  }
  const runtime = await fs.readFile(new URL("../../assets/js/core/runtime.js", import.meta.url), "utf8");
  assert.match(runtime, /avatar:\s*data\.avatar/);
  const taskIntegration = await fs.readFile(new URL("../../assets/js/core/task-integration.js", import.meta.url), "utf8");
  assert.match(taskIntegration, /applicant_avatar:/);
});
