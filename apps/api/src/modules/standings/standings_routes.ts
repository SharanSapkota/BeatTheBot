import { Router } from "express";
import type { StandingsController } from "./standings_controller";

export function create_standings_routes(standings_controller: StandingsController): Router {
  const router = Router();
  router.get("/", standings_controller.get_standings);
  return router;
}
