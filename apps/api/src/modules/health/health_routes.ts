import { Router } from "express";
import type { HealthController } from "./health_controller";

export function create_health_routes(health_controller: HealthController): Router {
  const router = Router();
  router.get("/", health_controller.get_health);
  return router;
}
