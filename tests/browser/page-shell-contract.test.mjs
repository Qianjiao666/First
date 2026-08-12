import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PRODUCTION_PAGES } from "./production-pages.mjs";

const root = new URL("../../", import.meta.url);

test("the production page inventory is stable and unique", () => {
  assert.equal(PRODUCTION_PAGES.length, 20);
  assert.equal(new Set(PRODUCTION_PAGES).size, PRODUCTION_PAGES.length);
});

test("the homepage starts the v1.1 release with versioned shell assets", async () => {
  const source = await fs.readFile(fileURLToPath(new URL("index.html", root)), "utf8");
  assert.match(source, /styles\.css\?v=20260812-v1\.1/);
  assert.match(source, /assets\/css\/visual-v1\.css\?v=20260812-v1\.1/);
  assert.match(source, /assets\/js\/core\/runtime\.js\?v=20260812-v1\.1/);
  assert.match(source, /script\.js\?v=20260812-v1\.1/);
});
