import { createEdgeServices } from "../_shared/supabase.ts";
import { guardPublicText } from "../_shared/content-guard.ts";
import { ApiError, databaseError, errorResponse, jsonResponse, optionsResponse, parseJsonBody } from "../_shared/http.ts";

const { auth, adminClient } = createEdgeServices();
const db = adminClient as any;

function assertRole(role: string, allowed: string[]): void {
  if (!allowed.includes(role)) throw new ApiError("FORBIDDEN", 403, "当前账户没有商城操作权限。");
}
function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError("VALIDATION_ERROR", 400, `${field}不能为空。`);
  return value.trim();
}
function positiveInteger(value: unknown, field: string, max: number): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > max) throw new ApiError("VALIDATION_ERROR", 400, `${field}超出范围。`);
  return value as number;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  try {
    const listProducts = async () => {
      const { data, error } = await db.from("shop_products")
        .select("id, sku, name, description, points_cost, stock_quantity, metadata, is_active, created_at, updated_at")
        .eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw databaseError(error);
      return jsonResponse({ products: data ?? [] });
    };
    if (request.method === "GET") {
      return listProducts();
    }
    if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 GET 或 POST 请求。" } }, 405);
    const body = await parseJsonBody(request);
    const action = requiredString(body.action, "action");

    if (action === "listProducts") return listProducts();

    const context = await auth.requireContext(request);
    auth.assertNotMuted(context);

    if (action === "redeem") {
      assertRole(context.role, ["USER", "MODERATOR", "ADMIN"]);
      const productId = requiredString(body.productId, "productId");
      const quantity = positiveInteger(body.quantity ?? 1, "兑换数量", 100);
      const orderKey = requiredString(body.orderKey ?? body.idempotencyKey, "orderKey");
      const { data, error } = await db.rpc("redeem_shop_product", {
        p_user_id: context.userId, p_product_id: productId, p_quantity: quantity, p_order_key: orderKey,
      });
      if (error) throw databaseError(error);
      return jsonResponse({ order: data });
    }

    if (action === "upsertProduct") {
      assertRole(context.role, ["ADMIN"]);
      const name = guardPublicText(requiredString(body.name, "name"), { required: true, maxLength: 160 });
      const description = guardPublicText(String(body.description ?? ""), { maxLength: 5_000 });
      const payload = {
        sku: requiredString(body.sku, "sku"), name: name.text, description: description.text,
        pointsCost: positiveInteger(body.pointsCost, "pointsCost", 1_000_000),
        stockQuantity: Number.isInteger(body.stockQuantity) && (body.stockQuantity as number) >= 0 ? body.stockQuantity : 0,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
        isActive: body.isActive !== false,
      };
      const { data, error } = await db.rpc("upsert_shop_product", {
        p_actor_id: context.userId, p_product_id: typeof body.productId === "string" ? body.productId : null, p_payload: payload,
      });
      if (error) throw databaseError(error);
      return jsonResponse({ productId: data, warnings: [...name.matches, ...description.matches] });
    }

    if (action === "orders" || action === "listOrders") {
      const query = db.from("shop_orders")
        .select("id, order_key, user_id, product_id, quantity, unit_cost, total_cost, status, created_at, shop_products(name)")
        .order("created_at", { ascending: false }).limit(200);
      if (action === "listOrders") query.eq("user_id", context.userId);
      else assertRole(context.role, ["ADMIN"]);
      const { data, error } = await query;
      if (error) throw databaseError(error);
      return jsonResponse({ orders: data ?? [] });
    }
    throw new ApiError("VALIDATION_ERROR", 400, "不支持的商城操作。");
  } catch (error) {
    return errorResponse(error);
  }
});
