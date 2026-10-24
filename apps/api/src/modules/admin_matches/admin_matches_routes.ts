import { Router } from "express";
import type { AdminMatchesController } from "./admin_matches_controller";

/** Mounted on /admin/leagues (role admin). */
export function create_admin_league_routes(controller: AdminMatchesController): Router {
  const router = Router();
  router.get("/", controller.list_leagues);
  return router;
}

/** Mounted on /admin/matches (role admin). */
export function create_admin_match_routes(controller: AdminMatchesController): Router {
  const router = Router();
  router.get("/", controller.list_matches);
  router.post("/", controller.create);
  router.put("/:match_id", controller.update);
  router.delete("/:match_id", controller.delete);
  router.post("/:match_id/result", controller.save_result);
  return router;
}
