import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const homepage = await fs.readFile(fileURLToPath(new URL("index.html", root)), "utf8");
const productionPages = [
  "index.html",
  "community/index.html",
  "forum/index.html",
  "forum/c/index.html",
  "forum/p/index.html",
  "forum/new/index.html",
  "tasks/index.html",
  "tasks/create/index.html",
  "tasks/detail/index.html",
  "tasks/my/index.html",
  "shop/index.html",
  "announcements/index.html",
  "admin/index.html",
  "admin/users/index.html",
  "admin/forum/index.html",
  "admin/redeem-codes/index.html",
  "admin/sensitive-words/index.html",
  "admin/account-transfer/index.html",
  "admin/tasks/index.html",
  "admin/tasks/edit/index.html",
];

test("every production page loads the v1 base and current v1.1 visual enhancement last", async () => {
  for (const relativePath of productionPages) {
    const source = await fs.readFile(fileURLToPath(new URL(relativePath, root)), "utf8");
    const releaseVersion = relativePath === "index.html" ? "v1.1" : "v1.0";
    const visualLink = `<link rel="stylesheet" href="/MKJ/assets/css/visual-v1.css?v=20260812-${releaseVersion}" />`;
    const enhancementLink = '<link rel="stylesheet" href="/MKJ/assets/css/visual-v1.1.css?v=20260812-v1.1" />';
    assert.match(source, new RegExp(visualLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${relativePath} is missing the v1 visual system`);
    assert.match(source, /<link rel="icon" href="data:,"\s*\/>/, `${relativePath} must suppress implicit favicon requests`);
    const stylesheetLinks = source.match(/<link rel="stylesheet"[^>]*\/>/g) ?? [];
    assert.ok(stylesheetLinks.includes(visualLink), `${relativePath} must keep the v1 base visual system`);
    assert.equal(stylesheetLinks.at(-1), enhancementLink, `${relativePath} must load v1.1 enhancement last`);
  }
});

test("the v1 visual system defines shared surfaces and reduced motion", async () => {
  const source = await fs.readFile(fileURLToPath(new URL("assets/css/visual-v1.css", root)), "utf8");
  for (const selector of [":root", ".mkj-header", ".community-page", ".forum-site-header", ".task-page", ".shop-page", ".announce-page", ".admin-header"]) {
    assert.ok(source.includes(selector), `visual system must cover ${selector}`);
  }
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /:focus-visible/);
}
);

test("the finish-review refinements preserve contrast, color semantics, and icon consistency", async () => {
  const source = await fs.readFile(fileURLToPath(new URL("assets/css/visual-v1.css", root)), "utf8");

  assert.match(source, /::placeholder\s*\{\s*color:\s*#65737d;/);
  assert.match(source, /\.task-button-primary\s*\{[^}]*background:\s*var\(--hx-blue\)/s);
  assert.match(source, /\.task-pagination-button\[aria-current="true"\][^{]*\{[^}]*background:\s*var\(--hx-blue\)/s);
  assert.match(source, /\.announce-nav a\[aria-current="page"\][^{]*\{[^}]*background:\s*var\(--hx-blue-soft\)/s);
  assert.match(source, /\.mkj-kicker,[\s\S]*\.admin-kicker\s*\{\s*display:\s*none;/);

  assert.match(homepage, /class="mkj-support-icon"[^>]*>\s*<svg\b/);
  assert.match(homepage, /class="mkj-modal-close"[^>]*>\s*<svg\b/);
  assert.doesNotMatch(homepage, /class="mkj-support-icon"[^>]*>[?☎◉✉×]/);
});
