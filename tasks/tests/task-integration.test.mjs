import assert from "node:assert/strict";
import test from "node:test";

import { createTaskIntegration } from "../../assets/js/core/task-integration.js";

function createQueryBuilder(result) {
  const calls = [];
  const builder = {
    select(...args) {
      calls.push(["select", ...args]);
      return builder;
    },
    eq(...args) {
      calls.push(["eq", ...args]);
      return builder;
    },
    ilike(...args) {
      calls.push(["ilike", ...args]);
      return builder;
    },
    or(...args) {
      calls.push(["or", ...args]);
      return builder;
    },
    order(...args) {
      calls.push(["order", ...args]);
      return builder;
    },
    range(...args) {
      calls.push(["range", ...args]);
      return builder;
    },
    in(...args) {
      calls.push(["in", ...args]);
      return builder;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return { builder, calls };
}

test("published task queries search titles and skill tags with pagination", async () => {
  const taskQuery = createQueryBuilder({ data: [{ id: "task-1" }], error: null, count: 1 });
  const client = {
    from(table) {
      assert.equal(table, "task_listings");
      return taskQuery.builder;
    },
  };
  const integration = createTaskIntegration({ client, getSession: async () => null });

  const result = await integration.queryTasks({
    scope: "published",
    filters: { category: "career", query: "remote", sort: "deadline_at.asc", page: 2 },
  });

  assert.deepEqual(result.items, [{ id: "task-1" }]);
  assert.equal(result.total, 1);
  assert.deepEqual(taskQuery.calls, [
    ["select", "*", { count: "exact" }],
    ["eq", "status", "published"],
    ["eq", "category_id", "career"],
    ["or", 'title.ilike.*remote*,skill_tags.cs.["remote"]'],
    ["order", "deadline_at", { ascending: true }],
    ["range", 20, 39],
  ]);
});

test("task function transport never sends trusted actor fields", async () => {
  const calls = [];
  const integration = createTaskIntegration({
    client: { from: () => createQueryBuilder({ data: [], error: null }).builder },
    getSession: async () => ({ access_token: "session-token" }),
    config: { url: "https://example.supabase.co", publishableKey: "publishable" },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: { taskId: "task-1" } }), { status: 200 });
    },
  });

  const result = await integration.invokeTaskFunction({
    functionName: "task-admin",
    action: "create",
    body: { payload: { title: "Draft" } },
  });

  assert.equal(calls[0].url, "https://example.supabase.co/functions/v1/task-admin");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    action: "create",
    payload: { title: "Draft" },
  });
  assert.equal(calls[0].init.headers.Authorization, "Bearer session-token");
  assert.deepEqual(result, { data: { taskId: "task-1" } });
});

test("task function transport preserves edge warnings beside response data", async () => {
  const integration = createTaskIntegration({
    client: { from: () => createQueryBuilder({ data: [], error: null }).builder },
    getSession: async () => ({ access_token: "session-token" }),
    config: { url: "https://example.supabase.co", publishableKey: "publishable" },
    fetch: async () => new Response(JSON.stringify({
      data: { taskId: "task-1" },
      warnings: ["matched-content"],
    }), { status: 200 }),
  });

  const result = await integration.invokeTaskFunction({
    functionName: "task-admin",
    action: "create",
    body: { title: "Draft" },
  });

  assert.deepEqual(result, {
    data: { taskId: "task-1" },
    warnings: ["matched-content"],
  });
});

test("admin task queries include application counts", async () => {
  const listings = createQueryBuilder({
    data: [{ id: "task-1" }, { id: "task-2" }],
    error: null,
  });
  const applications = createQueryBuilder({
    data: [{ task_id: "task-1" }, { task_id: "task-1" }],
    error: null,
  });
  const client = {
    from(table) {
      if (table === "task_listings") return listings.builder;
      if (table === "task_applications") return applications.builder;
      throw new Error(`unexpected table ${table}`);
    },
  };
  const integration = createTaskIntegration({ client, getSession: async () => null });

  const result = await integration.queryTasks({ scope: "admin", filters: {} });

  assert.deepEqual(result.items, [
    { id: "task-1", application_count: 2 },
    { id: "task-2", application_count: 0 },
  ]);
  assert.deepEqual(applications.calls, [
    ["select", "task_id"],
    ["in", "task_id", ["task-1", "task-2"]],
  ]);
});

