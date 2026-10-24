import { fromZonedTime } from "date-fns-tz";
import { HELSINKI_TIME_ZONE } from "../../common/helsinki_date";

// Time and text rules of an election. Pure.

/** Polling stations in Finland close at 20:00 on election day. */
const VOTING_CLOSE_TIME = "20:00:00";

/** Voting close: 20:00 Helsinki time on the election date (YYYY-MM-DD). */
export function voting_close_time(election_date: string): Date {
  return fromZonedTime(`${election_date}T${VOTING_CLOSE_TIME}`, HELSINKI_TIME_ZONE);
}

export function default_question(area_name: string): string {
  return `Who will get the most votes in ${area_name}?`;
}

export interface PollWindow {
  election_date: string;
  poll_opens_at: Date;
  poll_closes_at: Date;
}

/** The problem with the poll window, or null when it is fine. */
export function poll_window_problem(window: PollWindow): string | null {
  if (window.poll_opens_at >= window.poll_closes_at) {
    return "The poll must open before it closes";
  }
  if (window.poll_closes_at > voting_close_time(window.election_date)) {
    return "The poll must close before or at voting close (20:00 on election day, Helsinki time)";
  }
  return null;
}

export interface PollState {
  status: string;
  poll_opens_at: Date;
  poll_closes_at: Date;
}

/** Picks can be made or changed now. */
export function is_poll_open(election: PollState, now: Date): boolean {
  return (
    election.status === "published" &&
    now >= election.poll_opens_at &&
    now < election.poll_closes_at
  );
}

/** No more picks: closed or resulted, or the close time has passed (server clock). */
export function is_poll_closed(election: PollState, now: Date): boolean {
  return (
    election.status === "closed" || election.status === "resulted" || now >= election.poll_closes_at
  );
}

/** Open polls first (closing soonest), then not yet open, then closed (newest election first). */
export function compare_for_list<T extends PollState & { election_date: string }>(
  now: Date,
): (first: T, second: T) => number {
  const group = (election: T) =>
    is_poll_open(election, now) ? 0 : is_poll_closed(election, now) ? 2 : 1;
  return (first, second) => {
    const by_group = group(first) - group(second);
    if (by_group !== 0) {
      return by_group;
    }
    if (group(first) === 2) {
      return second.election_date.localeCompare(first.election_date);
    }
    return first.poll_closes_at.getTime() - second.poll_closes_at.getTime();
  };
}
