import assert from "node:assert/strict";
import test from "node:test";

import { createTaskApi } from "../../assets/js/tasks/task-api.js";

test("collaboration messages use the dedicated edge envelope", async () => {
  const requests = [];
  const api = createTaskApi({
    queryTasks: async () => ({ items: [] }),
    invokeTaskFunction: async (request) => {
      requests.push(request);
      return { data: { messageId: "message-1" } };
    },
  });

  await api.sendMessage("conversation-1", "Please confirm responsibilities.");

  assert.deepEqual(requests.at(-1), {
    functionName: "task-collaboration",
    action: "sendMessage",
    body: { conversationId: "conversation-1", content: "Please confirm responsibilities." },
  });
});

test("collaboration members use narrow assignment and peer-review envelopes", async () => {
  const requests = [];
  const api = createTaskApi({
    queryTasks: async () => ({ items: [] }),
    invokeTaskFunction: async (request) => {
      requests.push(request);
      return { data: { ok: true } };
    },
  });

  await api.assignMember("application-1", "Collect the campus pickup list.");
  await api.submitPeerReview("application-1", { communication: 5, contribution: 4, punctuality: 5 }, "On time and clear.");
  await api.getCollaboration("task-1");

  assert.deepEqual(requests, [
    { functionName: "task-collaboration", action: "assignMember", body: { applicationId: "application-1", responsibility: "Collect the campus pickup list." } },
    { functionName: "task-collaboration", action: "submitPeerReview", body: { applicationId: "application-1", ratings: { communication: 5, contribution: 4, punctuality: 5 }, content: "On time and clear." } },
    { functionName: "task-collaboration", action: "getCollaboration", body: { taskId: "task-1" } },
  ]);
});
