import { extract_claims, find_unknown_person_names, type Claim, type ClaimType } from "./claims";
import { strip_fact_ids } from "./fact_ids";
import type { FactSheet, KnownName } from "./fact_sheet";

// Matches every claim in a text against the fact sheet. Each claim is verified (with the facts
// that support it), not_found (nothing in the sheet, and the sentence cites no fact) or wrong
// (it contradicts the sheet: a cited sentence says something no fact says, a real player or
// team that is not in the sheet, or a name nobody knows).

export type ClaimStatus = "verified" | "not_found" | "wrong";

export interface ClassifiedClaim {
  claim: string;
  type: ClaimType;
  status: ClaimStatus;
  /** Facts that support a verified claim; for other claims the facts the sentence cited. */
  fact_ids: string[];
  /** Why the claim is not verified; null when verified. */
  reason: string | null;
}

export interface FailedClaim {
  claim: string;
  type: ClaimType;
  reason: string;
}

export interface CheckResult {
  passed: boolean;
  claims_checked: number;
  failed_claims: FailedClaim[];
}

/** Percentages may be rounded: 27% matches 26.5–27.5% (0.265–0.275). */
const PERCENT_TOLERANCE_POINTS = 0.5;
/** Floating-point slack, so 0.705 still rounds to 71%. */
const EPSILON = 1e-9;
/** The "top 4" table line of the top_4 stake. */
const TOP_SPOTS = 4;

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

type FactIndex = Map<string, string[]>;

/** Everything the fact sheet allows the text to say, in comparable forms, with its facts. */
interface Allowed {
  names: FactIndex;
  last_names: FactIndex;
  probabilities: { value: number; fact_id: string }[];
  integers: FactIndex;
  scores: FactIndex;
  game_times: FactIndex;
  /** "MM-DD" of every date in the sheet. */
  month_days: FactIndex;
  iso_dates: FactIndex;
  weekdays: FactIndex;
}

function last_name(full_name: string): string {
  return full_name.split(" ").at(-1) ?? full_name;
}

function add(index: FactIndex, key: string | number, fact_id: string): void {
  const text = String(key);
  const ids = index.get(text) ?? [];
  if (!ids.includes(fact_id)) {
    ids.push(fact_id);
  }
  index.set(text, ids);
}

function add_score(allowed: Allowed, first: number, second: number, fact_id: string): void {
  add(allowed.scores, `${String(first)}-${String(second)}`, fact_id);
  add(allowed.scores, `${String(second)}-${String(first)}`, fact_id);
}

function add_player(allowed: Allowed, player: string, fact_id: string): void {
  add(allowed.names, player, fact_id);
  add(allowed.last_names, last_name(player), fact_id);
}

