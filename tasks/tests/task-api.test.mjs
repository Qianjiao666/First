import assert from "node:assert/strict";
import test from "node:test";

import { createTaskApi } from "../../assets/js/tasks/task-api.js";

test("published task reads use the public task query transport", async () => {
  const calls = [];
  const api = createTaskApi({
    queryTasks: async (request) => {
      calls.push(request);
      return { items: [], total: 0 };
    },
    invokeTaskFunction: async () => {
      throw new Error("write transport must not be used for a public list");
    },
  });

  const result = await api.listPublished({ category: "career", page: 2 });

  assert.deepEqual(result, { items: [], total: 0 });
  assert.deepEqual(calls, [{ scope: "published", filters: { category: "career", page: 2 } }]);
});

test("application writes target the task-complete edge function", async () => {
  const calls = [];
  const api = createTaskApi({
    queryTasks: async () => ({ items: [], total: 0 }),
    invokeTaskFunction: async (request) => {
      calls.push(request);
      return { applicationId: "application-1", status: "pending" };
    },
  });

  await api.apply("task-1", "I can deliver the research summary.");

  assert.deepEqual(calls, [{
    functionName: "task-complete",
    action: "apply",
    body: { taskId: "task-1", applicationNote: "I can deliver the research summary." },
  }]);
});

test("admin task saves target the task-admin edge function", async () => {
  const calls = [];
  const api = createTaskApi({
    queryTasks: async () => ({ items: [], total: 0 }),
    invokeTaskFunction: async (request) => {
      calls.push(request);
      return { taskId: "task-1", status: "draft" };
    },
  });

  await api.saveTask({ title: "Prepare a workshop", status: "draft" });

  assert.deepEqual(calls, [{
    functionName: "task-admin",
    action: "create",
    body: { title: "Prepare a workshop", status: "draft" },
  }]);
});

test("admin task saves expose edge warnings without hiding task data", async () => {
  const api = createTaskApi({
    queryTasks: async () => ({ items: [] }),
    invokeTaskFunction: async () => ({
      data: { taskId: "task-1" },
      warnings: ["matched-content"],
    }),
  });

  assert.deepEqual(await api.saveTask({ title: "Draft" }), {
    taskId: "task-1",
    warnings: ["matched-content"],
  });
});

test("application rejection and cancellation use their approved edge functions", async () => {
  const calls = [];
  const api = createTaskApi({
    queryTasks: async () => ({ items: [] }),
    invokeTaskFunction: async (request) => {
      calls.push(request);
      return { data: { applicationId: "application-1" } };
    },
  });

  await api.reject("application-1");
  await api.cancel("application-1");

  assert.deepEqual(calls, [
    { functionName: "task-admin", action: "reject", body: { applicationId: "application-1" } },
    { functionName: "task-complete", action: "cancel", body: { applicationId: "application-1" } },
  ]);
});

test("supplement attachment writes include the guarded supplement note", async () => {
  const calls = [];
  const api = createTaskApi({
    queryTasks: async () => ({ items: [] }),
    invokeTaskFunction: async (request) => {
      calls.push(request);
      return { data: { attachmentIds: ["attachment-1"] } };
    },
  });

  await api.attach("application-1", [{ id: "attachment-1" }], "补充了交付说明。");

  assert.deepEqual(calls, [{
    functionName: "task-complete",
    action: "attach",
    body: {
      applicationId: "application-1",
      attachments: [{ id: "attachment-1" }],
      supplementNote: "补充了交付说明。",
    },
  }]);
});

test("empty supplement notes are omitted from attach writes", async () => {
  const calls = [];
  const api = createTaskApi({
    queryTasks: async () => ({ items: [] }),
    invokeTaskFunction: async (request) => {
      calls.push(request);
      return { data: { attachmentIds: [] } };
    },
  });

  await api.attach("application-1", [], "   ");

  assert.deepEqual(calls, [{
    functionName: "task-complete",
    action: "attach",
    body: {
      applicationId: "application-1",
      attachments: [],
    },
  }]);
});

test("admin editors read existing tasks through a separate privileged detail scope", async () => {
  const calls = [];
  const api = createTaskApi({
    queryTasks: async (request) => {
      calls.push(request);
      return { id: request.taskId, status: "draft" };
    },
    invokeTaskFunction: async () => ({ ok: true }),
  });

  const result = await api.getAdminTask("task-1");

  assert.deepEqual(result, { id: "task-1", status: "draft" });
  assert.deepEqual(calls, [{ scope: "adminDetail", taskId: "task-1" }]);
});
