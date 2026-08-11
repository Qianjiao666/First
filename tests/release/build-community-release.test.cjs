const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const deployment = path.join(root, "deployment");
const revision = "checksum-eol-test";
const releasePrefix = `MKJ-community-forum-tasks-20260811-`;

function generatedPaths(packageType) {
  const stem = `${releasePrefix}${packageType}-${revision}`;
  return [
    path.join(deployment, stem),
    path.join(deployment, `${stem}.zip`),
    path.join(deployment, `${stem}.zip.sha256`),
  ];
}

test("writes Linux-compatible checksum files", () => {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(deployment, "build-community-release.ps1"),
        "-Revision",
        revision,
      ],
      { cwd: root, stdio: "pipe" },
    );

    for (const packageType of ["static", "backend"]) {
      const checksumPath = generatedPaths(packageType)[2];
      const checksum = fs.readFileSync(checksumPath);
      assert.equal(checksum.includes(0x0d), false, `${packageType} checksum contains CRLF`);
      assert.equal(checksum.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, `${packageType} checksum contains a BOM`);
      assert.match(
        checksum.toString("ascii"),
        new RegExp(`^[A-F0-9]{64}  ${releasePrefix}${packageType}-${revision}\\.zip\\n$`),
      );
    }
  } finally {
    for (const packageType of ["static", "backend"]) {
      for (const generatedPath of generatedPaths(packageType)) {
        fs.rmSync(generatedPath, { force: true, recursive: true });
      }
    }
  }
});
