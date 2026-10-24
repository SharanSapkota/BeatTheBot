import type { TrafficLightValue } from "@voita_kone/shared_types";
import { class_names } from "../../lib/class_names";
import { editor_copy } from "./copy";
import styles from "./traffic_light_chip.module.css";

/** 🟡 / 🔴 review level of a story. */
export function TrafficLightChip({ traffic_light }: { traffic_light: TrafficLightValue }) {
  return (
    <span className={class_names(styles.chip, styles[traffic_light])}>
      {editor_copy.traffic_light[traffic_light]}
    </span>
  );
}
