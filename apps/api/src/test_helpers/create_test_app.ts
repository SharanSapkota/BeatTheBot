import { pino } from "pino";
import { create_app, type AppDependencies } from "../app";
import { build_services, type ServiceConfig } from "../container";
import type { Database } from "../db/kysely";
import { create_test_database } from "./test_database";

export const TEST_NOW = new Date("2026-10-24T12:00:00.000Z");
export const KARPAT_EXTERNAL_ID = "495643563:kärpät";

export interface TestAppOptions {
  /** Defaults to a pool on the test database; it only connects when a query runs. */
  db?: Database;
  now?: Date;
  config?: Partial<ServiceConfig>;
  /** Proxy hops trusted for X-Forwarded-For; 0 by default. */
  trust_proxy_hops?: number;
}

export function create_test_dependencies(options: TestAppOptions = {}): AppDependencies {
  const now = options.now ?? TEST_NOW;
  const logger = pino({ level: "silent" });
  return {
    logger,
    cors_allowed_origins: ["http://localhost:5173"],
    trust_proxy_hops: options.trust_proxy_hops ?? 0,
    ...build_services(
      options.db ?? create_test_database(),
      {
        featured_team_external_id: KARPAT_EXTERNAL_ID,
        demo_replay_enabled: true,
        upload_status: { file_uploads: false, reason: null, directory: null },
        ...options.config,
      },
      () => now,
      logger,
    ),
  };
}

export function create_test_app(options: TestAppOptions = {}) {
  return create_app(create_test_dependencies(options));
}
