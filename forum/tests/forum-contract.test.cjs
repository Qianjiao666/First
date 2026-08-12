const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const schema = fs.readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8");
const postFunction = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/forum-post/index.ts"), "utf8");
const commentFunction = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/forum-comment/index.ts"), "utf8");

test("forum writes expose replacement warnings while enforcing the shared filter", () => {
  assert.match(postFunction, /content-guard\.ts/);
  assert.match(postFunction, /guardPublicText/);
  assert.match(postFunction, /warnings/);
  assert.match(commentFunction, /content-guard\.ts/);
  assert.match(commentFunction, /guardPublicText/);
  assert.match(commentFunction, /warnings/);
  assert.doesNotMatch(`${postFunction}\n${commentFunction}`, /replaceSensitive/);
});

test("forum listing schema supports indexed tag and filter reads", () => {
  assert.match(schema, /forum_post_tags_tag_idx/i);
  assert.match(schema, /forum_posts_category_listing_idx/i);
  assert.match(schema, /comment_count/i);
});
