import { TASK_ATTACHMENT_MAX_BYTES, validateTaskAttachment } from "./task-attachments.js";
import { asItems, createTaskServices, mountTaskChrome, requireAuthenticatedAction, showTaskMessage, taskErrorMessage } from "./task-common.js";
import { guardFormData } from "../security/form-guard.js";

const services = createTaskServices();
const form = document.querySelector("[data-task-create-form]");
const message = document.querySelector("[data-task-message]");
const formMessage = form?.querySelector("[data-task-form-message]");
const categorySelect = form?.querySelector("[data-task-category-select]");
const subcategorySelect = form?.querySelector("[data-task-subcategory-select]");
const attachmentInput = form?.querySelector("[data-task-attachment-input]");
const attachmentList = form?.querySelector("[data-task-attachment-list]");
const templateSelect = form?.querySelector("[data-task-template-select]");
const eligibility = form?.querySelector("[data-task-publishing-eligibility]");
let categories = [];
let currentUser = null;

function replaceOptions(select, items, placeholder) {
  if (!select) return;
  const empty = new Option(placeholder, "");
  const options = items.map((item) => new Option(item.name ?? "未命名分类", item.id));
  select.replaceChildren(empty, ...options);
}

function renderAttachments(files) {
  if (!attachmentList) return;
  const rows = [...files].map((file) => {
    const item = document.createElement("li");
    const result = validateTaskAttachment(file);
    item.className = "task-attachment-item";
    item.textContent = result.ok
      ? `${file.name} · ${(Number(file.size) / 1024 / 1024).toFixed(1)} MB`
      : `${file.name} · 附件不可用`;
    item.dataset.tone = result.ok ? "valid" : "error";
    return item;
  });
  attachmentList.replaceChildren(...rows);
}

async function loadCategories() {
  categories = asItems(await services.api.listCategories());
  replaceOptions(categorySelect, categories, "请选择大类");
  replaceOptions(subcategorySelect, [], "先选择大类");
}

async function loadTemplatesAndEligibility() {
  const templates = await services.api.getTemplates();
  replaceOptions(templateSelect, asItems(templates).map((template) => ({ ...template, name: template.title })), "不使用模板");
  if (eligibility) eligibility.textContent = "所有登录用户均可发布任务。";
  const publishButton = form?.querySelector("[data-task-create-publish]");
  if (publishButton) publishButton.disabled = false;
}

function selectedFiles() {
  return [...(attachmentInput?.files ?? [])];
}

function payloadFromForm(data) {
  return {
    title: String(data.get("title") ?? "").trim(),
    summary: String(data.get("summary") ?? "").trim(),
    body: String(data.get("body") ?? "").trim(),
    categoryId: String(data.get("categoryId") ?? ""),
    subcategoryId: String(data.get("subcategoryId") ?? "") || null,
    rewardPoints: Number(data.get("rewardPoints")),
    applicationLimit: Number(data.get("applicationLimit")),
    deadlineAt: String(data.get("deadlineAt") ?? ""),
    skillTags: String(data.get("skillTags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    templateId: String(data.get("templateId") ?? "") || null,
    taskMode: String(data.get("taskMode") ?? "individual"),
    attachmentMetadata: selectedFiles().map((file) => ({ name: file.name, mimeType: file.type, size: file.size })),
  };
}

function blockCreate(messageText = "请先登录后发布任务。") {
  form?.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
  showTaskMessage(message, messageText, "error");
  document.body.dataset.taskCapabilityGuard = "denied";
}

async function handleSubmit(event) {
  event.preventDefault();
  const intent = event.submitter?.value ?? "draft";
  const data = new FormData(form);
  const files = selectedFiles();
  const invalid = files.find((file) => !validateTaskAttachment(file).ok);
  if (invalid) {
    formMessage.textContent = `附件 ${invalid.name} 不符合图片/视频和 50 MB 限制。`;
    return;
  }

  try {
    await requireAuthenticatedAction(services.runtime, "创建任务");
    const guarded = guardFormData(form, ["title", "summary", "body"], formMessage);
    const payload = { ...payloadFromForm(data), ...guarded.values };
    const saved = await services.api.saveTask(payload);
    const taskId = saved.taskId ?? saved.id;
    if (files.length && taskId) {
      const userId = currentUser?.userId ?? currentUser?.id;
      const uploaded = [];
      for (const [index, file] of files.entries()) {
        uploaded.push(await services.api.uploadAttachment({
          userId,
          resourceId: taskId,
          objectId: `${Date.now()}-${index}`,
          file,
        }));
      }
      await services.api.registerTaskAttachments(taskId, uploaded);
    }
    if (intent === "publish") {
      await services.api.publish(taskId);
      showTaskMessage(message, "任务已发布。", "info");
    } else {
      const warningCount = Array.isArray(saved.warnings) ? saved.warnings.length : 0;
      const notice = warningCount ? `草稿已保存，已替换 ${warningCount} 项敏感内容。` : "草稿已保存。";
      formMessage.textContent = notice;
      showTaskMessage(message, notice, "info");
    }
  } catch (error) {
    formMessage.textContent = taskErrorMessage(error);
  }
}

async function bootstrap() {
  const user = await mountTaskChrome(services.runtime);
  currentUser = user;
  if (!user) {
    blockCreate("请先登录后发布任务。");
    void requireAuthenticatedAction(services.runtime, "创建任务").catch(() => {});
    return;
  }
  try {
    document.body.dataset.taskCapabilityGuard = "allowed";
    await loadCategories();
    await loadTemplatesAndEligibility();
  } catch (error) {
    blockCreate();
    showTaskMessage(message, taskErrorMessage(error), "error");
    return;
  }

  categorySelect.addEventListener("change", () => {
    const category = categories.find((item) => item.id === categorySelect.value);
    replaceOptions(subcategorySelect, category?.subcategories ?? [], "无子类");
  });
  attachmentInput.addEventListener("change", () => renderAttachments(selectedFiles()));
  form.addEventListener("submit", handleSubmit);
}

bootstrap();

export { payloadFromForm, renderAttachments };
