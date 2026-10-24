import { Card } from "../../components/card";
import { format_percent } from "../../lib/format";
import { after_copy } from "./copy";
import styles from "./result_banner.module.css";

interface ResultBannerProps {
  your_points: number;
  /** "Fans who picked Kärpät" / "… a draw", and that share of the fans (null without picks). */
  fans_label: string | null;
  fans_right_share: number | null;
}

/** Fans vs fans: your points tonight and how many fans picked the winner (or the draw). */
export function ResultBanner({ your_points, fans_label, fans_right_share }: ResultBannerProps) {
  return (
    <Card tone="orange">
      <span className={styles.kicker}>{after_copy.result_kicker}</span>
      <h2 className={styles.headline}>
        {your_points > 0 ? after_copy.points_tonight(your_points) : after_copy.no_points_tonight}
      </h2>
      <div className={styles.grid}>
        <div className={styles.box}>
          <span className={styles.label}>{after_copy.you}</span>
          <span className={styles.points}>{after_copy.points(your_points)}</span>
        </div>
        <div className={styles.box}>
          <span className={styles.label}>{fans_label ?? after_copy.fans}</span>
          <span className={styles.points}>
            {fans_right_share === null ? "–" : format_percent(fans_right_share)}
          </span>
        </div>
      </div>
    </Card>
  );
}
