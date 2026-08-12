import { hasTaskCapability, hasTaskManageCapability } from "./task-domain.js";
import { asItems, createTaskServices, mountTaskChrome, requireAuthenticatedAction, showTaskMessage, taskErrorMessage } from "./task-common.js";
import { formatTaskDeadline, statusLabel } from "./task-view.js";
import { guardFormData } from "../security/form-guard.js";

const TASK_MANAGE_CAPABILITY = "tasks:manage";
const TASK_MANAGE_MARKER = "task:manage";
const services = createTaskServices();
const message = document.querySelector("[data-task-message]");

function button(label, action, id, tone = "secondary", metadata = {}) {
  const element = document.createElement("button");
  element.className = `task-button task-button-${tone}`;
  element.type = "button";
  element.textContent = label;
  element.dataset.taskAdminAction = action;
  element.dataset.taskId = id;
  for (const [key, value] of Object.entries(metadata)) {
    if (value != null) element.dataset[key] = String(value);
  }
  return element;
}

async function runAdminAction(action, id, taskId = id, userId = "") {
  await requireAuthenticatedAction(services.runtime, "管理任务");
  const reason = action.startsWith("arbitrate")
    ? window.prompt("请输入仲裁原因", "超时仲裁")
    : "";
  if (action.startsWith("arbitrate") && reason === null) return;
  const methods = {
    publish: () => services.api.publish(id),
    close: () => services.api.close(id),
    archive: () => services.api.archive(id),
    delete: () => services.api.remove(id),
    assign: () => services.api.assign(id),
    reject: () => services.api.reject(id),
    arbitrateForce: () => services.api.forceComplete(taskId, reason),
    arbitrateForceApplication: () => services.api.forceComplete(taskId, reason, {
      applicationId: id,
      completionNote: reason,
    }),
    arbitrateRefund: () => services.api.cancelRefund(id, reason),
    arbitrateDeduct: () => services.api.deductReputation(taskId, 1, reason, userId ? { userId } : {}),
  };
  if (methods[action]) await methods[action]();
}

function renderAdminRows(tasks) {
  const body = document.querySelector("[data-task-admin-table-body]");
  const rows = tasks.map((task) => {
    const row = document.createElement("tr");
    const title = document.createElement("a");
    title.href = `/MKJ/admin/tasks/edit/?id=${encodeURIComponent(task.id)}`;
    title.textContent = task.title ?? "未命名任务";
    const cells = [
      title,
      statusLabel(task.status),
      String(task.application_count ?? 0),
      String(task.reward_points ?? 0),
      formatTaskDeadline(task.deadline_at),
    ].map((content) => {
      const cell = document.createElement("td");
      if (content instanceof Node) cell.append(content);
      else cell.textContent = content;
      return cell;
    });
    const actions = document.createElement("td");
    actions.append(button("申请", "applications", task.id));
    if (task.status === "draft") actions.append(button("发布", "publish", task.id));
    if (task.status === "published") actions.append(button("关闭", "close", task.id));
    if (["draft", "closed"].includes(task.status)) actions.append(button("归档", "archive", task.id));
    if (["published", "closed"].includes(task.status)) {
      actions.append(button("取消并退款", "arbitrateRefund", task.id));
      actions.append(button("扣除信誉", "arbitrateDeduct", task.id, "secondary", { taskUserId: task.creator_id }));
    }
    row.append(...cells, actions);
    return row;
  });
  body.replaceChildren(...rows);
}

