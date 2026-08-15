import assert from "node:assert/strict";
import test from "node:test";

import * as taskDomain from "../../assets/js/tasks/task-domain.js";

test("campus collaboration has no money workflow", () => {
  const model = taskDomain.toCollaborativeTaskModel({ task_mode: "collaboration" });

  assert.equal(model.isCollaboration, true);
  assert.equal("payment" in model, false);
});
