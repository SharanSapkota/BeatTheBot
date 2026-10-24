import { class_names } from "../lib/class_names";
import { shared_copy } from "./copy";
import styles from "./sample_badge.module.css";

/** On every game with data_source "demo": sample fixtures, not real results. */
export function SampleBadge({ on_dark = false }: { on_dark?: boolean }) {
  return (
    <span className={class_names(styles.badge, on_dark && styles.on_dark)}>
      {shared_copy.sample_badge}
    </span>
  );
}
