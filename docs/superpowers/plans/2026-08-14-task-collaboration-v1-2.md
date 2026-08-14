# Task Collaboration v1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved task collaboration v1.2 workflow: richer task discovery, clearer collaboration stage/next-action UI, supplement delivery, and validated admin arbitration.

**Architecture:** Extend the existing task frontend modules and API wrappers instead of replacing the lifecycle. Put all reusable stage, filter, next-action, and activity formatting in `assets/js/tasks/task-view.js`; page controllers consume those pure helpers and existing task API methods. Browser code only shows controls and builds safe payloads; Edge Functions and service-only RPCs remain the authority for writes.

**Tech Stack:** Static HTML, browser ES modules, Node `node:test`, Supabase Edge Functions/RPCs through existing wrappers, existing XSS/DFA `guardFormData`.

## Global Constraints

- Do not add forum-to-task conversion in this version.
- Do not replace the existing task lifecycle or Supabase RPC contracts wholesale.
- Do not enable avatar upload or Tencent IMS browser upload flows.
- Do not change the public `/` site or the `/MKJ/` static deployment layout.
- Do not require a new database table unless existing task activity, attachment, and application data cannot represent the required UI.
- All browser writes must continue through existing API wrappers and Edge Functions.
- All new free-text fields must pass existing XSS and DFA guards before writes.
- Production browser matrix must remain clean at 375, 768, 1280, and 1920 pixels.

---

## File Structure

- `assets/js/tasks/task-view.js`: own pure view/domain helpers for collaboration filters, stage labels, activity summaries, next-action derivation, and supplement eligibility.
- `tasks/tests/task-view.test.mjs`: unit coverage for the pure helpers.
- `tasks/index.html`: add stable controls for collaboration filters and skill chips.
- `assets/js/tasks/task-list.js`: read new filters, produce the query payload, render active empty-state text, reset all filters, and populate skill chips from loaded tasks.
- `tasks/tests/task-controller-contract.test.mjs`: assert list controller sends the new filter keys without breaking existing query/category/sort/page behavior.
- `tasks/detail/index.html`: add DOM slots for next-step and collaboration activity.
- `assets/js/tasks/task-detail.js`: render next-step and activity summaries using existing detail/activity/attachment data.
- `tasks/tests/task-view.test.mjs` and `tests/browser/task-detail-feedback.test.mjs`: cover next-action helpers and detail DOM contracts.
- `tasks/my/index.html`: add action grouping slots and supplement dialog/form.
- `assets/js/tasks/task-my.js`: group items by next action and submit supplements through `attach`.
- `tasks/tests/task-controller-contract.test.mjs`: cover supplement API call shape.
- `admin/tasks/index.html` or the existing admin task page that owns `task-admin.js`: add arbitration dialog markup.
- `assets/js/tasks/task-admin.js`: replace `window.prompt` arbitration with validated modal state.
- `admin/tests/admin-module.test.mjs` or `tasks/tests/task-controller-contract.test.mjs`: cover arbitration modal validation and helper calls.

---

### Task 1: Pure Collaboration Helpers

**Files:**
- Modify: `assets/js/tasks/task-view.js`
- Modify: `tasks/tests/task-view.test.mjs`

**Interfaces:**
- Consumes: raw task/application/activity objects already returned by existing task APIs.
- Produces:
  - `buildTaskListFilters(formState): { query, category, sort, page, status, rewardRange, deadlineWindow, skillTags }`
  - `taskCollaborationStage(record): string`
  - `taskNextAction(record, actor, capabilities = []): { key, label, tone, disabledReason }`
  - `canSupplementApplication(application): boolean`
  - `toActivitySummary(event, attachments = []): { id, label, actor, at, note, attachmentCount }`

- [ ] **Step 1: Add failing tests for filter normalization**

Append this test to `tasks/tests/task-view.test.mjs`:

