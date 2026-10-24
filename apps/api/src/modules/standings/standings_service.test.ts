import { standings_schema } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import { AWAY_TEAM, HOME_TEAM } from "../../test_helpers/game_rows";
import type {
  FinishedGameRecord,
  SnapshotRef,
  StandingsRepository,
  StandingsRowRecord,
} from "./standings_repository";
import { StandingsService, compute_form, to_form_result } from "./standings_service";

const KARPAT = HOME_TEAM.id;
const KALPA = AWAY_TEAM.id;

function game(
  home_goals: number,
  away_goals: number,
  ended_in: string,
  day: number,
  home = KARPAT,
  away = KALPA,
): FinishedGameRecord {
  return {
    home_team_id: home,
    away_team_id: away,
    home_goals,
    away_goals,
    ended_in,
    start_time: new Date(Date.UTC(2026, 9, day, 15, 30)),
  };
}

describe("to_form_result", () => {
  it("tells regulation and overtime wins and losses apart, from each side", () => {
    expect(to_form_result(game(3, 1, "regulation", 1), KARPAT)).toBe("W");
    expect(to_form_result(game(3, 1, "regulation", 1), KALPA)).toBe("L");
    expect(to_form_result(game(3, 2, "overtime", 1), KARPAT)).toBe("OTW");
    expect(to_form_result(game(3, 2, "shootout", 1), KALPA)).toBe("OTL");
  });
});

describe("compute_form", () => {
  it("returns the team's last 5 results, newest first", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    const games = [
      game(1, 4, "regulation", 23), // L
      game(2, 3, "overtime", 21, other, KARPAT), // Kärpät away OTW
      game(5, 0, "regulation", 19, other, KALPA), // not Kärpät
      game(3, 2, "shootout", 17), // OTW
      game(0, 1, "overtime", 15), // OTL
      game(4, 2, "regulation", 13), // W
      game(1, 0, "regulation", 11), // 6th game, left out
    ];

    expect(compute_form(KARPAT, games)).toEqual(["L", "OTW", "OTW", "OTL", "W"]);
  });

  it("is empty for a team without finished games", () => {
    expect(compute_form(KARPAT, [])).toEqual([]);
  });
});

class FakeStandingsRepository implements StandingsRepository {
  constructor(
    private readonly snapshot: SnapshotRef | undefined,
    private readonly rows: StandingsRowRecord[],
    private readonly games: FinishedGameRecord[],
  ) {}

  find_latest_snapshot(): Promise<SnapshotRef | undefined> {
    return Promise.resolve(this.snapshot);
  }

  list_rows(): Promise<StandingsRowRecord[]> {
    return Promise.resolve(this.rows);
  }

  list_finished_games(): Promise<FinishedGameRecord[]> {
    return Promise.resolve(this.games);
  }
}

describe("StandingsService", () => {
  it("adds goal difference and form to each row", async () => {
    const service = new StandingsService(
      new FakeStandingsRepository(
        { season: "2026-27", taken_at: new Date("2026-10-24T08:49:49.845Z") },
        [
          {
            rank: 1,
            team: HOME_TEAM,
            games_played: 17,
            points: 30,
            goals_for: 50,
            goals_against: 45,
          },
        ],
        [game(5, 2, "regulation", 23)],
      ),
    );

    const standings = await service.get_standings();

    expect(standings_schema.parse(standings)).toEqual(standings);
    expect(standings.rows[0]).toMatchObject({ goal_difference: 5, form: ["W"] });
    expect(standings.taken_at).toBe("2026-10-24T08:49:49.845Z");
  });

  it("returns empty rows for an unknown season", async () => {
    const service = new StandingsService(new FakeStandingsRepository(undefined, [], []));

    await expect(service.get_standings("1999-00")).resolves.toEqual({
      season: "1999-00",
      taken_at: null,
      rows: [],
    });
  });
});
