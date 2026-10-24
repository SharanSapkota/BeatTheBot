import { add_local_days, helsinki_day_range, to_helsinki_date } from "../../common/helsinki_date";

const DAYS_PER_WEEK = 7;

/** The Monday (Helsinki date) of the week that contains this instant. Weeks run Mon–Sun. */
export function week_monday(instant: Date): string {
  const local_date = to_helsinki_date(instant);
  // Noon UTC is on the same calendar day everywhere, so getUTCDay gives the local weekday.
  const weekday = new Date(`${local_date}T12:00:00Z`).getUTCDay();
  const days_since_monday = (weekday + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  return add_local_days(local_date, -days_since_monday);
}

/** Start of the Helsinki week that contains this instant. */
export function week_start(instant: Date): Date {
  return helsinki_day_range(week_monday(instant)).start;
}

/** The Mondays of the `count` full weeks before this instant's week, newest first. */
export function previous_week_mondays(instant: Date, count: number): string[] {
  const this_monday = week_monday(instant);
  return Array.from({ length: count }, (_, index) =>
    add_local_days(this_monday, -DAYS_PER_WEEK * (index + 1)),
  );
}
