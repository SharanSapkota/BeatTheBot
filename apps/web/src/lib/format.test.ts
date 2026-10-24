import { describe, expect, it } from "vitest";
import {
  add_days_to_date,
  format_clock_time,
  format_countdown,
  format_day_label,
  format_event_time,
  format_number,
  format_period_clock,
  format_relative_day,
  format_score,
  helsinki_date_of,
  initials_of,
  is_local_date_text,
} from "./format";

describe("format", () => {
  it("shows times and days in Helsinki", () => {
    expect(format_clock_time("2026-10-24T15:30:00Z")).toBe("18:30");
    expect(format_day_label("2026-10-24T12:00:00Z")).toBe("Sat 24 Oct");
  });

  it("formats scores with an en dash and OT", () => {
    expect(format_score(3, 1)).toBe("3 – 1");
    expect(format_score(2, 1, "overtime")).toBe("2 – 1 OT");
  });

  it("separates thousands with a no-break space", () => {
    expect(format_number(1240)).toBe("1 240");
    expect(format_number(212)).toBe("212");
  });

  it("shows game clocks as in the design", () => {
    expect(format_period_clock(1961, 2)).toBe("12:41");
    expect(format_event_time(2, 1512)).toBe("2. 05:12");
    expect(format_countdown((2 * 3600 + 14 * 60 + 36) * 1000)).toBe("02:14:36");
  });

  it("makes avatar initials like the design", () => {
    expect(initials_of("MikaK_Oulu")).toBe("MK");
    expect(initials_of("sanna.l")).toBe("SL");
    expect(initials_of("TappaJani")).toBe("TJ");
    expect(initials_of("Eetu Laine")).toBe("EL");
  });
});

describe("Helsinki days", () => {
  it("gives the Helsinki day around midnight and the summer time change", () => {
    // 23:30 Helsinki (UTC+3) on 24 Oct; 00:30 on the 25th; 00:30 on the 26th (UTC+2).
    expect(helsinki_date_of("2026-10-24T20:30:00Z")).toBe("2026-10-24");
    expect(helsinki_date_of("2026-10-24T21:30:00Z")).toBe("2026-10-25");
    expect(helsinki_date_of("2026-10-25T22:30:00Z")).toBe("2026-10-26");
    expect(add_days_to_date("2026-10-31", 1)).toBe("2026-11-01");
    expect(add_days_to_date("2026-10-25", -1)).toBe("2026-10-24");
    expect(format_relative_day("2026-10-25", "2026-10-25")).toBe("Today");
    expect(format_relative_day("2026-10-24", "2026-10-25")).toBe("Yesterday");
    expect(format_relative_day("2026-10-26", "2026-10-25")).toBe("Tomorrow");
    expect(format_relative_day("2026-10-27", "2026-10-25")).toBe("Tue 27 Oct");
    expect(is_local_date_text("2026-10-27")).toBe(true);
    expect(is_local_date_text("2026-02-30")).toBe(false);
    expect(is_local_date_text("2026-13-01")).toBe(false);
    expect(is_local_date_text("27.10.2026")).toBe(false);
  });
});
