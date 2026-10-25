import type { MarginBand, SportId } from "@voita_kone/scoring";
import type { Transaction } from "kysely";
import { season_of } from "../../modules/admin_matches/match_rules";
import type { DB } from "../database_types";
import { KORISLIIGA_LEAGUE_ID, VEIKKAUSLIIGA_LEAGUE_ID } from "../leagues";
import { add_days, get_helsinki_date, helsinki_time, type LocalDate } from "./helsinki_time";

// Sample fixtures for the sports without a data API (football, basketball), all with
// data_source 'demo' (the app shows a "Sample data" badge). Real Finnish leagues and teams;
// every player name is invented. Today and this week, plus two finished days for the demo
// replay, the leaderboard and player form.

const DEMO = "demo";
const MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * MINUTE_MS;
/** Picks lock at kick-off, so the demo users picked before the game. */
const PICK_LEAD_TIME_MS = 3 * 60 * MINUTE_MS;
const PLAYERS_PER_TEAM = 5;

interface SampleTeam {
  key: string;
  name: string;
  short_name: string;
  city: string;
}

interface SampleLeague {
  sport: Exclude<SportId, "hockey">;
  league_id: string;
  key: string;
  teams: readonly SampleTeam[];
}

// prettier-ignore
export const SAMPLE_LEAGUES: readonly SampleLeague[] = [
  {
    sport: "football", league_id: VEIKKAUSLIIGA_LEAGUE_ID, key: "veikkausliiga",
    teams: [
      { key: "ac_oulu", name: "AC Oulu", short_name: "ACO", city: "Oulu" },
      { key: "hjk", name: "HJK", short_name: "HJK", city: "Helsinki" },
      { key: "kups", name: "KuPS", short_name: "KUP", city: "Kuopio" },
      { key: "sjk", name: "SJK", short_name: "SJK", city: "Seinäjoki" },
      { key: "inter", name: "FC Inter", short_name: "INT", city: "Turku" },
      { key: "ilves", name: "Ilves", short_name: "ILV", city: "Tampere" },
      { key: "lahti", name: "FC Lahti", short_name: "LAH", city: "Lahti" },
      { key: "vps", name: "VPS", short_name: "VPS", city: "Vaasa" },
    ],
  },
  {
    sport: "basketball", league_id: KORISLIIGA_LEAGUE_ID, key: "korisliiga",
    teams: [
      { key: "karhu", name: "Karhu Basket", short_name: "KAR", city: "Kauhajoki" },
      { key: "kataja", name: "Kataja Basket", short_name: "KAT", city: "Joensuu" },
      { key: "seagulls", name: "Helsinki Seagulls", short_name: "SEA", city: "Helsinki" },
      { key: "pyrinto", name: "Tampereen Pyrintö", short_name: "PYR", city: "Tampere" },
      { key: "vilpas", name: "Salon Vilpas", short_name: "VIL", city: "Salo" },
      { key: "kouvot", name: "Kouvot", short_name: "KOU", city: "Kouvola" },
    ],
  },
];

// Invented names only (16 × 23 combinations, never a real player on purpose).
const FIRST_NAMES = [
  "Aleksi",
  "Eetu",
  "Joonas",
  "Lauri",
  "Miro",
  "Niko",
  "Oskari",
  "Roope",
  "Santeri",
  "Teemu",
  "Valtteri",
  "Veeti",
  "Ville",
  "Onni",
  "Elias",
  "Leo",
];
const LAST_NAMES = [
  "Ahola",
  "Heikkilä",
  "Hiltunen",
  "Kangas",
  "Karjalainen",
  "Kemppainen",
  "Koskela",
  "Lehtonen",
  "Mattila",
  "Nieminen",
  "Peltola",
  "Rantanen",
  "Saarinen",
  "Turunen",
  "Väisänen",
  "Ylönen",
  "Laakso",
  "Honkanen",
  "Pesonen",
  "Rinne",
  "Salmi",
  "Tuominen",
  "Vuorinen",
];
/** Football roster order: keeper, defender, three forwards. Basketball has no positions. */
const FOOTBALL_POSITIONS = ["goalie", "defense", "forward", "forward", "forward"] as const;

