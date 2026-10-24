// Election picks (docs/product.md → Elections). Pure: the API scores picks with this rule when
// the admin enters the result; scoring again gives the same points (idempotent).

/** A correct prediction of the most-voted candidate. No prizes for election picks. */
export const ELECTION_POINTS = 20;

/** 20 when the picked candidate got the most votes, else 0. */
export function score_election_pick(
  picked_candidate_id: string,
  winner_candidate_id: string,
): number {
  return picked_candidate_id === winner_candidate_id ? ELECTION_POINTS : 0;
}
