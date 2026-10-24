import { describe, expect, it } from "vitest";
import { add_days, get_helsinki_date, helsinki_time } from "./helsinki_time";

describe("helsinki_time", () => {
  it("uses summer time (UTC+3) before the October DST switch", () => {
    expect(helsinki_time({ year: 2026, month: 10, day: 24 }, 18, 30).toISOString()).toBe(
      "2026-10-24T15:30:00.000Z",
    );
  });

  it("uses winter time (UTC+2) after the DST switch on 25 October 2026", () => {
    expect(helsinki_time({ year: 2026, month: 10, day: 25 }, 18, 30).toISOString()).toBe(
      "2026-10-25T16:30:00.000Z",
    );
  });
});

describe("get_helsinki_date", () => {
  it("returns the Helsinki calendar date, which can differ from the UTC date", () => {
    expect(get_helsinki_date(new Date("2026-10-24T22:30:00.000Z"))).toEqual({
      year: 2026,
      month: 10,
      day: 25,
    });
  });
});

describe("add_days", () => {
  it("rolls over months and years", () => {
    expect(add_days({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(add_days({ year: 2026, month: 3, day: 1 }, -1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
  });
});
