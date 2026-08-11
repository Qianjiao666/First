function requireTransport(name, transport) {
  if (typeof transport !== "function") {
    throw new TypeError(`${name} transport is required`);
  }

  return transport;
}

export function createTaskApi({ queryTasks, invokeTaskFunction, uploadTaskAttachment }) {
  const query = requireTransport("queryTasks", queryTasks);
  const invoke = requireTransport("invokeTaskFunction", invokeTaskFunction);
  const upload = typeof uploadTaskAttachment === "function"
    ? uploadTaskAttachment
    : async () => { throw new Error("Task attachment storage is unavailable"); };

  const unwrap = async (request) => {
    const result = await invoke(request);
    if (!result || typeof result !== "object" || Array.isArray(result) || !("data" in result)) {
      return result ?? {};
    }
    const data = result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data
      : { data: result.data };
    return {
      ...data,
      ...(Array.isArray(result.warnings) ? { warnings: result.warnings } : {}),
    };
  };

  const invokeAdmin = (action, body) => unwrap({
    functionName: "task-admin",
    action,
    body,
  });

  const invokeCompletion = (action, body) => unwrap({
    functionName: "task-complete",
    action,
    body,
  });

  const invokeAttachments = (action, body) => unwrap({
    functionName: "task-attachments",
    action,
    body,
  });

  return Object.freeze({
    listPublished: (filters = {}) => query({ scope: "published", filters }),
    getDetail: (taskId) => query({ scope: "detail", taskId }),
    getMine: () => query({ scope: "mine" }),
    getAdminTasks: (filters = {}) => query({ scope: "admin", filters }),
    getAdminTask: (taskId) => query({ scope: "adminDetail", taskId }),
    getApplications: (taskId) => query({ scope: "applications", taskId }),
    getTimeline: (taskId) => query({ scope: "activity", taskId }),
    getActivity: (taskId) => query({ scope: "activity", taskId }),
    getAttachments: (taskId) => query({ scope: "attachments", taskId }),
    uploadAttachment: (request) => upload(request),
    apply: (taskId, applicationNote) => invokeCompletion("apply", {
      taskId,
      applicationNote,
    }),
    submit: (applicationId, submissionNote, attachments = [], completionNote = "") => invokeCompletion("submit", {
      applicationId,
      submissionNote,
      ...(completionNote ? { completionNote } : {}),
      ...(Array.isArray(attachments) && attachments.length ? { attachments } : {}),
    }),
    complete: (applicationId, review = null, completionNote = "", attachments = []) => invokeCompletion("complete", {
      applicationId,
      review,
      ...(completionNote ? { completionNote } : {}),
      ...(Array.isArray(attachments) && attachments.length ? { attachments } : {}),
    }),
    attach: (applicationId, attachments = []) => invokeCompletion("attach", {
      applicationId,
      attachments,
    }),
    registerTaskAttachments: async (taskId, attachments = []) => {
      const registered = [];
      const warnings = [];
      for (const attachment of attachments) {
        const result = await invokeAttachments("register", {
          taskId,
          attachmentKind: "task",
          objectPath: attachment.path ?? attachment.objectPath,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size ?? attachment.sizeBytes,
          caption: attachment.caption ?? "",
        });
        registered.push(result.attachmentId);
        if (Array.isArray(result.warnings)) warnings.push(...result.warnings);
      }
      return { attachmentIds: registered, warnings };
    },
    saveTask: (payload) => invokeAdmin(payload.id ? "update" : "create", payload),
    createTask: (payload) => invokeAdmin("create", payload),
    updateTask: (payload) => invokeAdmin("update", payload),
    publish: (taskId) => invokeAdmin("publish", { taskId }),
    close: (taskId) => invokeAdmin("close", { taskId }),
    archive: (taskId) => invokeAdmin("archive", { taskId }),
    remove: (taskId) => invokeAdmin("delete", { taskId }),
    assign: (applicationId) => invokeAdmin("assign", { applicationId }),
    reject: (applicationId) => invokeAdmin("reject", { applicationId }),
    arbitrate: (taskId, decision, reason = "") => invokeAdmin("arbitrate", {
      taskId,
      decision,
      reason,
    }),
    forceComplete: (taskId, reason = "", options = {}) => invokeAdmin("arbitrate", {
      taskId,
      decision: "force_complete",
      reason,
      ...options,
    }),
    cancelRefund: (taskId, reason = "") => invokeAdmin("arbitrate", {
      taskId,
      decision: "cancel_refund",
      reason,
    }),
    deductReputation: (taskId, amount, reason = "", options = {}) => invokeAdmin("arbitrate", {
      taskId,
      decision: "deduct_reputation",
      amount,
      reason,
      ...options,
    }),
    cancel: (applicationId) => invokeCompletion("cancel", { applicationId }),
    listCategories: () => query({ scope: "categories" }),
    saveCategory: (payload) => invokeAdmin("manageCategories", payload),
  });
}
