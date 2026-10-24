import type { AppDependencies, AppServices } from "./app";
import type { Clock } from "./common/clock";
import { create_logger, type Logger } from "./common/logger";
import { create_rate_limit } from "./common/rate_limit";
import type { Env } from "./config/env";
import { create_database, type Database } from "./db/kysely";
import { create_llm_client } from "./integrations/llm_client/create_llm_client";
import { create_liiga_client } from "./integrations/liiga_client/create_liiga_client";
import { GenerateStoriesJob } from "./jobs/generate_stories";
import { JobScheduler } from "./jobs/job_scheduler";
import { LiveSyncJob, LiveSyncPoller } from "./jobs/live_sync";
import { RefreshDemoDataJob } from "./jobs/refresh_demo_data";
import { KyselyRefreshDemoDataRepository } from "./jobs/refresh_demo_data_repository";
import { RunModelJob } from "./jobs/run_model";
import { ScoreAnswersJob } from "./jobs/score_answers";
import { KyselyScoreAnswersRepository } from "./jobs/score_answers_repository";
import { ScorePredictionsJob } from "./jobs/score_predictions";
import { KyselyScorePredictionsRepository } from "./jobs/score_predictions_repository";
import { KyselySyncGamesRepository } from "./jobs/sync_games_repository";
import { KyselyAdminMatchesRepository } from "./modules/admin_matches/admin_matches_repository";
import { AdminMatchesService } from "./modules/admin_matches/admin_matches_service";
import { KyselyAiPredictionsRepository } from "./modules/ai_predictions/ai_predictions_repository";
import { AiPredictionsService } from "./modules/ai_predictions/ai_predictions_service";
import { DemoAiService } from "./modules/ai_predictions/demo_ai_service";
import { KyselyModelInputsRepository } from "./modules/ai_predictions/model_inputs_repository";
import { KyselyAuthRepository } from "./modules/auth/auth_repository";
import { AuthService } from "./modules/auth/auth_service";
import { DemoReplayService } from "./modules/demo/demo_replay_service";
import { AdminElectionsService } from "./modules/elections/admin_elections_service";
import { KyselyElectionsRepository } from "./modules/elections/elections_repository";
import { ElectionsService } from "./modules/elections/elections_service";
import { KyselyGamesRepository } from "./modules/games/games_repository";
import { GamesService } from "./modules/games/games_service";
import { HealthService } from "./modules/health/health_service";
import { KyselyLeaderboardRepository } from "./modules/leaderboard/leaderboard_repository";
import { LeaderboardService } from "./modules/leaderboard/leaderboard_service";
import { KyselyPredictionsRepository } from "./modules/predictions/predictions_repository";
import { PredictionsService } from "./modules/predictions/predictions_service";
import { KyselyQuestionsRepository } from "./modules/questions/questions_repository";
import { QuestionsService } from "./modules/questions/questions_service";
import { create_question_generator } from "./modules/rooms/llm_question_generator";
import { MockQuestionGenerator } from "./modules/rooms/mock_question_generator";
import type { QuestionGenerator } from "./modules/rooms/question_generator";
import { KyselyRoomsRepository } from "./modules/rooms/rooms_repository";
import { RoomsService } from "./modules/rooms/rooms_service";
import { KyselyStandingsRepository } from "./modules/standings/standings_repository";
import { StandingsService } from "./modules/standings/standings_service";
import { KyselyTeamsRepository } from "./modules/teams/teams_repository";
import { KyselyStoriesRepository } from "./modules/stories/stories_repository";
import { EditorService } from "./modules/stories/editor_service";
import { StoriesService } from "./modules/stories/stories_service";
import { StoryGenerationService } from "./modules/stories/story_generation_service";
import { TeamsService } from "./modules/teams/teams_service";
import { KyselyUsersRepository } from "./modules/users/users_repository";
import { UsersService } from "./modules/users/users_service";

export interface Container {
  app_dependencies: AppDependencies;
  /** The shared connection pool. server.ts destroys it on shutdown. */
  db: Database;
  /** Undefined when LIVE_SYNC_ENABLED=false. server.ts starts and stops it. */
  live_sync_poller: LiveSyncPoller | undefined;
  /** Runs the prediction model in the background (on start and when a game ends). */
  model_run_scheduler: JobScheduler;
  /** Scores before-game picks in the background (on start and when a game ends). */
  scoring_scheduler: JobScheduler;
  /** Decides live picks and scores answers (on start, after live updates, when a game ends). */
  answers_scoring_scheduler: JobScheduler;
  /** Writes AI previews and summaries (on start, every 10 minutes and when a game ends). */
  stories_scheduler: JobScheduler;
  /** Keeps the sample football / basketball fixtures and the demo election current (hourly). */
  demo_refresh_scheduler: JobScheduler;
}

/** POST /auth/device: new accounts per client IP per hour. */
const SIGN_IN_RATE_LIMIT = { max_requests: 20, window_ms: 60 * 60 * 1000 };
/** POST /stories/:id/reports: error reports per client IP per hour. */
const REPORT_RATE_LIMIT = { max_requests: 10, window_ms: 60 * 60 * 1000 };
/** POST /rooms/join: tries per client IP per minute (against guessing keys). */
const ROOM_JOIN_RATE_LIMIT = { max_requests: 10, window_ms: 60 * 1000 };

export interface ServiceConfig {
  featured_team_external_id: string;
  demo_replay_enabled: boolean;
  /** Writes room questions; the mock bank when not given (tests). */
  room_question_generator?: QuestionGenerator;
}