function renderApplications(applications) {
  const container = document.querySelector("[data-task-applications-list]");
  const rows = asItems(applications).map((application) => {
    const item = document.createElement("article");
    item.className = "task-my-item";
    const copy = document.createElement("div");
    copy.textContent = `${application.applicant_name ?? "申请人"} · ${statusLabel(application.status)}`;
    const actions = document.createElement("div");
    actions.className = "task-my-actions";
    if (application.status === "pending") {
      actions.append(button("分配", "assign", application.id, "primary"));
      actions.append(button("拒绝", "reject", application.id));
    }
    if (application.status === "submitted") {
      actions.append(button("核验完成", "complete", application.id, "primary"));
      actions.append(button("强制完成", "arbitrateForceApplication", application.id));
    }
    item.append(copy, actions);
    return item;
  });
  container.replaceChildren(...rows);
}

function replaceOptions(select, items, placeholder) {
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  const choices = items.map((item) => {
    const choice = document.createElement("option");
    choice.value = item.id;
    choice.textContent = item.name;
    return choice;
  });
  select.replaceChildren(option, ...choices);
}

async function populateCategoryOptions() {
  const categorySelect = document.querySelector("[data-task-category-select]");
  const subcategorySelect = document.querySelector("[data-task-subcategory-select]");
  const categories = asItems(await services.api.listCategories());
  replaceOptions(categorySelect, categories, "请选择大类");
  replaceOptions(subcategorySelect, [], "无子类");
  categorySelect.addEventListener("change", () => {
    const selected = categories.find((category) => category.id === categorySelect.value);
    replaceOptions(subcategorySelect, selected?.subcategories ?? [], "无子类");
  });
  return { categories, categorySelect, subcategorySelect };
}

function renderCategorySummary(categories) {
  const container = document.querySelector("[data-task-category-list]");
  const rows = categories.map((category) => {
    const row = document.createElement("div");
    row.className = "task-category-row";
    const names = (category.subcategories ?? []).map((item) => item.name).join("、");
    row.textContent = names ? `${category.name}：${names}` : category.name;
    return row;
  });
  container.replaceChildren(...rows);
}

function taskValue(task, camel, snake) {
  return task?.[camel] ?? task?.[snake] ?? "";
}

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function populateEditorForm(form, task, categorySelect, subcategorySelect) {
  const fields = {
    title: taskValue(task, "title", "title"),
    summary: taskValue(task, "summary", "summary"),
    body: taskValue(task, "body", "body"),
    categoryId: taskValue(task, "categoryId", "category_id"),
    subcategoryId: taskValue(task, "subcategoryId", "subcategory_id"),
    rewardPoints: taskValue(task, "rewardPoints", "reward_points"),
    applicationLimit: taskValue(task, "applicationLimit", "application_limit"),
    deadlineAt: localDateTime(taskValue(task, "deadlineAt", "deadline_at")),
    skillTags: Array.isArray(taskValue(task, "skillTags", "skill_tags"))
      ? taskValue(task, "skillTags", "skill_tags").join(", ")
      : taskValue(task, "skillTags", "skill_tags"),
  };

  for (const [name, value] of Object.entries(fields)) {
    const input = form.elements.namedItem(name);
    if (input) input.value = String(value ?? "");
  }

  categorySelect.dispatchEvent(new Event("change"));
  subcategorySelect.value = String(fields.subcategoryId ?? "");
}

async function loadEditorTask(form, controls) {
  const taskId = new URLSearchParams(window.location.search).get("id");
  if (!taskId) return null;

  const result = await services.api.getAdminTask(taskId);
  const task = result?.task ?? result?.data ?? result;
  populateEditorForm(form, task, controls.categorySelect, controls.subcategorySelect);
  const title = document.querySelector("[data-task-editor-title]");
  const status = document.querySelector("[data-task-draft-status]");
  if (title) title.textContent = task.title ?? "编辑任务";
  if (status) status.textContent = statusLabel(task.status);
  const publishButton = form.querySelector('button[value="publish"]');
  if (publishButton) publishButton.disabled = task.status !== "draft";
  return task;
}

