import { Router } from "express";
import type { AppDependencies } from "./app";
import { AiPredictionsController } from "./modules/ai_predictions/ai_predictions_controller";
import {
  create_ai_prediction_routes,
  create_demo_ai_routes,
  create_season_odds_routes,
} from "./modules/ai_predictions/ai_predictions_routes";
import { create_auth_middleware } from "./modules/auth/auth_middleware";
import { AuthController } from "./modules/auth/auth_controller";
import { create_auth_routes } from "./modules/auth/auth_routes";
import { DemoController } from "./modules/demo/demo_controller";
import { create_demo_routes } from "./modules/demo/demo_routes";
import { GamesController } from "./modules/games/games_controller";
import { create_game_day_routes, create_games_routes } from "./modules/games/games_routes";
import { HealthController } from "./modules/health/health_controller";
import { create_health_routes } from "./modules/health/health_routes";
import { LeaderboardController } from "./modules/leaderboard/leaderboard_controller";
import { create_leaderboard_routes } from "./modules/leaderboard/leaderboard_routes";
import { PredictionsController } from "./modules/predictions/predictions_controller";
import {
  create_game_prediction_routes,
  create_my_prediction_routes,
} from "./modules/predictions/predictions_routes";
import { QuestionsController } from "./modules/questions/questions_controller";
import {
  create_demo_question_routes,
  create_game_question_routes,
  create_question_routes,
} from "./modules/questions/questions_routes";
import { StandingsController } from "./modules/standings/standings_controller";
import { create_standings_routes } from "./modules/standings/standings_routes";
import { StoriesController } from "./modules/stories/stories_controller";
import { create_demo_story_routes, create_story_routes } from "./modules/stories/stories_routes";
import { TeamsController } from "./modules/teams/teams_controller";
import { create_teams_routes } from "./modules/teams/teams_routes";
import { UsersController } from "./modules/users/users_controller";
import { create_me_routes } from "./modules/users/users_routes";

export function create_api_router(dependencies: AppDependencies): Router {
  const router = Router();
  const games_controller = new GamesController(dependencies.games_service);
  const ai_controller = new AiPredictionsController(
    dependencies.ai_predictions_service,
    dependencies.demo_ai_service,
  );

  const predictions_controller = new PredictionsController(dependencies.predictions_service);
  const stories_controller = new StoriesController(dependencies.stories_service);
  const questions_controller = new QuestionsController(dependencies.questions_service);

  // Sets the signed-in user for every route; a bad token is 401 even on public routes.
  router.use(create_auth_middleware(dependencies.auth_service));
  router.use("/health", create_health_routes(new HealthController(dependencies.health_service)));
  router.use("/teams", create_teams_routes(new TeamsController(dependencies.teams_service)));
  router.use("/game_days", create_game_day_routes(games_controller));
  router.use("/games", create_games_routes(games_controller));
  router.use("/games", create_ai_prediction_routes(ai_controller));
  router.use("/games", create_game_prediction_routes(predictions_controller));
  router.use("/games", create_story_routes(stories_controller));
  router.use("/games", create_game_question_routes(questions_controller));
  router.use("/questions", create_question_routes(questions_controller));
  router.use(
    "/auth",
    create_auth_routes(
      new AuthController(dependencies.auth_service),
      dependencies.sign_in_rate_limit,
    ),
  );
  router.use(
    "/leaderboard",
    create_leaderboard_routes(new LeaderboardController(dependencies.leaderboard_service)),
  );
  // Before /me, whose router would otherwise see "/predictions".
  router.use("/me/predictions", create_my_prediction_routes(predictions_controller));
  router.use("/me", create_me_routes(new UsersController(dependencies.users_service)));
  // Before /standings, whose router would otherwise see "/odds".
  router.use("/standings/odds", create_season_odds_routes(ai_controller));
  router.use(
    "/standings",
    create_standings_routes(new StandingsController(dependencies.standings_service)),
  );
  if (dependencies.demo_replay_service) {
    router.use("/demo", create_demo_routes(new DemoController(dependencies.demo_replay_service)));
    router.use("/demo/games", create_demo_ai_routes(ai_controller));
    router.use("/demo/games", create_demo_story_routes(stories_controller));
    router.use("/demo/games", create_demo_question_routes(questions_controller));
  }
  return router;
}
