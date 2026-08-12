const NAMED_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  amp: "&",
  colon: ":",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  apos: "'",
});

export type XssInspection = { dangerous: boolean; reason: string | null };

function decodeEntities(value: unknown): string {
  let decoded = String(value ?? "").normalize("NFKC");
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);?/giu, (entity, token: string) => {
      const lower = token.toLowerCase();
      if (lower.startsWith("#x")) {
        const codePoint = Number.parseInt(lower.slice(2), 16);
        return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
      }
      if (lower.startsWith("#")) {
        const codePoint = Number.parseInt(lower.slice(1), 10);
        return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
      }
      return NAMED_ENTITIES[lower] ?? entity;
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function inspectXss(value: unknown): XssInspection {
  const canonical = decodeEntities(value);
  const activeTag = /<\s*\/?\s*(?:script|iframe|object|embed|svg)\b/iu;
  const eventAttribute = /<[^>]*\bon[a-z][a-z0-9_-]*\s*=/iu;
  const executableProtocol = /(?:javascript\s*:|data\s*:\s*text\/html)/iu;

  if (activeTag.test(canonical)) return { dangerous: true, reason: "检测到可执行标签。" };
  if (eventAttribute.test(canonical)) return { dangerous: true, reason: "检测到脚本事件属性。" };
  if (executableProtocol.test(canonical)) return { dangerous: true, reason: "检测到可执行链接协议。" };
  return { dangerous: false, reason: null };
}

export { decodeEntities };
