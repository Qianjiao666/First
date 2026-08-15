const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const schema = fs.readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8");

test("defines forum content tables with one vote target", () => {
  assert.match(schema, /create table if not exists public\.forum_categories/i);
  assert.match(schema, /create table if not exists public\.forum_posts/i);
  assert.match(schema, /create table if not exists public\.forum_comments/i);
  assert.match(schema, /create table if not exists public\.forum_votes/i);
  assert.match(schema, /check \(\(post_id is not null\)::integer \+ \(comment_id is not null\)::integer = 1\)/i);
});

test("keeps forum mutations service-only", () => {
  assert.match(schema, /create or replace function public\.create_forum_post/i);
  assert.match(schema, /create or replace function public\.set_forum_vote/i);
  assert.match(schema, /revoke all on function public\.set_forum_vote/i);
  assert.match(schema, /grant execute on function public\.set_forum_vote[\s\S]*to service_role/i);
});

test("seeds active forum categories and tags idempotently", () => {
  assert.match(schema, /insert into public\.forum_categories[\s\S]*?on conflict \(slug\) do nothing/i);
  assert.match(schema, /insert into public\.forum_tags[\s\S]*?on conflict \(slug\) do nothing/i);
});

test("exposes the own-comment deletion capability used by the forum API", () => {
  assert.match(schema, /forum:deleteOwnComment/);
});

test("guards public forum comment and tag reads behind published parent posts", () => {
  assert.match(
    schema,
    /create policy "forum_comments_public_read"[\s\S]*?using \([\s\S]*?status = 'PUBLISHED'[\s\S]*?from public\.forum_posts as posts[\s\S]*?posts\.id = forum_comments\.post_id[\s\S]*?posts\.status = 'PUBLISHED'[\s\S]*?\);/i,
  );
  assert.match(
    schema,
    /create policy "forum_post_tags_public_read"[\s\S]*?using \([\s\S]*?from public\.forum_posts as posts[\s\S]*?posts\.id = forum_post_tags\.post_id[\s\S]*?posts\.status = 'PUBLISHED'[\s\S]*?\);/i,
  );
});