/** Repositories and services. Also used by tests with the test database and a fixed clock. */
export function build_services(
  db: Database,
  config: ServiceConfig,
  clock: Clock,
  logger: Logger,
): AppServices {
  const games_repository = new KyselyGamesRepository(db);
  const games_service = new GamesService(games_repository, config.featured_team_external_id, clock);
  const teams_service = new TeamsService(new KyselyTeamsRepository(db));
  const stories_repository = new KyselyStoriesRepository(db);
  const ai_predictions_repository = new KyselyAiPredictionsRepository(db);
  const elections_repository = new KyselyElectionsRepository(db);
  const demo_replay_service = config.demo_replay_enabled
    ? new DemoReplayService(
        games_repository,
        games_service,
        config.featured_team_external_id,
        clock,
      )
    : undefined;
  return {
    health_service: new HealthService(clock),
    teams_service,
    games_service,
    standings_service: new StandingsService(new KyselyStandingsRepository(db)),
    ai_predictions_service: new AiPredictionsService(
      ai_predictions_repository,
      games_repository,
      games_service,
      clock,
    ),
    auth_service: new AuthService(new KyselyAuthRepository(db), clock),
    users_service: new UsersService(new KyselyUsersRepository(db)),
    predictions_service: new PredictionsService(new KyselyPredictionsRepository(db), clock),
    leaderboard_service: new LeaderboardService(new KyselyLeaderboardRepository(db), clock),
    stories_service: new StoriesService(stories_repository, clock, demo_replay_service),
    editor_service: new EditorService(stories_repository, clock),
    questions_service: new QuestionsService(
      new KyselyQuestionsRepository(db),
      games_service,
      teams_service,
      clock,
      demo_replay_service,
    ),
    elections_service: new ElectionsService(elections_repository, clock),
    admin_elections_service: new AdminElectionsService(elections_repository, clock),
    // An admin-entered result scores the match's picks before the response.
    admin_matches_service: new AdminMatchesService(
      new KyselyAdminMatchesRepository(db),
      games_service,
      new ScorePredictionsJob(new KyselyScorePredictionsRepository(db), logger, clock),
      clock,
    ),
    rooms_service: new RoomsService(
      new KyselyRoomsRepository(db),
      config.room_question_generator ?? new MockQuestionGenerator(),
      clock,
    ),
    sign_in_rate_limit: create_rate_limit({ ...SIGN_IN_RATE_LIMIT, clock }),
    room_join_rate_limit: create_rate_limit({ ...ROOM_JOIN_RATE_LIMIT, clock }),
    report_rate_limit: create_rate_limit({ ...REPORT_RATE_LIMIT, clock }),
    demo_replay_service,
    demo_ai_service: demo_replay_service
      ? new DemoAiService(
          demo_replay_service,
          new KyselyModelInputsRepository(db),
          ai_predictions_repository,
          clock,
        )
      : undefined,
  };
}

// The single place that builds dependencies. Add repositories, clients and services here.
export function build_container(env: Env): Container {
  const logger = create_logger({
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV === "development",
  });
  const db = create_database(env.DATABASE_URL);
  const clock: Clock = () => new Date();

  const model_run_scheduler = new JobScheduler(
    new RunModelJob(
      new KyselyModelInputsRepository(db),
      new KyselyAiPredictionsRepository(db),
      logger,
      clock,
    ),
    logger,
    "Model run",
  );
  const scoring_scheduler = new JobScheduler(
    new ScorePredictionsJob(new KyselyScorePredictionsRepository(db), logger, clock),
    logger,
    "Scoring",
  );
  const answers_scoring_scheduler = new JobScheduler(
    new ScoreAnswersJob(new KyselyScoreAnswersRepository(db), logger),
    logger,
    "Answer scoring",
  );
  const stories_repository = new KyselyStoriesRepository(db);
  const llm_client = create_llm_client(env);
  const stories_scheduler = new JobScheduler(
    new GenerateStoriesJob(
      stories_repository,
      new StoryGenerationService(
        stories_repository,
        new KyselyModelInputsRepository(db),
        llm_client,
        clock,
      ),
      logger,
      clock,
      { has_llm: llm_client !== undefined },
    ),
    logger,
    "Story generation",
  );
  const demo_refresh_scheduler = new JobScheduler(
    new RefreshDemoDataJob(new KyselyRefreshDemoDataRepository(db), logger, clock, [
      scoring_scheduler,
      answers_scoring_scheduler,
      stories_scheduler,
    ]),
    logger,
    "Demo data refresh",
  );
  const live_sync_poller = env.LIVE_SYNC_ENABLED
    ? new LiveSyncPoller(
        new LiveSyncJob(
          create_liiga_client(env),
          new KyselySyncGamesRepository(db),
          logger,
          clock,
          [model_run_scheduler, scoring_scheduler, answers_scoring_scheduler, stories_scheduler],
          [answers_scoring_scheduler],
        ),
        env.LIVE_SYNC_INTERVAL_SECONDS * 1000,
        logger,
      )
    : undefined;

  return {
    db,
    live_sync_poller,
    model_run_scheduler,
    scoring_scheduler,
    answers_scoring_scheduler,
    stories_scheduler,
    demo_refresh_scheduler,
    app_dependencies: {
      logger,
      cors_allowed_origins: env.CORS_ALLOWED_ORIGINS,
      ...build_services(
        db,
        {
          featured_team_external_id: env.FEATURED_TEAM_EXTERNAL_ID,
          demo_replay_enabled: env.DEMO_REPLAY_ENABLED,
          room_question_generator: create_question_generator(
            env.ROOM_QUESTIONS_SOURCE,
            llm_client,
            logger,
            new MockQuestionGenerator(),
          ),
        },
        clock,
        logger,
      ),
    },
  };
}