export interface SamplePlayer {
  external_id: string;
  team_external_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number;
  position: string | null;
}

/** A goal by the player at `scorer` (roster index 2–4 = the forwards) of the home/away team. */
export interface SampleGoal {
  side: "home" | "away";
  scorer: number;
  minute: number;
}

export interface SampleResult {
  home: number;
  away: number;
  goals: readonly SampleGoal[];
  /** Basketball: roster index of the top scorer and their side. */
  top_scorer?: { side: "home" | "away"; index: number };
}

export interface SampleFixture {
  sport: Exclude<SportId, "hockey">;
  home: string;
  away: string;
  /** Days from today (negative = finished) and the Helsinki kick-off; null = in a few hours. */
  day: number;
  time: [number, number] | null;
  result?: SampleResult;
}

// prettier-ignore
const FIXTURES: readonly SampleFixture[] = [
  // Two days ago
  { sport: "football", home: "inter", away: "ilves", day: -2, time: [18, 0], result: { home: 0, away: 2, goals: [{ side: "away", scorer: 2, minute: 12 }, { side: "away", scorer: 4, minute: 88 }] } },
  { sport: "basketball", home: "vilpas", away: "kouvot", day: -2, time: [18, 30], result: { home: 75, away: 77, goals: [], top_scorer: { side: "away", index: 1 } } },
  // Yesterday: the demo replay day (a home win and a draw; two basketball games)
  { sport: "football", home: "ac_oulu", away: "hjk", day: -1, time: [17, 0], result: { home: 2, away: 1, goals: [{ side: "home", scorer: 2, minute: 23 }, { side: "away", scorer: 3, minute: 51 }, { side: "home", scorer: 4, minute: 78 }] } },
  { sport: "football", home: "kups", away: "sjk", day: -1, time: [19, 0], result: { home: 1, away: 1, goals: [{ side: "home", scorer: 3, minute: 34 }, { side: "away", scorer: 2, minute: 67 }] } },
  { sport: "basketball", home: "karhu", away: "kataja", day: -1, time: [18, 30], result: { home: 88, away: 81, goals: [], top_scorer: { side: "home", index: 0 } } },
  { sport: "basketball", home: "seagulls", away: "pyrinto", day: -1, time: [18, 30], result: { home: 79, away: 92, goals: [], top_scorer: { side: "away", index: 2 } } },
  // Today: kick-off in a few hours
  { sport: "football", home: "lahti", away: "vps", day: 0, time: null },
  { sport: "football", home: "hjk", away: "kups", day: 0, time: null },
  { sport: "football", home: "ilves", away: "ac_oulu", day: 0, time: null },
  { sport: "basketball", home: "kataja", away: "seagulls", day: 0, time: null },
  { sport: "basketball", home: "pyrinto", away: "karhu", day: 0, time: null },
  // This week
  { sport: "football", home: "sjk", away: "inter", day: 1, time: [18, 0] },
  { sport: "football", home: "vps", away: "ac_oulu", day: 2, time: [18, 0] },
  { sport: "football", home: "ilves", away: "lahti", day: 3, time: [17, 0] },
  { sport: "basketball", home: "kouvot", away: "karhu", day: 1, time: [18, 30] },
  { sport: "basketball", home: "vilpas", away: "seagulls", day: 3, time: [18, 30] },
];

/** Minutes after now for today's games (rounded down to 5 minutes), in fixture order. */
const TODAY_OFFSETS_MINUTES = [60, 90, 120, 150, 180];

export interface SampleGame {
  external_id: string;
  sport: Exclude<SportId, "hockey">;
  league_id: string;
  season: string;
  home_team_external_id: string;
  away_team_external_id: string;
  start_time: Date;
  status: "scheduled" | "final";
  home_goals: number | null;
  away_goals: number | null;
  ended_in: "regulation" | null;
  period: number | null;
  top_scorer_external_id: string | null;
  goals: {
    team_external_id: string;
    player_external_id: string;
    period: number;
    game_time_seconds: number;
  }[];
}

