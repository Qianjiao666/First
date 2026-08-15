# 协作任务市场 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有任务模块上实现模板化发布、声望资格、多人协作、任务内协商会话、互评和发布者批改。

**Architecture:** 保留 `task_listings`、`task_applications`、`task_reviews`、附件和仲裁；新增模板、资格、会话、成员分工和互评实体。浏览器经 `MKJ_TASK_INTEGRATION` 调用 Edge Function，函数校验认证、资格、禁言和任务参与关系后调用只向 `service_role` 授权的 RPC。

**Tech Stack:** 静态 HTML/ES modules、Supabase Postgres/RLS、Supabase Edge Functions、Node `node:test`、Playwright。

## Global Constraints

- 下一公开版本为 `v1.3`，同步更新首页日志、`CHANGELOG.md` 和 `tests/browser/changelog.test.mjs`，新条目置于历史版本之前。
- 校园团购仅是多人协作，不实现价格、支付、托管、退款、钱包、提现或跨任务私信。
- 仅部署 `/var/www/MKJ`，不得修改主站 `/`、Nginx、Supabase Auth 或论坛。
- 浏览器没有 `service_role`、直接 RPC 写入或可绕过服务端资格验证的权限。
- 新文本走 `guardPublicText`、安全错误 envelope、禁言检查与敏感词策略；所有新表启用 RLS。
- 会话只向任务参与者开放，管理员例外读取需原因和审计；保留既有生命周期、附件、仲裁和幂等声望奖励。
- 验收覆盖 375/768/1280/1920，键盘操作、无横向溢出和零控制台错误。

## Task 1: Write Collaboration Contract Tests

**Files:**
- Create: `tasks/tests/collaboration-domain.test.mjs`
- Create: `tasks/tests/collaboration-api.test.mjs`
- Create: `tests/schema/collaborative-task-market.test.cjs`
- Modify: `tasks/tests/task-shared-contract-docs.test.mjs`

**Produces:** Contract names for templates, qualification, conversations, member assignment, peer review and their browser transports.

- [ ] **Step 1: Create the failing task-domain test.**

```js
test("campus collaboration has no money workflow", () => {
  const model = toCollaborativeTaskModel({ task_mode: "collaboration" });
  assert.equal(model.isCollaboration, true);
  assert.equal("payment" in model, false);
});
```

- [ ] **Step 2: Create the failing TaskApi envelope test.**

```js
await api.sendMessage("conversation-1", "请确认分工");
assert.deepEqual(requests.at(-1), {
  functionName: "task-collaboration",
  action: "sendMessage",
  body: { conversationId: "conversation-1", content: "请确认分工" },
});
```

- [ ] **Step 3: Create the failing schema security test.**

```js
assert.match(schema, /create table if not exists public\.task_conversation_messages/i);
assert.match(schema, /alter table public\.task_conversation_messages enable row level security/i);
assert.match(schema, /grant execute on function public\.send_task_conversation_message/i);
assert.doesNotMatch(schema, /task_(payments|wallets|refunds)/i);
```

- [ ] **Step 4: Run `node --test tasks/tests/collaboration-domain.test.mjs tasks/tests/collaboration-api.test.mjs tests/schema/collaborative-task-market.test.cjs`.** Confirm the failures name only missing interfaces.
- [ ] **Step 5: Commit with `git add tasks/tests/collaboration-*.test.mjs tests/schema/collaborative-task-market.test.cjs tasks/tests/task-shared-contract-docs.test.mjs` and `git commit -m "test: define collaborative task contracts"`.**

## Task 2: Add the Collaborative Task Schema

**Files:**
- Create: `supabase/migrations/20260815_collaborative_task_market.sql`
- Modify: `supabase/modules/tasks.sql`
- Modify: `supabase/schema.sql`
- Test: `tests/schema/collaborative-task-market.test.cjs`
- Test: `tasks/tests/task-sql.test.mjs`

**Produces:** `task_templates`, `task_publishing_rules`, `task_publishing_overrides`, `task_conversations`, `task_conversation_members`, `task_conversation_messages`, `task_member_assignments`, `task_peer_reviews`, and service-only RPCs.

- [ ] **Step 1: Define schema, constraints, indexes and RLS.**

```sql
create table if not exists public.task_conversations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_listings(id) on delete cascade,
  kind text not null check (kind in ('application_consultation', 'collaboration')),
  application_id uuid references public.task_applications(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'read_only')),
  unique nulls not distinct (task_id, kind, application_id)
);
alter table public.task_conversations enable row level security;
```

