import { describe, expect, it } from "vitest";
import {
  compare_for_list,
  default_question,
  is_poll_closed,
  is_poll_open,
  poll_window_problem,
  voting_close_time,
} from "./election_rules";

const NOW = new Date("2026-10-24T12:00:00.000Z");

describe("voting_close_time", () => {
  it("is 20:00 Helsinki time on election day (winter and summer time)", () => {
    expect(voting_close_time("2026-11-14").toISOString()).toBe("2026-11-14T18:00:00.000Z");
    expect(voting_close_time("2027-04-18").toISOString()).toBe("2027-04-18T17:00:00.000Z");
  });
});

describe("poll_window_problem", () => {
  const window = {
    election_date: "2026-11-14",
    poll_opens_at: new Date("2026-10-20T08:00:00Z"),
    poll_closes_at: new Date("2026-11-14T18:00:00Z"),
  };

  it("accepts a poll that closes at voting close", () => {
    expect(poll_window_problem(window)).toBeNull();
  });

  it("rejects a poll that closes after voting close", () => {
    expect(
      poll_window_problem({ ...window, poll_closes_at: new Date("2026-11-14T18:00:01Z") }),
    ).toMatch(/voting close/);
  });

  it("rejects a poll that opens after it closes", () => {
    expect(
      poll_window_problem({ ...window, poll_opens_at: new Date("2026-11-15T08:00:00Z") }),
    ).toMatch(/open before/);
  });
});

describe("poll state", () => {
  const election = {
    status: "published",
    poll_opens_at: new Date("2026-10-20T08:00:00Z"),
    poll_closes_at: new Date("2026-10-24T13:00:00Z"),
  };

  it("is open between open and close time while published", () => {
    expect(is_poll_open(election, NOW)).toBe(true);
    expect(is_poll_open({ ...election, status: "closed" }, NOW)).toBe(false);
    expect(is_poll_open(election, election.poll_closes_at)).toBe(false);
  });

  it("is closed at the close time or when closed by the admin", () => {
    expect(is_poll_closed(election, NOW)).toBe(false);
    expect(is_poll_closed(election, election.poll_closes_at)).toBe(true);
    expect(is_poll_closed({ ...election, status: "resulted" }, NOW)).toBe(true);
  });
});

describe("compare_for_list", () => {
  it("lists open polls first, then upcoming, then closed", () => {
    const make = (id: string, opens: string, closes: string, election_date: string) => ({
      id,
      status: "published",
      poll_opens_at: new Date(opens),
      poll_closes_at: new Date(closes),
      election_date,
    });
    const elections = [
      make("closed", "2026-09-01T00:00Z", "2026-10-01T00:00Z", "2026-10-01"),
      make("later", "2026-11-01T00:00Z", "2026-11-20T00:00Z", "2026-11-20"),
      make("open_late", "2026-10-01T00:00Z", "2026-12-01T00:00Z", "2026-12-01"),
      make("open_soon", "2026-10-01T00:00Z", "2026-10-30T00:00Z", "2026-10-30"),
    ];
    expect([...elections].sort(compare_for_list(NOW)).map((election) => election.id)).toEqual([
      "open_soon",
      "open_late",
      "later",
      "closed",
    ]);
  });
});

describe("default_question", () => {
  it("asks for a prediction, never for the user's own vote", () => {
    expect(default_question("Oulu")).toBe("Who will get the most votes in Oulu?");
    expect(default_question("Oulu")).not.toMatch(/you vote/i);
  });
});
