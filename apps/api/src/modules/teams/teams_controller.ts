import type { RequestHandler } from "express";
import type { ApiSuccess, PlayerSummary, TeamSummary } from "@voita_kone/shared_types";
import { z } from "zod";
import { set_cache_control } from "../../common/cache_control";
import { team_not_found, type TeamsService } from "./teams_service";

const team_params_schema = z.object({ team_id: z.string() });

export class TeamsController {
  constructor(private readonly teams_service: TeamsService) {}

  list_teams: RequestHandler = async (_req, res) => {
    const response: ApiSuccess<TeamSummary[]> = { data: await this.teams_service.list_teams() };
    set_cache_control(res, false);
    res.json(response);
  };

  list_players: RequestHandler = async (req, res) => {
    const { team_id } = team_params_schema.parse(req.params);
    // A malformed id can't match any team.
    if (!z.uuid().safeParse(team_id).success) {
      throw team_not_found(team_id);
    }
    const response: ApiSuccess<PlayerSummary[]> = {
      data: await this.teams_service.list_players(team_id),
    };
    set_cache_control(res, false);
    res.json(response);
  };
}
