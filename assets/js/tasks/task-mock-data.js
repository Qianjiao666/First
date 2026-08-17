const STORE_KEY = "mkj.task-management-mock.v1";
const DRAFT_KEY = "mkj.task-management-mock.draft.v1";

const initialState = Object.freeze({
  groups: [
    { id: "product", name: "产品经理", status: "normal", taskCount: 12, members: 46, progress: 74 },
    { id: "engineering", name: "技术研发", status: "due", taskCount: 18, members: 63, progress: 58 },
    { id: "general", name: "通用任务", status: "archived", taskCount: 8, members: 27, progress: 100 },
  ],
  tasks: [
    { id: "task-01", title: "整理产品调研访谈纪要", category: "学习经验", difficulty: "入门", duration: "1-3天", reward: 20, group: "product", owner: "林晓", summary: "把三份用户访谈整理成结构化结论与关键机会点。", status: "published", favorite: false },
    { id: "task-02", title: "制作个人简历排版检查清单", category: "实习求职", difficulty: "中等", duration: "一周以内", reward: 35, group: "general", owner: "陈晨", summary: "为投递前的简历准备一份可复用的视觉与内容检查清单。", status: "published", favorite: true },
    { id: "task-03", title: "搭建前端组件使用示例", category: "技能教学", difficulty: "进阶", duration: "长期互助", reward: 50, group: "engineering", owner: "许墨", summary: "补充基础组件的使用样例，并完成简短说明文档。", status: "published", favorite: false },
  ],
  submissions: [
    { id: "sub-01", student: "赵一鸣", task: "整理产品调研访谈纪要", group: "product", submittedAt: "今天 09:30", status: "待批改", overdue: true, content: "已按访谈主题归纳问题，整理出需求、动机与高频痛点，并附上重点引语。", attachment: "访谈纪要.xlsx", deadline: "2026-08-16 18:00", history: 6 },
    { id: "sub-02", student: "王乐", task: "制作个人简历排版检查清单", group: "general", submittedAt: "昨天 16:20", status: "待批改", overdue: false, content: "我把排版、信息层级、经历描述和投递前检查拆分成四个部分。", attachment: "简历检查清单.docx", deadline: "2026-08-19 18:00", history: 3 },
    { id: "sub-03", student: "周可", task: "搭建前端组件使用示例", group: "engineering", submittedAt: "2026-08-15 14:05", status: "待审核", overdue: true, content: "补充了按钮、输入框和提示组件的多种状态示例。", attachment: "组件说明.pdf", deadline: "2026-08-15 18:00", history: 4 },
  ],
  reviewLogs: [],
  favorites: ["task-02"],
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadMockState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return parsed && Array.isArray(parsed.tasks) ? parsed : clone(initialState);
  } catch {
    return clone(initialState);
  }
}

export function saveMockState(next) {
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
  return next;
}

export function updateMockState(updater) {
  const state = loadMockState();
  const next = updater(state) || state;
  return saveMockState(next);
}

export function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}

export function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function mockCsv(rows, columns) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.map((column) => escape(column.label)).join(","), ...rows.map((row) => columns.map((column) => escape(row[column.key])).join(","))].join("\n");
}

export function downloadMockCsv(name, rows, columns) {
  const blob = new Blob(["\ufeff", mockCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
