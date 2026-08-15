import test from "node:test";
import assert from "node:assert/strict";
import { createShopApi, normalizeProduct, canRedeemProduct, createIdempotencyKey } from "../shop.js";

test("normalizes shop product display fields without exposing internal fields", () => {
  assert.deepEqual(normalizeProduct({
    id: "p-1",
    name: "Mock interview",
    description: null,
    points_cost: "80",
    stock: "2",
    is_active: true,
    internal_note: "secret",
  }), {
    id: "p-1",
    name: "Mock interview",
    description: "",
    pointsCost: 80,
    stock: 2,
    isActive: true,
  });
});

test("redeem is gated by the shop:redeem capability and available stock", () => {
  assert.equal(canRedeemProduct(["shop:redeem"], { isActive: true, stock: 1 }), true);
  assert.equal(canRedeemProduct(["shop:redeem"], { isActive: true, stock: 0 }), false);
  assert.equal(canRedeemProduct([], { isActive: true, stock: 1 }), false);
});

test("shop API sends explicit actions and preserves idempotency key", async () => {
  const calls = [];
  const api = createShopApi({
    invokeFunction: async (name, body, method) => {
      calls.push({ name, body, method });
      return { items: [], order: { id: "order-1" } };
    },
  });
  const key = createIdempotencyKey();
  await api.listProducts();
  await api.redeem("p-1", key);
  await api.listOrders();
  assert.deepEqual(calls, [
    { name: "shop", body: {}, method: "GET" },
    { name: "shop", body: { action: "redeem", productId: "p-1", quantity: 1, orderKey: key, idempotencyKey: key }, method: "POST" },
    { name: "shop", body: { action: "listOrders" }, method: "POST" },
  ]);
});
