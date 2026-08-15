export type SensitiveWordLevel = "WARN" | "MUTE";

export type SensitiveWord = {
  word: string;
  level: SensitiveWordLevel;
};

export type FilterResult = {
  text: string;
  severity: "NONE" | SensitiveWordLevel;
  matches: string[];
};

type ServiceClient = {
  from: (table: string) => {
    select: (columns: string) => Promise<{ data: SensitiveWord[] | null; error: { message: string } | null }>;
  };
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
};

function escapeExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedWord(value: string): string {
  return value.normalize("NFKC").trim();
}

export function filterText(text: string, words: SensitiveWord[]): FilterResult {
  const normalizedTerms = words
    .map((entry) => ({ ...entry, word: normalizedWord(entry.word) }))
    .filter((entry) => entry.word.length > 0)
    .sort((left, right) => right.word.length - left.word.length);

  let filteredText = String(text ?? "").normalize("NFKC");
  const matches: string[] = [];
  let severity: FilterResult["severity"] = "NONE";

  for (const entry of normalizedTerms) {
    const matcher = new RegExp(escapeExpression(entry.word), "giu");
    if (!matcher.test(filteredText)) continue;

    if (!matches.includes(entry.word)) matches.push(entry.word);
    if (entry.level === "MUTE") severity = "MUTE";
    else if (severity === "NONE") severity = "WARN";

    filteredText = filteredText.replace(matcher, "***");
  }

  return { text: filteredText, severity, matches };
}

export function assertSensitiveWriteAllowed(result: FilterResult): void {
  if (result.severity === "MUTE") {
    throw new ApiError("MUTED", 403, "命中禁言级敏感词，本次写入未保存。");
  }
}

export async function replaceSensitive(
  client: ServiceClient,
  input: { text: string; userId: string; enforceMute: boolean },
): Promise<FilterResult & { mutedUntil: string | null }> {
  const { data, error } = await client.from("sensitive_words").select("word, level");
  if (error) throw new Error("Unable to load sensitive-word rules");

  const result = filterText(input.text, data ?? []);
  if (result.severity !== "MUTE" || !input.enforceMute) {
    return { ...result, mutedUntil: null };
  }

  const mutedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: muteError } = await client.rpc("set_user_mute", {
    p_user_id: input.userId,
    p_muted_until: mutedUntil,
    p_actor_id: input.userId,
  });
  if (muteError) throw new Error("Unable to apply moderation action");

  return { ...result, mutedUntil };
}
import { ApiError } from "./http.ts";
