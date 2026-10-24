const HELSINKI_TIME_ZONE = "Europe/Helsinki";

export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

const date_formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: HELSINKI_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

function get_helsinki_parts(instant: Date): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const part of date_formatter.formatToParts(instant)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  return parts;
}

// How far Helsinki wall-clock time is ahead of UTC at this instant (+2 h or +3 h).
function get_helsinki_offset_ms(instant: Date): number {
  const parts = get_helsinki_parts(instant);
  const wall_clock_as_utc = Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return wall_clock_as_utc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function get_helsinki_date(instant: Date): LocalDate {
  const parts = get_helsinki_parts(instant);
  return { year: parts.year ?? 0, month: parts.month ?? 1, day: parts.day ?? 1 };
}

export function add_days(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** The UTC instant of a Helsinki wall-clock time, e.g. 18:30 on a given day. Handles DST. */
export function helsinki_time(date: LocalDate, hour: number, minute: number): Date {
  const wall_clock_as_utc = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const first_guess = wall_clock_as_utc - get_helsinki_offset_ms(new Date(wall_clock_as_utc));
  // Re-check the offset at the guessed instant in case a DST switch lies in between.
  return new Date(wall_clock_as_utc - get_helsinki_offset_ms(new Date(first_guess)));
}
