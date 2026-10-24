import type { RequestHandler } from "express";
import {
  leaderboard_period_schema,
  type ApiSuccess,
  type Leaderboard,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { find_auth } from "../auth/auth_context";
import type { LeaderboardService } from "./leaderboard_service";

const query_schema = z.object({ period: leaderboard_period_schema.default("week") });

export class LeaderboardController {
  constructor(private readonly leaderboard_service: LeaderboardService) {}

  get_leaderboard: RequestHandler = async (req, res) => {
    const { period } = query_schema.parse(req.query);
    const me = find_auth(req);
    const response: ApiSuccess<Leaderboard> = {
      data: await this.leaderboard_service.get_leaderboard(period, me?.user_id ?? null),
    };
    // Signed in, the response has the user's own row, so it must not be shared from a cache.
    res.set("Cache-Control", me ? "private, no-store" : "public, max-age=60").json(response);
  };
}
