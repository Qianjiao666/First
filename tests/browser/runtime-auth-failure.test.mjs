import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const runtimeUrl = new URL("../../assets/js/core/runtime.js", import.meta.url);

test("Edge UNAUTHENTICATED responses are delegated to the session coordinator", async () => {
  const source = await fs.readFile(runtimeUrl, "utf8");
  const invokeFunction = source.match(/async function invokeFunction[\s\S]*?\n}/)?.[0] ?? "";

  assert.match(invokeFunction, /const activeSession = await getSession\(\)/);
  assert.match(invokeFunction, /Authorization: `Bearer \$\{activeSession\.access_token\}`/);
  assert.match(invokeFunction, /session\.handleApiAuthFailure\(error\)/);
  assert.doesNotMatch(invokeFunction, /const session = await getSession\(\)/);
});