```js
import {
  buildTaskListFilters,
  canSupplementApplication,
  taskCollaborationStage,
  taskNextAction,
  toActivitySummary,
} from "../../assets/js/tasks/task-view.js";

test("buildTaskListFilters keeps existing filters and adds collaboration filters", () => {
  assert.deepEqual(buildTaskListFilters({
    query: "  简历  ",
    category: "cat-1",
    sort: "reward_points.desc",
    page: 3,
    status: "closing_soon",
    rewardRange: "high",
    deadlineWindow: "this_week",
    skillTags: [" 沟通 ", "", "Excel"],
  }), {
    query: "简历",
    category: "cat-1",
    sort: "reward_points.desc",
    page: 3,
    status: "closing_soon",
    rewardRange: "high",
    deadlineWindow: "this_week",
    skillTags: ["沟通", "Excel"],
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```powershell
node --test tasks/tests/task-view.test.mjs
```

Expected: fail because `buildTaskListFilters` is not exported.

- [ ] **Step 3: Add minimal filter helper implementation**

In `assets/js/tasks/task-view.js`, add:

```js
const FILTER_STATUS = new Set(["", "open", "closing_soon", "in_progress", "completed"]);
const FILTER_REWARD = new Set(["", "low", "medium", "high"]);
const FILTER_DEADLINE = new Set(["", "this_week", "this_month", "none"]);

export function buildTaskListFilters(formState = {}) {
  const status = FILTER_STATUS.has(String(formState.status ?? "")) ? String(formState.status ?? "") : "";
  const rewardRange = FILTER_REWARD.has(String(formState.rewardRange ?? "")) ? String(formState.rewardRange ?? "") : "";
  const deadlineWindow = FILTER_DEADLINE.has(String(formState.deadlineWindow ?? "")) ? String(formState.deadlineWindow ?? "") : "";
  return {
    query: String(formState.query ?? "").trim(),
    category: String(formState.category ?? ""),
    sort: String(formState.sort ?? "published_at.desc"),
    page: Number.isFinite(Number(formState.page)) ? Number(formState.page) : 1,
    status,
    rewardRange,
    deadlineWindow,
    skillTags: Array.isArray(formState.skillTags)
      ? formState.skillTags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
  };
}
```

- [ ] **Step 4: Add failing tests for stage, next action, supplement, and activity**

Append:

```js
test("task collaboration helpers derive readable stages and next actions", () => {
  assert.equal(taskCollaborationStage({ status: "published", application_status: "accepted" }), "进行中");
  assert.equal(taskCollaborationStage({ status: "published" }), "可申请");
  assert.equal(taskCollaborationStage({ status: "closed" }), "已关闭");

  assert.deepEqual(taskNextAction({ status: "published" }, "visitor"), {
    key: "login",
    label: "登录后申请",
    tone: "secondary",
    disabledReason: "",
  });
  assert.equal(taskNextAction({ status: "accepted" }, "applicant", ["task:submit"]).key, "submit");
  assert.equal(taskNextAction({ status: "submitted" }, "applicant", ["task:submit"]).key, "supplement");
  assert.equal(taskNextAction({ status: "submitted" }, "admin", ["task:manage"]).key, "review");
});

test("supplement and activity helpers use safe fallbacks", () => {
  assert.equal(canSupplementApplication({ status: "submitted" }), true);
  assert.equal(canSupplementApplication({ status: "completed" }), false);
  assert.deepEqual(toActivitySummary({
    id: "evt-1",
    type: "submitted",
    actor: "",
    at: "2026-08-14T00:00:00Z",
    note: "  初次交付  ",
  }, [{ id: "a1" }, { id: "a2" }]), {
    id: "evt-1",
    label: "提交完成说明",
    actor: "系统记录",
    at: "2026-08-14T00:00:00Z",
    note: "初次交付",
    attachmentCount: 2,
  });
});
```

- [ ] **Step 5: Run the helper test and verify it fails**

Run:

```powershell
node --test tasks/tests/task-view.test.mjs
```

Expected: fail because the new helper exports are missing.

- [ ] **Step 6: Implement the remaining pure helpers**

Add below the existing timeline helpers:

```js
function hasCapability(capabilities, marker) {
  return Array.isArray(capabilities) && capabilities.some((capability) => {
    const value = String(capability);
    return value === marker || value === marker.replace(/^task:/, "tasks:");
  });
}

export function taskCollaborationStage(record = {}) {
  const status = String(record.application_status ?? record.status ?? "");
  if (status === "published") return "可申请";
  if (status === "accepted") return "进行中";
  if (status === "submitted") return "待核验";
  if (status === "completed") return "已完成";
  if (status === "closed") return "已关闭";
  if (status === "cancelled") return "已取消";
  if (status === "rejected") return "未通过";
  if (status === "draft") return "草稿";
  return statusLabel(status);
}

