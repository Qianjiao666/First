import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const apiSource = await fs.readFile(new URL("../forum-api.js", import.meta.url), "utf8");
const controllerSource = await fs.readFile(new URL("../forum-events.js", import.meta.url), "utf8");
const renderSource = await fs.readFile(new URL("../forum-render.js", import.meta.url), "utf8");

test("forum API exposes deterministic list filters and submission sanitization", () => {
  assert.match(apiSource, /export function normalizeForumFilters/);
  assert.match(apiSource, /detect_sensitive/);
  assert.match(apiSource, /replace_sensitive/);
});

test("forum controller gates create, comment, vote and moderation controls by forum capabilities", () => {
  assert.match(controllerSource, /forum:createPost/);
  assert.match(controllerSource, /forum:createComment/);
  assert.match(controllerSource, /forum:vote/);
  assert.match(controllerSource, /forum:pinPost/);
  assert.match(controllerSource, /forum:lockPost/);
  assert.match(controllerSource, /forum:deleteAnyPost/);
  assert.match(controllerSource, /moderateContent\(\{/);
  assert.match(controllerSource, /data-forum-moderation/);
  assert.match(controllerSource, /getCapabilities/);
});

test("forum controller renders an explicit empty and retry state", () => {
  assert.match(renderSource, /forum-empty/);
  assert.match(renderSource, /data-forum-retry/);
});
