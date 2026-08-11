import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const moduleUrl = new URL("../../assets/js/forum/forum-render.js", import.meta.url);
const source = await fs.readFile(fileURLToPath(moduleUrl), "utf8");

test("forum comments expose both upvote and downvote controls", () => {
  const commentRenderer = source.match(/export function renderComment\(comment[^)]*\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(commentRenderer, /forum-vote-down/);
  assert.match(commentRenderer, /dataset\.vote = "-1"/);
});

test("forum comments expose deletion only when the viewer owns the comment", () => {
  const commentRenderer = source.match(/export function renderComment\(comment[^)]*\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(commentRenderer, /if \(canDelete\)/);
  assert.match(commentRenderer, /dataset\.deleteComment/);
});
