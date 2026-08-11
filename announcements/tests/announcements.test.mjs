import test from "node:test";
import assert from "node:assert/strict";
import {
  createAnnouncementsApi,
  hasAnnouncementCapability,
  renderMarkdownToHtml,
  normalizeAnnouncement,
} from "../announcements.js";

test("Markdown renderer keeps formatting while escaping HTML and unsafe URLs", () => {
  const html = renderMarkdownToHtml('# Hello\n\n**bold** [safe](https://example.com) [bad](javascript:alert(1))\n\n<script>alert(1)</script>');
  assert.match(html, /<h2[^>]*>Hello<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /&lt;script&gt;/);
});

test("announcement capability checks use announce namespace", () => {
  assert.equal(hasAnnouncementCapability(["announce:create", "announce:pin"], "create"), true);
  assert.equal(hasAnnouncementCapability(["forum:createPost"], "create"), false);
});

test("announcement API maps CRUD actions to the Edge Function", async () => {
  const calls = [];
  const api = createAnnouncementsApi({
    invokeFunction: async (name, body, method) => {
      calls.push({ name, body, method });
      return { items: [] };
    },
  });
  await api.list();
  await api.create({ title: "A", markdown: "Body" });
  await api.update("a-1", { title: "B", markdown: "Body 2" });
  await api.setPinned("a-1", true);
  await api.remove("a-1");
  assert.deepEqual(calls, [
    { name: "announcements", body: {}, method: "GET" },
    { name: "announcements", body: { action: "upsert", slug: "a", title: "A", bodyMarkdown: "Body", status: "published", isPinned: false }, method: "POST" },
    { name: "announcements", body: { action: "upsert", id: "a-1", slug: "b", title: "B", bodyMarkdown: "Body 2", status: "published", isPinned: false }, method: "POST" },
    { name: "announcements", body: { action: "upsert", id: "a-1", slug: "announcement-a-1", title: "公告", bodyMarkdown: "", status: "published", isPinned: true }, method: "POST" },
    { name: "announcements", body: { action: "delete", id: "a-1" }, method: "POST" },
  ]);
});

test("announcement management listing uses the authenticated POST contract", async () => {
  let request;
  const api = createAnnouncementsApi({
    getSession: async () => ({ access_token: "session" }),
    invokeFunction: async (name, body, method) => {
      request = { name, body, method };
      return { announcements: [] };
    },
  });
  await api.list({ management: true });
  assert.deepEqual(request, { name: "announcements", body: { action: "list" }, method: "POST" });
});

test("announcement normalization uses a safe, stable public shape", () => {
  assert.deepEqual(normalizeAnnouncement({ id: "a", slug: "title", title: "Title", markdown: "# Body", is_pinned: true, published_at: "2026-01-01", internal_note: "x" }), {
    id: "a",
    slug: "title",
    title: "Title",
    markdown: "# Body",
    status: "published",
    isPinned: true,
    publishedAt: "2026-01-01",
  });
});
