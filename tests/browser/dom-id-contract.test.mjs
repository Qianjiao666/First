import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PRODUCTION_PAGES } from "./production-pages.mjs";

const root = new URL("../../", import.meta.url);
const FROZEN_IDS = Object.freeze({
  "index.html": ["mkj-header","mkj-menu-button","mkj-nav","mkj-log-button","mkj-account-button","home","mkj-typewriter","features","process","assessment","mkj-assessment-shell","mkj-question-label","mkj-current-step","mkj-total-step","mkj-progress-bar","mkj-question-stage","mkj-question-dimension","mkj-question-title","mkj-question-helper","mkj-options","mkj-prev-button","mkj-save-progress","mkj-assessment-hint","mkj-report","mkj-report-title","mkj-restart-button","mkj-radar-title","mkj-radar-canvas","mkj-score-heading","mkj-report-score","mkj-report-level","mkj-report-summary","mkj-strongest","mkj-weakest","mkj-card-button","mkj-recommendations-title","mkj-recommendations","stats","testimonials","mkj-carousel-prev","mkj-testimonial-track","mkj-carousel-next","mkj-carousel-dots","faq","mkj-faq-list","team","articles","contact","mkj-back-top","mkj-support-button","mkj-support-menu","mkj-changelog-modal","mkj-changelog-title","mkj-auth-modal","mkj-auth-title","mkj-auth-copy","mkj-auth-session","mkj-auth-session-avatar","mkj-auth-session-name","mkj-auth-session-email","mkj-auth-logout","mkj-reputation-panel","mkj-reputation-value","mkj-reputation-meta","mkj-redeem-panel","mkj-redeem-title","mkj-redeem-form","mkj-redeem-message","mkj-auth-tabs","mkj-login-form","mkj-register-form","mkj-resend-confirmation","mkj-reset-form","mkj-update-password-form","mkj-auth-hint","mkj-auth-message","mkj-benefit-modal","mkj-benefit-title","mkj-benefit-form","mkj-benefit-note","mkj-card-modal","mkj-card-title","mkj-card-canvas","mkj-download-card","mkj-card-note"],
  "community/index.html": ["community-modules-title"],
  "forum/index.html": ["forum-stream-title"],
  "forum/c/index.html": ["forum-category-title"],
  "forum/p/index.html": ["forum-comments-heading"],
  "forum/new/index.html": [],
  "tasks/index.html": ["task-page-title","task-listing-template"],
  "tasks/create/index.html": [],
  "tasks/detail/index.html": ["task-apply-dialog","task-apply-form","task-apply-title"],
  "tasks/my/index.html": ["task-my-title","task-submit-dialog","task-submit-form","task-submit-title","task-my-item-template"],
  "shop/index.html": ["shop-title","shop-products-title","shop-orders","shop-orders-title"],
  "announcements/index.html": ["announce-editor-title","announce-list-title"],
  "admin/index.html": [],
  "admin/users/index.html": [],
  "admin/forum/index.html": [],
  "admin/redeem-codes/index.html": [],
  "admin/sensitive-words/index.html": [],
  "admin/account-transfer/index.html": [],
  "admin/tasks/index.html": ["task-review-dialog","task-review-title","task-category-dialog","task-category-title"],
  "admin/tasks/edit/index.html": ["task-editor-form"],
});

function extractIds(source) {
  return [...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

test("the frozen DOM id contract covers every production page", () => {
  assert.deepEqual(Object.keys(FROZEN_IDS), [...PRODUCTION_PAGES]);
});

test("v1.1 preserves every existing production DOM id", async () => {
  for (const page of PRODUCTION_PAGES) {
    const source = await fs.readFile(fileURLToPath(new URL(page, root)), "utf8");
    const actualIds = extractIds(source);
    assert.equal(new Set(actualIds).size, actualIds.length, `${page} contains duplicate ids`);
    for (const id of FROZEN_IDS[page]) {
      assert.ok(actualIds.includes(id), `${page} lost #${id}`);
    }
  }
});
