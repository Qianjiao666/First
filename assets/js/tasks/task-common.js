import { renderReputationBadge } from "../core/reputation.js";
import { createTaskApi } from "./task-api.js";
import { TaskIntegrationUnavailableError, resolveTaskRuntime } from "./task-runtime.js";

export function createTaskServices(host = window) {
  const runtime = resolveTaskRuntime(host);
  const api = createTaskApi({
    queryTasks: (request) => runtime.queryTasks(request),
    invokeTaskFunction: (request) => runtime.invokeTaskFunction(request),
    uploadTaskAttachment: (request) => runtime.uploadTaskAttachment(request),
  });

  return { api, runtime };
}

export async function mountTaskChrome(runtime, documentRef = document) {
  await runtime.waitForSession?.();
  const slots = documentRef.querySelectorAll("[data-task-reputation-badge]");
  const user = await runtime.getCurrentUser();

  for (const slot of slots) {
    if (!user) {
      slot.textContent = runtime.ready ? "登录后查看账户状态" : "账户服务待接入";
      continue;
    }

    renderReputationBadge(slot, {
      userId: user.userId ?? user.id,
      reputation: user.reputation,
      role: user.role,
      compact: true,
    });
  }

  return user;
}

export function requireAuthenticatedAction(runtime, reason) {
  return runtime.requireAuthenticatedAction({ reason });
}

export function showTaskMessage(node, message, tone = "info") {
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
  node.hidden = !message;
}

export function taskErrorMessage(error, fallback = "任务服务暂时不可用，请稍后重试。") {
  if (error instanceof TaskIntegrationUnavailableError) {
    return "任务服务正在接入，请稍后刷新页面。";
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

export function createTag(text, documentRef = document) {
  const item = documentRef.createElement("li");
  item.textContent = text;
  return item;
}

export function asItems(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.items) ? result.items : [];
}
