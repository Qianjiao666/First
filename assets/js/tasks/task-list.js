import { buildTaskDetailUrl, hasTaskCapability } from "./task-domain.js";
import { asItems, createTag, createTaskServices, mountTaskChrome, showTaskMessage, taskErrorMessage } from "./task-common.js";
import { buildTaskListFilters, formatTaskDeadline, toTaskListingModel } from "./task-view.js";

const services = createTaskServices();
const list = document.querySelector("[data-task-list]");
const message = document.querySelector("[data-task-message]");
const count = document.querySelector("[data-task-result-count]");
const queryInput = document.querySelector("[data-task-filter-query]");
const categorySelect = document.querySelector("[data-task-filter-category]");
const sortSelect = document.querySelector("[data-task-filter-sort]");
const statusSelect = document.querySelector("[data-task-filter-status]");
const rewardSelect = document.querySelector("[data-task-filter-reward]");
const deadlineSelect = document.querySelector("[data-task-filter-deadline]");
const skillTagContainer = document.querySelector("[data-task-filter-skill-tags]");
const pagination = document.querySelector("[data-task-pagination]");
const selectedSkillTags = new Set();
let currentPage = 1;

function renderListing(task) {
  const template = document.querySelector("#task-listing-template");
  const fragment = template.content.cloneNode(true);
  const model = toTaskListingModel(task);
  const title = fragment.querySelector("[data-task-title]");

  title.textContent = model.title;
  title.href = buildTaskDetailUrl(model.id);
  fragment.querySelector("[data-task-summary]").textContent = model.summary;
  fragment.querySelector("[data-task-category]").textContent = model.categoryName;
  fragment.querySelector("[data-task-deadline]").textContent = formatTaskDeadline(model.deadline);
  fragment.querySelector("[data-task-reward]").textContent = String(model.reward);
  fragment.querySelector("[data-task-tags]").replaceChildren(...model.tags.map((tag) => createTag(tag)));
  return fragment;
}

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
    renderSkillFilters(items);
    const fragments = items.map(renderListing);
    list.replaceChildren(...fragments);
    count.value = `${result?.total ?? items.length} 项任务`;
    renderPagination(result);
    if (!items.length) {
      const filters = currentFilters();
      const hasFilters = Boolean(filters.query || filters.category || filters.status || filters.rewardRange || filters.deadlineWindow || filters.skillTags.length);
      showTaskMessage(message, hasFilters ? "没有符合当前筛选条件的任务。可清除筛选后重新查看。" : "当前暂无公开任务。");
    }
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
    statusSelect.value = "";
    rewardSelect.value = "";
    deadlineSelect.value = "";
    selectedSkillTags.clear();
    renderSkillFilters([]);
    loadFirstPage();
  });
  queryInput.addEventListener("search", loadFirstPage);
  categorySelect.addEventListener("change", loadFirstPage);
  sortSelect.addEventListener("change", loadFirstPage);
  statusSelect?.addEventListener("change", loadFirstPage);
  rewardSelect?.addEventListener("change", loadFirstPage);
  deadlineSelect?.addEventListener("change", loadFirstPage);
  await loadTasks();
}

bootstrap();
