const fs = require("node:fs");
const origin = process.env.TASK_PREVIEW_ORIGIN ?? "http://127.0.0.1:4175";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const page = await fetch("http://127.0.0.1:9223/json/new?about:blank", { method: "PUT" })
    .then((response) => response.json());
  if (!page?.webSocketDebuggerUrl) throw new Error("Chrome page target is unavailable");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const exceptions = [];
  let nextId = 0;

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      exceptions.push(details.exception?.description ?? details.text ?? "Runtime exception");
    }
  };

  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "Evaluation failed");
    return response.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await evaluate(expression)) return;
      await wait(100);
    }
    const diagnostics = await evaluate(`(() => ({
      href: location.href,
      readyState: document.readyState,
      guard: document.body?.dataset.taskCapabilityGuard,
      message: document.querySelector("[data-task-message]")?.textContent,
      scripts: Array.from(document.scripts).map((script) => script.src),
    }))()`);
    throw new Error(`Timed out waiting for: ${expression}\n${JSON.stringify({ diagnostics, exceptions }, null, 2)}`);
  };
  const capture = async (path) => {
    const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    fs.writeFileSync(path, Buffer.from(screenshot.data, "base64"));
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const task = { id: "11111111-1111-4111-8111-111111111111", title: "作品集评审", status: "published", reward_points: 20, deadline_at: "2026-12-31T08:00:00Z", application_count: 2 };
      const integration = {
        getCurrentUser: async () => ({ userId: "22222222-2222-4222-8222-222222222222", role: "ADMIN", reputation: 120 }),
        getCapabilities: async () => location.search.includes("denied") ? ["admin:access"] : ["tasks:manage"],
        queryTasks: async (request) => {
          window.__TASK_SMOKE_QUERIES.push(request);
          if (request.scope === "admin") return { items: [task] };
          if (request.scope === "applications") return { items: [
            { id: "33333333-3333-4333-8333-333333333333", applicant_name: "申请人甲", status: "pending" },
            { id: "44444444-4444-4444-8444-444444444444", applicant_name: "申请人乙", status: "submitted" },
          ] };
          if (request.scope === "categories") return { items: [{ id: "55555555-5555-4555-8555-555555555555", name: "求职行动", subcategories: [{ id: "66666666-6666-4666-8666-666666666666", name: "作品集" }] }] };
          return { items: [] };
        },
        invokeTaskFunction: async (request) => {
          window.__TASK_SMOKE_CALLS.push(request);
          return { data: { applicationId: request.body?.applicationId ?? "44444444-4444-4444-8444-444444444444" } };
        },
      };
      window.__TASK_SMOKE_CALLS = [];
      window.__TASK_SMOKE_QUERIES = [];
      Object.defineProperty(window, "MKJ_TASK_INTEGRATION", { configurable: false, get: () => integration, set: () => {} });
    })();`,
  });

  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${origin}/MKJ/admin/tasks/index.html` });
  await waitFor("document.body?.dataset.taskCapabilityGuard === 'allowed'");
  const desktop = await evaluate(`(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    rows: document.querySelectorAll("[data-task-admin-table-body] tr").length,
    count: document.querySelector("[data-task-admin-table-body] tr td:nth-child(3)")?.textContent,
    categoryVisible: !document.querySelector("[data-task-category-open]").hidden,
    writeEnabled: !document.querySelector("[data-task-admin-write] button")?.disabled,
  }))()`);

  await evaluate("document.querySelector('[data-task-category-open]').click()");
  await waitFor("document.querySelector('#task-category-dialog').open");
  await capture("D:/桌面文件/任务/output/playwright/task-admin-category-desktop.png");
  await evaluate("document.querySelector('#task-category-dialog').close()");
  await evaluate("document.querySelector('[data-task-admin-action=applications]').click()");
  await waitFor("!document.querySelector('[data-task-admin-applications]').hidden");
  await evaluate("document.querySelector('[data-task-admin-action=assign]').click()");
  await waitFor("window.__TASK_SMOKE_CALLS.length >= 1");
  await evaluate("document.querySelector('[data-task-admin-action=reject]').click()");
  await waitFor("window.__TASK_SMOKE_CALLS.length >= 2");
  await evaluate("document.querySelector('[data-task-admin-action=complete]').click()");
  await waitFor("document.querySelector('#task-review-dialog').open");
  const review = await evaluate(`(() => ({
    rating: Boolean(document.querySelector("[data-task-review-form] [name=rating]")),
    content: Boolean(document.querySelector("[data-task-review-form] [name=content]")),
  }))()`);
  await capture("D:/桌面文件/任务/output/playwright/task-admin-review-desktop.png");
  await evaluate(`(() => {
    document.querySelector("[data-task-review-form] [name=content]").value = "完成质量符合要求";
    document.querySelector("[data-task-review-form]").requestSubmit();
  })()`);
  await waitFor("window.__TASK_SMOKE_CALLS.length >= 3");
  const actions = await evaluate("window.__TASK_SMOKE_CALLS.map((request) => request.action)");

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${origin}/MKJ/admin/tasks/index.html` });
  await waitFor("document.body?.dataset.taskCapabilityGuard === 'allowed'");
  await evaluate("document.querySelector('[data-task-category-open]').click()");
  await waitFor("document.querySelector('#task-category-dialog').open");
  const mobile = await evaluate(`(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    dialogWidth: Math.round(document.querySelector("#task-category-dialog").getBoundingClientRect().width),
    dialogRight: Math.round(document.querySelector("#task-category-dialog").getBoundingClientRect().right),
    offenders: Array.from(document.querySelectorAll("body *")).map((element) => {
      const rect = element.getBoundingClientRect();
      return { tag: element.tagName, className: String(element.className), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
    }).filter((item) => item.right > innerWidth + 1 || item.left < -1).slice(0, 12),
  }))()`);
  await capture("D:/桌面文件/任务/output/playwright/task-admin-category-mobile.png");

  await send("Page.navigate", { url: `${origin}/MKJ/admin/tasks/index.html?denied=1` });
  await waitFor("document.body?.dataset.taskCapabilityGuard === 'denied'");
  const denied = await evaluate(`(() => ({
    queryCount: window.__TASK_SMOKE_QUERIES.length,
    writeHidden: Array.from(document.querySelectorAll("[data-task-admin-write]")).every((node) => node.hidden),
    controlsDisabled: Array.from(document.querySelectorAll("[data-task-admin-write] button, [data-task-admin-write] input, [data-task-admin-write] select, [data-task-admin-write] textarea")).every((control) => control.disabled),
  }))()`);

  await send("Page.close");
  socket.close();
  const result = { desktop, review, actions, mobile, denied, exceptions };
  console.log(JSON.stringify(result, null, 2));
  if (desktop.scrollWidth > desktop.width
    || mobile.scrollWidth > mobile.width
    || actions.join(",") !== "assign,reject,complete"
    || denied.queryCount !== 0
    || !denied.writeHidden
    || !denied.controlsDisabled
    || exceptions.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
