import { describe, expect, it } from "vitest";
import {
  current_slot,
  is_revealed,
  schedule_after_interval_change,
  seconds_left,
  type RoomSchedule,
} from "./room_slots";

const CREATED = new Date("2026-10-24T12:00:00.000Z");
const SCHEDULE: RoomSchedule = {
  schedule_started_at: CREATED,
  slot_base: 0,
  question_interval_seconds: 60,
};

function at(seconds: number): Date {
  return new Date(CREATED.getTime() + seconds * 1000);
}

describe("current_slot", () => {
  it("is floor((now - created_at) / interval)", () => {
    expect(current_slot(SCHEDULE, at(0)).slot_index).toBe(0);
    expect(current_slot(SCHEDULE, at(59.9)).slot_index).toBe(0);
    expect(current_slot(SCHEDULE, at(60)).slot_index).toBe(1);
    expect(current_slot(SCHEDULE, at(3600)).slot_index).toBe(60);
  });

  it("gives the slot's window", () => {
    const window = current_slot(SCHEDULE, at(150));
    expect(window).toEqual({ slot_index: 2, opens_at: at(120), locks_at: at(180) });
  });

  it("adds slot_base after a schedule restart", () => {
    const schedule = {
      schedule_started_at: at(600),
      slot_base: 10,
      question_interval_seconds: 300,
    };
    expect(current_slot(schedule, at(600)).slot_index).toBe(10);
    expect(current_slot(schedule, at(1199)).slot_index).toBe(11);
  });

  it("keeps the previous slot open until a restarted schedule begins", () => {
    const schedule = {
      schedule_started_at: at(600),
      slot_base: 10,
      question_interval_seconds: 300,
    };
    const window = current_slot(schedule, at(590));
    expect(window.slot_index).toBe(9);
    expect(window.locks_at).toEqual(at(600));
  });
});

describe("seconds_left and is_revealed", () => {
  it("rounds up and stops at 0", () => {
    expect(seconds_left(at(60), at(0.5))).toBe(60);
    expect(seconds_left(at(60), at(59.1))).toBe(1);
    expect(seconds_left(at(60), at(61))).toBe(0);
  });

  it("reveals from the lock time on", () => {
    expect(is_revealed(at(60), at(59))).toBe(false);
    expect(is_revealed(at(60), at(60))).toBe(true);
  });
});

describe("schedule_after_interval_change", () => {
  it("starts the new speed after the current slot, without skipping a slot", () => {
    const changed = schedule_after_interval_change(SCHEDULE, 300, at(150));
    expect(changed).toEqual({
      schedule_started_at: at(180),
      slot_base: 3,
      question_interval_seconds: 300,
    });
    expect(current_slot(changed, at(170)).slot_index).toBe(2);
    expect(current_slot(changed, at(180)).slot_index).toBe(3);
    expect(current_slot(changed, at(480)).slot_index).toBe(4);
  });
});
