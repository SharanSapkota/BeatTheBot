import { describe, expect, it } from "vitest";
import {
  add_local_days,
  helsinki_day_range,
  is_local_date,
  local_days_between,
  to_helsinki_date,
} from "./helsinki_date";

describe("to_helsinki_date", () => {
  it("switches day at Helsinki midnight, not UTC midnight", () => {
    // Summer time (UTC+3) ends on 2026-10-25, so on 2026-10-24 midnight is 21:00 UTC.
    expect(to_helsinki_date(new Date("2026-10-24T20:59:59Z"))).toBe("2026-10-24");
    expect(to_helsinki_date(new Date("2026-10-24T21:00:00Z"))).toBe("2026-10-25");
    // Winter time (UTC+2).
    expect(to_helsinki_date(new Date("2026-12-31T21:59:59Z"))).toBe("2026-12-31");
    expect(to_helsinki_date(new Date("2026-12-31T22:00:00Z"))).toBe("2027-01-01");
  });
});

describe("helsinki_day_range", () => {
  it("returns the UTC start and end of a Helsinki day", () => {
    expect(helsinki_day_range("2026-10-24")).toEqual({
      start: new Date("2026-10-23T21:00:00Z"),
      end: new Date("2026-10-24T21:00:00Z"),
    });
    expect(helsinki_day_range("2026-12-31").start).toEqual(new Date("2026-12-30T22:00:00Z"));
  });

  it("has 25 hours on the day summer time ends", () => {
    const { start, end } = helsinki_day_range("2026-10-25");

    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });
});

describe("is_local_date", () => {
  it("accepts real dates only", () => {
    expect(is_local_date("2026-10-24")).toBe(true);
    expect(is_local_date("2028-02-29")).toBe(true);
    expect(is_local_date("2026-02-30")).toBe(false);
    expect(is_local_date("24.10.2026")).toBe(false);
    expect(is_local_date("today")).toBe(false);
  });
});

describe("add_local_days and local_days_between", () => {
  it("count calendar days across month ends", () => {
    expect(add_local_days("2026-10-31", 1)).toBe("2026-11-01");
    expect(add_local_days("2026-10-24", -30)).toBe("2026-09-24");
    expect(local_days_between("2026-10-01", "2026-11-01")).toBe(31);
  });
});
