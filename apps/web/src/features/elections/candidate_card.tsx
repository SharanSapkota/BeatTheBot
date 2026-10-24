import type { ElectionCandidate } from "@voita_kone/shared_types";
import { class_names } from "../../lib/class_names";
import { format_percent, initials_of } from "../../lib/format";
import { CheckIcon } from "../../components/icons/check_icon";
import { elections_copy } from "./copy";
import styles from "./candidate_card.module.css";

interface CandidateCardProps {
  candidate: ElectionCandidate;
  is_picked: boolean;
  is_winner: boolean;
  /** The share of all users' picks; undefined while results are hidden. */
  share: { share: number; picks: number } | undefined;
  /** False when the poll is closed or in the admin preview. */
  can_pick: boolean;
  is_saving: boolean;
  on_pick: () => void;
}

/** Fairness: every candidate gets this same card. No party colours, no AI text. */
export function CandidateCard({
  candidate,
  is_picked,
  is_winner,
  share,
  can_pick,
  is_saving,
  on_pick,
}: CandidateCardProps) {
  const meta = [
    candidate.party_or_group,
    candidate.candidate_number === null
      ? null
      : elections_copy.number_label(candidate.candidate_number),
  ].filter((part) => part !== null);

  return (
    <li className={class_names(styles.card, is_picked && styles.picked)}>
      <div className={styles.top}>
        {candidate.photo_url ? (
          <img className={styles.photo} src={candidate.photo_url} alt="" loading="lazy" />
        ) : (
          <span className={styles.initials} aria-hidden="true">
            {initials_of(candidate.full_name)}
          </span>
        )}
        <div className={styles.text}>
          <h3 className={styles.name}>{candidate.full_name}</h3>
          {meta.length > 0 && <p className={styles.meta}>{meta.join(" · ")}</p>}
          {is_winner && <span className={styles.winner}>{elections_copy.winner}</span>}
        </div>
      </div>
      {candidate.short_bio && <p className={styles.bio}>{candidate.short_bio}</p>}
      {share && (
        <div className={styles.result}>
          <div className={styles.track} aria-hidden="true">
            <span style={{ width: `${String(Math.round(share.share * 100))}%` }} />
          </div>
          <span
            className={styles.percent}
            aria-label={elections_copy.share_label(
              candidate.full_name,
              format_percent(share.share),
              share.picks,
            )}
          >
            {format_percent(share.share)}
          </span>
        </div>
      )}
      <button
        type="button"
        className={styles.pick}
        aria-pressed={is_picked}
        aria-label={elections_copy.pick_label(candidate.full_name)}
        disabled={!can_pick || is_saving}
        onClick={on_pick}
      >
        {is_picked && <CheckIcon />}
        {is_picked ? elections_copy.picked : elections_copy.pick}
      </button>
    </li>
  );
}
