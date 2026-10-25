import { create_app } from "./app";
import { check_upload_dir } from "./common/upload_dir";
import { env } from "./config/env";
import { build_container } from "./container";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const upload_status = check_upload_dir(env.UPLOAD_DIR, env.NODE_ENV);
const {
  app_dependencies,
  db,
  live_sync_poller,
  model_run_scheduler,
  scoring_scheduler,
  answers_scoring_scheduler,
  stories_scheduler,
  demo_refresh_scheduler,
} = build_container(env, upload_status);
const { logger } = app_dependencies;
const app = create_app(app_dependencies);

if (!upload_status.file_uploads) {
  logger.warn(upload_status.reason ?? "File uploads are off");
}

// Render and Railway set PORT. No host: listens on all interfaces (IPv4 and IPv6).
const server = app.listen(env.LISTEN_PORT, (error) => {
  if (error) {
    logger.fatal({ err: error }, "API failed to start");
    process.exit(1);
  }
  logger.info(
    { port: env.LISTEN_PORT, node_env: env.NODE_ENV, trust_proxy_hops: env.TRUST_PROXY_HOPS },
    "API listening on /api/v1",
  );
  live_sync_poller?.start();
  // In the background: the API answers requests while the model runs.
  model_run_scheduler.request_run("api start");
  scoring_scheduler.request_run("api start");
  answers_scoring_scheduler.request_run("api start");
  stories_scheduler.request_run("api start");
  demo_refresh_scheduler.request_run("api start");
});

// Previews appear when a game enters the 7-day window and are refreshed 2 h before puck drop.
const STORIES_INTERVAL_MS = 10 * 60 * 1000;
const stories_timer = setInterval(() => {
  stories_scheduler.request_run("timer");
}, STORIES_INTERVAL_MS);
stories_timer.unref();

// Passed sample games become results and the coming week keeps its sample games.
const DEMO_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const demo_refresh_timer = setInterval(() => {
  demo_refresh_scheduler.request_run("timer");
}, DEMO_REFRESH_INTERVAL_MS);
demo_refresh_timer.unref();

let shutting_down = false;

/**
 * SIGTERM (a deploy or restart on Render / Railway) or SIGINT: stop taking requests, stop the
 * timers, live sync and jobs (a job in progress finishes), then close the database pool.
 */
function shut_down(signal: NodeJS.Signals): void {
  if (shutting_down) {
    return;
  }
  shutting_down = true;
  logger.info(`${signal} received, shutting down`);

  setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  clearInterval(stories_timer);
  clearInterval(demo_refresh_timer);
  const stop_background_work = Promise.resolve(live_sync_poller?.stop()).then(() =>
    Promise.all([
      model_run_scheduler.stop(),
      scoring_scheduler.stop(),
      answers_scoring_scheduler.stop(),
      stories_scheduler.stop(),
      demo_refresh_scheduler.stop(),
    ]),
  );
  server.close((server_error) => {
    if (server_error) {
      logger.error({ err: server_error }, "Error while closing the server");
    }
    stop_background_work
      .then(() => db.destroy())
      .then(() => {
        logger.info("Shutdown complete");
        process.exit(server_error ? 1 : 0);
      })
      .catch((db_error: unknown) => {
        logger.error({ err: db_error }, "Error while closing the database pool");
        process.exit(1);
      });
  });
  // Keep-alive connections would hold server.close() open until they time out.
  server.closeIdleConnections();
}

process.once("SIGINT", shut_down);
process.once("SIGTERM", shut_down);
