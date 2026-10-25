import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { create_error_middleware } from "./common/error_middleware";
import type { Logger } from "./common/logger";
import { not_found_middleware } from "./common/not_found_middleware";
import { request_id_middleware } from "./common/request_id_middleware";
import type { RequestHandler } from "express";
import type { AiPredictionsService } from "./modules/ai_predictions/ai_predictions_service";
import type { DemoAiService } from "./modules/ai_predictions/demo_ai_service";
import type { AuthService } from "./modules/auth/auth_service";
import type { DemoReplayService } from "./modules/demo/demo_replay_service";
import type { AdminElectionsService } from "./modules/elections/admin_elections_service";
import type { AdminMatchesService } from "./modules/admin_matches/admin_matches_service";
import type { ElectionsService } from "./modules/elections/elections_service";
import type { GamesService } from "./modules/games/games_service";
import type { HealthService } from "./modules/health/health_service";
import type { HighlightsService } from "./modules/highlights/highlights_service";
import type { LeaderboardService } from "./modules/leaderboard/leaderboard_service";
import type { PredictionsService } from "./modules/predictions/predictions_service";
import type { QuestionsService } from "./modules/questions/questions_service";
import type { RoomsService } from "./modules/rooms/rooms_service";
import type { StandingsService } from "./modules/standings/standings_service";
import type { EditorService } from "./modules/stories/editor_service";
import type { StoriesService } from "./modules/stories/stories_service";
import type { TeamsService } from "./modules/teams/teams_service";
import type { UsersService } from "./modules/users/users_service";
import { create_api_router } from "./routes";

export interface AppServices {
  health_service: HealthService;
  highlights_service: HighlightsService;
  teams_service: TeamsService;
  games_service: GamesService;
  standings_service: StandingsService;
  ai_predictions_service: AiPredictionsService;
  auth_service: AuthService;
  users_service: UsersService;
  predictions_service: PredictionsService;
  leaderboard_service: LeaderboardService;
  stories_service: StoriesService;
  editor_service: EditorService;
  questions_service: QuestionsService;
  elections_service: ElectionsService;
  admin_elections_service: AdminElectionsService;
  admin_matches_service: AdminMatchesService;
  rooms_service: RoomsService;
  /** Per-IP limit for POST /auth/device. */
  sign_in_rate_limit: RequestHandler;
  /** Per-IP limit for POST /stories/:id/reports. */
  report_rate_limit: RequestHandler;
  /** Per-IP limit for POST /rooms/join (against guessing keys). */
  room_join_rate_limit: RequestHandler;
  /** Undefined when DEMO_REPLAY_ENABLED=false; then /demo routes are not mounted. */
  demo_replay_service: DemoReplayService | undefined;
  demo_ai_service: DemoAiService | undefined;
}

export interface AppDependencies extends AppServices {
  logger: Logger;
  cors_allowed_origins: readonly string[];
  /** Proxies in front of the API (Render / Railway: 1). req.ip, and so every rate limit, then
   * uses the real client IP from X-Forwarded-For instead of the proxy's. 0 = no proxy. */
  trust_proxy_hops: number;
}

export function create_app(dependencies: AppDependencies): Express {
  const app = express();
  app.set("trust proxy", dependencies.trust_proxy_hops);

  app.use(helmet());
  app.use(cors({ origin: [...dependencies.cors_allowed_origins] }));
  app.use(express.json());
  app.use(request_id_middleware);
  app.use(pinoHttp({ logger: dependencies.logger, genReqId: (req) => req.id }));

  app.use("/api/v1", create_api_router(dependencies));

  app.use(not_found_middleware);
  app.use(create_error_middleware(dependencies.logger));

  return app;
}
