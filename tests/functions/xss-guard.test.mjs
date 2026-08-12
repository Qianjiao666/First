import test from "node:test";
import assert from "node:assert/strict";

import { inspectXss as inspectBrowserXss } from "../../assets/js/security/xss-guard.js";
import { inspectXss as inspectBackendXss } from "../../supabase/functions/_shared/xss-guard.ts";

const attacks = [
  "<script>alert(1)</script>",
  "<ScRiPt>alert(1)</sCrIpT>",
  "&lt;script&gt;alert(1)&lt;/script&gt;",
  '<img src=x onerror="alert(1)">',
  '<a href="javascript:alert(1)">click</a>',
  '<a href="java&#x73;cript:alert(1)">click</a>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="data:text/html,<script>alert(1)</script>"></object>',
  '<embed src="data:text/html;base64,PHNjcmlwdD4=">',
  '<svg onload="alert(1)"></svg>',
];

test("browser and backend XSS guards reject active content after canonicalization", () => {
  for (const input of attacks) {
    const browser = inspectBrowserXss(input);
    const backend = inspectBackendXss(input);
    assert.equal(browser.dangerous, true, input);
    assert.deepEqual(backend, browser, input);
    assert.ok(browser.reason);
  }
});

test("ordinary text and comparison symbols remain valid", () => {
  const safe = [
    "1 < 2，且 3 > 2。",
    "普通中文标点：你好！求职进展如何？",
    "我在 JavaScript 项目中处理 data:text/plain 文本。",
    "使用 SVG 图片格式制作作品集。",
  ];

  for (const input of safe) {
    assert.deepEqual(inspectBrowserXss(input), { dangerous: false, reason: null });
    assert.deepEqual(inspectBackendXss(input), { dangerous: false, reason: null });
  }
});