test("task integration exposes shared capability lookup to module guards", async () => {
  const integration = createTaskIntegration({
    client: { from: () => createQueryBuilder({ data: [], error: null }).builder },
    getSession: async () => null,
    getCapabilities: async () => ["tasks:manage"],
  });

  assert.deepEqual(await integration.getCapabilities(), ["tasks:manage"]);
});

test("task integration reads activity and attachment scopes", async () => {
  const activity = createQueryBuilder({ data: [{ id: "event-1" }], error: null });
  const attachments = createQueryBuilder({ data: [{ id: "attachment-1" }], error: null });
  const client = {
    from(table) {
      if (table === "task_activity_log") return activity.builder;
      if (table === "task_attachments") return attachments.builder;
      throw new Error(`unexpected table ${table}`);
    },
  };
  const integration = createTaskIntegration({ client, getSession: async () => null });

  assert.deepEqual(await integration.queryTasks({ scope: "activity", taskId: "task-1" }), { items: [{ id: "event-1" }] });
  assert.deepEqual(await integration.queryTasks({ scope: "attachments", taskId: "task-1" }), { items: [{ id: "attachment-1" }] });
  assert.deepEqual(activity.calls, [["select", "*"], ["eq", "task_id", "task-1"], ["order", "created_at", { ascending: true }]]);
  assert.deepEqual(attachments.calls, [["select", "*"], ["eq", "task_id", "task-1"], ["order", "created_at", { ascending: true }]]);
});

test("task function transport allows completion attachments and admin arbitration", async () => {
  const calls = [];
  const integration = createTaskIntegration({
    client: { from: () => createQueryBuilder({ data: [], error: null }).builder },
    getSession: async () => ({ access_token: "session-token" }),
    config: { url: "https://example.supabase.co", publishableKey: "publishable" },
    fetch: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
    },
  });

  await integration.invokeTaskFunction({ functionName: "task-complete", action: "attach", body: { applicationId: "a-1", attachments: [] } });
  await integration.invokeTaskFunction({ functionName: "task-admin", action: "arbitrate", body: { taskId: "t-1", decision: "force_complete" } });
  assert.deepEqual(calls, [
    { action: "attach", payload: { applicationId: "a-1", attachments: [] } },
    { action: "arbitrate", payload: { taskId: "t-1", decision: "force_complete" } },
  ]);
});

test("task function transport allows only declared collaboration actions", async () => {
  const calls = [];
  const integration = createTaskIntegration({
    client: { from: () => createQueryBuilder({ data: [], error: null }).builder },
    getSession: async () => ({ access_token: "session-token" }),
    config: { url: "https://example.supabase.co", publishableKey: "publishable" },
    fetch: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
    },
  });

  await integration.invokeTaskFunction({ functionName: "task-collaboration", action: "sendMessage", body: { conversationId: "c-1", content: "Confirmed" } });
  await assert.rejects(
    () => integration.invokeTaskFunction({ functionName: "task-collaboration", action: "deleteConversation", body: {} }),
    /不支持的任务操作/,
  );
  assert.deepEqual(calls, [{ action: "sendMessage", payload: { conversationId: "c-1", content: "Confirmed" } }]);
});

test("task integration uploads validated attachment bytes through the task storage bucket", async () => {
  const uploads = [];
  const storage = {
    from(bucket) {
      assert.equal(bucket, "task-attachments");
      return {
        upload: async (path, file, options) => {
          uploads.push({ path, file, options });
          return { data: { path }, error: null };
        },
      };
    },
  };
  const integration = createTaskIntegration({
    client: { from: () => createQueryBuilder({ data: [], error: null }).builder, storage },
    getSession: async () => ({ user: { id: "user-1" }, access_token: "session-token" }),
  });
  const file = { name: "proof.png", type: "image/png", size: 10 };
  assert.deepEqual(
    await integration.uploadTaskAttachment({ userId: "user-1", resourceId: "task-1", file, objectId: "object-1" }),
    { path: "user-1/task-1/object-1-proof.png", name: "proof.png", mimeType: "image/png", size: 10, kind: "image", bucket: "task-attachments" },
  );
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].options.contentType, "image/png");
});
