import { Router } from "express";
import type { UsersController } from "./users_controller";

export function create_me_routes(users_controller: UsersController): Router {
  const router = Router();
  router.get("/", users_controller.get_me);
  router.patch("/", users_controller.update_me);
  router.delete("/", users_controller.delete_me);
  return router;
}
