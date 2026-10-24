import { describe, expect, it } from "vitest";
import {
  format_clock_time,
  format_countdown,
  format_day_label,
  format_event_time,
  format_number,
  format_period_clock,
  format_score,
  initials_of,
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
