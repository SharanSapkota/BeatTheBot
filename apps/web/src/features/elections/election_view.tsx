import type { ElectionDetail, ElectionResults } from "@voita_kone/shared_types";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { InlineError } from "../../components/inline_error";
import type { PickCandidate } from "./api";
import { CandidateCard } from "./candidate_card";
import { elections_copy, format_poll_time } from "./copy";
import { ElectionMeta } from "./election_meta";
import styles from "./election_view.module.css";

interface ElectionViewProps {
  election: ElectionDetail;
  /** Undefined while loading or in the admin preview. */
  results: ElectionResults | undefined;
  /** Null in the admin preview (no picks). */
  picker: PickCandidate | null;
  now: Date;
}

function ResultsNote({ results }: { results: ElectionResults | undefined }) {
  if (!results || results.hidden_reason === null) {
    return null;
  }
  return (
    <p className={styles.note} role="status">
      {results.hidden_reason === "pick_first"
        ? elections_copy.results_pick_first
        : elections_copy.results_not_enough(results.min_picks, results.total_picks)}
    </p>
  );
}

function PollNote({ election, now }: { election: ElectionDetail; now: Date }) {
  // Admin preview of a draft: no poll yet.
  if (election.status === "draft") {
    return null;
  }
  if (election.is_poll_open) {
    return election.my_pick ? (
      <p className={styles.note}>
        {elections_copy.change_hint(format_poll_time(election.poll_closes_at))}
      </p>
    ) : null;
  }
  if (election.status === "published" && new Date(election.poll_opens_at) > now) {
    return (
      <p className={styles.note}>
        {elections_copy.opens_at(format_poll_time(election.poll_opens_at))}
      </p>
    );
  }
  return <p className={styles.note}>{elections_copy.closed_text}</p>;
}

function MyResult({ election }: { election: ElectionDetail }) {
  const points = election.my_pick?.points_awarded;
  if (election.winner_candidate_id === null || points === undefined || points === null) {
    return null;
  }
  return (
    <p className={points > 0 ? styles.right : styles.wrong} role="status">
      {points > 0 ? elections_copy.you_were_right(points) : elections_copy.you_were_wrong}
    </p>
  );
}

/** The user view of an election: question, candidate cards, pick, result bars. No AI. */
export function ElectionView({ election, results, picker, now }: ElectionViewProps) {
  const shares = new Map(results?.shares?.map((share) => [share.candidate_id, share]));
  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <span className={styles.type}>{elections_copy.type_label(election.election_type)}</span>
        <h1 className={styles.title}>{election.title}</h1>
        <ElectionMeta election={election} now={now} />
      </header>

      <KalevaSectionTitle title={election.question_text} meta={elections_copy.order_note} />
      <PollNote election={election} now={now} />
      <MyResult election={election} />
      {picker?.error_text && <InlineError text={picker.error_text} />}

      <ul className={styles.candidates} aria-label={elections_copy.candidates_label}>
        {election.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            is_picked={election.my_pick?.candidate_id === candidate.id}
            is_winner={election.winner_candidate_id === candidate.id}
            share={shares.get(candidate.id)}
            can_pick={picker !== null && election.is_poll_open}
            is_saving={picker?.saving_id === candidate.id}
            on_pick={() => picker?.pick(candidate.id)}
          />
        ))}
      </ul>

      <section className={styles.results} aria-label={elections_copy.results_title}>
        <h2 className={styles.results_title}>{elections_copy.results_title}</h2>
        <ResultsNote results={results} />
        <p className={styles.label}>{elections_copy.results_label}</p>
        <p className={styles.small}>{elections_copy.points_note}</p>
      </section>
    </div>
  );
}
