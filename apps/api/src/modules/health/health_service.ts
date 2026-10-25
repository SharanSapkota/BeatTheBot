import type { HealthData } from "@voita_kone/shared_types";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import type { HealthRepository } from "./health_repository";

/** Long enough for a Neon compute to wake up, short enough for the platform health check. */
const DATABASE_TIMEOUT_MS = 5_000;

function database_unavailable(): AppError {
  return new AppError("DATABASE_UNAVAILABLE", 503, "The database is not reachable.");
}

export class HealthService {
  constructor(
    private readonly health_repository: HealthRepository,
    private readonly clock: Clock,
    private readonly database_timeout_ms = DATABASE_TIMEOUT_MS,
  ) {}

  /** ok when the database answers in time, else 503 DATABASE_UNAVAILABLE. */
  async get_health(): Promise<HealthData> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(database_unavailable());
      }, this.database_timeout_ms);
    });
    try {
      await Promise.race([this.health_repository.ping(), timeout]);
    } catch {
      throw database_unavailable();
    } finally {
      clearTimeout(timer);
    }
    return { status: "ok", database: "ok", time: this.clock().toISOString() };
  }
}
