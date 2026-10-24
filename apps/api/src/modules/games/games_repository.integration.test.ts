import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { helsinki_day_range } from "../../common/helsinki_date";
import { KARPAT_EXTERNAL_ID } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { KyselyGamesRepository } from "./games_repository";

const db = create_test_database();
const repository = new KyselyGamesRepository(db);

async function find_by_external_id(external_id: string) {
  const row = await db
    .selectFrom("games")
    .select("id")
    .where("external_id", "=", external_id)
    .executeTakeFirstOrThrow();
  return row.id;
}

describe("KyselyGamesRepository (test database)", () => {
  beforeAll(async () => {
    await seed_fixture_database(db);
  });

  afterAll(async () => {
    await reset_test_database(db);
    await db.destroy();
  });

  it("lists the games of one Helsinki day with both teams", async () => {
    const games = await repository.list_games({
      ...helsinki_day_range("2026-10-24"),
      sport: "hockey",
    });

    expect(games.map((game) => [game.external_id, game.status, game.data_source])).toEqual([
      ["demo_final", "final", "demo"],
      ["demo_live", "live", "demo"],
      ["2701412", "scheduled", "liiga_api"],
    ]);
    expect(games[2]?.home_team).toMatchObject({ name: "Kärpät", city: "Oulu" });
    expect(games[2]?.start_time).toEqual(new Date("2026-10-24T14:00:00Z"));
  });

  it("filters by sport and returns the league", async () => {
    const games = await repository.list_games({
      ...helsinki_day_range("2026-10-24"),
      sport: "football",
    });

    expect(games.length).toBeGreaterThan(0);
    expect(games.every((game) => game.sport === "football")).toBe(true);
    expect(games[0]?.league.name).toBe("Veikkausliiga");
    expect(games[0]?.home_team.sport).toBe("football");
  });

  it("filters by team and status", async () => {
    const karpat = await db
      .selectFrom("teams")
      .select("id")
      .where("external_id", "=", KARPAT_EXTERNAL_ID)
      .executeTakeFirstOrThrow();

    const games = await repository.list_games({
      start: new Date("2026-10-01T00:00:00Z"),
      end: new Date("2026-11-01T00:00:00Z"),
      team_id: karpat.id,
      statuses: ["final"],
    });

    expect(games).toHaveLength(6);
    expect(games.every((game) => game.status === "final")).toBe(true);
  });

  it("returns events with scorer and assists in time order", async () => {
    const game_id = await find_by_external_id("2701405");

    const events = await repository.list_events(game_id);
    const first_goal = events[0];

    expect(events).toHaveLength(7);
    expect(events.map((event) => event.game_time_seconds)).toEqual(
      [...events.map((event) => event.game_time_seconds)].sort((a, b) => a - b),
    );
    expect(first_goal?.player).toMatchObject({ first_name: expect.any(String) });
    expect(first_goal?.assists.length).toBeGreaterThan(0);
  });

  it("finds the latest finished Kärpät game with goals for the replay", async () => {
    const game = await repository.find_latest_final_game(KARPAT_EXTERNAL_ID, "liiga_api");

    expect(game).toMatchObject({ external_id: "2701405", home_goals: 5, away_goals: 2 });
    await expect(repository.find_latest_demo_final("hockey")).resolves.toMatchObject({
      external_id: "demo_final",
    });
  });
});
