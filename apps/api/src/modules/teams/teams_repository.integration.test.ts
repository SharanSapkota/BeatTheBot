import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KARPAT_EXTERNAL_ID } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { KyselyTeamsRepository } from "./teams_repository";

const db = create_test_database();
const repository = new KyselyTeamsRepository(db);

describe("KyselyTeamsRepository (test database)", () => {
  let karpat_id: string;

  beforeAll(async () => {
    await seed_fixture_database(db);
    const karpat = await db
      .selectFrom("teams")
      .select("id")
      .where("external_id", "=", KARPAT_EXTERNAL_ID)
      .executeTakeFirstOrThrow();
    karpat_id = karpat.id;
  });

  afterAll(async () => {
    await reset_test_database(db);
    await db.destroy();
  });

  it("lists all 17 teams", async () => {
    const teams = await repository.list_teams("hockey");

    expect(teams).toHaveLength(17);
    expect(new Set(teams.map((team) => team.external_id)).size).toBe(17);
  });

  it("finds the current season from the latest game", async () => {
    await expect(repository.find_current_season("hockey")).resolves.toBe("2026-27");
  });

  it("counts season goals and goals in the last 5 finished games from real games only", async () => {
    const players = await repository.list_players(karpat_id, "2026-27");
    const goals_from_events = await db
      .selectFrom("game_events")
      .innerJoin("players", "players.id", "game_events.player_id")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("players.team_id", "=", karpat_id)
      .where("game_events.event_type", "=", "goal")
      .where("game_events.data_source", "=", "liiga_api")
      .executeTakeFirstOrThrow();

    const season_total = players.reduce((sum, player) => sum + player.season_goals, 0);
    const last_5_total = players.reduce((sum, player) => sum + player.goals_last_5, 0);

    expect(players.length).toBeGreaterThan(0);
    expect(season_total).toBe(Number(goals_from_events.count));
    expect(last_5_total).toBeLessThanOrEqual(season_total);
    expect(last_5_total).toBeGreaterThan(0);
  });
});
