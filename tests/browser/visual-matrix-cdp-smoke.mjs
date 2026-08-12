import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.argv[2]?.replace(/\/$/, "");
const outputDirectory = process.argv[3] || "output/playwright/visual-v1-final";
const cdpPort = Number.parseInt(process.argv[4] || "9223", 10);
if (!baseUrl) {
  throw new Error("Usage: node tests/browser/visual-matrix-cdp-smoke.mjs <base-url> [output-directory] [cdp-port]");
}

let browserProcess = null;
let browserProfile = null;

const getTargets = () => fetch(`http://127.0.0.1:${cdpPort}/json`).then((response) => {
  if (!response.ok) throw new Error(`CDP target list returned ${response.status}`);
  return response.json();
});

const findBrowser = async () => {
  const candidates = process.platform === "win32"
    ? [
        path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
        path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
        path.join(process.env.ProgramFiles || "", "Microsoft/Edge/Application/msedge.exe"),
      ]
    : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error("No local Chrome or Edge executable was found for the visual matrix.");
};

let targets;
try {
  targets = await getTargets();
} catch {
  const browserExecutable = await findBrowser();
  browserProfile = await fs.mkdtemp(path.join(os.tmpdir(), "mkj-visual-cdp-"));
  browserProcess = spawn(browserExecutable, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${browserProfile}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  process.on("exit", () => browserProcess?.kill());

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      targets = await getTargets();
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 125));
    }
  }
  if (!targets) throw new Error(`Browser did not expose CDP on port ${cdpPort}.`);
}

const pageTarget = targets.find((item) => item.type === "page");
if (!pageTarget) throw new Error(`No Chrome page target is available on port ${cdpPort}.`);

await fs.mkdir(outputDirectory, { recursive: true });

const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
const pending = new Map();
let currentDiagnostics = null;
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

  if (!currentDiagnostics) return;
  if (message.method === "Runtime.exceptionThrown") {
    currentDiagnostics.errors.push(message.params.exceptionDetails.text || "Runtime exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    const text = message.params.args.map((item) => item.value ?? item.description ?? "").join(" ").trim();
    currentDiagnostics.errors.push(text || "Console error");
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    currentDiagnostics.errors.push(message.params.entry.text || "Browser log error");
  }
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
    currentDiagnostics.network.push(`${message.params.response.status} ${message.params.response.url}`);
  }
  if (message.method === "Network.loadingFailed" && !message.params.canceled) {
    currentDiagnostics.network.push(`${message.params.errorText} ${message.params.type}`);
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
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Page evaluation failed");
  return result.result.value;
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitForReady = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate("document.readyState === 'complete'")) return;
    await wait(100);
  }
  throw new Error("Timed out waiting for page readiness.");
};

const captureFullPage = async (path) => {
  const { cssContentSize } = await send("Page.getLayoutMetrics");
  const result = await send("Page.captureScreenshot", {
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: Math.ceil(cssContentSize.width),
      height: Math.ceil(cssContentSize.height),
      scale: 1,
    },
    format: "png",
    fromSurface: true,
  });
  await fs.writeFile(path, Buffer.from(result.data, "base64"));
};

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});

const viewports = [
  { name: "375", width: 375, height: 844, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1280", width: 1280, height: 900, mobile: false },
  { name: "1920", width: 1920, height: 1080, mobile: false },
];

const routes = [
  ["home", "", "main"],
  ["community", "community/", ".community-modules"],
  ["forum", "forum/", ".forum-section"],
  ["forum-category", "forum/c/", ".forum-category-masthead"],
  ["forum-post", "forum/p/", ".forum-thread-page"],
  ["forum-new", "forum/new/", ".forum-editor-page"],
  ["tasks", "tasks/", ".task-shell"],
  ["task-create", "tasks/create/", ".task-shell"],
  ["task-detail", "tasks/detail/", ".task-shell"],
  ["task-my", "tasks/my/", ".task-shell"],
  ["shop", "shop/", ".shop-shell"],
  ["announcements", "announcements/", ".announce-shell"],
  ["admin", "admin/", "[data-admin-content]"],
  ["admin-users", "admin/users/", "[data-admin-content]"],
  ["admin-forum", "admin/forum/", "[data-admin-content]"],
  ["admin-codes", "admin/redeem-codes/", "[data-admin-content]"],
  ["admin-words", "admin/sensitive-words/", "[data-admin-content]"],
  ["admin-transfer", "admin/account-transfer/", "[data-admin-content]"],
  ["admin-tasks", "admin/tasks/", ".task-shell"],
  ["admin-task-edit", "admin/tasks/edit/", ".task-editor"],
];

const screenshotRoutes = new Set(["home", "community", "forum", "tasks", "shop", "announcements", "admin"]);
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
    const url = `${baseUrl}/${route}`;
    currentDiagnostics = { errors: [], network: [] };
    const status = await fetch(url).then((response) => response.status);
    await send("Page.navigate", { url });
    await waitForReady();
    await wait(850);

    const pageReport = await evaluate(`(() => {
      const documentElement = document.documentElement;
      const body = document.body;
      return {
        title: document.title,
        textLength: body.innerText.trim().length,
        hasPrimaryContent: Boolean(document.querySelector(${JSON.stringify(selector)})),
        scrollWidth: Math.max(documentElement.scrollWidth, body.scrollWidth),
        clientWidth: documentElement.clientWidth,
        visualSheet: [...document.styleSheets].some((sheet) => sheet.href?.includes('/assets/css/visual-v1.css')),
        routeBlue: getComputedStyle(documentElement).getPropertyValue('--hx-blue').trim(),
        bodyBackground: getComputedStyle(body).backgroundColor
      };
    })()`);

    const report = {
      name,
      viewport: viewport.name,
      status,
      overflow: pageReport.scrollWidth > pageReport.clientWidth,
      ...pageReport,
      errors: [...new Set(currentDiagnostics.errors)],
      network: [...new Set(currentDiagnostics.network)],
    };

    assert.equal(report.status, 200, `${name} did not return HTTP 200 at ${viewport.name}px`);
    assert.equal(report.hasPrimaryContent, true, `${name} primary content missing at ${viewport.name}px`);
    assert.ok(report.textLength > 20, `${name} has too little visible content at ${viewport.name}px`);
    assert.equal(report.visualSheet, true, `${name} visual layer missing at ${viewport.name}px`);
    assert.equal(report.routeBlue, "#165dff", `${name} v1 tokens missing at ${viewport.name}px`);
    assert.equal(report.overflow, false, `${name} overflows at ${viewport.name}px`);
    assert.deepEqual(report.network, [], `${name} had failed browser requests at ${viewport.name}px`);
    assert.deepEqual(report.errors, [], `${name} logged browser errors at ${viewport.name}px`);

    if ((viewport.name === "375" || viewport.name === "1280") && screenshotRoutes.has(name)) {
      await captureFullPage(`${outputDirectory}/${name}-${viewport.name}.png`);
    }
    reports.push(report);
  }
}

currentDiagnostics = null;
socket.close();
await fs.writeFile(`${outputDirectory}/report.json`, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
if (browserProcess) {
  browserProcess.kill();
  if (browserProcess.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => browserProcess.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
}
if (browserProfile) {
  await fs.rm(browserProfile, {
    force: true,
    maxRetries: 12,
    recursive: true,
    retryDelay: 250,
  });
}
console.log(JSON.stringify({ combinations: reports.length, errors: 0, overflows: 0 }, null, 2));
