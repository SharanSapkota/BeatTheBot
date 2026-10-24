import type { RequestHandler } from "express";
import type { ApiSuccess, Standings } from "@voita_kone/shared_types";
import { z } from "zod";
import { set_cache_control } from "../../common/cache_control";
import type { StandingsService } from "./standings_service";

const standings_query_schema = z.object({
  season: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Season looks like "2026-27"')
    .optional(),
});

export class StandingsController {
  constructor(private readonly standings_service: StandingsService) {}

  get_standings: RequestHandler = async (req, res) => {
    const { season } = standings_query_schema.parse(req.query);
    const response: ApiSuccess<Standings> = {
      data: await this.standings_service.get_standings(season),
    };
    set_cache_control(res, false);
    res.json(response);
  };
}
