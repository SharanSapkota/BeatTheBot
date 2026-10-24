import { describe, expect, it } from "vitest";
import { HOME_TEAM } from "../../test_helpers/game_rows";
import type { TeamRow } from "./teams_mapper";
import type { PlayerRow, TeamsRepository } from "./teams_repository";
import { TeamsService } from "./teams_service";

function player(
  last_name: string,
  position: string | null,
  jersey_number: number | null,
): PlayerRow {
  return {
    id: `${last_name}-id`,
    first_name: "Test",
    last_name,
    jersey_number,
    position,
    birth_year: 2000,
    season_goals: 0,
    goals_last_5: 0,
  };
}

class FakeTeamsRepository implements TeamsRepository {
  season_asked: string | undefined;

  constructor(private readonly players: PlayerRow[]) {}

  list_teams(): Promise<TeamRow[]> {
    return Promise.resolve([HOME_TEAM]);
  }

  find_team(team_id: string): Promise<TeamRow | undefined> {
    return Promise.resolve(team_id === HOME_TEAM.id ? HOME_TEAM : undefined);
  }

  find_current_season(): Promise<string | undefined> {
    return Promise.resolve("2026-27");
  }

  list_players(_team_id: string, season: string): Promise<PlayerRow[]> {
    this.season_asked = season;
    return Promise.resolve(this.players);
  }
}

describe("TeamsService.list_players", () => {
  it("sorts goalies, defense, forwards, then unknown, each by jersey", async () => {
    const repository = new FakeTeamsRepository([
      player("Forward20", "forward", 20),
      player("Unknown", null, 1),
      player("Defense4", "defense", 4),
      player("Forward7", "forward", 7),
      player("NoJersey", "forward", null),
      player("Goalie30", "goalie", 30),
    ]);

    const players = await new TeamsService(repository).list_players(HOME_TEAM.id);

    expect(players.map((roster_player) => roster_player.last_name)).toEqual([
      "Goalie30",
      "Defense4",
      "Forward7",
      "Forward20",
      "NoJersey",
      "Unknown",
    ]);
    expect(repository.season_asked).toBe("2026-27");
  });

  it("throws TEAM_NOT_FOUND for an unknown team", async () => {
    const service = new TeamsService(new FakeTeamsRepository([]));

    await expect(
      service.list_players("33333333-3333-4333-8333-333333333333"),
    ).rejects.toMatchObject({
      code: "TEAM_NOT_FOUND",
      http_status: 404,
    });
  });
});
