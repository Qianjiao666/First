import { buildTaskDetailUrl, hasTaskCapability, taskActionForApplication } from "./task-domain.js";
import { asItems, createTaskServices, mountTaskChrome, requireAuthenticatedAction, showTaskMessage, taskErrorMessage } from "./task-common.js";
import { validateTaskAttachment } from "./task-attachments.js";
import { canSupplementApplication, formatTaskDeadline, getApplicationGroup, statusLabel } from "./task-view.js";
import { guardFormData } from "../security/form-guard.js";

const services = createTaskServices();
const list = document.querySelector("[data-task-my-list]");
const message = document.querySelector("[data-task-message]");
const dialog = document.querySelector("#task-submit-dialog");
const supplementDialog = document.querySelector("#task-supplement-dialog");
let applications = [];
let activeGroup = "active";
let capabilities = [];

function actionGroupFor(application) {
  if (["accepted", "submitted"].includes(application.status)) return "needs-action";
  if (["pending"].includes(application.status)) return "in-progress";
  return "history";
}

function renderApplications() {
  const template = document.querySelector("#task-my-item-template");
  const groupTargets = new Map([...document.querySelectorAll("[data-task-group-list]")]
    .map((node) => [node.dataset.taskGroupList, node]));
  groupTargets.forEach((node) => node.replaceChildren());
  const groupedView = groupTargets.size > 0;
  const filtered = groupedView ? applications : applications.filter((item) => getApplicationGroup(item.status) === activeGroup);
  const fragments = filtered.map((application) => {
    const fragment = template.content.cloneNode(true);
    const task = application.task ?? application.task_listing ?? {};
    const title = fragment.querySelector("[data-task-title]");
    title.textContent = task.title ?? "未命名任务";
    title.href = buildTaskDetailUrl(application.task_id ?? task.id ?? "");
    fragment.querySelector("[data-task-status]").textContent = statusLabel(application.status);
    fragment.querySelector("[data-task-deadline]").textContent = formatTaskDeadline(task.deadline_at);
    const action = taskActionForApplication(application.status, "applicant");
    if (action === "submit" && hasTaskCapability(capabilities, "submit")) {
      const submitButton = document.createElement("button");
      submitButton.className = "task-button task-button-primary";
      submitButton.type = "button";
      submitButton.textContent = "提交完成";
      submitButton.addEventListener("click", () => {
        dialog.querySelector("[name='applicationId']").value = application.id;
        dialog.querySelector("[name='taskId']").value = application.task_id ?? task.id ?? "";
        dialog.showModal();
      });
      const cancelButton = document.createElement("button");
      cancelButton.className = "task-button task-button-secondary";
      cancelButton.type = "button";
      cancelButton.textContent = "取消领取";
      cancelButton.addEventListener("click", async () => {
        if (!window.confirm("确认取消领取这个任务？取消后不能恢复本次申请。")) return;
        try {
          await requireAuthenticatedAction(services.runtime, "取消任务申领");
          await services.api.cancel(application.id);
          await loadApplications();
          showTaskMessage(message, "任务领取已取消。", "info");
        } catch (error) {
          showTaskMessage(message, taskErrorMessage(error), "error");
        }
      });
      fragment.querySelector("[data-task-actions]").append(submitButton, cancelButton);
    }
    if (canSupplementApplication(application) && hasTaskCapability(capabilities, "submit")) {
      const supplementButton = document.createElement("button");
      supplementButton.className = "task-button task-button-secondary";
      supplementButton.type = "button";
      supplementButton.textContent = "补充交付";
      supplementButton.addEventListener("click", () => {
        supplementDialog.querySelector("[name='applicationId']").value = application.id;
        supplementDialog.querySelector("[name='taskId']").value = application.task_id ?? task.id ?? "";
        supplementDialog.showModal();
      });
      fragment.querySelector("[data-task-actions]").append(supplementButton);
    }
    if (groupedView) {
      (groupTargets.get(actionGroupFor(application)) ?? list).append(fragment);
      return null;
    }
    return fragment;
  });

  list.replaceChildren(...fragments.filter(Boolean));
  if (!filtered.length) showTaskMessage(message, "当前分类下没有任务记录。");
}

