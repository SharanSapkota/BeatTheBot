import { shared_copy } from "./copy";
import styles from "./skeleton.module.css";

interface SkeletonProps {
  /** Heights of the placeholder cards, in the shape of the real screen. */
  card_heights: readonly number[];
}

/** Gray placeholders while data loads. */
export function Skeleton({ card_heights }: SkeletonProps) {
  return (
    <div className={styles.stack} aria-busy="true" aria-label={shared_copy.loading}>
      {card_heights.map((height, index) => (
        <div key={index} className={styles.card} style={{ height: `${String(height)}px` }}>
          <span className={styles.line_wide} />
          <span className={styles.line} />
          <span className={styles.line_short} />
        </div>
      ))}
    </div>
  );
}
