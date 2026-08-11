import assert from "node:assert/strict";
import test from "node:test";

import {
  TaskIntegrationUnavailableError,
  resolveTaskRuntime,
} from "../../assets/js/tasks/task-runtime.js";

test("runtime fails closed when the shared integration is unavailable", async () => {
  const runtime = resolveTaskRuntime({});

  assert.equal(runtime.ready, false);
  await assert.rejects(
    runtime.queryTasks({ scope: "published" }),
    TaskIntegrationUnavailableError,
  );
  await assert.rejects(
    runtime.invokeTaskFunction({ functionName: "task-complete", action: "apply" }),
    TaskIntegrationUnavailableError,
  );
});

test("runtime uses the task transport without requiring a duplicate badge adapter", async () => {
  const calls = [];
  const runtime = resolveTaskRuntime({
    MKJ_TASK_INTEGRATION: {
      queryTasks: async (request) => {
        calls.push(["query", request]);
        return { items: [] };
      },
      invokeTaskFunction: async (request) => {
        calls.push(["invoke", request]);
        return { ok: true };
      },
      getCurrentUser: async () => ({ id: "user-1" }),
      getCapabilities: async () => ["tasks:manage"],
    },
  });

  assert.equal(runtime.ready, true);
  await runtime.queryTasks({ scope: "published" });
  await runtime.invokeTaskFunction({ functionName: "task-complete", action: "apply" });
  assert.deepEqual(await runtime.getCurrentUser(), { id: "user-1" });
  assert.deepEqual(await runtime.getCapabilities(), ["tasks:manage"]);

  assert.deepEqual(calls, [
    ["query", { scope: "published" }],
    ["invoke", { functionName: "task-complete", action: "apply" }],
  ]);
});

test("runtime forwards task attachment uploads when storage integration is available", async () => {
  const calls = [];
  const runtime = resolveTaskRuntime({
    MKJ_TASK_INTEGRATION: {
      queryTasks: async () => ({ items: [] }),
      invokeTaskFunction: async () => ({ ok: true }),
      uploadTaskAttachment: async (request) => {
        calls.push(request);
        return { path: "user/task/file.png" };
      },
      getCurrentUser: async () => ({ id: "user-1" }),
    },
  });

  assert.deepEqual(await runtime.uploadTaskAttachment({ resourceId: "task-1" }), { path: "user/task/file.png" });
  assert.deepEqual(calls, [{ resourceId: "task-1" }]);
});