function collect_allowed(sheet: FactSheet): Allowed {
  const allowed: Allowed = {
    names: new Map(),
    last_names: new Map(),
    probabilities: [],
    integers: new Map(),
    scores: new Map(),
    game_times: new Map(),
    month_days: new Map(),
    iso_dates: new Map(),
    weekdays: new Map(),
  };
  for (const fact of sheet.facts) {
    const id = fact.fact_id;
    const name = (value: string) => add(allowed.names, value, id);
    const integer = (value: number) => add(allowed.integers, value, id);
    const probability = (value: number) => allowed.probabilities.push({ value, fact_id: id });
    const date = (value: string) => {
      add(allowed.iso_dates, value, id);
      add(allowed.month_days, value.slice(5), id);
    };
    switch (fact.type) {
      case "final_score": {
        const { value } = fact;
        name(value.home_team);
        name(value.away_team);
        integer(value.home_goals);
        integer(value.away_goals);
        add_score(allowed, value.home_goals, value.away_goals, id);
        date(value.date);
        break;
      }
      case "goal": {
        const { value } = fact;
        add_player(allowed, value.player, id);
        name(value.team);
        integer(value.period);
        add(allowed.game_times, value.game_time, id);
        add_score(allowed, value.score_after.home, value.score_after.away, id);
        break;
      }
      case "winning_goal": {
        const { value } = fact;
        add_player(allowed, value.player, id);
        name(value.team);
        add(allowed.game_times, value.game_time, id);
        break;
      }
      case "standing": {
        const { value } = fact;
        name(value.team);
        for (const number of [
          value.rank_before,
          value.rank_after,
          value.points_before,
          value.points_after,
        ]) {
          integer(number);
        }
        integer(Math.abs(value.points_after - value.points_before));
        break;
      }
      case "season_odds": {
        const { value } = fact;
        name(value.team);
        probability(value.before);
        probability(value.after);
        if (value.kind === "top_4") {
          // "top-4 chance": the 4 is the table line, part of the stake's name.
          integer(TOP_SPOTS);
        }
        // "7 percentage points": the change, rounded like the percentages.
        integer(Math.round(Math.abs(value.after - value.before) * 100));
        break;
      }
      case "next_game": {
        const { value } = fact;
        name(value.team);
        name(value.opponent);
        add(allowed.weekdays, value.weekday, id);
        date(value.date);
        break;
      }
      case "form": {
        const { value } = fact;
        name(value.team);
        integer(value.wins);
        integer(value.draws);
        integer(value.losses);
        integer(value.games);
        break;
      }
      case "head_to_head": {
        const { value } = fact;
        name(value.home_team);
        name(value.away_team);
        add_score(allowed, value.home_goals, value.away_goals, id);
        date(value.date);
        break;
      }
      case "home_away_record": {
        const { value } = fact;
        name(value.team);
        integer(value.wins);
        integer(value.draws);
        integer(value.losses);
        integer(value.games);
        break;
      }
      case "season_series": {
        const { value } = fact;
        name(value.home_team);
        name(value.away_team);
        for (const number of [
          value.home_team_wins,
          value.away_team_wins,
          value.draws,
          value.games,
        ]) {
          integer(number);
        }
        break;
      }
      case "lead_changes": {
        const { value } = fact;
        integer(value.lead_changes);
        if (value.comeback) {
          name(value.comeback.team);
          integer(value.comeback.from_behind);
        }
        break;
      }
      case "player_form": {
        const { value } = fact;
        add_player(allowed, value.player, id);
        name(value.team);
        integer(value.goals);
        integer(value.games);
        break;
      }
      case "table_position": {
        const { value } = fact;
        name(value.team);
        integer(value.rank);
        integer(value.points);
        integer(value.games_played);
        break;
      }
      case "win_chance": {
        const { value } = fact;
        name(value.home_team);
        name(value.away_team);
        probability(value.home_win);
        probability(value.away_win);
        break;
      }
      case "stake": {
        const { value } = fact;
        name(value.team);
        probability(value.if_win);
        probability(value.if_loss);
        if (value.kind === "top_4") {
          integer(TOP_SPOTS);
        }
        break;
      }
    }
  }
  return allowed;
}

function parse_number(text: string): number {
  return Number(text.replace(",", "."));
}

function digits(text: string): number[] {
  return [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

function pad(number: number): string {
  return String(number).padStart(2, "0");
}

/** Every alias of a known name points to its main name. */
function build_name_index(known_names: readonly KnownName[]): Map<string, KnownName> {
  const index = new Map<string, KnownName>();
  for (const known of known_names) {
    for (const form of [known.name, ...(known.aliases ?? [])]) {
      index.set(form, known);
    }
    if (known.kind === "player") {
      const last = last_name(known.name);
      // A last name shared by several players stays mapped to the first; the check accepts
      // it when any player with that last name is in the sheet.
      if (!index.has(last)) {
        index.set(last, known);
      }
    }
  }
  return index;
}

interface Match {
  fact_ids: string[] | null;
  /** Used when nothing matches. */
  reason: string;
}

function match_name(claim: Claim, index: Map<string, KnownName>, allowed: Allowed): Match | null {
  const known = index.get(claim.text);
  if (!known) {
    return null;
  }
  const is_last_name_only =
    known.kind === "player" && claim.text !== known.name && !known.aliases?.includes(claim.text);
  if (is_last_name_only) {
    return {
      fact_ids: allowed.last_names.get(claim.text) ?? null,
      reason: `${claim.text} is not in the fact sheet`,
    };
  }
  return {
    fact_ids: allowed.names.get(known.name) ?? null,
    reason: `${known.name} is not in the fact sheet`,
  };
}

function match_claim(claim: Claim, allowed: Allowed): Match {
  switch (claim.type) {
    case "name":
      return { fact_ids: null, reason: "unknown name" };
    case "percent": {
      const points = parse_number(claim.text.replace(/[^\d.,]/g, ""));
      const ids = allowed.probabilities
        .filter(
          (probability) =>
            Math.abs(probability.value * 100 - points) <= PERCENT_TOLERANCE_POINTS + EPSILON,
        )
        .map((probability) => probability.fact_id);
      return {
        fact_ids: ids.length > 0 ? [...new Set(ids)] : null,
        reason: "no matching probability",
      };
    }
    case "score": {
      const [first = -1, second = -1] = digits(claim.text);
      return {
        fact_ids: allowed.scores.get(`${String(first)}-${String(second)}`) ?? null,
        reason: "no matching score",
      };
    }
    case "game_time": {
      const [minutes = 0, seconds = 0] = digits(claim.text);
      return {
        fact_ids: allowed.game_times.get(`${pad(minutes)}:${pad(seconds)}`) ?? null,
        reason: "no matching goal time",
      };
    }
    case "ordinal":
    case "number": {
      const value = parse_number(
        claim.type === "ordinal" ? claim.text.replace(/\D/g, "") : claim.text,
      );
      return {
        fact_ids: Number.isInteger(value) ? (allowed.integers.get(String(value)) ?? null) : null,
        reason: "number not in the fact sheet",
      };
    }
    case "date": {
      if (/^\d{4}-/.test(claim.text)) {
        return { fact_ids: allowed.iso_dates.get(claim.text) ?? null, reason: "no matching date" };
      }
      const month_word = /[a-z]+/i.exec(claim.text)?.[0];
      const [day = 0, month_digit = 0] = digits(claim.text);
      const month = month_word
        ? (MONTH_NUMBERS[month_word.slice(0, 3).toLowerCase()] ?? 0)
        : month_digit;
      return {
        fact_ids: allowed.month_days.get(`${pad(month)}-${pad(day)}`) ?? null,
        reason: "no matching date",
      };
    }
    case "weekday":
      return { fact_ids: allowed.weekdays.get(claim.text) ?? null, reason: "no matching day" };
  }
}

/** Claim types that must match a fact even without a citation (editor texts have none). */
const STRICT_TYPES = new Set<ClaimType>(["score", "percent", "game_time", "date"]);

const FACT_IDS_PATTERN = /\[(f\d+(?:\s*,\s*f\d+)*)\]/g;

/** The text split into sentences (and bullet lines), each with the fact ids it cites. */
function sentences_of(text: string): { text: string; cited: string[] }[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=\S)/)
    .map((sentence) => ({
      text: strip_fact_ids(sentence),
      cited: [...sentence.matchAll(FACT_IDS_PATTERN)].flatMap((match) =>
        (match[1] ?? "").split(",").map((id) => id.trim()),
      ),
    }))
    .filter((sentence) => sentence.text.length > 0);
}

