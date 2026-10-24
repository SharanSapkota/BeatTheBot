import { Router } from "express";
import type { AdminElectionsController } from "./admin_elections_controller";
import type { ElectionsController } from "./elections_controller";

/** Mounted on /elections. */
export function create_election_routes(controller: ElectionsController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.get("/:election_id", controller.get);
  router.post("/:election_id/picks", controller.create_pick);
  router.put("/:election_id/picks", controller.update_pick);
  router.get("/:election_id/results", controller.results);
  return router;
}

/** Mounted on /leaderboard/elections. */
export function create_election_leaderboard_routes(controller: ElectionsController): Router {
  const router = Router();
  router.get("/", controller.leaderboard);
  return router;
}

/** Mounted on /admin/elections (role admin). */
export function create_admin_election_routes(controller: AdminElectionsController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:election_id", controller.get);
  router.put("/:election_id", controller.update);
  router.delete("/:election_id", controller.delete);
  router.post("/:election_id/candidates", controller.add_candidate);
  router.put("/:election_id/candidates/:candidate_id", controller.update_candidate);
  router.delete("/:election_id/candidates/:candidate_id", controller.delete_candidate);
  router.post("/:election_id/publish", controller.publish);
  router.post("/:election_id/close", controller.close);
  router.post("/:election_id/result", controller.enter_result);
  return router;
}
