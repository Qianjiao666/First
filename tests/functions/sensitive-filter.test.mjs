import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../../supabase/functions/_shared/http.ts";
import * as sensitiveFilter from "../../supabase/functions/_shared/sensitive-filter.ts";
import fs from "node:fs/promises";

const { filterText } = sensitiveFilter;

test("warn words are replaced while preserving surrounding text", () => {
  const result = filterText("这里包含测试词内容", [
    { word: "测试词", level: "WARN" },
  ]);

  assert.equal(result.text, "这里包含***内容");
  assert.equal(result.severity, "WARN");
  assert.deepEqual(result.matches, ["测试词"]);
});

test("mute words take priority when multiple terms match", () => {
  const result = filterText("警告词和禁言词", [
    { word: "警告词", level: "WARN" },
    { word: "禁言词", level: "MUTE" },
  ]);

  assert.equal(result.text, "***和***");
  assert.equal(result.severity, "MUTE");
  assert.deepEqual(result.matches, ["警告词", "禁言词"]);
});

test("warn words replace full-width text after NFKC normalization", () => {
  const result = filterText("ｂａｄ 内容", [
    { word: "bad", level: "WARN" },
  ]);

  assert.equal(result.text, "*** 内容");
  assert.equal(result.severity, "WARN");
  assert.deepEqual(result.matches, ["bad"]);
});

test("mute words replace full-width text and retain mute severity", () => {
  const result = filterText("ｂａｄ 内容", [
    { word: "bad", level: "MUTE" },
  ]);

  assert.equal(result.text, "*** 内容");
  assert.equal(result.severity, "MUTE");
  assert.deepEqual(result.matches, ["bad"]);
});

test("mute matches reject the current write after applying the mute", () => {
  const result = filterText("contains mute term", [
    { word: "mute term", level: "MUTE" },
  ]);

  assert.throws(
    () => sensitiveFilter.assertSensitiveWriteAllowed(result),
    (error) => error instanceof ApiError && error.code === "MUTED" && error.status === 403,
  );
});

test("the new global DFA lexicon is code-only and does not query the legacy admin table", async () => {
  const contentGuard = await fs.readFile(new URL("../../supabase/functions/_shared/content-guard.ts", import.meta.url), "utf8");
  const lexicon = await fs.readFile(new URL("../../supabase/functions/_shared/sensitive-lexicon.ts", import.meta.url), "utf8");

  assert.doesNotMatch(contentGuard, /\.from\(["']sensitive_words["']\)/);
  assert.doesNotMatch(lexicon, /\.from\(|fetch\(|supabase/i);
  assert.match(lexicon, /CUSTOM_WARN_WORDS = Object\.freeze\(\[\]\)/);
  assert.match(lexicon, /CUSTOM_BLOCK_WORDS = Object\.freeze\(\[\]\)/);
});
