// Display formats from the design. Times are shown in Europe/Helsinki; the API sends UTC.

const HELSINKI = "Europe/Helsinki";
const SECONDS_PER_PERIOD = 20 * 60;
/** No-break space as the Finnish thousands separator ("1 240"); the font subsets lack U+202F. */
const NO_BREAK_SPACE = "\u00A0";
const EN_DASH = "\u2013";

const time_formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: HELSINKI,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const day_formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: HELSINKI,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "18:30" */
export function format_clock_time(instant: string | Date): string {
  return time_formatter.format(new Date(instant));
}

/** "Sat 24 Oct" */
export function format_day_label(instant: string | Date): string {
  const parts = day_formatter.formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/** "3 – 1", "2 – 1 OT" */
export function format_score(
  home_goals: number,
  away_goals: number,
  ended_in: string | null = null,
): string {
  const suffix = ended_in === "overtime" ? " OT" : ended_in === "shootout" ? " SO" : "";
  return `${String(home_goals)} ${EN_DASH} ${String(away_goals)}${suffix}`;
}

/** "1–0": a compact score for chart labels. */
export function format_compact_score(home_goals: number, away_goals: number): string {
  return `${String(home_goals)}${EN_DASH}${String(away_goals)}`;
}

/** 1240 -> "1 240" */
export function format_number(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, NO_BREAK_SPACE);
}

/** 0.62 -> "62%" */
export function format_percent(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}

/** 2 -> "2nd"; overtime and shootout get their own names. */
export function format_period(period: number): string {
  if (period === 4) {
    return "OT";
  }
  if (period === 5) {
    return "SO";
  }
  return ["1st", "2nd", "3rd"][period - 1] ?? `${String(period)}th`;
}

function two_digits(value: number): string {
  return String(value).padStart(2, "0");
}

/** Clock inside the period: game second 1961 in the 2nd period -> "12:41". */
export function format_period_clock(game_time_seconds: number, period: number): string {
  const in_period = Math.max(0, game_time_seconds - (Math.min(period, 4) - 1) * SECONDS_PER_PERIOD);
  return `${two_digits(Math.floor(in_period / 60))}:${two_digits(in_period % 60)}`;
}

/** Event time as in the design: "2. 05:12" */
export function format_event_time(period: number, game_time_seconds: number): string {
  return `${String(Math.min(period, 4))}. ${format_period_clock(game_time_seconds, period)}`;
}

/** Game minute and second from the start: 3063 -> "51:03" */
export function format_game_time(game_time_seconds: number): string {
  return `${two_digits(Math.floor(game_time_seconds / 60))}:${two_digits(game_time_seconds % 60)}`;
}

/** "02:14:36" for a lock countdown. */
export function format_countdown(milliseconds: number): string {
  const total_seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total_seconds / 3600);
  const minutes = Math.floor((total_seconds % 3600) / 60);
  return `${two_digits(hours)}:${two_digits(minutes)}:${two_digits(total_seconds % 60)}`;
}

/** "1:14" for short countdowns. */
export function format_short_countdown(milliseconds: number): string {
  const total_seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(total_seconds / 60))}:${two_digits(total_seconds % 60)}`;
}

/** "0:42" for clip lengths. */
export function format_duration(seconds: number): string {
  return format_short_countdown(seconds * 1000);
}

/**
 * Avatar initials as in the design: "Eetu Laine" -> "EL", "MikaK_Oulu" -> "MK",
 * "TappaJani" -> "TJ", "sanna.l" -> "SL". Words split at spaces, . _ - and camelCase.
 */
export function initials_of(name: string): string {
  const words = name
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .split(/[\s._-]+/)
    .filter((word) => word.length > 0);
  const first = words[0] ?? "";
  const second = words[1] ?? first.slice(1);
  return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase();
}
