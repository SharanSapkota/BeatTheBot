import { create_app } from "./app";
import { env } from "./config/env";
import { build_container } from "./container";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const { app_dependencies, db, live_sync_poller } = build_container(env);
const { logger } = app_dependencies;
const app = create_app(app_dependencies);

const server = app.listen(env.API_PORT, (error) => {
  if (error) {
    logger.fatal({ err: error }, "API failed to start");
    process.exit(1);
  }
  logger.info(`API listening on http://localhost:${env.API_PORT}/api/v1`);
  live_sync_poller?.start();
});

function shut_down(signal: NodeJS.Signals): void {
  logger.info(`${signal} received, shutting down`);

  setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close((server_error) => {
    if (server_error) {
      logger.error({ err: server_error }, "Error while closing the server");
    }
    Promise.resolve(live_sync_poller?.stop())
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
