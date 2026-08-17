import { guardFormData } from "../security/form-guard.js";
import { loadDraft, saveDraft, clearDraft, loadMockState, updateMockState, downloadMockCsv } from "./task-mock-data.js";

const root = document.querySelector("[data-mock-root]");
const page = document.body.dataset.mockPage;
const requiredRole = document.body.dataset.mockRole;
const state = loadMockState();

function node(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === "text") element.textContent = value;
    else if (key === "class") element.className = value;
    else if (key === "on") Object.entries(value).forEach(([event, handler]) => element.addEventListener(event, handler));
    else if (key === "dataset") Object.assign(element.dataset, value);
    else if (key in element) element[key] = value;
    else element.setAttribute(key, value);
  });
  element.append(...children.filter(Boolean));
  return element;
}

function text(value) { return node("span", { text: String(value ?? "") }); }
function button(label, onClick, className = "mock-button") { return node("button", { type: "button", class: className, text: label, on: { click: onClick } }); }
function field(label, control, className = "mock-field") { return node("div", { class: className }, [node("label", { text: label, htmlFor: control.id }), control]); }
function input(type, name, value = "", placeholder = "") { return node("input", { type, name, id: `mock-${name}`, value, placeholder }); }
function select(name, options, selected = "") {
  const control = node("select", { name, id: `mock-${name}` });
  options.forEach(([value, label]) => control.append(node("option", { value, text: label, selected: value === selected })));
  return control;
}
function showStatus(target, message, tone = "info") {
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
  target.hidden = !message;
}
function navigate(path) { window.location.href = path; }

async function enforceRole() {
  const runtime = window.MKJApp;
  if (!runtime?.getCurrentUser) return true;
  try {
    const user = await runtime.getCurrentUser();
    if (!user) {
      if (page === "student-market") return true;
      navigate("/MKJ/");
      return false;
    }
    const identity = await runtime.getPublicUserIdentity?.(user.id);
    const role = String(identity?.role ?? user.user_metadata?.role ?? "STUDENT").toUpperCase();
    if (requiredRole === "admin" && !["ADMIN", "MODERATOR"].includes(role)) { navigate("/MKJ/tasks/mock/"); return false; }
    if (requiredRole === "student" && role === "ADMIN") { navigate("/MKJ/tasks/mock/"); return false; }
  } catch {
    navigate("/MKJ/tasks/mock/");
    return false;
  }
  return true;
}

function mountFrame(title, subtitle, isAdmin = false) {
  const frame = node("div", { class: "mock-app" });
  const topbar = node("header", { class: "mock-topbar" }, [
    node("div", {}, [node("h1", { text: title }), node("p", { text: subtitle })]),
    node("div", { class: "mock-topbar-actions" }, [
      node("label", { class: "mock-search", ariaLabel: "全局搜索" }, [text("⌕"), node("input", { type: "search", placeholder: "搜索任务、学生或任务组", ariaLabel: "全局搜索" })]),
      node("button", { type: "button", class: "mock-icon-button", ariaLabel: "消息通知", title: "消息通知", on: { click: () => showStatus(frame.querySelector("[data-frame-status]"), "你有 3 条待处理提醒。", "info") } }, [text("通知"), node("i", { class: "mock-unread", ariaHidden: "true" })]),
      isAdmin ? button("+ 发布任务", () => navigate("/MKJ/tasks/mock/"), "mock-button mock-button-primary") : null,
    ]),
  ]);
  const layout = node("div", { class: `mock-layout${isAdmin ? " has-sidebar" : ""}` });
  if (isAdmin) {
    const links = [
      ["/MKJ/admin/tasks/mock/", "工作台"],
      ["/MKJ/admin/tasks/mock/#groups", "任务组管理"],
      ["/MKJ/admin/tasks/mock/review/", "审核中心"],
      ["/MKJ/admin/tasks/mock/review/", "任务批改"],
      ["/MKJ/admin/tasks/", "原任务后台"],
    ];
    const nav = node("nav", {}, links.map(([href, label]) => node("a", { href, text: label, ariaCurrent: window.location.pathname === new URL(href, location.origin).pathname ? "page" : undefined })));
    layout.append(node("aside", { class: "mock-sidebar" }, [node("div", { class: "mock-sidebar-title", text: "任务管理" }), nav]));
  } else {
    const links = [["/MKJ/tasks/mock/", "任务广场"], ["/MKJ/tasks/mock/my/", "我的任务"], ["/MKJ/tasks/mock/create/", "发布小任务"], ["/MKJ/#account", "个人中心"]];
    const nav = node("nav", {}, links.map(([href, label]) => node("a", { href, text: label, ariaCurrent: window.location.pathname === new URL(href, location.origin).pathname ? "page" : undefined })));
    layout.append(node("aside", { class: "mock-sidebar" }, [node("div", { class: "mock-sidebar-title", text: "学生任务" }), nav]));
  }
  const main = node("section", { class: "mock-main" });
  layout.append(main);
  frame.append(topbar, layout, node("div", { class: "mock-status", data: { frameStatus: "" }, hidden: true }));
  root.replaceChildren(frame);
  return { frame, main };
}

