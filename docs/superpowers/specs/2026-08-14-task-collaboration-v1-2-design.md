# Task Collaboration v1.2 Design

## Goal

Make the task plaza feel like a complete collaboration workflow: users can find suitable tasks, understand what stage a task is in, submit or supplement delivery materials, and know who needs to act next. The change builds on the current v1.1 task system and does not alter the avatar-upload deferral, the deployed v1.1 hotfix, or the existing forum/task module boundaries.

## Non-Goals

- Do not add forum-to-task conversion in this version.
- Do not replace the existing task lifecycle or Supabase RPC contracts wholesale.
- Do not enable avatar upload or Tencent IMS browser upload flows.
- Do not change the public `/` site or the `/MKJ/` static deployment layout.
- Do not require a new database table unless existing task activity, attachment, and application data cannot represent the required UI.

## User Experience

### Task Discovery

The task plaza keeps the existing search, direction filter, and sort controls, then adds focused collaboration filters:

- status: open, closing soon, in progress, completed;
- reward range: any, low, medium, high;
- deadline window: any, this week, this month, no deadline;
- skill tag chips derived from the existing task skill tags.

Filters update the current published-task query payload. The empty state explains which filters are active and offers a single reset action. The side metrics continue to show open, deadline, and completed counts, but their labels match the filtered context when filters are active.

### Task Detail

The detail page promotes the existing timeline into a "Collaboration Activity" section. Each event shows:

- stage label;
- actor display name or safe fallback;
- timestamp;
- concise note;
- related attachment count when present.

The detail page also shows a compact "Next Step" panel. For visitors it asks them to log in. For applicants it highlights apply, submit delivery, supplement delivery, or wait for review. For administrators it highlights pending applications, submitted deliveries, and arbitration actions.

### My Tasks

The personal task page separates work into three practical views:

- `Needs my action`: accepted tasks awaiting delivery, submitted tasks with requested supplement, published tasks with pending applications, and admin review items when the viewer has permission.
- `In progress`: accepted applications, submitted deliveries, and published tasks with active assignees.
- `History`: completed, rejected, cancelled, archived, or closed items.

Existing tabs may remain, but the first visible grouping should answer "what do I need to do now?" Each task card shows the next action and the last activity summary.

### Delivery And Supplement

The existing delivery form remains the primary submission path. After submission, the applicant may add one or more supplement notes and attachments while the application is still waiting for review. Supplements use the existing completion `attach` action and task attachment flow. Supplementing does not reopen completed, rejected, cancelled, or refunded work.

The administrator review dialog shows the submission note, supplement notes, and linked attachments before completion. Review actions continue to call the existing task completion/admin APIs.

### Arbitration

Replace browser prompt-based arbitration reason entry with a small modal. The modal requires:

- decision type already implied by the clicked action;
- reason category: timeout, missing delivery, inappropriate content, duplicate task, other;
- reason details, 20 to 800 characters.

The modal submits to the existing admin arbitration helpers. It does not expose service-only fields, user IDs, or reputation amounts beyond the current UI contract.

## Architecture

### Frontend Modules

- `assets/js/tasks/task-list.js`: extend filter state and query payload generation.
- `assets/js/tasks/task-detail.js`: render next-step and collaboration activity summaries from existing detail, application, activity, and attachment data.
- `assets/js/tasks/task-my.js`: group personal task items by next action and expose supplement submission when allowed.
- `assets/js/tasks/task-admin.js`: replace prompt arbitration with a modal controller that validates reason category and details.
- `assets/js/tasks/task-view.js`: add pure formatting helpers for collaboration stages, next actions, and activity summaries.
- `tasks/*.html`: add stable DOM slots for filters, next-step panels, supplement forms, and arbitration modal content.

Keep browser code as consumers of the existing API wrappers. Do not call Supabase directly from new UI logic.

### API And Data Flow

Use existing task APIs where possible:

- list filters flow through `listPublished(filters)`;
- activity uses `getTimeline(taskId)` / `getActivity(taskId)`;
- attachments use `getAttachments(taskId)` and the existing upload/register path;
- delivery uses `submit(applicationId, submissionNote, attachments)`;
- supplement uses `attach(applicationId, attachments)` plus a guarded note when the backend supports notes;
- admin review uses `complete(applicationId, review, completionNote, attachments)`;
- arbitration uses existing `forceComplete`, `cancelRefund`, and `deductReputation` helpers.

If the current backend cannot store supplement notes without overloading attachment captions, add the smallest RPC/migration extension to record supplement notes in the existing task activity log. Do not introduce a separate comments table for this version.

### Permissions

The browser only decides which controls to show. Edge Functions and service-only RPCs remain authoritative for:

- applying;
- submitting delivery;
- supplementing;
- completing;
- refunding;
- reputation deduction;
- arbitration.

Unauthorized and expired sessions should continue to flow through the shared session coordinator and login prompt.

## Error Handling

- Filter requests show a scoped task message and preserve the user's selected filters.
- Delivery and supplement upload failures identify the failed file by safe filename and do not submit partial metadata unless the upload registration succeeds.
- Sensitive-word warnings remain visible beside the form that generated them.
- Arbitration modal validation errors stay inside the modal.
- Domain conflicts, such as attempting to supplement an already completed task, return stable user-facing messages without database details.

## Testing

Add or update automated tests for:

- filter payload generation for status, reward, deadline, and skill tags;
- empty-state copy and reset behavior with active filters;
- next-step derivation for visitor, applicant, creator, and administrator views;
- activity rendering with actor fallback, timestamps, notes, and attachment counts;
- supplement delivery guard and API call shape;
- rejected supplement states after completion/cancel/reject;
- arbitration modal validation and existing admin helper calls;
- mobile task card/table layout contracts;
- XSS/DFA guard coverage for supplement and arbitration reason text.

Run the existing source test set plus the production visual matrix before declaring the enhancement complete.

## Acceptance Criteria

- A user can filter public tasks by status, reward range, deadline window, and skill tags without losing the existing search, direction, sort, reset, and pagination behavior.
- A task detail page clearly shows the current collaboration stage, recent activity, attachments, and the next likely action.
- A user with an accepted application can submit delivery and, while review is pending, add supplements without creating duplicate completions.
- Administrators can review submitted delivery with its attachments and can arbitrate through a validated modal instead of a browser prompt.
- Expired or unauthorized sessions open the login flow or show a denied state; no new UI path trusts browser-supplied actor fields.
- All new free-text fields pass the existing XSS and DFA guards before writes.
- Production browser matrix remains free of runtime errors, network errors, and horizontal overflow at 375, 768, 1280, and 1920 pixels.
