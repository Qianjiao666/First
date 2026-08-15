# Shop Module Handoff

## Changes

- Added `/shop/index.html`, `/shop/shop.css`, and `/shop/shop.js`.
- Product cards use `shop-` classes and `shop:*` capability data. `shop:redeem` is required for an enabled redeem button.
- Product browsing, redemption, and order history are isolated behind `createShopApi` and the `shop` Edge Function. Redemption always sends a generated `idempotencyKey`.
- Anonymous product browsing uses the publishable-key request path; redemption and order history require an authenticated session.

## Edge Function Contract

The frontend invokes `shop` as follows:

- `GET /functions/v1/shop` -> `{ products: Product[] }` for active public products.
- `POST { action: "redeem", productId, quantity, orderKey }` -> order result. The server owns capability checks, atomic point deduction, stock checks, and idempotency. The UI also sends `idempotencyKey` as a forward-compatible alias.
- `POST { action: "orders" }` -> `{ orders: Order[] }`. The current service endpoint is admin-scoped; for a normal user's order history the UI falls back to the RLS-protected `shop_orders` query through the authenticated Supabase client.

Public product fields consumed by the UI are `id`, `name`, `description`, `points_cost`, `stock_quantity`, and `is_active`. Order fields displayed are `product_name` (optional), `status`, and `points_cost` (or `unit_cost`/`total_cost`).

## Tests

Run `node --test shop/tests/shop.test.mjs`. It covers product normalization, capability and stock gating, action payloads, and idempotency key preservation. Static routes were checked through `preview-server.js` on port 4192.

## Integration Assumptions / TODO

- The backend module must provide the `shop` function and `shop:*` capabilities through `get_user_capabilities`.
- The existing forum/tasks shells may mount a future shop link without importing this module; no existing shared files were changed.
- Production browser smoke with a real Supabase session remains a deployment-window task.
