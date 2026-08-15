import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const moduleUrl = new URL("../../assets/js/forum/forum-events.js", import.meta.url);
const source = await fs.readFile(fileURLToPath(moduleUrl), "utf8");

test("forum event UI builds forms and tag controls without HTML string injection", () => {
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});

test("forum events clear the comment loading state when a post is unavailable", () => {
  assert.match(source, /if \(!post\) \{\s*comments\.replaceChildren\(\);/s);
});

test("forum comment votes submit a comment identifier instead of the post identifier", () => {
  assert.match(source, /const target = button\.dataset\.postId \? \{ postId \} : \{ commentId: button\.dataset\.commentId \};/);
});

test("locked forum posts replace the comment form with a locked notice", () => {
  assert.match(source, /if \(post\.is_locked\)[\s\S]*?renderLockedCommentNotice[\s\S]*?else[\s\S]*?appendCommentForm/);
});

test("forum post details expose edit and delete controls to the author", () => {
  assert.match(source, /getCurrentUser/);
  assert.match(source, /appendPostOwnerActions/);
  assert.match(source, /data-delete-post|dataset\.deletePost/);
});

test("forum editor updates an existing owned post when an id is present", () => {
  assert.match(source, /const editPostId = new URLSearchParams\(window\.location\.search\)\.get\("id"\)/);
  assert.match(source, /action: editPostId \? "update" : "create"/);
  assert.match(source, /postId: editPostId/);
});