async function setupList() {
  const table = document.querySelector("[data-task-admin-list]");
  const filter = document.querySelector("[data-task-admin-filter]");
  const query = document.querySelector("[data-task-admin-query]");
  const applicationPanel = document.querySelector("[data-task-admin-applications]");
  const reviewDialog = document.querySelector("#task-review-dialog");
  const reviewForm = document.querySelector("[data-task-review-form]");
  const categoryDialog = document.querySelector("#task-category-dialog");
  const categoryForm = document.querySelector("[data-task-category-form]");
  let activeApplicationTaskId = null;

  const load = async () => {
    table.setAttribute("aria-busy", "true");
    try {
      renderAdminRows(asItems(await services.api.getAdminTasks({ status: filter.value, query: query.value.trim() })));
      showTaskMessage(message, "");
    } catch (error) {
      showTaskMessage(message, taskErrorMessage(error), "error");
    } finally {
      table.setAttribute("aria-busy", "false");
    }
  };

  const loadApplications = async () => {
    if (!activeApplicationTaskId) return;
    renderApplications(await services.api.getApplications(activeApplicationTaskId));
    applicationPanel.hidden = false;
  };

  const handleAdminClick = async (event) => {
    const trigger = event.target.closest("[data-task-admin-action]");
    if (!trigger) return;
    try {
      const action = trigger.dataset.taskAdminAction;
      if (action === "applications") {
        activeApplicationTaskId = trigger.dataset.taskId;
        await loadApplications();
      } else if (action === "complete") {
        reviewForm.elements.namedItem("applicationId").value = trigger.dataset.taskId;
        reviewDialog.showModal();
      } else {
        await runAdminAction(action, trigger.dataset.taskId, activeApplicationTaskId, trigger.dataset.taskUserId);
        await loadApplications();
        await load();
      }
    } catch (error) {
      showTaskMessage(message, taskErrorMessage(error), "error");
    }
  };
  table.addEventListener("click", handleAdminClick);
  applicationPanel.addEventListener("click", handleAdminClick);

  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formMessage = reviewForm.querySelector("[data-task-form-message]");
    const data = new FormData(reviewForm);
    try {
      await requireAuthenticatedAction(services.runtime, "管理任务");
      const guarded = guardFormData(reviewForm, ["content"], formMessage);
      await services.api.complete(String(data.get("applicationId")), {
        rating: Number(data.get("rating")),
        content: guarded.values.content.trim(),
      });
      reviewDialog.close();
      reviewForm.reset();
      await loadApplications();
      await load();
      showTaskMessage(message, "任务已核验完成，奖励事件已提交。", "info");
    } catch (error) {
      formMessage.textContent = taskErrorMessage(error);
    }
  });

  async function refreshCategoryDialog() {
    const categories = asItems(await services.api.listCategories());
    renderCategorySummary(categories);
    replaceOptions(categoryForm.elements.namedItem("categoryId"), categories, "请选择大类");
  }

  categoryForm.elements.namedItem("kind").addEventListener("change", (event) => {
    const isSubcategory = event.target.value === "subcategory";
    document.querySelector("[data-task-category-parent-row]").hidden = !isSubcategory;
    document.querySelector("[data-task-category-description-row]").hidden = isSubcategory;
  });
  document.querySelector("[data-task-category-open]").addEventListener("click", async () => {
    try {
      await refreshCategoryDialog();
      categoryDialog.showModal();
    } catch (error) {
      showTaskMessage(message, taskErrorMessage(error), "error");
    }
  });
  categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formMessage = categoryForm.querySelector("[data-task-form-message]");
    const data = new FormData(categoryForm);
    const kind = String(data.get("kind"));
    if (kind === "subcategory" && !data.get("categoryId")) {
      formMessage.textContent = "请选择子类所属的大类。";
      return;
    }
    try {
      await requireAuthenticatedAction(services.runtime, "管理任务分类");
      const guarded = guardFormData(categoryForm, ["name", "description"], formMessage);
      await services.api.saveCategory({
        kind,
        categoryId: String(data.get("categoryId") ?? "") || undefined,
        name: guarded.values.name.trim(),
        slug: String(data.get("slug")).trim(),
        description: String(guarded.values.description ?? "").trim(),
        sortOrder: Number(data.get("sortOrder")),
        isActive: data.get("isActive") === "on",
      });
      categoryForm.reset();
      categoryForm.elements.namedItem("isActive").checked = true;
      categoryForm.elements.namedItem("kind").dispatchEvent(new Event("change"));
      formMessage.textContent = "分类已保存。";
      await refreshCategoryDialog();
    } catch (error) {
      formMessage.textContent = taskErrorMessage(error);
    }
  });

  filter.addEventListener("change", load);
  query.addEventListener("search", load);
  document.querySelector("[data-task-applications-close]").addEventListener("click", () => { applicationPanel.hidden = true; });
  await load();
}

