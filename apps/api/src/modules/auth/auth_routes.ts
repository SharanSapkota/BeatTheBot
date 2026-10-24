import { Router, type RequestHandler } from "express";
import type { AuthController } from "./auth_controller";

export function create_auth_routes(
  auth_controller: AuthController,
  sign_in_rate_limit: RequestHandler,
): Router {
  const router = Router();
  router.post("/device", sign_in_rate_limit, auth_controller.sign_in_device);
  router.post("/logout", auth_controller.logout);
  return router;
}
