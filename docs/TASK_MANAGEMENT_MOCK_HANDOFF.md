# Task Management Mock Handoff

## Scope

This delivery adds a front-end-only task-management prototype. It is deliberately isolated from the existing task lifecycle and does not modify database tables, `supabase/`, Edge Functions, `TaskApi`, forum controllers, account login, avatar upload, or theme controller code.

## Routes

| Route | Audience | Purpose |
| --- | --- | --- |
| `/MKJ/admin/tasks/mock/` | `ADMIN` / `MODERATOR` | Workbench metrics, task-group overview, review queue, filters, column selection, bulk review, CSV export, reminder widget |
| `/MKJ/admin/tasks/mock/review/` | `ADMIN` / `MODERATOR` | Submission review, inline attachment preview, review template, rating, additional reputation, confirmation, audit log |
| `/MKJ/tasks/mock/` | Public browsing; logged-in students can interact | Search/filter public mock tasks, view details, apply, favorite |
| `/MKJ/tasks/mock/create/` | Student account | Publish-small-task form, sensitive-text validation, draft recovery, preview, attachment metadata and submission progress |
| `/MKJ/tasks/mock/my/` | Student account | Published/accepted task tabs and mock submission entry point |

## Mock Data And Interfaces

- `assets/js/tasks/task-mock-data.js` owns all mock data in `localStorage` under `mkj.task-management-mock.v1`; drafts use `mkj.task-management-mock.draft.v1`.
- `assets/js/tasks/task-mock-ui.js` renders UI through DOM APIs only. It neither imports nor calls `TaskApi`, `queryTasks`, `invokeTaskFunction`, Supabase Edge Functions, or database clients.
- CSV export is browser-local through a Blob download. Attachment preview is a local mock panel; no file upload is sent anywhere.
- Mock submission, review, favorite, group order, and audit-log actions only write local state. They never award real reputation.

## Permission Model

- The admin routes resolve the existing `MKJApp` session and public role. Only `ADMIN` and `MODERATOR` remain on the page; other users are redirected to the mock task market.
- Student create/my pages redirect an `ADMIN` role to the mock task market. Anonymous users are redirected to the site home before a student-only form renders.
- The public mock market may be browsed while signed out; no write reaches a back end.
- This is a static UI guard, not a replacement for server authorization. Real task routes keep their existing Edge Function/RPC enforcement unchanged.

## Safety Controls

- User-entered title, description, review feedback, and submission text use the existing `guardFormData` path, which blocks executable XSS patterns and high-risk content.
- The mock create flow treats any sensitive-word warning as a submission blocker and gives immediate in-form feedback.
- All dynamic text uses `textContent` via the local `node()` helper. No `innerHTML`, `outerHTML`, or `insertAdjacentHTML` is used.
- No secrets, file bytes, role grants, reward-code logic, or user identity data are stored in the mock state.

## Styling And Accessibility

- `assets/css/task-mock.css` uses the existing task workspace CSS variables and automatically follows the current light/dark theme.
- The layout responds at 980px and 640px, preserves table scrolling on small screens, and disables non-essential transitions for reduced-motion users.
- Controls use native button/input/select/dialog elements with labels, visible focus states, and textual status feedback.

## Integration Plan

When a real service is approved, replace only `task-mock-data.js` calls with a narrow client adapter. Preserve the current mock UI contracts, validate all write fields server-side, and retain existing role/RLS checks. Do not migrate mock local state directly into production tables.

## Verification

- Run `node --test tasks/tests/*.mjs admin/tests/*.mjs tests/browser/*.test.mjs`.
- Run `node --check assets/js/tasks/task-mock-ui.js assets/js/tasks/task-mock-data.js` and `git diff --check`.
- Browser smoke: open `/MKJ/tasks/mock/`, filter a category, toggle a favorite, and confirm it remains after refresh. Verify admin and student route redirects using actual session roles.
