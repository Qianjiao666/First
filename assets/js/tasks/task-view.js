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
