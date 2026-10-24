import { Router } from "express";
import type { AppDependencies } from "./app";
import { DemoController } from "./modules/demo/demo_controller";
import { create_demo_routes } from "./modules/demo/demo_routes";
import { GamesController } from "./modules/games/games_controller";
import { create_game_day_routes, create_games_routes } from "./modules/games/games_routes";
import { HealthController } from "./modules/health/health_controller";
import { create_health_routes } from "./modules/health/health_routes";
import { StandingsController } from "./modules/standings/standings_controller";
import { create_standings_routes } from "./modules/standings/standings_routes";
import { TeamsController } from "./modules/teams/teams_controller";
import { create_teams_routes } from "./modules/teams/teams_routes";

export function create_api_router(dependencies: AppDependencies): Router {
  const router = Router();
  const games_controller = new GamesController(dependencies.games_service);

  router.use("/health", create_health_routes(new HealthController(dependencies.health_service)));
  router.use("/teams", create_teams_routes(new TeamsController(dependencies.teams_service)));
  router.use("/game_days", create_game_day_routes(games_controller));
  router.use("/games", create_games_routes(games_controller));
  router.use(
    "/standings",
    create_standings_routes(new StandingsController(dependencies.standings_service)),
  );
  if (dependencies.demo_replay_service) {
    router.use("/demo", create_demo_routes(new DemoController(dependencies.demo_replay_service)));
  }
  return router;
}
