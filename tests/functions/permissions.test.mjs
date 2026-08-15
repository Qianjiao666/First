import test from "node:test";
import assert from "node:assert/strict";

import {
  canRole,
  getLevelInfo,
  getUserTitle,
} from "../../supabase/functions/_shared/permissions.ts";

test("moderator can moderate forum but cannot manage users", () => {
  assert.equal(canRole("MODERATOR", "forum", "deleteAnyPost"), true);
  assert.equal(canRole("MODERATOR", "admin", "manageUsers"), false);
});

test("forum members can delete their own comments", () => {
  assert.equal(canRole("USER", "forum", "deleteOwnComment"), true);
});

test("administrator can manage task listings", () => {
  assert.equal(canRole("ADMIN", "tasks", "publish"), true);
  assert.equal(canRole("ADMIN", "tasks", "complete"), true);
});

test("administrator title overrides reputation level", () => {
  assert.equal(getUserTitle("ADMIN", 50000), "管理员");
  assert.equal(getUserTitle("MODERATOR", 50000), "版主");
});

test("level information advances from visitor to newcomer", () => {
  const level = getLevelInfo(9);

  assert.equal(level.current.title, "游客");
  assert.equal(level.next.title, "新手上路");
  assert.equal(level.remaining, 1);
  assert.equal(level.progress, 90);
});
