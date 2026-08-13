import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { PRODUCTION_PAGES } from "./production-pages.mjs";
import {
  THEMES,
  THEME_STORAGE_KEY,
  createThemeController,
} from "../../assets/js/theme/theme-controller.js";
import {
  isApprovedAvatarUrl,
  renderAvatar,
  uploadAvatar,
  validateAvatarFile,
} from "../../assets/js/profile/avatar.js";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };
}

function documentFixture() {
  return { documentElement: { dataset: {} } };
}

class FakeNode {
  constructor(tagName = "span") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.dataset = {};
    this.textContent = "";
    this.ownerDocument = { createElement: (tag) => new FakeNode(tag) };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren(...children) { this.children = children; this.textContent = children.length ? "" : this.textContent; }
}

test("theme controller defaults safely and persists an immediate document theme", () => {
  const emptyDocument = documentFixture();
  const empty = createThemeController({ storage: storage(), documentRef: emptyDocument });
  assert.equal(empty.getTheme(), "tech-light");
  assert.equal(emptyDocument.documentElement.dataset.theme, "tech-light");

  const invalidDocument = documentFixture();
  const invalid = createThemeController({ storage: storage({ [THEME_STORAGE_KEY]: "neon-purple" }), documentRef: invalidDocument });
  assert.equal(invalid.getTheme(), "tech-light");
  assert.equal(invalidDocument.documentElement.dataset.theme, "tech-light");

  const saved = storage();
  const currentDocument = documentFixture();
  const controller = createThemeController({ storage: saved, documentRef: currentDocument });
  const changes = [];
  const unsubscribe = controller.subscribeTheme((theme) => changes.push(theme));
  assert.equal(controller.setTheme("fresh-blue"), "fresh-blue");
  assert.equal(saved.getItem(THEME_STORAGE_KEY), "fresh-blue");
  assert.equal(currentDocument.documentElement.dataset.theme, "fresh-blue");
  assert.deepEqual(changes, ["fresh-blue"]);
  unsubscribe();
  controller.setTheme("tech-dark");
  assert.deepEqual(changes, ["fresh-blue"]);
});

test("theme inventory is exactly the three approved choices", () => {
  assert.deepEqual(Object.keys(THEMES), ["tech-light", "tech-dark", "fresh-blue"]);
});

test("avatar renderer accepts only approved public HTTPS URLs and keeps a text fallback", () => {
  const approved = "https://project.supabase.co/storage/v1/object/public/avatars/11111111-1111-4111-8111-111111111111/avatar.png?v=1";
  assert.equal(isApprovedAvatarUrl(approved), true);
  assert.equal(isApprovedAvatarUrl("http://project.supabase.co/storage/v1/object/public/avatars/user/avatar.png"), false);
  assert.equal(isApprovedAvatarUrl("https://attacker.example/avatar.png"), false);

  const imageTarget = new FakeNode();
  renderAvatar(imageTarget, { avatar: approved, display_name: "林同学" });
  assert.equal(imageTarget.children[0].tagName, "IMG");
  assert.equal(imageTarget.children[0].alt, "");
  assert.equal(imageTarget.children[0].src, approved);

  const fallbackTarget = new FakeNode();
  renderAvatar(fallbackTarget, { avatar: "javascript:alert(1)", displayName: "林同学" });
  assert.equal(fallbackTarget.children.length, 0);
  assert.equal(fallbackTarget.textContent, "林");
});

test("avatar preflight accepts JPG PNG WebP up to 2MB and upload exposes busy success error states", async () => {
  const file = {
    name: "avatar.webp",
    type: "image/webp",
    size: 3,
    async arrayBuffer() { return Uint8Array.of(1, 2, 3).buffer; },
  };
  assert.equal(validateAvatarFile(file), file);
  assert.throws(() => validateAvatarFile({ ...file, name: "avatar.gif", type: "image/gif" }), /JPG、PNG 或 WebP/);
  assert.throws(() => validateAvatarFile({ ...file, size: 2 * 1024 * 1024 + 1 }), /2MB/);

  const states = [];
  const result = await uploadAvatar({
    file,
    runtime: { invokeFunction: async (name, payload) => {
      assert.equal(name, "avatar-upload");
      assert.deepEqual(payload, { fileName: "avatar.webp", contentType: "image/webp", contentBase64: "AQID" });
      return { avatarUrl: "https://project.supabase.co/storage/v1/object/public/avatars/11111111-1111-4111-8111-111111111111/avatar.webp?v=1" };
    } },
    onState: (state) => states.push(state.status),
  });
  assert.equal(result.avatarUrl.endsWith("avatar.webp?v=1"), true);
  assert.deepEqual(states, ["busy", "success"]);

  const errors = [];
  await assert.rejects(() => uploadAvatar({
    file,
    runtime: { invokeFunction: async () => { throw new Error("审核未通过"); } },
    onState: (state) => errors.push(state.status),
  }), /审核未通过/);
  assert.deepEqual(errors, ["busy", "error"]);
});

