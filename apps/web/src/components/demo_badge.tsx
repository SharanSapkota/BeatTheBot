import { class_names } from "../lib/class_names";
import { shared_copy } from "./copy";
import styles from "./demo_badge.module.css";

/**
 * Shown whenever the screen shows a demo replay, not today's real games. Sits on dark;
 * `light_on_desktop` for places that are white from 900 px (the hub's time-jump row).
 */
export function DemoBadge({ light_on_desktop = false }: { light_on_desktop?: boolean }) {
  return (
    <span className={class_names(styles.badge, light_on_desktop && styles.light_on_desktop)}>
      {shared_copy.demo_replay}
    </span>
  );
}