async function loadApplications() {
  list.setAttribute("aria-busy", "true");
  try {
    applications = asItems(await services.api.getMine());
    showTaskMessage(message, "");
    renderApplications();
  } catch (error) {
    list.replaceChildren();
    showTaskMessage(message, taskErrorMessage(error), "error");
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

async function uploadFiles(files, taskId, userId, prefix = "") {
  const uploaded = [];
  for (const [index, file] of files.entries()) {
    uploaded.push(await services.api.uploadAttachment({
      userId,
      resourceId: taskId,
      objectId: `${prefix}${Date.now()}-${index}`,
      file,
    }));
  }
  return uploaded;
}

function validateFiles(files, formMessage) {
  const invalid = files.find((file) => !validateTaskAttachment(file).ok);
  if (!invalid) return true;
  formMessage.textContent = `附件 ${invalid.name} 不符合图片/视频和 50 MB 限制。`;
  return false;
}

async function bootstrap() {
  const user = await mountTaskChrome(services.runtime);
  if (!user) {
    showTaskMessage(message, "登录后可以查看自己的任务进度。", "error");
    void requireAuthenticatedAction(services.runtime, "查看我的任务").catch(() => {});
    return;
  }

  try {
    capabilities = await services.runtime.getCapabilities();
  } catch {
    capabilities = [];
  }

  document.querySelectorAll("[data-task-tab]").forEach((tab) => tab.addEventListener("click", () => {
    activeGroup = tab.dataset.taskTab;
    document.querySelectorAll("[data-task-tab]").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    renderApplications();
  }));

  document.querySelector("[data-task-submit-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formMessage = form.querySelector("[data-task-form-message]");
    const data = new FormData(form);
    const files = [...(form.elements.namedItem("attachments")?.files ?? [])];
    if (!validateFiles(files, formMessage)) return;
    try {
      await requireAuthenticatedAction(services.runtime, "提交任务");
      const guarded = guardFormData(form, ["submissionNote"], formMessage);
      const applicationId = String(data.get("applicationId"));
      const taskId = String(data.get("taskId") ?? "");
      const userId = user.userId ?? user.id;
      const uploaded = await uploadFiles(files, taskId, userId);
      await services.api.submit(applicationId, guarded.values.submissionNote.trim(), uploaded);
      if (uploaded.length) await services.api.attach(applicationId, uploaded);
      dialog.close();
      form.reset();
      await loadApplications();
      showTaskMessage(message, "完成说明已提交，等待管理员核验。", "info");
    } catch (error) {
      formMessage.textContent = taskErrorMessage(error);
    }
  });

  document.querySelector("[data-task-supplement-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formMessage = form.querySelector("[data-task-form-message]");
    const data = new FormData(form);
    const files = [...(form.elements.namedItem("attachments")?.files ?? [])];
    if (!validateFiles(files, formMessage)) return;
    try {
      await requireAuthenticatedAction(services.runtime, "补充任务交付");
      const guarded = guardFormData(form, ["supplementNote"], formMessage);
      const applicationId = String(data.get("applicationId"));
      const taskId = String(data.get("taskId") ?? "");
      const userId = user.userId ?? user.id;
      const uploaded = await uploadFiles(files, taskId, userId, "supplement-");
      await services.api.attach(applicationId, uploaded, guarded.values.supplementNote.trim());
      supplementDialog.close();
      form.reset();
      await loadApplications();
      showTaskMessage(message, "补充交付已提交。", "info");
    } catch (error) {
      formMessage.textContent = taskErrorMessage(error);
    }
  });

  document.querySelectorAll("[data-task-dialog-close]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });

  await loadApplications();
}

bootstrap();