test("all production pages bootstrap themes early and load visual v1.1 last", async () => {
  for (const relativePath of PRODUCTION_PAGES) {
    const source = await fs.readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
    const themeScript = '<script type="module" src="/MKJ/assets/js/theme/theme-controller.js?v=20260812-v1.1"></script>';
    const visualLink = '<link rel="stylesheet" href="/MKJ/assets/css/visual-v1.1.css?v=20260812-v1.1" />';
    assert.ok(source.indexOf(themeScript) >= 0 && source.indexOf(themeScript) < source.indexOf("</head>"), `${relativePath} theme bootstrap`);
    const styles = source.match(/<link rel="stylesheet"[^>]*\/>/g) ?? [];
    assert.equal(styles.at(-1), visualLink, `${relativePath} visual v1.1 last`);
  }
});

test("v1.1 CSS and settings shell keep themes while avatar upload is deferred", async () => {
  const css = await fs.readFile(new URL("../../assets/css/visual-v1.1.css", import.meta.url), "utf8");
  for (const theme of Object.keys(THEMES)) assert.match(css, new RegExp(`data-theme=["']${theme}["']`));
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /::backdrop\s*\{[^}]*rgba\([^)]*\.(?:3|4|5)/s);
  assert.doesNotMatch(css, /(?:transition|animation)(?:-duration)?\s*:[^;]*(?:3\d\d|[4-9]\d\d)ms/i);

  const shell = await fs.readFile(new URL("../../assets/js/core/app-shell.js", import.meta.url), "utf8");
  assert.match(shell, /mkj-settings-modal-v11/);
  assert.doesNotMatch(shell, /uploadAvatar|validateAvatarFile/);
  assert.doesNotMatch(shell, /type\s*=\s*["']file["']|mkj-settings-upload-v11/);
  assert.match(shell, /dataset\.mkjSettingsTrigger/);
  assert.match(shell, /focus\?\.\(\)/);
  assert.match(shell, /#mkj-account-button/);
});

test("dark theme replaces legacy light homepage surfaces instead of mixing palettes", async () => {
  const css = await fs.readFile(new URL("../../assets/css/visual-v1.1.css", import.meta.url), "utf8");
  assert.match(css, /\.mkj-process-section,\s*\.mkj-team-section\s*\{[^}]*background-color:\s*var\(--hx-surface\)/s);
  assert.match(css, /\.mkj-calibration-card,\s*\.mkj-question-stage,[^}]*\{[^}]*background-color:\s*var\(--hx-surface\)/s);
  assert.match(css, /\.mkj-score-core,\s*\.mkj-floating-note-top,\s*\.forum-masthead,[^}]*\{[^}]*background(?:-color)?:\s*var\(--hx-inverse\)/s);
  assert.match(css, /\.forum-masthead h1,[^}]*\{[^}]*color:\s*var\(--hx-inverse-text\)/s);
  assert.match(css, /\.community-footer,\s*\.forum-site-footer\s*\{[^}]*background-color:\s*var\(--hx-inverse\)/s);
  assert.match(css, /\.forum-site-header,\s*\.task-topbar,\s*\.task-site-header,[^}]*\{[^}]*background:\s*var\(--hx-header\)/s);
  assert.match(css, /\.forum-category-list:empty,\s*\.forum-post-stream:empty\s*\{[^}]*background-color:\s*color-mix\(in srgb, var\(--hx-surface\)/s);
});

test("the shared shell provides an accessible mobile navigation trigger for subpages", async () => {
  const shell = await fs.readFile(new URL("../../assets/js/core/app-shell.js", import.meta.url), "utf8");
  assert.match(shell, /dataset\.mkjMobileNavTrigger/);
  assert.match(shell, /aria-expanded/);
  assert.match(shell, /aria-controls/);
  assert.match(shell, /mkj-mobile-nav-open-v11/);

  const css = await fs.readFile(new URL("../../assets/css/visual-v1.1.css", import.meta.url), "utf8");
  assert.match(css, /\.mkj-mobile-nav-trigger-v11/);
  assert.match(css, /@media\s*\(max-width:\s*780px\)[\s\S]*\.mkj-mobile-nav-target-v11:not\(\.mkj-mobile-nav-open-v11\)\s*\{[^}]*display:\s*none/);
});

test("navigation forum posts comments and task applicants use the shared avatar renderer", async () => {
  const shell = await fs.readFile(new URL("../../assets/js/core/app-shell.js", import.meta.url), "utf8");
  assert.match(shell, /renderAvatar\(trigger\?\.querySelector/);

  for (const path of ["../../assets/js/forum/forum-render.js", "../../forum/forum-render.js"]) {
    const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /profile\/avatar\.js/, path);
    assert.match(source, /renderAvatar\(avatar,\s*author/, path);
    assert.match(source, /renderAuthor\(comment\.author/, path);
  }

  const taskAdmin = await fs.readFile(new URL("../../assets/js/tasks/task-admin.js", import.meta.url), "utf8");
  assert.match(taskAdmin, /profile\/avatar\.js/);
  assert.match(taskAdmin, /applicant_avatar/);
  assert.match(taskAdmin, /renderAvatar/);
});
