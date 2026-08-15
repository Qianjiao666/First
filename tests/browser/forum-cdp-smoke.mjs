import assert from "node:assert/strict";
import fs from "node:fs/promises";

const targetUrl = process.argv[2];
const outputDirectory = process.argv[3] || "output/playwright";
const expectedPage = process.argv[4] || "index";

if (!targetUrl) throw new Error("Usage: node tests/browser/forum-cdp-smoke.mjs <url> [output-directory] [page]");

const pages = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("No Chrome page target is available on port 9223.");

await fs.mkdir(outputDirectory, { recursive: true });

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const runtimeErrors = [];
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
    runtimeErrors.push(details.exception?.description || details.text || "Runtime exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    runtimeErrors.push("Console error");
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
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Page evaluation failed");
  return result.result.value;
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await evaluate("document.readyState === 'complete'")) return;
    await wait(100);
  }
  throw new Error("Timed out waiting for page readiness.");
}

async function capture(name) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(`${outputDirectory}/forum-${expectedPage}-${name}.png`, Buffer.from(result.data, "base64"));
}

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
runtimeErrors.length = 0;

const viewports = [
  { name: "375", width: 375, height: 844, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1280", width: 1280, height: 900, mobile: false },
  { name: "1920", width: 1920, height: 1080, mobile: false },
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
  await send("Page.navigate", { url: targetUrl });
  await waitForReady();
  await wait(650);
  const report = await evaluate(`(() => ({
    page: document.body.dataset.forumPage,
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    hasHeader: Boolean(document.querySelector('.forum-site-header')),
    hasPrimaryContent: Boolean(document.querySelector('[data-forum-posts], [data-forum-detail], [data-forum-new-form]')),
    hasForumStyles: Array.from(document.styleSheets).some((sheet) => sheet.href && sheet.href.includes('/assets/css/forum.css')),
    bodyTextLength: document.body.innerText.length
  }))()`);
  assert.equal(report.page, expectedPage);
  assert.ok(report.hasHeader && report.hasPrimaryContent && report.hasForumStyles);
  assert.ok(report.bodyTextLength > 80);
  assert.ok(report.scrollWidth <= report.width, `Unexpected horizontal overflow at ${viewport.name}px`);
  await capture(viewport.name);
  reports.push({ viewport: viewport.name, ...report });
}

socket.close();
assert.deepEqual(runtimeErrors, []);
console.log(JSON.stringify(reports, null, 2));
