import { buildDfa, filterWithDfa } from "./dfa.js";
import {
  CUSTOM_BLOCK_WORDS,
  CUSTOM_WARN_WORDS,
  DEFAULT_BLOCK_WORDS,
  OPEN_SOURCE_WARN_WORDS,
} from "./sensitive-lexicon.js";
import { inspectXss } from "./xss-guard.js";

const defaultWarnWords = Object.freeze([...OPEN_SOURCE_WARN_WORDS, ...CUSTOM_WARN_WORDS]);
const defaultBlockWords = Object.freeze([...DEFAULT_BLOCK_WORDS, ...CUSTOM_BLOCK_WORDS]);
let defaultDfa = null;

function entries(warnWords, blockWords) {
  return [
    ...warnWords.map((word) => ({ word, severity: "WARN" })),
    ...blockWords.map((word) => ({ word, severity: "BLOCK" })),
  ];
}

function dfaFor(options) {
  if (options.warnWords === undefined && options.blockWords === undefined) {
    return defaultDfa ??= buildDfa(entries(defaultWarnWords, defaultBlockWords));
  }
  return buildDfa(entries(options.warnWords ?? defaultWarnWords, options.blockWords ?? defaultBlockWords));
}

function formValues(form) {
  try {
    return new FormData(form);
  } catch {
    return {
      get(name) {
        const control = form?.elements?.namedItem?.(name) ?? form?.elements?.[name];
        return control?.value ?? null;
      },
    };
  }
}

function showStatus(target, message, state) {
  if (!target) return;
  target.hidden = false;
  target.textContent = message;
  target.dataset.state = state;
  target.dataset.tone = state;
  target.dataset.announceTone = state;
}

function blockedError(code, message, statusTarget) {
  const error = Object.assign(new Error(message), { code });
  showStatus(statusTarget, message, "error");
  return error;
}

export function guardFormData(form, fieldNames, statusTarget = null, options = {}) {
  const data = formValues(form);
  const dfa = dfaFor(options);
  const values = {};
  const warnings = new Set();

  for (const fieldName of fieldNames) {
    const raw = data.get(fieldName);
    if (raw === null || raw === undefined) continue;
    const value = String(raw);
    if (inspectXss(value).dangerous) {
      throw blockedError("XSS_BLOCKED", "检测到可能执行脚本的内容，请修改后重试。", statusTarget);
    }
    const filtered = filterWithDfa(value, dfa);
    if (filtered.severity === "BLOCK") {
      throw blockedError("CONTENT_BLOCKED", "内容包含高风险信息，本次提交未保存。", statusTarget);
    }
    values[fieldName] = filtered.text;
    filtered.matches.forEach((match) => warnings.add(match));
  }

  if (warnings.size) showStatus(statusTarget, `检测并替换了 ${warnings.size} 项敏感内容。`, "warning");
  return { values, warnings: [...warnings] };
}
