const STATUS_LABELS = Object.freeze({
  pending: "待受理",
  accepted: "进行中",
  rejected: "未通过",
  submitted: "待核验",
  completed: "已完成",
  cancelled: "已取消",
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
  archived: "已归档",
});

const FILTER_STATUS = new Set(["", "open", "closing_soon", "in_progress", "completed"]);
const FILTER_REWARD = new Set(["", "low", "medium", "high"]);
const FILTER_DEADLINE = new Set(["", "this_week", "this_month", "none"]);

export function buildTaskListFilters(formState = {}) {
  const status = FILTER_STATUS.has(String(formState.status ?? "")) ? String(formState.status ?? "") : "";
  const rewardRange = FILTER_REWARD.has(String(formState.rewardRange ?? "")) ? String(formState.rewardRange ?? "") : "";
  const deadlineWindow = FILTER_DEADLINE.has(String(formState.deadlineWindow ?? "")) ? String(formState.deadlineWindow ?? "") : "";
  return {
    query: String(formState.query ?? "").trim(),
    category: String(formState.category ?? ""),
    sort: String(formState.sort ?? "published_at.desc"),
    page: Number.isFinite(Number(formState.page)) ? Number(formState.page) : 1,
    status,
    rewardRange,
    deadlineWindow,
    skillTags: Array.isArray(formState.skillTags)
      ? formState.skillTags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
  };
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? "状态未知";
}

export function getApplicationGroup(status) {
  if (status === "submitted") return "submitted";
  if (status === "completed") return "completed";
  if (["pending", "accepted"].includes(status)) return "active";
  return "closed";
}

export function formatTaskDeadline(value) {
  if (!value) return "未设置截止时间";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "截止时间待确认";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function toTaskListingModel(task = {}) {
  return {
    id: String(task.id ?? ""),
    title: String(task.title ?? "未命名任务"),
    summary: String(task.summary ?? "暂未提供任务摘要。"),
    categoryName: String(task.category?.name ?? task.category_name ?? "未分类"),
    tags: Array.isArray(task.skill_tags) ? task.skill_tags.map(String).filter(Boolean) : [],
    reward: Number.isFinite(Number(task.reward_points)) ? Number(task.reward_points) : 0,
    deadline: task.deadline_at ?? null,
  };
}

export function normalizeTaskTimeline(events) {
  if (!Array.isArray(events)) return [];
  return events
    .map((event, index) => ({
      id: String(event?.id ?? index),
      type: String(event?.event_type ?? event?.type ?? "updated"),
      at: event?.created_at ?? event?.occurred_at ?? event?.at ?? null,
      actor: String(event?.actor_name ?? event?.actor_display_name ?? event?.actor_id ?? ""),
      note: String(event?.note ?? event?.metadata?.note ?? ""),
    }))
    .sort((left, right) => String(left.at ?? "").localeCompare(String(right.at ?? "")));
}

export function taskTimelineLabel(type) {
  const labels = {
    created: "创建任务",
    updated: "更新任务",
    published: "发布任务",
    applied: "提交申请",
    assigned: "分配任务",
    rejected: "拒绝申请",
    submitted: "提交完成说明",
    completed: "核验完成",
    cancelled: "取消领取",
    arbitrated: "管理员仲裁",
  };
  return labels[type] ?? "任务状态更新";
}

function hasCapability(capabilities, marker) {
  return Array.isArray(capabilities) && capabilities.some((capability) => {
    const value = String(capability);
    return value === marker || value === marker.replace(/^task:/, "tasks:");
  });
}

export function taskCollaborationStage(record = {}) {
  const status = String(record.application_status ?? record.status ?? "");
  if (status === "published") return "可申请";
  if (status === "accepted") return "进行中";
  if (status === "submitted") return "待核验";
  if (status === "completed") return "已完成";
  if (status === "closed") return "已关闭";
  if (status === "cancelled") return "已取消";
  if (status === "rejected") return "未通过";
  if (status === "draft") return "草稿";
  return statusLabel(status);
}

export function canSupplementApplication(application = {}) {
  return String(application.status ?? "") === "submitted";
}

export function taskNextAction(record = {}, actor = "visitor", capabilities = []) {
  const status = String(record.application_status ?? record.status ?? "");
  if (actor === "visitor") return { key: "login", label: "登录后申请", tone: "secondary", disabledReason: "" };
  if (actor === "applicant" && status === "accepted" && hasCapability(capabilities, "task:submit")) {
    return { key: "submit", label: "提交交付", tone: "primary", disabledReason: "" };
  }
  if (actor === "applicant" && status === "submitted" && hasCapability(capabilities, "task:submit")) {
    return { key: "supplement", label: "补充交付", tone: "secondary", disabledReason: "" };
  }
  if (actor === "admin" && status === "submitted" && hasCapability(capabilities, "task:manage")) {
    return { key: "review", label: "核验交付", tone: "primary", disabledReason: "" };
  }
  if (status === "published") return { key: "apply", label: "申请任务", tone: "primary", disabledReason: "" };
  return { key: "wait", label: "等待下一步", tone: "muted", disabledReason: "" };
}

export function toActivitySummary(event = {}, attachments = []) {
  return {
    id: String(event.id ?? event.type ?? event.event_type ?? "activity"),
    label: taskTimelineLabel(event.type ?? event.event_type),
    actor: String(event.actor ?? event.actor_name ?? event.actor_display_name ?? "").trim() || "系统记录",
    at: event.at ?? event.created_at ?? event.occurred_at ?? null,
    note: String(event.note ?? event.metadata?.note ?? "").trim(),
    attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
  };
}