export interface SampleFixtures {
  teams: (SampleTeam & { external_id: string; league_id: string; sport: string })[];
  players: SamplePlayer[];
  games: SampleGame[];
}

function team_external_id(league: SampleLeague, team_key: string): string {
  return `demo:${league.key}:${team_key}`;
}

function league_of(sport: SampleFixture["sport"]): SampleLeague {
  const league = SAMPLE_LEAGUES.find((candidate) => candidate.sport === sport);
  if (!league) {
    throw new Error(`No sample league for ${sport}`);
  }
  return league;
}

function build_players(): SamplePlayer[] {
  let name_index = 0;
  return SAMPLE_LEAGUES.flatMap((league) =>
    league.teams.flatMap((team) =>
      Array.from({ length: PLAYERS_PER_TEAM }, (_, index) => {
        const first_name = FIRST_NAMES[name_index % FIRST_NAMES.length] ?? "Aleksi";
        const last_name = LAST_NAMES[name_index % LAST_NAMES.length] ?? "Ahola";
        name_index += 1;
        return {
          external_id: `${team_external_id(league, team.key)}:${String(index + 1)}`,
          team_external_id: team_external_id(league, team.key),
          first_name,
          last_name,
          jersey_number:
            league.sport === "football" ? ([1, 4, 9, 10, 11][index] ?? 99) : 3 + index * 4,
          position: league.sport === "football" ? (FOOTBALL_POSITIONS[index] ?? null) : null,
        };
      }),
    ),
  );
}