export function canSupplementApplication(application = {}) {
  return String(application.status ?? "") === "submitted";
}

export function taskNextAction(record = {}, actor = "visitor", capabilities = []) {
  const status = String(record.application_status ?? record.status ?? "");
  if (actor === "visitor") return { key: "login", label: "登录后申请", tone: "secondary", disabledReason: "" };
  if (actor === "applicant" && status === "accepted" && hasCapability(capabilities, "task:submit")) {
    return { key: "submit", label: "提交交付", tone: "primary", disabledReason: "" };
  }
  if (actor === "applicant" && status === "submitted" && hasCapability(capabilities, "task:submit")) {
    return { key: "supplement", label: "补充交付", tone: "secondary", disabledReason: "" };
  }
  if (actor === "admin" && status === "submitted" && hasCapability(capabilities, "task:manage")) {
    return { key: "review", label: "核验交付", tone: "primary", disabledReason: "" };
  }
  if (status === "published") return { key: "apply", label: "申请任务", tone: "primary", disabledReason: "" };
  return { key: "wait", label: "等待下一步", tone: "muted", disabledReason: "" };
}

export function toActivitySummary(event = {}, attachments = []) {
  return {
    id: String(event.id ?? event.type ?? event.event_type ?? "activity"),
    label: taskTimelineLabel(event.type ?? event.event_type),
    actor: String(event.actor ?? event.actor_name ?? event.actor_display_name ?? "").trim() || "系统记录",
    at: event.at ?? event.created_at ?? event.occurred_at ?? null,
    note: String(event.note ?? event.metadata?.note ?? "").trim(),
    attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
  };
}
```

- [ ] **Step 7: Run tests**

Run:

```powershell
node --test tasks/tests/task-view.test.mjs
```

Expected: all task-view tests pass.

- [ ] **Step 8: Commit**

```powershell
git add assets/js/tasks/task-view.js tasks/tests/task-view.test.mjs
git commit -m "feat: add task collaboration view helpers"
```

---

### Task 2: Task Plaza Collaboration Filters

**Files:**
- Modify: `tasks/index.html`
- Modify: `assets/js/tasks/task-list.js`
- Modify: `tasks/tests/task-controller-contract.test.mjs`

**Interfaces:**
- Consumes: `buildTaskListFilters(formState)` from Task 1.
- Produces: public list query payload with keys `status`, `rewardRange`, `deadlineWindow`, and `skillTags`.

- [ ] **Step 1: Add failing controller contract test**

Add to `tasks/tests/task-controller-contract.test.mjs`:

```js
test("task plaza forwards collaboration filters without losing existing filters", async () => {
  const source = await readFile("assets/js/tasks/task-list.js", "utf8");
  assert.match(source, /buildTaskListFilters/);
  assert.match(source, /data-task-filter-status/);
  assert.match(source, /data-task-filter-reward/);
  assert.match(source, /data-task-filter-deadline/);
  assert.match(source, /data-task-filter-skill-tags/);
  assert.match(source, /skillTags/);
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tasks/tests/task-controller-contract.test.mjs
```

Expected: fail until `task-list.js` consumes the new helper/selectors.

- [ ] **Step 3: Add filter markup**

In `tasks/index.html`, inside `<section class="task-filter-band" aria-label="筛选任务">`, after the existing sort label and before reset button, add:

```html
        <label>
          <span>状态</span>
          <select data-task-filter-status>
            <option value="">全部状态</option>
            <option value="open">可申请</option>
            <option value="closing_soon">即将截止</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
          </select>
        </label>
        <label>
          <span>奖励</span>
          <select data-task-filter-reward>
            <option value="">不限奖励</option>
            <option value="low">低奖励</option>
            <option value="medium">中奖励</option>
            <option value="high">高奖励</option>
          </select>
        </label>
        <label>
          <span>截止</span>
          <select data-task-filter-deadline>
            <option value="">不限截止</option>
            <option value="this_week">本周截止</option>
            <option value="this_month">本月截止</option>
            <option value="none">无截止时间</option>
          </select>
        </label>
        <div class="task-filter-tags" data-task-filter-skill-tags aria-label="技能标签筛选"></div>
```

- [ ] **Step 4: Wire filters in `task-list.js`**

Update imports:

```js
import { buildTaskListFilters, formatTaskDeadline, toTaskListingModel } from "./task-view.js";
```

Add selectors:

```js
const statusSelect = document.querySelector("[data-task-filter-status]");
const rewardSelect = document.querySelector("[data-task-filter-reward]");
const deadlineSelect = document.querySelector("[data-task-filter-deadline]");
const skillTagContainer = document.querySelector("[data-task-filter-skill-tags]");
const selectedSkillTags = new Set();
```

Replace `currentFilters()` with:

```js
function currentFilters() {
  return buildTaskListFilters({
    query: queryInput.value,
    category: categorySelect.value,
    sort: sortSelect.value,
    page: currentPage,
    status: statusSelect?.value ?? "",
    rewardRange: rewardSelect?.value ?? "",
    deadlineWindow: deadlineSelect?.value ?? "",
    skillTags: [...selectedSkillTags],
  });
}
```

- [ ] **Step 5: Add skill tag chip rendering**

Add in `task-list.js`:

```js
function renderSkillFilters(items) {
  if (!skillTagContainer) return;
  const tags = [...new Set(items.flatMap((item) => toTaskListingModel(item).tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const buttons = tags.slice(0, 12).map((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-filter-chip";
    button.textContent = tag;
    button.setAttribute("aria-pressed", String(selectedSkillTags.has(tag)));
    button.addEventListener("click", () => {
      if (selectedSkillTags.has(tag)) selectedSkillTags.delete(tag);
      else selectedSkillTags.add(tag);
      button.setAttribute("aria-pressed", String(selectedSkillTags.has(tag)));
      loadFirstPage();
    });
    return button;
  });
  skillTagContainer.replaceChildren(...buttons);
}
```

Call `renderSkillFilters(items);` after `const items = asItems(result);`.

- [ ] **Step 6: Update empty state and reset**

In the empty-state branch:

```js
if (!items.length) {
  const filters = currentFilters();
  const hasFilters = Boolean(filters.query || filters.category || filters.status || filters.rewardRange || filters.deadlineWindow || filters.skillTags.length);
  showTaskMessage(message, hasFilters ? "没有符合当前筛选条件的任务。可清除筛选后重新查看。" : "当前暂无公开任务。");
}
```

In reset handler add:

```js
statusSelect.value = "";
rewardSelect.value = "";
deadlineSelect.value = "";
selectedSkillTags.clear();
renderSkillFilters([]);
```

Add change listeners:

```js
statusSelect?.addEventListener("change", loadFirstPage);
rewardSelect?.addEventListener("change", loadFirstPage);
deadlineSelect?.addEventListener("change", loadFirstPage);
```

- [ ] **Step 7: Run tests**

```powershell
node --test tasks/tests/task-controller-contract.test.mjs tasks/tests/task-view.test.mjs
```

Expected: pass.

- [ ] **Step 8: Commit**

```powershell
git add tasks/index.html assets/js/tasks/task-list.js tasks/tests/task-controller-contract.test.mjs
git commit -m "feat: add task collaboration filters"
```

---

### Task 3: Task Detail Next Step And Activity

**Files:**
- Modify: `tasks/detail/index.html`
- Modify: `assets/js/tasks/task-detail.js`
- Modify: `tests/browser/task-detail-feedback.test.mjs`

**Interfaces:**
- Consumes: `taskNextAction`, `taskCollaborationStage`, `toActivitySummary`, `normalizeTaskTimeline`, `getTimeline(taskId)`, `getAttachments(taskId)`.
- Produces: DOM slots `[data-task-next-step]` and `[data-task-activity]`.

- [ ] **Step 1: Add failing browser contract test**

Append to `tests/browser/task-detail-feedback.test.mjs`:

```js
test("task detail exposes next-step and collaboration activity slots", async () => {
  const html = await readFile("tasks/detail/index.html", "utf8");
  assert.match(html, /data-task-next-step/);
  assert.match(html, /data-task-activity/);
  const source = await readFile("assets/js/tasks/task-detail.js", "utf8");
  assert.match(source, /taskNextAction/);
  assert.match(source, /toActivitySummary/);
  assert.match(source, /data-task-next-step/);
  assert.match(source, /data-task-activity/);
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tests/browser/task-detail-feedback.test.mjs
```

Expected: fail until detail markup/controller are updated.

- [ ] **Step 3: Add detail markup**

In `tasks/detail/index.html`, near the task metadata/status block, add:

```html
        <aside class="task-next-step" data-task-next-step aria-live="polite">
          <p class="task-kicker">NEXT STEP / 下一步</p>
          <strong data-task-next-step-label>正在判断</strong>
          <span data-task-next-step-note></span>
        </aside>
```

Near the existing timeline section or before attachments, add:

```html
        <section class="task-activity-panel" aria-labelledby="task-activity-title">
          <div class="task-section-heading">
            <h2 id="task-activity-title">协作动态</h2>
          </div>
          <ol class="task-activity-list" data-task-activity aria-live="polite"></ol>
        </section>
```

- [ ] **Step 4: Import helpers**

In `task-detail.js`, update import from `task-view.js`:

```js
import {
  formatTaskDeadline,
  normalizeTaskTimeline,
  statusLabel,
  taskCollaborationStage,
  taskNextAction,
  taskTimelineLabel,
  toActivitySummary,
  toTaskListingModel,
} from "./task-view.js";
```

- [ ] **Step 5: Implement render helpers**

Add:

```js
function renderNextStep(rawTask, capabilities = []) {
  const panel = detail.querySelector("[data-task-next-step]");
  if (!panel) return;
  const actor = capabilities.includes("task:manage") || capabilities.includes("tasks:manage")
    ? "admin"
    : "visitor";
  const action = taskNextAction(rawTask, actor, capabilities);
  panel.querySelector("[data-task-next-step-label]").textContent = action.label;
  panel.querySelector("[data-task-next-step-note]").textContent = action.disabledReason || taskCollaborationStage(rawTask);
  panel.dataset.taskNextAction = action.key;
}

function renderActivity(events, attachments = []) {
  const container = detail.querySelector("[data-task-activity]");
  if (!container) return;
  const summaries = normalizeTaskTimeline(events).map((event) => toActivitySummary(event, attachments));
  if (!summaries.length) {
    const item = document.createElement("li");
    item.textContent = "暂无协作动态。";
    container.replaceChildren(item);
    return;
  }
  container.replaceChildren(...summaries.map((event) => {
    const item = document.createElement("li");
    item.className = "task-activity-item";
    const label = document.createElement("strong");
    label.textContent = event.label;
    const meta = document.createElement("span");
    meta.textContent = [event.actor, event.at ? formatTaskDeadline(event.at) : "", event.attachmentCount ? `${event.attachmentCount} 个附件` : ""].filter(Boolean).join(" · ");
    const note = document.createElement("p");
    note.textContent = event.note || "无补充说明。";
    item.append(label, meta, note);
    return item;
  }));
}
```

- [ ] **Step 6: Call render helpers after loading data**

In the detail load path where `timelineResult` and `attachmentResult` already settle, set:

```js
const timelineItems = timelineResult.status === "fulfilled" ? timelineResult.value : [];
const attachmentItems = attachmentResult.status === "fulfilled" ? attachmentResult.value : [];
renderTimeline(timelineItems);
renderAttachments(attachmentItems);
renderActivity(timelineItems, attachmentItems);
```

After rendering the task itself and reading capabilities, call:

```js
renderNextStep(rawTask, capabilities);
```

If `capabilities` are only available in bootstrap, store them in a module-level `let capabilities = [];`.

- [ ] **Step 7: Run tests**

```powershell
node --test tests/browser/task-detail-feedback.test.mjs tasks/tests/task-view.test.mjs
```

Expected: pass.

- [ ] **Step 8: Commit**

```powershell
git add tasks/detail/index.html assets/js/tasks/task-detail.js tests/browser/task-detail-feedback.test.mjs
git commit -m "feat: show task collaboration next steps"
```

---

### Task 4: My Tasks Action Groups And Supplement Delivery

**Files:**
- Modify: `tasks/my/index.html`
- Modify: `assets/js/tasks/task-my.js`
- Modify: `tasks/tests/task-controller-contract.test.mjs`

**Interfaces:**
- Consumes: `canSupplementApplication(application)`, `taskNextAction(record, "applicant", capabilities)`, existing `services.api.attach(applicationId, attachments)`, existing `uploadAttachment`.
- Produces: supplement dialog and grouped personal task rendering.

- [ ] **Step 1: Add failing contract test**

Add:

```js
test("my tasks supports action grouping and supplement delivery", async () => {
  const html = await readFile("tasks/my/index.html", "utf8");
  assert.match(html, /data-task-group-needs-action/);
  assert.match(html, /task-supplement-dialog/);
  assert.match(html, /name="supplementNote"/);
  const source = await readFile("assets/js/tasks/task-my.js", "utf8");
  assert.match(source, /canSupplementApplication/);
  assert.match(source, /services\\.api\\.attach/);
  assert.match(source, /supplementNote/);
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
node --test tasks/tests/task-controller-contract.test.mjs
```

Expected: fail until markup/source are updated.

- [ ] **Step 3: Add grouping slots and supplement dialog**

In `tasks/my/index.html`, add above the existing list:

```html
        <section class="task-action-group" data-task-group-needs-action>
          <h2>需要我处理</h2>
          <div data-task-group-list="needs-action"></div>
        </section>
        <section class="task-action-group" data-task-group-in-progress>
          <h2>进行中</h2>
          <div data-task-group-list="in-progress"></div>
        </section>
        <section class="task-action-group" data-task-group-history>
          <h2>历史记录</h2>
          <div data-task-group-list="history"></div>
        </section>
```

Add a dialog near the existing submit dialog:

```html
      <dialog id="task-supplement-dialog" class="task-dialog">
        <form method="dialog" data-task-supplement-form>
          <input type="hidden" name="applicationId" />
          <input type="hidden" name="taskId" />
          <h2>补充交付</h2>
          <label><span>补充说明</span><textarea name="supplementNote" required maxlength="1200" rows="6"></textarea></label>
          <label><span>补充附件</span><input type="file" name="attachments" accept="image/*,video/*" multiple /></label>
          <p class="task-form-message" data-task-form-message role="status"></p>
          <div class="task-dialog-actions">
            <button class="task-button task-button-secondary" type="button" data-task-dialog-close>取消</button>
            <button class="task-button task-button-primary" type="submit">提交补充</button>
          </div>
        </form>
      </dialog>
```

- [ ] **Step 4: Import helpers**

Update `task-my.js` imports:

```js
import { canSupplementApplication, formatTaskDeadline, getApplicationGroup, statusLabel, taskNextAction } from "./task-view.js";
```

- [ ] **Step 5: Add grouping helper**

Add:

```js
function actionGroupFor(application) {
  if (["accepted", "submitted"].includes(application.status)) return "needs-action";
  if (["pending"].includes(application.status)) return "in-progress";
  return "history";
}
```

Modify `renderApplications()` to render into `[data-task-group-list]` containers when present. Keep the old `list` fallback for compatibility:

```js
const groupTargets = new Map([...document.querySelectorAll("[data-task-group-list]")]
  .map((node) => [node.dataset.taskGroupList, node]));
groupTargets.forEach((node) => node.replaceChildren());
```

When each fragment is created, append to `groupTargets.get(actionGroupFor(application)) ?? list`.

- [ ] **Step 6: Add supplement button**

Inside the application card action rendering, after submit/cancel handling:

```js
if (canSupplementApplication(application) && hasTaskCapability(capabilities, "submit")) {
  const supplementButton = document.createElement("button");
  supplementButton.className = "task-button task-button-secondary";
  supplementButton.type = "button";
  supplementButton.textContent = "补充交付";
  supplementButton.addEventListener("click", () => {
    const supplementDialog = document.querySelector("#task-supplement-dialog");
    supplementDialog.querySelector("[name='applicationId']").value = application.id;
    supplementDialog.querySelector("[name='taskId']").value = application.task_id ?? task.id ?? "";
    supplementDialog.showModal();
  });
  fragment.querySelector("[data-task-actions]").append(supplementButton);
}
```

- [ ] **Step 7: Add supplement submit handler**

In `bootstrap()`, after the submit form listener:

```js
document.querySelector("[data-task-supplement-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formMessage = form.querySelector("[data-task-form-message]");
  const data = new FormData(form);
  const files = [...(form.elements.namedItem("attachments")?.files ?? [])];
  const invalid = files.find((file) => !validateTaskAttachment(file).ok);
  if (invalid) {
    formMessage.textContent = `附件 ${invalid.name} 不符合图片/视频和 50 MB 限制。`;
    return;
  }
  try {
    await requireAuthenticatedAction(services.runtime, "补充任务交付");
    guardFormData(form, ["supplementNote"], formMessage);
    const applicationId = String(data.get("applicationId"));
    const taskId = String(data.get("taskId") ?? "");
    const userId = user.userId ?? user.id;
    const uploaded = [];
    for (const [index, file] of files.entries()) {
      uploaded.push(await services.api.uploadAttachment({
        userId,
        resourceId: taskId,
        objectId: `supplement-${Date.now()}-${index}`,
        file,
      }));
    }
    await services.api.attach(applicationId, uploaded);
    document.querySelector("#task-supplement-dialog").close();
    form.reset();
    await loadApplications();
    showTaskMessage(message, "补充交付已提交。", "info");
  } catch (error) {
    formMessage.textContent = taskErrorMessage(error);
  }
});
```

For this version, supplement text is guarded but not persisted unless a backend note extension is added later. Do not overload attachment captions with the note.

- [ ] **Step 8: Wire dialog close buttons**

Add in `bootstrap()`:

```js
document.querySelectorAll("[data-task-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog")?.close());
});
```

- [ ] **Step 9: Run tests**

```powershell
node --test tasks/tests/task-controller-contract.test.mjs tasks/tests/task-view.test.mjs
```

Expected: pass.

- [ ] **Step 10: Commit**

```powershell
git add tasks/my/index.html assets/js/tasks/task-my.js tasks/tests/task-controller-contract.test.mjs
git commit -m "feat: add task supplement workflow"
```

---

### Task 5: Admin Arbitration Modal And Final Verification

**Files:**
- Modify: admin task page HTML that loads `assets/js/tasks/task-admin.js`
- Modify: `assets/js/tasks/task-admin.js`
- Modify: `tasks/tests/task-controller-contract.test.mjs` or `admin/tests/admin-module.test.mjs`
- Modify: `docs/v1.1-delivery-report.md` only if the enhancement is shipped/deployed in the same branch

**Interfaces:**
- Consumes: existing `services.api.forceComplete`, `services.api.cancelRefund`, `services.api.deductReputation`.
- Produces: validated arbitration reason payload with category and details.

- [ ] **Step 1: Locate admin task page**

Run:

```powershell
Select-String -Path "admin/**/*.html","tasks/**/*.html" -Pattern "task-admin.js|data-task-admin-filter" -Encoding UTF8
```

Expected: identify the exact HTML file to modify, likely `admin/tasks/index.html`.

- [ ] **Step 2: Add failing arbitration modal test**

Add to `tasks/tests/task-controller-contract.test.mjs`:

```js
test("admin task arbitration uses a validated dialog instead of prompt", async () => {
  const source = await readFile("assets/js/tasks/task-admin.js", "utf8");
  assert.doesNotMatch(source, /window\\.prompt/);
  assert.match(source, /data-task-arbitration-form/);
  assert.match(source, /reasonCategory/);
  assert.match(source, /reasonDetails/);
});
```

- [ ] **Step 3: Run and verify failure**

```powershell
node --test tasks/tests/task-controller-contract.test.mjs
```

Expected: fail because `task-admin.js` still uses `window.prompt`.

- [ ] **Step 4: Add modal markup**

In the admin task HTML found in Step 1, add:

```html
      <dialog id="task-arbitration-dialog" class="task-dialog">
        <form method="dialog" data-task-arbitration-form>
          <input type="hidden" name="action" />
          <input type="hidden" name="taskId" />
          <input type="hidden" name="applicationId" />
          <input type="hidden" name="userId" />
          <h2>处理仲裁</h2>
          <label>
            <span>原因分类</span>
            <select name="reasonCategory" required>
              <option value="">请选择原因</option>
              <option value="timeout">超时</option>
              <option value="missing_delivery">未交付</option>
              <option value="inappropriate_content">内容不合规</option>
              <option value="duplicate_task">重复任务</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label><span>详细原因</span><textarea name="reasonDetails" required minlength="20" maxlength="800" rows="5"></textarea></label>
          <p class="task-form-message" data-task-form-message role="status"></p>
          <div class="task-dialog-actions">
            <button class="task-button task-button-secondary" type="button" data-task-dialog-close>取消</button>
            <button class="task-button task-button-primary" type="submit">确认处理</button>
          </div>
        </form>
      </dialog>
```

- [ ] **Step 5: Refactor `performAction`**

In `task-admin.js`, remove the prompt lines:

```js
const reason = action.startsWith("arbitrate")
  ? window.prompt("请输入仲裁原因", "超时仲裁")
  : "";
if (action.startsWith("arbitrate") && reason === null) return;
```

Add:

```js
function openArbitrationDialog({ action, taskId, applicationId = "", userId = "" } = {}) {
  const dialog = document.querySelector("#task-arbitration-dialog");
  const form = dialog?.querySelector("[data-task-arbitration-form]");
  if (!dialog || !form) throw new Error("仲裁弹窗不可用。");
  form.elements.namedItem("action").value = action;
  form.elements.namedItem("taskId").value = taskId;
  form.elements.namedItem("applicationId").value = applicationId;
  form.elements.namedItem("userId").value = userId;
  form.querySelector("[data-task-form-message]").textContent = "";
  dialog.showModal();
}
```

Change click handling for actions that start with `arbitrate` to call `openArbitrationDialog(...)` and return before `performAction`.

- [ ] **Step 6: Add modal submit handler**

In `bootstrap()`:

```js
document.querySelector("[data-task-arbitration-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formMessage = form.querySelector("[data-task-form-message]");
  const data = new FormData(form);
  const details = String(data.get("reasonDetails") ?? "").trim();
  const category = String(data.get("reasonCategory") ?? "");
  if (!category) {
    formMessage.textContent = "请选择仲裁原因分类。";
    return;
  }
  if (details.length < 20 || details.length > 800) {
    formMessage.textContent = "详细原因需为 20 到 800 字。";
    return;
  }
  try {
    const guarded = guardFormData(form, ["reasonDetails"], formMessage);
    const reason = `${category}: ${guarded.values.reasonDetails.trim()}`;
    await performAction(String(data.get("action")), String(data.get("taskId") || data.get("applicationId")), {
      reason,
      userId: String(data.get("userId") ?? ""),
      applicationId: String(data.get("applicationId") ?? ""),
    });
    document.querySelector("#task-arbitration-dialog").close();
    form.reset();
    await load();
  } catch (error) {
    formMessage.textContent = taskErrorMessage(error);
  }
});
```

Adjust `performAction(action, id, options = {})` to use `options.reason ?? ""` and `options.userId`.

- [ ] **Step 7: Run admin/task tests**

```powershell
node --test tasks/tests/task-controller-contract.test.mjs admin/tests/admin-module.test.mjs tests/browser/form-security.test.mjs
```

Expected: pass.

- [ ] **Step 8: Run current source regression**

```powershell
node -e "const fs=require('fs'), path=require('path'), cp=require('child_process'); const roots=['tests','tasks/tests','admin/tests','shop/tests','announcements/tests']; const out=[]; function walk(d){ if(!fs.existsSync(d)) return; for(const ent of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,ent.name); if(ent.isDirectory()) walk(p); else if(/\\.test\\.(mjs|cjs|js)$/.test(ent.name)) out.push(p); }} roots.forEach(walk); out.sort(); for(let i=0;i<out.length;i+=20){ const r=cp.spawnSync(process.execPath,['--test',...out.slice(i,i+20)],{stdio:'inherit',shell:false}); if(r.status!==0) process.exit(r.status||1); } console.log('SOURCE_TEST_FILES '+out.length);"
```

Expected: all current source tests pass.

- [ ] **Step 9: Run local static/browser smoke before deployment**

Run the existing preview server and a local visual check if this enhancement is to be deployed immediately. If deploying to production, also run:

```powershell
node tests/browser/visual-matrix-cdp-smoke.mjs https://dsxnb.com/MKJ output/playwright/task-v1.2-production 9555
```

Expected after deployment: `{"combinations":80,"errors":0,"overflows":0}`.

- [ ] **Step 10: Commit**

```powershell
git add admin/tasks/index.html assets/js/tasks/task-admin.js tasks/tests/task-controller-contract.test.mjs
git commit -m "feat: add task arbitration dialog"
```

---

## Plan Self-Review

- Spec coverage: Task 1 covers reusable stage/action/activity logic; Task 2 covers task discovery filters; Task 3 covers detail next-step/activity; Task 4 covers my-tasks action grouping and supplement delivery; Task 5 covers admin arbitration and final verification. Non-goals are preserved by constraints.
- Red-flag scan: no vague work-instruction terms are present in task steps.
- Type consistency: helper names are defined in Task 1 and consumed consistently in later tasks. API calls use existing names observed in `task-api.js`: `listPublished`, `getTimeline`, `getAttachments`, `submit`, `attach`, `complete`, `forceComplete`, `cancelRefund`, and `deductReputation`.
