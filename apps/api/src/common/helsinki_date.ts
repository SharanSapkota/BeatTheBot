import { addDays, differenceInCalendarDays, isValid, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

// Game days are Europe/Helsinki calendar days ("YYYY-MM-DD"). Instants stay in UTC.

export const HELSINKI_TIME_ZONE = "Europe/Helsinki";
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The Helsinki calendar day of an instant, e.g. 2026-10-24T22:30Z -> "2026-10-25". */
export function to_helsinki_date(instant: Date): string {
  return formatInTimeZone(instant, HELSINKI_TIME_ZONE, "yyyy-MM-dd");
}

/** True for a real calendar date in YYYY-MM-DD form ("2026-02-30" is false). */
export function is_local_date(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = at_utc_noon(value);
  return isValid(parsed) && format_utc_date(parsed) === value;
}

export function add_local_days(date: string, days: number): string {
  return format_utc_date(addDays(at_utc_noon(date), days));
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function local_days_between(from: string, to: string): number {
  return differenceInCalendarDays(at_utc_noon(to), at_utc_noon(from));
}

// Calendar arithmetic at noon UTC, so the machine's own time zone never shifts the day.
function at_utc_noon(date: string): Date {
  return parseISO(`${date}T12:00:00Z`);
}

function format_utc_date(instant: Date): string {
  return formatInTimeZone(instant, "UTC", "yyyy-MM-dd");
}

/** UTC instants of a Helsinki day: [start, end). Handles DST (23 or 25 hour days). */
export function helsinki_day_range(date: string): { start: Date; end: Date } {
  return {
    start: fromZonedTime(`${date}T00:00:00`, HELSINKI_TIME_ZONE),
    end: fromZonedTime(`${add_local_days(date, 1)}T00:00:00`, HELSINKI_TIME_ZONE),
  };
}
