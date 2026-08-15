import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../assets/js/core/redeem.js", import.meta.url), "utf8");
const redeem = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../../script.js", import.meta.url), "utf8");

test("redeem code normalization trims and uppercases user input", () => {
  assert.equal(redeem.normalizeRedeemCode("  mkj-ab12  "), "MKJ-AB12");
});

test("redeemCode rejects empty input before invoking the service", async () => {
  let invoked = false;
  const client = {
    functions: {
      invoke: async () => {
        invoked = true;
        return { data: null, error: null };
      },
    },
  };

  await assert.rejects(() => redeem.redeemCode(client, "   "), /Redeem code/);
  assert.equal(invoked, false);
});

test("redeemCode sends the normalized code to the redeem function", async () => {
  let request = null;
  const client = {
    functions: {
      invoke: async (name, options) => {
        request = { name, options };
        return { data: { reward: { reputation: 10 } }, error: null };
      },
    },
  };

  const result = await redeem.redeemCode(client, " mkj-ab12 ");

  assert.deepEqual(request, {
    name: "redeem",
    options: { body: { code: "MKJ-AB12" } },
  });
  assert.deepEqual(result, { reward: { reputation: 10 } });
});

test("the account modal exposes the global redemption form", () => {
  assert.match(index, /data-mkj-redeem-form/);
  assert.match(index, /name="code"/);
  assert.ok(script.includes("/assets/js/core/redeem.js"));
});

test("the account modal keeps redemption discoverable and shows global reputation after login", () => {
  assert.match(index, /id="mkj-reputation-panel"/);
  assert.match(script, /loadReputation/);
  assert.doesNotMatch(script, /redeemPanel\.hidden=!mkjCurrentUser\|\|recovery/);
});
