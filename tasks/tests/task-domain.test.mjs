import assert from "node:assert/strict";
import test from "node:test";

import * as taskDomain from "../../assets/js/tasks/task-domain.js";

const {
  APPLICATION_STATUS,
  buildTaskDetailUrl,
  canTransitionApplication,
  parseTaskId,
  taskActionForApplication,
} = taskDomain;

test("buildTaskDetailUrl encodes a task id for the static detail route", () => {
  assert.equal(
    buildTaskDetailUrl("task id/1"),
    "/MKJ/tasks/detail/?id=task%20id%2F1",
  );
});

test("parseTaskId accepts one UUID query value and rejects missing values", () => {
  assert.equal(
    parseTaskId("?id=12c5efaa-58b3-4b73-9ee0-8bc9d7dff1a7"),
    "12c5efaa-58b3-4b73-9ee0-8bc9d7dff1a7",
  );
  assert.equal(parseTaskId("?id=not-a-uuid"), null);
  assert.equal(parseTaskId(""), null);
});

test("application transitions require admin verification after user submission", () => {
  assert.equal(
    canTransitionApplication(APPLICATION_STATUS.PENDING, APPLICATION_STATUS.ACCEPTED, "admin"),
    true,
  );
  assert.equal(
    canTransitionApplication(APPLICATION_STATUS.ACCEPTED, APPLICATION_STATUS.SUBMITTED, "applicant"),
    true,
  );
  assert.equal(
    canTransitionApplication(APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.COMPLETED, "applicant"),
    false,
  );
  assert.equal(
    canTransitionApplication(APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.COMPLETED, "admin"),
    true,
  );
});

test("taskActionForApplication exposes only the caller's valid next action", () => {
  assert.equal(taskActionForApplication(APPLICATION_STATUS.PENDING, "applicant"), null);
  assert.equal(taskActionForApplication(APPLICATION_STATUS.ACCEPTED, "applicant"), "submit");
  assert.equal(taskActionForApplication(APPLICATION_STATUS.SUBMITTED, "admin"), "complete");
});

test("task admin guard requires the exact tasks:manage capability", () => {
  assert.equal(typeof taskDomain.hasTaskManageCapability, "function");
  assert.equal(taskDomain.hasTaskManageCapability(["admin:access", "tasks:manage"]), true);
  assert.equal(taskDomain.hasTaskManageCapability(["admin:access", "tasks:create"]), false);
  assert.equal(taskDomain.hasTaskManageCapability({ "tasks:manage": true }), true);
  assert.equal(taskDomain.hasTaskManageCapability(null), false);
});