- [ ] **Step 2: Add `template_id`, immutable `template_snapshot`, and `task_mode` (`individual` or `collaboration`) to `task_listings`.** Ensure template version changes cannot alter published tasks.
- [ ] **Step 3: Implement `get_task_publishing_eligibility`, `save_task_template`, `save_task_publishing_rule`, `save_task_publishing_override`, `get_task_collaboration`, `send_task_conversation_message`, `assign_task_member`, and `submit_task_peer_review`.** Every RPC accepts `p_actor_id uuid`, uses `security definer set search_path = ''`, and is granted only to `service_role`.
- [ ] **Step 4: Add the application trigger and assignment transition.** On application, open the applicant/creator consultation; when accepted, join creator and accepted members to a shared collaboration conversation. Closed, cancelled and terminal arbitration sessions become read-only.
- [ ] **Step 5: Synchronize both canonical SQL files, run `node --test tests/schema/collaborative-task-market.test.cjs tasks/tests/task-sql.test.mjs`, then commit as `feat: add collaborative task market schema`.**

## Task 3: Implement Service Boundaries

**Files:**
- Modify: `supabase/functions/task-admin/index.ts`
- Modify: `supabase/functions/task-complete/index.ts`
- Create: `supabase/functions/task-collaboration/index.ts`
- Create: `supabase/functions/task-collaboration/deno.json`
- Modify: `tests/functions/task-admin.test.mjs`
- Modify: `tests/functions/task-complete.test.mjs`
- Create: `tests/functions/task-collaboration.test.mjs`

**Produces:** Admin actions `getPublishingEligibility`, `manageTemplates`, `managePublishingRules`, `managePublishingOverrides`; completion action `assignResponsibility`; collaboration actions `getCollaboration`, `getConsultation`, `sendMessage`, `assignMember`, `submitPeerReview`, `getAuditContext`.

- [ ] **Step 1: Write red tests for unqualified publishing, muted writes, participant isolation and read-only conversations.**

```js
await assert.rejects(() => invoke({ action: "sendMessage", payload: { conversationId: otherTaskConversation, content: "越权" } }), /访问被拒绝/);
await assert.rejects(() => invoke({ action: "sendMessage", payload: { conversationId: closedConversation, content: "继续发送" } }), /只读/);
```

- [ ] **Step 2: Extend `task-admin` action whitelist and filter template/governance payloads.** Reject payload keys `price`, `payment`, `wallet`, `refund`, and `payout`. `create` and `publish` pass a filtered `templateId`; server resolves eligibility, never the client.
- [ ] **Step 3: Create the collaboration action router.**

```ts
const message = guardPublicText(asString(payload.content, "content"), { required: true, maxLength: 2_000 });
const messageId = await callTaskRpc(client, "send_task_conversation_message", {
  p_actor_id: context.userId,
  p_conversation_id: asString(payload.conversationId, "conversationId"),
  p_content: message.text,
});
```

- [ ] **Step 4: Require `auth.assertNotMuted(context)` for writes.** `getAuditContext` additionally requires management permission and a non-empty reason, writes an audit event, and cannot send messages.
- [ ] **Step 5: Run `node --test tests/functions/task-admin.test.mjs tests/functions/task-complete.test.mjs tests/functions/task-collaboration.test.mjs`, then commit as `feat: add collaborative task services`.**

## Task 4: Connect the Browser API

**Files:**
- Modify: `assets/js/core/task-integration.js`
- Modify: `assets/js/tasks/task-api.js`
- Modify: `assets/js/tasks/task-runtime.js`
- Test: `tasks/tests/collaboration-api.test.mjs`
- Test: `tasks/tests/task-integration.test.mjs`

**Produces:** `TaskApi.getTemplates`, `getPublishingEligibility`, `saveTemplate`, `savePublishingRule`, `savePublishingOverride`, `getCollaboration`, `getConsultation`, `sendMessage`, `assignMember`, `submitPeerReview`, and `getAuditContext`.

- [ ] **Step 1: Add an explicit `task-collaboration` function allowlist.**

```js
"task-collaboration": new Set(["getCollaboration", "getConsultation", "sendMessage", "assignMember", "submitPeerReview", "getAuditContext"]),
```

- [ ] **Step 2: Implement narrow TaskApi wrappers.**

