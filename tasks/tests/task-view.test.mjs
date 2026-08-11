import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTaskDeadline,
  getApplicationGroup,
  statusLabel,
  toTaskListingModel,
} from "../../assets/js/tasks/task-view.js";

test("toTaskListingModel supplies safe display defaults for a published task", () => {
  assert.deepEqual(toTaskListingModel({
    id: "task-1",
    title: "Review a portfolio",
    summary: "Give practical feedback.",
    category: { name: "求职准备" },
    skill_tags: ["作品集", "表达"],
    reward_points: 18,
    deadline_at: "2026-08-20T08:00:00Z",
  }), {
    id: "task-1",
    title: "Review a portfolio",
    summary: "Give practical feedback.",
    categoryName: "求职准备",
    tags: ["作品集", "表达"],
    reward: 18,
    deadline: "2026-08-20T08:00:00Z",
  });
});

test("application grouping keeps submitted work distinct from completed work", () => {
  assert.equal(getApplicationGroup("accepted"), "active");
  assert.equal(getApplicationGroup("submitted"), "submitted");
  assert.equal(getApplicationGroup("completed"), "completed");
  assert.equal(getApplicationGroup("rejected"), "closed");
});

test("status and deadline helpers return readable fallbacks", () => {
  assert.equal(statusLabel("submitted"), "待核验");
  assert.equal(statusLabel("unknown"), "状态未知");
  assert.equal(formatTaskDeadline(null), "未设置截止时间");
  assert.match(formatTaskDeadline("2026-08-20T08:00:00Z"), /2026/);
});
