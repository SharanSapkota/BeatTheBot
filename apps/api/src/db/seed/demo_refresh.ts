import type { SportId } from "@voita_kone/scoring";
import {
  SAMPLE_LEAGUES,
  build_game,
  type SampleFixture,
  type SampleGame,
  type SampleGoal,
  type SampleResult,
} from "./demo_sports";
import { add_days, get_helsinki_date, helsinki_time, type LocalDate } from "./helsinki_time";

// Football and basketball have no data API yet, so their sample fixtures are the real data for
// now. This keeps them current (pure, so it is tested without a database):
// - a sample game whose time has passed becomes a final with a demo result (the same result on
//   every run, from a hash of the game's id), so "Latest results" works;
// - every day of the coming week gets a sample game when it has none, so "Coming up" works.

type SampleSport = Exclude<SportId, "hockey">;

/** How many days ahead the sample schedule reaches (today included). */
export const SAMPLE_DAYS_AHEAD = 7;
/** A sample game is over this long after its start. */
export const SAMPLE_GAME_LENGTH_MS = 2 * 60 * 60 * 1000;
const KICK_OFF: Record<SampleSport, [number, number]> = {
  football: [18, 0],
  basketball: [18, 30],
};

/** 32-bit FNV-1a, so the same game always gets the same result. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** "demo:football:2026-10-24:ac_oulu-hjk" → its sport and team keys; null for other ids. */
export function parse_sample_id(
  external_id: string,
): { sport: SampleSport; home: string; away: string } | null {
  const match = /^demo:(football|basketball):[\d-]+:([a-z_]+)-([a-z_]+)$/.exec(external_id);
  if (!match) {
    return null;
  }
  return { sport: match[1] as SampleSport, home: match[2] ?? "", away: match[3] ?? "" };
}

/** A believable result: football 0–3 goals a side with scorers; basketball 70–99, no tie. */
export function demo_result(external_id: string, sport: SampleSport): SampleResult {
  const seed = hash(external_id);
  if (sport === "basketball") {
    const home = 70 + (seed % 30);
    let away = 70 + ((seed >>> 5) % 30);
    if (away === home) {
      away += 3;
    }
    const winner = home > away ? "home" : "away";
    return { home, away, goals: [], top_scorer: { side: winner, index: (seed >>> 10) % 5 } };
  }
  const home = seed % 4;
  const away = (seed >>> 3) % 3;
  // Goals alternate between the teams while both still have goals left; who scores first
  // comes from the hash. Minutes are spread over the 90.
  const left = { home, away };
  let side: "home" | "away" = (seed >>> 6) % 2 === 0 ? "home" : "away";
  const goals: SampleGoal[] = [];
  const total = home + away;
  for (let index = 0; index < total; index += 1) {
    if (left[side] === 0) {
      side = side === "home" ? "away" : "home";
    }
    left[side] -= 1;
    const minute = 6 + Math.floor((index * 80) / total) + ((seed >>> (index + 8)) % 8);
    goals.push({ side, scorer: 2 + ((seed >>> (index * 2 + 4)) % 3), minute });
    side = side === "home" ? "away" : "home";
  }
  return { home, away, goals };
}

/** The final of a passed sample game (same start), or null when the id is not a sample id. */
export function finish_sample_game(external_id: string, start_time: Date): SampleGame | null {
  const parsed = parse_sample_id(external_id);
  if (!parsed) {
    return null;
  }
  const day = get_helsinki_date(start_time);
  const fixture: SampleFixture = {
    ...parsed,
    day: 0,
    time: null,
    result: demo_result(external_id, parsed.sport),
  };
  return { ...build_game(fixture, start_time, day), external_id };
}

/** "YYYY-MM-DD" of a local date. */
export function sample_day_key(day: LocalDate): string {
  return `${String(day.year)}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

/** Days since 1970 of a local date: the pairing rotates by one each day. */
function day_number(day: LocalDate): number {
  return Math.floor(Date.UTC(day.year, day.month - 1, day.day) / (24 * 60 * 60 * 1000));
}

/**
 * New sample games for the days from today on (SAMPLE_DAYS_AHEAD) that have none for their sport.
 * `days_with_games` holds "sport:YYYY-MM-DD" keys (Helsinki days). Today's game is skipped when
 * its kick-off has already passed.
 */
export function plan_sample_games(now: Date, days_with_games: ReadonlySet<string>): SampleGame[] {
  const today = get_helsinki_date(now);
  const games: SampleGame[] = [];
  for (const league of SAMPLE_LEAGUES) {
    const [hour, minute] = KICK_OFF[league.sport];
    for (let offset = 0; offset < SAMPLE_DAYS_AHEAD; offset += 1) {
      const day = add_days(today, offset);
      if (days_with_games.has(`${league.sport}:${sample_day_key(day)}`)) {
        continue;
      }
      const start = helsinki_time(day, hour, minute);
      if (start <= now) {
        continue;
      }
      const count = league.teams.length;
      const turn = day_number(day);
      const home_index = turn % count;
      // A step that never lands on the home team, so the pairs change every day.
      const away_index = (home_index + 1 + (Math.floor(turn / count) % (count - 1))) % count;
      const fixture: SampleFixture = {
        sport: league.sport,
        home: league.teams[home_index]?.key ?? "",
        away: league.teams[away_index]?.key ?? "",
        day: offset,
        time: [hour, minute],
      };
      games.push(build_game(fixture, start, day));
    }
  }
  return games;
}
