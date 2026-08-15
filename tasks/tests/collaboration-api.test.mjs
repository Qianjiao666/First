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
