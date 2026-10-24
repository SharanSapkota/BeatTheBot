import type { Logger } from "../common/logger";

export interface JobRunner {
  run(): Promise<unknown>;
}

export interface JobTrigger {
  /** Asks for a run soon; returns at once. */
  request_run(reason: string): void;
}

/**
 * Runs a job in the background, one run at a time. Requests that arrive during a run are
 * merged into one follow-up run. A failed run is logged and never crashes the API.
 * Used for the prediction model and for scoring finished games.
 */
export class JobScheduler implements JobTrigger {
  private current_run: Promise<void> | undefined;
  private pending_reason: string | undefined;

  constructor(
    private readonly job: JobRunner,
    private readonly logger: Logger,
    /** For the logs, e.g. "Model run". */
    private readonly job_name: string,
  ) {}

  request_run(reason: string): void {
    if (this.current_run) {
      this.pending_reason = reason;
      return;
    }
    this.current_run = this.run(reason).finally(() => {
      this.current_run = undefined;
      const next = this.pending_reason;
      this.pending_reason = undefined;
      if (next) {
        this.request_run(next);
      }
    });
  }

  /** Waits for a run in progress (used on shutdown and in tests). */
  async idle(): Promise<void> {
    while (this.current_run) {
      await this.current_run;
    }
  }

  private async run(reason: string): Promise<void> {
    try {
      this.logger.info({ reason }, `${this.job_name} started`);
      await this.job.run();
    } catch (error) {
      this.logger.error({ err: error, reason }, `${this.job_name} failed`);
    }
  }
}
