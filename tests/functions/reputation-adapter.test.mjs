import test from "node:test";
import assert from "node:assert/strict";

import { recordReputationEvent } from "../../supabase/functions/_shared/reputation.ts";

test("reputation adapter forwards complete idempotency input to the service RPC", async () => {
  const calls = [];
  const client = {
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      return { data: [{ applied: true, event_id: "event-1", reputation: 120 }], error: null };
    },
  };

  const result = await recordReputationEvent(client, {
    eventKey: "task:task-1:user:user-1:completion:v1",
    userId: "user-1",
    amount: 50,
    reason: "任务完成奖励",
    sourceResource: "tasks",
    sourceId: "task-1",
    actorId: "admin-1",
  });

  assert.deepEqual(result, { applied: true, eventId: "event-1", reputation: 120 });
  assert.deepEqual(calls, [{
    functionName: "apply_reputation_event",
    args: {
      p_event_key: "task:task-1:user:user-1:completion:v1",
      p_user_id: "user-1",
      p_amount: 50,
      p_reason: "任务完成奖励",
      p_source_resource: "tasks",
      p_source_id: "task-1",
      p_actor_id: "admin-1",
    },
  }]);
});
