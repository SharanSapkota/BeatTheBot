import { Router } from "express";
import type { TeamsController } from "./teams_controller";

export function create_teams_routes(teams_controller: TeamsController): Router {
  const router = Router();
  router.get("/", teams_controller.list_teams);
  router.get("/:team_id/players", teams_controller.list_players);
  return router;
}
