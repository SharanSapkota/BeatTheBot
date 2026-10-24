import type { EditorClaim } from "@voita_kone/shared_types";

export type TextSegment =
  { kind: "text"; text: string } | { kind: "claim"; text: string; claim: EditorClaim };

interface Match {
  start: number;
  end: number;
  claim: EditorClaim;
}

/** First place of the claim in the body that does not overlap an earlier match, or null. */
function find_free_match(body: string, claim: EditorClaim, taken: Match[]): Match | null {
  if (claim.claim === "") {
    return null;
  }
  let start = body.indexOf(claim.claim);
  while (start !== -1) {
    const end = start + claim.claim.length;
    const overlaps = taken.some((match) => start < match.end && end > match.start);
    if (!overlaps) {
      return { start, end, claim };
    }
    start = body.indexOf(claim.claim, start + 1);
  }
  return null;
}

/**
 * Splits the story body into plain text and claim segments (each claim marked once where its
 * text appears). Claims whose text is not in the body are returned in `unplaced`.
 */
export function split_by_claims(
  body: string,
  claims: EditorClaim[],
): { segments: TextSegment[]; unplaced: EditorClaim[] } {
  const matches: Match[] = [];
  const unplaced: EditorClaim[] = [];
  // Longer claims first, so "Kärpät beat Ilves 3–1" wins over "3–1".
  const by_length = [...claims].sort((a, b) => b.claim.length - a.claim.length);
  for (const claim of by_length) {
    const match = find_free_match(body, claim, matches);
    if (match) {
      matches.push(match);
    } else {
      unplaced.push(claim);
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let position = 0;
  for (const match of matches) {
    if (match.start > position) {
      segments.push({ kind: "text", text: body.slice(position, match.start) });
    }
    segments.push({ kind: "claim", text: body.slice(match.start, match.end), claim: match.claim });
    position = match.end;
  }
  if (position < body.length) {
    segments.push({ kind: "text", text: body.slice(position) });
  }
  return { segments, unplaced: claims.filter((claim) => unplaced.includes(claim)) };
}

/** The fact ids cited by any claim. */
export function cited_fact_ids(claims: EditorClaim[]): Set<string> {
  return new Set(claims.flatMap((claim) => claim.fact_ids));
}

/** A fact value as one line, e.g. "home_goals: 3, away_goals: 1". */
export function format_fact_value(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, item]) => {
      const text =
        typeof item === "string" || typeof item === "number" || typeof item === "boolean"
          ? String(item)
          : JSON.stringify(item);
      return `${key}: ${text}`;
    })
    .join(", ");
}
