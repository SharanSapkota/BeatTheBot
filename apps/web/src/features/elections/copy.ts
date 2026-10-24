import type { ElectionStatus, ElectionSummary, ElectionType } from "@voita_kone/shared_types";

// Elections text (step 7). No design exists: Kaleva theme tokens and the existing components.
// We ask for a prediction ("who will get the most votes"), never "who will you vote for".

const HELSINKI = "Europe/Helsinki";
const DAY_MS = 24 * 60 * 60 * 1000;

const date_format = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: HELSINKI,
});
const today_format = new Intl.DateTimeFormat("en-CA", { timeZone: HELSINKI });
const time_format = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: HELSINKI,
});

/** "Sat 14 Nov 2026" for a YYYY-MM-DD election date. */
export function format_election_date(date: string): string {
  return date_format.format(new Date(`${date}T12:00:00Z`));
}

/** Whole days from today (Helsinki) to the election date. */
export function days_until(date: string, now: Date): number {
  const today = today_format.format(now);
  return Math.round(
    (new Date(`${date}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / DAY_MS,
  );
}

export function format_poll_time(instant: string): string {
  return time_format.format(new Date(instant));
}

const TYPE_LABELS: Record<ElectionType, string> = {
  parliamentary: "Parliamentary election",
  municipal: "Municipal election",
  presidential: "Presidential election",
  county: "County election",
  other: "Election",
};

const STATUS_LABELS: Record<ElectionStatus, string> = {
  draft: "Draft",
  published: "Open",
  closed: "Predictions closed",
  resulted: "Result in",
};

export const elections_copy = {
  title: "Elections",
  intro: "Predict who will get the most votes. Free to play, no prizes.",
  area_group: "Area",
  all_areas: "All areas",
  list_label: "Elections",
  empty_title: "No elections right now",
  empty_text: "New elections show up here when the Kaleva desk adds them.",
  type_label: (type: ElectionType) => TYPE_LABELS[type],
  status_label: (election: Pick<ElectionSummary, "status" | "is_poll_open">) =>
    election.status === "published" && !election.is_poll_open
      ? "Opens soon"
      : STATUS_LABELS[election.status],
  days_left: (days: number) =>
    days > 1 ? `${String(days)} days left` : days === 1 ? "Tomorrow" : days === 0 ? "Today" : "",
  candidates_count: (count: number) => `${String(count)} candidates`,
  back: "Elections",
  candidates_title: "Candidates",
  candidates_label: "Candidates, in random order",
  order_note: "Candidates are shown in a random order.",
  number_label: (number: number) => `No. ${String(number)}`,
  pick: "Pick",
  picked: "Your pick",
  pick_label: (name: string) => `Pick ${name}`,
  change_hint: (time: string) => `You can change your pick until ${time}.`,
  opens_at: (time: string) => `Predictions open ${time}.`,
  closed_text: "Predictions are closed.",
  pick_failed: "Your pick was not saved. Check your connection and try again.",
  poll_closed_error: "Predictions closed while you were picking.",
  results_title: "What Voita Kaleva users predict",
  results_label: "Not a scientific poll. Shows only the picks of Voita Kaleva users.",
  results_pick_first: "Make your prediction to see what other users picked.",
  results_not_enough: (min: number, total: number) =>
    `Results show after ${String(min)} picks (${String(total)} so far).`,
  share_label: (name: string, percent: string, picks: number) =>
    `${name}: ${percent} of picks (${String(picks)})`,
  winner: "Most votes",
  you_were_right: (points: number) => `You were right: +${String(points)} points`,
  you_were_wrong: "Not this time: 0 points",
  points_note: "A correct prediction is worth 20 points on the election leaderboard. No prizes.",

  footer: "Concept demo · predictions only, no votes are collected · no AI in elections",
} as const;
