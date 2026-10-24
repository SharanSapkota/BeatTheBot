import { describe, expect, it } from "vitest";
import { AppError } from "../../common/app_error";
import { AWAY_TEAM, HOME_TEAM, build_game_row, build_team_row } from "../../test_helpers/game_rows";
import type { EventRow, GameFilter, GameRow, GamesRepository } from "./games_repository";
import { GamesService, count_by_sport } from "./games_service";

class FakeGamesRepository implements GamesRepository {
  filters: GameFilter[] = [];

  constructor(
    private readonly games: GameRow[] = [],
    private readonly events: EventRow[] = [],
  ) {}

  list_games(filter: GameFilter): Promise<GameRow[]> {
    this.filters.push(filter);
    return Promise.resolve(
      this.games.filter(
        (game) =>
          game.start_time >= filter.start &&
          game.start_time < filter.end &&
          (filter.sport === undefined || game.sport === filter.sport),
      ),
    );
  }

  find_game(game_id: string): Promise<GameRow | undefined> {
    return Promise.resolve(this.games.find((game) => game.id === game_id));
  }

  list_events(): Promise<EventRow[]> {
    return Promise.resolve(this.events);
  }

  find_latest_final_game(): Promise<GameRow | undefined> {
    return Promise.resolve(undefined);
  }

  find_latest_demo_final(): Promise<GameRow | undefined> {
    return Promise.resolve(undefined);
  }
}

function create_service(repository: GamesRepository, now: string) {
  return new GamesService(repository, HOME_TEAM.external_id, () => new Date(now));
}

async function error_code(promise: Promise<unknown>): Promise<string | undefined> {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  return error instanceof AppError ? error.code : undefined;
}

describe("GamesService.get_game_day", () => {
  const tappara = build_team_row(3, "Tappara");
  const ilves = build_team_row(4, "Ilves");
  const games = [
    build_game_row({
      id: "aaaaaaaa-0000-4000-8000-000000000001",
      status: "final",
      start_time: new Date("2026-10-24T11:00:00Z"),
      home_team: tappara,
      away_team: ilves,
    }),
    build_game_row({
      id: "aaaaaaaa-0000-4000-8000-000000000002",
      status: "scheduled",
      start_time: new Date("2026-10-24T13:00:00Z"),
      home_goals: null,
      away_goals: null,
      ended_in: null,
      home_team: tappara,
      away_team: ilves,
    }),
    build_game_row({
      id: "aaaaaaaa-0000-4000-8000-000000000003",
      status: "scheduled",
      start_time: new Date("2026-10-24T14:00:00Z"),
      home_goals: null,
      away_goals: null,
      ended_in: null,
    }),
    build_game_row({
      id: "aaaaaaaa-0000-4000-8000-000000000004",
      status: "live",
      start_time: new Date("2026-10-24T12:00:00Z"),
      ended_in: null,
      home_team: tappara,
      away_team: ilves,
    }),
  ];

  it("orders live, then upcoming with the featured game first, then final", async () => {
    const service = create_service(new FakeGamesRepository(games), "2026-10-24T12:30:00Z");

    const game_day = await service.get_game_day("today", "hockey");

    expect(game_day.date).toBe("2026-10-24");
    expect(game_day.games.map((game) => [game.state, game.featured])).toEqual([
      ["live", false],
      ["upcoming", true],
      ["upcoming", false],
      ["final", false],
    ]);
  });

  it('uses the Helsinki day for "today" around midnight', async () => {
    const repository = new FakeGamesRepository();

    // 23:30 in Helsinki on the 24th, but already 20:30 UTC.
    const before_midnight = await create_service(repository, "2026-10-24T20:30:00Z").get_game_day(
      "today",
      "hockey",
    );
    // 00:30 in Helsinki on the 25th, still the 24th in UTC.
    const after_midnight = await create_service(repository, "2026-10-24T21:30:00Z").get_game_day(
      "today",
      "hockey",
    );

    expect(before_midnight.date).toBe("2026-10-24");
    expect(after_midnight.date).toBe("2026-10-25");
    expect(repository.filters[1]).toEqual({
      start: new Date("2026-10-24T21:00:00Z"),
      end: new Date("2026-10-25T22:00:00Z"),
      sport: "hockey",
    });
  });

  it("rejects an invalid date", async () => {
    const service = create_service(new FakeGamesRepository(), "2026-10-24T12:00:00Z");

    expect(await error_code(service.get_game_day("2026-13-01", "hockey"))).toBe("INVALID_DATE");
    expect(await error_code(service.get_game_day("tomorrow", "hockey"))).toBe("INVALID_DATE");
  });
});

