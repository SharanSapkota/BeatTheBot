import type { Leaderboard } from "@voita_kone/shared_types";
import { leaderboard_copy } from "./copy";
import styles from "./prize_card.module.css";

/** Sponsor prize slot. Prizes go by points (skill), checked by the sports desk. */
export function PrizeCard({ leaderboard }: { leaderboard: Leaderboard }) {
  return (
    <section className={styles.card}>
      <div className={styles.logo} aria-hidden="true">
        {leaderboard_copy.sponsor_logo_line_1}
        <br />
        {leaderboard_copy.sponsor_logo_line_2}
      </div>
      <div className={styles.texts}>
        <span className={styles.kicker}>{leaderboard_copy.prize_kicker(leaderboard.period)}</span>
        <h2 className={styles.title}>{leaderboard.prize.title}</h2>
        <span className={styles.note}>{leaderboard.prize.note}</span>
      </div>
    </section>
  );
}
