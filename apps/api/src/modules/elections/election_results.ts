import { ELECTION_RESULTS_MIN_PICKS, type ResultsHiddenReason } from "@voita_kone/shared_types";

// When users may see the share of picks per candidate. Pure, so the rules are unit tested.

export interface ResultsVisibilityInput {
  has_picked: boolean;
  is_poll_closed: boolean;
  total_picks: number;
}

/**
 * null = visible. Shown only after the user picked (or once the poll closed), and only
 * from 20 picks on.
 */
export function results_hidden_reason(input: ResultsVisibilityInput): ResultsHiddenReason | null {
  if (!input.has_picked && !input.is_poll_closed) {
    return "pick_first";
  }
  if (input.total_picks < ELECTION_RESULTS_MIN_PICKS) {
    return "not_enough_picks";
  }
  return null;
}

export interface CandidateShare {
  candidate_id: string;
  picks: number;
  share: number;
}

/** Picks and share per candidate, in the given (user's) order; candidates without picks get 0. */
export function build_shares(
  ordered_candidate_ids: readonly string[],
  picks_by_candidate: ReadonlyMap<string, number>,
): CandidateShare[] {
  const total = ordered_candidate_ids.reduce(
    (sum, candidate_id) => sum + (picks_by_candidate.get(candidate_id) ?? 0),
    0,
  );
  return ordered_candidate_ids.map((candidate_id) => {
    const picks = picks_by_candidate.get(candidate_id) ?? 0;
    return { candidate_id, picks, share: total === 0 ? 0 : picks / total };
  });
}