describe("GamesService.get_game_day per sport", () => {
  const football = build_game_row({
    id: "aaaaaaaa-0000-4000-8000-0000000000f1",
    sport: "football",
    status: "scheduled",
    start_time: new Date("2026-10-24T15:00:00Z"),
  });
  const hockey = build_game_row({
    id: "aaaaaaaa-0000-4000-8000-0000000000f2",
    status: "live",
    start_time: new Date("2026-10-24T11:00:00Z"),
  });

  it("returns only the sport's games and counts every sport for the tabs", async () => {
    const service = create_service(
      new FakeGamesRepository([football, hockey]),
      "2026-10-24T12:00:00Z",
    );

    const day = await service.get_game_day("today", "football");
    const sports = await service.get_sports_day("today");

    expect(day.games.map((game) => [game.id, game.sport])).toEqual([[football.id, "football"]]);
    expect(sports.sports).toEqual([
      { sport: "hockey", game_count: 1, live_count: 1 },
      { sport: "football", game_count: 1, live_count: 0 },
      { sport: "basketball", game_count: 0, live_count: 0 },
    ]);
  });

  it("lists every sport in config order, also without games", () => {
    expect(count_by_sport([]).map((row) => row.sport)).toEqual([
      "hockey",
      "football",
      "basketball",
    ]);
  });
});

describe("GamesService.list_games", () => {
  const service = create_service(new FakeGamesRepository(), "2026-10-24T12:00:00Z");

  it("defaults to today and the next 6 days", async () => {
    const repository = new FakeGamesRepository();
    await create_service(repository, "2026-10-24T12:00:00Z").list_games({ sport: "hockey" });

    expect(repository.filters[0]).toEqual({
      start: new Date("2026-10-23T21:00:00Z"),
      end: new Date("2026-10-30T22:00:00Z"),
      team_id: undefined,
      statuses: undefined,
      sport: "hockey",
    });
  });

  it("maps the state filter to the stored status", async () => {
    const repository = new FakeGamesRepository();
    await create_service(repository, "2026-10-24T12:00:00Z").list_games({
      state: "upcoming",
      sport: "hockey",
    });

    expect(repository.filters[0]?.statuses).toEqual(["scheduled"]);
  });

  it("allows 31 days and rejects longer ranges", async () => {
    await expect(
      service.list_games({ from: "2026-10-01", to: "2026-11-01", sport: "hockey" }),
    ).resolves.toEqual([]);
    expect(
      await error_code(
        service.list_games({ from: "2026-10-01", to: "2026-11-02", sport: "hockey" }),
      ),
    ).toBe("RANGE_TOO_LARGE");
  });

  it("rejects a range that ends before it starts", async () => {
    expect(
      await error_code(
        service.list_games({ from: "2026-10-24", to: "2026-10-20", sport: "hockey" }),
      ),
    ).toBe("INVALID_DATE");
  });
});

describe("GamesService.get_game_detail", () => {
  it("throws GAME_NOT_FOUND for an unknown game", async () => {
    const service = create_service(new FakeGamesRepository(), "2026-10-24T12:00:00Z");

    expect(await error_code(service.get_game_detail("aaaaaaaa-0000-4000-8000-00000000ffff"))).toBe(
      "GAME_NOT_FOUND",
    );
  });

  it("returns the game with its events", async () => {
    const game = build_game_row();
    const service = create_service(new FakeGamesRepository([game]), "2026-10-24T12:00:00Z");

    const detail = await service.get_game_detail(game.id);

    expect(detail).toMatchObject({ id: game.id, state: "final", featured: true });
    expect(detail.home_team.name).toBe(HOME_TEAM.name);
    expect(detail.away_team.name).toBe(AWAY_TEAM.name);
  });
});
