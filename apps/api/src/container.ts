import type { AppDependencies, AppServices } from "./app";
import type { Clock } from "./common/clock";
import { create_logger } from "./common/logger";
import type { Env } from "./config/env";
import { create_database, type Database } from "./db/kysely";
import { create_liiga_client } from "./integrations/liiga_client/create_liiga_client";
import { LiveSyncJob, LiveSyncPoller } from "./jobs/live_sync";
import { KyselySyncGamesRepository } from "./jobs/sync_games_repository";
import { DemoReplayService } from "./modules/demo/demo_replay_service";
import { KyselyGamesRepository } from "./modules/games/games_repository";
import { GamesService } from "./modules/games/games_service";
import { HealthService } from "./modules/health/health_service";
import { KyselyStandingsRepository } from "./modules/standings/standings_repository";
import { StandingsService } from "./modules/standings/standings_service";
import { KyselyTeamsRepository } from "./modules/teams/teams_repository";
import { TeamsService } from "./modules/teams/teams_service";

export interface Container {
  app_dependencies: AppDependencies;
  /** The shared connection pool. server.ts destroys it on shutdown. */
  db: Database;
  /** Undefined when LIVE_SYNC_ENABLED=false. server.ts starts and stops it. */
  live_sync_poller: LiveSyncPoller | undefined;
}

export interface ServiceConfig {
  featured_team_external_id: string;
  demo_replay_enabled: boolean;
}

/** Repositories and services. Also used by tests with the test database and a fixed clock. */
export function build_services(db: Database, config: ServiceConfig, clock: Clock): AppServices {
  const games_repository = new KyselyGamesRepository(db);
  const games_service = new GamesService(games_repository, config.featured_team_external_id, clock);
  return {
    health_service: new HealthService(clock),
    teams_service: new TeamsService(new KyselyTeamsRepository(db)),
    games_service,
    standings_service: new StandingsService(new KyselyStandingsRepository(db)),
    demo_replay_service: config.demo_replay_enabled
      ? new DemoReplayService(
          games_repository,
          games_service,
          config.featured_team_external_id,
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

  const live_sync_poller = env.LIVE_SYNC_ENABLED
    ? new LiveSyncPoller(
        new LiveSyncJob(create_liiga_client(env), new KyselySyncGamesRepository(db), logger, clock),
        env.LIVE_SYNC_INTERVAL_SECONDS * 1000,
        logger,
      )
    : undefined;

  return {
    db,
    live_sync_poller,
    app_dependencies: {
      logger,
      cors_allowed_origins: env.CORS_ALLOWED_ORIGINS,
      ...build_services(
        db,
        {
          featured_team_external_id: env.FEATURED_TEAM_EXTERNAL_ID,
          demo_replay_enabled: env.DEMO_REPLAY_ENABLED,
        },
        clock,
      ),
    },
  };
}