```js
sendMessage: (conversationId, content) => invokeCollaboration("sendMessage", { conversationId, content }),
assignMember: (applicationId, responsibility) => invokeCollaboration("assignMember", { applicationId, responsibility }),
submitPeerReview: (applicationId, ratings, content) => invokeCollaboration("submitPeerReview", { applicationId, ratings, content }),
```

- [ ] **Step 3: Add RLS-backed scopes `templates`, `publishingEligibility`, `collaboration`, `consultation`, and `myCollaborations`.** Unknown action and scope must continue rejecting before network dispatch; unavailable runtime stays safe.
- [ ] **Step 4: Run `node --test tasks/tests/collaboration-api.test.mjs tasks/tests/task-api.test.mjs tasks/tests/task-integration.test.mjs`.**
- [ ] **Step 5: Commit as `feat: connect task collaboration client`.**

## Task 5: Build the Market-First Hall and Template Publishing

**Files:**
- Modify: `tasks/index.html`
- Modify: `assets/js/tasks/task-list.js`
- Modify: `assets/js/tasks/task-view.js`
- Modify: `tasks/create/index.html`
- Modify: `assets/js/tasks/task-create.js`
- Create: `assets/css/visual-v1.3.css`
- Create: `tasks/tests/collaboration-market-view.test.mjs`
- Create: `tasks/tests/collaboration-template-ui.test.mjs`

**Produces:** `toCollaborativeTaskModel(rawTask)` with `taskType`, `isCollaboration`, `capacityLabel`, and `reviewLabel`; the creation payload `{ templateId, taskMode, title, summary, body, categoryId, subcategoryId, careerDirection, difficulty, applicationLimit, deadlineAt, skillTags, templateFields }`.

- [ ] **Step 1: Write failing market and creation DOM tests.**

```js
assert.equal(toCollaborativeTaskModel(raw).capacityLabel, "2 / 3 人已接取");
assert.match(marketHtml, /data-task-filter-mode/);
assert.match(marketHtml, /data-task-publishing-eligibility/);
assert.match(createHtml, /data-task-template-select/);
```

- [ ] **Step 2: Add category rail, mode/direction/difficulty/review filters, eligibility status, result count, listing template and accessible create command to `tasks/index.html`.** Keep search, category, sort and pagination behavior.
- [ ] **Step 3: Render task type, capacity and creator-review marker only with `textContent`.** Add no financial display property or control.
- [ ] **Step 4: Render server-resolved eligibility and template fields on `/tasks/create/`.** Disable publish with the returned threshold/restriction when no type is eligible. Serialize template fields and mode, never money-related fields.
- [ ] **Step 5: Load `visual-v1.3.css` after existing visual CSS, run `node --test tasks/tests/collaboration-market-view.test.mjs tasks/tests/collaboration-template-ui.test.mjs tasks/tests/task-browser-smoke.cjs`, then commit as `feat: add collaborative task market`.**

## Task 6: Build Governance and Collaboration Workspaces

**Files:**
- Modify: `admin/tasks/index.html`
- Modify: `assets/js/tasks/task-admin.js`
- Modify: `tasks/detail/index.html`
- Modify: `assets/js/tasks/task-detail.js`
- Modify: `tasks/my/index.html`
- Modify: `assets/js/tasks/task-my.js`
- Create: `admin/tests/collaboration-governance.test.mjs`
- Create: `tasks/tests/collaboration-workspace.test.mjs`

**Produces:** Admin template/rule/override forms; task detail anchors `data-task-consultation`, `data-task-collaboration`, `data-task-member-list`, `data-task-message-form`, `data-task-peer-review-form`, `data-task-creator-review-checklist`; My Tasks grouping for published, applied, collaborating and awaiting review.

- [ ] **Step 1: Write failing governance and participant-aware UI tests.**

```js
assert.match(adminHtml, /data-task-template-form/);
assert.match(adminHtml, /data-task-publishing-rule-form/);
assert.equal(renderCollaboration({ viewerRole: "visitor" }).querySelector("[data-task-message-form]"), null);
assert.match(renderCollaboration({ viewerRole: "accepted_member" }).textContent, /正式协作/);
```

