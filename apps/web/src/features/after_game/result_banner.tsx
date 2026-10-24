import { Card } from "../../components/card";
import { after_copy } from "./copy";
import styles from "./result_banner.module.css";

interface ResultBannerProps {
  your_points: number;
  ai_points: number;
}

/** "You beat the AI": your points vs the AI's for its own pick. */
export function ResultBanner({ your_points, ai_points }: ResultBannerProps) {
  let headline: string = after_copy.tied;
  if (your_points > ai_points) {
    headline = after_copy.you_beat_ai;
  } else if (your_points < ai_points) {
    headline = after_copy.ai_beat_you;
  }
  return (
    <Card tone="orange">
      <span className={styles.kicker}>{after_copy.result_kicker}</span>
      <h2 className={styles.headline}>{headline}</h2>
      <div className={styles.grid}>
        <div className={styles.box}>
          <span className={styles.label}>{after_copy.you}</span>
          <span className={styles.points}>{after_copy.points(your_points)}</span>
        </div>
        <div className={styles.box}>
          <span className={styles.label}>{after_copy.ai}</span>
          <span className={styles.points}>{after_copy.points(ai_points)}</span>
        </div>
      </div>
    </Card>
  );
}
