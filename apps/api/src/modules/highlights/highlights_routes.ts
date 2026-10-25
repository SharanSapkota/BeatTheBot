import { Router } from "express";
import type { HighlightsController } from "./highlights_controller";

/** Mounted on /admin/highlights (role editor or admin). */
export function create_admin_highlight_routes(controller: HighlightsController): Router {
  const router = Router();
  router.get("/upload_status", controller.get_upload_status);
  return router;
}