- [ ] **Step 2: Add controlled admin forms calling `saveTemplate`, `savePublishingRule`, and `savePublishingOverride`.** Separate grant, type-limited grant, freeze and revoke with confirmation; no administrator impersonation message control.
- [ ] **Step 3: Add consultation and shared-workspace regions.** Consultation is visible only to its applicant and creator; collaboration only to accepted members and creator. Read-only status omits message controls and gives the reason.
- [ ] **Step 4: Add assignment, message, peer-review and final-review handlers.**

```js
await services.api.sendMessage(conversationId, guardFormData(form, ["content"], formMessage).values.content.trim());
await services.api.assignMember(applicationId, responsibility);
await services.api.submitPeerReview(applicationId, { communication, contribution, punctuality }, content);
```

Render every dynamic text value with `textContent`; retain existing submit, complete and arbitration behavior.
- [ ] **Step 5: Extend My Tasks without hiding active/completed history; run `node --test admin/tests/collaboration-governance.test.mjs tasks/tests/collaboration-workspace.test.mjs tasks/tests/task-enhancements.test.mjs`, then commit as `feat: add task collaboration workspaces`.**

## Task 7: Release Gates and v1.3 Changelog

**Files:**
- Create: `tests/browser/collaborative-task-market.test.mjs`
- Create: `tests/browser/collaborative-task-security.test.mjs`
- Modify: `tests/browser/visual-system.test.mjs`
- Modify: `CHANGELOG.md`
- Modify: `index.html`
- Modify: `tests/browser/changelog.test.mjs`
- Modify: `docs/COMMUNITY_RELEASE_RUNBOOK.md`
- Modify: `HANDOFF.md`
- Modify: `TASK_PROGRESS.md`
- Create: `docs/v1.3-delivery-report.md`
- Modify: `deployment/build-community-release.ps1`
- Create: `deployment/mkj-v1.3-cutover.sh`

**Produces:** v1.3 changelog, no-payment/XSS/participant-isolation browser gates, four-width visual evidence, manifest package and atomic cutover procedure.

- [ ] **Step 1: Write security tests for forbidden flows and unsafe rendering.**

```js
assert.doesNotMatch(taskSources, /innerHTML\s*=\s*.*(message|review|responsibility)/);
assert.doesNotMatch(taskSources, /(payment|wallet|refund|payout)/i);
assert.match(collaborationFunction, /auth\.assertNotMuted\(context\)/);
```

- [ ] **Step 2: Add the required `/MKJ/tasks/`, `/tasks/create/`, `/tasks/detail/`, `/tasks/my/`, `/admin/tasks/` four-width checks.** Assert main content, no overflow, no broken assets and no console errors.
- [ ] **Step 3: Make the changelog test fail until v1.3 is first.**

```js
assert.deepEqual(versions, ["v1.3", "v1.2", "v1.1", "v1.0", "v0.9", "v0.8", "v0.7", "v0.6", "v0.5", "v0.4", "v0.3", "v0.2", "v0.1"]);
assert.equal(homeVersions[0], "v1.3");
assert.match(index, /当前 v1\.3/);
```

- [ ] **Step 4: Add v1.3 notes before v1.2 in both logs.** Mention templates, reputation plus administrator exceptions, participant-only consultation/collaboration, assignments, peer reviews, final creator review, and explicitly no payment flow.
- [ ] **Step 5: Update asset versions, builder and cutover script.** Verify ZIP checksum, manifest, `Revision: v1.3`, atomic `/var/www/MKJ` switch and timestamped `.previous` preservation. Run targeted tests, changed-file `node --check`, manifest/hash verification and capture `output/playwright/v1.3/` screenshots.
- [ ] **Step 6: After production acceptance, record non-sensitive hashes, test counts and rollback path in handoff/progress/delivery report, commit as `chore: release collaborative task market v1.3`, and push the current branch.**

## Plan Self-Review

- **Spec coverage:** Tasks 1-3 deliver templates, qualification, private conversations, assignments, peer reviews, RLS, audit and lifecycle. Tasks 4-6 deliver transport, task hall, publishing, detail, My Tasks and administration. Task 7 covers the required changelog, browser matrix, packaging and release evidence.
- **Scope control:** Payments, refunds and arbitrary private messages are excluded in tests, schema, service payload validation and UI. Existing task lifecycle, attachments, arbitration and rewards remain intact.
- **Interface consistency:** Browser methods from Tasks 4-6 map to Task 3 Edge actions; those actions map to Task 2 service-only RPCs. Transport registration precedes every UI call.
- **Completeness:** Every task has files, an output contract, a failing-test step, a verification command and a commit boundary.
