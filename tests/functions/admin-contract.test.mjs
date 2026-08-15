import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const functions = [
  ["supabase/functions/admin-users/index.ts", "manageUsers"],
  ["supabase/functions/admin-redeem-codes/index.ts", "manageRedeemCodes"],
  ["supabase/functions/admin-sensitive-words/index.ts", "manageSensitiveWords"],
  ["supabase/functions/admin-transfer-account/index.ts", "transferAccount"],
];

async function read(path) {
  try {
    return await fs.readFile(fileURLToPath(new URL(path, root)), "utf8");
  } catch {
    return null;
  }
}

test("admin functions authorize each concrete management action", async () => {
  for (const [path, action] of functions) {
    const source = await read(path);
    assert.ok(source, `${path} exists`);
    assert.match(source, new RegExp(`checkPermission\\(request, "admin", "${action}"\\)`));
  }
});

test("redemption is authenticated and uses the atomic service RPC", async () => {
  const source = await read("supabase/functions/redeem/index.ts");
  assert.ok(source, "redeem Edge Function exists");
  assert.match(source, /auth\.requireContext\(request\)/);
  assert.match(source, /rpc\("redeem_code"/);
});

test("user management returns a bounded page with explicit continuation state", async () => {
  const source = await read("supabase/functions/admin-users/index.ts");
  assert.ok(source, "admin user function exists");
  assert.match(source, /USER_PAGE_SIZE/);
  assert.match(source, /\.range\(offset, offset \+ USER_PAGE_SIZE\)/);
  assert.match(source, /hasMore/);
  assert.doesNotMatch(source, /\.limit\(100\)/);
});