async function setupEditor() {
  const form = document.querySelector("[data-task-editor-form]");
  try {
    const controls = await populateCategoryOptions();
    await loadEditorTask(form, controls);
  } catch (error) {
    showTaskMessage(message, taskErrorMessage(error), "error");
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const intent = event.submitter?.value ?? "draft";
    const data = new FormData(form);
    const payload = {
      id: new URLSearchParams(window.location.search).get("id") || undefined,
      title: String(data.get("title")).trim(),
      summary: String(data.get("summary")).trim(),
      body: String(data.get("body")).trim(),
      categoryId: String(data.get("categoryId")),
      subcategoryId: String(data.get("subcategoryId")) || null,
      rewardPoints: Number(data.get("rewardPoints")),
      applicationLimit: Number(data.get("applicationLimit")),
      deadlineAt: String(data.get("deadlineAt")),
      skillTags: String(data.get("skillTags")).split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    const formMessage = form.querySelector("[data-task-form-message]");
    try {
      await requireAuthenticatedAction(services.runtime, "管理任务");
      const guarded = guardFormData(form, ["title", "summary", "body"], formMessage);
      const saved = await services.api.saveTask({ ...payload, ...guarded.values });
      if (intent === "publish") {
        await services.api.publish(saved.taskId ?? saved.id);
        showTaskMessage(message, "任务已发布。", "info");
        formMessage.textContent = "";
      } else {
        const warningCount = Array.isArray(saved.warnings) ? saved.warnings.length : 0;
        const notice = warningCount
          ? `草稿已保存，检测并替换了 ${warningCount} 项敏感内容，请检查后再发布。`
          : "草稿已保存。";
        formMessage.textContent = notice;
        showTaskMessage(message, notice, "info");
      }
    } catch (error) {
      formMessage.textContent = taskErrorMessage(error);
    }
  });
}

function blockAdminWrites() {
  for (const node of document.querySelectorAll("[data-task-admin-write]")) {
    node.querySelectorAll?.("button, input, select, textarea").forEach((control) => { control.disabled = true; });
    node.hidden = true;
  }
  document.querySelector("[data-task-admin-list]")?.setAttribute("aria-busy", "false");
  document.body.dataset.taskCapabilityGuard = "denied";
}

async function bootstrap() {
  await mountTaskChrome(services.runtime);
  try {
    const capabilities = await services.runtime.getCapabilities();
    if (!hasTaskManageCapability(capabilities) && !hasTaskCapability(capabilities, "manage")) {
      blockAdminWrites();
      showTaskMessage(message, `当前账户缺少 ${TASK_MANAGE_MARKER} / ${TASK_MANAGE_CAPABILITY} 权限。`, "error");
      return;
    }
  } catch (error) {
    blockAdminWrites();
    showTaskMessage(message, taskErrorMessage(error, "无法验证任务管理权限。"), "error");
    return;
  }

  document.body.dataset.taskCapabilityGuard = "allowed";
  if (document.body.dataset.taskAdminView === "editor") await setupEditor();
  else await setupList();
}

bootstrap();
