import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../../", import.meta.url);

export const WRITE_SURFACES = Object.freeze([
  { id: "forum-title", field: "title", frontendFile: "forum/forum-events.js", backendFile: "supabase/functions/forum-post/index.ts", backendMarker: '"create_forum_post"', mode: "dual" },
  { id: "forum-content", field: "content", frontendFile: "forum/forum-events.js", backendFile: "supabase/functions/forum-post/index.ts", backendMarker: '"create_forum_post"', mode: "dual" },
  { id: "forum-comment", field: "content", frontendFile: "forum/forum-events.js", backendFile: "supabase/functions/forum-comment/index.ts", backendMarker: '"create_forum_comment"', mode: "dual" },
  { id: "task-title", field: "title", frontendFile: "assets/js/tasks/task-create.js", backendFile: "supabase/functions/task-admin/index.ts", backendMarker: '"create_task"', mode: "dual" },
  { id: "task-summary", field: "summary", frontendFile: "assets/js/tasks/task-create.js", backendFile: "supabase/functions/task-admin/index.ts", backendMarker: '"create_task"', mode: "dual" },
  { id: "task-body", field: "body", frontendFile: "assets/js/tasks/task-create.js", backendFile: "supabase/functions/task-admin/index.ts", backendMarker: '"create_task"', mode: "dual" },
  { id: "task-application-note", field: "applicationNote", frontendFile: "assets/js/tasks/task-detail.js", backendFile: "supabase/functions/task-complete/index.ts", backendMarker: '"apply_task"', mode: "dual" },
  { id: "task-submission-note", field: "submissionNote", frontendFile: "assets/js/tasks/task-my.js", backendFile: "supabase/functions/task-complete/index.ts", backendMarker: '"submit_task"', mode: "dual" },
  { id: "task-review", field: "content", frontendFile: "assets/js/tasks/task-admin.js", backendFile: "supabase/functions/task-complete/index.ts", backendMarker: '"complete_task"', mode: "dual" },
  { id: "task-review-api", field: "content", backendFile: "supabase/functions/task-review/index.ts", backendMarker: '"submit_task_review"', mode: "backend-only" },
  { id: "task-attachment-caption", field: "caption", backendFile: "supabase/functions/task-attachments/index.ts", backendMarker: '"register_task_attachment"', mode: "backend-only" },
  { id: "task-category-name", field: "name", frontendFile: "assets/js/tasks/task-admin.js", backendFile: "supabase/functions/task-admin/index.ts", backendMarker: '"upsert_task_category"', mode: "dual" },
  { id: "task-category-description", field: "description", frontendFile: "assets/js/tasks/task-admin.js", backendFile: "supabase/functions/task-admin/index.ts", backendMarker: '"upsert_task_category"', mode: "dual" },
  { id: "announcement-title", field: "title", frontendFile: "announcements/announcements.js", backendFile: "supabase/functions/announcements/index.ts", backendMarker: '"upsert_announcement"', mode: "dual" },
  { id: "announcement-markdown", field: "markdown", frontendFile: "announcements/announcements.js", backendFile: "supabase/functions/announcements/index.ts", backendMarker: '"upsert_announcement"', mode: "dual" },
  { id: "shop-product-name", field: "name", backendFile: "supabase/functions/shop/index.ts", backendMarker: '"upsert_shop_product"', mode: "backend-only" },
  { id: "shop-product-description", field: "description", backendFile: "supabase/functions/shop/index.ts", backendMarker: '"upsert_shop_product"', mode: "backend-only" },
  { id: "redeem-reward-title", field: "rewardTitle", frontendFile: "admin/admin-events.js", backendFile: "supabase/functions/admin-redeem-codes/index.ts", backendMarker: 'from("redeem_codes").insert', mode: "dual" },
  { id: "registration-display-name", field: "displayName", frontendFile: "script.js", mode: "frontend-auth-metadata" },
  { id: "assessment-answers", field: null, frontendFile: "script.js", mode: "fixed-choice" },
]);

async function source(path) {
  return fs.readFile(new URL(path, root), "utf8");
}

test("every public write surface has an explicit filtering mode", () => {
  assert.equal(new Set(WRITE_SURFACES.map(({ id }) => id)).size, WRITE_SURFACES.length);
  for (const surface of WRITE_SURFACES) {
    assert.ok(["dual", "backend-only", "frontend-auth-metadata", "fixed-choice"].includes(surface.mode), surface.id);
  }
});

test("all dual frontend surfaces call guardFormData for their named field", async () => {
  for (const surface of WRITE_SURFACES.filter(({ mode }) => mode === "dual")) {
    const frontend = await source(surface.frontendFile);
    assert.match(frontend, /guardFormData\s*\(/, `${surface.id}: ${surface.frontendFile} must call guardFormData`);
    assert.match(frontend, new RegExp(`[\"']${surface.field}[\"']`), `${surface.id}: ${surface.field} must be explicit`);
  }
});

test("all backend-authoritative surfaces guard text before their first write", async () => {
  for (const surface of WRITE_SURFACES.filter(({ backendFile }) => backendFile)) {
    const backend = await source(surface.backendFile);
    const guardIndex = backend.indexOf("guardPublicText(");
    const writeIndex = backend.indexOf(surface.backendMarker);
    assert.ok(guardIndex >= 0, `${surface.id}: ${surface.backendFile} must call guardPublicText`);
    assert.ok(writeIndex >= 0 && guardIndex < writeIndex, `${surface.id}: guard must precede ${surface.backendMarker}`);
  }
});

test("registration filters displayName without filtering credentials", async () => {
  const homepage = await source("script.js");
  assert.match(homepage, /guardFormData\s*\([^)]*\[\s*["']displayName["']\s*\]/s);
  assert.doesNotMatch(homepage, /guardFormData\s*\([^)]*\b(?:email|password|token)\b/s);
});

test("assessment remains a fixed-choice flow with no free-text security hook", async () => {
  const homepage = await source("script.js");
  assert.match(homepage, /const mkjQuestions\s*=\s*\[/);
  assert.doesNotMatch(homepage, /guardFormData\s*\([^)]*(?:mkjQuestions|mkjAnswers|assessment)/s);
});

test("the fixed DFA has no new browser sensitive-word administration surface", async () => {
  const lexicon = await source("assets/js/security/sensitive-lexicon.js");
  assert.match(lexicon, /CUSTOM_WARN_WORDS\s*=\s*Object\.freeze\(\[\]\)/);
  assert.match(lexicon, /CUSTOM_BLOCK_WORDS\s*=\s*Object\.freeze\(\[\]\)/);
});

test("redeem-code filtering never moves code or privilege logic into the browser", async () => {
  const frontend = await source("admin/admin-events.js");
  const backend = await source("supabase/functions/admin-redeem-codes/index.ts");
  assert.doesNotMatch(frontend, /function\s+createCode|crypto\.randomUUID\(\).*MKJ-/s);
  assert.doesNotMatch(frontend, /guardFormData\s*\([^)]*\b(?:code|grantPermission|rewardRole|rewardReputation)\b/s);
  assert.match(backend, /function\s+createCode/);
  assert.match(backend, /rewardPermission\(/);
});
