import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";

import { buildDfa as buildBrowserDfa, filterWithDfa as filterBrowser } from "../../assets/js/security/dfa.js";
import { buildDfa as buildBackendDfa, filterWithDfa as filterBackend } from "../../supabase/functions/_shared/dfa.ts";
import {
  CUSTOM_BLOCK_WORDS,
  CUSTOM_WARN_WORDS,
  DEFAULT_BLOCK_WORDS,
  OPEN_SOURCE_WARN_WORDS,
} from "../../assets/js/security/sensitive-lexicon.js";
import * as backendLexicon from "../../supabase/functions/_shared/sensitive-lexicon.ts";
import { guardPublicText } from "../../supabase/functions/_shared/content-guard.ts";

const digest = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();

test("the pinned MIT lexicon snapshot has its documented deterministic hash", async () => {
  const words = await fs.readFile(new URL("../../assets/data/sensitive-lexicon-source/words.txt", import.meta.url));
  const license = await fs.readFile(new URL("../../assets/data/sensitive-lexicon-source/LICENSE", import.meta.url), "utf8");
  assert.equal(digest(words), "196E6251FBFDB92BEE24BBB3D9E5059D07C29B472FA995C36FAA86AFC9431DC0");
  assert.match(license, /^MIT License/m);
  assert.equal(OPEN_SOURCE_WARN_WORDS.length, 11788);
  assert.deepEqual(backendLexicon.OPEN_SOURCE_WARN_WORDS, OPEN_SOURCE_WARN_WORDS);
  assert.deepEqual(CUSTOM_WARN_WORDS, []);
  assert.deepEqual(CUSTOM_BLOCK_WORDS, []);
  assert.ok(DEFAULT_BLOCK_WORDS.length > 0);
});

test("DFA uses deterministic longest matches and equal code-point replacement", () => {
  const entries = [
    { word: "测试", severity: "WARN" },
    { word: "测试词", severity: "WARN" },
    { word: "词条", severity: "WARN" },
  ];
  const browser = filterBrowser("前测试词条后", buildBrowserDfa(entries));
  const backend = filterBackend("前测试词条后", buildBackendDfa(entries));

  assert.deepEqual(browser, {
    text: "前****后",
    matches: ["测试词", "词条"],
    severity: "WARN",
  });
  assert.deepEqual(backend, browser);
});

test("DFA normalizes full-width input and BLOCK wins at equal length", () => {
  const entries = [
    { word: "bad", severity: "WARN" },
    { word: "BAD", severity: "BLOCK" },
  ];
  const browser = filterBrowser("ｂａｄ 内容", buildBrowserDfa(entries));
  assert.deepEqual(browser, { text: "*** 内容", matches: ["BAD"], severity: "BLOCK" });
  assert.deepEqual(filterBackend("ｂａｄ 内容", buildBackendDfa(entries)), browser);
});

test("DFA preserves unmatched original text and masks visible source characters", () => {
  const entries = [{ word: "株式会社", severity: "WARN" }];
  const browserDfa = buildBrowserDfa(entries);
  const backendDfa = buildBackendDfa(entries);

  assert.deepEqual(
    filterBrowser("安全ａｂｃ", browserDfa),
    { text: "安全ａｂｃ", matches: [], severity: "NONE" },
  );
  assert.deepEqual(
    filterBrowser("前㍿后", browserDfa),
    { text: "前*后", matches: ["株式会社"], severity: "WARN" },
  );
  assert.deepEqual(filterBackend("前㍿后", backendDfa), filterBrowser("前㍿后", browserDfa));
});

test("guardPublicText rejects XSS and BLOCK content but returns WARN replacement", () => {
  assert.throws(
    () => guardPublicText("<script>alert(1)</script>", { warnWords: [], blockWords: [] }),
    (error) => error.code === "XSS_BLOCKED" && error.status === 403,
  );
  assert.throws(
    () => guardPublicText("高风险内容", { warnWords: [], blockWords: ["高风险"] }),
    (error) => error.code === "CONTENT_BLOCKED" && error.status === 403,
  );
  assert.deepEqual(
    guardPublicText("普通测试词内容", { warnWords: ["测试词"], blockWords: [] }),
    { text: "普通***内容", matches: ["测试词"], severity: "WARN" },
  );
});
