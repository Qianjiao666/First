import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const moduleUrl = new URL("../../assets/js/forum/forum-api.js", import.meta.url);
const source = await fs.readFile(fileURLToPath(moduleUrl), "utf8");
const forumApi = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test("forum route helpers preserve static paths and encoded identifiers", () => {
  assert.equal(forumApi.categoryUrl("interview-tips"), "/MKJ/forum/c/?slug=interview-tips");
  assert.equal(forumApi.postUrl("post id"), "/MKJ/forum/p/?id=post%20id");
  assert.deepEqual(
    forumApi.readRouteState("https://dsxnb.com/MKJ/forum/c/?slug=interview-tips&sort=hot"),
    { slug: "interview-tips", postId: null, sort: "hot" },
  );
});

test("forum vote input only accepts an upvote, downvote, or removal", () => {
  assert.equal(forumApi.normalizeVote(1), 1);
  assert.equal(forumApi.normalizeVote(-1), -1);
  assert.equal(forumApi.normalizeVote(null), null);
  assert.throws(() => forumApi.normalizeVote(2));
});

test("category post queries retain the category metadata for the page header", async () => {
  const category = {
    id: "category-1",
    slug: "interview-tips",
    name: "面试技巧",
    description: "把一次次面试复盘留下来。",
  };

  const postQuery = {
    eq() {
      return this;
    },
    order() {
      return this;
    },
    range() {
      return Promise.resolve({ data: [], error: null });
    },
  };

  globalThis.window = {
    MKJApp: {
      client: {
        from(table) {
          if (table === "forum_categories") {
            return {
              select() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle() {
                return Promise.resolve({ data: category, error: null });
              },
            };
          }
          if (table === "forum_posts") {
            return {
              select() {
                return postQuery;
              },
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      },
    },
  };

  const result = await forumApi.fetchPosts({ slug: category.slug });

  assert.deepEqual(result.category, category);
});