/** Today's start: a few hours from now, but still today (Helsinki); null if the day is over. */
function today_start(now: Date, today: LocalDate, order: number): Date | null {
  const offset = TODAY_OFFSETS_MINUTES[order] ?? 60;
  const start_ms =
    Math.floor((now.getTime() + offset * MINUTE_MS) / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
  const latest = helsinki_time(today, 23, 45).getTime();
  const start = Math.min(
    start_ms,
    latest - (TODAY_OFFSETS_MINUTES.length - order) * FIVE_MINUTES_MS,
  );
  return start > now.getTime() ? new Date(start) : null;
}

export function build_game(fixture: SampleFixture, start_time: Date, day: LocalDate): SampleGame {
  const league = league_of(fixture.sport);
  const home = team_external_id(league, fixture.home);
  const away = team_external_id(league, fixture.away);
  const player = (side: "home" | "away", index: number) =>
    `${side === "home" ? home : away}:${String(index + 1)}`;
  const result = fixture.result;
  return {
    external_id: `demo:${fixture.sport}:${String(day.year)}-${String(day.month)}-${String(day.day)}:${fixture.home}-${fixture.away}`,
    sport: fixture.sport,
    league_id: league.league_id,
    season: season_of(fixture.sport, start_time),
    home_team_external_id: home,
    away_team_external_id: away,
    start_time,
    status: result ? "final" : "scheduled",
    home_goals: result?.home ?? null,
    away_goals: result?.away ?? null,
    ended_in: result ? "regulation" : null,
    period: result ? (fixture.sport === "football" ? 2 : 4) : null,
    top_scorer_external_id: result?.top_scorer
      ? player(result.top_scorer.side, result.top_scorer.index)
      : null,
    goals: (result?.goals ?? []).map((goal) => ({
      team_external_id: goal.side === "home" ? home : away,
      player_external_id: player(goal.side, goal.scorer),
      period: goal.minute <= 45 ? 1 : 2,
      game_time_seconds: (goal.minute - 1) * 60 + 1,
    })),
  };
}

/** Pure: the sample teams, players and games relative to `now`. */
export function build_sample_fixtures(now: Date): SampleFixtures {
  const today = get_helsinki_date(now);
  const teams = SAMPLE_LEAGUES.flatMap((league) =>
    league.teams.map((team) => ({
      ...team,
      external_id: team_external_id(league, team.key),
      league_id: league.league_id,
      sport: league.sport,
    })),
  );
  let today_order = 0;
  const games = FIXTURES.flatMap((fixture) => {
    const day = add_days(today, fixture.day);
    if (fixture.time === null) {
      const start = today_start(now, today, today_order);
      today_order += 1;
      return start ? [build_game(fixture, start, day)] : [];
    }
    return [build_game(fixture, helsinki_time(day, fixture.time[0], fixture.time[1]), day)];
  });
  return { teams, players: build_players(), games };
}

export interface SamplePick {
  device_id: string;
  winner: "home" | "away" | "draw";
  home_goals: number | null;
  away_goals: number | null;
  /** Football scorer / basketball top scorer: side + roster index. */
  scorer: { side: "home" | "away"; index: number } | null;
  margin_band: MarginBand | null;
}

// prettier-ignore
/** The demo users' picks on a finished sample game: a spread of right, partly right and wrong. */
export function build_sample_picks(game: SampleGame): SamplePick[] {
  if (game.sport === "football") {
    return [
      { device_id: "demo_device_mika", winner: "home", home_goals: 2, away_goals: 1, scorer: { side: "home", index: 2 }, margin_band: null },
      { device_id: "demo_device_sanna", winner: "draw", home_goals: 1, away_goals: 1, scorer: { side: "away", index: 2 }, margin_band: null },
      { device_id: "demo_device_jani", winner: "away", home_goals: 0, away_goals: 2, scorer: { side: "away", index: 4 }, margin_band: null },
      { device_id: "demo_device_erik", winner: "home", home_goals: 1, away_goals: 0, scorer: null, margin_band: null },
      { device_id: "demo_device_hannah", winner: "draw", home_goals: 0, away_goals: 0, scorer: { side: "home", index: 3 }, margin_band: null },
    ];
  }
  return [
    { device_id: "demo_device_mika", winner: "home", home_goals: null, away_goals: null, scorer: { side: "home", index: 0 }, margin_band: "6_10" },
    { device_id: "demo_device_sanna", winner: "away", home_goals: null, away_goals: null, scorer: { side: "away", index: 2 }, margin_band: "11_plus" },
    { device_id: "demo_device_jani", winner: "away", home_goals: null, away_goals: null, scorer: { side: "away", index: 1 }, margin_band: "1_5" },
    { device_id: "demo_device_erik", winner: "home", home_goals: null, away_goals: null, scorer: null, margin_band: "1_5" },
    { device_id: "demo_device_hannah", winner: "home", home_goals: null, away_goals: null, scorer: { side: "home", index: 1 }, margin_band: "11_plus" },
  ];
}

export interface SampleSportsSummary {
  game_count: number;
  pick_count: number;
}

/** Removes the sample games (cascades to their events and picks); teams and players stay. */
export async function delete_sample_games(trx: Transaction<DB>): Promise<void> {
  await trx
    .deleteFrom("games")
    .where("data_source", "=", DEMO)
    .where("sport", "<>", "hockey")
    .execute();
}

/** Upserts the sample teams and players; returns their ids by external id. */
export async function upsert_teams_and_players(
  trx: Transaction<DB>,
  fixtures: Pick<SampleFixtures, "teams" | "players">,
) {
  const team_rows = await trx
    .insertInto("teams")
    .values(
      fixtures.teams.map((team) => ({
        external_id: team.external_id,
        name: team.name,
        short_name: team.short_name,
        city: team.city,
        sport: team.sport,
        league_id: team.league_id,
        data_source: DEMO,
      })),
    )
    .onConflict((conflict) =>
      conflict.column("external_id").doUpdateSet((eb) => ({
        name: eb.ref("excluded.name"),
        short_name: eb.ref("excluded.short_name"),
        city: eb.ref("excluded.city"),
      })),
    )
    .returning(["id", "external_id"])
    .execute();
  const team_ids = new Map(team_rows.map((row) => [row.external_id, row.id]));

  const player_rows = await trx
    .insertInto("players")
    .values(
      fixtures.players.map(({ team_external_id: team_key, ...player }) => ({
        ...player,
        team_id: team_ids.get(team_key) ?? "",
        data_source: DEMO,
      })),
    )
    .onConflict((conflict) =>
      conflict.column("external_id").doUpdateSet((eb) => ({
        first_name: eb.ref("excluded.first_name"),
        last_name: eb.ref("excluded.last_name"),
        jersey_number: eb.ref("excluded.jersey_number"),
        position: eb.ref("excluded.position"),
      })),
    )
    .returning(["id", "external_id"])
    .execute();
  return { team_ids, player_ids: new Map(player_rows.map((row) => [row.external_id, row.id])) };
}

/**
 * Recreates the sample football and basketball games (teams and players are upserted), and
 * adds the demo users' picks on the finished ones when those users exist (`user_ids` by device
 * id). The scoring job scores the picks afterwards.
 */
export async function insert_sample_sports(
  trx: Transaction<DB>,
  now: Date,
  user_ids: ReadonlyMap<string, string>,
): Promise<SampleSportsSummary> {
  const fixtures = build_sample_fixtures(now);
  await delete_sample_games(trx);
  const { team_ids, player_ids } = await upsert_teams_and_players(trx, fixtures);
  const id_of = (ids: ReadonlyMap<string, string>, key: string) => {
    const id = ids.get(key);
    if (!id) {
      throw new Error(`Sample row ${key} was not saved`);
    }
    return id;
  };

  let pick_count = 0;
  for (const game of fixtures.games) {
    const { id: game_id } = await trx
      .insertInto("games")
      .values({
        external_id: game.external_id,
        sport: game.sport,
        league_id: game.league_id,
        season: game.season,
        home_team_id: id_of(team_ids, game.home_team_external_id),
        away_team_id: id_of(team_ids, game.away_team_external_id),
        start_time: game.start_time,
        status: game.status,
        home_goals: game.home_goals,
        away_goals: game.away_goals,
        ended_in: game.ended_in,
        period: game.period,
        top_scorer_player_id: game.top_scorer_external_id
          ? id_of(player_ids, game.top_scorer_external_id)
          : null,
        data_source: DEMO,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    if (game.goals.length > 0) {
      await trx
        .insertInto("game_events")
        .values(
          game.goals.map((goal) => ({
            game_id,
            event_type: "goal",
            period: goal.period,
            game_time_seconds: goal.game_time_seconds,
            team_id: id_of(team_ids, goal.team_external_id),
            player_id: id_of(player_ids, goal.player_external_id),
            data_source: DEMO,
          })),
        )
        .execute();
    }
    if (game.status !== "final") {
      continue;
    }
    const team_id = (side: "home" | "away") =>
      id_of(team_ids, side === "home" ? game.home_team_external_id : game.away_team_external_id);
    const created_at = new Date(game.start_time.getTime() - PICK_LEAD_TIME_MS);
    const rows = build_sample_picks(game).flatMap((pick) => {
      const user_id = user_ids.get(pick.device_id);
      if (!user_id) {
        return [];
      }
      const scorer_key = pick.scorer
        ? `${pick.scorer.side === "home" ? game.home_team_external_id : game.away_team_external_id}:${String(pick.scorer.index + 1)}`
        : null;
      return [
        {
          user_id,
          game_id,
          predicted_winner_team_id: pick.winner === "draw" ? null : team_id(pick.winner),
          predicted_home_goals: pick.home_goals,
          predicted_away_goals: pick.away_goals,
          predicted_scorer_id: scorer_key ? id_of(player_ids, scorer_key) : null,
          predicted_margin_band: pick.margin_band,
          created_at,
        },
      ];
    });
    if (rows.length > 0) {
      await trx.insertInto("user_predictions").values(rows).execute();
      pick_count += rows.length;
    }
  }
  return { game_count: fixtures.games.length, pick_count };
}
