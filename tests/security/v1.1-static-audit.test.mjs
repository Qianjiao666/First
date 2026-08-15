import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function source(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function functionBlock(sql, name) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = sql.indexOf("create or replace function public.", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

test("the v1.1 audit report covers every required dimension with no open High or Medium finding", async () => {
  const report = await source("docs/security/v1.1-security-audit.md");

  for (const heading of ["XSS", "CSRF", "RLS", "礼包码", "头像", "DFA", "凭据"]) {
    assert.match(report, new RegExp(heading, "i"), `report must cover ${heading}`);
  }
  assert.match(report, /SEC-001[\s\S]*Medium[\s\S]*(?:Closed|Resolved)/i);
  assert.match(report, /未关闭[^\n]*(?:High|Medium)[^\n]*0|Open[^\n]*(?:High|Medium)[^\n]*0/i);
  assert.doesNotMatch(report, /\|\s*(?:Critical|High|Medium)\s*\|[^\n]*\|\s*Open\s*\|/i);
});

test("Edge authentication failures are delegated to the session coordinator", async () => {
  const runtime = await source("assets/js/core/runtime.js");
  const invokeFunction = runtime.match(/async function invokeFunction[\s\S]*?\n}/)?.[0] ?? "";

  assert.match(invokeFunction, /const activeSession = await getSession\(\)/);
  assert.match(invokeFunction, /Authorization: `Bearer \$\{activeSession\.access_token\}`/);
  assert.match(invokeFunction, /session\.handleApiAuthFailure\(error\)/);
  assert.doesNotMatch(invokeFunction, /const session = await getSession\(\)/);
});

test("avatar moderation and byte validation finish before the first Storage upload", async () => {
  const avatar = await source("supabase/functions/avatar-upload/index.ts");
  const handler = avatar.slice(
    avatar.indexOf("export function createAvatarUploadHandler"),
    avatar.indexOf("type SupabaseResult"),
  );
  const authentication = handler.indexOf("dependencies.requireContext(request)");
  const byteValidation = handler.indexOf("validateAvatarBytes(");
  const moderation = handler.indexOf("dependencies.moderateImage(");
  const firstUpload = handler.indexOf("dependencies.storage.upload(");

  assert.ok(authentication >= 0 && authentication < byteValidation);
  assert.ok(byteValidation < moderation);
  assert.ok(moderation < firstUpload);
  assert.match(handler, /moderation\.suggestion\s*!==\s*"Pass"/);
});

test("the avatar bucket is public-read and has no browser write policy", async () => {
  const migration = await source("supabase/migrations/20260812_v1_1_avatar.sql");
  const policies = [...migration.matchAll(/create\s+policy\s+[^;]+\s+on\s+storage\.objects[\s\S]*?;/gi)]
    .map((match) => match[0])
    .filter((statement) => /bucket_id\s*=\s*'avatars'/i.test(statement));

  assert.equal(policies.length, 1);
  assert.match(policies[0], /for\s+select\s+to\s+anon\s*,\s*authenticated/i);
  assert.doesNotMatch(migration, /create\s+policy[\s\S]*?for\s+(?:insert|update|delete|all)[\s\S]*?bucket_id\s*=\s*'avatars'/i);
});

test("redeem rewards remain authenticated and service-role authoritative", async () => {
  const [edge, browser, schema] = await Promise.all([
    source("supabase/functions/redeem/index.ts"),
    source("assets/js/core/redeem.js"),
    source("supabase/schema.sql"),
  ]);
  const redeemRpc = functionBlock(schema, "redeem_code");

  assert.match(edge, /auth\.requireContext\(request\)/);
  assert.match(edge, /db\.rpc\("redeem_code"/);
  assert.doesNotMatch(browser, /(?:reputation|points)\s*(?:\+=|-=|=\s*[^=])/i);
  assert.match(redeemRpc, /for\s+update/i);
  assert.match(schema, /revoke all on function public\.redeem_code\(uuid, text\)\s+from public, anon, authenticated;/i);
  assert.match(schema, /grant execute on function public\.redeem_code\(uuid, text\)\s+to service_role;/i);
});

test("the public text write matrix stays backend-authoritative", async () => {
  const coverage = await source("tests/functions/content-coverage.test.mjs");
  const entries = [...coverage.matchAll(/backendFile:\s*"([^"]+)"[\s\S]*?backendMarker:\s*'([^']+)'/g)];

  assert.ok(entries.length >= 18, "all public text surfaces must remain enumerated");
  for (const [, backendFile, marker] of entries) {
    const backend = await source(backendFile);
    const guardIndex = backend.indexOf("guardPublicText(");
    const writeIndex = backend.indexOf(marker);
    assert.ok(guardIndex >= 0 && writeIndex > guardIndex, `${backendFile}: guard must precede ${marker}`);
  }
});

test("tracked release sources contain no private credential shape", async () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((file) => !/^(?:assets\/vendor|deployment\/|output\/|tests\/)/.test(file));
  const credentialPatterns = [
    /-----BEGIN (?:RSA|EC|OPENSSH) PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bAKID[A-Za-z0-9]{12,}\b/,
    /\b(?:postgres|mysql|mongodb|redis):\/\/[^\s"']+@/i,
    /\b(?:service[_-]?role|secret[_-]?key|password|refresh[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/i,
  ];
  const violations = [];

  for (const file of tracked) {
    const absolutePath = path.join(root, file);
    let contents;
    try {
      contents = await fs.readFile(absolutePath, "utf8");
    } catch {
      continue;
    }
    if (credentialPatterns.some((pattern) => pattern.test(contents))) violations.push(file);
  }

  assert.deepEqual(violations, []);
});
