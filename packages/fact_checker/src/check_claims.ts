import { extract_claims, type Claim, type ClaimType } from "./claims";
import type { FactSheet, KnownName } from "./fact_sheet";

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

/** Everything the fact sheet allows the text to say, in comparable forms. */
interface Allowed {
  names: Set<string>;
  last_names: Set<string>;
  probabilities: number[];
  integers: Set<number>;
  scores: Set<string>;
  game_times: Set<string>;
  /** "MM-DD" of every date in the sheet. */
  month_days: Set<string>;
  iso_dates: Set<string>;
  weekdays: Set<string>;
}

function last_name(full_name: string): string {
  return full_name.split(" ").at(-1) ?? full_name;
}

function add_score(allowed: Allowed, first: number, second: number): void {
  allowed.scores.add(`${String(first)}-${String(second)}`);
  allowed.scores.add(`${String(second)}-${String(first)}`);
}

function collect_allowed(sheet: FactSheet): Allowed {
  const allowed: Allowed = {
    names: new Set(),
    last_names: new Set(),
    probabilities: [],
    integers: new Set(),
    scores: new Set(),
    game_times: new Set(),
    month_days: new Set(),
    iso_dates: new Set(),
    weekdays: new Set(),
  };
  const add_date = (date: string) => {
    allowed.iso_dates.add(date);
    allowed.month_days.add(date.slice(5));
  };
  for (const fact of sheet.facts) {
    switch (fact.type) {
      case "final_score": {
        const { value } = fact;
        allowed.names.add(value.home_team).add(value.away_team);
        allowed.integers.add(value.home_goals).add(value.away_goals);
        add_score(allowed, value.home_goals, value.away_goals);
        add_date(value.date);
        break;
      }
      case "goal": {
        const { value } = fact;
        allowed.names.add(value.player).add(value.team);
        allowed.last_names.add(last_name(value.player));
        allowed.integers.add(value.period);
        allowed.game_times.add(value.game_time);
        add_score(allowed, value.score_after.home, value.score_after.away);
        break;
      }
      case "standing": {
        const { value } = fact;
        allowed.names.add(value.team);
        for (const number of [
          value.rank_before,
          value.rank_after,
          value.points_before,
          value.points_after,
        ]) {
          allowed.integers.add(number);
        }
        allowed.integers.add(Math.abs(value.points_after - value.points_before));
        break;
      }
      case "season_odds": {
        const { value } = fact;
        allowed.names.add(value.team);
        allowed.probabilities.push(value.before, value.after);
        if (value.kind === "top_4") {
          // "top-4 chance": the 4 is the table line, part of the stake's name.
          allowed.integers.add(TOP_SPOTS);
        }
        // "7 percentage points": the change, rounded like the percentages.
        allowed.integers.add(Math.round(Math.abs(value.after - value.before) * 100));
        break;
      }
      case "next_game": {
        const { value } = fact;
        allowed.names.add(value.team).add(value.opponent);
        allowed.weekdays.add(value.weekday);
        add_date(value.date);
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
      // A last name shared by several players stays mapped to the first; check_name
      // accepts it when any player with that last name is in the sheet.
      if (!index.has(last)) {
        index.set(last, known);
      }
    }
  }
  return index;
}

function check_name(claim: Claim, index: Map<string, KnownName>, allowed: Allowed): string | null {
  const known = index.get(claim.text);
  if (!known) {
    return null;
  }
  const is_last_name_only =
    known.kind === "player" && claim.text !== known.name && !known.aliases?.includes(claim.text);
  if (is_last_name_only) {
    return allowed.last_names.has(claim.text) ? null : `${claim.text} is not in the fact sheet`;
  }
  return allowed.names.has(known.name) ? null : `${known.name} is not in the fact sheet`;
}

function check_claim(claim: Claim, index: Map<string, KnownName>, allowed: Allowed): string | null {
  switch (claim.type) {
    case "name":
      return check_name(claim, index, allowed);
    case "percent": {
      const points = parse_number(claim.text.replace(/[^\d.,]/g, ""));
      return allowed.probabilities.some(
        (probability) => Math.abs(probability * 100 - points) <= PERCENT_TOLERANCE_POINTS + EPSILON,
      )
        ? null
        : "no matching probability";
    }
    case "score": {
      const [first = -1, second = -1] = digits(claim.text);
      return allowed.scores.has(`${String(first)}-${String(second)}`) ? null : "no matching score";
    }
    case "game_time": {
      const [minutes = 0, seconds = 0] = digits(claim.text);
      return allowed.game_times.has(`${pad(minutes)}:${pad(seconds)}`)
        ? null
        : "no matching goal time";
    }
    case "ordinal":
    case "number": {
      const value = parse_number(
        claim.type === "ordinal" ? claim.text.replace(/\D/g, "") : claim.text,
      );
      return Number.isInteger(value) && allowed.integers.has(value)
        ? null
        : "number not in the fact sheet";
    }
    case "date": {
      if (/^\d{4}-/.test(claim.text)) {
        return allowed.iso_dates.has(claim.text) ? null : "no matching date";
      }
      const month_word = /[a-z]+/i.exec(claim.text)?.[0];
      const [day = 0, month_digit = 0] = digits(claim.text);
      const month = month_word
        ? (MONTH_NUMBERS[month_word.slice(0, 3).toLowerCase()] ?? 0)
        : month_digit;
      return allowed.month_days.has(`${pad(month)}-${pad(day)}`) ? null : "no matching date";
    }
    case "weekday":
      return allowed.weekdays.has(claim.text) ? null : "no matching day";
  }
}

/**
 * Checks every claim in the text against the fact sheet: numbers exactly, percentages
 * rounded, scores, goal times, dates and names. A real Liiga team or player that is not in the
 * sheet fails (no invented players). Names unknown to `known_names` are not checked.
 */
export function check_claims(
  text: string,
  sheet: FactSheet,
  known_names: readonly KnownName[],
): CheckResult {
  const index = build_name_index(known_names);
  const allowed = collect_allowed(sheet);
  const claims = extract_claims(text, [...index.keys()]);
  const failed_claims: FailedClaim[] = [];
  for (const claim of claims) {
    const reason = check_claim(claim, index, allowed);
    if (reason !== null) {
      failed_claims.push({ claim: claim.text, type: claim.type, reason });
    }
  }
  return { passed: failed_claims.length === 0, claims_checked: claims.length, failed_claims };
}
