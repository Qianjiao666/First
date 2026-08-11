export class TaskIntegrationUnavailableError extends Error {
  constructor() {
    super("任务服务尚未接入共享基础设施");
    this.name = "TaskIntegrationUnavailableError";
    this.code = "TASK_INTEGRATION_UNAVAILABLE";
  }
}

function unavailable() {
  return Promise.reject(new TaskIntegrationUnavailableError());
}

function unavailableAttachment() {
  return Promise.reject(new TaskIntegrationUnavailableError());
}

function isIntegrationReady(integration) {
  return Boolean(
    integration
      && typeof integration.queryTasks === "function"
      && typeof integration.invokeTaskFunction === "function"
      && typeof integration.getCurrentUser === "function",
  );
}

export function resolveTaskRuntime(host = globalThis) {
  const integration = host.MKJ_TASK_INTEGRATION;

  if (!isIntegrationReady(integration)) {
    return Object.freeze({
      ready: false,
      queryTasks: unavailable,
      invokeTaskFunction: unavailable,
      uploadTaskAttachment: unavailableAttachment,
      getCurrentUser: async () => null,
      getCapabilities: async () => [],
    });
  }

  return Object.freeze({
    ready: true,
    queryTasks: (request) => integration.queryTasks(request),
    invokeTaskFunction: (request) => integration.invokeTaskFunction(request),
    uploadTaskAttachment: (request) => integration.uploadTaskAttachment?.(request) ?? unavailableAttachment(),
    getCurrentUser: () => integration.getCurrentUser(),
    getCapabilities: () => integration.getCapabilities?.() ?? Promise.resolve([]),
  });
}
