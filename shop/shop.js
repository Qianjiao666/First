const SHOP_FUNCTION = "shop";

export function normalizeProduct(value = {}) {
  return {
    id: String(value.id ?? ""),
    name: String(value.name ?? "未命名商品"),
    description: String(value.description ?? ""),
    pointsCost: Math.max(0, Number(value.points_cost ?? value.pointsCost ?? 0) || 0),
    stock: Math.max(0, Number(value.stock ?? value.stock_quantity ?? 0) || 0),
    isActive: value.is_active ?? value.isActive ?? true,
  };
}

export function canRedeemProduct(capabilities, product) {
  return Array.isArray(capabilities)
    && capabilities.includes("shop:redeem")
    && Boolean(product?.isActive)
    && Number(product?.stock) > 0;
}

export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function unwrapItems(result) {
  const items = result?.items ?? result?.products ?? result?.orders ?? result;
  return Array.isArray(items) ? items : [];
}

async function invokePublic(runtime, body, method = "POST") {
  if (typeof runtime?.invokeFunction === "function") {
    const session = typeof runtime.getSession === "function"
      ? await runtime.getSession().catch(() => null)
      : true;
    if (session) return runtime.invokeFunction(SHOP_FUNCTION, method === "GET" ? {} : body, method);
  }

  const config = runtime?.config ?? globalThis.SUPABASE_CONFIG;
  if (!config?.url || !config.publishableKey) throw new Error("商城服务暂不可用，请稍后重试。");
  const response = await fetch(`${config.url}/functions/v1/${SHOP_FUNCTION}`, {
    method,
    headers: { apikey: config.publishableKey, "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok && method === "GET") return invokePublic(runtime, body, "POST");
  if (!response.ok) throw new Error(result?.error?.message || "商城服务暂不可用，请稍后重试。");
  return result;
}

export function createShopApi(runtime = globalThis.MKJApp) {
  return {
    async listProducts() {
      const result = await invokePublic(runtime, { action: "listProducts" }, "GET");
      return unwrapItems(result).map(normalizeProduct);
    },
    async redeem(productId, idempotencyKey = createIdempotencyKey()) {
      if (!String(productId || "").trim()) throw new Error("请选择要兑换的商品。");
      await runtime?.requireAuthenticatedAction?.({ reason: "兑换商品" });
      if (typeof runtime?.getSession === "function" && !(await runtime.getSession())) {
        throw new Error("请先登录后再兑换商品。");
      }
      return invokePublic(runtime, {
        action: "redeem",
        productId: String(productId),
        quantity: 1,
        orderKey: String(idempotencyKey),
        idempotencyKey: String(idempotencyKey),
      });
    },
    async listOrders() {
      if (typeof runtime?.getSession === "function" && !(await runtime.getSession())) return [];
      try {
        const result = await invokePublic(runtime, { action: "listOrders" });
        return unwrapItems(result);
      } catch (error) {
        const query = runtime?.client?.from?.("shop_orders")
          ?.select?.("id, product_id, quantity, unit_cost, total_cost, status, created_at")
          ?.order?.("created_at", { ascending: false });
        if (!query) throw error;
        const { data, error: queryError } = await query;
        if (queryError) throw error;
        return Array.isArray(data) ? data : [];
      }
    },
  };
}

function textNode(documentRef, className, text) {
  const node = documentRef.createElement("span");
  node.className = className;
  node.textContent = text;
  return node;
}

export function renderProduct(product, { capabilities = [], onRedeem, documentRef = document } = {}) {
  const item = normalizeProduct(product);
  const article = documentRef.createElement("article");
  article.className = "shop-product-card";
  article.dataset.shopProductId = item.id;

  const content = documentRef.createElement("div");
  content.className = "shop-product-content";
  const title = documentRef.createElement("h3");
  title.className = "shop-product-title";
  title.textContent = item.name;
  const description = documentRef.createElement("p");
  description.className = "shop-product-description";
  description.textContent = item.description;
  content.append(title, description);

  const meta = documentRef.createElement("div");
  meta.className = "shop-product-meta";
  meta.append(textNode(documentRef, "shop-product-points", `${item.pointsCost} 积分`));
  meta.append(textNode(documentRef, "shop-product-stock", item.stock > 0 ? `余量 ${item.stock}` : "已售罄"));

  const action = documentRef.createElement("button");
  action.className = "shop-button shop-button-primary";
  action.type = "button";
  action.dataset.shopRedeem = item.id;
  action.dataset.mkjCapability = "shop:redeem";
  action.textContent = item.stock > 0 ? "兑换" : "已售罄";
  action.hidden = !capabilities.includes("shop:redeem");
  action.disabled = !canRedeemProduct(capabilities, item);
  if (action.disabled && item.stock > 0 && !capabilities.includes("shop:redeem")) {
    action.title = "当前账号没有兑换权限";
  }
  action.addEventListener("click", () => onRedeem?.(item, action));
  meta.append(action);

  article.append(content, meta);
  return article;
}

function orderRow(order, documentRef) {
  const row = documentRef.createElement("li");
  row.className = "shop-order-row";
  row.append(
    textNode(documentRef, "shop-order-name", String(order.product_name ?? order.productName ?? order.shop_products?.name ?? "商品兑换")),
    textNode(documentRef, "shop-order-status", String(order.status ?? "处理中")),
    textNode(documentRef, "shop-order-points", `${Number(order.points_cost ?? order.pointsCost ?? order.total_cost ?? 0)} 积分`),
  );
  return row;
}

async function bootstrap() {
  const runtime = globalThis.MKJApp;
  const root = document.querySelector("[data-shop-root]");
  if (!root) return;
  await runtime?.ready?.();
  const api = createShopApi(runtime);
  const grid = root.querySelector("[data-shop-products]");
  const status = root.querySelector("[data-shop-status]");
  const orders = root.querySelector("[data-shop-orders]");
  const capabilities = await runtime?.getCapabilities?.().catch(() => []) ?? [];
  const setStatus = (message, tone = "info") => {
    if (!status) return;
    status.hidden = !message;
    status.textContent = message;
    status.dataset.shopTone = tone;
  };

  root.querySelectorAll("[data-shop-capability]").forEach((node) => {
    node.hidden = !capabilities.includes(node.dataset.shopCapability);
  });

  try {
    const products = await api.listProducts();
    grid?.replaceChildren(...products.filter((product) => product.isActive).map((product) => renderProduct(product, {
      capabilities,
      onRedeem: async (item, button) => {
        button.disabled = true;
        setStatus("正在提交兑换…");
        try {
          await api.redeem(item.id);
          setStatus(`已提交“${item.name}”兑换，请在订单记录中查看状态。`, "success");
          await loadOrders();
        } catch (error) {
          button.disabled = false;
          setStatus(error?.message || "兑换失败，请稍后重试。", "error");
        }
      },
    })));
    if (!products.length) setStatus("商城暂时没有可兑换商品。");
  } catch (error) {
    setStatus(error?.message || "商品暂时无法加载，请稍后重试。", "error");
  }

  async function loadOrders() {
    if (!orders) return;
    const user = await runtime?.getCurrentUser?.().catch(() => null);
    if (!user) {
      orders.replaceChildren(textNode(document, "shop-orders-empty", "登录后可查看兑换订单。"));
      return;
    }
    try {
      const rows = await api.listOrders();
      orders.replaceChildren(...rows.map((order) => orderRow(order, document)));
      if (!rows.length) orders.append(textNode(document, "shop-orders-empty", "还没有兑换订单。"));
    } catch (error) {
      orders.replaceChildren(textNode(document, "shop-orders-error", error?.message || "订单暂时无法加载。"));
    }
  }

  await loadOrders();
  runtime?.onSessionChange?.(() => { void loadOrders(); });
}

if (typeof document !== "undefined") bootstrap();
