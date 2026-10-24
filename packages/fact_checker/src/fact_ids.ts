import type { FactSheet } from "./fact_sheet";

// The LLM ends every factual sentence with its fact ids, e.g. "[f3]" or "[f3, f4]". They are
// checked against the sheet and removed before publishing.

const FACT_IDS_PATTERN = /\s*\[(f\d+(?:\s*,\s*f\d+)*)\]/g;

/** Cited ids that are not in the fact sheet. */
export function find_unknown_fact_ids(text: string, sheet: FactSheet): string[] {
  const known = new Set(sheet.facts.map((fact) => fact.fact_id));
  const cited = [...text.matchAll(FACT_IDS_PATTERN)].flatMap((match) =>
    (match[1] ?? "").split(",").map((id) => id.trim()),
  );
  return [...new Set(cited.filter((id) => !known.has(id)))];
}

export function strip_fact_ids(text: string): string {
  return text
    .replace(FACT_IDS_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
