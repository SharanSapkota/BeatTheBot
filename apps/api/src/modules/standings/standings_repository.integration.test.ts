import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";
import { KyselyStandingsRepository } from "./standings_repository";

const db = create_test_database();
const repository = new KyselyStandingsRepository(db);

describe("KyselyStandingsRepository (test database)", () => {
  beforeAll(async () => {
    await seed_fixture_database(db);
  });

  afterAll(async () => {
    await reset_test_database(db);
    await db.destroy();
  });

  it("finds the latest snapshot and its 17 rows in rank order", async () => {
    const snapshot = await repository.find_latest_snapshot();
    if (!snapshot) {
      throw new Error("no snapshot");
    }
    const rows = await repository.list_rows(snapshot);

    expect(snapshot).toEqual({
      season: "2026-27",
      taken_at: new Date("2026-10-24T08:49:49.845Z"),
    });
    expect(rows.map((row) => row.rank)).toEqual(
      Array.from({ length: 17 }, (_, index) => index + 1),
    );
    expect(rows[0]?.team.name).toBe("Lukko");
  });

  it("returns nothing for an unknown season", async () => {
    await expect(repository.find_latest_snapshot("1999-00")).resolves.toBeUndefined();
  });

  it("lists only real finished games, newest first", async () => {
    const games = await repository.list_finished_games("2026-27");

    expect(games).toHaveLength(6);
    expect(games[0]?.start_time).toEqual(new Date("2026-10-23T15:30:00Z"));
  });
});
