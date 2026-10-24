// Slot math for room questions. Pure, so it is tested without a database.
// slot_index = slot_base + floor((now - schedule_started_at) / interval). A new room starts at
// created_at with slot 0, which is floor((now - created_at) / interval).

export interface RoomSchedule {
  schedule_started_at: Date;
  slot_base: number;
  question_interval_seconds: number;
}

export interface SlotWindow {
  slot_index: number;
  opens_at: Date;
  /** The question is open until here; from here on it is revealed. */
  locks_at: Date;
}

/** The slot that contains `now` and its time window. */
export function current_slot(schedule: RoomSchedule, now: Date): SlotWindow {
  const interval_ms = schedule.question_interval_seconds * 1000;
  const started_ms = schedule.schedule_started_at.getTime();
  const elapsed_ms = now.getTime() - started_ms;
  if (elapsed_ms < 0) {
    // After an interval change the new schedule starts when the current slot ends: until then
    // the slot before slot_base is still open.
    return {
      slot_index: schedule.slot_base - 1,
      opens_at: new Date(started_ms - interval_ms),
      locks_at: schedule.schedule_started_at,
    };
  }
  const slots_since_start = Math.floor(elapsed_ms / interval_ms);
  const opens_ms = started_ms + slots_since_start * interval_ms;
  return {
    slot_index: schedule.slot_base + slots_since_start,
    opens_at: new Date(opens_ms),
    locks_at: new Date(opens_ms + interval_ms),
  };
}

/** Whole seconds until the lock, rounded up; 0 once locked. */
export function seconds_left(locks_at: Date, now: Date): number {
  return Math.max(0, Math.ceil((locks_at.getTime() - now.getTime()) / 1000));
}

/** True once the question's slot is over: the answer and the split are shown. */
export function is_revealed(locks_at: Date, now: Date): boolean {
  return locks_at.getTime() <= now.getTime();
}

/**
 * The schedule after the owner picks a new interval: the current question stays open for its
 * whole slot, and the new speed starts with the next slot.
 */
export function schedule_after_interval_change(
  schedule: RoomSchedule,
  question_interval_seconds: number,
  now: Date,
): RoomSchedule {
  const window = current_slot(schedule, now);
  return {
    schedule_started_at: window.locks_at,
    slot_base: window.slot_index + 1,
    question_interval_seconds,
  };
}
