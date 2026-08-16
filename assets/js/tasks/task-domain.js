export const APPLICATION_STATUS = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  SUBMITTED: "submitted",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const APPLICATION_TRANSITIONS = Object.freeze({
  admin: Object.freeze({
    [APPLICATION_STATUS.PENDING]: [APPLICATION_STATUS.ACCEPTED, APPLICATION_STATUS.REJECTED],
    [APPLICATION_STATUS.SUBMITTED]: [APPLICATION_STATUS.COMPLETED],
  }),
  applicant: Object.freeze({
    [APPLICATION_STATUS.ACCEPTED]: [APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.CANCELLED],
  }),
});

export function buildTaskDetailUrl(taskId) {
  return `/MKJ/tasks/detail/?id=${encodeURIComponent(String(taskId))}`;
}

export function parseTaskId(search) {
  const taskId = new URLSearchParams(search).get("id");
  return taskId && UUID_PATTERN.test(taskId) ? taskId : null;
}

export function canTransitionApplication(from, to, actor) {
  return APPLICATION_TRANSITIONS[actor]?.[from]?.includes(to) ?? false;
}

export function taskActionForApplication(status, actor) {
  if (actor === "applicant" && status === APPLICATION_STATUS.ACCEPTED) {
    return "submit";
  }

  if (actor === "admin" && status === APPLICATION_STATUS.SUBMITTED) {
    return "complete";
  }

  return null;
}

export function hasTaskManageCapability(capabilities) {
  return hasTaskCapability(capabilities, "manage");
}

export function hasTaskCapability(capabilities, action) {
  const markers = [`task:${String(action)}`, `tasks:${String(action)}`];
  if (Array.isArray(capabilities)) return markers.some((marker) => capabilities.includes(marker));
  return Boolean(
    capabilities
      && typeof capabilities === "object"
      && markers.some((marker) => capabilities[marker] === true),
  );
}

export function buildTaskCompletionPayload({ applicationId, note, attachments = [] } = {}) {
  return {
    applicationId: String(applicationId ?? "").trim(),
    submissionNote: String(note ?? "").trim(),
    attachments: Array.isArray(attachments) ? attachments : [],
  };
}

export function buildTaskArbitrationPayload(taskId, decision, reason = "") {
  return {
    taskId: String(taskId ?? "").trim(),
    decision: String(decision ?? "").trim(),
    reason: String(reason ?? "").trim(),
  };
}

export function toCollaborativeTaskModel(task = {}) {
  const isCollaboration = task.task_mode === "collaboration";
  return { isCollaboration, taskType: isCollaboration ? "collaboration" : "individual" };
}
