import test from "node:test";
import assert from "node:assert/strict";
import {
  formatNotificationCount,
  normalizeNotification,
  notificationEventFilter,
} from "../../shared/notification-bell.js";

test("notification helpers normalize safe public fields and cap the badge", () => {
  assert.deepEqual(normalizeNotification({ id: "n1", type: "task.application", payload: { title: "Task" }, read_at: null }), {
    id: "n1",
    type: "task.application",
    payload: { title: "Task" },
    readAt: null,
    createdAt: null,
  });
  assert.equal(formatNotificationCount(0), "");
  assert.equal(formatNotificationCount(7), "7");
  assert.equal(formatNotificationCount(120), "99+");
});

test("realtime filter is scoped to the authenticated recipient", () => {
  assert.equal(notificationEventFilter("user-1"), "recipient_id=eq.user-1");
});