function metricCard(label, value, trend, tooltip, href) {
  const card = node("article", { class: "mock-card mock-metric", tabIndex: 0, role: "link", on: { click: () => navigate(href), keydown: (event) => { if (event.key === "Enter") navigate(href); } } }, [
    node("span", { class: "mock-metric-label", text: label }),
    node("strong", { class: "mock-metric-value", text: value }),
    node("span", { class: `mock-trend${trend.startsWith("↓") ? " is-down" : ""}`, text: trend }),
    node("span", { class: "mock-tooltip", text: tooltip }),
  ]);
  return card;
}

function renderGroup(group, onDrop) {
  const statusLabel = { normal: "正常运行", due: "即将到期", archived: "已归档" }[group.status];
  const statusClass = { normal: "mock-status-normal", due: "mock-status-due", archived: "mock-status-archived" }[group.status];
  const bars = [42, 64, 52, 80, 60, 74, group.progress].map((height) => node("i", { style: `height:${Math.max(7, Math.round(height / 3))}px` }));
  const card = node("article", { class: "mock-card mock-group", draggable: true, dataset: { groupId: group.id }, on: { dragstart: (event) => event.dataTransfer.setData("text/plain", group.id), dragover: (event) => event.preventDefault(), drop: (event) => onDrop(event, group.id) } }, [
    node("div", { class: "mock-group-head" }, [node("h3", { text: group.name }), node("span", { class: `mock-status ${statusClass}`, text: statusLabel })]),
    node("div", { class: "mock-group-stats" }, [text(`${group.taskCount} 个子任务`), text(`${group.members} 人参与`)]),
    node("div", { class: "mock-progress", title: `完成 ${group.progress}%` }, [node("span", { style: `width:${group.progress}%` })]),
    node("div", { class: "mock-group-foot" }, [node("div", { class: "mock-mini-bars", ariaLabel: "近7天完成趋势" }, bars), node("small", { text: `完成 ${group.progress}%` })]),
    node("div", { class: "mock-action-row" }, [button("查看详情", () => navigate(`/MKJ/tasks/mock/?group=${group.id}`)), button("导出", () => downloadMockCsv(`${group.id}.csv`, [group], [{ key: "name", label: "任务组" }, { key: "taskCount", label: "子任务" }, { key: "members", label: "参与人数" }, { key: "progress", label: "完成率" }]), "mock-button mock-button-quiet")]),
  ]);
  return card;
}

