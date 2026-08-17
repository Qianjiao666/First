const page = document.querySelector("[data-task-workspace]");

function createLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  link.className = "task-workspace-link";
  const target = new URL(link.href, window.location.origin);
  const isCurrentPath = target.pathname === window.location.pathname;
  const isCurrentHash = target.hash ? target.hash === window.location.hash : !window.location.hash;
  if (isCurrentPath && isCurrentHash) {
    link.setAttribute("aria-current", "page");
  }
  return link;
}

function createIcon(name) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.setAttribute("viewBox", "0 0 24 24");
  use.setAttribute("href", `/MKJ/assets/icons/task-workspace.svg#${name}`);
  icon.append(use);
  return icon;
}

function mountSidebar() {
  if (!page || document.querySelector("[data-task-sidebar]")) return;
  const isAdmin = window.location.pathname.includes("/admin/tasks/");
  const sidebar = document.createElement("aside");
  sidebar.className = "task-workspace-sidebar";
  sidebar.dataset.taskSidebar = "";
  sidebar.setAttribute("aria-label", isAdmin ? "任务管理导航" : "任务工作台导航");

  const brand = document.createElement("a");
  brand.className = "task-workspace-brand";
  brand.href = isAdmin ? "/MKJ/admin/" : "/MKJ/tasks/";
  brand.textContent = isAdmin ? "航线管理" : "航线任务";

  const nav = document.createElement("nav");
  nav.className = "task-workspace-nav";
  const links = isAdmin
    ? [["/MKJ/admin/tasks/", "任务工作台"], ["/MKJ/admin/tasks/#task-group-overview-title", "任务组管理"], ["/MKJ/admin/tasks/#task-review-queue", "审核中心"], ["/MKJ/admin/tasks/#task-review-queue", "任务批改"], ["/MKJ/admin/tasks/#task-governance", "协作治理"], ["/MKJ/admin/tasks/edit/", "新建任务"], ["/MKJ/admin/", "返回后台"]]
    : [["/MKJ/tasks/", "任务大厅"], ["/MKJ/tasks/my/", "我的任务"], ["/MKJ/tasks/create/", "发布任务"], ["/MKJ/forum/", "关联讨论"]];
  links.forEach(([href, label]) => nav.append(createLink(href, label)));

  sidebar.append(brand, nav);
  page.prepend(sidebar);

  const header = document.querySelector(".task-topbar");
  if (!header) return;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "task-workspace-menu";
  toggle.setAttribute("data-task-sidebar-toggle", "");
  toggle.setAttribute("aria-label", "打开任务导航");
  toggle.setAttribute("aria-expanded", "false");
  toggle.title = "打开任务导航";
  toggle.append(createIcon("menu"));
  toggle.addEventListener("click", () => {
    const open = page.classList.toggle("is-sidebar-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭任务导航" : "打开任务导航");
    toggle.title = open ? "关闭任务导航" : "打开任务导航";
  });
  header.prepend(toggle);
}

function mountFilterDrawer() {
  const drawer = document.querySelector("[data-task-filter-drawer]");
  const toggle = document.querySelector("[data-task-filter-toggle]");
  if (!drawer || !toggle) return;
  toggle.addEventListener("click", () => {
    const open = drawer.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

function mountWorkflowSteps() {
  document.querySelectorAll("[data-task-step-target]").forEach((step) => {
    step.addEventListener("click", () => {
      const target = document.querySelector(step.dataset.taskStepTarget);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      target?.querySelector("input, select, textarea")?.focus({ preventScroll: true });
    });
  });
}

function mountGovernanceTabs() {
  const tabs = [...document.querySelectorAll("[data-task-governance-tab]")];
  const panels = [...document.querySelectorAll("[data-task-governance-panel]")];
  if (!tabs.length || !panels.length) return;
  const select = (name) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.taskGovernanceTab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.taskGovernancePanel !== name;
    });
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => select(tab.dataset.taskGovernanceTab)));
  select(tabs[0].dataset.taskGovernanceTab);
}

mountSidebar();
mountFilterDrawer();
mountWorkflowSteps();
mountGovernanceTabs();
