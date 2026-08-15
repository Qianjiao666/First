const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const migrationPath = path.join(root, "supabase/migrations/20260812_v1_1_avatar.sql");
const migration = fs.readFileSync(migrationPath, "utf8");

function avatarPolicyStatements(sql) {
  return [...sql.matchAll(/create\s+policy\s+[^;]+\s+on\s+storage\.objects[\s\S]*?;/gi)]
    .map((match) => match[0])
    .filter((statement) => /bucket_id\s*=\s*'avatars'/i.test(statement));
}

test("avatar migration adds only the approved profile column and no table", () => {
  assert.doesNotMatch(migration, /\bcreate\s+table\b/i);
  assert.match(
    migration,
    /alter\s+table\s+public\.user_public_profiles\s+add\s+column\s+if\s+not\s+exists\s+avatar\s+text\s*;/i,
  );

  const addedColumns = [...migration.matchAll(/\badd\s+column\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)\s+([a-z][a-z0-9_]*(?:\([^)]*\))?)/gi)]
    .map((match) => ({ name: match[1].toLowerCase(), type: match[2].toLowerCase() }));
  assert.deepEqual(addedColumns, [{ name: "avatar", type: "text" }]);
});

test("avatars bucket enforces the approved public image limits", () => {
  assert.match(migration, /insert\s+into\s+storage\.buckets\s*\(\s*id\s*,\s*name\s*,\s*public\s*,\s*file_size_limit\s*,\s*allowed_mime_types\s*\)/i);
  assert.match(migration, /'avatars'\s*,\s*'avatars'\s*,\s*true\s*,\s*2097152\s*,\s*array\s*\[\s*'image\/jpeg'\s*,\s*'image\/png'\s*,\s*'image\/webp'\s*\]/i);
  assert.match(migration, /on\s+conflict\s*\(\s*id\s*\)\s+do\s+update[\s\S]*file_size_limit\s*=\s*excluded\.file_size_limit[\s\S]*allowed_mime_types\s*=\s*excluded\.allowed_mime_types/i);
});

test("avatar objects are publicly readable but browser roles receive no write policy", () => {
  const policies = avatarPolicyStatements(migration);
  assert.equal(policies.length, 1);
  assert.match(policies[0], /for\s+select\s+to\s+anon\s*,\s*authenticated/i);
  assert.match(policies[0], /storage\.foldername\s*\(\s*name\s*\)\s*\)\s*\[\s*1\s*\][\s\S]*\^\[0-9a-f-\]\{36\}\$/i);
  assert.doesNotMatch(policies[0], /for\s+(?:insert|update|delete|all)\b/i);
  assert.doesNotMatch(
    migration,
    /create\s+policy[\s\S]*?on\s+storage\.objects[\s\S]*?for\s+(?:insert|update|delete|all)[\s\S]*?bucket_id\s*=\s*'avatars'/i,
  );
});
