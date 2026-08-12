import { buildDfa, filterWithDfa, type DfaEntry } from "./dfa.ts";
import { ApiError } from "./http.ts";
import {
  CUSTOM_BLOCK_WORDS,
  CUSTOM_WARN_WORDS,
  DEFAULT_BLOCK_WORDS,
  OPEN_SOURCE_WARN_WORDS,
} from "./sensitive-lexicon.ts";
import { inspectXss } from "./xss-guard.ts";

export type GuardPublicTextOptions = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  warnWords?: readonly string[];
  blockWords?: readonly string[];
};

const defaultWarnWords = Object.freeze([...OPEN_SOURCE_WARN_WORDS, ...CUSTOM_WARN_WORDS]);
const defaultBlockWords = Object.freeze([...DEFAULT_BLOCK_WORDS, ...CUSTOM_BLOCK_WORDS]);
let defaultDfa: ReturnType<typeof buildDfa> | null = null;

function entries(warnWords: readonly string[], blockWords: readonly string[]): DfaEntry[] {
  return [
    ...warnWords.map((word) => ({ word, severity: "WARN" as const })),
    ...blockWords.map((word) => ({ word, severity: "BLOCK" as const })),
  ];
}

function dfaFor(options: GuardPublicTextOptions) {
  const usesDefaults = options.warnWords === undefined && options.blockWords === undefined;
  if (usesDefaults) return defaultDfa ??= buildDfa(entries(defaultWarnWords, defaultBlockWords));
  return buildDfa(entries(options.warnWords ?? defaultWarnWords, options.blockWords ?? defaultBlockWords));
}

export function guardPublicText(value: unknown, options: GuardPublicTextOptions = {}) {
  if (typeof value !== "string") {
    throw new ApiError("VALIDATION_ERROR", 400, "提交内容格式不正确。");
  }
  const text = value;
  const normalizedLength = [...text.normalize("NFKC")].length;
  if (options.required && !text.trim()) throw new ApiError("VALIDATION_ERROR", 400, "请填写完整内容。");
  if (options.minLength !== undefined && normalizedLength < options.minLength) {
    throw new ApiError("VALIDATION_ERROR", 400, "提交内容过短。");
  }
  if (options.maxLength !== undefined && normalizedLength > options.maxLength) {
    throw new ApiError("VALIDATION_ERROR", 400, "提交内容过长。");
  }

  const xss = inspectXss(text);
  if (xss.dangerous) throw new ApiError("XSS_BLOCKED", 403, "检测到可能执行脚本的内容，请修改后重试。");

  const result = filterWithDfa(text, dfaFor(options));
  if (result.severity === "BLOCK") {
    throw new ApiError("CONTENT_BLOCKED", 403, "内容包含高风险信息，本次提交未保存。");
  }
  return result;
}
