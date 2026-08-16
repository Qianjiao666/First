import { buildTaskDetailUrl, hasTaskCapability } from "./task-domain.js";
import { asItems, createTag, createTaskServices, mountTaskChrome, showTaskMessage, taskErrorMessage } from "./task-common.js";
import { formatTaskDeadline, toCollaborativeTaskModel } from "./task-view.js";

const services = createTaskServices();
const list = document.querySelector("[data-task-list]");
const message = document.querySelector("[data-task-message]");
const count = document.querySelector("[data-task-result-count]");
const queryInput = document.querySelector("[data-task-filter-query]");
const categorySelect = document.querySelector("[data-task-filter-category]");
const sortSelect = document.querySelector("[data-task-filter-sort]");
const modeSelect = document.querySelector("[data-task-filter-mode]");
const pagination = document.querySelector("[data-task-pagination]");
let currentPage = 1;

function renderListing(task) {
  const template = document.querySelector("#task-listing-template");
  const fragment = template.content.cloneNode(true);
  const model = toCollaborativeTaskModel(task);
  const title = fragment.querySelector("[data-task-title]");

  title.textContent = model.title;
  title.href = buildTaskDetailUrl(model.id);
  fragment.querySelector("[data-task-summary]").textContent = model.summary;
  fragment.querySelector("[data-task-category]").textContent = model.categoryName;
  fragment.querySelector("[data-task-deadline]").textContent = formatTaskDeadline(model.deadline);
  fragment.querySelector("[data-task-reward]").textContent = String(model.reward);
  fragment.querySelector("[data-task-collaboration-meta]").textContent = `${model.taskType} · ${model.capacityLabel} · ${model.reviewLabel}`;
  fragment.querySelector("[data-task-tags]").replaceChildren(...model.tags.map((tag) => createTag(tag)));
  return fragment;
}

function currentFilters() {
  return {
    query: queryInput.value.trim(),
    category: categorySelect.value,
    sort: sortSelect.value,
    mode: modeSelect?.value ?? "",
    page: currentPage,
  };
}

function renderPagination(result) {
  if (!pagination) return;
  const total = Number(result?.total ?? 0);
  const limit = Number(result?.limit ?? 20);
  const pageCount = Math.max(1, Math.ceil(total / limit));
  pagination.replaceChildren();
  pagination.hidden = pageCount <= 1;
  if (pageCount <= 1) return;

  for (let page = 1; page <= pageCount; page += 1) {
    const button = document.createElement("button");
    button.className = "task-pagination-button";
    button.type = "button";
    button.textContent = String(page);
    button.setAttribute("aria-label", `第 ${page} 页`);
    button.setAttribute("aria-current", String(page === currentPage));
    button.addEventListener("click", () => {
      currentPage = page;
      loadTasks();
    });
    pagination.append(button);
  }
}

function loadFirstPage() {
  currentPage = 1;
  return loadTasks();
}

async function loadCategories() {
  const result = await services.api.listCategories();
  const defaultOption = categorySelect.querySelector('option[value=""]')?.cloneNode(true)
    ?? new Option("全部方向", "");
  const options = asItems(result).map((category) => {
    const option = new Option(category.name ?? "未命名方向", category.id);
    return option;
  });
  categorySelect.replaceChildren(defaultOption, ...options);
}

async function loadTasks() {
  list.setAttribute("aria-busy", "true");
  showTaskMessage(message, "");

  try {
    const result = await services.api.listPublished(currentFilters());
    const items = asItems(result);
    const fragments = items.map(renderListing);
    list.replaceChildren(...fragments);
    count.value = `${result?.total ?? items.length} 项任务`;
    renderPagination(result);
    if (!items.length) showTaskMessage(message, "没有符合当前筛选条件的任务。");
  } catch (error) {
    list.replaceChildren();
    count.value = "--";
    showTaskMessage(message, taskErrorMessage(error), "error");
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

async function bootstrap() {
  await mountTaskChrome(services.runtime);
  try {
    const capabilities = await services.runtime.getCapabilities();
    const createLink = document.querySelector("[data-task-create-link]");
    if (createLink) createLink.hidden = !hasTaskCapability(capabilities, "create");
  } catch {
    document.querySelector("[data-task-create-link]")?.setAttribute("hidden", "");
  }
  try {
    await loadCategories();
  } catch (error) {
    showTaskMessage(message, taskErrorMessage(error), "error");
  }
  document.querySelector("[data-task-filter-reset]").addEventListener("click", () => {
    queryInput.value = "";
    categorySelect.value = "";
    sortSelect.value = "published_at.desc";
    loadFirstPage();
  });
  queryInput.addEventListener("search", loadFirstPage);
  categorySelect.addEventListener("change", loadFirstPage);
  modeSelect?.addEventListener("change", loadFirstPage);
  sortSelect.addEventListener("change", loadFirstPage);
  await loadTasks();
}

bootstrap();
