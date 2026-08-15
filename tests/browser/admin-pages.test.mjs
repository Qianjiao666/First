import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const pages = [
  ["admin/index.html", "dashboard"],
  ["admin/users/index.html", "users"],
  ["admin/forum/index.html", "forum"],
  ["admin/redeem-codes/index.html", "redeem"],
  ["admin/sensitive-words/index.html", "sensitive"],
  ["admin/account-transfer/index.html", "transfer"],
];

async function read(path) {
  try {
    return await fs.readFile(fileURLToPath(new URL(path, root)), "utf8");
  } catch {
    return null;
  }
}

test("global admin routes load the shared shell and module script", async () => {
  for (const [path, page] of pages) {
    const source = await read(path);
    assert.ok(source, `${path} exists`);
    assert.match(source, new RegExp(`data-admin-page=["']${page}["']`));
    assert.match(source, /assets\/css\/admin\.css/);
    assert.match(source, /assets\/js\/core\/runtime\.js/);
    assert.match(source, /assets\/js\/admin\/admin-events\.js/);
  }
});

test("admin browser modules keep management actions behind capabilities", async () => {
  const source = await read("assets/js/admin/admin-events.js");
  assert.ok(source, "admin event module exists");
  assert.match(source, /admin:access/);
  assert.match(source, /admin:manageUsers/);
  assert.match(source, /admin:manageRedeemCodes/);
  assert.match(source, /admin:manageSensitiveWords/);
  assert.match(source, /admin:transferAccount/);
});

test("user management offers paginated loading beyond the first page", async () => {
  const page = await read("admin/users/index.html");
  const source = await read("assets/js/admin/admin-events.js");
  assert.match(page, /data-admin-load-more/);
  assert.match(source, /data-admin-load-more/);
  assert.match(source, /hasMore/);
});

test("admin navigation consumes the shared task menu descriptor", async () => {
  const render = await read("assets/js/admin/admin-render.js");
  const descriptor = await read("assets/js/admin/admin-menu-descriptors.js");
  assert.ok(descriptor, "shared admin menu descriptor exists");
  assert.match(render, /admin-menu-descriptors\.js/);
  assert.match(render, /taskMenuDescriptor/);
});

test("forum management lists recent posts before moderation", async () => {
  const page = await read("admin/forum/index.html");
  const events = await read("assets/js/admin/admin-events.js");
  assert.match(page, /data-admin-forum-table/);
  assert.match(events, /forum_posts/);
  assert.match(events, /loadForumPosts/);
  assert.match(events, /moderateForum/);
});
