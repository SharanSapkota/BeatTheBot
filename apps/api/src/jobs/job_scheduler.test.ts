import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { JobScheduler } from "./job_scheduler";

const logger = pino({ level: "silent" });

describe("JobScheduler", () => {
  class SlowJob {
    runs = 0;
    release: (() => void) | undefined;

    run(): Promise<unknown> {
      this.runs += 1;
      return new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
  }

  it("runs in the background and merges requests made during a run into one", async () => {
    const slow = new SlowJob();
    const scheduler = new JobScheduler(slow, logger, "Test job");

    scheduler.request_run("start");
    scheduler.request_run("final 1");
    scheduler.request_run("final 2");
    expect(slow.runs).toBe(1);

    slow.release?.();
    await new Promise((resolve) => setImmediate(resolve));
    expect(slow.runs).toBe(2);
    slow.release?.();
    await scheduler.idle();
    expect(slow.runs).toBe(2);
  });

  it("logs a failed run and keeps working", async () => {
    let calls = 0;
    const scheduler = new JobScheduler(
      {
        run: () => {
          calls += 1;
          return Promise.reject(new Error("boom"));
        },
      },
      logger,
      "Test job",
    );

    scheduler.request_run("first");
    await scheduler.idle();
    scheduler.request_run("second");
    await scheduler.idle();

    expect(calls).toBe(2);
  });

  it("stops: finishes the run in progress, drops a queued run and starts no new ones", async () => {
    const slow = new SlowJob();
    const scheduler = new JobScheduler(slow, logger, "Test job");
    scheduler.request_run("start");
    scheduler.request_run("queued");

    const stopped = scheduler.stop();
    slow.release?.();
    await stopped;
    scheduler.request_run("after shutdown");

    expect(slow.runs).toBe(1);
  });
});
