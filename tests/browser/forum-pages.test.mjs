import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const pages = [
  ["forum/index.html", "index"],
  ["forum/c/index.html", "category"],
  ["forum/p/index.html", "post"],
  ["forum/new/index.html", "new"],
];

async function readPage(path) {
  try {
    return await fs.readFile(fileURLToPath(new URL(path, root)), "utf8");
  } catch {
    return null;
  }
}

test("forum routes provide page markers and shared forum assets", async () => {
  for (const [path, page] of pages) {
    const source = await readPage(path);
    assert.ok(source, `${path} exists`);
    assert.match(source, new RegExp(`data-forum-page=["']${page}["']`));
    assert.match(source, /assets\/css\/forum\.css/);
    assert.match(source, /assets\/js\/core\/runtime\.js/);
    assert.match(source, /assets\/js\/forum\/forum-events\.js/);
    assert.match(source, /data-forum-account-link/);
    assert.match(source, /href=["']\/MKJ\/#account["']/);
  }
});

test("forum styles are present as an isolated module", async () => {
  const source = await readPage("assets/css/forum.css");
  assert.ok(source, "assets/css/forum.css exists");
  assert.match(source, /\.forum-layout/);
});

test("forum landing mounts pinned announcements and realtime notifications", async () => {
  const source = await readPage("forum/index.html");
  const navigation = source.match(/<nav class="forum-site-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.match(source, /data-forum-announcement-slot/);
  assert.match(source, /data-forum-notification-slot/);
  assert.match(navigation, /data-forum-notification-slot/);
  assert.match(source, /shared\/community-widgets\.css/);
  assert.match(source, /shared\/community-widgets\.js/);
});
