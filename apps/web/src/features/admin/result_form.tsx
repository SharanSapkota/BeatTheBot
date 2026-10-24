import type { AdminElection } from "@voita_kone/shared_types";
import { useState, type FormEvent } from "react";
import { admin_copy } from "./copy";
import styles from "./admin_form.module.css";

interface ResultFormProps {
  election: AdminElection;
  is_saving: boolean;
  on_save: (body: {
    winner_candidate_id: string;
    vote_counts: Record<string, number> | null;
  }) => void;
}

/** Pick the winner (most votes) and optionally the vote counts. Saving scores the picks. */
export function ResultForm({ election, is_saving, on_save }: ResultFormProps) {
  const [winner, set_winner] = useState(election.result?.winner_candidate_id ?? "");
  const [votes, set_votes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(election.result?.vote_counts ?? {}).map(([id, count]) => [id, String(count)]),
    ),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!winner) {
      return;
    }
    const counts = Object.entries(votes).filter(([, value]) => value !== "");
    on_save({
      winner_candidate_id: winner,
      vote_counts:
        counts.length === 0
          ? null
          : Object.fromEntries(counts.map(([id, value]) => [id, Number(value)])),
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.hint}>{admin_copy.result_hint}</p>
      <fieldset className={styles.grid}>
        <legend className={styles.field}>{admin_copy.winner_group}</legend>
        {election.candidates.map((candidate) => (
          <div key={candidate.id} className={styles.field}>
            <label className={styles.check}>
              <input
                type="radio"
                name="winner"
                value={candidate.id}
                checked={winner === candidate.id}
                onChange={() => set_winner(candidate.id)}
              />
              {candidate.full_name}
            </label>
            <label className={styles.field}>
              <span className={styles.hint}>{admin_copy.votes_label(candidate.full_name)}</span>
              <input
                type="number"
                min={0}
                value={votes[candidate.id] ?? ""}
                onChange={(event) =>
                  set_votes((current) => ({ ...current, [candidate.id]: event.target.value }))
                }
              />
            </label>
          </div>
        ))}
      </fieldset>
      <div className={styles.buttons}>
        <button type="submit" className={styles.button} disabled={is_saving || !winner}>
          {admin_copy.save_result}
        </button>
      </div>
    </form>
  );
}
