import { shared_copy } from "./copy";
import styles from "./demo_badge.module.css";

/** Shown whenever the screen shows a demo replay, not today's real games. */
export function DemoBadge() {
  return <span className={styles.badge}>{shared_copy.demo_replay}</span>;
}
