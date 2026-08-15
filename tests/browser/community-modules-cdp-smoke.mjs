import assert from "node:assert/strict";
import fs from "node:fs/promises";

const baseUrl = process.argv[2];
const outputDirectory = process.argv[3] || "output/playwright";
if (!baseUrl) throw new Error("Usage: node tests/browser/community-modules-cdp-smoke.mjs <base-url> [output-directory]");

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const page = targets.find((item) => item.type === "page");
if (!page) throw new Error("No Chrome page target is available on port 9223.");

await fs.mkdir(outputDirectory, { recursive: true });
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const runtimeErrors = [];
let nextId = 0;
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text || "Runtime exception");
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") runtimeErrors.push("Console error");
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
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Page evaluation failed");
  return result.result.value;
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitForReady = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await evaluate("document.readyState === 'complete'")) return;
    await wait(100);
  }
  throw new Error("Timed out waiting for page readiness.");
};
const capture = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(`${outputDirectory}/community-modules-${name}.png`, Buffer.from(result.data, "base64"));
};

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

const viewports = [
  { name: "375", width: 375, height: 844, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1280", width: 1280, height: 900, mobile: false },
  { name: "1920", width: 1920, height: 1080, mobile: false },
];
const routes = [
  ["community", "community/index.html", ".community-modules"],
  ["tasks", "tasks/index.html", ".task-shell"],
  ["task-detail", "tasks/detail/index.html", ".task-shell"],
  ["admin", "admin/index.html", "[data-admin-content]"],
  ["admin-tasks", "admin/tasks/index.html", ".task-shell"],
];
const reports = [];
for (const viewport of viewports) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  for (const [name, route, selector] of routes) {
    await send("Page.navigate", { url: `${baseUrl}/${route}` });
    await waitForReady();
    await wait(700);
    const report = await evaluate(`(() => ({
      path: location.pathname,
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasPrimaryContent: Boolean(document.querySelector(${JSON.stringify(selector)})),
      bodyTextLength: document.body.innerText.length
    }))()`);
    assert.ok(report.hasPrimaryContent, `${name} primary content missing at ${viewport.name}px`);
    assert.ok(report.bodyTextLength > 40, `${name} has too little visible content at ${viewport.name}px`);
    assert.ok(report.scrollWidth <= report.width, `${name} overflows at ${viewport.name}px`);
    await capture(`${name}-${viewport.name}`);
    reports.push({ name, viewport: viewport.name, ...report });
  }
}

socket.close();
assert.deepEqual(runtimeErrors, []);
console.log(JSON.stringify(reports, null, 2));
