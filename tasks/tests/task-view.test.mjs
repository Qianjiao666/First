import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTaskListFilters,
  canSupplementApplication,
  formatTaskDeadline,
  getApplicationGroup,
  statusLabel,
  taskCollaborationStage,
  taskNextAction,
  toActivitySummary,
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

test("buildTaskListFilters keeps existing filters and adds collaboration filters", () => {
  assert.deepEqual(buildTaskListFilters({
    query: "  简历  ",
    category: "cat-1",
    sort: "reward_points.desc",
    page: 3,
    status: "closing_soon",
    rewardRange: "high",
    deadlineWindow: "this_week",
    skillTags: [" 沟通 ", "", "Excel"],
  }), {
    query: "简历",
    category: "cat-1",
    sort: "reward_points.desc",
    page: 3,
    status: "closing_soon",
    rewardRange: "high",
    deadlineWindow: "this_week",
    skillTags: ["沟通", "Excel"],
  });
});

test("task collaboration helpers derive readable stages and next actions", () => {
  assert.equal(taskCollaborationStage({ status: "published", application_status: "accepted" }), "进行中");
  assert.equal(taskCollaborationStage({ status: "published" }), "可申请");
  assert.equal(taskCollaborationStage({ status: "closed" }), "已关闭");

  assert.deepEqual(taskNextAction({ status: "published" }, "visitor"), {
    key: "login",
    label: "登录后申请",
    tone: "secondary",
    disabledReason: "",
  });
  assert.equal(taskNextAction({ status: "accepted" }, "applicant", ["task:submit"]).key, "submit");
  assert.equal(taskNextAction({ status: "submitted" }, "applicant", ["task:submit"]).key, "supplement");
  assert.equal(taskNextAction({ status: "submitted" }, "admin", ["task:manage"]).key, "review");
});

test("supplement and activity helpers use safe fallbacks", () => {
  assert.equal(canSupplementApplication({ status: "submitted" }), true);
  assert.equal(canSupplementApplication({ status: "completed" }), false);
  assert.deepEqual(toActivitySummary({
    id: "evt-1",
    type: "submitted",
    actor: "",
    at: "2026-08-14T00:00:00Z",
    note: "  初次交付  ",
  }, [{ id: "a1" }, { id: "a2" }]), {
    id: "evt-1",
    label: "提交完成说明",
    actor: "系统记录",
    at: "2026-08-14T00:00:00Z",
    note: "初次交付",
    attachmentCount: 2,
  });
});
