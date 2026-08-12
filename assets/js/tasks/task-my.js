import { buildTaskDetailUrl, hasTaskCapability, taskActionForApplication } from "./task-domain.js";
import { asItems, createTaskServices, mountTaskChrome, requireAuthenticatedAction, showTaskMessage, taskErrorMessage } from "./task-common.js";
import { validateTaskAttachment } from "./task-attachments.js";
import { formatTaskDeadline, getApplicationGroup, statusLabel } from "./task-view.js";

const services = createTaskServices();
const list = document.querySelector("[data-task-my-list]");
const message = document.querySelector("[data-task-message]");
const dialog = document.querySelector("#task-submit-dialog");
let applications = [];
let activeGroup = "active";
let capabilities = [];

function renderApplications() {
  const template = document.querySelector("#task-my-item-template");
  const filtered = applications.filter((item) => getApplicationGroup(item.status) === activeGroup);
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
      if (hasTaskCapability(capabilities, "submit")) fragment.querySelector("[data-task-actions]").append(submitButton);
      if (hasTaskCapability(capabilities, "submit")) fragment.querySelector("[data-task-actions]").append(cancelButton);
    }
    return fragment;
  });

  list.replaceChildren(...fragments);
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
    const invalid = files.find((file) => !validateTaskAttachment(file).ok);
    if (invalid) {
      formMessage.textContent = `附件 ${invalid.name} 不符合图片/视频和 50 MB 限制。`;
      return;
    }
    try {
      await requireAuthenticatedAction(services.runtime, "提交任务");
      const applicationId = String(data.get("applicationId"));
      const taskId = String(data.get("taskId") ?? "");
      const userId = user.userId ?? user.id;
      const uploaded = [];
      for (const [index, file] of files.entries()) {
        uploaded.push(await services.api.uploadAttachment({
          userId,
          resourceId: taskId,
          objectId: `${Date.now()}-${index}`,
          file,
        }));
      }
      await services.api.submit(applicationId, String(data.get("submissionNote")).trim(), uploaded);
      if (uploaded.length) await services.api.attach(applicationId, uploaded);
      dialog.close();
      form.reset();
      await loadApplications();
      showTaskMessage(message, "完成说明已提交，等待管理员核验。", "info");
    } catch (error) {
      formMessage.textContent = taskErrorMessage(error);
    }
  });

  await loadApplications();
}

bootstrap();
