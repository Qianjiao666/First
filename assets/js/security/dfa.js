const SEVERITY_RANK = Object.freeze({ NONE: 0, WARN: 1, BLOCK: 2 });

function normalizeTerm(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function keyFor(value) {
  return normalizeTerm(value).toLowerCase();
}

function preferredEntry(current, candidate) {
  if (!current) return candidate;
  const currentRank = SEVERITY_RANK[current.severity] ?? 0;
  const candidateRank = SEVERITY_RANK[candidate.severity] ?? 0;
  if (candidateRank !== currentRank) return candidateRank > currentRank ? candidate : current;
  return candidate.word.localeCompare(current.word) < 0 ? candidate : current;
}

export function buildDfa(words = []) {
  const root = { children: new Map(), terminal: null };
  for (const value of words) {
    const entry = typeof value === "string" ? { word: value, severity: "WARN" } : value;
    const word = normalizeTerm(entry?.word);
    const key = keyFor(word);
    if (!key) continue;
    let node = root;
    for (const character of [...key]) {
      if (!node.children.has(character)) node.children.set(character, { children: new Map(), terminal: null });
      node = node.children.get(character);
    }
    node.terminal = preferredEntry(node.terminal, {
      word,
      severity: entry?.severity === "BLOCK" ? "BLOCK" : "WARN",
    });
  }
  return root;
}

function normalizedView(value) {
  const source = [...String(value ?? "")];
  const comparable = [];
  const sourceIndexes = [];
  source.forEach((character, sourceIndex) => {
    for (const normalized of [...character.normalize("NFKC").toLowerCase()]) {
      comparable.push(normalized);
      sourceIndexes.push(sourceIndex);
    }
  });
  return { source, comparable, sourceIndexes };
}

export function filterWithDfa(value, dfa) {
  const { source, comparable, sourceIndexes } = normalizedView(value);
  const covered = new Array(source.length).fill(false);
  const matches = [];
  let severity = "NONE";

  for (let start = 0; start < comparable.length; start += 1) {
    let node = dfa;
    let best = null;
    for (let cursor = start; cursor < comparable.length; cursor += 1) {
      node = node?.children?.get(comparable[cursor]);
      if (!node) break;
      if (node.terminal) best = { end: cursor + 1, entry: node.terminal };
    }
    if (!best) continue;

    for (let cursor = start; cursor < best.end; cursor += 1) covered[sourceIndexes[cursor]] = true;
    if (!matches.includes(best.entry.word)) matches.push(best.entry.word);
    if ((SEVERITY_RANK[best.entry.severity] ?? 0) > (SEVERITY_RANK[severity] ?? 0)) {
      severity = best.entry.severity;
    }
  }

  return {
    text: source.map((character, index) => covered[index] ? "*" : character).join(""),
    matches,
    severity,
  };
}
