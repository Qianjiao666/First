# Announcements Module Handoff

## Changes

- Added `/announcements/index.html`, `/announcements/announcements.css`, and `/announcements/announcements.js`.
- Added public announcement listing, capability-gated Markdown CRUD, pin/unpin, delete, edit-in-place, and a `mountAnnouncementBanner` helper for forum/task top regions.
- Markdown is rendered with an allowlist (headings, paragraphs, lists, emphasis, code, and HTTPS links). Raw HTML is escaped and unsafe URL schemes are rendered as plain text.
- All module DOM classes use the `announce-` prefix. Write controls are hidden using `announce:*` capabilities; the backend remains authoritative.

## Edge Function Contract

The frontend invokes `announcements` as follows:

- `GET /functions/v1/announcements` -> `{ announcements: Announcement[] }` for published public content.
- `POST { action: "list" }` -> `{ announcements: Announcement[] }` for the authenticated management view.
- `POST { action: "upsert", id?, slug, title, bodyMarkdown, status, isPinned }` -> upsert result. Requires `announce:create` or `announce:update`.
- `POST { action: "delete", id }` -> deleted result. Requires `announce:delete`.

Public fields consumed by the UI are `id`, `slug`, `title`, `body_markdown`, `status`, `is_pinned`, and `published_at`. The UI maps `body_markdown` to its internal `markdown` field.

## Mount Contract

`mountAnnouncementBanner({ root, runtime })` accepts a DOM element or selector, loads the first pinned announcement, and replaces the mount contents with a sanitized `.announce-banner`. Forum and task modules can add a `<div>` slot and call this helper; their existing files are intentionally untouched here.

## Tests

Run `node --test announcements/tests/announcements.test.mjs`. It covers safe Markdown output, capability namespace checks, CRUD action payloads, and public-shape normalization. Static routes were checked through `preview-server.js` on port 4192.

## Integration Assumptions / TODO

- The backend module must provide the `announcements` function, `announce:*` capabilities, and server-side Markdown/content validation.
- Pin semantics should enforce at most one active pinned announcement per tenant/site.
- A real Supabase session and cross-module banner mount remain deployment/integration checks.
