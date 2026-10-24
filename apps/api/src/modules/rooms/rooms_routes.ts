import { Router, type RequestHandler } from "express";
import type { RoomsController } from "./rooms_controller";

/** Mounted on /rooms. `join_rate_limit` guards against guessing keys. */
export function create_room_routes(
  controller: RoomsController,
  join_rate_limit: RequestHandler,
): Router {
  const router = Router();
  router.post("/", controller.create);
  // Before /:room_id, which would otherwise see "join".
  router.post("/join", join_rate_limit, controller.join);
  router.get("/:room_id", controller.get);
  router.patch("/:room_id", controller.update);
  router.post("/:room_id/regenerate_key", controller.regenerate_key);
  router.post("/:room_id/close", controller.close);
  router.delete("/:room_id/members/:user_id", controller.remove_member);
  router.get("/:room_id/current_question", controller.current_question);
  router.get("/:room_id/questions", controller.past_questions);
  router.get("/:room_id/leaderboard", controller.leaderboard);
  return router;
}

/** Mounted on /room_questions. */
export function create_room_question_routes(controller: RoomsController): Router {
  const router = Router();
  router.post("/:question_id/answers", controller.answer);
  router.post("/:question_id/reactions", controller.react);
  return router;
}

/** Mounted on /me/rooms. */
export function create_my_room_routes(controller: RoomsController): Router {
  const router = Router();
  router.get("/", controller.list_mine);
  return router;
}
