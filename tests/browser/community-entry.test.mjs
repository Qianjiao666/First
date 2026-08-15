import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);

async function read(path) {
  try {
    return await fs.readFile(fileURLToPath(new URL(path, root)), "utf8");
  } catch {
    return null;
  }
}

test("the original page exposes one community entry instead of separate module links", async () => {
  const source = await read("index.html");
  assert.ok(source, "index.html exists");

  const communityLinks = source.match(/href=["']\/MKJ\/community\/["']/g) ?? [];
  assert.equal(communityLinks.length, 1);
  assert.doesNotMatch(source, /href=["']\/MKJ\/(?:forum|tasks)\//);
});

test("the community directory links to forum and task modules", async () => {
  const source = await read("community/index.html");
  assert.ok(source, "community/index.html exists");
  assert.match(source, /href=["']\/MKJ\/forum\/["']/);
  assert.match(source, /href=["']\/MKJ\/tasks\/["']/);
  assert.match(source, /assets\/css\/global-modules\.css/);
});
