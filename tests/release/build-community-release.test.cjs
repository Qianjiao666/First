const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const deployment = path.join(root, "deployment");
const releaseDate = "20260812";
const revision = "checksum-eol-test";
const releasePrefix = `MKJ-community-forum-tasks-${releaseDate}-`;
const productionPages = [
  "index.html",
  "community/index.html",
  "forum/index.html",
  "forum/c/index.html",
  "forum/p/index.html",
  "forum/new/index.html",
  "tasks/index.html",
  "tasks/create/index.html",
  "tasks/detail/index.html",
  "tasks/my/index.html",
  "shop/index.html",
  "announcements/index.html",
  "admin/index.html",
  "admin/users/index.html",
  "admin/forum/index.html",
  "admin/redeem-codes/index.html",
  "admin/sensitive-words/index.html",
  "admin/account-transfer/index.html",
  "admin/tasks/index.html",
  "admin/tasks/edit/index.html",
];

function generatedPaths(packageType) {
  const stem = `${releasePrefix}${packageType}-${revision}`;
  return [
    path.join(deployment, stem),
    path.join(deployment, `${stem}.zip`),
    path.join(deployment, `${stem}.zip.sha256`),
  ];
}

function extractArchive(zipPath, destination) {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "& { param([string]$zip, [string]$destination) Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force }",
      zipPath,
      destination,
    ],
    { cwd: root, stdio: "pipe" },
  );
}

function packageFiles(directory) {
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();
}

function manifestEntries(manifest) {
  return [...manifest.matchAll(/^([A-F0-9]{64})  (.+)$/gm)]
    .map(([, hash, relative]) => ({ hash, relative }));
}

test("builds separated v1.1-ready packages with deterministic Linux manifests", () => {
  const extractRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "mkj-release-test-"));
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(deployment, "build-community-release.ps1"),
        "-ReleaseDate",
        releaseDate,
        "-Revision",
        revision,
      ],
      { cwd: root, stdio: "pipe" },
    );

    const extracted = {};
    for (const packageType of ["static", "backend"]) {
      extracted[packageType] = path.join(extractRoot, packageType);
      extractArchive(generatedPaths(packageType)[1], extracted[packageType]);

      const checksumPath = generatedPaths(packageType)[2];
      const checksum = fs.readFileSync(checksumPath);
      assert.equal(checksum.includes(0x0d), false, `${packageType} checksum contains CRLF`);
      assert.equal(checksum.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, `${packageType} checksum contains a BOM`);
      assert.match(
        checksum.toString("ascii"),
        new RegExp(`^[A-F0-9]{64}  ${releasePrefix}${packageType}-${revision}\\.zip\\n$`),
      );

      const manifestBytes = fs.readFileSync(path.join(extracted[packageType], "RELEASE-MANIFEST.txt"));
      assert.equal(manifestBytes.includes(0x0d), false, `${packageType} manifest contains CRLF`);
      assert.equal(manifestBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, `${packageType} manifest contains a BOM`);
      const manifest = manifestBytes.toString("utf8");
      const entries = manifestEntries(manifest);
      assert.ok(entries.length > 0, `${packageType} manifest must contain file entries`);
      assert.equal(entries.some(({ relative }) => relative.includes("\\")), false, `${packageType} manifest contains Windows paths`);
      assert.deepEqual(
        entries.map(({ relative }) => relative).sort(),
        packageFiles(extracted[packageType]).filter((file) => file !== "RELEASE-MANIFEST.txt"),
      );
    }

    const staticFiles = packageFiles(extracted.static);
    for (const page of productionPages) assert.ok(staticFiles.includes(page), `static package misses ${page}`);
    for (const file of [
      "assets/css/visual-v1.1.css",
      "assets/js/core/runtime.js",
      "assets/js/core/session-coordinator.js",
      "assets/js/theme/theme-controller.js",
      "assets/js/profile/avatar.js",
      "assets/js/security/form-guard.js",
      "assets/js/security/sensitive-lexicon.js",
    ]) assert.ok(staticFiles.includes(file), `static package misses ${file}`);
    assert.equal(
      staticFiles.some((file) => /^(?:supabase|tests|docs|output)\//.test(file) || /(?:^|\/)\.env(?:\.|$)/.test(file)),
      false,
      "static package contains a forbidden backend, test, documentation, output, or secret path",
    );
    assert.equal(staticFiles.some((file) => /(?:^|\/)docs\//.test(file)), false, "static package contains source metadata docs");
    assert.equal(
      staticFiles.some((file) => file.startsWith("assets/data/sensitive-lexicon-source/")),
      false,
      "static package contains DFA source lexicon metadata",
    );

    const backendFiles = packageFiles(extracted.backend);
    for (const file of [
      "supabase/schema.sql",
      "supabase/migrations/20260812_v1_1_avatar.sql",
      "supabase/functions/avatar-upload/index.ts",
      "supabase/functions/_shared/content-guard.ts",
      "supabase/functions/_shared/image-validation.ts",
      "supabase/functions/_shared/tencent-ims.ts",
      "docs/COMMUNITY_RELEASE_RUNBOOK.md",
    ]) assert.ok(backendFiles.includes(file), `backend package misses ${file}`);
    assert.equal(backendFiles.some((file) => productionPages.includes(file)), false, "backend package contains browser pages");
    assert.equal(
      backendFiles.some((file) => /^(?:tests|output)\//.test(file) || /(?:^|\/)\.env(?:\.|$)/.test(file)),
      false,
      "backend package contains a forbidden test, output, or secret path",
    );
  } finally {
    fs.rmSync(extractRoot, { force: true, recursive: true });
    for (const packageType of ["static", "backend"]) {
      for (const generatedPath of generatedPaths(packageType)) {
        fs.rmSync(generatedPath, { force: true, recursive: true });
      }
    }
  }
});
