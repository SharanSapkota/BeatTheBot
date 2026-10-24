import styles from "./points_badge.module.css";

/** "+10" next to a pick title. */
export function PointsBadge({ text }: { text: string }) {
  return <span className={styles.badge}>{text}</span>;
}
