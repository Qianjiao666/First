# Tasks Frontend Handoff

## Changes

- Added `/tasks/create/` for capability-gated task creation with category/subcategory selection, draft/publish intents, skill tags, and image/video attachment metadata.
- Added `task-attachments.js` with `task-attachments` bucket, path normalization, MIME/size validation (image/video, 50 MiB per file), and Storage upload metadata.
- Extended task API and task integration contracts for `activity`/`attachments` reads, completion `attach`, admin `arbitrate`, and explicit force-complete/refund/reputation-debit helpers.
- Added task detail timeline and attachment rendering; enhanced personal completion submission with attachment upload and attachment linking.
- Added capability checks for `task:*` with compatibility for existing `tasks:*` markers, including create/apply/submit/manage controls.
- Added dynamic administrator arbitration controls in the existing task admin controller.
- Added `task-attachments` Edge Function (`prepare`, `register`, `remove`/`delete`) and explicit
  registration after task creation uploads; object paths are `userId/taskId/object`.
- Added idempotent lifecycle migration `202608110001_tasks_lifecycle_v2.sql` plus the
  user-capability migration `202608110002_tasks_user_capabilities.sql`, synchronized with
  `supabase/modules/tasks.sql` and `supabase/schema.sql`.
- Added creator ownership checks for task update/publish RPCs and regular-user `task:*` /
  legacy `tasks:*` create, publish, taxonomy and attachment capabilities.

## Contracts

- Query scopes: `{ scope: "activity", taskId }` and `{ scope: "attachments", taskId }` return `{ items }`.
- Completion actions: `submit(applicationId, submissionNote, attachments?)`, `attach(applicationId, attachments)`.
- Task creation attachments: upload through Storage, then call
  `task-attachments/register` once per file with `{ taskId, attachmentKind: "task",
  objectPath, mimeType, sizeBytes }`.
- Admin action: `arbitrate(taskId, decision, reason)` with decisions `force_complete`, `cancel_refund`, and `deduct_reputation`.
- Storage: `uploadTaskAttachment({ userId, resourceId: taskId, file, objectId })` returns
  `{ path, name, mimeType, size, kind, bucket }`; allowed types are image/video and max 50 MiB.
- Activity query: `getTimeline(taskId)` / `getActivity(taskId)` return `{ items }` from
  `task_activity_log`; detail renders the chronological timeline and attachment list.

## Verification

- Full task test suite passes (`56` tests).
- Changed JavaScript files pass `node --check`.
- The complete task enhancement suite passes locally; no frontend failure is present.

## Backend and deployment contract

- Apply migrations in order with Supabase CLI or the project migration pipeline; do not edit
  the production database manually. The bucket is private and Storage policies enforce the
  `userId/taskId/object` path, MIME whitelist and 50 MiB limit. Deleting attachment metadata
  removes its Storage object through the cleanup trigger.
- Deploy `task-admin`, `task-complete` and `task-attachments` with the existing
  `supabase/functions/_shared` auth/http/permissions/sensitive-filter conventions. Only the
  Edge runtime receives `SUPABASE_SERVICE_ROLE_KEY`; it is never sent to the browser.
- Tencent Cloud static deployment is documented in `deployment/TENCENT_CLOUD_STATIC.md` and
  `deployment/tencent-cloud/tasks-release.conf`. Upload only the generated browser stage to
  `/var/www/MKJ` or the COS `/MKJ/` prefix; deploy migrations/functions separately and keep
  the primary site `/` unchanged.

## Verification and remaining gates

- `node --test tasks/tests/*.mjs`: **56 passed, 0 failed**.
- `node --check` passes for all changed task JS and `assets/js/core/task-integration.js`.
- `node --test tests/functions/*.mjs tests/schema/*.cjs`: **39 passed, 0 failed** in the
  current local suite.
- Real Supabase migration, Storage/RLS acceptance, Deno type checking, Edge deployment and
  Tencent Cloud upload remain release-window gates because credentials and network deployment
  were not available in this workspace.
