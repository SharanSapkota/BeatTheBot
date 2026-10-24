import { class_names } from "../lib/class_names";
import { RobotIcon } from "./icons/robot_icon";
import styles from "./ai_chip.module.css";

interface AiChipProps {
  text: string;
  /** "hero": a chip on mobile, plain white text in the dark desktop hero. */
  variant?: "chip" | "hero";
}

/** Blue chip with the robot: the AI's view in one line. */
export function AiChip({ text, variant = "chip" }: AiChipProps) {
  return (
    <div className={class_names(styles.chip, styles[variant])}>
      <span className={styles.icon}>
        <RobotIcon />
      </span>
      <span className={styles.text}>{text}</span>
    </div>
  );
}
