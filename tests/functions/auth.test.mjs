import test from "node:test";
import assert from "node:assert/strict";

import { ApiError, createAuthService } from "../../supabase/functions/_shared/auth.ts";

function createService({ role = "USER", mutedUntil = null, grantedCapabilities = [] } = {}) {
  const sessionClient = {
    auth: {
      async getUser() {
        return { data: { user: { id: "user-1" } }, error: null };
      },
    },
  };
  const adminClient = {
    async rpc(name, args) {
      assert.equal(name, "has_capability");
      return {
        data: grantedCapabilities.includes(args.p_capability),
        error: null,
      };
    },
    from(table) {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  if (table === "user_public_profiles") {
                    return { data: { user_id: "user-1", role }, error: null };
                  }
                  return { data: { muted_until: mutedUntil }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  return createAuthService({
    url: "https://example.supabase.co",
    anonKey: "anon-key",
    serviceRoleKey: "service-key",
    createClient: (_url, key) => (key === "anon-key" ? sessionClient : adminClient),
  });
}

test("checks the trusted role rather than client-provided role", async () => {
  const auth = createService({ role: "MODERATOR", grantedCapabilities: ["forum:deleteAnyPost"] });
  const request = new Request("https://functions.example/forum", {
    headers: { Authorization: "Bearer user-jwt" },
  });

  const context = await auth.checkPermission(request, "forum", "deleteAnyPost");

  assert.equal(context.userId, "user-1");
  assert.equal(context.role, "MODERATOR");
});

test("uses the database capability decision even when the role normally allows the action", async () => {
  const auth = createService({ role: "MODERATOR" });
  const request = new Request("https://functions.example/forum", {
    headers: { Authorization: "Bearer user-jwt" },
  });

  await assert.rejects(
    () => auth.checkPermission(request, "forum", "deleteAnyPost"),
    (error) => error instanceof ApiError && error.code === "FORBIDDEN",
  );
});

test("rejects actions outside the trusted role", async () => {
  const auth = createService({ role: "MODERATOR" });
  const request = new Request("https://functions.example/admin", {
    headers: { Authorization: "Bearer user-jwt" },
  });

  await assert.rejects(
    () => auth.checkPermission(request, "admin", "manageUsers"),
    (error) => error instanceof ApiError && error.code === "FORBIDDEN",
  );
});

test("accepts an exact capability granted to a user", async () => {
  const auth = createService({ role: "USER", grantedCapabilities: ["admin:manageUsers"] });
  const request = new Request("https://functions.example/admin", {
    headers: { Authorization: "Bearer user-jwt" },
  });

  const context = await auth.checkPermission(request, "admin", "manageUsers");

  assert.equal(context.userId, "user-1");
  assert.equal(context.role, "USER");
});

test("blocks writes while a mute is active", () => {
  const auth = createService();

  assert.throws(
    () => auth.assertNotMuted({
      userId: "user-1",
      role: "USER",
      mutedUntil: new Date(Date.now() + 60_000).toISOString(),
    }),
    (error) => error instanceof ApiError && error.code === "MUTED",
  );
});
