import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("preview server supports an alternate port and directory index routes", async (context) => {
  const port = 4199;
  const child = spawn(process.execPath, ["preview-server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(() => child.kill());

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("preview server did not start")), 3000);
    child.stdout.on("data", (chunk) => {
      if (!String(chunk).includes("PREVIEW_READY")) return;
      clearTimeout(timeout);
      resolve();
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`preview server exited with ${code}`));
    });
  });

  const response = await fetch(`http://127.0.0.1:${port}/MKJ/community/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /class="community-page"/);
});
