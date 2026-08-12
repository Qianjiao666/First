import { hasTaskCapability, parseTaskId } from "./task-domain.js";
import { asItems, createTag, createTaskServices, mountTaskChrome, requireAuthenticatedAction, showTaskMessage, taskErrorMessage } from "./task-common.js";
import { formatTaskDeadline, normalizeTaskTimeline, statusLabel, taskTimelineLabel, toTaskListingModel } from "./task-view.js";

const services = createTaskServices();
const message = document.querySelector("[data-task-message]");
const detail = document.querySelector("[data-task-detail]");
const dialog = document.querySelector("#task-apply-dialog");
const taskId = parseTaskId(window.location.search);

function setText(selector, value) {
  detail.querySelector(selector).textContent = value;
}

function renderRelatedPosts(posts) {
  const container = detail.querySelector("[data-task-related-posts]");
  const items = asItems(posts);
  if (!items.length) return;

  const list = document.createElement("ul");
  for (const post of items) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = post.href ?? `/MKJ/forum/p/?id=${encodeURIComponent(post.id)}`;
    link.textContent = post.title ?? "查看相关讨论";
    item.append(link);
    list.append(item);
  }
  container.replaceChildren(list);
}

function renderAttachments(items) {
  const container = detail.querySelector("[data-task-attachments]");
  if (!container) return;
  const attachments = asItems(items);
  if (!attachments.length) {
    container.replaceChildren(Object.assign(document.createElement("li"), { textContent: "暂无附件。" }));
    return;
  }
  const rows = attachments.map((attachment) => {
    const item = document.createElement("li");
    const url = attachment.public_url ?? attachment.url;
    const label = attachment.name ?? attachment.file_name ?? "任务附件";
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = label;
      item.append(link);
    } else {
      item.textContent = label;
    }
    return item;
  });
  container.replaceChildren(...rows);
}

function renderTimeline(events) {
  const container = detail.querySelector("[data-task-timeline]");
  if (!container) return;
  const timeline = normalizeTaskTimeline(asItems(events));
  if (!timeline.length) {
    container.replaceChildren(Object.assign(document.createElement("li"), { textContent: "暂无进度记录。" }));
    return;
  }
  const rows = timeline.map((event) => {
    const item = document.createElement("li");
    item.className = "task-timeline-item";
    const heading = document.createElement("strong");
    heading.textContent = taskTimelineLabel(event.type);
    const meta = document.createElement("time");
    meta.dateTime = event.at ?? "";
    meta.textContent = formatTaskDeadline(event.at);
    item.append(heading, meta);
    if (event.actor || event.note) {
      const note = document.createElement("p");
      note.textContent = [event.actor, event.note].filter(Boolean).join(" · ");
      item.append(note);
    }
    return item;
  });
  container.replaceChildren(...rows);
}

function renderTask(rawTask, relatedPosts) {
  const task = toTaskListingModel(rawTask);
  setText("[data-task-category]", task.categoryName);
  setText("[data-task-title]", task.title);
  setText("[data-task-summary]", task.summary);
  setText("[data-task-reward]", String(task.reward));
  setText("[data-task-deadline]", formatTaskDeadline(task.deadline));
  setText("[data-task-capacity]", String(rawTask.application_limit ?? "不限"));
  setText("[data-task-status]", statusLabel(rawTask.status));
  detail.querySelector("[data-task-body]").textContent = rawTask.body ?? "暂未提供任务内容。";
  detail.querySelector("[data-task-tags]").replaceChildren(...task.tags.map((tag) => createTag(tag)));
  renderRelatedPosts(relatedPosts);
  detail.setAttribute("aria-busy", "false");
}

async function handleApply(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formMessage = form.querySelector("[data-task-form-message]");
  const note = String(new FormData(form).get("applicationNote") ?? "").trim();
  if (!note) return;

  try {
    await requireAuthenticatedAction(services.runtime, "申领任务");
    const result = await services.api.apply(taskId, note);
    form.reset();
    dialog.close();
    const warningCount = Array.isArray(result?.warnings) ? result.warnings.length : 0;
    const successMessage = warningCount
      ? `申请已提交，已替换 ${warningCount} 项敏感内容。`
      : result?.message ?? "申请已提交，等待管理员受理。";
    showTaskMessage(message, successMessage, "info");
  } catch (error) {
    formMessage.textContent = taskErrorMessage(error);
  }
}

async function bootstrap() {
  const user = await mountTaskChrome(services.runtime);
  if (!taskId) {
    detail.setAttribute("aria-busy", "false");
    showTaskMessage(message, "任务链接无效，请返回任务广场重新选择。", "error");
    return;
  }

  const applyButton = document.querySelector("[data-task-apply]");
  let canApply = false;
  if (user) {
    try {
      canApply = hasTaskCapability(await services.runtime.getCapabilities(), "apply");
    } catch {
      canApply = false;
    }
  }
  if (applyButton) applyButton.hidden = Boolean(user && !canApply);
  applyButton?.addEventListener("click", async () => {
    try {
      await requireAuthenticatedAction(services.runtime, "申领任务");
    } catch {
      return;
    }
    const user = await services.runtime.getCurrentUser();
    if (!user) {
      showTaskMessage(message, "请先从航线首页登录账户后再申请任务。", "error");
      return;
    }
    if (!hasTaskCapability(await services.runtime.getCapabilities(), "apply")) {
      showTaskMessage(message, "当前账号没有 task:apply 权限。", "error");
      return;
    }
    dialog.showModal();
  });
  document.querySelector("[data-task-apply-form]").addEventListener("submit", handleApply);

  try {
    const result = await services.api.getDetail(taskId);
    renderTask(result?.task ?? result, result?.relatedPosts ?? []);
    const [timelineResult, attachmentResult] = await Promise.allSettled([
      services.api.getTimeline(taskId),
      services.api.getAttachments(taskId),
    ]);
    renderTimeline(timelineResult.status === "fulfilled" ? timelineResult.value : []);
    renderAttachments(attachmentResult.status === "fulfilled" ? attachmentResult.value : []);
  } catch (error) {
    detail.setAttribute("aria-busy", "false");
    showTaskMessage(message, taskErrorMessage(error), "error");
  }
}

bootstrap();
