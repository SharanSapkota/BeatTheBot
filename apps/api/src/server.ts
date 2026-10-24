import { create_app } from "./app";
import { env } from "./config/env";
import { build_container } from "./container";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const {
  app_dependencies,
  db,
  live_sync_poller,
  model_run_scheduler,
  scoring_scheduler,
  answers_scoring_scheduler,
  stories_scheduler,
} = build_container(env);
const { logger } = app_dependencies;
const app = create_app(app_dependencies);

const server = app.listen(env.API_PORT, (error) => {
  if (error) {
    logger.fatal({ err: error }, "API failed to start");
    process.exit(1);
  }
  logger.info(`API listening on http://localhost:${env.API_PORT}/api/v1`);
  live_sync_poller?.start();
  // In the background: the API answers requests while the model runs.
  model_run_scheduler.request_run("api start");
  scoring_scheduler.request_run("api start");
  answers_scoring_scheduler.request_run("api start");
  stories_scheduler.request_run("api start");
});

// Previews appear when a game enters the 7-day window and are refreshed 2 h before puck drop.
const STORIES_INTERVAL_MS = 10 * 60 * 1000;
const stories_timer = setInterval(() => {
  stories_scheduler.request_run("timer");
}, STORIES_INTERVAL_MS);
stories_timer.unref();

function shut_down(signal: NodeJS.Signals): void {
  logger.info(`${signal} received, shutting down`);

  setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  clearInterval(stories_timer);
  server.close((server_error) => {
    if (server_error) {
      logger.error({ err: server_error }, "Error while closing the server");
    }
    Promise.resolve(live_sync_poller?.stop())
      .then(() =>
        Promise.all([
          model_run_scheduler.idle(),
          scoring_scheduler.idle(),
          answers_scoring_scheduler.idle(),
          stories_scheduler.idle(),
        ]),
      )
      .then(() => db.destroy())
      .then(() => process.exit(server_error ? 1 : 0))
      .catch((db_error: unknown) => {
        logger.error({ err: db_error }, "Error while closing the database pool");
        process.exit(1);
      });
  });
}

process.once("SIGINT", shut_down);
process.once("SIGTERM", shut_down);
