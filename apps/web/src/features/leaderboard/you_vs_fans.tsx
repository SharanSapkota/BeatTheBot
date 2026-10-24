import type { Leaderboard } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { class_names } from "../../lib/class_names";
import { format_optional_percent } from "../../lib/format";
import { leaderboard_copy } from "./copy";
import styles from "./you_vs_fans.module.css";

/** Fans vs fans: your correct winner picks (orange) vs all fans (gray). */
export function YouVsFans({ leaderboard }: { leaderboard: Leaderboard }) {
  const { summary } = leaderboard;
  const boxes = [
    { id: "you", label: leaderboard_copy.you, share: summary.you_accuracy },
    { id: "fans", label: leaderboard_copy.fans, share: summary.fans_accuracy },
  ];
  return (
    <Card>
      <KalevaSectionTitle title={leaderboard_copy.you_vs_fans_title} mobile_variant="card" />
      <div className={styles.grid}>
        {boxes.map((box) => (
          <div key={box.id} className={class_names(styles.box, styles[box.id])}>
            <span className={styles.label}>{box.label}</span>
            <span className={styles.value}>{format_optional_percent(box.share)}</span>
          </div>
        ))}
      </div>
      <p className={styles.summary}>
        {leaderboard_copy.summary(summary.games_count, leaderboard.period)}
      </p>
    </Card>
  );
}
