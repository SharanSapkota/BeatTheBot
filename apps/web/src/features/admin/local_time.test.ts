import { describe, expect, it } from "vitest";
import { from_local_input, local_date_in, to_local_input } from "./local_time";

describe("local time inputs", () => {
  it("round-trips an instant through the datetime-local value", () => {
    const iso = "2026-11-14T18:00:00.000Z";
    expect(from_local_input(to_local_input(iso))).toBe(iso);
  });

  it("gives an empty string for an empty value", () => {
    expect(from_local_input("")).toBe("");
  });

  it("adds days to a local date", () => {
    expect(local_date_in(21, new Date(2026, 9, 24, 15, 0))).toBe("2026-11-14");
  });
});