function renderDashboard() {
  const { main } = mountFrame("工作台", "欢迎回来，今天有 8 项待处理事项。", true);
  const metrics = node("div", { class: "mock-metrics" }, [
    metricCard("进行中任务", "28", "↑ 12.5%", "近7天：22 → 28，持续上升", "/MKJ/tasks/mock/"),
    metricCard("已发布任务组", "06", "↑ 8.3%", "近7天：5 → 6，新增 1 组", "/MKJ/tasks/mock/"),
    metricCard("待批改提交", "13", "↓ 4.1%", "近7天：18 → 13，处理速度变快", "/MKJ/admin/tasks/mock/review/"),
    metricCard("待审核任务", "07", "↑ 16.7%", "近7天：6 → 7，需要关注", "/MKJ/admin/tasks/mock/review/"),
  ]);
  const groupSection = node("section", { class: "mock-section", id: "groups" }, [node("div", { class: "mock-section-head" }, [node("div", {}, [node("h2", { text: "任务组概览" }), node("p", { text: "拖动卡片可调整任务组排序。" })]), button("导出全部", () => downloadMockCsv("task-groups.csv", state.groups, [{ key: "name", label: "任务组" }, { key: "taskCount", label: "子任务" }, { key: "members", label: "参与人数" }, { key: "progress", label: "完成率" }]))]), node("div", { class: "mock-groups", dataset: { groups: "" } })]);
  const groupGrid = groupSection.querySelector("[data-groups]");
  const rerenderGroups = () => groupGrid.replaceChildren(...state.groups.map((group) => renderGroup(group, (event, targetId) => {
    const sourceId = event.dataTransfer.getData("text/plain");
    const from = state.groups.findIndex((group) => group.id === sourceId);
    const to = state.groups.findIndex((group) => group.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = state.groups.splice(from, 1);
    state.groups.splice(to, 0, moved);
    updateMockState((current) => ({ ...current, groups: state.groups }));
    rerenderGroups();
  })));
  rerenderGroups();

  const tableSection = node("section", { class: "mock-section" });
  const tableHead = node("div", { class: "mock-section-head" }, [node("div", {}, [node("h2", { text: "待批改提交" }), node("p", { text: "逾期待批改项目以橙色提醒。" })]), button("导出 CSV", () => downloadMockCsv("submissions.csv", state.submissions, [{ key: "student", label: "学生昵称" }, { key: "task", label: "任务名称" }, { key: "submittedAt", label: "提交时间" }, { key: "status", label: "任务状态" }]))]);
  const filters = node("div", { class: "mock-card mock-filterbar" });
  const timeFilter = select("time", [["all", "全部时间"], ["today", "今天"], ["week", "本周"]]);
  const groupFilter = select("group", [["all", "全部任务组"], ...state.groups.map((group) => [group.id, group.name])]);
  const statusFilter = select("status", [["all", "全部状态"], ["待批改", "待批改"], ["待审核", "待审核"]]);
  const columnsDialog = node("dialog", { class: "mock-modal", ariaLabel: "自定义表格列" }, [node("h2", { text: "显示列" })]);
  ["student|学生昵称", "task|任务名称", "submittedAt|提交时间", "status|任务状态", "action|操作"].forEach((item) => { const [key, label] = item.split("|"); columnsDialog.append(node("label", { class: "mock-checkbox" }, [node("input", { type: "checkbox", checked: true, dataset: { column: key } }), text(label)])); });
  columnsDialog.append(button("完成", () => columnsDialog.close(), "mock-button mock-button-primary"));
  document.body.append(columnsDialog);
  const tableTools = node("div", { class: "mock-table-tools" }, [node("div", { class: "mock-toolbar" }, [field("时间", timeFilter), field("任务组", groupFilter), field("状态", statusFilter)]), button("自定义列", () => columnsDialog.showModal())]);
  const selection = new Set();
  const tbody = node("tbody");
  const renderRows = () => {
    const filtered = state.submissions.filter((row) => (groupFilter.value === "all" || row.group === groupFilter.value) && (statusFilter.value === "all" || row.status === statusFilter.value));
    tbody.replaceChildren(...filtered.map((row) => {
      const checkbox = node("input", { type: "checkbox", checked: selection.has(row.id), on: { change: (event) => event.target.checked ? selection.add(row.id) : selection.delete(row.id) } });
      return node("tr", { class: row.overdue ? "is-overdue" : "", dataset: { rowId: row.id } }, [
        node("td", {}, [checkbox]), node("td", { text: row.student }), node("td", { text: row.task }), node("td", { text: row.submittedAt }), node("td", {}, [node("span", { class: `mock-chip ${row.overdue ? "mock-chip-orange" : ""}`, text: row.status })]), node("td", {}, [button("批改", () => navigate(`/MKJ/admin/tasks/mock/review/?id=${row.id}`), "mock-button mock-button-primary")]),
      ]);
    }));
  };
  [timeFilter, groupFilter, statusFilter].forEach((control) => control.addEventListener("change", renderRows));
  renderRows();
  const table = node("div", { class: "mock-card mock-table-wrap" }, [node("table", { class: "mock-table" }, [node("thead", {}, [node("tr", {}, [node("th", { text: "选择" }), node("th", { text: "学生昵称", dataset: { column: "student" } }), node("th", { text: "任务名称", dataset: { column: "task" } }), node("th", { text: "提交时间", dataset: { column: "submittedAt" } }), node("th", { text: "任务状态", dataset: { column: "status" } }), node("th", { text: "操作", dataset: { column: "action" } })])]), tbody])]);
  const batch = node("div", { class: "mock-toolbar", style: "margin-top:10px" }, [button("批量通过", () => bulkReview("已通过", "批量通过完成。")), button("批量打回修改", () => bulkReview("需修改", "已打回选中提交。"), "mock-button mock-button-danger")]);
  function bulkReview(nextStatus, message) { if (!selection.size) return showStatus(frameStatus, "请先选择提交。", "error"); updateMockState((current) => ({ ...current, submissions: current.submissions.map((row) => selection.has(row.id) ? { ...row, status: nextStatus } : row) })); selection.clear(); showStatus(frameStatus, message, "success"); renderRows(); }
  const frameStatus = main.parentElement.parentElement.querySelector("[data-frame-status]");
  tableSection.append(tableHead, tableTools, table, batch);
  const todo = node("aside", { class: "mock-todo" }, [node("div", { class: "mock-todo-panel" }, [button("收起", (event) => event.currentTarget.closest(".mock-todo").classList.toggle("is-collapsed"), "mock-button mock-button-quiet"), text("今日待办"), node("strong", { text: "8" }), node("small", { text: "3 条提交待批改 · 5 条任务待审核" })])]);
  main.append(metrics, groupSection, tableSection, todo);
}

function renderReview() {
  const data = loadMockState();
  const id = new URLSearchParams(location.search).get("id") || data.submissions[0]?.id;
  const submission = data.submissions.find((item) => item.id === id) || data.submissions[0];
  const { main } = mountFrame("任务批改", "核验提交质量，留下可执行的反馈。", true);
  const status = node("div", { class: "mock-status", hidden: true });
  const left = node("article", { class: "mock-card mock-panel" }, [
    node("div", { class: "mock-student" }, [node("span", { class: "mock-avatar", text: submission.student[0] }), node("div", {}, [node("strong", { text: submission.student }), node("small", { text: `${submission.history} 次历史任务记录` })])]),
    node("div", { class: "mock-section-head", style: "margin-top:22px" }, [node("div", {}, [node("h2", { text: submission.task }), node("p", { text: "技能实践 · 产品经理任务组" })]), node("span", { class: "mock-chip", text: submission.status })]),
    submission.overdue ? node("div", { class: "mock-timeout", text: `已超过截止时间：${submission.deadline}` }) : null,
    node("p", { class: "mock-review-body", text: submission.content }),
    node("div", { class: "mock-attachment" }, [node("span", { text: `附件 · ${submission.attachment}` }), button("在线预览", () => previewAttachment(submission.attachment))]),
    node("div", { class: "mock-action-row", style: "margin-top:18px" }, [button("查看学生历史任务", () => showHistory(submission)), button("返回列表", () => navigate("/MKJ/admin/tasks/mock/"), "mock-button mock-button-quiet")]),
  ]);
  const reviewForm = node("form", { class: "mock-card mock-panel" });
  const feedback = node("textarea", { name: "feedback", id: "mock-feedback", placeholder: "写下具体、可执行的批改建议…", required: true });
  const reputation = input("number", "reputation", "20"); reputation.min = "0"; reputation.max = "100";
  const template = select("template", [["", "选择常用评语"], ["clear", "结构清晰，建议继续保持"], ["detail", "完成度不错，再补充细节即可"], ["revise", "请根据修改建议补充后重新提交"]]);
  template.addEventListener("change", () => { if (template.value) feedback.value = template.options[template.selectedIndex].text; });
  const feedbackStatus = node("p", { class: "mock-flag", hidden: true });
  const rating = node("fieldset", { class: "mock-rating" }, [node("legend", { text: "评分" }), ...[["excellent", "优秀"], ["good", "良好"], ["pass", "合格"], ["improve", "待改进"]].map(([value, label], index) => node("label", {}, [node("input", { type: "radio", name: "rating", value, checked: index === 1 }), text(label)]))]);
  reviewForm.append(node("h2", { text: "批改反馈" }), field("常用评语", template), rating, field("批改建议", feedback), field("附加声望", reputation), feedbackStatus, node("div", { class: "mock-action-row" }, [button("通过", () => submitReview("已通过"), "mock-button mock-button-primary"), button("打回修改", () => submitReview("需修改"), "mock-button mock-button-danger")]));
  const logs = node("ul", { class: "mock-log" }, (data.reviewLogs || []).filter((log) => log.submissionId === submission.id).map((log) => node("li", { text: `${log.time} · ${log.actor} · ${log.action} · 声望 ${log.reputation}` })));
  reviewForm.append(node("h3", { text: "操作日志" }), logs);
  function submitReview(action) {
    if (action === "需修改" && !feedback.value.trim()) { showStatus(feedbackStatus, "打回修改必须填写修改原因。", "error"); return; }
    try {
      const guarded = guardFormData(reviewForm, ["feedback"], feedbackStatus);
      if (guarded.warnings.length) { showStatus(feedbackStatus, "评语包含敏感内容，请修改后再提交。", "error"); return; }
      confirmReview(action, () => {
        updateMockState((current) => ({ ...current, submissions: current.submissions.map((row) => row.id === submission.id ? { ...row, status: action } : row), reviewLogs: [...(current.reviewLogs || []), { submissionId: submission.id, actor: "当前管理员", action, reputation: reputation.value, time: new Date().toLocaleString("zh-CN") }] }));
        showStatus(status, `${action}操作已完成，操作日志已记录。`, "success");
        reviewForm.querySelectorAll("button").forEach((control) => { if (control.textContent === "通过" || control.textContent === "打回修改") control.disabled = true; });
      });
    } catch (error) { showStatus(feedbackStatus, error.message || "批改未完成，请稍后重试。", "error"); }
  }
  const confirm = node("dialog", { class: "mock-modal", ariaLabel: "确认批改" }, [node("h2", { text: "确认本次批改" }), node("p", { text: "提交后会记录管理员、时间、评分和声望，是否继续？" })]);
  const confirmButtons = node("div", { class: "mock-action-row" }, [button("取消", () => confirm.close()), button("确认提交", () => { confirm.close(); confirm._action?.(); }, "mock-button mock-button-primary")]);
  confirm.append(confirmButtons); document.body.append(confirm);
  function confirmReview(action, callback) { confirm.querySelector("h2").textContent = `确认${action}`; confirm._action = callback; confirm.showModal(); }
  const attachmentDialog = node("dialog", { class: "mock-modal", ariaLabel: "附件预览" }, [node("h2", { text: "附件在线预览" }), node("pre", { class: "mock-preview", text: "这是 mock 文档预览区域。后续接入文件服务后可在此展示文档或表格内容。" }), button("关闭", () => attachmentDialog.close())]);
  document.body.append(attachmentDialog);
  function previewAttachment(name) { attachmentDialog.querySelector("h2").textContent = `${name} · 在线预览`; attachmentDialog.showModal(); }
  function showHistory(item) { showStatus(status, `${item.student} 的历史任务已加载：共 ${item.history} 条记录。`, "info"); }
  main.append(status, node("div", { class: "mock-detail-grid" }, [left, reviewForm]));
}

function renderMarket() {
  const { main } = mountFrame("任务广场", "发现适合你的公开任务，完成后获得声望。", false);
  const hero = node("div", { class: "mock-hero" }, [node("div", {}, [node("h1", { text: "找到下一件值得完成的事" }), node("p", { text: "浏览公开任务，按你的节奏参与协作。" })]), node("div", { class: "mock-segmented" }, [button("管理员", () => navigate("/MKJ/admin/tasks/mock/")), button("学生", () => navigate("/MKJ/tasks/mock/") , "mock-button mock-button-primary")])]);
  const filter = node("div", { class: "mock-card mock-filterbar" });
  const search = input("search", "query", "", "搜索任务名称或技能标签");
  const category = select("category", [["all", "全部分类"], ["学习经验", "学习经验"], ["技能教学", "技能教学"], ["实习求职", "实习求职"], ["兴趣特长", "兴趣特长"]]);
  const difficulty = select("difficulty", [["all", "全部难度"], ["入门", "入门"], ["中等", "中等"], ["进阶", "进阶"]]);
  const duration = select("duration", [["all", "全部周期"], ["1-3天", "1-3天"], ["一周以内", "一周以内"], ["长期互助", "长期互助"]]);
  const reward = select("reward", [["all", "全部声望"], ["20", "20+ 声望"], ["35", "35+ 声望"], ["50", "50+ 声望"]]);
  [field("搜索", search, "mock-field is-wide"), field("分类", category), field("难度", difficulty), field("周期", duration), field("声望奖励", reward)].forEach((control) => filter.append(control));
  const grid = node("div", { class: "mock-task-grid", style: "margin-top:18px" });
  const render = () => {
    const current = loadMockState();
    const rows = current.tasks.filter((task) => task.status === "published" && (category.value === "all" || task.category === category.value) && (difficulty.value === "all" || task.difficulty === difficulty.value) && (duration.value === "all" || task.duration === duration.value) && (reward.value === "all" || task.reward >= Number(reward.value)) && `${task.title} ${task.summary} ${task.category}`.toLowerCase().includes(search.value.trim().toLowerCase()));
    grid.replaceChildren(...rows.map((task) => {
      const favorite = button(task.favorite ? "已收藏" : "收藏", () => {
        updateMockState((current) => ({
          ...current,
          tasks: current.tasks.map((item) => item.id === task.id ? { ...item, favorite: !item.favorite } : item),
          favorites: current.favorites.includes(task.id) ? current.favorites.filter((id) => id !== task.id) : [...current.favorites, task.id],
        }));
        render();
      }, "mock-button mock-button-quiet");
      const card = node("article", { class: "mock-card mock-task-card", on: { click: (event) => { if (!event.target.closest("button")) openTask(task); } } }, [
        node("div", { class: "mock-task-meta" }, [node("span", { class: "mock-chip", text: task.category }), node("span", { class: "mock-chip", text: task.difficulty }), node("span", { class: "mock-chip", text: task.duration })]),
        node("h3", { text: task.title }),
        node("p", { text: task.summary }),
        node("div", { class: "mock-student" }, [node("span", { class: "mock-avatar", text: task.owner[0] }), node("small", { text: `发布人 · ${task.owner}` })]),
        node("div", { class: "mock-task-foot" }, [node("strong", { class: "mock-reward", text: `+${task.reward} 声望` }), favorite]),
      ]);
      return card;
    }));
  };
  [search, category, difficulty, duration, reward].forEach((control) => control.addEventListener("input", render));
  [category, difficulty, duration, reward].forEach((control) => control.addEventListener("change", render));
  const modal = node("dialog", { class: "mock-modal", ariaLabel: "任务详情" }); document.body.append(modal);
  function openTask(task) {
    const confirmApplication = () => {
      updateMockState((current) => ({ ...current, applications: [...(current.applications || []), { taskId: task.id, status: "doing" }] }));
      modal.replaceChildren(node("h2", { text: "申请已提交" }), node("p", { text: "等待任务发布人确认后，你可以在“我的任务”中继续跟进。" }), button("知道了", () => modal.close(), "mock-button mock-button-primary"));
    };
    modal.replaceChildren(
      node("h2", { text: task.title }),
      node("p", { text: task.summary }),
      node("p", { class: "mock-muted", text: `分类：${task.category} · 难度：${task.difficulty} · 周期：${task.duration}` }),
      node("strong", { class: "mock-reward", text: `完成后获得 ${task.reward} 声望` }),
      node("div", { class: "mock-action-row" }, [button("关闭", () => modal.close()), button("申请接取", confirmApplication, "mock-button mock-button-primary")]),
    );
    modal.showModal();
  }
  main.append(hero, node("section", { class: "mock-section" }, [filter, grid])); render();
}

function renderCreate() {
  const { main } = mountFrame("发布小任务", "把你的经验变成一件值得完成的小事。", false);
  const form = node("form", { class: "mock-card mock-panel", id: "mock-create-form" });
  const status = node("p", { class: "mock-flag", hidden: true });
  const title = input("text", "title", "", "例如：一起练习产品面试自我介绍");
  const description = node("textarea", { name: "description", id: "mock-description", placeholder: "说明任务目标、交付方式与参与要求…" });
  const categoryButtons = node("div", { class: "mock-segmented" });
  let activeCategory = "学习经验";
  [["学习经验", "学习经验"], ["技能教学", "技能教学"], ["实习求职", "实习求职"], ["兴趣特长", "兴趣特长"]].forEach(([value, label]) => categoryButtons.append(button(label, () => { activeCategory = value; categoryButtons.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item.textContent === value)); }, `mock-button${value === activeCategory ? " mock-button-primary" : ""}`)));
  const duration = select("duration", [["1-3天", "1-3天"], ["一周以内", "一周以内"], ["长期互助", "长期互助"]]);
  const difficulty = select("difficulty", [["入门", "入门"], ["中等", "中等"], ["进阶", "进阶"]]);
  const file = node("input", { type: "file", name: "attachment", id: "mock-attachment", accept: ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg" });
  const preview = node("div", { class: "mock-preview", hidden: true });
  const fieldStatus = node("p", { class: "mock-flag", hidden: true });
  const validateLive = (control) => {
    try { const checked = guardFormData(form, [control.name], fieldStatus); if (checked.warnings.length) { showStatus(fieldStatus, "检测到敏感内容，已禁止继续提交，请修改后再试。", "error"); control.dataset.invalid = "true"; } else { delete control.dataset.invalid; if (fieldStatus.textContent.includes("禁止")) showStatus(fieldStatus, "", "info"); } } catch (error) { showStatus(fieldStatus, error.message, "error"); control.dataset.invalid = "true"; }
  };
  [title, description].forEach((control) => control.addEventListener("input", () => { validateLive(control); saveDraft({ title: title.value, description: description.value, category: activeCategory, duration: duration.value, difficulty: difficulty.value }); }));
  const saved = loadDraft(); if (saved) { title.value = saved.title || ""; description.value = saved.description || ""; activeCategory = saved.category || activeCategory; duration.value = saved.duration || duration.value; difficulty.value = saved.difficulty || difficulty.value; }
  function showPreview() { preview.replaceChildren(node("strong", { text: title.value.trim() || "未填写任务名称" }), node("p", { text: description.value.trim() || "未填写任务描述" }), node("div", { class: "mock-task-meta" }, [node("span", { class: "mock-chip", text: activeCategory }), node("span", { class: "mock-chip", text: difficulty.value }), node("span", { class: "mock-chip", text: duration.value })])); preview.hidden = false; }
  form.append(node("div", { class: "mock-form-grid" }, [field("任务名称", title, "mock-field is-wide"), node("div", { class: "mock-field is-wide" }, [node("span", { class: "mock-muted", text: "技能分类" }), categoryButtons]), field("任务描述", description, "mock-field is-wide"), field("预期周期", duration), field("任务难度", difficulty), field("配套附件", file), field("敏感词检测", fieldStatus, "mock-field is-wide")]), node("div", { class: "mock-action-row", style: "margin-top:18px" }, [button("预览任务", showPreview), button("提交审核（通过后+20声望）", () => submit(), "mock-button mock-button-primary")]), preview, status, node("div", { class: "mock-notice", style: "margin-top:18px", text: "发布须知：请把任务目标和交付标准说明白。提交后会进入管理员审核，预计 1 个工作日内反馈。" }));
  function submit() { try { const guarded = guardFormData(form, ["title", "description"], status); if (guarded.warnings.length || title.dataset.invalid || description.dataset.invalid) throw new Error("任务名称或描述包含敏感内容，请修改后再提交。"); if (!title.value.trim() || !description.value.trim()) throw new Error("请填写任务名称和任务描述。"); updateMockState((current) => ({ ...current, tasks: [...current.tasks, { id: `task-${Date.now()}`, title: title.value.trim(), summary: description.value.trim(), category: activeCategory, difficulty: difficulty.value, duration: duration.value, reward: 20, group: "general", owner: "我", status: "pending", favorite: false }], myPublished: [...(current.myPublished || []), { title: title.value.trim(), status: "待审核", category: activeCategory }] })); clearDraft(); showStatus(status, "提交成功：等待管理员审核，预计 1 个工作日内反馈。", "success"); form.querySelectorAll("input,textarea,select,button").forEach((control) => { if (control.type !== "button") control.disabled = true; }); } catch (error) { showStatus(status, error.message || "提交失败，请稍后重试。", "error"); } }
  main.append(node("div", { class: "mock-hero" }, [node("div", {}, [node("h1", { text: "发布一个小任务" }), node("p", { text: "通过审核后，完成者可获得声望奖励。" })]), node("div", { class: "mock-segmented" }, [button("管理员", () => navigate("/MKJ/admin/tasks/mock/")), button("学生", () => navigate("/MKJ/tasks/mock/create/"), "mock-button mock-button-primary")])]), node("section", { class: "mock-section" }, [form]));
}

function renderMy() {
  const { main } = mountFrame("我的任务", "查看发布进度与正在完成的任务。", false);
  const tabs = node("div", { class: "mock-tabs" });
  const content = node("div");
  const renderTab = (tab) => { tabs.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item.dataset.tab === tab)); content.replaceChildren(); const current = loadMockState(); const rows = tab === "published" ? (current.myPublished || [{ title: "还没有发布过任务", status: "开始发布你的第一个小任务吧", category: "" }]) : (current.applications || []).map((item) => ({ title: current.tasks.find((task) => task.id === item.taskId)?.title || "任务", status: item.status === "doing" ? "正在做" : "已完成", category: "我的接取" })); content.append(node("div", { class: "mock-task-grid" }, rows.map((row) => node("article", { class: "mock-card mock-task-card" }, [node("div", { class: "mock-task-meta" }, [node("span", { class: "mock-chip", text: row.category || "任务" }), node("span", { class: "mock-chip", text: row.status })]), node("h3", { text: row.title }), node("p", { text: tab === "published" ? "审核通过后会出现在任务广场。" : "可上传附件并填写完成说明提交给管理员批改。" }), tab === "accepted" ? button("提交作业", () => showStatus(main.querySelector("[data-my-status]"), "提交作业入口已打开，mock 阶段仅保存本地状态。", "info"), "mock-button mock-button-primary") : button(row.status === "审核驳回" ? "编辑重新提交" : "查看进度", () => showStatus(main.querySelector("[data-my-status]"), "状态已同步到本地 mock 数据。", "info"))])))); };
  [["published", "我发布的任务"], ["accepted", "我接取的任务"]].forEach(([tab, label]) => tabs.append(button(label, () => renderTab(tab), `mock-button${tab === "published" ? " is-active" : ""}`))); tabs.querySelectorAll("button").forEach((item, index) => { item.dataset.tab = index === 0 ? "published" : "accepted"; });
  main.append(node("div", { class: "mock-hero" }, [node("div", {}, [node("h1", { text: "我的任务" }), node("p", { text: "发布、接取、提交，一处跟进。" })]), button("发布小任务", () => navigate("/MKJ/tasks/mock/create/"), "mock-button mock-button-primary")]), node("section", { class: "mock-section" }, [tabs, content, node("p", { class: "mock-status", data: { myStatus: "" }, hidden: true })])); renderTab("published");
}

async function boot() {
  if (!root || !(await enforceRole())) return;
  if (page === "admin-dashboard") renderDashboard();
  else if (page === "admin-review") renderReview();
  else if (page === "student-market") renderMarket();
  else if (page === "student-create") renderCreate();
  else if (page === "student-my") renderMy();
}

boot();
