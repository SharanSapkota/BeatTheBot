import type { ElectionSummary } from "@voita_kone/shared_types";
import { shared_copy } from "../../components/copy";
import { class_names } from "../../lib/class_names";
import { days_until, elections_copy, format_election_date } from "./copy";
import styles from "./election_meta.module.css";

/** "Oulu · Sat 14 Nov 2026 · 21 days left" + the status and Demo badges. */
export function ElectionMeta({ election, now }: { election: ElectionSummary; now: Date }) {
  const days = days_until(election.election_date, now);
  const parts = [
    election.area_name,
    format_election_date(election.election_date),
    elections_copy.days_left(days),
  ].filter((part) => part !== "");
  return (
    <div className={styles.meta}>
      <span>{parts.join(" · ")}</span>
      <span className={styles.badges}>
        <span className={class_names(styles.status, election.is_poll_open && styles.status_open)}>
          {elections_copy.status_label(election)}
        </span>
        {election.is_demo && <span className={styles.demo}>{shared_copy.demo_badge}</span>}
      </span>
    </div>
  );
}
