import type { Leaderboard } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { class_names } from "../../lib/class_names";
import { format_optional_percent } from "../../lib/format";
import { leaderboard_copy } from "./copy";
import styles from "./humans_vs_machine.module.css";

/** Correct winner picks: you (orange), the AI (blue), all fans (gray). */
export function HumansVsMachine({ leaderboard }: { leaderboard: Leaderboard }) {
  const boxes = [
    { id: "you", label: leaderboard_copy.you, share: leaderboard.accuracy.you },
    { id: "ai", label: leaderboard_copy.ai, share: leaderboard.accuracy.ai },
    { id: "fans", label: leaderboard_copy.fans, share: leaderboard.accuracy.fans },
  ];
  return (
    <Card>
      <KalevaSectionTitle title={leaderboard_copy.humans_title} mobile_variant="card" />
      <div className={styles.grid}>
        {boxes.map((box) => (
          <div key={box.id} className={class_names(styles.box, styles[box.id])}>
            <span className={styles.label}>{box.label}</span>
            <span className={styles.value}>{format_optional_percent(box.share)}</span>
          </div>
        ))}
      </div>
      <p className={styles.summary}>
        {leaderboard.compared_weeks > 0 && (
          <>
            {leaderboard_copy.summary_before}
            <b>
              {leaderboard_copy.fans_beat_ai(
                leaderboard.fans_beat_ai_weeks,
                leaderboard.compared_weeks,
              )}
            </b>
            {". "}
          </>
        )}
        {leaderboard_copy.summary_after(leaderboard.game_count, leaderboard.period)}
      </p>
    </Card>
  );
}