function classify_sentence(
  text: string,
  cited: readonly string[],
  index: Map<string, KnownName>,
  allowed: Allowed,
  detect_unknown_names: boolean,
): ClassifiedClaim[] {
  const claims = extract_claims(text, [...index.keys()]);
  const result = claims.map((claim): ClassifiedClaim => {
    const name_match = claim.type === "name" ? match_name(claim, index, allowed) : null;
    const match = name_match ?? match_claim(claim, allowed);
    if (match.fact_ids !== null) {
      return {
        claim: claim.text,
        type: claim.type,
        status: "verified",
        fact_ids: match.fact_ids,
        reason: null,
      };
    }
    // A real player or team that is not in the sheet, a score, percentage, goal time or date
    // that no fact has, or a value that contradicts the facts the sentence cites, is wrong.
    // Any other value we can't find (a plain number, an ordinal) is only not found.
    const status =
      claim.type === "name" || STRICT_TYPES.has(claim.type) || cited.length > 0
        ? "wrong"
        : "not_found";
    return {
      claim: claim.text,
      type: claim.type,
      status,
      fact_ids: [...cited],
      reason: match.reason,
    };
  });
  if (detect_unknown_names) {
    for (const name of find_unknown_person_names(text, [...index.keys()], claims)) {
      result.push({
        claim: name,
        type: "name",
        status: "wrong",
        fact_ids: [...cited],
        reason: `${name} is not a known player or team (invented name?)`,
      });
    }
  }
  return result;
}

/**
 * Every claim of an AI text, sentence by sentence. Sentences may end with the fact ids they
 * use ("[f3, f4]"). Also flags person-like names that no known player or team has.
 */
export function classify_claims(
  text: string,
  sheet: FactSheet,
  known_names: readonly KnownName[],
): ClassifiedClaim[] {
  const index = build_name_index(known_names);
  const allowed = collect_allowed(sheet);
  return sentences_of(text).flatMap((sentence) =>
    classify_sentence(sentence.text, sentence.cited, index, allowed, true),
  );
}

/**
 * Checks every claim in the text against the fact sheet: numbers exactly, percentages
 * rounded, scores, goal times, dates and names. A real Liiga team or player that is not in the
 * sheet fails (no invented players). Names unknown to `known_names` are not checked. Passes
 * only when every claim is verified (used for code-built texts such as the result quiz).
 */
export function check_claims(
  text: string,
  sheet: FactSheet,
  known_names: readonly KnownName[],
): CheckResult {
  const index = build_name_index(known_names);
  const allowed = collect_allowed(sheet);
  const claims = classify_sentence(text, [], index, allowed, false);
  const failed_claims = claims.flatMap((claim) =>
    claim.status === "verified"
      ? []
      : [{ claim: claim.claim, type: claim.type, reason: claim.reason ?? "" }],
  );
  return { passed: failed_claims.length === 0, claims_checked: claims.length, failed_claims };
}
